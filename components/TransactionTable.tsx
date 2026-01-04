import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User, Tag } from '../types';
import { SortIcon, NotesIcon, DeleteIcon, LinkIcon, SparklesIcon, InfoIcon, ChevronRightIcon, ChevronLeftIcon, ChevronDownIcon, SplitIcon, RepeatIcon } from './Icons';

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
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ['text-red-500', 'text-orange-500', 'text-amber-600', 'text-yellow-600', 'text-lime-600', 'text-green-600', 'text-emerald-600', 'text-teal-600', 'text-cyan-600', 'text-sky-600', 'text-blue-600', 'text-indigo-600', 'text-violet-600', 'text-purple-600', 'text-fuchsia-600', 'text-pink-600', 'text-rose-600'];
    return colors[Math.abs(hash) % colors.length];
};

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, accounts, categories, tags, transactionTypes, payees, users, onUpdateTransaction, onDeleteTransaction, onCreateRule,
  showCheckboxes = false, selectedTxIds = new Set(), onToggleSelection = (_id) => {}, onToggleSelectAll = () => {}, onBulkSelection,
  deleteConfirmationMessage = 'Are you sure?', visibleColumns = new Set(['date', 'description', 'payee', 'category', 'tags', 'account', 'type', 'amount', 'actions']),
  onManageLink, onSplit
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof Transaction } | null>(null);
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
    return [...transactions].sort((a, b) => {
      let aV: any = a[sortKey as keyof Transaction] || '';
      let bV: any = b[sortKey as keyof Transaction] || '';
      if (sortKey === 'date') return new Date(bV).getTime() - new Date(aV).getTime();
      if (typeof aV === 'number') return bV - aV;
      return String(aV).toLowerCase().localeCompare(String(bV).toLowerCase());
    }).sort(() => sortDirection === 'asc' ? -1 : 1);
  }, [transactions, sortKey, sortDirection]);

  const displayItems = useMemo(() => {
      const items: DisplayItem[] = [];
      const processedGroupIds = new Set<string>();
      for (const tx of sortedTransactions) {
          if (tx.linkGroupId) {
              if (processedGroupIds.has(tx.linkGroupId)) continue;
              const children = transactions.filter(t => t.linkGroupId === tx.linkGroupId);
              let primaryTx = children.find(c => c.isParent) || children[0];
              items.push({ type: 'group', id: tx.linkGroupId, primaryTx, children: children.filter(c => c.id !== primaryTx.id), totalAmount: primaryTx.amount });
              processedGroupIds.add(tx.linkGroupId);
          } else items.push({ type: 'single', tx });
      }
      return items;
  }, [sortedTransactions, transactions]);

  const currentItems = displayItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  
  const handleUpdate = (transaction: Transaction, field: keyof Transaction, value: any) => {
    onUpdateTransaction({ ...transaction, [field]: field === 'amount' ? parseFloat(value) || 0 : value });
    setEditingCell(null);
  };

  const getAmountStyles = (typeId: string) => {
      const effect = transactionTypeMap.get(typeId)?.balanceEffect;
      if (effect === 'income') return { color: 'text-emerald-600', prefix: '+' };
      if (['expense', 'savings', 'debt', 'tax'].includes(effect || '')) return { color: 'text-rose-600', prefix: '-' };
      return { color: 'text-slate-600', prefix: '' };
  };

  const renderRow = (transaction: Transaction, isChild: boolean = false) => {
        const { color, prefix } = getAmountStyles(transaction.typeId);
        const isModified = transaction.originalDescription !== transaction.description || transaction.originalAmount !== transaction.amount || transaction.originalDate !== transaction.date;

        return (
            <tr key={transaction.id} className={`${selectedTxIds.has(transaction.id) ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'} transition-colors group`}>
              {showCheckboxes && (
                  <td className="px-3 py-2 sticky left-0 z-20 bg-inherit border-r border-slate-100">
                    <input type="checkbox" checked={selectedTxIds.has(transaction.id)} onChange={() => onToggleSelection?.(transaction.id)} className="rounded text-indigo-600" />
                  </td>
              )}
              <td className="px-3 py-2 text-sm text-slate-500 whitespace-nowrap">{transaction.date}</td>
              <td className="px-3 py-2 text-sm font-medium text-slate-900 min-w-[200px]">
                <div className="flex items-center gap-2">
                    {isModified && (
                        <div className="group/drift relative">
                            <SparklesIcon className="w-3 h-3 text-indigo-500 animate-pulse" />
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover/drift:block bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-50 w-48">
                                <p className="font-bold border-b border-white/10 pb-1 mb-1">Modified from Bank Record</p>
                                <p>Orig: {transaction.originalDescription}</p>
                                <p>Amt: {transaction.originalAmount}</p>
                            </div>
                        </div>
                    )}
                    <span className="truncate" title={transaction.description}>{transaction.description}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-sm text-slate-600">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold">
                    {categoryMap.get(transaction.categoryId)?.name || 'Uncategorized'}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-right font-mono font-bold whitespace-nowrap">
                <span className={color}>{prefix}${Math.abs(transaction.amount).toFixed(2)}</span>
              </td>
              <td className="px-3 py-2 text-center text-slate-400">
                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onSplit?.(transaction)} className="hover:text-indigo-600"><SplitIcon className="w-4 h-4" /></button>
                    <button onClick={() => onDeleteTransaction(transaction.id)} className="hover:text-red-600"><DeleteIcon className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
        );
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-30">
                    <tr>
                        {showCheckboxes && <th className="px-3 py-3 border-r border-slate-200"></th>}
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Description</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Category</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                        <th className="px-3 py-3"></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {currentItems.map((item) => item.type === 'single' ? renderRow(item.tx) : null)}
                </tbody>
            </table>
        </div>
        <div className="p-3 border-t bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-400">
            <span>Showing {currentItems.length} of {displayItems.length}</span>
            <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1 hover:bg-white border rounded disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4"/></button>
                <span>Page {currentPage}</span>
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= Math.ceil(displayItems.length/rowsPerPage)} className="p-1 hover:bg-white border rounded disabled:opacity-30"><ChevronRightIcon className="w-4 h-4"/></button>
            </div>
        </div>
    </div>
  );
};

export default TransactionTable;