
import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon } from './Icons';

type VerifiableTransaction = RawTransaction & { 
    categoryId: string; 
    tempId: string;
    isIgnored?: boolean; 
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
}

type SortKey = 'date' | 'description' | 'payeeId' | 'categoryId' | 'amount' | '';
type SortDirection = 'asc' | 'desc';

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    initialTransactions, 
    onComplete, 
    onCancel,
    accounts,
    categories,
    transactionTypes,
    payees,
    users,
    onCreateRule
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [editingCell, setEditingCell] = useState<{ id: string; field: keyof VerifiableTransaction } | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    
    useEffect(() => {
        setTransactions(initialTransactions);
    }, [initialTransactions]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkCategoryId, setBulkCategoryId] = useState('');

    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p.name])), [payees]);

    const getSortedOptions = (items: any[], parentId?: string, depth = 0): { id: string, name: string }[] => {
        return items
            .filter(i => i.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .flatMap(item => [
                { id: item.id, name: `${'\u00A0'.repeat(depth * 3)}${depth > 0 ? '⌞ ' : ''}${item.name}` },
                ...getSortedOptions(items, item.id, depth + 1)
            ]);
    };

    const sortedPayeeOptions = useMemo(() => getSortedOptions(payees), [payees]);
    const sortedCategoryOptions = useMemo(() => getSortedOptions(categories), [categories]);

    const handleUpdate = (txId: string, field: keyof VerifiableTransaction, value: any) => {
        setTransactions(prev => prev.map(tx => {
            if (tx.tempId === txId) {
                const updatedTx = { ...tx, [field]: value };
                if (field === 'categoryId') updatedTx.category = categoryMap.get(value) || 'Other';
                if (field === 'payeeId') updatedTx.payee = payeeMap.get(value) || '';
                return updatedTx;
            }
            return tx;
        }));
        setEditingCell(null);
    };
    
    const handleToggleIgnore = (txId: string) => {
        setTransactions(prev => prev.map(tx => 
            tx.tempId === txId ? { ...tx, isIgnored: !tx.isIgnored } : tx
        ));
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
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.tempId)));
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkStatusUpdate = (ignore: boolean) => {
        setTransactions(prev => prev.map(tx => 
            selectedIds.has(tx.tempId) ? { ...tx, isIgnored: ignore } : tx
        ));
        setSelectedIds(new Set());
    };

    const handleBulkDelete = () => {
        if (confirm(`Delete ${selectedIds.size} transactions from preview?`)) {
            setTransactions(prev => prev.filter(tx => !selectedIds.has(tx.tempId)));
            setSelectedIds(new Set());
        }
    };

    const handleBulkCategoryUpdate = () => {
        if (!bulkCategoryId) return;
        const catName = categoryMap.get(bulkCategoryId) || 'Other';
        setTransactions(prev => prev.map(tx => {
            if (selectedIds.has(tx.tempId)) {
                return { ...tx, categoryId: bulkCategoryId, category: catName };
            }
            return tx;
        }));
        setBulkCategoryId('');
        setSelectedIds(new Set());
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>, txId: string, field: keyof VerifiableTransaction) => {
        handleUpdate(txId, field, e.currentTarget.value);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, txId: string, field: keyof VerifiableTransaction) => {
        if (e.key === 'Enter') handleUpdate(txId, field, e.currentTarget.value);
        else if (e.key === 'Escape') setEditingCell(null);
    };
    
    const requestSort = (key: SortKey) => {
        setSortDirection(prev => (sortKey === key && prev === 'asc' ? 'desc' : 'asc'));
        setSortKey(key);
    };

    const sortedTransactions = useMemo(() => {
        if (!sortKey) return transactions;
        const result = [...transactions].sort((a, b) => {
            let valA: any = a[sortKey as keyof VerifiableTransaction];
            let valB: any = b[sortKey as keyof VerifiableTransaction];

            if (sortKey === 'categoryId') {
                valA = categoryMap.get(a.categoryId) || '';
                valB = categoryMap.get(b.categoryId) || '';
            } else if (sortKey === 'payeeId') {
                valA = payeeMap.get(a.payeeId || '') || '';
                valB = payeeMap.get(b.payeeId || '') || '';
            }

            if (typeof valA === 'string') {
                const cmp = valA.localeCompare(valB);
                return sortDirection === 'asc' ? cmp : -cmp;
            }
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });
        return result;
    }, [transactions, sortKey, sortDirection, categoryMap, payeeMap]);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    const commonInputClass = "w-full p-1 text-sm rounded-md border-indigo-500 ring-1 ring-indigo-500 focus:outline-none bg-white";

    const handleFinalize = () => {
        const toImport = transactions.filter(t => !t.isIgnored);
        if (toImport.length === 0) {
            if (!confirm("No transactions are marked for import. Close preview?")) return;
        }
        onComplete(toImport);
    };

    const importCount = transactions.filter(t => !t.isIgnored).length;
    const skipCount = transactions.filter(t => t.isIgnored).length;

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
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-start">
                <div>
                    <h2 className="text-lg font-bold text-indigo-800">Verify Import Data</h2>
                    <p className="text-sm text-indigo-700 mt-1">
                        Showing all rows from file. <span className="text-green-700 font-bold">{importCount} will be imported</span>, 
                        <span className="text-slate-500 font-bold ml-1">{skipCount} will be skipped (transfers/ignored)</span>.
                    </p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-indigo-100 flex gap-4 text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1 text-green-600"><div className="w-2 h-2 rounded-full bg-green-500"></div> Import</div>
                    <div className="flex items-center gap-1 text-slate-400"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Skip</div>
                </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto border rounded-lg shadow-sm bg-white">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">
                                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={transactions.length > 0 && selectedIds.size === transactions.length} onChange={handleSelectAll} />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-20">Status</th>
                            {renderHeader('Date', 'date')}
                            {renderHeader('Description', 'description')}
                            {renderHeader('Income Source', 'payeeId')}
                            {renderHeader('Category', 'categoryId')}
                            {renderHeader('Amount', 'amount')}
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {sortedTransactions.map(tx => {
                            const matchedSkipRule = tx.isIgnored && initialTransactions.find(it => it.tempId === tx.tempId)?.isIgnored;
                            return (
                                <tr key={tx.tempId} className={`transition-all ${tx.isIgnored ? 'opacity-40 grayscale bg-slate-50' : 'bg-green-50/30'} ${selectedIds.has(tx.tempId) ? 'ring-2 ring-inset ring-indigo-400' : 'hover:bg-slate-50'}`}>
                                    <td className="px-4 py-2 text-center">
                                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={selectedIds.has(tx.tempId)} onChange={() => toggleSelection(tx.tempId)} />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <button onClick={() => handleToggleIgnore(tx.tempId)} className={`p-1.5 rounded-lg transition-colors ${tx.isIgnored ? 'text-slate-400 hover:text-indigo-600' : 'text-green-600 hover:text-red-500'}`} title={tx.isIgnored ? "Mark for Import" : "Ignore / Skip"}>
                                                {tx.isIgnored ? <SlashIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-5 h-5" />}
                                            </button>
                                            {matchedSkipRule && (
                                                <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter leading-none">Skip Rule</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-32">
                                         {editingCell?.id === tx.tempId && editingCell.field === 'date' ? (
                                            <input type="date" defaultValue={tx.date} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'date')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'date')} className={commonInputClass} />
                                        ) : (
                                            <div onClick={() => !tx.isIgnored && setEditingCell({ id: tx.tempId, field: 'date' })} className={`p-1 rounded-md ${!tx.isIgnored ? 'cursor-pointer hover:bg-white border border-transparent hover:border-slate-200' : ''}`}>{tx.date}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-medium text-slate-900 max-w-sm">
                                        {editingCell?.id === tx.tempId && editingCell.field === 'description' ? (
                                            <input type="text" defaultValue={tx.description} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'description')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'description')} className={commonInputClass} />
                                        ) : (
                                            <div onClick={() => !tx.isIgnored && setEditingCell({ id: tx.tempId, field: 'description' })} className={`p-1 rounded-md truncate ${!tx.isIgnored ? 'cursor-pointer hover:bg-white border border-transparent hover:border-slate-200' : ''}`} title={tx.description}>{tx.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-48">
                                         {editingCell?.id === tx.tempId && editingCell.field === 'payeeId' ? (
                                            <select defaultValue={tx.payeeId || ''} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'payeeId')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'payeeId')} className={commonInputClass}>
                                                <option value="">-- No Source --</option>
                                                {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        ) : (
                                            <div onClick={() => !tx.isIgnored && setEditingCell({ id: tx.tempId, field: 'payeeId' })} className={`p-1 rounded-md truncate ${!tx.isIgnored ? 'cursor-pointer hover:bg-white border border-transparent hover:border-slate-200' : ''}`}>{payeeMap.get(tx.payeeId || '') || <span className="text-slate-300 italic">New Source</span>}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-48">
                                         {editingCell?.id === tx.tempId && editingCell.field === 'categoryId' ? (
                                            <select defaultValue={tx.categoryId} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'categoryId')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'categoryId')} className={commonInputClass}>
                                                {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                            </select>
                                        ) : (
                                            <div onClick={() => !tx.isIgnored && setEditingCell({ id: tx.tempId, field: 'categoryId' })} className={`p-1 rounded-md ${!tx.isIgnored ? 'cursor-pointer hover:bg-white border border-transparent hover:border-slate-200' : ''}`}>{categoryMap.get(tx.categoryId) || 'N/A'}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-slate-700 w-32">
                                         {editingCell?.id === tx.tempId && editingCell.field === 'amount' ? (
                                            <input type="number" step="0.01" defaultValue={tx.amount} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'amount')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'amount')} className={`${commonInputClass} text-right`} />
                                        ) : (
                                            <div onClick={() => !tx.isIgnored && setEditingCell({ id: tx.tempId, field: 'amount' })} className={`p-1 rounded-md ${!tx.isIgnored ? 'cursor-pointer hover:bg-white border border-transparent hover:border-slate-200' : ''}`}>{formatCurrency(tx.amount)}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-center w-24">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => onCreateRule?.(tx)} className="text-slate-400 hover:text-indigo-600 p-1" title="Create Automation Rule from this row"><SparklesIcon className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(tx.tempId)} className="text-slate-400 hover:text-red-600 p-1" title="Delete from import"><DeleteIcon className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end items-center gap-3 pt-4 border-t">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleFinalize} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4" /> Complete Import ({importCount} items)
                </button>
            </div>

            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-slate-200 p-3 rounded-xl shadow-2xl z-50 flex flex-col sm:flex-row items-center gap-4 animate-slide-up">
                    <div className="flex items-center gap-3 border-r border-slate-200 pr-4 mr-2">
                        <span className="font-bold text-slate-700 text-sm">{selectedIds.size} Selected</span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"><CloseIcon className="w-3 h-3" /></button>
                    </div>
                    <div className="flex items-center gap-2 border-r border-slate-100 pr-4 mr-2">
                         <button onClick={() => handleBulkStatusUpdate(false)} className="bg-green-50 text-green-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-green-100 transition-colors uppercase tracking-wide border border-green-200">Mark for Import</button>
                        <button onClick={() => handleBulkStatusUpdate(true)} className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-100 transition-colors uppercase tracking-wide border border-slate-200">Skip / Ignore</button>
                    </div>
                    <div className="flex items-center gap-2">
                         <select value={bulkCategoryId} onChange={e => setBulkCategoryId(e.target.value)} className="p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none max-w-[140px]">
                            <option value="">Select Category...</option>
                            {sortedCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                         <button onClick={handleBulkCategoryUpdate} disabled={!bulkCategoryId} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide">Set Cat</button>
                    </div>
                    <div className="border-l border-slate-200 pl-4 ml-2"><button onClick={handleBulkDelete} className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold transition-colors uppercase tracking-wide">Delete</button></div>
                </div>
            )}
        </div>
    );
};

export default ImportVerification;
