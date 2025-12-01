
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User, Tag } from '../types';
import { SortIcon, NotesIcon, DeleteIcon, LinkIcon, SparklesIcon, InfoIcon, ChevronRightIcon, ChevronLeftIcon, ChevronDownIcon } from './Icons';

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  payees: Payee[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onCreateRule?: (transaction: Transaction) => void;
  showCheckboxes?: boolean;
  selectedTxIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onBulkSelection?: (ids: string[], selected: boolean) => void;
  deleteConfirmationMessage?: string;
  visibleColumns?: Set<string>;
  onManageLink?: (groupId: string) => void;
}

type SortKey = keyof Transaction | 'payeeId' | 'categoryId' | 'accountId' | 'userId' | 'typeId' | '';
type SortDirection = 'asc' | 'desc';

// Group Item interface for rendering logic
interface GroupItem {
    type: 'group';
    id: string; // The linkGroupId
    primaryTx: Transaction;
    children: Transaction[];
    totalAmount: number;
}

interface SingleItem {
    type: 'single';
    tx: Transaction;
}

type DisplayItem = GroupItem | SingleItem;

const generateGroupColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Specific tailored palette for link icons (avoiding too light colors)
    const colors = [
        'text-red-500', 'text-orange-500', 'text-amber-600', 'text-yellow-600', 
        'text-lime-600', 'text-green-600', 'text-emerald-600', 'text-teal-600', 
        'text-cyan-600', 'text-sky-600', 'text-blue-600', 'text-indigo-600', 
        'text-violet-600', 'text-purple-600', 'text-fuchsia-600', 'text-pink-600', 
        'text-rose-600'
    ];
    return colors[Math.abs(hash) % colors.length];
};

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  accounts, 
  categories,
  tags,
  transactionTypes,
  payees,
  users,
  onUpdateTransaction, 
  onDeleteTransaction,
  onCreateRule,
  showCheckboxes = false,
  selectedTxIds = new Set(),
  onToggleSelection = (_id) => {},
  onToggleSelectAll = () => {},
  onBulkSelection,
  deleteConfirmationMessage = 'Are you sure you want to delete this transaction? This action cannot be undone.',
  visibleColumns = new Set(['date', 'description', 'payee', 'category', 'tags', 'account', 'type', 'amount', 'actions']),
  onManageLink
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof Transaction } | null>(null);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p])), [payees]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
  const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

  const sortedPayeeOptions = useMemo(() => {
    const sorted: { id: string, name: string }[] = [];
    const parents = payees.filter(p => !p.parentId).sort((a, b) => a.name.localeCompare(b.name));
    parents.forEach(parent => {
      sorted.push({ id: parent.id, name: parent.name });
      const children = payees.filter(p => p.parentId === parent.id).sort((a, b) => a.name.localeCompare(b.name));
      children.forEach(child => {
        sorted.push({ id: child.id, name: `  - ${child.name}` });
      });
    });
    return sorted;
  }, [payees]);

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

  // 1. First, sort the flat list of transactions
  const sortedTransactions = useMemo(() => {
    if (!sortKey) return transactions;
    
    const sorted = [...transactions].sort((a, b) => {
      let aValue: any = a[sortKey as keyof Transaction];
      let bValue: any = b[sortKey as keyof Transaction];

      if (sortKey === 'payeeId') {
          aValue = payeeMap.get(a.payeeId || '')?.name || '';
          bValue = payeeMap.get(b.payeeId || '')?.name || '';
      } else if (sortKey === 'categoryId') {
          aValue = categoryMap.get(a.categoryId)?.name || '';
          bValue = categoryMap.get(b.categoryId)?.name || '';
      } else if (sortKey === 'accountId') {
          aValue = accountMap.get(a.accountId || '')?.name || '';
          bValue = accountMap.get(b.accountId || '')?.name || '';
      } else if (sortKey === 'userId') {
          aValue = userMap.get(a.userId || '') || '';
          bValue = userMap.get(b.userId || '') || '';
      } else if (sortKey === 'typeId') {
          aValue = transactionTypeMap.get(a.typeId)?.name || '';
          bValue = transactionTypeMap.get(b.typeId)?.name || '';
      }

      if (aValue === undefined || aValue === null) aValue = '';
      if (bValue === undefined || bValue === null) bValue = '';
      
      if (sortKey === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return bValue - aValue;
      }
      
      if (String(aValue).toLowerCase() < String(bValue).toLowerCase()) return -1;
      if (String(aValue).toLowerCase() > String(bValue).toLowerCase()) return 1;
      
      return 0;
    });

    return sortDirection === 'asc' ? sorted.reverse() : sorted;
  }, [transactions, sortKey, sortDirection, payeeMap, categoryMap, accountMap, userMap, transactionTypeMap]);

  // 2. Then group them for display
  const displayItems = useMemo(() => {
      const items: DisplayItem[] = [];
      const processedGroupIds = new Set<string>();

      for (const tx of sortedTransactions) {
          const groupId = tx.linkGroupId; // Ignoring legacy linkedTransactionId for grouping to simplify logic, only using new system
          
          if (groupId) {
              if (processedGroupIds.has(groupId)) continue; // Already processed this group

              // Find all siblings
              const children = transactions.filter(t => t.linkGroupId === groupId);
              
              // Heuristic: Find the "Primary" transaction (usually the Transfer source/largest amount)
              // If all are equal, pick the first one in the sorted list.
              const primaryTx = children.reduce((prev, current) => (Math.abs(current.amount) > Math.abs(prev.amount) ? current : prev), children[0]);
              
              items.push({
                  type: 'group',
                  id: groupId,
                  primaryTx,
                  children: children.filter(c => c.id !== primaryTx.id), // Children to show when expanded (excluding primary which is header)
                  totalAmount: primaryTx.amount 
              });
              processedGroupIds.add(groupId);
          } else {
              items.push({ type: 'single', tx });
          }
      }
      return items;
  }, [sortedTransactions, transactions]);

  // Reset pagination when data changes
  useEffect(() => {
      setCurrentPage(1);
  }, [displayItems.length]);

  // 3. Paginate
  const totalPages = Math.ceil(displayItems.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentItems = displayItems.slice(startIndex, endIndex);
  
  const handleUpdate = (transaction: Transaction, field: keyof Transaction, value: any) => {
    let updatedValue = value;
    if (field === 'amount') {
      updatedValue = parseFloat(value) || 0;
    }
    if (transaction[field] === updatedValue) {
        setEditingCell(null);
        return;
    }
    const updatedTransaction = { ...transaction, [field]: updatedValue };
    onUpdateTransaction(updatedTransaction);
    setEditingCell(null);
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>, transaction: Transaction, field: keyof Transaction) => {
    handleUpdate(transaction, field, e.currentTarget.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, transaction: Transaction, field: keyof Transaction) => {
    if (e.key === 'Enter') {
      handleUpdate(transaction, field, e.currentTarget.value);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const requestSort = (key: SortKey) => {
    setSortDirection(prevDirection => (sortKey === key && prevDirection === 'desc' ? 'asc' : 'desc'));
    setSortKey(key);
  };
  
  const handleDelete = (e: React.MouseEvent, transactionId: string) => {
      e.stopPropagation();
      if (window.confirm(deleteConfirmationMessage)) {
          onDeleteTransaction(transactionId);
      }
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
      // Stop propagation to prevent row click
      e.stopPropagation();
      
      const nativeEvent = e.nativeEvent as any;
      const isShiftKey = nativeEvent && nativeEvent.shiftKey;
      
      const willSelect = e.target.checked;

      if (isShiftKey && lastClickedId && onBulkSelection) {
          // Find index in the CURRENT VIEW (sortedTransactions), not just current page
          const start = sortedTransactions.findIndex(t => t.id === lastClickedId);
          const end = sortedTransactions.findIndex(t => t.id === id);

          if (start !== -1 && end !== -1) {
              const low = Math.min(start, end);
              const high = Math.max(start, end);
              const rangeIds = sortedTransactions.slice(low, high + 1).map(t => t.id);
              onBulkSelection(rangeIds, willSelect);
              setLastClickedId(id);
              return;
          }
      }

      onToggleSelection(id);
      setLastClickedId(id);
  };

  const handleGroupSelection = (e: React.ChangeEvent<HTMLInputElement>, group: GroupItem) => {
      e.stopPropagation();
      if (!onBulkSelection) return;
      
      const allIds = [group.primaryTx.id, ...group.children.map(c => c.id)];
      // Toggle all based on the new checked state of the checkbox
      onBulkSelection(allIds, e.target.checked);
  };

  const toggleGroup = (groupId: string) => {
      setExpandedGroups(prev => {
          const newSet = new Set(prev);
          if (newSet.has(groupId)) newSet.delete(groupId);
          else newSet.add(groupId);
          return newSet;
      });
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <SortIcon className="w-4 h-4 text-slate-300 invisible group-hover:visible" />;
    return sortDirection === 'desc' ? ' ▼' : ' ▲';
  };

  if (transactions.length === 0) {
    return <p className="text-center text-slate-500 py-8">No transactions match the current filters.</p>;
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getCategoryColor = (categoryName: string) => {
    const colors: {[key: string]: string} = {
      'Groceries': 'bg-green-100 text-green-800',
      'Dining': 'bg-orange-100 text-orange-800',
      'Shopping': 'bg-blue-100 text-blue-800',
      'Travel': 'bg-purple-100 text-purple-800',
      'Entertainment': 'bg-pink-100 text-pink-800',
      'Utilities': 'bg-yellow-100 text-yellow-800',
      'Health': 'bg-red-100 text-red-800',
      'Services': 'bg-indigo-100 text-indigo-800',
      'Transportation': 'bg-cyan-100 text-cyan-800',
      'Income': 'bg-emerald-100 text-emerald-800',
      'Other': 'bg-slate-100 text-slate-800'
    };
    return colors[categoryName] || 'bg-slate-100 text-slate-800';
  };

  const getAmountColor = (typeId: string) => {
      const type = transactionTypeMap.get(typeId);
      if (type?.balanceEffect === 'expense') return 'text-red-600';
      if (type?.balanceEffect === 'investment') return 'text-purple-600';
      if (type?.balanceEffect === 'donation') return 'text-blue-600'; // Donations are Blue
      if (type?.balanceEffect === 'income') return 'text-green-600';
      return 'text-slate-600'; // Transfer
  };

  const getAmountPrefix = (typeId: string) => {
      const type = transactionTypeMap.get(typeId);
      if (type?.balanceEffect === 'expense' || type?.balanceEffect === 'investment' || type?.balanceEffect === 'donation') return '-';
      if (type?.balanceEffect === 'income') return '+';
      return '';
  };

  // Note: sticky z-indices are set in index.css to ensure proper layering
  // If check boxes are shown, we offset the Date column by 2.5rem (w-10)
  const dateColumnStyle = showCheckboxes ? { left: '2.5rem' } : {};

  const renderHeader = (label: string, key: SortKey, className: string = "", style: React.CSSProperties = {}) => (
    <th scope="col" style={style} className={`px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 ${className}`}>
      <button onClick={() => requestSort(key)} className="group flex items-center gap-1 w-full focus:outline-none hover:text-slate-700">
        {label}
        <span className="text-indigo-600">{getSortIndicator(key)}</span>
      </button>
    </th>
  );
  
  const commonInputClass = "w-full p-1 text-xs rounded-md border-indigo-500 ring-1 ring-indigo-500 focus:outline-none shadow-sm";
  const cellClass = (isEditable = false) => `px-3 py-2 whitespace-nowrap text-sm text-slate-600 ${isEditable ? 'cursor-pointer hover:text-indigo-600 hover:bg-slate-50' : ''}`;

  // Helper to render a single transaction row
  const renderRow = (transaction: Transaction, isChild: boolean = false, groupData?: GroupItem) => {
        const type = transactionTypeMap.get(transaction.typeId);
        const category = categoryMap.get(transaction.categoryId);
        const categoryName = category?.name || 'Uncategorized';
        
        const amountColor = getAmountColor(transaction.typeId);
        const amountPrefix = getAmountPrefix(transaction.typeId);
        
        const isSelected = selectedTxIds.has(transaction.id);
        
        // For single items (not part of group logic)
        const linkGroupId = transaction.linkGroupId || transaction.linkedTransactionId;
        const isLinkedLegacy = !!linkGroupId && !groupData; 

        let stickyBgClass = 'bg-white group-hover:bg-slate-50';
        if (isSelected) {
            stickyBgClass = 'bg-indigo-50';
        } else if (isChild) {
            stickyBgClass = 'bg-slate-50/50'; 
        } else if (isLinkedLegacy) {
            stickyBgClass = 'bg-sky-50';
        }

        return (
            <tr 
                key={transaction.id} 
                className={`transition-colors group ${stickyBgClass}`}
            >
              {showCheckboxes && (
                  <td className={`w-10 px-3 py-2 whitespace-nowrap sticky left-0 z-50 border-r border-transparent ${stickyBgClass}`}>
                      <div className={isChild ? "pl-4 border-l-2 border-slate-300" : ""}>
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-auto"
                            checked={isSelected}
                            onChange={(e) => handleSelectionChange(e, transaction.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select transaction ${transaction.description}`}
                        />
                      </div>
                  </td>
              )}
              
              {/* Date */}
              {visibleColumns.has('date') && (
                  <td style={dateColumnStyle} className={`sticky-col-left ${cellClass(true)} ${stickyBgClass} z-20`}>
                    {editingCell?.id === transaction.id && editingCell.field === 'date' ? (
                        <input type="date" defaultValue={transaction.date} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'date')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'date')} className={commonInputClass} />
                    ) : (
                        <div onClick={() => setEditingCell({ id: transaction.id, field: 'date' })} className={isChild ? "pl-4" : ""}>{transaction.date}</div>
                    )}
                  </td>
              )}

              {/* Description */}
              {visibleColumns.has('description') && (
                  <td className="px-3 py-2 text-sm font-medium text-slate-900 w-64 min-w-[200px] max-w-xs relative">
                    <div className={`flex items-center gap-2 w-full ${isChild ? 'pl-4' : ''}`}>
                        {/* Icons */}
                        {isLinkedLegacy && (
                            <button 
                                title={`Linked Transaction Group`} 
                                onClick={(e) => { e.stopPropagation(); linkGroupId && onManageLink && onManageLink(linkGroupId); }} 
                                className="cursor-pointer hover:scale-110 transition-transform p-1 hover:bg-sky-100 rounded flex-shrink-0"
                            >
                                <LinkIcon className={`w-3 h-3 ${generateGroupColor(linkGroupId!)}`} />
                            </button>
                        )}
                        {transaction.notes && <span title={transaction.notes} className="flex-shrink-0"><NotesIcon className="w-3 h-3 text-indigo-500" /></span>}
                        
                        {/* Input or Text */}
                        {editingCell?.id === transaction.id && editingCell.field === 'description' ? (
                            <input type="text" defaultValue={transaction.description} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'description')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'description')} className={commonInputClass} />
                        ) : (
                            <div className="flex items-center gap-1.5 w-full min-w-0">
                                <span onClick={() => setEditingCell({ id: transaction.id, field: 'description' })} className="truncate block cursor-pointer hover:text-indigo-600" title={transaction.description}>{transaction.description}</span>
                                
                                {transaction.originalDescription && transaction.originalDescription !== transaction.description && (
                                    <div className="group/tooltip relative flex items-center flex-shrink-0">
                                        <button 
                                            className="focus:outline-none" 
                                            title={`Original: ${transaction.originalDescription}`}
                                            onClick={(e) => { e.stopPropagation(); alert(`Original Description: ${transaction.originalDescription}`); }}
                                        >
                                            <InfoIcon className="w-3 h-3 text-slate-400 cursor-help hover:text-indigo-500" />
                                        </button>
                                        {/* Custom Tooltip */}
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden w-max max-w-[250px] p-2 bg-slate-800 text-white text-xs rounded shadow-lg group-hover/tooltip:block z-50 whitespace-normal text-center pointer-events-none">
                                            Original: {transaction.originalDescription}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  </td>
              )}

              {/* Payee */}
              {visibleColumns.has('payee') && (
                  <td className={cellClass(true)}>
                    {editingCell?.id === transaction.id && editingCell.field === 'payeeId' ? (
                        <select defaultValue={transaction.payeeId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'payeeId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'payeeId')} className={commonInputClass}>
                            <option value="">-- No Payee --</option>
                            {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => setEditingCell({ id: transaction.id, field: 'payeeId' })} className="truncate max-w-[180px]" title={payeeMap.get(transaction.payeeId || '')?.name}>{payeeMap.get(transaction.payeeId || '')?.name || <span className="text-slate-400 italic">None</span>}</div>
                    )}
                  </td>
              )}

              {/* Category */}
              {visibleColumns.has('category') && (
                   <td className={cellClass(true)}>
                     {editingCell?.id === transaction.id && editingCell.field === 'categoryId' ? (
                        <select defaultValue={transaction.categoryId} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'categoryId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'categoryId')} className={commonInputClass}>
                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => setEditingCell({ id: transaction.id, field: 'categoryId' })}>
                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full truncate max-w-[140px] ${getCategoryColor(categoryName)}`}>
                                {categoryName}
                            </span>
                        </div>
                    )}
                  </td>
              )}

              {/* Tags */}
              {visibleColumns.has('tags') && (
                  <td className={cellClass(false)}>
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {transaction.tagIds && transaction.tagIds.length > 0 ? (
                              transaction.tagIds.map(tagId => {
                                  const tag = tagMap.get(tagId);
                                  if (!tag) return null;
                                  return (
                                      <span key={tagId} className={`px-1.5 py-0.5 text-[10px] rounded-full border ${tag.color}`}>
                                          {tag.name}
                                      </span>
                                  );
                              })
                          ) : (
                              <span className="text-slate-300 text-xs italic">--</span>
                          )}
                      </div>
                  </td>
              )}

              {/* Account */}
              {visibleColumns.has('account') && (
                  <td className={cellClass(true)}>
                      {editingCell?.id === transaction.id && editingCell.field === 'accountId' ? (
                        <select defaultValue={transaction.accountId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'accountId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'accountId')} className={commonInputClass}>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    ) : (
                      <div onClick={() => setEditingCell({ id: transaction.id, field: 'accountId' })} className="truncate max-w-[150px]" title={accountMap.get(transaction.accountId || '')?.name}>{accountMap.get(transaction.accountId || '')?.name || 'N/A'}</div>
                    )}
                  </td>
              )}

              {/* Location */}
              {visibleColumns.has('location') && (
                  <td className={cellClass(true)}>
                    {editingCell?.id === transaction.id && editingCell.field === 'location' ? (
                        <input type="text" defaultValue={transaction.location || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'location')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'location')} className={commonInputClass} />
                    ) : (
                        <div onClick={() => setEditingCell({ id: transaction.id, field: 'location' })} className="truncate max-w-[150px]">{transaction.location || ''}</div>
                    )}
                  </td>
              )}

              {/* User */}
              {visibleColumns.has('user') && (
                  <td className={cellClass(true)}>
                     {editingCell?.id === transaction.id && editingCell.field === 'userId' ? (
                        <select defaultValue={transaction.userId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'userId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'userId')} className={commonInputClass}>
                            <option value="">-- No User --</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => setEditingCell({ id: transaction.id, field: 'userId' })} className="truncate max-w-[120px]">{userMap.get(transaction.userId || '') || 'N/A'}</div>
                    )}
                  </td>
              )}

              {/* Type */}
              {visibleColumns.has('type') && (
                  <td className={cellClass(true)}>
                    {editingCell?.id === transaction.id && editingCell.field === 'typeId' ? (
                        <select defaultValue={transaction.typeId} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'typeId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'typeId')} className={commonInputClass}>
                            {transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => setEditingCell({ id: transaction.id, field: 'typeId' })} className="truncate max-w-[120px] capitalize">{type?.name || 'N/A'}</div>
                    )}
                  </td>
              )}

              {/* Amount */}
              {visibleColumns.has('amount') && (
                  <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium pr-8 min-w-[120px]`}>
                     {editingCell?.id === transaction.id && editingCell.field === 'amount' ? (
                        <input type="number" step="0.01" defaultValue={transaction.amount} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'amount')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'amount')} className={`${commonInputClass} text-right font-mono`} />
                    ) : (
                        <div onClick={() => setEditingCell({ id: transaction.id, field: 'amount' })} className={`cursor-pointer hover:opacity-75 tabular-nums font-mono font-bold ${amountColor}`}>
                            {amountPrefix}{formatCurrency(Math.abs(transaction.amount))}
                        </div>
                    )}
                  </td>
              )}

              {/* Actions */}
              {visibleColumns.has('actions') && (
                  <td className={`px-3 py-2 whitespace-nowrap text-center text-sm font-medium sticky-col-right ${stickyBgClass} z-20`}>
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         {onCreateRule && (
                            <button onClick={(e) => { e.stopPropagation(); onCreateRule(transaction); }} className="text-slate-400 hover:text-indigo-600 p-1" title="Create Rule">
                                <SparklesIcon className="w-4 h-4" />
                            </button>
                         )}
                         <button onClick={(e) => handleDelete(e, transaction.id)} className="text-slate-400 hover:text-red-600 p-1" title="Delete">
                            <DeleteIcon className="w-4 h-4" />
                        </button>
                      </div>
                  </td>
              )}
            </tr>
        );
  };

  // Helper to render a Group Header row
  const renderGroupHeader = (group: GroupItem) => {
      const isExpanded = expandedGroups.has(group.id);
      const allChildIds = [group.primaryTx.id, ...group.children.map(c => c.id)];
      const isFullySelected = allChildIds.every(id => selectedTxIds.has(id));
      
      const primaryTx = group.primaryTx;
      const type = transactionTypeMap.get(primaryTx.typeId);
      
      const amountColor = getAmountColor(primaryTx.typeId);
      const amountPrefix = getAmountPrefix(primaryTx.typeId);

      return (
          <tr 
            key={group.id} 
            className={`bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border-b border-slate-200 group`}
            onClick={() => toggleGroup(group.id)}
          >
              {showCheckboxes && (
                  <td className="w-10 px-3 py-2 whitespace-nowrap sticky left-0 z-50 border-r border-transparent bg-slate-100">
                      <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-auto"
                          checked={isFullySelected}
                          onChange={(e) => handleGroupSelection(e, group)}
                          onClick={(e) => e.stopPropagation()}
                      />
                  </td>
              )}
              
              {visibleColumns.has('date') && (
                  <td style={dateColumnStyle} className="sticky-col-left px-3 py-2 whitespace-nowrap text-sm text-slate-600 bg-slate-100 z-20">
                      <div className="flex items-center gap-1">
                        {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-indigo-500" /> : <ChevronRightIcon className="w-4 h-4 text-slate-400" />}
                        {primaryTx.date}
                      </div>
                  </td>
              )}

              {visibleColumns.has('description') && (
                  <td className="px-3 py-2 text-sm font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                          <LinkIcon className={`w-3 h-3 ${generateGroupColor(group.id)}`} />
                          <span className="truncate">{primaryTx.description} (and {group.children.length} others)</span>
                      </div>
                  </td>
              )}

              {visibleColumns.has('payee') && <td className="px-3 py-2 text-sm text-slate-500 italic">Multiple</td>}
              {visibleColumns.has('category') && <td className="px-3 py-2 text-sm text-slate-500 italic">Split / Multiple</td>}
              {visibleColumns.has('tags') && <td className="px-3 py-2 text-sm text-slate-500">--</td>}
              {visibleColumns.has('account') && <td className="px-3 py-2 text-sm text-slate-500">{accountMap.get(primaryTx.accountId || '')?.name}</td>}
              {visibleColumns.has('location') && <td className="px-3 py-2 text-sm text-slate-500">--</td>}
              {visibleColumns.has('user') && <td className="px-3 py-2 text-sm text-slate-500">--</td>}
              
              {visibleColumns.has('type') && (
                  <td className="px-3 py-2 text-sm text-slate-600">{type?.name || 'Mix'}</td>
              )}

              {visibleColumns.has('amount') && (
                  <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-bold pr-8 tabular-nums font-mono ${amountColor}`}>
                      {amountPrefix}{formatCurrency(Math.abs(primaryTx.amount))}
                  </td>
              )}

              {visibleColumns.has('actions') && (
                  <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-medium sticky-col-right bg-slate-100 z-20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onManageLink && onManageLink(group.id); }} 
                        className="text-indigo-600 hover:text-indigo-800 p-1"
                        title="Manage Linked Group"
                      >
                          <LinkIcon className="w-4 h-4" />
                      </button>
                  </td>
              )}
          </tr>
      );
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0">
        <div className="overflow-x-auto overflow-y-auto flex-grow w-full max-w-full">
        <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-30 shadow-sm">
            <tr>
                {showCheckboxes && (
                <th scope="col" className="w-10 px-3 py-3 bg-slate-50 sticky top-0 left-0 z-50 border-b border-slate-200">
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-auto"
                        checked={transactions.length > 0 && selectedTxIds.size === transactions.length}
                        onChange={onToggleSelectAll}
                        aria-label="Select all transactions"
                    />
                </th>
                )}
                {visibleColumns.has('date') && renderHeader('Date', 'date', 'sticky-col-left top-0 w-32 z-40', dateColumnStyle)}
                {visibleColumns.has('description') && renderHeader('Description', 'description', 'w-64 min-w-[200px] max-w-xs')}
                {visibleColumns.has('payee') && renderHeader('Payee', 'payeeId', 'w-48')}
                {visibleColumns.has('category') && renderHeader('Category', 'categoryId', 'w-40')}
                {visibleColumns.has('tags') && <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 w-32">Tags</th>}
                {visibleColumns.has('account') && renderHeader('Account', 'accountId', 'w-40')}
                {visibleColumns.has('location') && renderHeader('Location', 'location', 'w-32')}
                {visibleColumns.has('user') && renderHeader('User', 'userId', 'w-32')}
                {visibleColumns.has('type') && renderHeader('Type', 'typeId', 'w-32')}
                {visibleColumns.has('amount') && (
                    <th scope="col" className="w-32 px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-30 border-b border-slate-200 pr-8">
                    <button onClick={() => requestSort('amount')} className="group flex items-center justify-end gap-1 w-full focus:outline-none hover:text-slate-700">
                        Amount
                        <span className="text-indigo-600">{getSortIndicator('amount')}</span>
                    </button>
                    </th>
                )}
                {visibleColumns.has('actions') && (
                    <th scope="col" className="w-20 px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 sticky-col-right top-0 z-40 border-b border-slate-200">
                        Action
                    </th>
                )}
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
            {currentItems.map((item) => {
                if (item.type === 'group') {
                    return (
                        <React.Fragment key={item.id}>
                            {renderGroupHeader(item)}
                            {expandedGroups.has(item.id) && (
                                <>
                                    {renderRow(item.primaryTx, true, item)}
                                    {item.children.map(child => renderRow(child, true, item))}
                                </>
                            )}
                        </React.Fragment>
                    );
                } else {
                    return renderRow(item.tx);
                }
            })}
            </tbody>
        </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="border-t border-slate-200 p-3 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3 sticky bottom-0 z-30 w-full min-w-0">
                <div className="flex items-center text-sm text-slate-600">
                    <span className="mr-2 hidden sm:inline">Rows per page:</span>
                    <select 
                        value={rowsPerPage} 
                        onChange={(e) => {
                            setRowsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="p-1 border rounded text-xs bg-white focus:ring-indigo-500 w-16"
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={displayItems.length}>All</option>
                    </select>
                    <span className="mx-4 text-slate-400 hidden sm:inline">|</span>
                    <span className="hidden sm:inline">
                        {startIndex + 1}-{Math.min(endIndex, displayItems.length)} of {displayItems.length}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
                    </button>
                    <span className="text-sm font-medium text-slate-700 min-w-[3rem] text-center">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronRightIcon className="w-5 h-5 text-slate-600" />
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default TransactionTable;
