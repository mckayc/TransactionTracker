
import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User, Transaction, BalanceEffect, ReconciliationRule } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon, CreditCardIcon, RobotIcon, WrenchIcon } from './Icons';
import { getTransactionSignature } from '../services/transactionService';

type VerifiableTransaction = RawTransaction & { 
    categoryId: string; 
    tempId: string;
    isIgnored?: boolean;
    conflictType?: 'batch' | 'database' | 'reversal' | null;
};

interface ImportVerificationProps {
    initialTransactions: VerifiableTransaction[];
    onComplete: (verifiedTransactions: (RawTransaction & { categoryId: string })[]) => void;
    onCancel: () => void;
    accounts: Account[];
    categories: Category[];
    transactionTypes: TransactionType[];
    payees: Payee[];
    users: User[];
    onCreateRule?: (tx: RawTransaction) => void;
    existingTransactions: Transaction[];
    rules: ReconciliationRule[];
}

type SortKey = 'date' | 'description' | 'payeeId' | 'categoryId' | 'amount' | '';
type SortDirection = 'asc' | 'desc';

const MetadataDrawer: React.FC<{ tx: VerifiableTransaction | null; onClose: () => void; }> = ({ tx, onClose }) => {
    if (!tx || !tx.metadata) return null;
    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-slate-900 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-white/10 bg-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Line Inspector</h3>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold">Raw Source Data</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {Object.entries(tx.metadata).map(([k, v]) => (
                        <div key={k} className="bg-white/5 border border-white/5 rounded-xl p-4">
                            <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">{k}</p>
                            <p className="text-sm text-slate-100 font-medium break-words">{v || <em className="text-slate-700 italic">empty</em>}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    initialTransactions, onComplete, onCancel, accounts, categories, transactionTypes, payees, users, existingTransactions, rules, onCreateRule
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [editingCell, setEditingCell] = useState<{ id: string; field: keyof VerifiableTransaction } | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [inspectedTx, setInspectedTx] = useState<VerifiableTransaction | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const ruleMap = useMemo(() => new Map(rules.map(r => [r.id, r])), [rules]);

    useEffect(() => {
        const dbSigs = new Set(existingTransactions.map(t => getTransactionSignature(t)));
        const processed = initialTransactions.filter(t => Math.abs(t.amount) > 0.001).map(tx => {
            const sig = getTransactionSignature(tx);
            const conflict = dbSigs.has(sig) ? 'database' : null;
            return { ...tx, conflictType: conflict as any, isIgnored: tx.isIgnored || !!conflict };
        });
        setTransactions(processed);
    }, [initialTransactions, existingTransactions]);

    const handleUpdate = (txId: string, field: keyof VerifiableTransaction, value: any) => {
        setTransactions(prev => prev.map(tx => tx.tempId === txId ? { ...tx, [field]: value } : tx));
        setEditingCell(null);
    };

    const requestSort = (key: SortKey) => {
        if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('asc'); }
    };

    const sortedTransactions = useMemo(() => {
        if (!sortKey) return transactions;
        return [...transactions].sort((a, b) => {
            let valA = a[sortKey as keyof VerifiableTransaction] as any;
            let valB = b[sortKey as keyof VerifiableTransaction] as any;
            if (sortKey === 'amount') {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            }
            return sortDirection === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });
    }, [transactions, sortKey, sortDirection]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    
    return (
        <div className="space-y-4 flex flex-col h-full overflow-hidden">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                        <TableIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Verify Import Data</h2>
                        <p className="text-sm text-slate-500">Review {transactions.length} detected records. {transactions.filter(t => t.conflictType === 'database').length} duplicates identified.</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={onCancel} className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Discard</button>
                    <button onClick={() => onComplete(transactions.filter(t => !t.isIgnored))} className="flex-1 sm:flex-none px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Finalize Import</button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 text-center bg-slate-50 border-b border-slate-200">
                                    <input type="checkbox" className="rounded text-indigo-600 h-4 w-4" checked={selectedIds.size === transactions.length} onChange={() => setSelectedIds(selectedIds.size === transactions.length ? new Set() : new Set(transactions.map(t => t.tempId)))} />
                                </th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Status</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('date')}>
                                    <div className="flex items-center gap-1">Date <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('description')}>
                                    <div className="flex items-center gap-1">Description <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Direction</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('categoryId')}>
                                    <div className="flex items-center gap-1">Category <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('amount')}>
                                    <div className="flex items-center justify-end gap-1">Amount <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Rule</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Raw</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sortedTransactions.map(tx => {
                                const type = typeMap.get(tx.typeId);
                                const effect = type?.balanceEffect || 'expense';
                                const matchedRule = tx.appliedRuleId ? ruleMap.get(tx.appliedRuleId) : null;
                                
                                // Color logic
                                const amountColor = effect === 'income' 
                                    ? 'text-green-600' 
                                    : effect === 'transfer' 
                                        ? 'text-slate-400' 
                                        : 'text-red-600';

                                return (
                                    <tr key={tx.tempId} className={`transition-all ${tx.isIgnored ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={!tx.isIgnored} onChange={() => handleUpdate(tx.tempId, 'isIgnored', !tx.isIgnored)} className="rounded text-indigo-600 h-4 w-4" />
                                        </td>
                                        <td className="px-4 py-2">
                                            {tx.conflictType === 'database' ? (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase flex items-center gap-1 w-max">
                                                    <ExclamationTriangleIcon className="w-2.5 h-2.5" /> Exists
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase w-max">New Entry</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-500 font-mono">{tx.date}</td>
                                        <td className="px-4 py-2 text-sm font-bold text-slate-700 truncate max-w-xs">{tx.description}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex bg-slate-100 p-0.5 rounded-lg w-max">
                                                {(['expense', 'income', 'transfer'] as BalanceEffect[]).map(e => (
                                                    <button key={e} onClick={() => handleUpdate(tx.tempId, 'typeId', transactionTypes.find(t => t.balanceEffect === e)?.id)} className={`px-2 py-1 text-[9px] font-black uppercase rounded transition-all ${effect === e ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{e}</button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <select value={tx.categoryId} onChange={e => handleUpdate(tx.tempId, 'categoryId', e.target.value)} className="p-1.5 text-xs border border-slate-200 rounded-lg w-full font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 bg-white">
                                                <option value="">Uncategorized</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td className={`px-4 py-2 text-right text-sm font-black font-mono ${amountColor}`}>
                                            {effect === 'income' ? '+' : effect === 'transfer' ? '' : '-'}{formatCurrency(tx.amount)}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            {matchedRule ? (
                                                <div className="group/rule relative inline-block">
                                                    <button 
                                                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all border border-green-200 shadow-sm"
                                                        title={`Rule Applied: ${matchedRule.name}`}
                                                    >
                                                        <SparklesIcon className="w-4 h-4" />
                                                    </button>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover/rule:opacity-100 transition-opacity pointer-events-none z-50">
                                                        <p className="font-black border-b border-white/10 pb-1 mb-1 uppercase tracking-tighter text-indigo-400">Automation Triggered</p>
                                                        <p className="font-bold">{matchedRule.name}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => onCreateRule && onCreateRule(tx)}
                                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Create Rule from this Transaction"
                                                >
                                                    <WrenchIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => setInspectedTx(tx)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="View Source Metadata">
                                                <TableIcon className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <MetadataDrawer tx={inspectedTx} onClose={() => setInspectedTx(null)} />
        </div>
    );
};

export default ImportVerification;
