
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Transaction, Account, RawTransaction, TransactionType, ReconciliationRule, Payee, Category, DuplicatePair, User, BusinessDocument } from '../types';
import { extractTransactionsFromFiles, extractTransactionsFromText, hasApiKey } from '../services/geminiService';
import { parseTransactionsFromFiles, parseTransactionsFromText } from '../services/csvParserService';
import { mergeTransactions } from '../services/transactionService';
import { applyRulesToTransactions } from '../services/ruleService';
import FileUpload from '../components/FileUpload';
import { ResultsDisplay } from '../components/ResultsDisplay';
import TransactionTable from '../components/TransactionTable';
import DuplicateReview from '../components/DuplicateReview';
import ImportVerification from '../components/ImportVerification';
import { ExclamationTriangleIcon, CalendarIcon } from '../components/Icons';
import { formatDate } from '../dateUtils';
import { generateUUID } from '../utils';
import { saveFile } from '../services/storageService';

type AppState = 'idle' | 'processing' | 'verifying_import' | 'reviewing_duplicates' | 'success' | 'error';
type ImportMethod = 'upload' | 'paste';

interface DashboardProps {
  onTransactionsAdded: (newTransactions: Transaction[], newCategories: Category[]) => void;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  transactionTypes: TransactionType[];
  rules: ReconciliationRule[];
  payees: Payee[];
  users: User[];
  onAddDocument: (doc: BusinessDocument) => void;
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
    // US Estimated Tax Deadlines: Apr 15, Jun 15, Sep 15, Jan 15 (next year)
    const deadlines = [
        { date: new Date(year, 3, 15), label: 'Q1 Est. Tax' }, // April 15
        { date: new Date(year, 5, 15), label: 'Q2 Est. Tax' }, // June 15
        { date: new Date(year, 8, 15), label: 'Q3 Est. Tax' }, // Sept 15
        { date: new Date(year + 1, 0, 15), label: 'Q4 Est. Tax' }, // Jan 15
    ];

    // Find the first deadline that is in the future
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = deadlines.find(d => d.date >= today) || deadlines[0]; 

    const diffTime = Math.abs(next.date.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    return {
        label: next.label,
        // Using dateUtils-like manual formatting for consistency with short display requirement
        dateStr: next.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        daysLeft: diffDays
    };
};

const Dashboard: React.FC<DashboardProps> = ({ onTransactionsAdded, transactions, accounts, categories, transactionTypes, rules, payees, users, onAddDocument }) => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  
  const apiKeyAvailable = hasApiKey();
  const [useAi, setUseAi] = useState(apiKeyAvailable);
  
  useEffect(() => {
      if (apiKeyAvailable) {
          setUseAi(true);
      }
  }, [apiKeyAvailable]);
  
