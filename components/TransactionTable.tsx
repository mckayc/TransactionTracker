
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
  deleteConfirmationMessage?: string;
  visibleColumns?: Set<string>;
}

type SortKey = keyof Transaction | '';
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
  deleteConfirmationMessage = 'Are you sure you want to delete this transaction? This action cannot be undone.',
  visibleColumns = new Set(['date', 'description', 'payee', 'category', 'account', 'user', 'type', 'amount', 'actions'])
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof Transaction } | null>(null);

  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p])), [payees]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
  const transactionMap = useMemo(() => new Map(transactions.map(tx => [tx.id, tx])), [transactions]);

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
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      
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
  }, [transactions, sortKey, sortDirection]);
  
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

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <SortIcon className="w-4 h-4 text-slate-400 invisible group-hover:visible" />;
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

  const renderHeader = (label: string, key: SortKey) => (
    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
      <button onClick={() => requestSort(key)} className="group flex items-center gap-1">
        {label}
        <span className="text-indigo-600">{getSortIndicator(key)}</span>
      </button>
    </th>
  );
  
  const commonInputClass = "w-full p-1 text-sm rounded-md border-indigo-500 ring-1 ring-indigo-500 focus:outline-none";

  return (
    <div className="overflow-x-auto scrollbar-gutter-stable">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {isSelectionMode && (
              <th scope="col" className="px-6 py-3">
                  <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={transactions.length > 0 && selectedTxIds.size === transactions.length}
                      onChange={onToggleSelectAll}
                      aria-label="Select all transactions"
                  />
              </th>
            )}
            {visibleColumns.has('date') && renderHeader('Date', 'date')}
            {visibleColumns.has('description') && renderHeader('Description', 'description')}
            {visibleColumns.has('payee') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Payee</th>}
            {visibleColumns.has('category') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>}
            {visibleColumns.has('account') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Account</th>}
            {visibleColumns.has('user') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>}
            {visibleColumns.has('type') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>}
            {visibleColumns.has('amount') && (
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                <button onClick={() => requestSort('amount')} className="group flex items-center gap-1 float-right">
                    Amount
                    <span className="text-indigo-600">{getSortIndicator('amount')}</span>
                </button>
                </th>
            )}
            {visibleColumns.has('actions') && (
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
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
            const linkedTx = transaction.linkedTransactionId ? transactionMap.get(transaction.linkedTransactionId) : null;
            const linkedAccountName = linkedTx ? accountMap.get(linkedTx.accountId || '')?.name : '';
            
            return (
            <tr key={transaction.id} className={`transition-colors ${isSelected ? 'bg-indigo-50' : linkedTx ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
              {isSelectionMode && (
                  <td className="px-6 py-4 whitespace-nowrap">
                      <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={isSelected}
                          onChange={() => onToggleSelection(transaction.id)}
                          aria-label={`Select transaction ${transaction.description}`}
                      />
                  </td>
              )}
              {visibleColumns.has('date') && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {editingCell?.id === transaction.id && editingCell.field === 'date' && !isSelectionMode ? (
                        <input type="date" defaultValue={transaction.date} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'date')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'date')} className={commonInputClass} />
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'date' })} className={`${!isSelectionMode ? 'cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100' : ''}`}>{transaction.date}</div>
                    )}
                  </td>
              )}
              {visibleColumns.has('description') && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                    {linkedTx && (
                        <span title={`Transfer to/from ${linkedAccountName || 'another account'}`}>
                            <LinkIcon className="w-4 h-4 text-sky-600" />
                        </span>
                    )}
                    {transaction.notes && !isSelectionMode && <span title={transaction.notes}><NotesIcon className="w-4 h-4 text-indigo-500" /></span>}
                        {editingCell?.id === transaction.id && editingCell.field === 'description' && !isSelectionMode ? (
                            <input type="text" defaultValue={transaction.description} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'description')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'description')} className={commonInputClass} />
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <span onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'description' })} className={`max-w-xs truncate ${!isSelectionMode ? 'cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100' : ''}`} title={transaction.description}>{transaction.description}</span>
                                {transaction.originalDescription && transaction.originalDescription !== transaction.description && (
                                    <div className="group relative flex items-center">
                                        <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden w-max max-w-[200px] p-2 bg-slate-800 text-white text-xs rounded shadow-lg group-hover:block z-10">
                                            Original: {transaction.originalDescription}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  </td>
              )}
              {visibleColumns.has('payee') && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {editingCell?.id === transaction.id && editingCell.field === 'payeeId' && !isSelectionMode ? (
                        <select defaultValue={transaction.payeeId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'payeeId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'payeeId')} className={commonInputClass}>
                            <option value="">-- No Payee --</option>
                            {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'payeeId' })} className={`${!isSelectionMode ? 'cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100' : ''}`}>{payeeMap.get(transaction.payeeId || '')?.name || 'N/A'}</div>
                    )}
                  </td>
              )}
              {visibleColumns.has('category') && (
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                     {editingCell?.id === transaction.id && editingCell.field === 'categoryId' && !isSelectionMode ? (
                        <select defaultValue={transaction.categoryId} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'categoryId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'categoryId')} className={commonInputClass}>
                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'categoryId' })} className={`${!isSelectionMode ? 'cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100' : ''} inline-block`}>
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(categoryName)}`}>
                                {categoryName}
                            </span>
                        </div>
                    )}
                  </td>
              )}
              {visibleColumns.has('account') && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{accountMap.get(transaction.accountId || '')?.name || 'N/A'}</td>
              )}
              {visibleColumns.has('user') && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                     {editingCell?.id === transaction.id && editingCell.field === 'userId' && !isSelectionMode ? (
                        <select defaultValue={transaction.userId || ''} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'userId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'userId')} className={commonInputClass}>
                            <option value="">-- No User --</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'userId' })} className={`${!isSelectionMode ? 'cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100' : ''}`}>{userMap.get(transaction.userId || '') || 'N/A'}</div>
                    )}
                  </td>
              )}
              {visibleColumns.has('type') && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">
                    {editingCell?.id === transaction.id && editingCell.field === 'typeId' && !isSelectionMode ? (
                        <select defaultValue={transaction.typeId} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'typeId')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'typeId')} className={commonInputClass}>
                            {transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'typeId' })} className={`${!isSelectionMode ? 'cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100' : ''}`}>{type?.name || 'N/A'}</div>
                    )}
                  </td>
              )}
              {visibleColumns.has('amount') && (
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium`}>
                     {editingCell?.id === transaction.id && editingCell.field === 'amount' && !isSelectionMode ? (
                        <input type="number" step="0.01" defaultValue={transaction.amount} autoFocus onBlur={(e) => handleInputBlur(e, transaction, 'amount')} onKeyDown={(e) => handleInputKeyDown(e, transaction, 'amount')} className={`${commonInputClass} text-right`} />
                    ) : (
                        <div onClick={() => !isSelectionMode && setEditingCell({ id: transaction.id, field: 'amount' })} className={`${!isSelectionMode ? 'cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100' : ''} ${amountColor}`}>
                            {amountPrefix}{formatCurrency(Math.abs(transaction.amount))}
                        </div>
                    )}
                  </td>
              )}
              {visibleColumns.has('actions') && (
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className={`flex items-center justify-center gap-3 ${isSelectionMode ? 'invisible' : ''}`}>
                         {onCreateRule && (
                            <button onClick={(e) => { e.stopPropagation(); onCreateRule(transaction); }} className="text-slate-500 hover:text-indigo-600" title="Create Rule from Transaction">
                                <SparklesIcon className="w-5 h-5" />
                            </button>
                         )}
                         <button onClick={(e) => handleDelete(e, transaction.id)} className="text-red-500 hover:text-red-700" title="Delete">
                            <DeleteIcon className="w-5 h-5" />
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