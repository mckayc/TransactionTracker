
import React, { useState, useMemo } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User } from '../types';
import { SortIcon, NotesIcon, DeleteIcon, LinkIcon, SparklesIcon, InfoIcon } from './Icons';

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  transactionTypes: TransactionType[];
  payees: Payee[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onCreateRule?: (transaction: Transaction) => void;
  isSelectionMode?: boolean;
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

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  accounts, 
  categories,
  transactionTypes,
  payees,
  users,
  onUpdateTransaction, 
  onDeleteTransaction,
  onCreateRule,
  isSelectionMode = false,
  selectedTxIds = new Set(),
  onToggleSelection = (_id) => {},
  onToggleSelectAll = () => {},
  onBulkSelection,
  deleteConfirmationMessage = 'Are you sure you want to delete this transaction? This action cannot be undone.',
  visibleColumns = new Set(['date', 'description', 'payee', 'category', 'account', 'type', 'amount', 'actions']),
  onManageLink
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof Transaction } | null>(null);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p])), [payees]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);

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

  const sortedTransactions = useMemo(() => {
    if (!sortKey) return transactions;
    
    const sorted = [...transactions].sort((a, b) => {
      let aValue: any = a[sortKey as keyof Transaction];
      let bValue: any = b[sortKey as keyof Transaction];

      // Handle resolved values for IDs
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

  const handleSelectionClick = (e: React.MouseEvent<HTMLInputElement>, id: string) => {
      e.stopPropagation();
      
      // Determine intended state: if currently checked, we are unchecking.
      // Logic: The user clicked the checkbox to toggle it.
      const willSelect = !selectedTxIds.has(id);

      if (e.shiftKey && lastClickedId && onBulkSelection) {
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

  // Note: sticky z-indices are set in index.css to ensure proper layering
  const renderHeader = (label: string, key: SortKey, className: string = "") => (
    <th scope="col" className={`px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 ${className}`}>
      <button onClick={() => requestSort(key)} className="group flex items-center gap-1 w-full focus:outline-none hover:text-slate-700">
        {label}
        <span className="text-indigo-600">{getSortIndicator(key)}</span>
      </button>
    </th>
  );
  
  const commonInputClass = "w-full p-1 text-xs rounded-md border-indigo-500 ring-1 ring-indigo-500 focus:outline-none shadow-sm";
  const cellClass = (isEditable = false) => `px-3 py-2 whitespace-nowrap text-sm text-slate-600 ${isEditable ? 'cursor-pointer hover:text-indigo-600 hover:bg-slate-50' : ''}`;

  return (
    <div className="overflow-auto h-full w-full">
      <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
        <thead className="bg-slate-50 sticky top-0 z-30 shadow-sm">
          <tr>
            {isSelectionMode && (
              <th scope="col" className="w-10 px-3 py-3 bg-slate-50 sticky top-0 left-0 z-40 border-b border-slate-200">
                  <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={transactions.length > 0 && selectedTxIds.size === transactions.length}
                      onChange={onToggleSelectAll}
                      aria-label="Select all transactions"
                  />
              </th>
            )}
            {visibleColumns.has('date') && renderHeader('Date', 'date', 'sticky-col-left top-0 w-32 z-40')}
            {visibleColumns.has('description') && renderHeader('Description', 'description', 'w-64 min-w-[200px] max-w-xs')}
            {visibleColumns.has('payee') && renderHeader('Payee', 'payeeId', 'w-48')}
            {visibleColumns.has('category') && renderHeader('Category', 'categoryId', 'w-40')}
            {visibleColumns.has('account') && renderHeader('Account', 'accountId', 'w-40')}
            {visibleColumns.has('location') && renderHeader('Location', 'location', 'w-32')}
            {visibleColumns.has('user') && renderHeader('User', 'userId', 'w-32')}
            {visibleColumns.has('type') && renderHeader('Type', 'typeId', 'w-32')}
            {visibleColumns.has('amount') && (
                <th scope="col" className="w-32 px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-30 border-b border-slate-200">
                <button onClick={() => requestSort('amount')} className="group flex items-center gap-1 float-right focus:outline-none hover:text-slate-700">
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
          {sortedTransactions.map((transaction) => {
            const type = transactionTypeMap.get(transaction.typeId);
            const category = categoryMap.get(transaction.categoryId);
            const categoryName = category?.name || 'Uncategorized';
            const isNegative = type?.balanceEffect === 'expense';
            const amountColor = isNegative ? 'text-red-600' : (type?.balanceEffect === 'transfer' ? 'text-slate-600' : 'text-green-600');
            const amountPrefix = isNegative ? '-' : (type?.balanceEffect === 'transfer' ? '' : '+');
            const isSelected = isSelectionMode && selectedTxIds.has(transaction.id);
            const isLinked = transaction.linkGroupId || transaction.linkedTransactionId;
            
            const stickyBgClass = isSelected 
                ? 'bg-indigo-50' 
                : isLinked
                    ? 'bg-sky-50' 
                    : 'bg-white group-hover:bg-slate-50';

            return (
            <tr key={transaction.id} className={`transition-colors group ${isSelected ? 'bg-indigo-50' : isLinked ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
              {isSelectionMode && (
                  <td className={`px-3 py-2 whitespace-nowrap sticky left-0 z-20 border-r border-transparent ${stickyBgClass}`}>
                      <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={isSelected}
                          onClick={(e) => handleSelectionClick(e, transaction.id)}
                          onChange={() => {}} // Logic handled in onClick to support modifiers better
                          aria-label={`Select transaction ${transaction.description}`}
                      />
                  </td>
              )}
              
              {/* Date */}
              {visibleColumns.has('date') && (
                  <td className={`sticky-col-left ${cellClass(true)} ${stickyBgClass} z-20`}>
                    {editingCell?.id === transaction.id && editingCell.field === 'date' && !isSelectionMode ? (
                        <input type="date" defaultValue={transaction.date} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'date')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'date')} className={commonInputClass} />
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'date' })}>{transaction.date}</div>
                    )}
                  </td>
              )}

              {/* Description */}
              {visibleColumns.has('description') && (
                  <td className="px-3 py-2 text-sm font-medium text-slate-900 w-64 min-w-[200px] max-w-xs relative">
                    <div className="flex items-center gap-2 w-full">
                        {/* Icons */}
                        {isLinked && (
                            <button 
                                title={`Linked Transaction Group`} 
                                onClick={(e) => { e.stopPropagation(); transaction.linkGroupId && onManageLink && onManageLink(transaction.linkGroupId); }} 
                                className="cursor-pointer hover:scale-110 transition-transform p-1 hover:bg-sky-100 rounded flex-shrink-0"
                            >
                                <LinkIcon className="w-3 h-3 text-indigo-600" />
                            </button>
                        )}
                        {transaction.notes && !isSelectionMode && <span title={transaction.notes} className="flex-shrink-0"><NotesIcon className="w-3 h-3 text-indigo-500" /></span>}
                        
                        {/* Input or Text */}
                        {editingCell?.id === transaction.id && editingCell.field === 'description' && !isSelectionMode ? (
                            <input type="text" defaultValue={transaction.description} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'description')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'description')} className={commonInputClass} />
                        ) : (
                            <div className="flex items-center gap-1.5 w-full min-w-0">
                                <span onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'description' })} className="truncate block cursor-pointer hover:text-indigo-600" title={transaction.description}>{transaction.description}</span>
                                
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
                    {editingCell?.id === transaction.id && editingCell.field === 'payeeId' && !isSelectionMode ? (
                        <select defaultValue={transaction.payeeId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'payeeId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'payeeId')} className={commonInputClass}>
                            <option value="">-- No Payee --</option>
                            {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'payeeId' })} className="truncate max-w-[180px]" title={payeeMap.get(transaction.payeeId || '')?.name}>{payeeMap.get(transaction.payeeId || '')?.name || <span className="text-slate-400 italic">None</span>}</div>
                    )}
                  </td>
              )}

              {/* Category */}
              {visibleColumns.has('category') && (
                   <td className={cellClass(true)}>
                     {editingCell?.id === transaction.id && editingCell.field === 'categoryId' && !isSelectionMode ? (
                        <select defaultValue={transaction.categoryId} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'categoryId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'categoryId')} className={commonInputClass}>
                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'categoryId' })}>
                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full truncate max-w-[140px] ${getCategoryColor(categoryName)}`}>
                                {categoryName}
                            </span>
                        </div>
                    )}
                  </td>
              )}

              {/* Account */}
              {visibleColumns.has('account') && (
                  <td className={cellClass(true)}>
                      {editingCell?.id === transaction.id && editingCell.field === 'accountId' && !isSelectionMode ? (
                        <select defaultValue={transaction.accountId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'accountId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'accountId')} className={commonInputClass}>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    ) : (
                      <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'accountId' })} className="truncate max-w-[150px]" title={accountMap.get(transaction.accountId || '')?.name}>{accountMap.get(transaction.accountId || '')?.name || 'N/A'}</div>
                    )}
                  </td>
              )}

              {/* Location */}
              {visibleColumns.has('location') && (
                  <td className={cellClass(true)}>
                    {editingCell?.id === transaction.id && editingCell.field === 'location' && !isSelectionMode ? (
                        <input type="text" defaultValue={transaction.location || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'location')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'location')} className={commonInputClass} />
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'location' })} className="truncate max-w-[150px]">{transaction.location || ''}</div>
                    )}
                  </td>
              )}

              {/* User */}
              {visibleColumns.has('user') && (
                  <td className={cellClass(true)}>
                     {editingCell?.id === transaction.id && editingCell.field === 'userId' && !isSelectionMode ? (
                        <select defaultValue={transaction.userId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'userId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'userId')} className={commonInputClass}>
                            <option value="">-- No User --</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'userId' })} className="truncate max-w-[120px]">{userMap.get(transaction.userId || '') || 'N/A'}</div>
                    )}
                  </td>
              )}

              {/* Type */}
              {visibleColumns.has('type') && (
                  <td className={cellClass(true)}>
                    {editingCell?.id === transaction.id && editingCell.field === 'typeId' && !isSelectionMode ? (
                        <select defaultValue={transaction.typeId} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'typeId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'typeId')} className={commonInputClass}>
                            {transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'typeId' })} className="truncate max-w-[120px] capitalize">{type?.name || 'N/A'}</div>
                    )}
                  </td>
              )}

              {/* Amount */}
              {visibleColumns.has('amount') && (
                  <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium`}>
                     {editingCell?.id === transaction.id && editingCell.field === 'amount' && !isSelectionMode ? (
                        <input type="number" step="0.01" defaultValue={transaction.amount} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'amount')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'amount')} className={`${commonInputClass} text-right`} />
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'amount' })} className={`${!isSelectionMode ? 'cursor-pointer hover:opacity-75' : ''} ${amountColor}`}>
                            {amountPrefix}{formatCurrency(Math.abs(transaction.amount))}
                        </div>
                    )}
                  </td>
              )}

              {/* Actions */}
              {visibleColumns.has('actions') && (
                  <td className={`px-3 py-2 whitespace-nowrap text-center text-sm font-medium sticky-col-right ${stickyBgClass} z-20`}>
                      <div className={`flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isSelectionMode ? 'invisible' : ''}`}>
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
          )})}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;
