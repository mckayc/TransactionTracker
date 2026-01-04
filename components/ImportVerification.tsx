
import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User, Transaction } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon } from './Icons';
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
    existingTransactions: Transaction[]; // Added this to check against DB
}

type SortKey = 'date' | 'description' | 'payeeId' | 'categoryId' | 'amount' | '';
type SortDirection = 'asc' | 'desc';

/**
 * Side Drawer for inspecting every single column from the original CSV row.
 */
const MetadataDrawer: React.FC<{ 
    tx: VerifiableTransaction | null; 
    onClose: () => void;
}> = ({ tx, onClose }) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    if (!tx || !tx.metadata) return null;

    const copyToClipboard = async (text: string) => {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-md bg-slate-900 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <TableIcon className="w-6 h-6 text-indigo-400" />
                            Source Data Inspector
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Raw CSV Row Contents</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {Object.entries(tx.metadata).map(([key, value]) => (
                        <div key={key} className="group/item bg-white/5 border border-white/5 rounded-xl p-4 hover:border-indigo-500/50 transition-all">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">{key}</span>
                                    <button onClick={() => copyToClipboard(key)} className="p-1 text-slate-500 hover:text-indigo-400 transition-all">
                                        <CopyIcon className={`w-3.5 h-3.5 ${copiedKey === key ? 'text-green-400 scale-110' : ''}`} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-sm text-slate-100 font-medium break-words">
                                {value || <em className="text-slate-700 italic">No data</em>}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 border-t border-white/10 bg-slate-800 flex flex-col gap-3">
                    <button onClick={onClose} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all">Close Inspector</button>
                </div>
            </div>
        </div>
    );
};

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    initialTransactions, 
    onComplete, 
    onCancel,
    accounts,
    categories,
    transactionTypes,
    payees,
    users,
    onCreateRule,
    existingTransactions
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [editingCell, setEditingCell] = useState<{ id: string; field: keyof VerifiableTransaction } | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [inspectedTx, setInspectedTx] = useState<VerifiableTransaction | null>(null);

    // Initial sanitization and analysis
    useEffect(() => {
        // 1. Filter out absolute zeros
        let list = initialTransactions.filter(t => Math.abs(t.amount) > 0.001);

        // 2. Identify issues
        const sigCounts = new Map<string, number>();
        const dbSigs = new Set(existingTransactions.map(t => getTransactionSignature(t)));
        
        // Scan for reversals (+X and -X on same day)
        const reversalCheck = new Map<string, string>(); // Signature (ABS) -> tempId

        const processed = list.map(tx => {
            const sig = getTransactionSignature(tx);
            const absSig = `${tx.date}|${Math.abs(tx.amount).toFixed(2)}|${tx.accountId}`;
            
            let conflict: 'batch' | 'database' | 'reversal' | null = null;
            
            // Check Database
            if (dbSigs.has(sig)) {
                conflict = 'database';
            }
            
            // Check Batch Duplicates
            if (sigCounts.has(sig)) {
                conflict = 'batch';
            }
            sigCounts.set(sig, (sigCounts.get(sig) || 0) + 1);

            // Check Reversals (inverse amounts same day)
            if (reversalCheck.has(absSig)) {
                const prevId = reversalCheck.get(absSig)!;
                // If we found a pair, and they aren't exact duplicates (handled above)
                // we might want to flag them, but it's complex for a list view.
                // For now, let's prioritize exact matches.
            }
            reversalCheck.set(absSig, tx.tempId);

            return {
                ...tx,
                conflictType: conflict,
                isIgnored: tx.isIgnored || conflict === 'database' || conflict === 'batch'
            };
        });

        setTransactions(processed);
    }, [initialTransactions, existingTransactions]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkCategoryId, setBulkCategoryId] = useState('');

    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p.name])), [payees]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);

    const sortedCategoryOptions = useMemo(() => {
        const getSortedOptions = (items: any[], parentId?: string, depth = 0): { id: string, name: string }[] => {
            return items
                .filter(i => i.parentId === parentId)
                .sort((a, b) => a.name.localeCompare(b.name))
                .flatMap(item => [
                    { id: item.id, name: `${'\u00A0'.repeat(depth * 3)}${depth > 0 ? '⌞ ' : ''}${item.name}` },
                    ...getSortedOptions(items, item.id, depth + 1)
                ]);
        };
        return getSortedOptions(categories);
    }, [categories]);

    const sortedPayeeOptions = useMemo(() => {
        const getSortedOptions = (items: any[], parentId?: string, depth = 0): { id: string, name: string }[] => {
            return items
                .filter(i => i.parentId === parentId)
                .sort((a, b) => a.name.localeCompare(b.name))
                .flatMap(item => [
                    { id: item.id, name: `${'\u00A0'.repeat(depth * 3)}${depth > 0 ? '⌞ ' : ''}${item.name}` },
                    ...getSortedOptions(items, item.id, depth + 1)
                ]);
        };
        return getSortedOptions(payees);
    }, [payees]);

    const handleUpdate = (txId: string, field: keyof VerifiableTransaction, value: any) => {
        setTransactions(prev => prev.map(tx => {
            if (tx.tempId === txId) {
                const updatedTx = { ...tx, [field]: value };
                if (field === 'categoryId') updatedTx.category = categoryMap.get(value) || 'Other';
                return updatedTx;
            }
            return tx;
        }));
        setEditingCell(null);
    };

    /**
     * Fix: Implemented missing requestSort function to handle table header sorting.
     */
    const requestSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    /**
     * Fix: Implemented missing handleInputBlur to finalize cell edits on focus loss.
     */
    const handleInputBlur = (e: React.FocusEvent<HTMLSelectElement>, txId: string, field: keyof VerifiableTransaction) => {
        handleUpdate(txId, field, e.target.value);
    };

    /**
     * Fix: Implemented missing handleInputKeyDown to handle keyboard interactions in editable cells.
     */
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>, txId: string, field: keyof VerifiableTransaction) => {
        if (e.key === 'Enter') {
            handleUpdate(txId, field, e.currentTarget.value);
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };
    
    const handleToggleIgnore = (txId: string) => {
        setTransactions(prev => prev.map(tx => tx.tempId === txId ? { ...tx, isIgnored: !tx.isIgnored } : tx));
    };

    const handleDelete = (txId: string) => {
        setTransactions(prev => prev.filter(tx => tx.tempId !== txId));
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(txId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === transactions.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(transactions.map(t => t.tempId)));
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkSkipConflicts = () => {
        setTransactions(prev => prev.map(tx => tx.conflictType ? { ...tx, isIgnored: true } : tx));
    };

    const sortedTransactions = useMemo(() => {
        if (!sortKey) return transactions;
        return [...transactions].sort((a, b) => {
            let valA: any = a[sortKey as keyof VerifiableTransaction];
            let valB: any = b[sortKey as keyof VerifiableTransaction];
            if (typeof valA === 'string') {
                const cmp = valA.localeCompare(valB);
                return sortDirection === 'asc' ? cmp : -cmp;
            }
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });
    }, [transactions, sortKey, sortDirection]);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    
    const getAmountStyles = (tx: VerifiableTransaction) => {
        const type = typeMap.get(tx.typeId);
        if (!type) return { color: 'text-slate-600', prefix: '' };
        if (type.balanceEffect === 'income') return { color: 'text-emerald-600', prefix: '+' };
        if (type.balanceEffect === 'expense') return { color: 'text-rose-600', prefix: '-' };
        return { color: 'text-slate-400', prefix: '' };
    };

    const handleFinalize = () => {
        const toImport = transactions.filter(t => !t.isIgnored);
        if (toImport.length === 0) {
            if (!confirm("No transactions are marked for import. Close preview?")) return;
        }
        onComplete(toImport);
    };

    const importCount = transactions.filter(t => !t.isIgnored).length;
    const skipCount = transactions.filter(t => t.isIgnored).length;
    const conflictCount = transactions.filter(t => !!t.conflictType).length;

    const renderHeader = (label: string, key: SortKey) => (
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort(key)}>
            <div className="flex items-center gap-1">
                {label}
                <SortIcon className={`w-3 h-3 transition-opacity ${sortKey === key ? 'opacity-100 text-indigo-600' : 'opacity-0 group-hover:opacity-50'}`} />
            </div>
        </th>
    );

    return (
        <div className="space-y-4 relative min-h-[400px]">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-indigo-800">Verify Import Data</h2>
                    <p className="text-sm text-indigo-700 mt-1">
                        <span className="text-green-700 font-bold">{importCount} will be imported</span>, 
                        <span className="text-slate-500 font-bold ml-1">{skipCount} will be skipped</span>.
                    </p>
                </div>
                {conflictCount > 0 && (
                    <button onClick={handleBulkSkipConflicts} className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-amber-200 transition-all flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        Skip All {conflictCount} Conflicts
                    </button>
                )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto border rounded-lg shadow-sm bg-white overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 table-fixed border-separate border-spacing-0">
                    <thead className="bg-slate-50 sticky top-0 z-[60] shadow-sm">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">
                                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={transactions.length > 0 && selectedIds.size === transactions.length} onChange={handleSelectAll} />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Status</th>
                            {renderHeader('Date', 'date')}
                            {renderHeader('Description', 'description')}
                            {renderHeader('Source', 'payeeId')}
                            {renderHeader('Category', 'categoryId')}
                            {renderHeader('Amount', 'amount')}
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-20 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {sortedTransactions.map(tx => {
                            const type = typeMap.get(tx.typeId);
                            const isIncome = type?.balanceEffect === 'income';
                            const { color, prefix } = getAmountStyles(tx);

                            return (
                                <tr key={tx.tempId} className={`transition-all hover:relative hover:z-50 ${tx.isIgnored ? 'opacity-40 grayscale bg-slate-50' : 'bg-green-50/30'} ${selectedIds.has(tx.tempId) ? 'ring-2 ring-inset ring-indigo-400' : 'hover:bg-slate-50'}`}>
                                    <td className="px-4 py-2 text-center">
                                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={selectedIds.has(tx.tempId)} onChange={() => toggleSelection(tx.tempId)} />
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => handleToggleIgnore(tx.tempId)} className={`flex items-center gap-1.5 p-1 rounded-lg transition-colors text-[9px] font-black uppercase tracking-tighter ${tx.isIgnored ? 'text-slate-400' : 'text-green-600'}`}>
                                                {tx.isIgnored ? <SlashIcon className="w-3 h-3" /> : <CheckCircleIcon className="w-3 h-3" />}
                                                {tx.isIgnored ? 'Skip' : 'Import'}
                                            </button>
                                            {tx.conflictType === 'database' && (
                                                <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1 rounded border border-amber-100 uppercase inline-block">Duplicate in DB</span>
                                            )}
                                            {tx.conflictType === 'batch' && (
                                                <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1 rounded border border-indigo-100 uppercase inline-block">Batch Duplicate</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-32">{tx.date}</td>
                                    <td className="px-4 py-2 text-sm font-medium text-slate-900 truncate max-w-xs overflow-hidden" title={tx.description}>
                                        <div className="flex items-center gap-2 group">
                                            <span className="truncate">{tx.description}</span>
                                            <button onClick={() => setInspectedTx(tx)} className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <TableIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-500 truncate max-w-[140px]">
                                        {isIncome ? (payeeMap.get(tx.payeeId || '') || <span className="text-slate-300 italic">None</span>) : '--'}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-500 truncate max-w-[140px]">
                                         {editingCell?.id === tx.tempId && editingCell.field === 'categoryId' ? (
                                            <select defaultValue={tx.categoryId} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'categoryId')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'categoryId')} className="w-full p-1 text-xs border rounded">
                                                {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                            </select>
                                        ) : (
                                            <div onClick={() => !tx.isIgnored && setEditingCell({ id: tx.tempId, field: 'categoryId' })} className={`p-1 rounded truncate ${!tx.isIgnored ? 'cursor-pointer hover:bg-white hover:border-slate-200 border border-transparent' : ''}`}>
                                                {categoryMap.get(tx.categoryId) || 'Other'}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium w-32 font-mono">
                                        <span className={color}>{prefix}{formatCurrency(tx.amount)}</span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => handleDelete(tx.tempId)} className="text-slate-400 hover:text-red-600 p-1"><DeleteIcon className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleFinalize} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4" /> Complete Import ({importCount} items)
                </button>
            </div>

            <MetadataDrawer tx={inspectedTx} onClose={() => setInspectedTx(null)} />
        </div>
    );
};

export default ImportVerification;
