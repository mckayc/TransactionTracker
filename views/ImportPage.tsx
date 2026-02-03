
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Transaction, Account, RawTransaction, TransactionType, ReconciliationRule, Counterparty, Category, User, BusinessDocument, DocumentFolder, Tag, AccountType, Location, RuleCategory, View } from '../types';
import { extractTransactionsFromFiles, extractTransactionsFromText } from '../services/geminiService';
import { parseTransactionsFromFiles, parseTransactionsFromText } from '../services/csvParserService';
import { mergeTransactions } from '../services/transactionService';
import { applyRulesToTransactions } from '../services/ruleService';
import FileUpload from '../components/FileUpload';
import { ResultsDisplay } from '../components/ResultsDisplay';
import TransactionTable from '../components/TransactionTable';
import ImportVerification from '../components/ImportVerification';
import { CalendarIcon, SparklesIcon, RobotIcon, TableIcon, CloudArrowUpIcon, ExclamationTriangleIcon, AddIcon, ChecklistIcon, DatabaseIcon, WrenchIcon, InfoIcon, ArrowRightIcon, ListIcon, SlashIcon, FilterIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { parseISOLocal, formatDate } from '../dateUtils';

type AppState = 'idle' | 'processing' | 'verifying_import' | 'post_import_edit' | 'success' | 'error';
type ImportMethod = 'upload' | 'paste';
type DateFilterMode = 'all' | 'last_month' | 'custom';

interface ImportPageProps {
  onTransactionsAdded: (newTransactions: Transaction[], newCategories: Category[]) => void;
  transactions: Transaction[]; 
  accounts: Account[];
  onAddAccount: (account: Account) => void;
  onAddAccountType: (type: AccountType) => void;
  accountTypes: AccountType[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  rules: ReconciliationRule[];
  counterparties: Counterparty[];
  locations: Location[];
  users: User[];
  onAddDocument: (doc: BusinessDocument) => void;
  documentFolders: DocumentFolder[];
  onCreateFolder: (folder: DocumentFolder) => void;
  onSaveRule: (rule: ReconciliationRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onSaveCategory: (category: Category) => void;
  onSaveCounterparty: (p: Counterparty) => void;
  onSaveLocation: (location: Location) => void;
  onSaveUser: (user: User) => void;
  onSaveTag: (tag: Tag) => void;
  onAddTransactionType: (type: TransactionType) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  ruleCategories: RuleCategory[];
  onSaveRuleCategory: (rc: RuleCategory) => void;
  onSaveCounterparties: (ps: Counterparty[]) => void;
  onSaveLocations: (ls: Location[]) => void;
  onSaveCategories: (cs: Category[]) => void;
  onNavigate?: (view: View) => void;
}

const ImportPage: React.FC<ImportPageProps> = ({ 
    onTransactionsAdded, transactions: recentGlobalTransactions, accounts, categories, tags, rules, counterparties, locations, users, transactionTypes, accountTypes, onSaveCategory, onSaveCounterparty, 
    onSaveLocation, onSaveUser,
    onSaveTag, onAddTransactionType, onUpdateTransaction, onDeleteTransaction, onSaveRule, onDeleteRule, onAddAccount,
    ruleCategories, onSaveRuleCategory,
    onSaveCounterparties, onSaveLocations, onSaveCategories, onNavigate
}) => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [dashboardRange, setDashboardRange] = useState<'all' | 'year' | 'month'>('year');
  const [summaryTotals, setSummaryTotals] = useState<Record<string, number>>({});
  const [importMethod, setImportMethod] = useState<ImportMethod>('upload');
  const [textInput, setTextInput] = useState('');
  const [pasteAccountId, setPasteAccountId] = useState<string>('');
  const [useAi, setUseAi] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);

  // Date Filter State
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [customFilterStart, setCustomFilterStart] = useState('');
  const [customFilterEnd, setCustomFilterEnd] = useState('');

  const [rawTransactionsToVerify, setRawTransactionsToVerify] = useState<(RawTransaction & { categoryId: string; tempId: string; isIgnored?: boolean; dateIgnored?: boolean })[]>([]);
  const [stagedImportedTxs, setStagedImportedTxs] = useState<Transaction[]>([]);
  const [duplicatesStats, setDuplicatesStats] = useState({ ignored: 0, imported: 0 });

  const hasCoreConfiguration = transactionTypes.length >= 6 && categories.length > 0;
  const hasAccount = accounts.length > 0;

  useEffect(() => {
    const fetchSummary = async () => {
        const now = new Date();
        let startDate = '';
        if (dashboardRange === 'year') startDate = `${now.getFullYear()}-01-01`;
        if (dashboardRange === 'month') startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        try {
            const result = await api.getSummary({ startDate });
            setSummaryTotals(result);
        } catch (e: any) {
            console.error("[IMPORT] Summary fetch failed:", e);
        }
    };
    fetchSummary();
  }, [dashboardRange, recentGlobalTransactions]);

  const activeFilterRange = useMemo(() => {
      if (dateFilterMode === 'all') return null;
      if (dateFilterMode === 'last_month') {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          return { start, end };
      }
      if (dateFilterMode === 'custom' && customFilterStart && customFilterEnd) {
          return { start: parseISOLocal(customFilterStart), end: parseISOLocal(customFilterEnd) };
      }
      return null;
  }, [dateFilterMode, customFilterStart, customFilterEnd]);

  const handleQuickStart = async () => {
      setIsInitializing(true);
      try {
          await api.repairSystem();
          const mainAccount: Account = {
              id: 'acc_primary',
              name: 'Main Ledger',
              identifier: '0000',
              accountTypeId: accountTypes[0]?.id || 'at_checking'
          };
          onAddAccount(mainAccount);
          setTimeout(() => window.location.reload(), 500);
      } catch (err) {
          setError("Quick Start failed. Please try manual configuration in 'Organize Data'.");
      } finally {
          setIsInitializing(false);
      }
  };

  const applyRulesAndSetStaging = useCallback((rawTransactions: RawTransaction[], userId: string, currentRules: ReconciliationRule[]) => {
    try {
        if (!rawTransactions || rawTransactions.length === 0) {
            setError("No transactions were found. Check if the file matches your Account's Header Map.");
            setAppState('error');
            return;
        }

        const safeRaw = (rawTransactions || []).filter(tx => tx && typeof tx === 'object');
        if (safeRaw.length === 0) {
            throw new Error("Input dataset contained no valid objects.");
        }

        const rawWithUser = safeRaw.map(tx => ({ ...tx, userId: userId || 'user_primary' }));
        const transactionsWithRules = applyRulesToTransactions(rawWithUser, currentRules, accounts);
        const validCategories = (categories || []).filter(Boolean);
        const categoryNameToIdMap = new Map(validCategories.map(c => [c.name.toLowerCase(), c.id]));
        const otherCategoryId = categoryNameToIdMap.get('other') || validCategories[0]?.id || '';

        const processedTransactions = transactionsWithRules.map(tx => {
            let finalCategoryId = tx.categoryId;
            if (!finalCategoryId) {
                const aiCategoryName = (tx.category || '').toLowerCase();
                finalCategoryId = categoryNameToIdMap.get(aiCategoryName) || otherCategoryId;
            }

            // Apply Date Filter Constraints
            let dateIgnored = false;
            if (activeFilterRange) {
                const txDate = parseISOLocal(tx.date);
                if (txDate < activeFilterRange.start || txDate > activeFilterRange.end) {
                    dateIgnored = true;
                }
            }

            return { 
                ...tx, 
                categoryId: finalCategoryId, 
                tempId: generateUUID(), 
                isIgnored: tx.isIgnored || dateIgnored,
                dateIgnored 
            };
        });
        
        setRawTransactionsToVerify(processedTransactions);
    } catch (e: any) {
        setError(`Transformation error: ${e.message || 'Internal logic error'}`);
        setAppState('error');
    }
  }, [categories, accounts, activeFilterRange]);

  const handleFileUpload = useCallback(async (files: File[], accountId: string, aiMode: boolean) => {
    setError(null);
    setAppState('processing');
    setProgressMessage(aiMode ? 'AI Thinking (Analyzing Statements)...' : 'Parsing local files...');
    try {
      const targetAccount = accounts.find(a => a.id === accountId);
      const raw = aiMode 
        ? await extractTransactionsFromFiles(files, accountId, transactionTypes, categories, setProgressMessage) 
        : await parseTransactionsFromFiles(files, accountId, transactionTypes, setProgressMessage, targetAccount);
      
      const safeRaw = (raw || []).filter(tx => tx && typeof tx === 'object');
      
      const validUsers = Array.isArray(users) ? users.filter(Boolean) : [];
      const defaultUser = validUsers.length > 0 ? (validUsers.find(u => u.isDefault) || validUsers[0]) : null;
      applyRulesAndSetStaging(safeRaw, defaultUser?.id || 'user_primary', rules);
      setAppState('verifying_import');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred during extraction.');
      setAppState('error');
    }
  }, [transactionTypes, categories, users, rules, accounts, applyRulesAndSetStaging]);

  const handleVerificationComplete = async (verified: (RawTransaction & { categoryId: string; })[]) => {
      const { added, duplicates } = mergeTransactions(recentGlobalTransactions.filter(Boolean), verified.filter(Boolean));
      setStagedImportedTxs(added);
      setDuplicatesStats({ ignored: duplicates.length, imported: 0 });
      
      if (added.length > 0) {
        onTransactionsAdded(added, []);
        setAppState('post_import_edit');
      } else {
        setAppState('success');
      }
  };

  const isImportFormVisible = appState === 'idle' || appState === 'processing' || appState === 'error' || appState === 'success';

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center flex-shrink-0 px-1">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Ledger Verification</h1>
            <p className="text-sm text-slate-500">Bring your records into the local system.</p>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-hidden">
        {!hasAccount && appState === 'idle' ? (
             <div className="flex-1 flex items-center justify-center p-4">
                 <div className="max-w-2xl w-full bg-white p-12 rounded-[3rem] shadow-xl border border-slate-200 text-center space-y-8 animate-fade-in">
                    <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <SparklesIcon className="w-12 h-12" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">Welcome to FinParser</h2>
                        <p className="text-slate-500 mt-3 text-lg leading-relaxed">
                            Your self-hosted financial engine is ready. To begin importing, we need to initialize your 
                            primary ledger account and verify system logic.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <ChecklistIcon className="w-6 h-6 text-indigo-500 mb-2" />
                            <h4 className="font-bold text-slate-700 text-sm">System Seed</h4>
                            <p className="text-[10px] text-slate-400 uppercase font-black">6 Core Tx Types</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <DatabaseIcon className="w-6 h-6 text-indigo-500 mb-2" />
                            <h4 className="font-bold text-slate-700 text-sm">Default Ledger</h4>
                            <p className="text-[10px] text-slate-400 uppercase font-black">Main Checking</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <RobotIcon className="w-6 h-6 text-indigo-500 mb-2" />
                            <h4 className="font-bold text-slate-700 text-sm">AI Training</h4>
                            <p className="text-[10px] text-slate-400 uppercase font-black">Schema Validation</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleQuickStart} 
                        disabled={isInitializing}
                        className="w-full py-5 bg-indigo-600 text-white font-black text-xl rounded-3xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                        {isInitializing ? <div className="w-6 h-6 border-4 border-t-white rounded-full animate-spin" /> : <AddIcon className="w-6 h-6" />}
                        {isInitializing ? 'INITIALIZING...' : 'One-Click Quick Start'}
                    </button>
                 </div>
             </div>
        ) : !hasCoreConfiguration && appState === 'idle' ? (
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-red-50 border-2 border-red-100 p-12 rounded-[3rem] text-center space-y-8 animate-pulse">
                    <div className="w-24 h-24 bg-red-600 rounded-full text-white flex items-center justify-center mx-auto shadow-xl"><ExclamationTriangleIcon className="w-12 h-12" /></div>
                    <div>
                        <h3 className="text-3xl font-black text-red-800">Engine Logic Failure</h3>
                        <p className="text-lg text-red-700 mt-4 leading-relaxed">
                            The internal transaction types or categories are missing from the database. 
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => onNavigate?.('settings')}
                            className="w-full py-5 bg-red-600 text-white font-black text-xl rounded-2xl shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3"
                        >
                            <WrenchIcon className="w-6 h-6" /> Open Diagnostics Hub
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            <>
            {isImportFormVisible && (
                <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0 animate-fade-in">
                    <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        {appState === 'idle' ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">Quick Import</h2>
                                    <div className="flex p-1 bg-slate-100 rounded-xl">
                                        <button onClick={() => setImportMethod('upload')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${importMethod === 'upload' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>FILE</button>
                                        <button onClick={() => setImportMethod('paste')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${importMethod === 'paste' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>TEXT</button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                                    {importMethod === 'upload' ? (
                                        <FileUpload onFileUpload={handleFileUpload} disabled={false} accounts={accounts} />
                                    ) : (
                                        <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <select value={pasteAccountId} onChange={(e) => setPasteAccountId(e.target.value)} className="w-full font-bold text-slate-700">
                                                    <option value="">Select Account...</option>
                                                    {accounts.filter(Boolean).map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.identifier})</option>)}
                                                </select>
                                                
                                                <label className="flex items-center justify-between gap-2 cursor-pointer bg-slate-100 px-4 py-3 rounded-2xl group border border-transparent hover:border-indigo-200 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <RobotIcon className={`w-5 h-5 ${useAi ? 'text-indigo-600' : 'text-slate-400'}`} />
                                                        <span className="text-xs font-black text-slate-500 uppercase tracking-tight">AI Reasoning</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input type="checkbox" className="sr-only" checked={useAi} onChange={() => setUseAi(!useAi)} />
                                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${useAi ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useAi ? 'left-6' : 'left-1'}`} />
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>

                                            <textarea 
                                                value={textInput} 
                                                onChange={e => setTextInput(e.target.value)} 
                                                placeholder="Paste CSV rows..." 
                                                className="w-full h-32 p-3 font-mono text-[10px] bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white resize-none" 
                                            />
                                            <button 
                                                onClick={async () => {
                                                    setAppState('processing');
                                                    setError(null);
                                                    try {
                                                        const targetAccount = accounts.find(a => a.id === pasteAccountId);
                                                        const raw = useAi 
                                                            ? await extractTransactionsFromText(textInput, pasteAccountId, transactionTypes, categories, setProgressMessage) 
                                                            : await parseTransactionsFromText(textInput, pasteAccountId, transactionTypes, setProgressMessage, targetAccount);
                                                        
                                                        const safeRaw = (raw || []).filter(tx => tx && typeof tx === 'object');
                                                        const validUsers = Array.isArray(users) ? users.filter(Boolean) : [];
                                                        const defaultUser = validUsers.length > 0 ? (validUsers.find(u => u.isDefault) || validUsers[0]) : null;
                                                        applyRulesAndSetStaging(safeRaw, defaultUser?.id || 'user_primary', rules);
                                                        setAppState('verifying_import');
                                                    } catch(e: any) { 
                                                        setAppState('error'); 
                                                        setError(e.message || 'Unknown error'); 
                                                    }
                                                }} 
                                                disabled={!textInput.trim() || !pasteAccountId} 
                                                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                Process Text
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : appState === 'processing' ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                                <p className="font-black text-slate-800 text-lg">{progressMessage}</p>
                            </div>
                        ) : appState === 'success' ? (
                            <ResultsDisplay 
                                appState="success" 
                                error={null} 
                                progressMessage="" 
                                transactions={[]} 
                                duplicatesIgnored={duplicatesStats.ignored} 
                                duplicatesImported={duplicatesStats.imported} 
                                onClear={() => setAppState('idle')} 
                            />
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-red-50 border-2 border-red-100 p-8 rounded-[2rem] text-center space-y-4 animate-slide-up">
                                    <div className="w-16 h-16 bg-red-600 rounded-full text-white flex items-center justify-center mx-auto shadow-lg"><ExclamationTriangleIcon className="w-8 h-8" /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-red-800">Processing Interrupted</h3>
                                        <p className="text-red-700 mt-2 font-medium leading-relaxed">{error}</p>
                                    </div>
                                    
                                    {(error?.toLowerCase().includes('header') || error?.toLowerCase().includes('column') || error?.toLowerCase().includes('map')) ? (
                                        <div className="bg-white/50 p-6 rounded-2xl border border-red-200 mt-4 space-y-4">
                                            <div className="flex items-start gap-4 text-left">
                                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><InfoIcon className="w-5 h-5"/></div>
                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                    This system uses <strong>Header Maps</strong> to read local files. You must teach the engine which columns in your bank's CSV represent the date, memo, and amount.
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button 
                                                    onClick={() => onNavigate?.('management')}
                                                    className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md"
                                                >
                                                    Setup Mapping in Identity Hub <ArrowRightIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setAppState('idle')}
                                                    className="px-6 py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => setAppState('idle')}
                                            className="px-10 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-black transition-all"
                                        >
                                            Try Again
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Date Constraints Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CalendarIcon className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-lg font-black text-slate-800">Import Window</h2>
                        </div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">Automatically ignore entries outside of this range.</p>
                        
                        <div className="space-y-4 mt-2">
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button 
                                    onClick={() => setDateFilterMode('all')}
                                    className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase ${dateFilterMode === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Import All
                                </button>
                                <button 
                                    onClick={() => setDateFilterMode('last_month')}
                                    className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase ${dateFilterMode === 'last_month' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Last Month
                                </button>
                                <button 
                                    onClick={() => setDateFilterMode('custom')}
                                    className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase ${dateFilterMode === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Custom
                                </button>
                            </div>

                            {dateFilterMode === 'custom' && (
                                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                        <input type="date" value={customFilterStart} onChange={e => setCustomFilterStart(e.target.value)} className="w-full p-2 text-xs font-bold bg-slate-50 border-2 border-slate-100 rounded-xl" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                        <input type="date" value={customFilterEnd} onChange={e => setCustomFilterEnd(e.target.value)} className="w-full p-2 text-xs font-bold bg-slate-50 border-2 border-slate-100 rounded-xl" />
                                    </div>
                                </div>
                            )}

                            {dateFilterMode === 'last_month' && (
                                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3 animate-fade-in">
                                    <FilterIcon className="w-4 h-4 text-indigo-600" />
                                    <p className="text-[11px] font-bold text-indigo-900">
                                        Ingesting: <span className="font-mono">{formatDate(activeFilterRange!.start)}</span> &rarr; <span className="font-mono">{formatDate(activeFilterRange!.end)}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {appState === 'verifying_import' ? (
                    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
                        <ImportVerification rules={rules} onSaveRule={onSaveRule} onDeleteRule={onDeleteRule} initialTransactions={rawTransactionsToVerify} onComplete={handleVerificationComplete} onCancel={() => setAppState('idle')} accounts={accounts} categories={categories} transactionTypes={transactionTypes} counterparties={counterparties} locations={locations} users={users} tags={tags} existingTransactions={recentGlobalTransactions} onSaveCategory={onSaveCategory} onSaveCounterparty={onSaveCounterparty} onSaveLocation={onSaveLocation} onSaveUser={onSaveUser} onSaveTag={onSaveTag} onAddTransactionType={onAddTransactionType} ruleCategories={ruleCategories} onSaveRuleCategory={onSaveRuleCategory} onSaveCounterparties={onSaveCounterparties} onSaveLocations={onSaveLocations} onSaveCategories={onSaveCategories} />
                    </div>
                ) : appState === 'post_import_edit' ? (
                    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in min-h-0 h-full">
                        <div className="flex justify-between items-center mb-6 bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><SparklesIcon className="w-6 h-6 text-indigo-600" /> Final Polish</h2>
                                <p className="text-sm text-slate-500">Review {stagedImportedTxs.length} ingested transactions. ({duplicatesStats.ignored} duplicates were automatically skipped).</p>
                            </div>
                            <button onClick={() => { setAppState('idle'); setStagedImportedTxs([]); }} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Finish</button>
                        </div>
                        <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl relative shadow-inner">
                            <TransactionTable transactions={stagedImportedTxs} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users} onUpdateTransaction={onUpdateTransaction} onDeleteTransaction={onDeleteTransaction} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black text-slate-800">Ready to Import</h2>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500">
                                    <TableIcon className="w-3 h-3" /> WAITING
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/30 border-2 border-dashed border-slate-200 rounded-3xl">
                            <CloudArrowUpIcon className="w-12 h-12 text-slate-200 mb-4" />
                            <p className="text-slate-400 font-medium">No files in queue. Start by uploading or pasting data above.</p>
                        </div>
                    </div>
                )}
            </div>
            </>
        )}
      </div>
    </div>
  );
};

export default ImportPage;
