import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User, Tag } from '../types';
import { SortIcon, NotesIcon, DeleteIcon, LinkIcon, SparklesIcon, InfoIcon, ChevronRightIcon, ChevronLeftIcon, ChevronDownIcon, SplitIcon } from './Icons';

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
  onSplit?: (transaction: Transaction) => void;
}

type SortKey = keyof Transaction | 'payeeId' | 'categoryId' | 'accountId' | 'userId' | 'typeId' | '';
type SortDirection = 'asc' | 'desc';

interface GroupItem {
    type: 'group';
    id: string; 
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
  onManageLink,
  onSplit
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('transaction_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof Transaction } | null>(null);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p])), [payees]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
  const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

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
          aValue = accountMap.get(a.account_id || '')?.name || '';
          bValue = accountMap.get(b.account_id || '')?.name || '';
      } else if (sortKey === 'userId') {
          aValue = userMap.get(a.userId || '') || '';
          bValue = userMap.get(b.userId || '') || '';
      } else if (sortKey === 'typeId') {
          aValue = transactionTypeMap.get(a.typeId)?.name || '';
          bValue = transactionTypeMap.get(b.typeId)?.name || '';
      }

      if (aValue === undefined || aValue === null) aValue = '';
      if (bValue === undefined || bValue === null) bValue = '';
      
