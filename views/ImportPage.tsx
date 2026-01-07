import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Transaction, Account, RawTransaction, TransactionType, ReconciliationRule, Counterparty, Category, User, BusinessDocument, DocumentFolder, Tag, AccountType, Location } from '../types';
import { extractTransactionsFromFiles, extractTransactionsFromText } from '../services/geminiService';
import { parseTransactionsFromFiles, parseTransactionsFromText } from '../services/csvParserService';
import { mergeTransactions } from '../services/transactionService';
import { applyRulesToTransactions } from '../services/ruleService';
import FileUpload from '../components/FileUpload';
import { ResultsDisplay } from '../components/ResultsDisplay';
import TransactionTable from '../components/TransactionTable';
import ImportVerification from '../components/ImportVerification';
import { CalendarIcon, SparklesIcon, RobotIcon, TableIcon, CloudArrowUpIcon, ExclamationTriangleIcon, AddIcon, ChecklistIcon, DatabaseIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';

type AppState = 'idle' | 'processing' | 'verifying_import' | 'post_import_edit' | 'success' | 'error';
type ImportMethod = 'upload' | 'paste';

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
  onSaveCategory: (category: Category) => void;
  onSaveCounterparty: (p: Counterparty) => void;
  onSaveTag: (tag: Tag) => void;
  onAddTransactionType: (type: TransactionType) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
}

