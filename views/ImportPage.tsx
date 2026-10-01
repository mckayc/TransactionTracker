
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Transaction, Account, RawTransaction, TransactionType, ReconciliationRule, Counterparty, Category, User, BusinessDocument, DocumentFolder, Tag, AccountType, Location, RuleCategory, View } from '../types';
import { extractTransactionsFromFiles, extractTransactionsFromText } from '../services/geminiService';
import { parseTransactionsFromFiles, parseTransactionsFromText, autoDetectCsvLayout, splitCsvLine } from '../services/csvParserService';
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
  const [useAi, setUseAi] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Manual Column Mapping State
  const [showManualMapping, setShowManualMapping] = useState(true);
  const [manualDateCol, setManualDateCol] = useState('0');
  const [manualDescCol, setManualDescCol] = useState('1');
  const [manualPayeeCol, setManualPayeeCol] = useState('-1');
  const [manualAmountMode, setManualAmountMode] = useState<'single' | 'split'>('single');
  const [manualAmountCol, setManualAmountCol] = useState('2');
  const [manualDebitCol, setManualDebitCol] = useState('2');
  const [manualCreditCol, setManualCreditCol] = useState('3');
  const [manualHasHeader, setManualHasHeader] = useState(false);
  const [manualDelimiter, setManualDelimiter] = useState('\t');

  // Auto-select first account if not selected
  useEffect(() => {
    if (!pasteAccountId && accounts.length > 0) {
      setPasteAccountId(accounts[0].id);
    }
  }, [accounts, pasteAccountId]);

  // Auto detect columns whenever textInput or pasteAccountId changes
  useEffect(() => {
    if (!textInput.trim()) return;
    const lines = textInput.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return;

    const targetAccount = accounts.find(a => a.id === pasteAccountId);
    const existingProfile = targetAccount?.parsingProfile;

    const detected = autoDetectCsvLayout(lines);
    setManualDelimiter(existingProfile?.delimiter || detected.delimiter);
    setManualHasHeader(existingProfile?.hasHeader !== undefined ? existingProfile.hasHeader : detected.hasHeader);
    
    // Set column mapping defaults
    setManualDateCol(existingProfile?.dateColumn !== undefined ? String(existingProfile.dateColumn) : String(detected.dateIdx));
    setManualDescCol(existingProfile?.descriptionColumn !== undefined ? String(existingProfile.descriptionColumn) : String(detected.descIdx));
    setManualPayeeCol(existingProfile?.payeeColumn !== undefined ? String(existingProfile.payeeColumn) : (detected.payeeIdx !== -1 ? String(detected.payeeIdx) : '-1'));
    
    if (existingProfile?.debitColumn !== undefined || existingProfile?.creditColumn !== undefined || (detected.debitIdx !== -1 && detected.creditIdx !== -1)) {
        setManualAmountMode('split');
        setManualDebitCol(existingProfile?.debitColumn !== undefined ? String(existingProfile.debitColumn) : String(detected.debitIdx !== -1 ? detected.debitIdx : 2));
        setManualCreditCol(existingProfile?.creditColumn !== undefined ? String(existingProfile.creditColumn) : String(detected.creditIdx !== -1 ? detected.creditIdx : 3));
    } else {
        setManualAmountMode('single');
        setManualAmountCol(existingProfile?.amountColumn !== undefined ? String(existingProfile.amountColumn) : String(detected.amountIdx));
    }
  }, [textInput, pasteAccountId, accounts]);

  const sampleParsed = useMemo(() => {
    if (!textInput.trim()) return { headers: [], rows: [] };
    const lines = textInput.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const delim = manualDelimiter || (lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ','));
    const rows = lines.map(l => splitCsvLine(l, delim).map(s => s.trim().replace(/^"|"$/g, '')));

    const headerRow = manualHasHeader ? rows[0] : null;
    const dataRows = manualHasHeader ? rows.slice(1, 5) : rows.slice(0, 4);
    const maxCols = Math.max(...rows.map(r => r.length), 3);

    const headers = Array.from({ length: maxCols }, (_, idx) => {
      if (headerRow && headerRow[idx]) return headerRow[idx];
      return `Column ${idx + 1}`;
    });

    return { headers, rows: dataRows };
  }, [textInput, manualDelimiter, manualHasHeader]);

  const sampleHeaders = sampleParsed.headers;
  const sampleRows = sampleParsed.rows;

  const handleSaveAccountMapping = () => {
    if (!pasteAccountId) return;
    const targetAccount = accounts.find(a => a.id === pasteAccountId);
    if (!targetAccount) return;

    const updatedAccount: Account = {
      ...targetAccount,
      parsingProfile: {
        dateColumn: manualDateCol,
        descriptionColumn: manualDescCol,
        payeeColumn: manualPayeeCol !== '-1' ? manualPayeeCol : undefined,
        amountColumn: manualAmountMode === 'single' ? manualAmountCol : undefined,
        debitColumn: manualAmountMode === 'split' ? manualDebitCol : undefined,
        creditColumn: manualAmountMode === 'split' ? manualCreditCol : undefined,
        hasHeader: manualHasHeader,
        delimiter: manualDelimiter
      }
    };
    onAddAccount(updatedAccount);
    alert(`Successfully saved layout as default for '${targetAccount.name}'!`);
  };

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
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Ledger Account</label>
                                                    <select 
                                                        value={pasteAccountId} 
                                                        onChange={(e) => setPasteAccountId(e.target.value)} 
                                                        className="w-full font-bold text-slate-700 p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white transition-all text-sm"
                                                    >
                                                        <option value="">Select Account...</option>
                                                        {accounts.filter(Boolean).map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.identifier})</option>)}
                                                    </select>
                                                </div>
                                                
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Processing Method</label>
                                                    <label className="flex items-center justify-between gap-2 cursor-pointer bg-slate-50 px-4 py-2.5 rounded-2xl group border-2 border-slate-100 hover:border-indigo-200 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-1.5 rounded-lg ${useAi ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                                <RobotIcon className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-black text-slate-700 uppercase tracking-tight block">AI Reasoning</span>
                                                                <span className="text-[9px] text-slate-400 font-medium">Manual mapping is faster & 100% predictable</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input type="checkbox" className="sr-only" checked={useAi} onChange={() => setUseAi(!useAi)} />
                                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${useAi ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${useAi ? 'left-4.5' : 'left-0.5'}`} />
                                                            </div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Pasted Raw Statement / CSV Data
                                                    </label>
                                                    {textInput.trim() && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => setShowManualMapping(!showManualMapping)} 
                                                            className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all"
                                                        >
                                                            <TableIcon className="w-3.5 h-3.5" />
                                                            {showManualMapping ? 'Collapse Column Mapper' : 'Customize Column Mapping'}
                                                        </button>
                                                    )}
                                                </div>
                                                <textarea 
                                                    value={textInput} 
                                                    onChange={e => setTextInput(e.target.value)} 
                                                    placeholder="Paste raw bank CSV, tab-delimited text, or table rows here..." 
                                                    className="w-full h-28 p-3 font-mono text-[11px] bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 resize-none transition-all" 
                                                />
                                            </div>

                                            {/* Inline Column Mapper & Preview */}
                                            {textInput.trim() && showManualMapping && (
                                                <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-4 shadow-xl animate-fade-in border border-slate-800">
                                                    <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                                                                <TableIcon className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-black uppercase tracking-wider text-indigo-300 block">Manual Column Mapper</span>
                                                                <span className="text-[9px] text-slate-400">Map columns directly without AI reasoning</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-3">
                                                            {/* Delimiter */}
                                                            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Separator:</span>
                                                                <select 
                                                                    value={manualDelimiter} 
                                                                    onChange={e => setManualDelimiter(e.target.value)}
                                                                    className="bg-slate-900 text-xs text-indigo-300 font-bold rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none"
                                                                >
                                                                    <option value="\t">Tab (\t)</option>
                                                                    <option value=",">Comma (,)</option>
                                                                    <option value=";">Semicolon (;)</option>
                                                                    <option value="|">Pipe (|)</option>
                                                                </select>
                                                            </div>

                                                            {/* Header Checkbox */}
                                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 cursor-pointer bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={manualHasHeader} 
                                                                    onChange={e => setManualHasHeader(e.target.checked)} 
                                                                    className="rounded border-slate-700 bg-slate-800 text-indigo-500"
                                                                />
                                                                Row 1 is Header
                                                            </label>

                                                            {/* Amount Mode Toggle */}
                                                            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[9px] font-bold">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setManualAmountMode('single')}
                                                                    className={`px-2 py-1 rounded ${manualAmountMode === 'single' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-white'}`}
                                                                >
                                                                    1 Amount Col
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setManualAmountMode('split')}
                                                                    className={`px-2 py-1 rounded ${manualAmountMode === 'split' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-white'}`}
                                                                >
                                                                    Debit / Credit
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Quick Presets */}
                                                    <div className="flex items-center gap-2 overflow-x-auto text-[10px] pb-1">
                                                        <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider shrink-0">Quick Layouts:</span>
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                setManualDateCol('0');
                                                                setManualDescCol('1');
                                                                setManualAmountCol('2');
                                                                setManualPayeeCol('-1');
                                                                setManualAmountMode('single');
                                                            }}
                                                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium shrink-0 border border-slate-700/50"
                                                        >
                                                            Date | Memo | Amount
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                setManualDateCol('0');
                                                                setManualPayeeCol('1');
                                                                setManualDescCol('2');
                                                                setManualAmountCol('3');
                                                                setManualAmountMode('single');
                                                            }}
                                                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium shrink-0 border border-slate-700/50"
                                                        >
                                                            Date | Payee | Memo | Amount
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                setManualDateCol('0');
                                                                setManualDescCol('1');
                                                                setManualDebitCol('2');
                                                                setManualCreditCol('3');
                                                                setManualAmountMode('split');
                                                            }}
                                                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium shrink-0 border border-slate-700/50"
                                                        >
                                                            Date | Memo | Debit | Credit
                                                        </button>
                                                    </div>

                                                    {/* Mapping Dropdowns */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                        <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/60">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                                                                <label className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Transaction Date</label>
                                                            </div>
                                                            <select 
                                                                value={manualDateCol} 
                                                                onChange={e => setManualDateCol(e.target.value)}
                                                                className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                                                            >
                                                                {sampleHeaders.map((h, idx) => (
                                                                    <option key={idx} value={String(idx)}>Col {idx + 1}: {h}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/60">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                                <label className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">Memo / Description</label>
                                                            </div>
                                                            <select 
                                                                value={manualDescCol} 
                                                                onChange={e => setManualDescCol(e.target.value)}
                                                                className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                                                            >
                                                                {sampleHeaders.map((h, idx) => (
                                                                    <option key={idx} value={String(idx)}>Col {idx + 1}: {h}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/60">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                                                <label className="text-[9px] font-black text-purple-300 uppercase tracking-widest">Payee / Merchant (Opt)</label>
                                                            </div>
                                                            <select 
                                                                value={manualPayeeCol} 
                                                                onChange={e => setManualPayeeCol(e.target.value)}
                                                                className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                                                            >
                                                                <option value="-1">-- None (in Memo) --</option>
                                                                {sampleHeaders.map((h, idx) => (
                                                                    <option key={idx} value={String(idx)}>Col {idx + 1}: {h}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {manualAmountMode === 'single' ? (
                                                            <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/60">
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                                    <label className="text-[9px] font-black text-amber-300 uppercase tracking-widest">Amount Column</label>
                                                                </div>
                                                                <select 
                                                                    value={manualAmountCol} 
                                                                    onChange={e => setManualAmountCol(e.target.value)}
                                                                    className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                                                                >
                                                                    {sampleHeaders.map((h, idx) => (
                                                                        <option key={idx} value={String(idx)}>Col {idx + 1}: {h}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/60 grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <div className="flex items-center gap-1 mb-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                                        <label className="text-[8px] font-black text-rose-300 uppercase">Debit (Out)</label>
                                                                    </div>
                                                                    <select 
                                                                        value={manualDebitCol} 
                                                                        onChange={e => setManualDebitCol(e.target.value)}
                                                                        className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-1 text-[11px] font-bold"
                                                                    >
                                                                        {sampleHeaders.map((h, idx) => (
                                                                            <option key={idx} value={String(idx)}>Col {idx + 1}: {h}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-1 mb-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                                        <label className="text-[8px] font-black text-emerald-300 uppercase">Credit (In)</label>
                                                                    </div>
                                                                    <select 
                                                                        value={manualCreditCol} 
                                                                        onChange={e => setManualCreditCol(e.target.value)}
                                                                        className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-1 text-[11px] font-bold"
                                                                    >
                                                                        {sampleHeaders.map((h, idx) => (
                                                                            <option key={idx} value={String(idx)}>Col {idx + 1}: {h}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Sample Data Rows Preview */}
                                                    {sampleRows.length > 0 && (
                                                        <div className="bg-slate-950/70 rounded-xl p-2.5 overflow-x-auto border border-slate-800">
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                                                <span>Live Preview (First {sampleRows.length} Rows)</span>
                                                                <span className="text-[8px] text-slate-500 lowercase">assigned roles highlighted</span>
                                                            </div>
                                                            <table className="w-full text-[10px] font-mono text-left text-slate-300">
                                                                <thead>
                                                                    <tr className="border-b border-slate-800 text-slate-400">
                                                                        {sampleHeaders.map((_, idx) => {
                                                                            const isDate = Number(manualDateCol) === idx;
                                                                            const isDesc = Number(manualDescCol) === idx;
                                                                            const isPayee = Number(manualPayeeCol) === idx;
                                                                            const isAmount = manualAmountMode === 'single' && Number(manualAmountCol) === idx;
                                                                            const isDebit = manualAmountMode === 'split' && Number(manualDebitCol) === idx;
                                                                            const isCredit = manualAmountMode === 'split' && Number(manualCreditCol) === idx;

                                                                            return (
                                                                                <th key={idx} className="p-1.5 px-2">
                                                                                    {isDate ? (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">[Date]</span>
                                                                                    ) : isDesc ? (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">[Memo]</span>
                                                                                    ) : isPayee ? (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">[Payee]</span>
                                                                                    ) : isAmount ? (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">[Amount]</span>
                                                                                    ) : isDebit ? (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">[Debit]</span>
                                                                                    ) : isCredit ? (
                                                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">[Credit]</span>
                                                                                    ) : (
                                                                                        <span className="text-slate-500">Col {idx + 1}</span>
                                                                                    )}
                                                                                </th>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {sampleRows.map((row, rIdx) => (
                                                                        <tr key={rIdx} className="border-b border-slate-900/60 hover:bg-white/5 transition-colors">
                                                                            {row.map((cell, cIdx) => {
                                                                                const isDate = Number(manualDateCol) === cIdx;
                                                                                const isDesc = Number(manualDescCol) === cIdx;
                                                                                const isPayee = Number(manualPayeeCol) === cIdx;
                                                                                const isAmount = manualAmountMode === 'single' && Number(manualAmountCol) === cIdx;
                                                                                const isDebit = manualAmountMode === 'split' && Number(manualDebitCol) === cIdx;
                                                                                const isCredit = manualAmountMode === 'split' && Number(manualCreditCol) === cIdx;

                                                                                return (
                                                                                    <td 
                                                                                        key={cIdx} 
                                                                                        className={`p-1.5 px-2 whitespace-nowrap ${
                                                                                            isDate ? 'text-indigo-300 font-semibold' : 
                                                                                            isDesc ? 'text-emerald-300 font-semibold' : 
                                                                                            isPayee ? 'text-purple-300 font-semibold' : 
                                                                                            isAmount ? 'text-amber-300 font-semibold' : 
                                                                                            isDebit ? 'text-rose-300 font-semibold' : 
                                                                                            isCredit ? 'text-emerald-300 font-semibold' : 
                                                                                            'text-slate-500'
                                                                                        }`}
                                                                                    >
                                                                                        {cell || '---'}
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}

                                                    {pasteAccountId && (
                                                        <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                                                            <span className="text-[10px] text-slate-400">
                                                                Target: <strong className="text-slate-300">{accounts.find(a => a.id === pasteAccountId)?.name || 'Selected Account'}</strong>
                                                            </span>
                                                            <button 
                                                                type="button" 
                                                                onClick={handleSaveAccountMapping}
                                                                className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-wider flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/30 transition-all"
                                                            >
                                                                Save this layout as default for {accounts.find(a => a.id === pasteAccountId)?.name}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <button 
                                                onClick={async () => {
                                                    setAppState('processing');
                                                    setError(null);
                                                    try {
                                                        const targetAccount = accounts.find(a => a.id === pasteAccountId);
                                                        const customProfile = {
                                                            dateColumn: manualDateCol,
                                                            descriptionColumn: manualDescCol,
                                                            payeeColumn: manualPayeeCol !== '-1' ? manualPayeeCol : undefined,
                                                            amountColumn: manualAmountMode === 'single' ? manualAmountCol : undefined,
                                                            debitColumn: manualAmountMode === 'split' ? manualDebitCol : undefined,
                                                            creditColumn: manualAmountMode === 'split' ? manualCreditCol : undefined,
                                                            hasHeader: manualHasHeader,
                                                            delimiter: manualDelimiter
                                                        };
                                                        const raw = useAi 
                                                            ? await extractTransactionsFromText(textInput, pasteAccountId, transactionTypes, categories, setProgressMessage) 
                                                            : await parseTransactionsFromText(textInput, pasteAccountId, transactionTypes, setProgressMessage, targetAccount, customProfile);
                                                        
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
                                                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 text-sm uppercase tracking-wider transition-all active:scale-[0.99]"
                                            >
                                                {!pasteAccountId 
                                                    ? 'Select an Account to Process' 
                                                    : `Process ${useAi ? 'with AI Reasoning' : 'Directly via Column Map'} & Extract Transactions`}
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
                                    
                                    {(error?.toLowerCase().includes('header') || error?.toLowerCase().includes('column') || error?.toLowerCase().includes('map') || true) ? (
                                        <div className="bg-white/50 p-6 rounded-2xl border border-red-200 mt-4 space-y-4">
                                            <div className="flex items-start gap-4 text-left">
                                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><InfoIcon className="w-5 h-5"/></div>
                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                    You can map columns directly on this page without using AI reasoning. Click below to review or adjust the date, memo, and amount column positions for your pasted data.
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button 
                                                    onClick={() => {
                                                        setAppState('idle');
                                                        setImportMethod('paste');
                                                        setUseAi(false);
                                                        setShowManualMapping(true);
                                                    }}
                                                    className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md"
                                                >
                                                    <TableIcon className="w-4 h-4" /> Map Columns for Pasted Data
                                                </button>
                                                <button 
                                                    onClick={() => onNavigate?.('management')}
                                                    className="px-4 py-3 bg-white text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-50 text-xs"
                                                >
                                                    Identity Hub
                                                </button>
                                                <button 
                                                    onClick={() => setAppState('idle')}
                                                    className="px-4 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 text-xs"
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
