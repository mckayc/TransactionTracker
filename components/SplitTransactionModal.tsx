
import React, { useState, useEffect } from 'react';
import type { Transaction, Category, TransactionType } from '../types';
import { CloseIcon, SplitIcon, AddIcon, DeleteIcon } from './Icons';
import { generateUUID } from '../utils';

interface SplitTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
    categories: Category[];
    transactionTypes: TransactionType[];
    onSplit: (parent: Transaction, children: Transaction[]) => void;
}

interface SplitItem {
    id: string;
    description: string;
    amount: number;
    categoryId: string;
    typeId: string;
}

const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({ isOpen, onClose, transaction, categories, transactionTypes, onSplit }) => {
    const [splits, setSplits] = useState<SplitItem[]>([]);
    
    useEffect(() => {
        if (isOpen && transaction) {
            // Initialize with two splits by default: One with original amount, one with 0
            const typeId = transaction.typeId;
            const categoryId = transaction.categoryId;
            
            setSplits([
                {
                    id: generateUUID(),
                    description: transaction.description,
                    amount: transaction.amount,
                    categoryId: categoryId,
                    typeId: typeId
                },
                {
                    id: generateUUID(),
                    description: 'Split 2',
                    amount: 0,
                    categoryId: categoryId,
                    typeId: typeId
                }
            ]);
        }
    }, [isOpen, transaction]);

    if (!isOpen || !transaction) return null;

    const originalAmount = transaction.amount;
    const currentTotal = splits.reduce((sum, item) => sum + (item.amount || 0), 0);
    const remaining = originalAmount - currentTotal;
    const isBalanced = Math.abs(remaining) < 0.01;

    const handleUpdateSplit = (id: string, field: keyof SplitItem, value: any) => {
        setSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : s));
    };

    const handleAddSplit = () => {
        setSplits(prev => [...prev, {
            id: generateUUID(),
            description: `Split ${prev.length + 1}`,
            amount: 0,
            categoryId: transaction.categoryId,
            typeId: transaction.typeId
        }]);
    };

    const handleRemoveSplit = (id: string) => {
        if (splits.length <= 2) {
            alert("A split transaction must have at least 2 parts.");
            return;
        }
        setSplits(prev => prev.filter(s => s.id !== id));
    };

    const handleSave = () => {
        if (!isBalanced) {
            alert(`The splits must sum up to the original amount of ${originalAmount.toFixed(2)}.`);
            return;
        }

        // Parent Logic: The original transaction becomes the Parent container.
        const parent: Transaction = {
            ...transaction,
            isParent: true,
            linkGroupId: transaction.linkGroupId || generateUUID() // Generate group ID if not exists
        };

        const children: Transaction[] = splits.map(s => {
            const catName = categories.find(c => c.id === s.categoryId)?.name || 'Split';
            return {
                id: generateUUID(),
                date: transaction.date,
                description: s.description,
                amount: s.amount,
                categoryId: s.categoryId,
                category: catName,
                typeId: s.typeId,
                accountId: transaction.accountId,
                // Use counterpartyId instead of payeeId to match types.ts
                counterpartyId: transaction.counterpartyId,
                userId: transaction.userId,
                location: transaction.location,
                sourceFilename: transaction.sourceFilename,
                linkGroupId: parent.linkGroupId, // Link to parent's group
                parentTransactionId: transaction.id // Explicit link to parent
            };
        });

        onSplit(parent, children);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <SplitIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Split Transaction</h2>
                            <p className="text-sm text-slate-500">Break down <span className="font-mono font-bold">${originalAmount.toFixed(2)}</span> into multiple categories.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="space-y-3">
                        {splits.map((split, index) => (
                            <div key={split.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-3 relative group">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase">Split {index + 1}</h4>
                                    {splits.length > 2 && (
                                        <button onClick={() => handleRemoveSplit(split.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                            <DeleteIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                    <div className="sm:col-span-4">
                                        <input 
                                            type="text" 
                                            value={split.description} 
                                            onChange={(e) => handleUpdateSplit(split.id, 'description', e.target.value)}
                                            className="w-full p-2 text-sm border rounded-md"
                                            placeholder="Description"
                                        />
                                    </div>
                                    <div className="sm:col-span-3">
                                        <select 
                                            value={split.categoryId} 
                                            onChange={(e) => handleUpdateSplit(split.id, 'categoryId', e.target.value)}
                                            className="w-full p-2 text-sm border rounded-md"
                                        >
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-3">
                                        <select 
                                            value={split.typeId} 
                                            onChange={(e) => handleUpdateSplit(split.id, 'typeId', e.target.value)}
                                            className="w-full p-2 text-sm border rounded-md"
                                        >
                                            {transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={split.amount} 
                                            onChange={(e) => handleUpdateSplit(split.id, 'amount', e.target.value)}
                                            className="w-full p-2 text-sm border rounded-md font-mono text-right font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={handleAddSplit} 
                        className="mt-4 flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        <AddIcon className="w-4 h-4" /> Add Split
                    </button>
                </div>

                <div className={`p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 ${isBalanced ? 'bg-green-50' : 'bg-red-50'} rounded-b-xl`}>
                    <div className="flex items-center gap-4 text-sm">
                        <div>
                            <span className="block text-xs font-bold uppercase text-slate-500">Remaining</span>
                            <span className={`font-mono font-bold text-lg ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                                {remaining.toFixed(2)}
                            </span>
                        </div>
                        {!isBalanced && <p className="text-red-600 font-medium text-xs">Must be 0.00 to save</p>}
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={!isBalanced}
                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition-colors"
                        >
                            Save Splits
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SplitTransactionModal;
