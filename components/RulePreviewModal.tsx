
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition } from '../types';
import { findMatchingTransactions, evaluateCondition } from '../services/ruleService';
import { CloseIcon, InfoIcon } from './Icons';

interface RulePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (transactionsToUpdate: Transaction[]) => Promise<void>; // Fixed signature to allow async
    rule: ReconciliationRule;
    transactions: Transaction[];
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    payees: Payee[];
}

type MatchedPair = { original: Transaction; updated: Transaction };

const RulePreviewModal: React.FC<RulePreviewModalProps> = ({ isOpen, onClose, onApply, rule, transactions, accounts, transactionTypes, categories, payees }) => {
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p.name])), [payees]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t.name])), [transactionTypes]);

    const matchingPairs = useMemo(() => {
        if (!isOpen) return [];
        return findMatchingTransactions(transactions, rule, accounts, categories);
    }, [isOpen, transactions, rule, accounts, categories]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        if (matchingPairs.length > 0) {
            setSelectedIds(new Set(matchingPairs.map(p => p.original.id)));
        }
    }, [matchingPairs]);

    if (!isOpen) return null;

    const handleToggleSelection = (txId: string) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(txId)) {
            newSelection.delete(txId);
        } else {
            newSelection.add(txId);
        }
        setSelectedIds(newSelection);
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === matchingPairs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(matchingPairs.map(p => p.original.id)));
        }
    };
    
    const handleApply = async () => {
        setIsApplying(true);
        try {
            const transactionsToUpdate = matchingPairs
                .filter(pair => selectedIds.has(pair.original.id))
                .map(pair => pair.updated);
            await onApply(transactionsToUpdate);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to apply updates. Please try again.");
        } finally {
            setIsApplying(false);
        }
    };
    
    const renderChange = (label: string, originalId: string | undefined, updatedId: string | undefined, map: Map<string, string>) => {
        if (originalId === updatedId) return null;
        return (
            <p className="text-xs">
                <span className="font-semibold text-slate-400">{label}:</span>{' '}
                <span className="text-slate-400 line-through">{map.get(originalId || '') || 'None'}</span>
                {' → '}
                <span className="text-green-600 font-bold">{map.get(updatedId || '') || 'None'}</span>
            </p>
        );
    }
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Rule Review: {rule.name}</h2>
                        <p className="text-sm text-slate-500 mt-1">Review matches and pending changes before executing.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-600 transition-colors shadow-sm"><CloseIcon className="w-6 h-6" /></button>
                </header>

                <main className="flex-1 p-6 overflow-y-auto bg-white custom-scrollbar">
                    {matchingPairs.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                <p className="text-sm text-indigo-800 font-medium">Found <span className="font-black">{matchingPairs.length}</span> matching historical records.</p>
                                <button onClick={handleToggleSelectAll} className="text-xs font-black uppercase text-indigo-600 hover:underline">
                                    {selectedIds.size === matchingPairs.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            
                            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Amt</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Info</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Planned Changes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {matchingPairs.map(pair => {
                                            const isSelected = selectedIds.has(pair.original.id);
                                            // Check if match was purely because of original description
                                            const matchesOnlyOriginal = rule.conditions?.some(c => {
                                                if (c.field !== 'description') return false;
                                                const matchesCurrent = (pair.original.description || '').toLowerCase().includes(String(c.value).toLowerCase());
                                                const matchesOriginal = (pair.original.originalDescription || '').toLowerCase().includes(String(c.value).toLowerCase());
                                                return !matchesCurrent && matchesOriginal;
                                            });

                                            return (
                                                <tr key={pair.original.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/30' : 'opacity-60 grayscale'}`}>
                                                    <td className="px-4 py-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleSelection(pair.original.id)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <p className="text-xs font-bold text-slate-500">{pair.original.date}</p>
                                                        <p className="text-sm font-black text-slate-800 font-mono mt-0.5">{formatCurrency(pair.original.amount)}</p>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-700 truncate max-w-[250px]" title={pair.original.description}>{pair.original.description}</p>
                                                            {pair.original.originalDescription && pair.original.originalDescription !== pair.original.description && (
                                                                <p className="text-[10px] text-slate-400 italic mt-0.5 truncate max-w-[250px] flex items-center gap-1">
                                                                    {matchesOnlyOriginal && <span className="bg-amber-100 text-amber-700 font-black px-1 rounded uppercase">Match</span>}
                                                                    Bank: {pair.original.originalDescription}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="space-y-1">
                                                            {renderChange('Category', pair.original.categoryId, pair.updated.categoryId, categoryMap)}
                                                            {renderChange('Payee', pair.original.payeeId, pair.updated.payeeId, payeeMap)}
                                                            {renderChange('Type', pair.original.typeId, pair.updated.typeId, typeMap)}
                                                            {pair.original.description !== pair.updated.description && (
                                                                <p className="text-xs">
                                                                    <span className="font-semibold text-slate-400">Rename:</span>{' '}
                                                                    <span className="text-green-600 font-bold">{pair.updated.description}</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <InfoIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-700">No Historical Matches</h3>
                            <p className="text-slate-500 mt-2 max-w-sm mx-auto">This rule didn't find any existing transactions to update. It will still apply to future imports.</p>
                        </div>
                    )}
                </main>

                <footer className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        {selectedIds.size} of {matchingPairs.length} selected for update
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 py-2.5 font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={selectedIds.size === 0 || isApplying}
                            className="flex-[2] sm:flex-none px-10 py-2.5 font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            {isApplying ? 'Applying...' : 'Update History'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default RulePreviewModal;
