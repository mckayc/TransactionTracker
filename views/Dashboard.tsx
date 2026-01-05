import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Transaction, Account, RawTransaction, TransactionType, ReconciliationRule, Payee, Category, DuplicatePair, User, BusinessDocument, DocumentFolder, Tag, AccountType } from '../types';
import { extractTransactionsFromFiles, extractTransactionsFromText, hasApiKey } from '../services/geminiService';
import { parseTransactionsFromFiles, parseTransactionsFromText } from '../services/csvParserService';
import { mergeTransactions } from '../services/transactionService';
import { applyRulesToTransactions } from '../services/ruleService';
import FileUpload from '../components/FileUpload';
import { ResultsDisplay } from '../components/ResultsDisplay';
import TransactionTable from '../components/TransactionTable';
import ImportVerification from '../components/ImportVerification';
import { CalendarIcon, SparklesIcon, RobotIcon, TableIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';

type AppState = 'idle' | 'processing' | 'verifying_import' | 'post_import_edit' | 'success' | 'error';
type ImportMethod = 'upload' | 'paste';

interface DashboardProps {
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
  payees: Payee[];
  users: User[];
  onAddDocument: (doc: BusinessDocument) => void;
  documentFolders: DocumentFolder[];
  onCreateFolder: (folder: DocumentFolder) => void;
  onSaveRule: (rule: ReconciliationRule) => void;
  onSaveCategory: (category: Category) => void;
  onSavePayee: (payee: Payee) => void;
  onSaveTag: (tag: Tag) => void;
  onAddTransactionType: (type: TransactionType) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
}

const SummaryWidget: React.FC<{title: string, value: string, helpText: string, icon?: React.ReactNode, className?: string}> = ({title, value, helpText, icon, className}) => (
    <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 ${className}`}>
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-sm font-medium text-slate-500">{title}</h3>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
            </div>
            {icon && <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>}
        </div>
        <p className="text-xs text-slate-400 mt-1">{helpText}</p>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ 
    onTransactionsAdded, transactions: recentGlobalTransactions, accounts, categories, tags, rules, payees, users, transactionTypes, onSaveCategory, onSavePayee, onUpdateTransaction, onDeleteTransaction 
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

  const [rawTransactionsToVerify, setRawTransactionsToVerify] = useState<(RawTransaction & { categoryId: string; tempId: string; isIgnored?: boolean; })[]>([]);
  const [importedTxIds, setImportedTxIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSummary = async () => {
        const now = new Date();
        let startDate = '';
        if (dashboardRange === 'year') startDate = `${now.getFullYear()}-01-01`;
        if (dashboardRange === 'month') startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        try {
            const result = await api.getSummary({ startDate });
            setSummaryTotals(result);
        } catch (e) {}
    };
    fetchSummary();
  }, [dashboardRange, recentGlobalTransactions]);

  const applyRulesAndSetStaging = useCallback((rawTransactions: RawTransaction[], userId: string, currentRules: ReconciliationRule[]) => {
    if (!rawTransactions || rawTransactions.length === 0) {
        setError("No transactions were found in the provided data. Please check the file format or try AI mode.");
        setAppState('error');
        return;
    }

    const rawWithUser = rawTransactions.map(tx => ({ ...tx, userId }));
    const transactionsWithRules = applyRulesToTransactions(rawWithUser, currentRules, accounts);
    const categoryNameToIdMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const otherCategoryId = categoryNameToIdMap.get('other') || categories[0]?.id || '';

    const processedTransactions = transactionsWithRules.map(tx => {
        let finalCategoryId = tx.categoryId;
        if (!finalCategoryId) {
            const aiCategoryName = (tx.category || '').toLowerCase();
            finalCategoryId = categoryNameToIdMap.get(aiCategoryName) || otherCategoryId;
        }
        return { ...tx, categoryId: finalCategoryId, tempId: generateUUID() };
    });
    setRawTransactionsToVerify(processedTransactions);
  }, [categories, accounts]);

  const handleFileUpload = useCallback(async (files: File[], accountId: string, aiMode: boolean) => {
    setError(null);
    setAppState('processing');
    setProgressMessage(aiMode ? 'AI Thinking (Analyzing Statements)...' : 'Parsing local files...');
    try {
      const raw = aiMode 
        ? await extractTransactionsFromFiles(files, accountId, transactionTypes, categories, setProgressMessage) 
        : await parseTransactionsFromFiles(files, accountId, transactionTypes, setProgressMessage);
      
      if (!raw || raw.length === 0) {
          throw new Error("The parser returned 0 results. If using local parsing, check if headers match. If using AI, ensure the file content is legible.");
      }

      applyRulesAndSetStaging(raw, users.find(u => u.isDefault)?.id || users[0]?.id || '', rules);
      setAppState('verifying_import');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred during extraction.');
      setAppState('error');
    }
  }, [transactionTypes, categories, users, rules, applyRulesAndSetStaging]);

  const handleVerificationComplete = async (verified: (RawTransaction & { categoryId: string; })[]) => {
      const { added } = mergeTransactions(recentGlobalTransactions, verified);
      onTransactionsAdded(added, []);
      setImportedTxIds(new Set(added.map(tx => tx.id)));
      setAppState('post_import_edit');
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  // Determine if the top import card should be visible
  const isImportFormVisible = appState === 'idle' || appState === 'processing' || appState === 'error';

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center flex-shrink-0 px-1">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Ledger Command</h1>
            <p className="text-sm text-slate-500">Intelligent ingestion and performance overview.</p>
        </div>
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            {(['all', 'year', 'month'] as const).map(range => (
                <button key={range} onClick={() => setDashboardRange(range)} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-widest ${dashboardRange === range ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {range}
                </button>
            ))}
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 flex-shrink-0">
        <SummaryWidget title="Income" value={formatCurrency(summaryTotals.income)} helpText={dashboardRange} className="border-emerald-100" />
        <SummaryWidget title="Expenses" value={formatCurrency(summaryTotals.expense)} helpText={dashboardRange} className="border-rose-100" />
        <SummaryWidget title="Taxes" value={formatCurrency(summaryTotals.tax)} helpText={dashboardRange} className="border-amber-100 bg-amber-50/30" />
        <SummaryWidget title="Debt" value={formatCurrency(summaryTotals.debt)} helpText={dashboardRange} className="border-slate-100 bg-slate-50" />
        <SummaryWidget title="Invest" value={formatCurrency(summaryTotals.investment)} helpText={dashboardRange} className="border-purple-100" />
        <SummaryWidget title="Donations" value={formatCurrency(summaryTotals.donation)} helpText={dashboardRange} className="border-blue-100" />
        <SummaryWidget title="Savings" value={formatCurrency(summaryTotals.savings)} helpText={dashboardRange} className="border-indigo-100" />
        <SummaryWidget title="Calendar" value="..." helpText="Next Deadline" icon={<CalendarIcon className="w-5 h-5 text-indigo-600"/>} className="border-indigo-200 bg-indigo-50" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-6">
        {/* Top: Quick Import Section (Full Width, only visible when not verifying) */}
        {isImportFormVisible && (
            <div className="w-full flex flex-col shrink-0 animate-fade-in">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    {appState === 'idle' ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">Quick Import</h2>
                                <div className="flex p-1 bg-slate-100 rounded-xl">
                                    <button onClick={() => setImportMethod('upload')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${importMethod === 'upload' ? 'bg-white shadow text-indigo-600' : 'text-slate-50'}`}>FILE</button>
                                    <button onClick={() => setImportMethod('paste')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${importMethod === 'paste' ? 'bg-white shadow text-indigo-600' : 'text-slate-50'}`}>TEXT</button>
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
                                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
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
                                                    const raw = useAi ? await extractTransactionsFromText(textInput, pasteAccountId, transactionTypes, categories, setProgressMessage) : await parseTransactionsFromText(textInput, pasteAccountId, transactionTypes, setProgressMessage);
                                                    applyRulesAndSetStaging(raw, users[0]?.id || 'default', rules);
                                                    setAppState('verifying_import');
                                                } catch(e) { setAppState('error'); setError("Parsing failed. Ensure columns align."); }
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

        {/* Bottom: Ledger Activity or Verification View (Full Width) */}
        <div className="flex-1 min-h-[400px] bg-white p-6 rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            {appState === 'verifying_import' ? (
                <div className="flex-1 min-h-[600px]">
                    <ImportVerification rules={rules} initialTransactions={rawTransactionsToVerify} onComplete={handleVerificationComplete} onCancel={() => setAppState('idle')} accounts={accounts} categories={categories} transactionTypes={transactionTypes} payees={payees} users={users} existingTransactions={recentGlobalTransactions} />
                </div>
            ) : appState === 'post_import_edit' ? (
                <div className="flex-1 flex flex-col overflow-hidden animate-fade-in min-h-[600px]">
                    <div className="flex justify-between items-center mb-6 bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><SparklesIcon className="w-6 h-6 text-indigo-600" /> Final Polish</h2>
                            <p className="text-sm text-slate-500">Review {importedTxIds.size} ingested transactions.</p>
                        </div>
                        <button onClick={() => setAppState('idle')} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Finish</button>
                    </div>
                    <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl relative shadow-inner">
                        <TransactionTable transactions={recentGlobalTransactions.filter(tx => importedTxIds.has(tx.id))} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={onUpdateTransaction} onDeleteTransaction={onDeleteTransaction} />
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-black text-slate-800">Recent Ledger Activity</h2>
                        <div className="flex gap-2">
                             <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500">
                                <TableIcon className="w-3 h-3" /> LIST VIEW
                             </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative border rounded-2xl shadow-inner bg-slate-50/30">
                        <TransactionTable transactions={recentGlobalTransactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={onUpdateTransaction} onDeleteTransaction={onDeleteTransaction} visibleColumns={new Set(['date', 'description', 'amount', 'category'])} />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;