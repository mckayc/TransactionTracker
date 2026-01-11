
import React, { useState, useMemo } from 'react';
import type { Transaction, Account, TransactionType, Counterparty, Category, User, Tag } from '../types';
import { SortIcon, NotesIcon, DeleteIcon, LinkIcon, SparklesIcon, InfoIcon, ChevronRightIcon, ChevronLeftIcon, ChevronDownIcon, SplitIcon, DatabaseIcon, CloseIcon, WrenchIcon, EditIcon } from './Icons';

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  counterparties: Counterparty[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onCreateRule?: (transaction: Transaction) => void;
  onEditRule?: (ruleId: string, transaction: Transaction) => void;
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

type SortKey = keyof Transaction | 'counterpartyId' | 'categoryId' | 'accountId' | 'userId' | 'typeId' | '';
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

const RawDataDrawer: React.FC<{ tx: Transaction | null; onClose: () => void; }> = ({ tx, onClose }) => {
    if (!tx) return null;
    const metadata = tx.metadata || {};
    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-slate-900 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-white/10 bg-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <DatabaseIcon className="w-5 h-5 text-indigo-400" />
                            Raw Record Inspector
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">Transaction ID: {tx.id.substring(0, 8)}...</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4 mb-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Processed Summary</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500 block text-[10px] uppercase">Final Desc</span><span className="text-white font-bold">{tx.description}</span></div>
                            <div><span className="text-slate-500 block text-[10px] uppercase">Original Desc</span><span className="text-white font-mono text-xs">{tx.originalDescription || tx.description}</span></div>
                        </div>
                    </div>
                    {Object.entries(metadata).length > 0 ? (
                        Object.entries(metadata).map(([k, v]) => (
                            <div key={k} className="bg-white/5 border border-white/5 rounded-xl p-4">
                                <p className="text-[10px] font-black text-indigo-400 uppercase mb-1 tracking-wider">{k}</p>
                                <p className="text-sm text-slate-100 font-medium break-words leading-relaxed">{String(v) || <em className="text-slate-700 italic">empty</em>}</p>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center">
                            <InfoIcon className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">No additional metadata found for this record.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  accounts, 
  categories,
  tags,
  transactionTypes,
  counterparties,
  users,
  onUpdateTransaction, 
  onDeleteTransaction,
  onEditTransaction,
  onCreateRule,
  onEditRule,
  showCheckboxes = false,
  selectedTxIds = new Set(),
  onToggleSelection = (_id) => {},
  onToggleSelectAll = () => {},
  onBulkSelection,
  deleteConfirmationMessage = 'Are you sure you want to delete this transaction?',
  visibleColumns = new Set(['date', 'description', 'counterparty', 'category', 'tags', 'account', 'type', 'amount', 'actions']),
  onManageLink,
  onSplit
}) => {
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [inspectedTx, setInspectedTx] = useState<Transaction | null>(null);

    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
    const counterpartyMap = useMemo(() => new Map(counterparties.map(p => [p.id, p.name])), [counterparties]);
    const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

    const displayItems = useMemo(() => {
        const sorted = [...transactions].sort((a, b) => {
            if (sortKey === '') return 0;
            const aVal = a[sortKey as keyof Transaction] || '';
            const bVal = b[sortKey as keyof Transaction] || '';
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        });

        const items: DisplayItem[] = [];
        const processedGroupIds = new Set<string>();

        sorted.forEach(tx => {
            if (tx.linkGroupId) {
                if (processedGroupIds.has(tx.linkGroupId)) return;
                const groupTxs = transactions.filter(t => t.linkGroupId === tx.linkGroupId);
                const primary = groupTxs.find(t => t.isParent) || groupTxs[0];
                const children = groupTxs.filter(t => t.id !== primary.id);
                items.push({
                    type: 'group',
                    id: tx.linkGroupId,
                    primaryTx: primary,
                    children,
                    totalAmount: groupTxs.reduce((sum, t) => sum + (t.isParent ? 0 : t.amount), 0) || primary.amount
                });
                processedGroupIds.add(tx.linkGroupId);
            } else if (!tx.parentTransactionId) {
                items.push({ type: 'single', tx });
            }
        });

        return items;
    }, [transactions, sortKey, sortDir]);

    const toggleGroup = (groupId: string) => {
        const next = new Set(expandedGroups);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        setExpandedGroups(next);
    };

    const formatCurrency = (amt: number, typeId: string) => {
        const type = typeMap.get(typeId);
        const sign = type?.balanceEffect === 'outgoing' ? '-' : (type?.balanceEffect === 'incoming' ? '+' : '');
        return `${sign}${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amt))}`;
    };

    const getAmountColor = (typeId: string) => {
        const type = typeMap.get(typeId);
        if (!type) return 'text-slate-700';
        if (type.color) return type.color;
        
        const effect = type.balanceEffect;
        if (effect === 'incoming') return 'text-emerald-600';
        if (effect === 'outgoing') return 'text-rose-600';
        return 'text-slate-700';
    };

    const handleHeaderClick = (key: SortKey) => {
        if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const SortIndicator = ({ activeKey }: { activeKey: SortKey }) => {
        if (sortKey !== activeKey) return <SortIcon className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />;
        return <SortIcon className={`w-3 h-3 text-indigo-500 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />;
    };

    return (
        <div className="w-full flex flex-col min-h-0 h-full relative">
            <div className="overflow-auto flex-1 custom-scrollbar min-h-0">
                <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                    <thead className="bg-slate-50 sticky top-0 z-30 shadow-sm">
                        <tr>
                            {showCheckboxes && (
                                <th className="p-4 w-12 border-b bg-slate-50">
                                    <input 
                                        type="checkbox" 
                                        onChange={onToggleSelectAll} 
                                        checked={selectedTxIds.size === transactions.length && transactions.length > 0}
                                        className="rounded text-indigo-600 cursor-pointer" 
                                    />
                                </th>
                            )}
                            {visibleColumns.has('date') && (
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleHeaderClick('date')}>
                                    <div className="flex items-center gap-1">Date <SortIndicator activeKey="date" /></div>
                                </th>
                            )}
                            {visibleColumns.has('description') && (
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleHeaderClick('description')}>
                                    <div className="flex items-center gap-1">Description <SortIndicator activeKey="description" /></div>
                                </th>
                            )}
                            {visibleColumns.has('counterparty') && (
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleHeaderClick('counterpartyId')}>
                                    <div className="flex items-center gap-1">Entity <SortIndicator activeKey="counterpartyId" /></div>
                                </th>
                            )}
                            {visibleColumns.has('category') && (
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleHeaderClick('categoryId')}>
                                    <div className="flex items-center gap-1">Category <SortIndicator activeKey="categoryId" /></div>
                                </th>
                            )}
                            {visibleColumns.has('account') && (
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleHeaderClick('accountId')}>
                                    <div className="flex items-center gap-1">Account <SortIndicator activeKey="accountId" /></div>
                                </th>
                            )}
                            {visibleColumns.has('amount') && (
                                <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleHeaderClick('amount')}>
                                    <div className="flex items-center justify-end gap-1">Amount <SortIndicator activeKey="amount" /></div>
                                </th>
                            )}
                            {visibleColumns.has('actions') && <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {displayItems.map((item) => {
                            if (item.type === 'single') {
                                const tx = item.tx;
                                const isSelected = selectedTxIds.has(tx.id);
                                const appliedIds = tx.appliedRuleIds || (tx.appliedRuleId ? [tx.appliedRuleId] : []);

                                return (
                                    <tr key={tx.id} className={`hover:bg-slate-50/80 transition-colors group ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                                        {showCheckboxes && <td className="p-4 text-center"><input type="checkbox" checked={isSelected} onChange={() => onToggleSelection?.(tx.id)} className="rounded text-indigo-600 cursor-pointer" /></td>}
                                        {visibleColumns.has('date') && <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{tx.date}</td>}
                                        {visibleColumns.has('description') && (
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-800 truncate max-w-md">{tx.description}</span>
                                                    {tx.originalDescription && tx.originalDescription !== tx.description && <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter truncate max-w-xs">{tx.originalDescription}</span>}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.has('counterparty') && <td className="px-4 py-3"><span className="text-sm font-medium text-slate-600">{counterpartyMap.get(tx.counterpartyId || '') || <em className="text-slate-300">--</em>}</span></td>}
                                        {visibleColumns.has('category') && <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg border border-slate-200">{categoryMap.get(tx.categoryId) || 'Uncategorized'}</span></td>}
                                        {visibleColumns.has('account') && <td className="px-4 py-3 text-xs font-bold text-slate-500">{accountMap.get(tx.accountId || '') || 'Unknown'}</td>}
                                        {visibleColumns.has('amount') && <td className={`px-4 py-3 text-right text-sm font-black font-mono ${getAmountColor(tx.typeId)}`}>{formatCurrency(tx.amount, tx.typeId)}</td>}
                                        {visibleColumns.has('actions') && (
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {appliedIds.length > 0 && onEditRule && (
                                                        <button onClick={() => onEditRule(appliedIds[0], tx)} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg transition-all" title="Edit Applied Rule"><WrenchIcon className="w-4 h-4" /></button>
                                                    )}
                                                    <button onClick={() => onEditTransaction?.(tx)} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg transition-all" title="Edit Transaction"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => setInspectedTx(tx)} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg transition-all" title="Inspect Record"><DatabaseIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => onSplit?.(tx)} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg transition-all" title="Split Transaction"><SplitIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => onDeleteTransaction(tx.id)} className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg transition-all" title="Delete Record"><DeleteIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            } else {
                                const isExpanded = expandedGroups.has(item.id);
                                const groupColor = generateGroupColor(item.id);
                                return (
                                    <React.Fragment key={item.id}>
                                        <tr className="bg-indigo-50/30 hover:bg-indigo-50 transition-colors group">
                                            {showCheckboxes && <td className="p-4 text-center"></td>}
                                            {visibleColumns.has('date') && <td className="px-4 py-3 text-xs font-mono text-indigo-400">{item.primaryTx.date}</td>}
                                            {visibleColumns.has('description') && (
                                                <td className="px-4 py-3">
                                                    <button onClick={() => toggleGroup(item.id)} className="flex items-center gap-2 group/btn">
                                                        <div className={`p-1 rounded-md bg-white border border-indigo-100 text-indigo-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}><ChevronRightIcon className="w-3 h-3" /></div>
                                                        <div className="text-left">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-black text-indigo-900">{item.primaryTx.description}</span>
                                                                <span className={`text-[10px] font-black uppercase ${groupColor} flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-indigo-100 shadow-sm`}><LinkIcon className="w-3 h-3"/> Linked Group</span>
                                                            </div>
                                                            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">{item.children.length + 1} nested entries</p>
                                                        </div>
                                                    </button>
                                                </td>
                                            )}
                                            {visibleColumns.has('counterparty') && <td className="px-4 py-3"><span className="text-sm font-medium text-indigo-600/60 italic">Grouped</span></td>}
                                            {visibleColumns.has('category') && <td className="px-4 py-3"><span className="text-[10px] font-black uppercase text-indigo-400 italic">Composite</span></td>}
                                            {visibleColumns.has('account') && <td className="px-4 py-3 text-xs font-bold text-indigo-400">{accountMap.get(item.primaryTx.accountId || '')}</td>}
                                            {visibleColumns.has('amount') && <td className={`px-4 py-3 text-right text-sm font-black text-indigo-700 font-mono underline decoration-dotted decoration-indigo-300`}>{formatCurrency(item.totalAmount, item.primaryTx.typeId)}</td>}
                                            {visibleColumns.has('actions') && (
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => onManageLink?.(item.id)} className="p-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border border-indigo-200 shadow-sm" title="Manage Links"><LinkIcon className="w-4 h-4" /></button>
                                                </td>
                                            )}
                                        </tr>
                                        {isExpanded && item.children.map(child => (
                                            <tr key={child.id} className="bg-white/50 border-l-4 border-l-indigo-200 group">
                                                {showCheckboxes && <td className="p-4 text-center"><input type="checkbox" checked={selectedTxIds.has(child.id)} onChange={() => onToggleSelection?.(child.id)} className="rounded text-indigo-600 cursor-pointer" /></td>}
                                                {visibleColumns.has('date') && <td className="px-4 py-2 text-[10px] font-mono text-slate-400 pl-8">{child.date}</td>}
                                                {visibleColumns.has('description') && <td className="px-4 py-2 pl-12"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-200"></div><span className="text-xs font-bold text-slate-600">{child.description}</span></div></td>}
                                                {visibleColumns.has('counterparty') && <td className="px-4 py-2 text-xs text-slate-400">{counterpartyMap.get(child.counterpartyId || '')}</td>}
                                                {visibleColumns.has('category') && <td className="px-4 py-2"><span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{categoryMap.get(child.categoryId) || 'Uncategorized'}</span></td>}
                                                {visibleColumns.has('account') && <td className="px-4 py-2 text-[10px] text-slate-400 uppercase font-black">{accountMap.get(child.accountId || '')}</td>}
                                                {visibleColumns.has('amount') && <td className={`px-4 py-2 text-right text-xs font-black font-mono ${getAmountColor(child.typeId)}`}>{formatCurrency(child.amount, child.typeId)}</td>}
                                                {visibleColumns.has('actions') && <td className="px-4 py-2 text-center"><button onClick={() => setInspectedTx(child)} className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"><DatabaseIcon className="w-3 h-3" /></button></td>}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            }
                        })}
                    </tbody>
                </table>
            </div>
            <RawDataDrawer tx={inspectedTx} onClose={() => setInspectedTx(null)} />
        </div>
    );
};

export default TransactionTable;