  const [importMethod, setImportMethod] = useState<ImportMethod>('upload');
  const [textInput, setTextInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Set default user on initial load
  useEffect(() => {
    const defaultUser = users.find(u => u.isDefault) || users[0];
    if (defaultUser) {
        setSelectedUserId(defaultUser.id);
    }
  }, [users]);

  // State for the import and review flow
  const [rawTransactionsToVerify, setRawTransactionsToVerify] = useState<(RawTransaction & { categoryId: string; tempId: string; })[]>([]);
  const [stagedForImport, setStagedForImport] = useState<Transaction[]>([]);
  const [duplicatesToReview, setDuplicatesToReview] = useState<DuplicatePair[]>([]);
  const [stagedNewCategories, setStagedNewCategories] = useState<Category[]>([]);

  // State for the final results display
  const [finalizedTransactions, setFinalizedTransactions] = useState<Transaction[]>([]);
  const [duplicatesIgnored, setDuplicatesIgnored] = useState(0);
  const [duplicatesImported, setDuplicatesImported] = useState(0);

  const handleProgress = (msg: string) => {
    setProgressMessage(msg);
  };

  const prepareForVerification = useCallback(async (rawTransactions: RawTransaction[], userId: string) => {
    handleProgress('Applying automation rules...');
    const rawWithUser = rawTransactions.map(tx => ({ ...tx, userId }));
    const transactionsWithRules = applyRulesToTransactions(rawWithUser, rules);

    const existingCategoryNames = new Set(categories.map(c => c.name.toLowerCase()));
    const newCategories: Category[] = [];
    transactionsWithRules.forEach(tx => {
        if (tx.category && !existingCategoryNames.has(tx.category.toLowerCase())) {
            const newCategory: Category = {
                id: `new-${tx.category.toLowerCase().replace(/\s+/g, '-')}-${generateUUID().slice(0,4)}`,
                name: tx.category
            };
            newCategories.push(newCategory);
            existingCategoryNames.add(tx.category.toLowerCase());
        }
    });

    const categoryNameToIdMap = new Map([...categories, ...newCategories].map(c => [c.name.toLowerCase(), c.id]));
    const defaultCategoryId = categories.find(c => c.name === 'Other')?.id || categories[0]?.id || '';

    const transactionsWithCategoryIds = transactionsWithRules.map(tx => ({
        ...tx,
        categoryId: tx.categoryId || categoryNameToIdMap.get(tx.category.toLowerCase()) || defaultCategoryId,
        tempId: generateUUID(), 
    }));

    setStagedNewCategories(newCategories);
    setRawTransactionsToVerify(transactionsWithCategoryIds);
    setAppState('verifying_import');

  }, [rules, categories]);

  const handleFileUpload = useCallback(async (files: File[], accountId: string) => {
    setAppState('processing');
    setError(null);
    try {
      // Save files to Document Vault first
      for (const file of files) {
          const now = new Date();
          const timestampPrefix = now.toISOString().replace(/[:.]/g, '-');
          const newFileName = `${timestampPrefix}_${file.name}`;
          const docId = generateUUID();
          
          // Clone file with new name for storage
          const fileToSave = new File([file], newFileName, { type: file.type });
          
          await saveFile(docId, fileToSave);
          
          const newDoc: BusinessDocument = {
              id: docId,
              name: fileToSave.name,
              uploadDate: now.toISOString().split('T')[0],
              size: fileToSave.size,
              mimeType: fileToSave.type,
          };
          onAddDocument(newDoc);
      }

      const rawTransactions = useAi 
        ? await extractTransactionsFromFiles(files, accountId, transactionTypes, handleProgress) 
        : await parseTransactionsFromFiles(files, accountId, transactionTypes, handleProgress);
      await prepareForVerification(rawTransactions, selectedUserId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState('error');
    }
  }, [useAi, transactionTypes, prepareForVerification, selectedUserId, onAddDocument]);

  const handleTextPaste = useCallback(async () => {
    if (!textInput.trim() || accounts.length === 0) return;
    setAppState('processing');
    setError(null);
    try {
      const accountId = accounts[0].id; 
      const rawTransactions = useAi
        ? await extractTransactionsFromText(textInput, accountId, transactionTypes, handleProgress)
        : await parseTransactionsFromText(textInput, accountId, transactionTypes, handleProgress);
      await prepareForVerification(rawTransactions, selectedUserId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState('error');
    }
  }, [textInput, useAi, accounts, transactionTypes, prepareForVerification, selectedUserId]);
  
  const handleVerificationComplete = (verifiedTransactions: (RawTransaction & { categoryId: string; })[]) => {
      handleProgress('Checking for duplicates...');
      const { added, duplicates } = mergeTransactions(transactions, verifiedTransactions);

      if (duplicates.length > 0) {
          setStagedForImport(added);
          setDuplicatesToReview(duplicates);
          setAppState('reviewing_duplicates');
      } else {
          onTransactionsAdded(added, stagedNewCategories);
          setFinalizedTransactions(added);
          setDuplicatesIgnored(0);
          setDuplicatesImported(0);
          setAppState('success');
      }
  };

  const handleReviewComplete = (duplicatesToImport: Transaction[]) => {
    const finalTransactions = [...stagedForImport, ...duplicatesToImport];
    onTransactionsAdded(finalTransactions, stagedNewCategories);
    setFinalizedTransactions(finalTransactions);
    setDuplicatesImported(duplicatesToImport.length);
    setDuplicatesIgnored(duplicatesToReview.length - duplicatesToImport.length);
    setAppState('success');
    setStagedForImport([]);
    setDuplicatesToReview([]);
    setStagedNewCategories([]);
  };

  const handleClear = () => {
    setAppState('idle');
    setError(null);
    setProgressMessage('');
    setTextInput('');
    setRawTransactionsToVerify([]);
    setStagedForImport([]);
    setDuplicatesToReview([]);
    setStagedNewCategories([]);
    setFinalizedTransactions([]);
    setDuplicatesIgnored(0);
    setDuplicatesImported(0);
  };
  
  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [transactions]);
  
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  const totalIncome = useMemo(() => transactions.filter(t => transactionTypeMap.get(t.typeId)?.balanceEffect === 'income').reduce((sum, t) => sum + t.amount, 0), [transactions, transactionTypeMap]);
  const totalExpenses = useMemo(() => transactions.filter(t => transactionTypeMap.get(t.typeId)?.balanceEffect === 'expense').reduce((sum, t) => sum + t.amount, 0), [transactions, transactionTypeMap]);

  const nextDeadline = useMemo(() => getNextTaxDeadline(), []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">An overview of your financial activity.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryWidget title="Total Income" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalIncome)} helpText="All time" />
        <SummaryWidget title="Total Expenses" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalExpenses)} helpText="All time" />
        <SummaryWidget title="Net Flow" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalIncome - totalExpenses)} helpText="Income minus expenses" />
        <SummaryWidget 
            title={nextDeadline.label} 
            value={`${nextDeadline.daysLeft} Days`} 
            helpText={`Due by ${nextDeadline.dateStr}`} 
            icon={<CalendarIcon className="w-6 h-6 text-indigo-600"/>}
            className="border-indigo-200 bg-indigo-50"
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-700 mb-4">Import Transactions</h2>
        
        {appState === 'idle' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setImportMethod('upload')} className={`px-4 py-2 rounded-lg font-semibold ${importMethod === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Upload Files</button>
                    <button onClick={() => setImportMethod('paste')} className={`px-4 py-2 rounded-lg font-semibold ${importMethod === 'paste' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Paste Text</button>
                </div>
                 <div className="flex items-center space-x-2" title={!apiKeyAvailable ? "API Key missing" : "Toggle AI Processing"}>
                    <span className={`text-sm font-medium ${!useAi ? 'text-indigo-600' : 'text-slate-500'}`}>Fast</span>
                    <label htmlFor="ai-toggle" className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="ai-toggle" className="sr-only peer" checked={useAi} onChange={() => setUseAi(!useAi)} disabled={!apiKeyAvailable} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                    <span className={`text-sm font-medium ${useAi ? 'text-indigo-600' : 'text-slate-500'}`}>AI-Powered</span>
                </div>
            </div>

            {importMethod === 'upload' ? (
                <FileUpload onFileUpload={handleFileUpload} disabled={false} accounts={accounts} useAi={useAi} />
            ) : (
                <div className="space-y-4">
                     {accounts.length > 0 && (
                        <select
                            value={accounts[0].id}
                            disabled
                            className="w-full p-2 border rounded-md bg-slate-100"
                        >
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                     )}
                    <textarea
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        placeholder="Paste transaction text here..."
                        className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                    />
                    <button
                        onClick={handleTextPaste}
                        disabled={!textInput.trim() || accounts.length === 0}
                        className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
                    >
                        Process Text
                    </button>
                </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-100">
                 <label className="block text-sm font-medium text-slate-700 mb-2">Assign to User (Optional)</label>
                 <div className="flex gap-4">
                    {users.map(u => (
                        <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="importUser" 
                                value={u.id} 
                                checked={selectedUserId === u.id} 
                                onChange={() => setSelectedUserId(u.id)}
                                className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700">{u.name}</span>
                        </label>
                    ))}
                 </div>
            </div>

          </div>
        ) : appState === 'processing' ? (
            <div className="py-12">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="text-slate-600">
                    <p className="font-semibold text-lg">Processing...</p>
                    <p className="text-sm">{progressMessage}</p>
                  </div>
                </div>
            </div>
        ) : appState === 'verifying_import' ? (
            <ImportVerification 
                initialTransactions={rawTransactionsToVerify} 
                onComplete={handleVerificationComplete} 
                onCancel={handleClear}
                accounts={accounts}
                categories={categories.concat(stagedNewCategories)}
                transactionTypes={transactionTypes}
                payees={payees}
                users={users}
            />
        ) : appState === 'reviewing_duplicates' ? (
            <DuplicateReview 
                duplicates={duplicatesToReview} 
                onComplete={handleReviewComplete} 
                onCancel={handleClear}
                accounts={accounts}
            />
        ) : (
            <ResultsDisplay 
                appState={appState} 
                error={error} 
                progressMessage={progressMessage} 
                transactions={finalizedTransactions} 
                duplicatesIgnored={duplicatesIgnored} 
                duplicatesImported={duplicatesImported} 
                onClear={handleClear} 
            />
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-700 mb-4">Recent Transactions</h2>
        <TransactionTable 
            transactions={recentTransactions} 
            accounts={accounts} 
            categories={categories} 
            transactionTypes={transactionTypes} 
            payees={payees}
            users={users}
            onUpdateTransaction={() => {}} 
            onDeleteTransaction={() => {}}
            visibleColumns={new Set(['date', 'description', 'amount', 'category', 'type'])}
        />
      </div>
    </div>
  );
};

export default Dashboard;
