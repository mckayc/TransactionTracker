import React, { useState, useMemo } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User } from '../types';
import { DeleteIcon } from './Icons';

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
        <div className="space-y-4">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <h2 className="text-lg font-bold text-indigo-800">Verify Import ({transactions.length} Transactions)</h2>
                <p className="text-sm text-indigo-700 mt-1">Review the parsed transactions below. You can edit any field or delete rows before completing the import.</p>
            </div>

            <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0">
                        <tr>
                            {['Date', 'Description', 'Category', 'Amount', 'Actions'].map(header => (
                                <th key={header} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {transactions.map(tx => (
                            <tr key={tx.tempId}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-32">
                                     {editingCell?.id === tx.tempId && editingCell.field === 'date' ? (
                                        <input type="date" defaultValue={tx.date} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'date')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'date')} className={commonInputClass} />
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'date' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100">{tx.date}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-slate-900 max-w-sm">
                                    {editingCell?.id === tx.tempId && editingCell.field === 'description' ? (
                                        <input type="text" defaultValue={tx.description} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'description')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'description')} className={commonInputClass} />
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'description' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100 truncate" title={tx.description}>{tx.description}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 w-48">
                                     {editingCell?.id === tx.tempId && editingCell.field === 'categoryId' ? (
                                        <select defaultValue={tx.categoryId} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'categoryId')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'categoryId')} className={commonInputClass}>
                                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'categoryId' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100">{categoryMap.get(tx.categoryId) || 'N/A'}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-slate-700 w-32">
                                     {editingCell?.id === tx.tempId && editingCell.field === 'amount' ? (
                                        <input type="number" step="0.01" defaultValue={tx.amount} autoFocus onBlur={(e) => handleInputBlur(e, tx.tempId, 'amount')} onKeyDown={(e) => handleInputKeyDown(e, tx.tempId, 'amount')} className={`${commonInputClass} text-right`} />
                                    ) : (
                                        <div onClick={() => setEditingCell({ id: tx.tempId, field: 'amount' })} className="cursor-pointer rounded-md p-1 -m-1 hover:bg-slate-100">{formatCurrency(tx.amount)}</div>
                                    )}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center w-20">
                                    <button onClick={() => handleDelete(tx.tempId)} className="text-red-500 hover:text-red-700" title="Delete from import">
                                        <DeleteIcon className="w-5 h-5"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end items-center gap-3 pt-4 border-t">
                 <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border rounded-lg hover:bg-slate-50">Cancel Import</button>
                <button onClick={() => onComplete(transactions)} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    Complete Import
                </button>
            </div>
        </div>
    );
};

export default ImportVerification;