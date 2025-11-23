
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, User, Tag } from '../types';
import TransactionTable from '../components/TransactionTable';
import TransactionModal from './TransactionModal';
import RuleModal from '../components/RuleModal';
import LinkTransactionModal from '../components/LinkTransactionModal';
import LinkedGroupModal from '../components/LinkedGroupModal';
import DuplicateFinder from '../components/DuplicateFinder';
import TransactionAuditor from '../components/TransactionAuditor';
import { AddIcon, DuplicateIcon, DeleteIcon, CloseIcon, CalendarIcon, RobotIcon, EyeIcon, LinkIcon, TagIcon } from '../components/Icons';
import { hasApiKey } from '../services/geminiService';
import { generateUUID } from '../utils';

// A custom hook to debounce a value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// Bulk Tag Modal Component
const BulkTagModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    tags: Tag[];
    onApply: (tagIds: string[]) => void;
    count: number;
}> = ({ isOpen, onClose, tags, onApply, count }) => {
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

    useEffect(() => {
        if(isOpen) setSelectedTags(new Set());
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleTag = (id: string) => {
        const newSet = new Set(selectedTags);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedTags(newSet);
    };

    const handleApply = () => {
        onApply(Array.from(selectedTags));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Add Tags to {count} Transactions</h3>
                    <button onClick={onClose}><CloseIcon className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-4">Select tags to append to the selected transactions.</p>
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => toggleTag(tag.id)}
                                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${selectedTags.has(tag.id) ? tag.color + ' ring-2 ring-offset-1 ring-indigo-500 font-semibold' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                                {tag.name}
                            </button>
                        ))}
                        {tags.length === 0 && <p className="text-sm text-slate-400 italic">No tags available. Create them in the Tags page.</p>}
                    </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button>
                    <button onClick={handleApply} disabled={selectedTags.size === 0} className="px-4 py-2 text-sm text-white bg-indigo-600 font-medium rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed">Apply Tags</button>
                </div>
            </div>
        </div>
    );
};


interface AllTransactionsProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  payees: Payee[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onDeleteTransactions: (transactionIds: string[]) => void;
  onSaveRule: (rule: ReconciliationRule) => void;
  onSaveCategory: (category: Category) => void;
  onSavePayee: (payee: Payee) => void;
  onAddTransactionType: (type: TransactionType) => void;
}

