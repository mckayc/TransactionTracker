
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, User, Tag, SavedReport, ReportConfig } from '../types';
import TransactionTable from '../components/TransactionTable';
import TransactionModal from './TransactionModal';
import RuleModal from '../components/RuleModal';
import LinkTransactionModal from '../components/LinkTransactionModal';
import LinkedGroupModal from '../components/LinkedGroupModal';
import DuplicateFinder from '../components/DuplicateFinder';
import TransactionAuditor from '../components/TransactionAuditor';
import VerifyModal from '../components/VerifyModal';
import DonationModal from '../components/DonationModal';
import SplitTransactionModal from '../components/SplitTransactionModal';
import { AddIcon, DuplicateIcon, DeleteIcon, CloseIcon, CalendarIcon, RobotIcon, EyeIcon, LinkIcon, TagIcon, UserGroupIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, PrinterIcon, DownloadIcon, ShieldCheckIcon, HeartIcon, ChartPieIcon } from '../components/Icons';
import { hasApiKey } from '../services/geminiService';
import { generateUUID } from '../utils';
import MultiSelect from '../components/MultiSelect';

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

// Bulk User Modal Component
const BulkUserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    users: User[];
    onApply: (userId: string) => void;
    count: number;
}> = ({ isOpen, onClose, users, onApply, count }) => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    useEffect(() => {
        if(isOpen) setSelectedUserId('');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleApply = () => {
        if (selectedUserId) {
            onApply(selectedUserId);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Assign User to {count} Transactions</h3>
                    <button onClick={onClose}><CloseIcon className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-4">Select a user to assign to the selected transactions.</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {users.map(user => (
                            <label key={user.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedUserId === user.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                <input 
                                    type="radio" 
                                    name="bulkUserSelect" 
                                    value={user.id} 
                                    checked={selectedUserId === user.id} 
                                    onChange={() => setSelectedUserId(user.id)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                />
                                <span className="ml-3 text-sm font-medium text-slate-700">{user.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button>
                    <button onClick={handleApply} disabled={!selectedUserId} className="px-4 py-2 text-sm text-white bg-indigo-600 font-medium rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed">Assign User</button>
                </div>
            </div>
        </div>
    );
};

// --- Filter Summary Card ---
const SummaryCard: React.FC<{ title: string; value: number; type: 'income' | 'expense' | 'investment' | 'donation' }> = ({ title, value, type }) => {
    const colors = {
        income: 'text-green-600 bg-green-50 border-green-100',
        expense: 'text-red-600 bg-red-50 border-red-100',
        investment: 'text-purple-600 bg-purple-50 border-purple-100',
        donation: 'text-blue-600 bg-blue-50 border-blue-100'
    };
    
    return (
        <div className={`p-4 rounded-xl border ${colors[type]} flex flex-col`}>
            <span className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{title}</span>
            <span className="text-xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}</span>
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
  onSaveTag: (tag: Tag) => void;
  onAddTransactionType: (type: TransactionType) => void;
  onSaveReport: (report: SavedReport) => void;
}

type DateMode = 'month' | 'quarter' | 'year' | 'all' | 'custom';

const AllTransactions: React.FC<AllTransactionsProps> = ({ transactions, accounts, categories, tags, transactionTypes, payees, users, onUpdateTransaction, onAddTransaction, onDeleteTransaction, onDeleteTransactions, onSaveRule, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, onSaveReport }) => {
  // State for immediate input values
  const [searchTerm, setSearchTerm] = useState('');
  
  // Multi-Select States with Persistence
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('filter_categories');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('filter_types');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('filter_accounts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('filter_users');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [selectedPayees, setSelectedPayees] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('filter_payees');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Save filters on change
  useEffect(() => { localStorage.setItem('filter_categories', JSON.stringify(Array.from(selectedCategories))); }, [selectedCategories]);
  useEffect(() => { localStorage.setItem('filter_types', JSON.stringify(Array.from(selectedTypes))); }, [selectedTypes]);
  useEffect(() => { localStorage.setItem('filter_accounts', JSON.stringify(Array.from(selectedAccounts))); }, [selectedAccounts]);
  useEffect(() => { localStorage.setItem('filter_users', JSON.stringify(Array.from(selectedUsers))); }, [selectedUsers]);
  useEffect(() => { localStorage.setItem('filter_payees', JSON.stringify(Array.from(selectedPayees))); }, [selectedPayees]);

  // Date Logic - Default to Previous Month (Not Persisted to ensure default view)
  const [dateMode, setDateMode] = useState<DateMode>('month');
  const [dateCursor, setDateCursor] = useState(() => {
      // Default to Previous Month
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d;
  });
  
  // Computed range strings for filtering (YYYY-MM-DD)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Initialize date range based on mode/cursor
  useEffect(() => {
      const year = dateCursor.getFullYear();
      const month = dateCursor.getMonth();
      
      if (dateMode === 'month') {
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          setStartDate(firstDay.toISOString().split('T')[0]);
          setEndDate(lastDay.toISOString().split('T')[0]);
      } else if (dateMode === 'quarter') {
          const quarter = Math.floor(month / 3);
          const firstDay = new Date(year, quarter * 3, 1);
          const lastDay = new Date(year, (quarter + 1) * 3, 0);
          setStartDate(firstDay.toISOString().split('T')[0]);
          setEndDate(lastDay.toISOString().split('T')[0]);
      } else if (dateMode === 'year') {
          const firstDay = new Date(year, 0, 1);
          const lastDay = new Date(year, 11, 31);
          setStartDate(firstDay.toISOString().split('T')[0]);
          setEndDate(lastDay.toISOString().split('T')[0]);
      } else if (dateMode === 'all') {
          setStartDate('');
          setEndDate('');
      }
      // 'custom' mode handled by direct input state changes
  }, [dateMode, dateCursor]);

  const handleDateNavigate = (direction: 'prev' | 'next') => {
      const newCursor = new Date(dateCursor);
      // Normalize to 1st of month to avoid day overflow issues (e.g. Jan 31 + 1 month -> Mar 3)
      newCursor.setDate(1); 

      if (dateMode === 'month') {
          newCursor.setMonth(newCursor.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (dateMode === 'quarter') {
          newCursor.setMonth(newCursor.getMonth() + (direction === 'next' ? 3 : -3));
      } else if (dateMode === 'year') {
          newCursor.setFullYear(newCursor.getFullYear() + (direction === 'next' ? 1 : -1));
      }
      setDateCursor(newCursor);
  };

  const dateLabel = useMemo(() => {
      if (dateMode === 'month') {
          return dateCursor.toLocaleString('default', { month: 'long', year: 'numeric' });
      }
      if (dateMode === 'quarter') {
          const q = Math.floor(dateCursor.getMonth() / 3) + 1;
          return `Q${q} ${dateCursor.getFullYear()}`;
      }
      if (dateMode === 'year') {
          return dateCursor.getFullYear().toString();
      }
      if (dateMode === 'all') {
          return 'Lifetime';
      }
      return 'Custom Range';
  }, [dateMode, dateCursor]);
  
  // UI State
  const [showFilters, setShowFilters] = useState(true); // Default Expanded

  // Debounced values
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isLinkedGroupModalOpen, setIsLinkedGroupModalOpen] = useState(false);
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [isBulkUserModalOpen, setIsBulkUserModalOpen] = useState(false);
  const [selectedLinkGroupId, setSelectedLinkGroupId] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  
  // Split Logic
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [transactionToSplit, setTransactionToSplit] = useState<Transaction | null>(null);

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
  
  // Export Menu
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
              setIsColumnMenuOpen(false);
          }
          if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
              setIsExportMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      localStorage.setItem('transaction_columns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      if (debouncedSearchTerm && !tx.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) return false;
      
      // Multi-select filters logic
      if (selectedCategories.size > 0 && !selectedCategories.has(tx.categoryId)) return false;
      if (selectedTypes.size > 0 && !selectedTypes.has(tx.typeId)) return false;
      if (selectedAccounts.size > 0 && !selectedAccounts.has(tx.accountId || '')) return false;
      if (selectedUsers.size > 0 && !selectedUsers.has(tx.userId || '')) return false;
      if (selectedPayees.size > 0 && !selectedPayees.has(tx.payeeId || '')) return false;
      
      return true;
    });
  }, [transactions, debouncedSearchTerm, selectedCategories, selectedTypes, selectedAccounts, selectedUsers, selectedPayees, startDate, endDate]);
  
  // Calculate Summaries based on Filtered Data
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  
  const summaries = useMemo(() => {
      let income = 0;
      let expenses = 0;
      let investments = 0;
      let donations = 0;

      filteredTransactions.forEach(tx => {
          // Skip Parent transactions in sums to avoid double counting
          if (tx.isParent) return;

          const type = transactionTypeMap.get(tx.typeId);
          if (type?.balanceEffect === 'income') income += tx.amount;
          else if (type?.balanceEffect === 'expense') expenses += tx.amount;
          else if (type?.balanceEffect === 'investment') investments += tx.amount;
          else if (type?.balanceEffect === 'donation') donations += tx.amount;
      });

      return { income, expenses, investments, donations };
  }, [filteredTransactions, transactionTypeMap]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories(new Set());
    setSelectedTypes(new Set());
    setSelectedAccounts(new Set());
    setSelectedUsers(new Set());
    setSelectedPayees(new Set());
    // Reset date to month mode previous month
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    setDateMode('month');
    setDateCursor(d);
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
  
  const handleSplitTransaction = (transaction: Transaction) => {
      setTransactionToSplit(transaction);
      setIsSplitModalOpen(true);
  };

  const handleSaveSplit = (parent: Transaction, children: Transaction[]) => {
      // Update original as Parent
      onUpdateTransaction(parent);
      // Add all new children
      children.forEach(child => onAddTransaction(child));
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

  const handleBulkAssignUser = (userId: string) => {
      selectedTxIds.forEach(id => {
          const tx = transactions.find(t => t.id === id);
          if (tx) {
              onUpdateTransaction({ ...tx, userId });
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
          onUpdateTransaction({ ...tx, linkGroupId: undefined, linkedTransactionId: undefined, isParent: undefined, parentTransactionId: undefined });
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

  const handleExportCSV = () => {
      const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account', 'Payee', 'User'];
      // Filter out Parents from export to avoid duplicates
      const rows = filteredTransactions.filter(tx => !tx.isParent).map(tx => [
          tx.date,
          `"${tx.description.replace(/"/g, '""')}"`, // Escape quotes
          tx.amount.toFixed(2),
          transactionTypeMap.get(tx.typeId)?.name || '',
          categories.find(c => c.id === tx.categoryId)?.name || '',
          accountMap.get(tx.accountId || '') || '',
          payeeMap.get(tx.payeeId || '') || '',
          users.find(u => u.id === tx.userId)?.name || ''
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportMenuOpen(false);
  };

  const handlePrint = () => {
      window.print();
      setIsExportMenuOpen(false);
  }

  const handleSaveView = () => {
      const name = prompt("Save this view as a report named:", "Transaction View");
      if (!name) return;

      const config: ReportConfig = {
          id: generateUUID(),
          name,
          dataSource: 'financial',
          datePreset: dateMode === 'all' ? 'allTime' : 'custom',
          customStartDate: dateMode === 'all' ? undefined : startDate,
          customEndDate: dateMode === 'all' ? undefined : endDate,
          groupBy: 'category', // Default grouping for reports
          filters: {
              accountIds: selectedAccounts.size > 0 ? Array.from(selectedAccounts) : undefined,
              userIds: selectedUsers.size > 0 ? Array.from(selectedUsers) : undefined,
              categoryIds: selectedCategories.size > 0 ? Array.from(selectedCategories) : undefined,
              typeIds: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
              payeeIds: selectedPayees.size > 0 ? Array.from(selectedPayees) : undefined,
          },
          hiddenCategoryIds: [],
          hiddenIds: []
      };

      onSaveReport({ id: config.id, name: config.name, config });
  };

  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc.name])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p.name])), [payees]);

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
      <div className="flex flex-col h-full overflow-hidden gap-4 w-full max-w-full">
        
        {/* Dynamic Summary Cards (Based on Filters) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0 print:hidden">
            <SummaryCard title="Income" value={summaries.income} type="income" />
            <SummaryCard title="Expenses" value={summaries.expenses} type="expense" />
            <SummaryCard title="Investments" value={summaries.investments} type="investment" />
            <SummaryCard title="Donations" value={summaries.donations} type="donation" />
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-shrink-0 print:hidden">
           <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-700">Transactions</h2>
                    <span className="text-sm text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {filteredTransactions.length} items
                    </span>
                    <input 
                        type="text" 
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="hidden sm:block w-full md:w-48 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Collapsible Filter Button */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`flex items-center gap-2 px-3 py-2 font-medium rounded-lg border transition-all ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <SortIcon className="w-4 h-4"/>
                        <span>Filters</span>
                        {(selectedCategories.size > 0 || selectedTypes.size > 0 || selectedAccounts.size > 0 || selectedUsers.size > 0 || selectedPayees.size > 0) && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        )}
                    </button>

                    <div className="relative" ref={columnMenuRef}>
                        <button onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="flex items-center gap-2 px-3 py-2 text-slate-600 font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
                            <EyeIcon className="w-4 h-4"/>
                            <span className="hidden sm:inline">Cols</span>
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

                    <div className="relative" ref={exportMenuRef}>
                        <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-3 py-2 text-slate-600 font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
                            <DownloadIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                                <div className="p-1">
                                    <button onClick={handleExportCSV} className="flex w-full items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md text-left">
                                        <span className="mr-2">📄</span> CSV
                                    </button>
                                    <button onClick={handlePrint} className="flex w-full items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md text-left">
                                        <PrinterIcon className="w-4 h-4 mr-2 text-slate-500" /> Print / PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button onClick={handleSaveView} className="flex items-center gap-2 px-3 py-2 text-slate-600 font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" title="Save current view as a report">
                        <ChartPieIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Save View</span>
                    </button>
                    
                    <button 
                        onClick={() => setIsDonationModalOpen(true)}
                        className="group flex items-center gap-2 px-3 py-2 text-pink-600 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 transition-all overflow-hidden w-10 hover:w-48 whitespace-nowrap"
                        title="Calculate Donations"
                    >
                        <HeartIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">Calculate Donations</span>
                    </button>

                    <button onClick={() => setIsVerifyModalOpen(true)} className="flex items-center gap-2 px-3 py-2 text-teal-700 font-medium bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100">
                        <ShieldCheckIcon className="w-4 h-4"/>
                        <span className="hidden sm:inline">Verify</span>
                    </button>

                    <button onClick={() => setIsAuditorOpen(true)} disabled={!hasApiKey()} className="flex items-center gap-2 px-3 py-2 text-indigo-700 font-medium bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        <RobotIcon className="w-4 h-4"/>
                        <span className="hidden sm:inline">Audit</span>
                    </button>
                    
                    <button onClick={handleAddNew} className="flex items-center gap-2 px-4 py-2 text-white font-medium bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700">
                        <AddIcon className="w-4 h-4"/>
                        <span className="hidden sm:inline">Add</span>
                    </button>
                </div>
            </div>

            {/* Collapsible Filter Drawer */}
            {showFilters && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-slide-down print:hidden">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 flex-grow relative z-20">
                            <MultiSelect 
                                label="Categories" 
                                options={categories} 
                                selectedIds={selectedCategories} 
                                onChange={setSelectedCategories} 
                            />
                            <MultiSelect 
                                label="Types" 
                                options={transactionTypes} 
                                selectedIds={selectedTypes} 
                                onChange={setSelectedTypes} 
                            />
                            <MultiSelect 
                                label="Accounts" 
                                options={accounts} 
                                selectedIds={selectedAccounts} 
                                onChange={setSelectedAccounts} 
                            />
                            <MultiSelect 
                                label="Users" 
                                options={users} 
                                selectedIds={selectedUsers} 
                                onChange={setSelectedUsers} 
                            />
                            <MultiSelect 
                                label="Payees" 
                                options={payees} 
                                selectedIds={selectedPayees} 
                                onChange={setSelectedPayees} 
                            />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center border-l pl-4 border-slate-200 relative z-10">
                            
                            <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                <select 
                                    value={dateMode} 
                                    onChange={(e) => setDateMode(e.target.value as DateMode)}
                                    className="bg-transparent border-none text-xs font-semibold focus:ring-0 cursor-pointer py-1 pl-2 pr-6"
                                >
                                    <option value="month">Month</option>
                                    <option value="quarter">Quarter</option>
                                    <option value="year">Year</option>
                                    <option value="all">Lifetime</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>

                            {dateMode === 'custom' ? (
                                <div className="flex items-center gap-2">
                                    <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setDateMode('custom'); }} className="p-1.5 border rounded-md text-xs w-32" />
                                    <span className="text-slate-400">-</span>
                                    <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setDateMode('custom'); }} className="p-1.5 border rounded-md text-xs w-32" />
                                </div>
                            ) : (
                                <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden">
                                    {dateMode !== 'all' && (
                                        <button onClick={() => handleDateNavigate('prev')} className="p-1.5 hover:bg-slate-100 text-slate-500">
                                            <ChevronLeftIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <span className={`px-3 text-sm font-medium text-slate-700 min-w-[120px] text-center ${dateMode === 'all' ? 'py-1.5' : ''}`}>
                                        {dateLabel}
                                    </span>
                                    {dateMode !== 'all' && (
                                        <button onClick={() => handleDateNavigate('next')} className="p-1.5 hover:bg-slate-100 text-slate-500">
                                            <ChevronRightIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )}

                            <button onClick={clearFilters} className="text-xs text-red-500 hover:underline px-2">Clear</button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden relative z-0">
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
            onSplit={handleSplitTransaction}
          />
        </div>
      </div>
      
      {selectedTxIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-slide-up print:hidden">
            <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                <span className="font-medium text-sm">{selectedTxIds.size} selected</span>
                <button onClick={() => setSelectedTxIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800">
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="flex items-center gap-2">
                 <button
                    onClick={() => setIsBulkUserModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-50 rounded-full transition-colors shadow-sm"
                >
                    <UserGroupIcon className="w-4 h-4"/>
                    User
                </button>
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
      {isSplitModalOpen && (
          <SplitTransactionModal 
            isOpen={isSplitModalOpen}
            onClose={() => setIsSplitModalOpen(false)}
            transaction={transactionToSplit}
            categories={categories}
            transactionTypes={transactionTypes}
            onSplit={handleSaveSplit}
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
      {isBulkUserModalOpen && (
          <BulkUserModal 
            isOpen={isBulkUserModalOpen}
            onClose={() => setIsBulkUserModalOpen(false)}
            users={users}
            onApply={handleBulkAssignUser}
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
            onSaveTag={onSaveTag}
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
      {isVerifyModalOpen && (
          <VerifyModal 
            isOpen={isVerifyModalOpen}
            onClose={() => setIsVerifyModalOpen(false)}
            currentTransactions={filteredTransactions}
            transactionTypes={transactionTypes}
          />
      )}
      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        onSave={onAddTransaction}
        totalIncome={summaries.income}
        monthName={dateLabel}
        payees={payees}
        accounts={accounts}
        categories={categories}
        transactionTypes={transactionTypes}
        initialDate={endDate}
      />
    </>
  );
};

export default AllTransactions;
