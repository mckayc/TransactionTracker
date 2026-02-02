
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Category, TransactionType } from '../types';
import { CloseIcon, SplitIcon, AddIcon, DeleteIcon, CheckCircleIcon, ExclamationTriangleIcon, CheckBadgeIcon, InfoIcon } from './Icons';
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
    const [splitTitle, setSplitTitle] = useState('');
    const [splits, setSplits] = useState<SplitItem[]>([]);
    
    useEffect(() => {
        if (isOpen && transaction) {
            setSplitTitle(transaction.description);
            const typeId = transaction.typeId;
            const categoryId = transaction.categoryId;
            
            setSplits([
                {
                    id: generateUUID(),
                    description: 'Allocation 1',
                    amount: transaction.amount,
                    categoryId: categoryId,
                    typeId: typeId
                },
                {
                    id: generateUUID(),
                    description: 'Allocation 2',
                    amount: 0,
                    categoryId: categoryId,
                    typeId: typeId
                }
            ]);
        }
    }, [isOpen, transaction]);

    const originalAmount = transaction?.amount || 0;
    const currentTotal = splits.reduce((sum, item) => sum + (item.amount || 0), 0);
    const remaining = originalAmount - currentTotal;
    const isBalanced = Math.abs(remaining) < 0.01;

    // Logic to suggest the correct balance for the FIRST part if the others change
    const suggestedFirstPartAmount = useMemo(() => {
        if (splits.length < 2) return originalAmount;
        const sumOthers = splits.slice(1).reduce((sum, item) => sum + (item.amount || 0), 0);
        return Math.max(0, originalAmount - sumOthers);
    }, [splits, originalAmount]);

    const showSuggestion = !isBalanced && splits.length > 1;

    if (!isOpen || !transaction) return null;

    const handleUpdateSplit = (id: string, field: keyof SplitItem, value: any) => {
        setSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : s));
    };

    const applySuggestion = () => {
        setSplits(prev => {
            const next = [...prev];
            next[0] = { ...next[0], amount: suggestedFirstPartAmount };
            return next;
        });
    };

    const handleAddSplit = () => {
        setSplits(prev => [...prev, {
            id: generateUUID(),
            description: `Split Item ${prev.length + 1}`,
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
            alert(`The total of all splits must equal the original amount of $${originalAmount.toFixed(2)}.`);
            return;
        }

        // The parent remains in the database as a hidden container
        const parent: Transaction = {
            ...transaction,
            description: splitTitle || transaction.description,
            isParent: true,
            linkGroupId: transaction.linkGroupId || generateUUID() 
        };

        // Children represent the actual impact in the ledger
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
                counterpartyId: transaction.counterpartyId,
                userId: transaction.userId,
                location: transaction.location,
                sourceFilename: transaction.sourceFilename,
                linkGroupId: parent.linkGroupId,
                parentTransactionId: transaction.id
            };
        });

        onSplit(parent, children);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                            <SplitIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Split Registry Entry</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                Allocating <span className="text-slate-800 font-black font-mono">${originalAmount.toFixed(2)}</span> total
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><CloseIcon className="w-8 h-8" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 custom-scrollbar">
                    {/* Master description for the container */}
                    <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1 mb-1 block">Master Ledger Entry Title</label>
                        <input 
                            type="text" 
                            value={splitTitle} 
                            onChange={(e) => setSplitTitle(e.target.value)}
                            className="w-full p-4 text-lg font-black border-2 border-slate-50 bg-slate-50/50 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none"
                            placeholder="Enter main record title..."
                        />
                    </div>

                    <div className="space-y-4">
                        {splits.map((split, index) => (
                            <div key={split.id} className={`bg-white p-6 rounded-3xl border-2 shadow-sm flex flex-col gap-4 relative group transition-all ${index === 0 ? 'border-indigo-100' : 'border-slate-100'} hover:border-indigo-300`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${index === 0 ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                            Part {index + 1} {index === 0 ? '(Primary)' : ''}
                                        </span>
                                    </div>
                                    {index > 0 && (
                                        <button onClick={() => handleRemoveSplit(split.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <DeleteIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Specific Part Description</label>
                                        <input 
                                            type="text" 
                                            value={split.description} 
                                            onChange={(e) => handleUpdateSplit(split.id, 'description', e.target.value)}
                                            className="w-full p-3 text-sm font-bold border-2 border-slate-50 bg-slate-50/50 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none"
                                            placeholder="Description for this part..."
                                        />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Category / Type</label>
                                        <div className="space-y-2">
                                            <select 
                                                value={split.categoryId} 
                                                onChange={(e) => handleUpdateSplit(split.id, 'categoryId', e.target.value)}
                                                className="w-full p-2.5 text-[11px] font-black border-2 border-slate-50 bg-slate-50/50 rounded-xl outline-none uppercase tracking-tighter"
                                            >
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            <select 
                                                value={split.typeId} 
                                                onChange={(e) => handleUpdateSplit(split.id, 'typeId', e.target.value)}
                                                className="w-full p-2.5 text-[11px] font-black border-2 border-slate-50 bg-slate-50/50 rounded-xl outline-none uppercase tracking-tighter"
                                            >
                                                {transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-300">$</span>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={split.amount} 
                                                onChange={(e) => handleUpdateSplit(split.id, 'amount', e.target.value)}
                                                className="w-full p-3 pl-8 text-lg font-black border-2 border-slate-50 bg-slate-50/50 rounded-2xl font-mono text-right focus:bg-white focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        {index === 0 && showSuggestion && (
                                            <button 
                                                onClick={applySuggestion}
                                                className="mt-2 w-full p-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                                            >
                                                <InfoIcon className="w-3 h-3" /> Auto-Balance to ${suggestedFirstPartAmount.toFixed(2)}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={handleAddSplit} 
                        className="w-full py-6 rounded-3xl border-4 border-dashed border-slate-200 flex items-center justify-center gap-3 text-slate-400 hover:border-indigo-200 hover:text-indigo-400 transition-all font-black uppercase tracking-widest text-xs"
                    >
                        <AddIcon className="w-6 h-6" /> Add New Part Definition
                    </button>
                </div>

                <div className={`p-8 border-t bg-white flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0`}>
                    <div className="flex items-center gap-10">
                        <div className="space-y-1">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Total Unallocated</span>
                            <div className="flex items-center gap-3">
                                <span className={`font-mono font-black text-3xl transition-colors ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ${remaining.toFixed(2)}
                                </span>
                                {isBalanced && <CheckCircleIcon className="w-8 h-8 text-emerald-500 animate-fade-in" />}
                            </div>
                        </div>
                        {!isBalanced && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 animate-pulse">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Unbalanced Logic</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button onClick={onClose} className="px-10 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all">Abort</button>
                        <button 
                            onClick={handleSave} 
                            disabled={!isBalanced}
                            className="flex-2 sm:flex-none px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-30 disabled:shadow-none transition-all text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3"
                        >
                            <CheckBadgeIcon className="w-5 h-5" /> Commit Split Logic
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SplitTransactionModal;