const ImportPage: React.FC<ImportPageProps> = ({ 
    onTransactionsAdded, transactions: recentGlobalTransactions, accounts, categories, tags, rules, counterparties, locations, users, transactionTypes, accountTypes, onSaveCategory, onSaveCounterparty, onSaveTag, onAddTransactionType, onUpdateTransaction, onDeleteTransaction, onSaveRule, onAddAccount 
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

  const [rawTransactionsToVerify, setRawTransactionsToVerify] = useState<(RawTransaction & { categoryId: string; tempId: string; isIgnored?: boolean; })[]>([]);
  const [importedTxIds, setImportedTxIds] = useState<Set<string>>(new Set());

  // System Readiness Check
  // We allow the UI if we have transactionTypes and categories (which are seeded). 
  // If accounts are missing, we show the "Quick Start" flow.
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

  const handleQuickStart = async () => {
      setIsInitializing(true);
      try {
          // 1. Force a system repair to fix types/categories
          await api.repairSystem();
          
          // 2. Create default account
          const mainAccount: Account = {
              id: 'acc_primary',
              name: 'Main Ledger',
              identifier: '0000',
              accountTypeId: accountTypes[0]?.id || 'at_checking'
          };
          onAddAccount(mainAccount);
          
          // Force a reload of the window to pick up all seeded data correctly
          setTimeout(() => window.location.reload(), 500);
      } catch (err) {
          setError("Quick Start failed. Please try manual configuration in 'Organize Data'.");
      } finally {
          setIsInitializing(false);
      }
  };

  const applyRulesAndSetStaging = useCallback((rawTransactions: RawTransaction[], userId: string, currentRules: ReconciliationRule[]) => {
    try {
        console.log(`[IMPORT] Normalizing ${rawTransactions.length} items with ${currentRules.length} rules...`);
        if (!rawTransactions || rawTransactions.length === 0) {
            setError("No transactions were found in the provided data. Please check the file format or try AI mode.");
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
            return { ...tx, categoryId: finalCategoryId, tempId: generateUUID() };
        });
        
        console.log("[IMPORT] Staging complete. Ready for verification.");
        setRawTransactionsToVerify(processedTransactions);
    } catch (e: any) {
        console.error("[IMPORT] Transformation error:", e);
        setError(`Transformation error: ${e.message || 'Internal logic error'}`);
        setAppState('error');
    }
  }, [categories, accounts]);

  const handleFileUpload = useCallback(async (files: File[], accountId: string, aiMode: boolean) => {
    setError(null);
    setAppState('processing');
    setProgressMessage(aiMode ? 'AI Thinking (Analyzing Statements)...' : 'Parsing local files...');
    try {
      console.log(`[IMPORT] Starting ${aiMode ? 'AI' : 'Local'} extraction for ${files.length} files...`);
      const raw = aiMode 
        ? await extractTransactionsFromFiles(files, accountId, transactionTypes, categories, setProgressMessage) 
        : await parseTransactionsFromFiles(files, accountId, transactionTypes, setProgressMessage);
      
      const safeRaw = (raw || []).filter(tx => tx && typeof tx === 'object');
      console.log(`[IMPORT] Parser returned ${safeRaw.length} valid results.`);
      
      if (safeRaw.length === 0) {
          throw new Error("The parser returned 0 results. If using local parsing, check if headers match. If using AI, ensure the file content is legible.");
      }

      const validUsers = Array.isArray(users) ? users.filter(Boolean) : [];
      const defaultUser = validUsers.length > 0 ? (validUsers.find(u => u.isDefault) || validUsers[0]) : null;
      applyRulesAndSetStaging(safeRaw, defaultUser?.id || 'user_primary', rules);
      setAppState('verifying_import');
    } catch (err: any) {
      console.error("[IMPORT] Critical extraction failure:", err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred during extraction.');
      setAppState('error');
    }
  }, [transactionTypes, categories, users, rules, applyRulesAndSetStaging]);

  const handleVerificationComplete = async (verified: (RawTransaction & { categoryId: string; })[]) => {
      console.log(`[IMPORT] User confirmed ${verified.length} transactions for merge...`);
      const { added } = mergeTransactions(recentGlobalTransactions.filter(Boolean), verified.filter(Boolean));
      console.log(`[IMPORT] Merge results: ${added.length} new records created.`);
      onTransactionsAdded(added, []);
      setImportedTxIds(new Set(added.map(tx => tx.id)));
      setAppState('post_import_edit');
  };

  const isImportFormVisible = appState === 'idle' || appState === 'processing' || appState === 'error';

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center flex-shrink-0 px-1">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Ledger Ingestion</h1>
            <p className="text-sm text-slate-500">Bring your records into the local system.</p>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-hidden">
        {/* Quick Start Flow if Account is missing */}
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
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">or manually configure in <span className="text-indigo-600 underline">identity hub</span></p>
                 </div>
             </div>
        ) : !hasCoreConfiguration && appState === 'idle' ? (
            <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 animate-pulse">
                <div className="p-4 bg-red-600 rounded-full text-white shadow-lg"><ExclamationTriangleIcon className="w-8 h-8" /></div>
                <div>
                    <h3 className="text-xl font-black text-red-800">Engine Logic Failure</h3>
                    <p className="text-sm text-red-700 mt-1 max-w-lg leading-relaxed">
                        The internal transaction types or categories are corrupted or missing from the database. 
                        Please try the <strong>System Repair</strong> tool in Settings.
                    </p>
                </div>
            </div>
        ) : (
            <>
            {isImportFormVisible && (
                <div className="w-full flex flex-col shrink-0 animate-fade-in">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
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
                                                    try {
                                                        console.log("[IMPORT] Starting text-based ingestion...");
                                                        const raw = useAi 
                                                            ? await extractTransactionsFromText(textInput, pasteAccountId, transactionTypes, categories, setProgressMessage) 
                                                            : await parseTransactionsFromText(textInput, pasteAccountId, transactionTypes, setProgressMessage);
                                                        
                                                        const safeRaw = (raw || []).filter(tx => tx && typeof tx === 'object');
                                                        const validUsers = Array.isArray(users) ? users.filter(Boolean) : [];
                                                        const defaultUser = validUsers.length > 0 ? (validUsers.find(u => u.isDefault) || validUsers[0]) : null;
                                                        applyRulesAndSetStaging(safeRaw, defaultUser?.id || 'user_primary', rules);
                                                        setAppState('verifying_import');
                                                    } catch(e: any) { 
                                                        console.error("[IMPORT] Text parse failure:", e);
                                                        setAppState('error'); 
                                                        setError(`Parsing failed: ${e.message || 'Unknown error'}. Ensure columns align.`); 
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
                                <p className="text-xs text-slate-400 mt-2">Gemini is synthesizing patterns and categorizing based on your preferences...</p>
                            </div>
                        ) : (
                            <ResultsDisplay appState={appState as any} error={error} progressMessage={progressMessage} transactions={[]} duplicatesIgnored={0} duplicatesImported={0} onClear={() => setAppState('idle')} />
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {appState === 'verifying_import' ? (
                    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
                        <ImportVerification rules={rules} onSaveRule={onSaveRule} initialTransactions={rawTransactionsToVerify} onComplete={handleVerificationComplete} onCancel={() => setAppState('idle')} accounts={accounts} categories={categories} transactionTypes={transactionTypes} counterparties={counterparties} locations={locations} users={users} tags={tags} existingTransactions={recentGlobalTransactions} onSaveCategory={onSaveCategory} onSaveCounterparty={onSaveCounterparty} onSaveTag={onSaveTag} onAddTransactionType={onAddTransactionType} />
                    </div>
                ) : appState === 'post_import_edit' ? (
                    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in min-h-0 h-full">
                        <div className="flex justify-between items-center mb-6 bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><SparklesIcon className="w-6 h-6 text-indigo-600" /> Final Polish</h2>
                                <p className="text-sm text-slate-500">Review {importedTxIds.size} ingested transactions.</p>
                            </div>
                            <button onClick={() => setAppState('idle')} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Finish</button>
                        </div>
                        <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl relative shadow-inner">
                            <TransactionTable transactions={recentGlobalTransactions.filter(tx => tx && importedTxIds.has(tx.id))} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users} onUpdateTransaction={onUpdateTransaction} onDeleteTransaction={onDeleteTransaction} />
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
