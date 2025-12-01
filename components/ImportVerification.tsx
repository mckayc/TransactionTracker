
import React, { useState, useMemo } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User } from '../types';
import { DeleteIcon, CloseIcon } from './Icons';

type VerifiableTransaction = RawTransaction & { categoryId: string; tempId: string };

interface ImportVerificationProps {
    initialTransactions: VerifiableTransaction[];
    onComplete: (verifiedTransactions: (RawTransaction & { categoryId: string })[]) => void;
    onCancel: () => void;
    accounts: Account[];
    categories: Category[];
    transactionTypes: TransactionType[];
    payees: Payee[];
    users: User[];
}

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    initialTransactions, 
    onComplete, 
    onCancel,
    accounts,
    categories,
    transactionTypes,
    payees,
    users
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>(initialTransactions);
    const [editingCell, setEditingCell] = useState<{ id: string; field: keyof VerifiableTransaction } | null>(null);
    
    // Bulk Edit State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDate, setBulkDate] = useState('');
    const [bulkCategoryId, setBulkCategoryId] = useState('');

    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
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

    const handleUpdate = (txId: string, field: keyof VerifiableTransaction, value: any) => {
        setTransactions(prev => prev.map(tx => {
            if (tx.tempId === txId) {
                const updatedTx = { ...tx, [field]: value };
                // If categoryId is changed, also update the category name string
                if (field === 'categoryId') {
                    updatedTx.category = categoryMap.get(value) || 'Other';
                }
                return updatedTx;
            }
            return tx;
        }));
        setEditingCell(null);
    };
    
    const handleDelete = (txId: string) => {
        setTransactions(prev => prev.filter(tx => tx.tempId !== txId));
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(txId);
            return newSet;
        });
    };

    // Bulk Actions
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

    const handleBulkDelete = () => {
        if (confirm(`Delete ${selectedIds.size} transactions?`)) {
            setTransactions(prev => prev.filter(tx => !selectedIds.has(tx.tempId)));
            setSelectedIds(new Set());
        }
    };

    const handleBulkDateUpdate = () => {
        if (!bulkDate) return;
        setTransactions(prev => prev.map(tx => {
            if (selectedIds.has(tx.tempId)) {
                return { ...tx, date: bulkDate };
            }
            return tx;
        }));
        setBulkDate('');
        // Optional: keep selection or clear. Clearing often feels cleaner after an action.
        setSelectedIds(new Set()); 
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
        if (e.key === 'Enter') {
          handleUpdate(txId, field, e.currentTarget.value);
        } else if (e.key === 'Escape') {
          setEditingCell(null);
        }
    };
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };
    
    const commonInputClass = "w-full p-1 text-sm rounded-md border-indigo-500 ring-1 ring-indigo-500 focus:outline-none";

    return (
        <div className="space-y-4 relative min-h-[400px]">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <h2 className="text-lg font-bold text-indigo-800">Verify Import ({transactions.length} Transactions)</h2>
                <p className="text-sm text-indigo-700 mt-1">Review the parsed transactions below. You can edit any field, select multiple rows to bulk edit, or delete rows before completing the import.</p>
            </div>

            <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={transactions.length > 0 && selectedIds.size === transactions.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            {['Date', 'Description', 'Category', 'Amount', 'Actions'].map(header => (
                                <th key={header} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {transactions.map(tx => (
                            <tr key={tx.tempId} className={selectedIds.has(tx.tempId) ? 'bg-indigo-50' : 'hover:bg-slate-50 transition-colors'}>
                                <td className="px-4 py-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={selectedIds.has(tx.tempId)}
                                        onChange={() => toggleSelection(tx.tempId)}
                                    />
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-32">
                                     {editingCell?.id === tx.tempId && editingCell.field === 'date' ? (
                                        <input type="date" defaultValue={tx.date} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'date')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'date')} className={commonInputClass} />
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'date' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-white border border-transparent hover:border-slate-200">{tx.date}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-slate-900 max-w-sm">
                                    {editingCell?.id === tx.tempId && editingCell.field === 'description' ? (
                                        <input type="text" defaultValue={tx.description} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'description')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'description')} className={commonInputClass} />
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'description' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-white border border-transparent hover:border-slate-200 truncate" title={tx.description}>{tx.description}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-48">
                                     {editingCell?.id === tx.tempId && editingCell.field === 'categoryId' ? (
                                        <select defaultValue={tx.categoryId} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'categoryId')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'categoryId')} className={commonInputClass}>
                                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'categoryId' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-white border border-transparent hover:border-slate-200">{categoryMap.get(tx.categoryId) || 'N/A'}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-slate-700 w-32">
                                     {editingCell?.id === tx.tempId && editingCell.field === 'amount' ? (
                                        <input type="number" step="0.01" defaultValue={tx.amount} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'amount')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'amount')} className={`${commonInputClass} text-right`} />
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'amount' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-white border border-transparent hover:border-slate-200">{formatCurrency(tx.amount)}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center w-20">
                                    <button onClick={() => handleDelete(tx.tempId)} className="text-slate-400 hover:text-red-600 p-1" title="Delete from import">
                                        <DeleteIcon className="w-4 h-4"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end items-center gap-3 pt-4 border-t">
                 <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel Import</button>
                <button onClick={() => onComplete(transactions)} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
                    Complete Import
                </button>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-slate-200 p-3 rounded-xl shadow-2xl z-50 flex flex-col sm:flex-row items-center gap-4 animate-slide-up">
                    <div className="flex items-center gap-3 border-r border-slate-200 pr-4 mr-2">
                        <span className="font-bold text-slate-700 text-sm">{selectedIds.size} Selected</span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1">
                            <CloseIcon className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={bulkDate} 
                            onChange={e => setBulkDate(e.target.value)} 
                            className="p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none" 
                        />
                        <button 
                            onClick={handleBulkDateUpdate} 
                            disabled={!bulkDate} 
                            className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
                        >
                            Set Date
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                         <select 
                            value={bulkCategoryId} 
                            onChange={e => setBulkCategoryId(e.target.value)} 
                            className="p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none max-w-[140px]"
                        >
                            <option value="">Select Category...</option>
                            {sortedCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                         <button 
                            onClick={handleBulkCategoryUpdate} 
                            disabled={!bulkCategoryId} 
                            className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
                        >
                            Set Cat
                        </button>
                    </div>

                    <div className="border-l border-slate-200 pl-4 ml-2">
                        <button 
                            onClick={handleBulkDelete} 
                            className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold transition-colors uppercase tracking-wide"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportVerification;