      if (sortKey === 'transaction_date' || sortKey === 'date') {
        const dateA = new Date(a.transaction_date || a.date).getTime();
        const dateB = new Date(b.transaction_date || b.date).getTime();
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

  const displayItems = useMemo(() => {
      const items: DisplayItem[] = [];
      const processedGroupIds = new Set<string>();

      for (const tx of sortedTransactions) {
          const groupId = tx.linkGroupId;
          
          if (groupId) {
              if (processedGroupIds.has(groupId)) continue;
              const children = transactions.filter(t => t.linkGroupId === groupId);
              let primaryTx = children.find(c => c.isParent) || children.reduce((prev, current) => (Math.abs(current.amount) > Math.abs(prev.amount) ? current : prev), children[0]);
              
              items.push({
                  type: 'group',
                  id: groupId,
                  primaryTx,
                  children: children.filter(c => c.id !== primaryTx.id),
                  totalAmount: primaryTx.amount 
              });
              processedGroupIds.add(groupId);
          } else {
              items.push({ type: 'single', tx });
          }
      }
      return items;
  }, [sortedTransactions, transactions]);

  useEffect(() => {
      setCurrentPage(1);
  }, [displayItems.length]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getAmountStyles = (tx: Transaction) => {
      const type = transactionTypeMap.get(tx.typeId);
      if (!type) return { color: 'text-slate-600', prefix: '' };
      
      if (tx.direction === 'credit') return { color: 'text-emerald-600', prefix: '+' };
      return { color: 'text-rose-600', prefix: '-' };
  };

  const commonInputClass = "w-full p-1 text-xs rounded-md border-indigo-500 ring-1 ring-indigo-500 focus:outline-none shadow-sm";
  const cellClass = (isEditable = false) => `px-3 py-2 whitespace-nowrap text-sm text-slate-600 ${isEditable ? 'cursor-pointer hover:text-indigo-600 hover:bg-slate-50' : ''}`;

  const renderRow = (transaction: Transaction, isChild: boolean = false, groupData?: GroupItem) => {
        const type = transactionTypeMap.get(transaction.typeId);
        const typeName = type?.name || 'N/A';
        const categoryName = categoryMap.get(transaction.categoryId)?.name || 'Uncategorized';
        const payeeName = payeeMap.get(transaction.payeeId || '')?.name || '';
        const accountName = accountMap.get(transaction.account_id || '')?.name || 'N/A';
        
        const { color, prefix } = getAmountStyles(transaction);
        const isSelected = selectedTxIds.has(transaction.id);
        const linkGroupId = transaction.linkGroupId;

        let stickyBgClass = 'bg-white group-hover:bg-slate-50';
        if (isSelected) {
            stickyBgClass = 'bg-indigo-50';
        } else if (isChild) {
            stickyBgClass = 'bg-slate-50/50'; 
        }

        return (
            <tr key={transaction.id} className={`transition-colors group hover:relative hover:z-50 ${stickyBgClass}`}>
              {showCheckboxes && (
                  <td className={`w-10 px-3 py-2 whitespace-nowrap sticky left-0 z-50 border-r border-transparent ${stickyBgClass}`}>
                      <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={isSelected}
                          onChange={() => onToggleSelection?.(transaction.id)}
                      />
                  </td>
              )}
              {visibleColumns.has('date') && (
                  <td className={cellClass(true)}>
                    <div onClick={() => setEditingCell({ id: transaction.id, field: 'transaction_date' })} className={isChild ? "pl-4" : ""}>
                        {transaction.transaction_date || transaction.date}
                    </div>
                  </td>
              )}
              {visibleColumns.has('description') && (
                  <td className="px-3 py-2 text-sm font-medium text-slate-900 w-64 min-w-[200px] max-w-xs overflow-visible">
                    <div className={`flex items-center gap-2 w-full ${isChild ? 'pl-4' : ''}`}>
                        {transaction.is_payment && <span title="Payment Detected" className="bg-green-100 text-green-700 text-[10px] px-1 rounded flex-shrink-0">Payment</span>}
                        {transaction.is_internal_transfer && <span title="Internal Transfer" className="bg-blue-100 text-blue-700 text-[10px] px-1 rounded flex-shrink-0">Transfer</span>}
                        <div className="flex items-center gap-1.5 w-full min-w-0 relative">
                            <span onClick={() => setEditingCell({ id: transaction.id, field: 'merchant_clean' })} className="truncate block cursor-pointer hover:text-indigo-600" title={transaction.description_raw}>
                                {transaction.merchant_clean || transaction.description}
                            </span>
                            {transaction.description_raw && transaction.description_raw !== transaction.merchant_clean && (
                                <InfoIcon className="w-3 h-3 text-slate-400 cursor-help" title={transaction.description_raw} />
                            )}
                        </div>
                    </div>
                  </td>
              )}
              {visibleColumns.has('payee') && (
                  <td className={cellClass(true)}>
                    <div className={`truncate max-w-[180px]`} title={payeeName}>
                        {payeeName || <span className="text-slate-400 italic">None</span>}
                    </div>
                  </td>
              )}
              {visibleColumns.has('category') && (
                   <td className={cellClass(true)}>
                     <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full truncate max-w-[140px] bg-slate-100`}>
                        {categoryName}
                     </span>
                  </td>
              )}
              {visibleColumns.has('account') && (
                  <td className={cellClass(true)}>
                      <div className="truncate max-w-[150px]" title={accountName}>{accountName}</div>
                  </td>
              )}
              {visibleColumns.has('amount') && (
                  <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-medium pr-8 min-w-[120px]`}>
                     <div className={`tabular-nums font-mono font-bold ${color}`}>
                        {prefix}{formatCurrency(Math.abs(transaction.amount))}
                     </div>
                  </td>
              )}
              {visibleColumns.has('actions') && (
                  <td className={`px-3 py-2 whitespace-nowrap text-center text-sm font-medium sticky right-0 ${stickyBgClass} z-20`}>
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={(e) => handleDelete(e, transaction.id)} className="text-slate-400 hover:text-red-600 p-1" title="Delete">
                            <DeleteIcon className="w-4 h-4" />
                        </button>
                      </div>
                  </td>
              )}
            </tr>
        );
  };

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 relative">
        <div className="flex-grow w-full overflow-x-auto overflow-y-auto">
        <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-30 shadow-sm">
            <tr>
                {showCheckboxes && (
                <th scope="col" className="w-10 px-3 py-3 bg-slate-50 sticky top-0 left-0 z-50 border-b border-slate-200">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={transactions.length > 0 && selectedTxIds.size === transactions.length} onChange={onToggleSelectAll} />
                </th>
                )}
                {visibleColumns.has('date') && <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200" onClick={() => requestSort('transaction_date')}>Date</th>}
                {visibleColumns.has('description') && <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200" onClick={() => requestSort('description_raw')}>Description</th>}
                {visibleColumns.has('payee') && <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">Payee</th>}
                {visibleColumns.has('category') && <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">Category</th>}
                {visibleColumns.has('account') && <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">Account</th>}
                {visibleColumns.has('amount') && <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 pr-8" onClick={() => requestSort('amount')}>Amount</th>}
                {visibleColumns.has('actions') && <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 sticky right-0 z-40 border-b border-slate-200">Action</th>}
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
            {currentItems.map((item) => {
                if (item.type === 'group') {
                    return (
                        <React.Fragment key={item.id}>
                            {renderRow(item.primaryTx, false, item)}
                            {expandedGroups.has(item.id) && item.children.map(child => renderRow(child, true, item))}
                        </React.Fragment>
                    );
                } else {
                    return renderRow(item.tx);
                }
            })}
            </tbody>
        </table>
        </div>
        
        {totalPages > 1 && (
            <div className="border-t border-slate-200 p-3 bg-slate-50 flex justify-between items-center sticky bottom-0 z-30">
                <span className="text-sm text-slate-600">Rows: {startIndex + 1}-{Math.min(endIndex, displayItems.length)} of {displayItems.length}</span>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronLeftIcon className="w-5 h-5"/></button>
                    <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronRightIcon className="w-5 h-5"/></button>
                </div>
            </div>
        )}
    </div>
  );
};

export default TransactionTable;