const AllTransactions: React.FC<AllTransactionsProps> = ({ transactions, accounts, categories, tags, transactionTypes, payees, users, onUpdateTransaction, onAddTransaction, onDeleteTransaction, onDeleteTransactions, onSaveRule, onSaveCategory, onSavePayee, onAddTransactionType }) => {
  // State for immediate input values
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Debounced values for filtering logic
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedCategoryFilter = useDebounce(categoryFilter, 300);
  const debouncedTypeFilter = useDebounce(typeFilter, 300);
  const debouncedAccountFilter = useDebounce(accountFilter, 300);
  const debouncedUserFilter = useDebounce(userFilter, 300);
  const debouncedStartDate = useDebounce(startDate, 300);
  const debouncedEndDate = useDebounce(endDate, 300);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isLinkedGroupModalOpen, setIsLinkedGroupModalOpen] = useState(false);
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [selectedLinkGroupId, setSelectedLinkGroupId] = useState<string | null>(null);
  
  // Auditor State
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);
  const [auditorExampleGroup, setAuditorExampleGroup] = useState<Transaction[] | undefined>(undefined);

  const [transactionForRule, setTransactionForRule] = useState<Transaction | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<Transaction[][][] | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  
  // Column Visibility State - Persisted
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('transaction_columns');
      return saved ? new Set(JSON.parse(saved)) : new Set(['date', 'description', 'payee', 'category', 'tags', 'account', 'type', 'amount', 'actions']);
  });
  
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
              setIsColumnMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      localStorage.setItem('transaction_columns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  const sortedCategoryOptions = useMemo(() => {
    const sorted: { id: string, name: string }[] = [];
    const parents = categories.filter(c => !c.parentId).sort((a, b) => a.name.localeCompare(b.name));
    parents.forEach(parent => {
      sorted.push({ id: parent.id, name: parent.name });
      const children = categories.filter(c => c.parentId === parent.id).sort((a, b) => a.name.localeCompare(b.name));
      children.forEach(child => {
        sorted.push({ id: child.id, name: `  - ${child.name}` });
      });
    });
    return sorted;
  }, [categories]);


  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const start = debouncedStartDate ? new Date(debouncedStartDate) : null;
      const end = debouncedEndDate ? new Date(debouncedEndDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      if (debouncedSearchTerm && !tx.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) return false;
      if (debouncedCategoryFilter && tx.categoryId !== debouncedCategoryFilter) return false;
      if (debouncedTypeFilter && tx.typeId !== debouncedTypeFilter) return false;
      if (debouncedAccountFilter && tx.accountId !== debouncedAccountFilter) return false;
      if (debouncedUserFilter && tx.userId !== debouncedUserFilter) return false;
      
      return true;
    });
  }, [transactions, debouncedSearchTerm, debouncedCategoryFilter, debouncedTypeFilter, debouncedAccountFilter, debouncedUserFilter, debouncedStartDate, debouncedEndDate]);
  
  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setTypeFilter('');
    setAccountFilter('');
    setUserFilter('');
    setStartDate('');
    setEndDate('');
  }

  const handleAddNew = () => {
    setIsModalOpen(true);
  };

  const handleSave = (formData: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
        ...formData,
        id: generateUUID() // Use a guaranteed unique ID for manual entries
    };
    onAddTransaction(newTransaction);
    setIsModalOpen(false);
  };

  const handleCreateRule = (transaction: Transaction) => {
    setTransactionForRule(transaction);
    setIsRuleModalOpen(true);
  };
  
  const handleApplyAuditChanges = (updates: Transaction[]) => {
      updates.forEach(tx => onUpdateTransaction(tx));
  };

  const handleFindDuplicates = () => {
    const groups: Transaction[][][] = [];
    const processedIds = new Set<string>();
    const typeMap: Map<string, TransactionType> = new Map(transactionTypes.map(t => [t.id, t]));

    const unlinkedTransactions = transactions.filter(tx => !tx.linkedTransactionId && !tx.linkGroupId);

    const expenses = unlinkedTransactions.filter(tx => {
        const type = typeMap.get(tx.typeId);
        return type?.balanceEffect === 'expense';
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const incomes = unlinkedTransactions.filter(tx => {
        const type = typeMap.get(tx.typeId);
        return type?.balanceEffect === 'income';
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const expense of expenses) {
        if (processedIds.has(expense.id)) continue;

        const targetAmount = expense.amount;
        const expenseDate = new Date(expense.date);
        const dateWindow = 5; // +/- 5 days

        const potentialMatches = incomes.filter(income => {
            if (processedIds.has(income.id) || income.accountId === expense.accountId) return false;
            const incomeDate = new Date(income.date);
            const dateDiff = Math.abs(incomeDate.getTime() - expenseDate.getTime()) / (1000 * 3600 * 24);
            return dateDiff <= dateWindow;
        });

        if (potentialMatches.length === 0) continue;

        let foundMatch: Transaction[] | null = null;
        
        // 1-to-1
        const oneToOne = potentialMatches.find(p => Math.abs(p.amount - targetAmount) < 0.01);
        if (oneToOne) {
            foundMatch = [oneToOne];
        }

        // 1-to-2
        if (!foundMatch && potentialMatches.length >= 2) {
            for (let i = 0; i < potentialMatches.length; i++) {
                for (let j = i + 1; j < potentialMatches.length; j++) {
                    if (Math.abs((potentialMatches[i].amount + potentialMatches[j].amount) - targetAmount) < 0.01) {
                        foundMatch = [potentialMatches[i], potentialMatches[j]];
                        break;
                    }
                }
                if (foundMatch) break;
            }
        }
        
        if (foundMatch) {
            groups.push([[expense], foundMatch]);
            processedIds.add(expense.id);
            foundMatch.forEach(match => processedIds.add(match.id));
        }
    }
    
    if (groups.length > 0) {
        setDuplicateGroups(groups);
    } else {
        alert("No potential duplicates found. Good job!");
    }
  };
  
  const handleExitDuplicateFinder = () => {
      setDuplicateGroups(null);
  };

  const handleLinkGroup = (group: Transaction[][]) => {
      const transferType = transactionTypes.find(t => t.name === 'Transfer' && t.balanceEffect === 'transfer');
      if (!transferType) {
          alert("A transaction type named 'Transfer' with the effect 'transfer' is required. Please create one in Settings.");
          return;
      }

      const allTxs = group.flat();
      const linkGroupId = generateUUID();
      
      allTxs.forEach(tx => {
          onUpdateTransaction({
              ...tx,
              typeId: transferType.id, // Simple linker sets all to transfer for now (legacy behavior)
              linkGroupId: linkGroupId // Use new group ID
          });
      });
      
      setDuplicateGroups(prev => prev ? prev.filter(g => g[0][0].id !== group[0][0].id) : null);
  };

  const handleDismissGroup = (groupId: string) => {
      setDuplicateGroups(prev => prev ? prev.filter(g => g[0][0].id !== groupId) : null);
  };

  const handleToggleSelection = (txId: string) => {
    const newSelection = new Set(selectedTxIds);
    if (newSelection.has(txId)) {
        newSelection.delete(txId);
    } else {
        newSelection.add(txId);
    }
    setSelectedTxIds(newSelection);
  };

  const handleBulkSelection = (ids: string[], selected: boolean) => {
      const newSelection = new Set(selectedTxIds);
      ids.forEach(id => {
          if (selected) newSelection.add(id);
          else newSelection.delete(id);
      });
      setSelectedTxIds(newSelection);
  };

  const handleToggleSelectAll = () => {
      if (selectedTxIds.size === filteredTransactions.length) {
          setSelectedTxIds(new Set());
      } else {
          setSelectedTxIds(new Set(filteredTransactions.map(tx => tx.id)));
      }
  };
  
  const handleBulkDelete = () => {
      if (window.confirm(`Are you sure you want to delete ${selectedTxIds.size} transaction(s)? This action cannot be undone.`)) {
          onDeleteTransactions(Array.from(selectedTxIds));
          setSelectedTxIds(new Set());
      }
  };

  const handleBulkLink = () => {
      if (selectedTxIds.size < 2) {
          alert("Please select at least 2 transactions to link.");
          return;
      }
      setIsLinkModalOpen(true);
  }

  const handleBulkAddTags = (newTagIds: string[]) => {
      selectedTxIds.forEach(id => {
          const tx = transactions.find(t => t.id === id);
          if (tx) {
              const currentTags = new Set(tx.tagIds || []);
              newTagIds.forEach(tagId => currentTags.add(tagId));
              onUpdateTransaction({ ...tx, tagIds: Array.from(currentTags) });
          }
      });
      setSelectedTxIds(new Set());
  };

  const handleManageLink = (groupId: string) => {
      setSelectedLinkGroupId(groupId);
      setIsLinkedGroupModalOpen(true);
  };

  const handleSaveLinkedTransactions = (updates: Transaction[]) => {
      updates.forEach(tx => onUpdateTransaction(tx));
      setSelectedTxIds(new Set());
  };

  const handleSaveLinkedTransactionsAndFindSimilar = (updates: Transaction[]) => {
      handleSaveLinkedTransactions(updates);
      setAuditorExampleGroup(updates);
      setIsAuditorOpen(true);
  };

  const handleUnlinkGroup = (txsToUnlink: Transaction[]) => {
      txsToUnlink.forEach(tx => {
          onUpdateTransaction({ ...tx, linkGroupId: undefined, linkedTransactionId: undefined });
      });
      setIsLinkedGroupModalOpen(false);
      setSelectedLinkGroupId(null);
  };

  const handleFindSimilarFromGroup = (group: Transaction[]) => {
      setAuditorExampleGroup(group);
      setIsAuditorOpen(true);
  };

  const handleAuditorClose = () => {
      setIsAuditorOpen(false);
      setAuditorExampleGroup(undefined);
  };

  const toggleColumn = (column: string) => {
      setVisibleColumns(prev => {
          const newSet = new Set(prev);
          if (newSet.has(column)) newSet.delete(column);
          else newSet.add(column);
          return newSet;
      });
  };

  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc.name])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p.name])), [payees]);
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);

  const handleSetDateRange = (preset: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQuarter * 3, 1);
        end = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
        break;
      case 'lastQuarter':
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        if (lastQuarter < 0) {
            start = new Date(now.getFullYear() - 1, 9, 1);
            end = new Date(now.getFullYear() - 1, 12, 0);
        } else {
            start = new Date(now.getFullYear(), lastQuarter * 3, 1);
            end = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0);
        }
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleExportCsv = () => {
    const headers = ['Date', 'Description', 'Location', 'Payee', 'Account', 'Category', 'Type', 'Amount'];
    const rows = filteredTransactions.map(tx => {
      const type = transactionTypeMap.get(tx.typeId);
      const amount = type?.balanceEffect === 'expense' ? -tx.amount : tx.amount;
      return [
        tx.date,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.location || '',
        payeeMap.get(tx.payeeId || '') || '',
        accountMap.get(tx.accountId || '') || '',
        categoryMap.get(tx.categoryId) || '',
        type?.name || '',
        amount.toFixed(2)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    const headers = ['Date', 'Description', 'Location', 'Payee', 'Account', 'Category', 'Type', 'Amount'];
    const rows = filteredTransactions.map(tx => {
      const type = transactionTypeMap.get(tx.typeId);
      const amount = type?.balanceEffect === 'expense' ? -tx.amount : tx.amount;
      return `
        <tr>
          <td>${tx.date}</td>
          <td>${tx.description}</td>
          <td>${tx.location || ''}</td>
          <td>${payeeMap.get(tx.payeeId || '') || ''}</td>
          <td>${accountMap.get(tx.accountId || '') || ''}</td>
          <td>${categoryMap.get(tx.categoryId) || ''}</td>
          <td>${type?.name || ''}</td>
          <td style="text-align: right;">${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`
      <html>
        <head>
          <title>Transactions Export</title>
          <style>
            body { font-family: sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            @media print {
              @page { size: landscape; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <h1>Transactions Export</h1>
          <p>Filters applied: ${debouncedSearchTerm || 'None'}, ${categoryMap.get(debouncedCategoryFilter) || 'All Categories'}, ${transactionTypeMap.get(debouncedTypeFilter)?.name || 'All Types'}, ${accountMap.get(debouncedAccountFilter) || 'All Accounts'}, ${debouncedStartDate} to ${debouncedEndDate}</p>
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow?.document.close();
    printWindow?.focus();
    printWindow?.print();
  };

  if (duplicateGroups) {
    return (
        <DuplicateFinder
            groups={duplicateGroups}
            onLinkGroup={handleLinkGroup}
            onDismissGroup={handleDismissGroup}
            onDelete={onDeleteTransaction}
            onExit={handleExitDuplicateFinder}
            accounts={accounts}
            transactionTypes={transactionTypes}
        />
    )
  }

  const columnOptions = [
      { id: 'date', label: 'Date' },
      { id: 'description', label: 'Description' },
      { id: 'payee', label: 'Payee' },
      { id: 'category', label: 'Category' },
      { id: 'tags', label: 'Tags' },
      { id: 'account', label: 'Account' },
      { id: 'location', label: 'Location' },
      { id: 'user', label: 'User' },
      { id: 'type', label: 'Type' },
      { id: 'amount', label: 'Amount' },
      { id: 'actions', label: 'Actions' }
  ];

  const selectedTransactionsList = useMemo(() => 
    transactions.filter(tx => selectedTxIds.has(tx.id)), 
  [transactions, selectedTxIds]);

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-shrink-0">
           <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-700">All Transactions</h2>
                <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
                    <div className="relative" ref={columnMenuRef}>
                        <button onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="flex items-center gap-2 px-4 py-2 text-slate-600 font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            <EyeIcon className="w-5 h-5"/>
                            <span>Columns</span>
                        </button>
                        {isColumnMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                                <div className="p-2">
                                    <h4 className="font-semibold text-xs text-slate-500 uppercase mb-2 px-2">Toggle Columns</h4>
                                    {columnOptions.map(col => (
                                        <label key={col.id} className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                            <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2" checked={visibleColumns.has(col.id)} onChange={() => toggleColumn(col.id)} />
                                            <span className="text-sm text-slate-700">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setIsAuditorOpen(true)} disabled={!hasApiKey()} className="flex items-center gap-2 px-4 py-2 text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" title={!hasApiKey() ? "API Key missing" : "AI Audit"}>
                        <RobotIcon className="w-5 h-5"/>
                        <span>AI Audit</span>
                    </button>
                    <button onClick={handleFindDuplicates} className="flex items-center gap-2 px-4 py-2 text-indigo-600 font-semibold bg-indigo-100 rounded-lg shadow-sm hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                        <DuplicateIcon className="w-5 h-5"/>
                        <span>Find Duplicates</span>
                    </button>
                    <button onClick={handleAddNew} className="flex items-center gap-2 px-4 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                        <AddIcon className="w-5 h-5"/>
                        <span>Add Transaction</span>
                    </button>
                </div>
            </div>
            <div className="border-t pt-4">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-sm font-medium text-slate-600">Quick Date Filters:</span>
                    <button onClick={() => handleSetDateRange('thisMonth')} className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200">This Month</button>
                    <button onClick={() => handleSetDateRange('lastMonth')} className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200">Last Month</button>
                    <button onClick={() => handleSetDateRange('thisQuarter')} className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200">This Quarter</button>
                    <button onClick={() => handleSetDateRange('lastQuarter')} className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200">Last Quarter</button>
                    <button onClick={() => handleSetDateRange('thisYear')} className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200">This Year</button>
                    <div className="flex-grow"></div>
                    <button onClick={handleExportCsv} className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 hover:bg-green-200">Export CSV</button>
                    <button onClick={handleExportPdf} className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 hover:bg-red-200">Export PDF</button>
                </div>
            </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-center">
              <input 
                  type="text" 
                  placeholder="Search description..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="sm:col-span-2 lg:col-span-1"
              />
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="">All Types</option>
                  {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
              <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)}>
                  <option value="">All Accounts</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                  <option value="">All Users</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <div className="relative">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <CalendarIcon className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                   <CalendarIcon className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button onClick={clearFilters} className="text-sm text-indigo-600 hover:underline">Clear Filters</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <TransactionTable 
            transactions={filteredTransactions} 
            accounts={accounts} 
            categories={categories}
            tags={tags}
            transactionTypes={transactionTypes}
            payees={payees}
            users={users}
            onUpdateTransaction={onUpdateTransaction} 
            onDeleteTransaction={onDeleteTransaction} 
            onCreateRule={handleCreateRule}
            showCheckboxes={true}
            selectedTxIds={selectedTxIds}
            onToggleSelection={handleToggleSelection}
            onToggleSelectAll={handleToggleSelectAll}
            onBulkSelection={handleBulkSelection}
            visibleColumns={visibleColumns}
            onManageLink={handleManageLink}
          />
        </div>
      </div>
      
      {selectedTxIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-slide-up">
            <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                <span className="font-medium text-sm">{selectedTxIds.size} selected</span>
                <button onClick={() => setSelectedTxIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800">
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="flex items-center gap-2">
                 <button
                    onClick={() => setIsBulkTagModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-50 rounded-full transition-colors shadow-sm"
                >
                    <TagIcon className="w-4 h-4"/>
                    Tags
                </button>
                 <button
                    onClick={handleBulkLink}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-50 rounded-full transition-colors shadow-sm"
                >
                    <LinkIcon className="w-4 h-4"/>
                    Link
                </button>
                <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 rounded-full transition-colors shadow-sm"
                >
                    <DeleteIcon className="w-4 h-4"/>
                    Delete
                </button>
            </div>
        </div>
      )}

      {isModalOpen && (
        <TransactionModal
            isOpen={isModalOpen}
            transaction={null}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            accounts={accounts}
            categories={categories}
            tags={tags}
            transactionTypes={transactionTypes}
            payees={payees}
            users={users}
        />
      )}
      {isLinkModalOpen && (
          <LinkTransactionModal 
            isOpen={isLinkModalOpen}
            onClose={() => setIsLinkModalOpen(false)}
            transactions={selectedTransactionsList}
            transactionTypes={transactionTypes}
            accounts={accounts}
            categories={categories}
            onSave={handleSaveLinkedTransactions}
            onFindSimilar={handleSaveLinkedTransactionsAndFindSimilar}
          />
      )}
      {isLinkedGroupModalOpen && selectedLinkGroupId && (
          <LinkedGroupModal
            isOpen={isLinkedGroupModalOpen}
            onClose={() => setIsLinkedGroupModalOpen(false)}
            transactions={transactions.filter(tx => tx.linkGroupId === selectedLinkGroupId || tx.linkedTransactionId === selectedLinkGroupId)}
            transactionTypes={transactionTypes}
            accounts={accounts}
            onUnlink={handleUnlinkGroup}
            onFindSimilar={handleFindSimilarFromGroup}
          />
      )}
      {isBulkTagModalOpen && (
          <BulkTagModal 
            isOpen={isBulkTagModalOpen}
            onClose={() => setIsBulkTagModalOpen(false)}
            tags={tags}
            onApply={handleBulkAddTags}
            count={selectedTxIds.size}
          />
      )}
      {isRuleModalOpen && (
        <RuleModal
            isOpen={isRuleModalOpen}
            onClose={() => setIsRuleModalOpen(false)}
            onSaveRule={onSaveRule}
            accounts={accounts}
            transactionTypes={transactionTypes}
            categories={categories}
            tags={tags}
            payees={payees}
            transaction={transactionForRule}
            onSaveCategory={onSaveCategory}
            onSavePayee={onSavePayee}
            onAddTransactionType={onAddTransactionType}
        />
      )}
      {isAuditorOpen && (
          <TransactionAuditor
            isOpen={isAuditorOpen}
            onClose={handleAuditorClose}
            transactions={filteredTransactions}
            transactionTypes={transactionTypes}
            categories={categories}
            onApplyChanges={handleApplyAuditChanges}
            exampleGroup={auditorExampleGroup}
          />
      )}
    </>
  );
};

export default AllTransactions;
