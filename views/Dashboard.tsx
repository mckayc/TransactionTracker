
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
// Fix: Import missing DuplicateReview component
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

const QuickAccountModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (account: Account) => void;
    onAddType: (type: AccountType) => void;
    accountTypes: AccountType[];
}> = ({ isOpen, onClose, onSave, onAddType, accountTypes }) => {
    const [name, setName] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [accountTypeId, setAccountTypeId] = useState(accountTypes[0]?.id || '');
    const [isAddingType, setIsAddingType] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');

    useEffect(() => {
        if (isOpen && accountTypes.length > 0 && !accountTypeId) {
            setAccountTypeId(accountTypes[0].id);
        }
    }, [isOpen, accountTypes, accountTypeId]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && identifier.trim() && accountTypeId) {
            onSave({
                id: generateUUID(),
                name: name.trim(),
                identifier: identifier.trim(),
                accountTypeId
            });
            setName('');
            setIdentifier('');
            onClose();
        }
    };

    const handleCreateType = () => {
        if (newTypeName.trim()) {
            const newType = { id: generateUUID(), name: newTypeName.trim() };
            onAddType(newType);
            setAccountTypeId(newType.id);
            setNewTypeName('');
            setIsAddingType(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <CreditCardIcon className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-bold text-slate-800">Quick Add Account</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full" placeholder="e.g. Chase Checking" required autoFocus />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Identifier (Last 4 digits)</label>
                        <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} className="w-full font-mono" placeholder="1234" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Account Type</label>
                        {isAddingType ? (
                            <div className="flex gap-2">
                                <input type="text" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} className="flex-grow text-sm" placeholder="New Type Name" autoFocus />
                                <button type="button" onClick={handleCreateType} className="bg-indigo-600 text-white px-3 rounded-lg text-sm font-bold">Add</button>
                                <button type="button" onClick={() => setIsAddingType(false)} className="text-slate-400 p-1"><CloseIcon className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <select value={accountTypeId} onChange={e => setAccountTypeId(e.target.value)} className="flex-grow" required>
                                    {accountTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                </select>
                                <button type="button" onClick={() => setIsAddingType(true)} className="px-3 border rounded-lg hover:bg-slate-50 text-indigo-600 font-bold">+</button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md">Create Account</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onTransactionsAdded, transactions, accounts, onAddAccount, onAddAccountType, accountTypes, categories, tags, transactionTypes, rules, payees, users, onAddDocument, documentFolders, onCreateFolder, onSaveRule, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, onUpdateTransaction, onDeleteTransaction }) => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [dashboardRange, setDashboardRange] = useState<'all' | 'year' | 'month' | 'week'>('year');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [txForRule, setTxForRule] = useState<Transaction | null>(null);
  
  const apiKeyAvailable = hasApiKey();
  const [useAi, setUseAi] = useState(false); 
  
  const [importMethod, setImportMethod] = useState<ImportMethod>('upload');
  const [textInput, setTextInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pasteAccountId, setPasteAccountId] = useState<string>('');

  useEffect(() => {
    const defaultUser = users.find(u => u.isDefault) || users[0];
    if (defaultUser && !selectedUserId) setSelectedUserId(defaultUser.id);
    if (accounts.length > 0 && !pasteAccountId) setPasteAccountId(accounts[0].id);
  }, [users, accounts, selectedUserId, pasteAccountId]);

  const [rawExtractedTransactions, setRawExtractedTransactions] = useState<RawTransaction[]>([]);
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

  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);

  /**
   * Fuzzy matches a description to an existing payee based on keyword overlap.
   */
  const findSmartPayeeMatch = useCallback((description: string, existingPayees: Payee[]) => {
      const cleanDesc = description.toLowerCase().trim();
      if (!cleanDesc) return null;

      // 1. Direct exact match
      const exact = existingPayees.find(p => p.name.toLowerCase() === cleanDesc);
      if (exact) return exact;

      // 2. Contains match
      const contains = existingPayees.find(p => cleanDesc.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanDesc));
      if (contains) return contains;

      // 3. Keyword Overlap
      const descKeywords = cleanDesc.split(/[^a-z0-9]/).filter(w => w.length > 2);
      if (descKeywords.length === 0) return null;

      const candidates = existingPayees.map(p => {
          const payeeKeywords = p.name.toLowerCase().split(/[^a-z0-9]/).filter(w => w.length > 2);
          const overlap = descKeywords.filter(w => payeeKeywords.includes(w)).length;
          return { payee: p, overlap };
      }).filter(c => c.overlap > 0);

      candidates.sort((a, b) => b.overlap - a.overlap);
      
      // If at least one significant keyword matches, we'll suggest it
      if (candidates.length > 0 && candidates[0].overlap >= Math.max(1, descKeywords.length / 2)) {
          return candidates[0].payee;
      }

      return null;
  }, []);

  const applyRulesAndSetStaging = useCallback((rawTransactions: RawTransaction[], userId: string, currentRules: ReconciliationRule[]) => {
    const rawWithUser = rawTransactions.map(tx => ({ ...tx, userId }));
    const transactionsWithRules = applyRulesToTransactions(rawWithUser, currentRules, accounts);

    // Track new Categories
    const existingCategoryNames = new Set(categories.map(c => c.name.toLowerCase()));
    const newCategories: Category[] = [];
    
    // Track new Payees (Income Sources)
    const existingPayeeNames = new Set(payees.map(p => p.name.toLowerCase()));
    const newPayees: Payee[] = [];

    const incomeCategoryId = categories.find(c => c.name.toLowerCase() === 'income')?.id || '';
    const otherCategoryId = categories.find(c => c.name.toLowerCase() === 'other')?.id || categories[0]?.id || '';

    const processedTransactions = transactionsWithRules.map(tx => {
        const isIncome = transactionTypeMap.get(tx.typeId)?.balanceEffect === 'income';
        let matchedPayeeId = tx.payeeId;

        // 1. Detect new categories
        if (tx.category && tx.category !== 'Uncategorized' && !existingCategoryNames.has(tx.category.toLowerCase())) {
            const newCategory: Category = {
                id: `new-${tx.category.toLowerCase().replace(/\s+/g, '-')}-${generateUUID().slice(0,4)}`,
                name: tx.category
            };
            newCategories.push(newCategory);
            existingCategoryNames.add(tx.category.toLowerCase());
        }

        // 2. Payee Identification - ONLY if it's income
        if (isIncome && !matchedPayeeId) {
            const match = findSmartPayeeMatch(tx.description, [...payees, ...newPayees]);
            if (match) {
                matchedPayeeId = match.id;
            } else {
                const cleanName = tx.description.trim();
                if (cleanName) {
                    const newPayee: Payee = {
                        id: `new-p-${generateUUID().slice(0,8)}`,
                        name: cleanName
                    };
                    newPayees.push(newPayee);
                    existingPayeeNames.add(cleanName.toLowerCase());
                    matchedPayeeId = newPayee.id;
                }
            }
        } else if (!isIncome) {
            // For non-income, suppress Payee/Source assignment
            matchedPayeeId = undefined;
        }

        // 3. Category Intelligence
        // If income and no category was assigned by a rule, default to 'Income' category
        let finalCategoryId = tx.categoryId;
        if (!finalCategoryId) {
             const categoryNameToIdMap = new Map([...categories, ...newCategories].map(c => [c.name.toLowerCase(), c.id]));
             finalCategoryId = categoryNameToIdMap.get((tx.category || '').toLowerCase());
             
             if (!finalCategoryId) {
                 finalCategoryId = isIncome && incomeCategoryId ? incomeCategoryId : otherCategoryId;
             }
        }

        const desc = (tx.description || '').toLowerCase();
        const typeStr = (tx.category || '').toLowerCase();
        const isTransfer = desc.includes('transfer') || typeStr.includes('transfer');

        return {
            ...tx,
            payeeId: matchedPayeeId,
            categoryId: finalCategoryId,
            tempId: generateUUID(),
            isIgnored: isTransfer
        };
    });

    setStagedNewCategories(newCategories);
    setStagedNewPayees(newPayees);
    setRawTransactionsToVerify(processedTransactions);
  }, [categories, payees, accounts, findSmartPayeeMatch, transactionTypeMap]);

  const prepareForVerification = useCallback(async (rawTransactions: RawTransaction[], userId: string) => {
    handleProgress('Applying automation rules...');
    setRawExtractedTransactions(rawTransactions);
    applyRulesAndSetStaging(rawTransactions, userId, rules);
    setAppState('verifying_import');
  }, [rules, applyRulesAndSetStaging]);

  const handleFileUpload = useCallback(async (files: File[], accountId: string) => {
    setAppState('processing');
    setError(null);
    try {
      let importFolderId = documentFolders.find(f => f.name === "Imported Documents" && !f.parentId)?.id;
      if (!importFolderId) {
          importFolderId = generateUUID();
          const newFolder: DocumentFolder = { id: importFolderId, name: "Imported Documents", parentId: undefined, createdAt: new Date().toISOString() };
          onCreateFolder(newFolder);
      }
      for (const file of files) {
          const now = new Date();
          const timestampPrefix = now.toISOString().replace(/[:T]/g, '-').slice(0, 19);
          const newFileName = `${timestampPrefix}_${file.name}`;
          const docId = generateUUID();
          const fileToSave = new File([file], newFileName, { type: file.type });
          await saveFile(docId, fileToSave);
          const newDoc: BusinessDocument = { id: docId, name: fileToSave.name, uploadDate: now.toISOString().split('T')[0], size: fileToSave.size, mimeType: fileToSave.type, parentId: importFolderId };
          onAddDocument(newDoc);
      }
      const rawTransactions = useAi ? await extractTransactionsFromFiles(files, accountId, transactionTypes, handleProgress) : await parseTransactionsFromFiles(files, accountId, transactionTypes, handleProgress);
      await prepareForVerification(rawTransactions, selectedUserId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState('error');
    }
  }, [useAi, transactionTypes, prepareForVerification, selectedUserId, onAddDocument, documentFolders, onCreateFolder]);

  const handleTextPaste = useCallback(async () => {
    if (!textInput.trim() || !pasteAccountId) return;
    setAppState('processing');
    setError(null);
    try {
      const rawTransactions = useAi ? await extractTransactionsFromText(textInput, pasteAccountId, transactionTypes, handleProgress) : await parseTransactionsFromText(textInput, pasteAccountId, transactionTypes, handleProgress);
      await prepareForVerification(rawTransactions, selectedUserId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState('error');
    }
  }, [textInput, useAi, pasteAccountId, transactionTypes, prepareForVerification, selectedUserId]);
  
  const handleVerificationComplete = (verifiedTransactions: (RawTransaction & { categoryId: string; })[]) => {
      handleProgress('Finalizing staged data...');
      
      // Save staged new categories and payees first
      stagedNewCategories.forEach(cat => onSaveCategory(cat));
      stagedNewPayees.forEach(p => onSavePayee(p));

      const { added, duplicates } = mergeTransactions(transactions, verifiedTransactions);
      if (duplicates.length > 0) {
          setStagedForImport(added);
          setDuplicatesToReview(duplicates);
          setAppState('reviewing_duplicates');
      } else {
          onTransactionsAdded(added, []); // Staged categories already saved above
          setFinalizedTransactions(added);
          setImportedTxIds(new Set(added.map(tx => tx.id)));
          setDuplicatesIgnored(0);
          setDuplicatesImported(0);
          setAppState('post_import_edit');
      }
  };

  const handleReviewComplete = (duplicatesToImport: Transaction[]) => {
    const finalTransactions = [...stagedForImport, ...duplicatesToImport];
    onTransactionsAdded(finalTransactions, []);
    setFinalizedTransactions(finalTransactions);
    setImportedTxIds(new Set(finalTransactions.map(tx => tx.id)));
    setDuplicatesImported(duplicatesToImport.length);
    setDuplicatesIgnored(duplicatesToReview.length - duplicatesToImport.length);
    setAppState('post_import_edit');
    setStagedForImport([]);
    setDuplicatesToReview([]);
    setStagedNewCategories([]);
    setStagedNewPayees([]);
  };

  const handleClear = () => {
    setAppState('idle');
    setError(null);
    setProgressMessage('');
    setTextInput('');
    setRawExtractedTransactions([]);
    setRawTransactionsToVerify([]);
    setStagedForImport([]);
    setDuplicatesToReview([]);
    setStagedNewCategories([]);
    setStagedNewPayees([]);
    setFinalizedTransactions([]);
    setImportedTxIds(new Set());
    setDuplicatesIgnored(0);
    setDuplicatesImported(0);
  };
  
  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [transactions]);
  
  const dashboardTransactions = useMemo(() => {
    const now = new Date();
    const baseTxs = transactions.filter(t => !t.isParent);
    if (dashboardRange === 'all') return baseTxs;
    return baseTxs.filter(tx => {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0);
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth();
        if (dashboardRange === 'year') return txYear === now.getFullYear();
        if (dashboardRange === 'month') return txYear === now.getFullYear() && txMonth === now.getMonth();
        if (dashboardRange === 'week') {
             const today = new Date();
             today.setHours(0,0,0,0);
             const startOfWeek = new Date(today);
             startOfWeek.setDate(today.getDate() - today.getDay());
             const endOfWeek = new Date(startOfWeek);
             endOfWeek.setDate(startOfWeek.getDate() + 6);
             return txDate >= startOfWeek && txDate <= endOfWeek;
        }
        return true;
    });
  }, [transactions, dashboardRange]);

  const totals = useMemo(() => {
    const res = { income: 0, expenses: 0, investments: 0, donations: 0, taxes: 0, savings: 0, debt: 0 };
    dashboardTransactions.forEach(tx => {
        const type = transactionTypeMap.get(tx.typeId);
        if (!type) return;
        const effect = type.balanceEffect;
        if (effect === 'income') res.income += tx.amount;
        else if (effect === 'expense') res.expenses += tx.amount;
        else if (effect === 'investment') res.investments += tx.amount;
        else if (effect === 'donation') res.donations += tx.amount;
        else if (effect === 'tax') res.taxes += tx.amount;
        else if (effect === 'savings') res.savings += tx.amount;
        else if (effect === 'debt') res.debt += tx.amount;
    });
    return res;
  }, [dashboardTransactions, transactionTypeMap]);
  
  const nextDeadline = useMemo(() => getNextTaxDeadline(), []);

  const getRangeLabel = () => {
      switch(dashboardRange) {
          case 'year': return 'This Year';
          case 'month': return 'This Month';
          case 'week': return 'This Week';
          default: return 'All Time';
      }
  }

  const handleTriggerCreateRule = (rawTx: RawTransaction & { tempId: string }) => {
      const tx: Transaction = {
          ...rawTx,
          id: rawTx.tempId,
          categoryId: rawTx.categoryId || ''
      };
      setTxForRule(tx);
      setIsRuleModalOpen(true);
  };

  const handleSaveRuleFromImport = (rule: ReconciliationRule) => {
      onSaveRule(rule);
      setIsRuleModalOpen(false);
      const updatedRules = [...rules, rule];
      applyRulesAndSetStaging(rawExtractedTransactions, selectedUserId, updatedRules);
  };

  const justImportedTransactions = useMemo(() => {
    return transactions.filter(tx => importedTxIds.has(tx.id));
  }, [transactions, importedTxIds]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-8 h-full flex flex-col min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-slate-500 mt-1">An overview of your financial activity.</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200 overflow-x-auto">
            {(['all', 'year', 'month', 'week'] as const).map(range => (
                <button
                    key={range}
                    onClick={() => setDashboardRange(range)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                        dashboardRange === range 
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    {range === 'all' ? 'All Time' : range === 'year' ? 'This Year' : range === 'month' ? 'This Month' : 'This Week'}
                </button>
            ))}
        </div>
      </div>
      
      {appState === 'idle' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 flex-shrink-0">
            <SummaryWidget title="Income" value={formatCurrency(totals.income)} helpText={getRangeLabel()} className="border-emerald-100" />
            <SummaryWidget title="Expenses" value={formatCurrency(totals.expenses)} helpText={getRangeLabel()} className="border-rose-100" />
            <SummaryWidget title="Taxes" value={formatCurrency(totals.taxes)} helpText={getRangeLabel()} className="border-amber-100 bg-amber-50/30" />
            <SummaryWidget title="Debt" value={formatCurrency(totals.debt)} helpText={getRangeLabel()} className="border-slate-100 bg-slate-50" />
            <SummaryWidget title="Invest" value={formatCurrency(totals.investments)} helpText={getRangeLabel()} className="border-purple-100" />
            <SummaryWidget title="Donations" value={formatCurrency(totals.donations)} helpText={getRangeLabel()} className="border-blue-100" />
            <SummaryWidget title="Savings" value={formatCurrency(totals.savings)} helpText={getRangeLabel()} className="border-indigo-100" />
            <SummaryWidget title={nextDeadline.label} value={`${nextDeadline.daysLeft}d`} helpText={`Due ${nextDeadline.dateStr}`} icon={<CalendarIcon className="w-5 h-5 text-indigo-600"/>} className="border-indigo-200 bg-indigo-50" />
          </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {appState === 'idle' ? (
          <div className="flex flex-col h-full">
            <h2 className="text-xl font-bold text-slate-700 mb-4">Import Transactions</h2>
            <div className="flex-shrink-0">
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
                    <FileUpload 
                      onFileUpload={handleFileUpload} 
                      disabled={false} 
                      accounts={accounts} 
                      useAi={useAi} 
                      onAddAccountRequested={() => setIsAccountModalOpen(true)}
                    />
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Select Account</label>
                            <div className="flex gap-2">
                                 {accounts.length > 0 ? (
                                    <select value={pasteAccountId} onChange={(e) => setPasteAccountId(e.target.value)} className="flex-grow">
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                 ) : (
                                    <div className="flex-grow p-2 border rounded-md bg-red-50 text-red-600 text-sm font-medium border-red-100">No accounts found. Create one to continue.</div>
                                 )}
                                 <button 
                                    onClick={() => setIsAccountModalOpen(true)} 
                                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-indigo-600"
                                    title="Quick add account"
                                 >
                                    <AddIcon className="w-5 h-5" />
                                 </button>
                            </div>
                        </div>
                        <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Paste transaction text here (CSV rows, or table data from your bank website)..." className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm" />
                        <button onClick={handleTextPaste} disabled={!textInput.trim() || accounts.length === 0} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-slate-400">Process Text</button>
                    </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-slate-100">
                     <label className="block text-sm font-medium text-slate-700 mb-2">Assign to User</label>
                     <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-slate-50 shadow-inner max-h-48 overflow-y-auto">
                        {users.map(u => (
                            <label key={u.id} className="flex items-center gap-2 cursor-pointer group bg-white px-3 py-1.5 rounded-md border border-slate-200 hover:border-indigo-400 transition-colors">
                                <input type="radio" name="importUser" value={u.id} checked={selectedUserId === u.id} onChange={() => setSelectedUserId(u.id)} className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                                <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">{u.name}</span>
                            </label>
                        ))}
                     </div>
                </div>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-200 overflow-hidden flex flex-col flex-1">
                <h2 className="text-xl font-bold text-slate-700 mb-4">Recent Global Transactions</h2>
                <div className="flex-1 overflow-hidden relative">
                    <TransactionTable transactions={recentTransactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={() => {}} onDeleteTransaction={() => {}} visibleColumns={new Set(['date', 'description', 'amount', 'category', 'type'])} />
                </div>
            </div>
          </div>
        ) : appState === 'processing' ? (
            <div className="py-12 flex-1 flex flex-col items-center justify-center space-y-4 text-center">
                <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <div className="text-slate-600">
                    <p className="font-bold text-xl">Processing Documents</p>
                    <p className="text-sm text-slate-400 mt-1">{progressMessage}</p>
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
                payees={payees.concat(stagedNewPayees)} 
                users={users} 
                onCreateRule={handleTriggerCreateRule} 
            />
        ) : appState === 'reviewing_duplicates' ? (
            <DuplicateReview duplicates={duplicatesToReview} onComplete={handleReviewComplete} onCancel={handleClear} accounts={accounts} />
        ) : appState === 'post_import_edit' ? (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in h-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-slate-50 p-5 rounded-2xl border border-indigo-100 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <SparklesIcon className="w-6 h-6 text-indigo-600" />
                            Import Ready for Review
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Successfully added <strong className="text-indigo-600 font-black">{justImportedTransactions.length}</strong> transactions. 
                            You can refine them below before finishing.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleClear}
                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <CheckCircleIcon className="w-5 h-5" />
                            Finish & Exit
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl shadow-sm relative">
                    <TransactionTable 
                        transactions={justImportedTransactions} 
                        accounts={accounts} 
                        categories={categories} 
                        tags={tags} 
                        transactionTypes={transactionTypes} 
                        payees={payees} 
                        users={users} 
                        onUpdateTransaction={onUpdateTransaction} 
                        onDeleteTransaction={onDeleteTransaction} 
                        visibleColumns={new Set(['date', 'description', 'payee', 'category', 'tags', 'user', 'amount', 'actions'])}
                    />
                </div>
                
                <div className="mt-4 flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex-shrink-0">
                    <div className="flex items-center gap-2 text-indigo-800">
                        <InfoIcon className="w-5 h-5" />
                        <p className="text-sm font-medium">Changes made here are saved directly to your permanent record.</p>
                    </div>
                    {duplicatesImported > 0 && (
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                            Includes {duplicatesImported} overridden duplicate(s)
                        </span>
                    )}
                </div>
            </div>
        ) : (
            <ResultsDisplay appState={appState} error={error} progressMessage={progressMessage} transactions={finalizedTransactions} duplicatesIgnored={duplicatesIgnored} duplicatesImported={duplicatesImported} onClear={handleClear} />
        )}
      </div>

      <QuickAccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        onSave={onAddAccount}
        onAddType={onAddAccountType}
        accountTypes={accountTypes}
      />

      {isRuleModalOpen && (
        <RuleModal
            isOpen={isRuleModalOpen}
            onClose={() => setIsRuleModalOpen(false)}
            onSaveRule={handleSaveRuleFromImport}
            accounts={accounts}
            transactionTypes={transactionTypes}
            categories={categories}
            tags={tags}
            payees={payees}
            transaction={txForRule}
            onSaveCategory={onSaveCategory}
            onSavePayee={onSavePayee}
            onSaveTag={onSaveTag}
            onAddTransactionType={onAddTransactionType}
        />
      )}
    </div>
  );
};

export default Dashboard;
