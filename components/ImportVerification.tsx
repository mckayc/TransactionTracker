import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User, Transaction, BalanceEffect } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon, CreditCardIcon, RobotIcon } from './Icons';
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
    onCreateRule?: (tx: VerifiableTransaction) => void;
    existingTransactions: Transaction[];
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
    initialTransactions, onComplete, onCancel, accounts, categories, transactionTypes, payees, users, existingTransactions 
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [editingCell, setEditingCell] = useState<{ id: string; field: keyof VerifiableTransaction } | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [inspectedTx, setInspectedTx] = useState<VerifiableTransaction | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

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
            return sortDirection === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });
    }, [transactions, sortKey, sortDirection]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    
    return (
        <div className="space-y-4">
            <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-2xl flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-indigo-900">Verify Import Data</h2>
                    <p className="text-sm text-indigo-700">Check for accuracy and resolve any duplicates before saving.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="px-5 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl">Cancel</button>
                    <button onClick={() => onComplete(transactions.filter(t => !t.isIgnored))} className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Finalize Import</button>
                </div>
            </div>

            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[60vh]">
                <div className="overflow-auto flex-grow custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 w-10 text-center"><input type="checkbox" className="rounded" checked={selectedIds.size === transactions.length} onChange={() => setSelectedIds(selectedIds.size === transactions.length ? new Set() : new Set(transactions.map(t => t.tempId)))} /></th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase cursor-pointer" onClick={() => requestSort('date')}>Date</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase cursor-pointer" onClick={() => requestSort('description')}>Description</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase">Direction</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase cursor-pointer" onClick={() => requestSort('categoryId')}>Category</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase cursor-pointer" onClick={() => requestSort('amount')}>Amount</th>
                                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase">Raw</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedTransactions.map(tx => {
                                const type = typeMap.get(tx.typeId);
                                const effect = type?.balanceEffect || 'expense';
                                return (
                                    <tr key={tx.tempId} className={`transition-all ${tx.isIgnored ? 'opacity-40 grayscale bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <td className="p-3 text-center"><input type="checkbox" checked={!tx.isIgnored} onChange={() => handleUpdate(tx.tempId, 'isIgnored', !tx.isIgnored)} className="rounded" /></td>
                                        <td className="px-4 py-2">
                                            {tx.conflictType === 'database' ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase">In Database</span> : <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[8px] font-black rounded uppercase">New</span>}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-slate-600 font-mono">{tx.date}</td>
                                        <td className="px-4 py-2 text-sm font-bold text-slate-800 truncate max-w-xs">{tx.description}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex bg-slate-100 p-0.5 rounded-lg w-max">
                                                {(['expense', 'income', 'transfer'] as BalanceEffect[]).map(e => (
                                                    <button key={e} onClick={() => handleUpdate(tx.tempId, 'typeId', transactionTypes.find(t => t.balanceEffect === e)?.id)} className={`px-2 py-1 text-[9px] font-black uppercase rounded ${effect === e ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{e}</button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <select value={tx.categoryId} onChange={e => handleUpdate(tx.tempId, 'categoryId', e.target.value)} className="p-1 text-xs border rounded w-full font-bold">
                                                <option value="">Uncategorized</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td className={`px-4 py-2 text-right text-sm font-black font-mono ${effect === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                                            {effect === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => setInspectedTx(tx)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><TableIcon className="w-4 h-4"/></button>
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
