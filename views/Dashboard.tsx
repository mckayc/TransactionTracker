
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
import DuplicateReview from '../components/DuplicateReview';
import RuleModal from '../components/RuleModal';
import { ExclamationTriangleIcon, CalendarIcon, AddIcon, CloseIcon, CreditCardIcon, SparklesIcon, CheckCircleIcon, TableIcon, InfoIcon } from '../components/Icons';
import { formatDate } from '../dateUtils';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { saveFile } from '../services/storageService';

type AppState = 'idle' | 'processing' | 'verifying_import' | 'reviewing_duplicates' | 'post_import_edit' | 'success' | 'error';
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

const getNextTaxDeadline = () => {
    const now = new Date();
    const year = now.getFullYear();
    const deadlines = [
        { date: new Date(year, 3, 15), label: 'Q1 Est. Tax' }, 
        { date: new Date(year, 5, 15), label: 'Q2 Est. Tax' }, 
        { date: new Date(year, 8, 15), label: 'Q3 Est. Tax' }, 
        { date: new Date(year + 1, 0, 15), label: 'Q4 Est. Tax' }, 
    ];

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = deadlines.find(d => d.date >= today) || deadlines[0]; 

    const diffTime = Math.abs(next.date.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    return {
        label: next.label,
        dateStr: next.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        daysLeft: diffDays
    };
};

const Dashboard: React.FC<DashboardProps> = ({ onTransactionsAdded, transactions: recentGlobalTransactions, accounts, onAddAccount, onAddAccountType, accountTypes, categories, tags, transactionTypes, rules, payees, users, onAddDocument, documentFolders, onCreateFolder, onSaveRule, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, onUpdateTransaction, onDeleteTransaction }) => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [dashboardRange, setDashboardRange] = useState<'all' | 'year' | 'month' | 'week'>('year');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [txForRule, setTxForRule] = useState<Transaction | null>(null);
  
  const [summaryTotals, setSummaryTotals] = useState<Record<string, number>>({});
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  
  const apiKeyAvailable = hasApiKey();
  const [useAi, setUseAi] = useState(false); 
  
  const [importMethod, setImportMethod] = useState<ImportMethod>('upload');
  const [textInput, setTextInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pasteAccountId, setPasteAccountId] = useState<string>('');

  useEffect(() => {
    const fetchSummary = async () => {
        setIsLoadingSummary(true);
        const now = new Date();
        let startDate = '';
        if (dashboardRange === 'year') startDate = `${now.getFullYear()}-01-01`;
        if (dashboardRange === 'month') startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        
        try {
            const result = await api.getSummary({ startDate });
            setSummaryTotals(result);
        } finally {
            setIsLoadingSummary(false);
        }
    };
    fetchSummary();
  }, [dashboardRange]);

  useEffect(() => {
    const defaultUser = users.find(u => u.isDefault) || users[0];
    if (defaultUser && !selectedUserId) setSelectedUserId(defaultUser.id);
    if (accounts.length > 0 && !pasteAccountId) setPasteAccountId(accounts[0].id);
  }, [users, accounts, selectedUserId, pasteAccountId]);

  const [rawTransactionsToVerify, setRawTransactionsToVerify] = useState<(RawTransaction & { categoryId: string; tempId: string; isIgnored?: boolean; })[]>([]);
  const [stagedForImport, setStagedForImport] = useState<Transaction[]>([]);
  const [duplicatesToReview, setDuplicatesToReview] = useState<DuplicatePair[]>([]);
  const [stagedNewCategories, setStagedNewCategories] = useState<Category[]>([]);
  const [stagedNewPayees, setStagedNewPayees] = useState<Payee[]>([]);
  const [finalizedTransactions, setFinalizedTransactions] = useState<Transaction[]>([]);
  const [importedTxIds, setImportedTxIds] = useState<Set<string>>(new Set());
  const [duplicatesIgnored, setDuplicatesIgnored] = useState(0);
  const [duplicatesImported, setDuplicatesImported] = useState(0);

  const handleProgress = (msg: string) => setProgressMessage(msg);

  const applyRulesAndSetStaging = useCallback((rawTransactions: RawTransaction[], userId: string, currentRules: ReconciliationRule[]) => {
    const rawWithUser = rawTransactions.map(tx => ({ ...tx, userId }));
    const transactionsWithRules = applyRulesToTransactions(rawWithUser, currentRules, accounts);

    const existingCategoryNames = new Set(categories.map(c => c.name.toLowerCase()));
    const newCategories: Category[] = [];
    const existingPayeeNames = new Set(payees.map(p => p.name.toLowerCase()));
    const newPayees: Payee[] = [];

    const incomeCategoryId = categories.find(c => c.name.toLowerCase() === 'income')?.id || '';
    const otherCategoryId = categories.find(c => c.name.toLowerCase() === 'other')?.id || categories[0]?.id || '';

    const processedTransactions = transactionsWithRules.map(tx => {
        let matchedPayeeId = tx.payeeId;
        if (tx.category && tx.category !== 'Uncategorized' && !existingCategoryNames.has(tx.category.toLowerCase())) {
            const newCategory: Category = { id: generateUUID(), name: tx.category };
            newCategories.push(newCategory);
            existingCategoryNames.add(tx.category.toLowerCase());
        }
        let finalCategoryId = tx.categoryId;
        if (!finalCategoryId) {
             const categoryNameToIdMap = new Map([...categories, ...newCategories].map(c => [c.name.toLowerCase(), c.id]));
             finalCategoryId = categoryNameToIdMap.get((tx.category || '').toLowerCase()) || otherCategoryId;
        }
        return { ...tx, payeeId: matchedPayeeId, categoryId: finalCategoryId, tempId: generateUUID() };
    });

    setStagedNewCategories(newCategories);
    setStagedNewPayees(newPayees);
    setRawTransactionsToVerify(processedTransactions);
  }, [categories, payees, accounts]);

  const handleFileUpload = useCallback(async (files: File[], accountId: string) => {
    if (!transactionTypes || transactionTypes.length === 0) {
        setError("Transaction types are not loaded. Please wait a moment or refresh.");
        setAppState('error');
        return;
    }
    
    setAppState('processing');
    setError(null);
    try {
      const rawTransactions = useAi ? await extractTransactionsFromFiles(files, accountId, transactionTypes, handleProgress) : await parseTransactionsFromFiles(files, accountId, transactionTypes, handleProgress);
      applyRulesAndSetStaging(rawTransactions, selectedUserId, rules);
      setAppState('verifying_import');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState('error');
    }
  }, [useAi, transactionTypes, selectedUserId, rules, applyRulesAndSetStaging]);

  const handleVerificationComplete = async (verifiedTransactions: (RawTransaction & { categoryId: string; })[]) => {
      handleProgress('Finalizing staged data...');
      stagedNewCategories.forEach(cat => onSaveCategory(cat));
      stagedNewPayees.forEach(p => onSavePayee(p));

      const { added, duplicates } = mergeTransactions(recentGlobalTransactions, verifiedTransactions);
      if (duplicates.length > 0) {
          setStagedForImport(added);
          setDuplicatesToReview(duplicates);
          setAppState('reviewing_duplicates');
      } else {
          onTransactionsAdded(added, []);
          setFinalizedTransactions(added);
          setImportedTxIds(new Set(added.map(tx => tx.id)));
          setAppState('post_import_edit');
      }
  };

  const handleClear = () => {
    setAppState('idle');
    setError(null);
    setRawTransactionsToVerify([]);
    setStagedForImport([]);
    setDuplicatesToReview([]);
  };
  
  const nextDeadline = useMemo(() => getNextTaxDeadline(), []);
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <div className="space-y-8 h-full flex flex-col min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-slate-500 mt-1">Real-time server-side insights.</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200 overflow-x-auto">
            {(['all', 'year', 'month'] as const).map(range => (
                <button key={range} onClick={() => setDashboardRange(range)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${dashboardRange === range ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                    {range === 'all' ? 'All Time' : range === 'year' ? 'This Year' : 'This Month'}
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
        <SummaryWidget title={nextDeadline.label} value={`${nextDeadline.daysLeft}d`} helpText={`Due ${nextDeadline.dateStr}`} icon={<CalendarIcon className="w-5 h-5 text-indigo-600"/>} className="border-indigo-200 bg-indigo-50" />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {appState === 'idle' ? (
          <div className="flex flex-col h-full">
            <h2 className="text-xl font-bold text-slate-700 mb-4">Quick Entry</h2>
            <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setImportMethod('upload')} className={`px-4 py-2 rounded-lg font-semibold ${importMethod === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Upload Files</button>
                        <button onClick={() => setImportMethod('paste')} className={`px-4 py-2 rounded-lg font-semibold ${importMethod === 'paste' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Paste Text</button>
                    </div>
                </div>
                {importMethod === 'upload' ? (
                    <FileUpload onFileUpload={handleFileUpload} disabled={false} accounts={accounts} useAi={useAi} onAddAccountRequested={() => setIsAccountModalOpen(true)} />
                ) : (
                    <div className="space-y-4">
                        <select value={pasteAccountId} onChange={(e) => setPasteAccountId(e.target.value)} className="w-full">
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                        <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Paste CSV rows here..." className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
                        <button onClick={async () => {
                             if (!transactionTypes || transactionTypes.length === 0) return;
                             setAppState('processing');
                             try {
                                 const raw = await parseTransactionsFromText(textInput, pasteAccountId, transactionTypes, handleProgress);
                                 applyRulesAndSetStaging(raw, selectedUserId, rules);
                                 setAppState('verifying_import');
                             } catch(e) { setAppState('error'); }
                        }} disabled={!textInput.trim() || accounts.length === 0} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">Process Text</button>
                    </div>
                )}
            </div>

            <div className="mt-12 pt-8 border-t border-slate-200 overflow-hidden flex flex-col flex-1">
                <h2 className="text-xl font-bold text-slate-700 mb-4">Recent Activity</h2>
                <div className="flex-1 overflow-hidden relative">
                    <TransactionTable transactions={recentGlobalTransactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={() => {}} onDeleteTransaction={() => {}} visibleColumns={new Set(['date', 'description', 'amount', 'category'])} />
                </div>
            </div>
          </div>
        ) : appState === 'processing' ? (
            <div className="py-12 flex-1 flex flex-col items-center justify-center space-y-4 text-center">
                <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <div className="text-slate-600"><p className="font-bold text-xl">Thinking...</p><p className="text-sm text-slate-400 mt-1">{progressMessage}</p></div>
            </div>
        ) : appState === 'verifying_import' ? (
            <ImportVerification initialTransactions={rawTransactionsToVerify} onComplete={handleVerificationComplete} onCancel={handleClear} accounts={accounts} categories={categories} transactionTypes={transactionTypes} payees={payees} users={users} existingTransactions={recentGlobalTransactions} />
        ) : appState === 'post_import_edit' ? (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in h-full">
                <div className="flex justify-between items-center mb-6 bg-slate-50 p-5 rounded-2xl border border-indigo-100 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><SparklesIcon className="w-6 h-6 text-indigo-600" /> Review Data</h2>
                        <p className="text-sm text-slate-500 mt-1">Imported {importedTxIds.size} transactions.</p>
                    </div>
                    <button onClick={handleClear} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg">Done</button>
                </div>
                <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl shadow-sm relative">
                    <TransactionTable transactions={recentGlobalTransactions.filter(tx => importedTxIds.has(tx.id))} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={onUpdateTransaction} onDeleteTransaction={onDeleteTransaction} visibleColumns={new Set(['date', 'description', 'payee', 'category', 'amount'])} />
                </div>
            </div>
        ) : (
            <ResultsDisplay appState={appState as any} error={error} progressMessage={progressMessage} transactions={finalizedTransactions} duplicatesIgnored={duplicatesIgnored} duplicatesImported={duplicatesImported} onClear={handleClear} />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
