
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, TransactionType, Account, Category } from '../types';
import { CloseIcon, LinkIcon, CheckCircleIcon, SparklesIcon } from './Icons';
import { generateUUID } from '../utils';

interface LinkTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    transactionTypes: TransactionType[];
    accounts: Account[];
    categories: Category[];
    onSave: (updates: Transaction[]) => void;
    onFindSimilar: (updates: Transaction[]) => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const LinkTransactionModal: React.FC<LinkTransactionModalProps> = ({ isOpen, onClose, transactions, transactionTypes, accounts, categories, onSave, onFindSimilar }) => {
    // State to track local changes to type/category before saving
    const [configs, setConfigs] = useState<Record<string, { typeId: string, categoryId: string, role: 'transfer' | 'expense' }>>({});
    const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());

    // Initialize state when modal opens or transactions change
    useEffect(() => {
        if (isOpen) {
            const transferType = transactionTypes.find(t => t.balanceEffect === 'transfer');
            const expenseType = transactionTypes.find(t => t.balanceEffect === 'expense');
            
            const initialConfigs: Record<string, any> = {};
            const initialIncluded = new Set<string>();
            
            // Heuristic: Highest amount is likely the transfer source, others are splits
            const sortedByAmount = [...transactions].sort((a, b) => b.amount - a.amount);
            const likelyTransfer = sortedByAmount[0];

            transactions.forEach(tx => {
                const isTransfer = tx.id === likelyTransfer.id;
                initialIncluded.add(tx.id);
                initialConfigs[tx.id] = {
                    typeId: isTransfer ? (transferType?.id || tx.typeId) : (tx.typeId === transferType?.id ? (expenseType?.id || tx.typeId) : tx.typeId),
                    categoryId: tx.categoryId,
                    role: isTransfer ? 'transfer' : 'expense'
                };
            });
            setConfigs(initialConfigs);
            setIncludedIds(initialIncluded);
        }
    }, [isOpen, transactions, transactionTypes]);

    const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

    const handleRoleChange = (txId: string, role: 'transfer' | 'expense') => {
        const transferType = transactionTypes.find(t => t.balanceEffect === 'transfer');
        const expenseType = transactionTypes.find(t => t.balanceEffect === 'expense');
        
        setConfigs(prev => ({
            ...prev,
            [txId]: {
                ...prev[txId],
                role,
                typeId: role === 'transfer' ? (transferType?.id || prev[txId].typeId) : (expenseType?.id || prev[txId].typeId)
            }
        }));
    };

    const handleConfigChange = (txId: string, field: 'typeId' | 'categoryId', value: string) => {
        setConfigs(prev => ({
            ...prev,
            [txId]: { ...prev[txId], [field]: value }
        }));
    };

    const toggleInclude = (id: string) => {
        const newSet = new Set(includedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setIncludedIds(newSet);
    };

    const getUpdates = () => {
        const linkGroupId = generateUUID();
        return transactions
            .filter(tx => includedIds.has(tx.id))
            .map(tx => ({
                ...tx,
                linkGroupId,
                typeId: configs[tx.id].typeId,
                categoryId: configs[tx.id].categoryId
            }));
    };

    const handleSave = () => {
        const updates = getUpdates();
        if (updates.length < 2) {
            alert("You must select at least 2 transactions to link.");
            return;
        }
        onSave(updates);
        onClose();
    };

    const handleSaveAndFindSimilar = () => {
        const updates = getUpdates();
        if (updates.length < 2) {
            alert("You must select at least 2 transactions to link.");
            return;
        }
        onFindSimilar(updates);
        onClose();
    };

    // Calculations for the summary (only included transactions)
    const activeTransactions = transactions.filter(tx => includedIds.has(tx.id));
    
    const totalTransfer = activeTransactions
        .filter(tx => configs[tx.id]?.role === 'transfer')
        .reduce((sum, tx) => sum + tx.amount, 0);
        
    const totalExpense = activeTransactions
        .filter(tx => configs[tx.id]?.role === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0);

    const isBalanced = Math.abs(totalTransfer - totalExpense) < 0.01;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <LinkIcon className="w-6 h-6 text-indigo-600" />
                            Link & Reconcile
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Link payments to their splits. Uncheck items to exclude them.</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                {/* Summary Bar */}
                <div className={`px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 ${isBalanced ? 'bg-green-50' : 'bg-amber-50'}`}>
                    <div className="flex gap-8 text-sm">
                        <div>
                            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Total Transfer</span>
                            <span className="text-lg font-bold text-slate-800">{formatCurrency(totalTransfer)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Total Allocation</span>
                            <span className="text-lg font-bold text-slate-800">{formatCurrency(totalExpense)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isBalanced ? (
                            <span className="flex items-center gap-1 text-green-700 font-bold text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                                <CheckCircleIcon className="w-4 h-4" /> Balanced
                            </span>
                        ) : (
                            <span className="text-amber-700 font-bold text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                                Difference: {formatCurrency(Math.abs(totalTransfer - totalExpense))}
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="space-y-3">
                        {transactions.map(tx => {
                            const config = configs[tx.id];
                            const isIncluded = includedIds.has(tx.id);
                            if (!config) return null;

                            return (
                                <div key={tx.id} className={`bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex gap-4 items-center transition-all ${isIncluded ? '' : 'opacity-60 bg-slate-50'}`}>
                                    
                                    {/* Selection Checkbox */}
                                    <div className="flex-shrink-0">
                                        <input 
                                            type="checkbox" 
                                            checked={isIncluded} 
                                            onChange={() => toggleInclude(tx.id)}
                                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </div>

                                    {/* Transaction Data */}
                                    <div className={`flex-grow flex flex-col sm:flex-row gap-4 items-center ${isIncluded ? '' : 'pointer-events-none grayscale'}`}>
                                        {/* Info Section */}
                                        <div className="flex-grow min-w-0 text-sm w-full">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-slate-700">{tx.date}</span>
                                                <span className="font-mono font-bold text-slate-900">{formatCurrency(tx.amount)}</span>
                                            </div>
                                            <p className="truncate text-slate-600" title={tx.description}>{tx.description}</p>
                                            <p className="text-xs text-slate-400 mt-1">{accountMap.get(tx.accountId || '')}</p>
                                        </div>

                                        {/* Controls Section */}
                                        <div className="flex flex-col sm:flex-row items-center gap-3 min-w-[350px]">
                                            
                                            {/* Role Toggle */}
                                            <div className="flex bg-slate-100 p-1 rounded-lg flex-shrink-0">
                                                <button 
                                                    onClick={() => handleRoleChange(tx.id, 'transfer')}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${config.role === 'transfer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    Transfer
                                                </button>
                                                <button 
                                                    onClick={() => handleRoleChange(tx.id, 'expense')}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${config.role === 'expense' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    Expense
                                                </button>
                                            </div>

                                            {/* Type/Category Selects */}
                                            <div className="flex flex-col gap-2 w-full">
                                                <select 
                                                    value={config.typeId || ''} 
                                                    onChange={(e) => handleConfigChange(tx.id, 'typeId', e.target.value)}
                                                    className="text-xs p-1.5 border rounded w-full"
                                                >
                                                    {transactionTypes.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                {config.role === 'expense' && (
                                                    <select 
                                                        value={config.categoryId || ''} 
                                                        onChange={(e) => handleConfigChange(tx.id, 'categoryId', e.target.value)}
                                                        className="text-xs p-1.5 border rounded w-full"
                                                    >
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-xs text-slate-500">
                        {activeTransactions.length} item(s) selected for linking.
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto justify-end">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveAndFindSimilar}
                            disabled={activeTransactions.length < 2}
                            className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Link these items and ask AI to find other similar patterns in your history"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            Link & Find Similar
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={activeTransactions.length < 2}
                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <LinkIcon className="w-4 h-4" />
                            Link Only
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LinkTransactionModal;
