import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Counterparty, Category } from '../types';
import { findMatchingTransactions } from '../services/ruleService';
import { CloseIcon, SparklesIcon, CheckCircleIcon } from './Icons';

interface RulePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (transactionsToUpdate: Transaction[]) => void;
    rule: ReconciliationRule;
    transactions: Transaction[];
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    payees: Counterparty[];
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount);

const RulePreviewModal: React.FC<RulePreviewModalProps> = ({ isOpen, onClose, onApply, rule, transactions, accounts, transactionTypes, categories, payees }) => {
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const counterpartyMap = useMemo(() => new Map(payees.map(p => [p.id, p.name])), [payees]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t.name])), [transactionTypes]);

    const matchingPairs = useMemo(() => {
        if (!isOpen) return [];
        return findMatchingTransactions(transactions, rule, accounts);
    }, [isOpen, transactions, rule, accounts]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (matchingPairs.length > 0) {
            setSelectedIds(new Set(matchingPairs.map(p => p.original.id)));
        }
    }, [matchingPairs]);

    if (!isOpen) return null;

    const handleToggleSelection = (txId: string) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(txId)) newSelection.delete(txId);
        else newSelection.add(txId);
        setSelectedIds(newSelection);
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === matchingPairs.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(matchingPairs.map(p => p.original.id)));
    };
    
    const handleApply = () => {
        const transactionsToUpdate = matchingPairs
            .filter(pair => selectedIds.has(pair.original.id))
            .map(pair => pair.updated);
        onApply(transactionsToUpdate);
    };
    
    const renderChange = (label: string, originalId: string | undefined, updatedId: string | undefined, map: Map<string, string>) => {
        if (!updatedId || originalId === updatedId) return null;
        return (
            <div className="text-[10px] leading-tight">
                <span className="font-bold text-slate-400 uppercase mr-1">{label}:</span>
                <span className="text-slate-400 line-through">{map.get(originalId || '') || 'None'}</span>
                <span className="mx-1 text-slate-400">→</span>
                <span className="text-indigo-600 font-bold">{map.get(updatedId) || 'None'}</span>
            </div>
        );
    };
    
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-indigo-600" />
                            Run Rule Preview: {rule.name}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Impact Analysis</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                </header>

                <main className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">
                    {matchingPairs.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                <p className="text-sm text-indigo-900 font-medium">This logic matches <span className="font-black underline">{matchingPairs.length}</span> historical records.</p>
                                <button onClick={handleToggleSelectAll} className="text-xs font-black text-indigo-600 uppercase hover:underline">
                                    {selectedIds.size === matchingPairs.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                                <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 w-10 border-b"></th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Date</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Description</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Updates Applied</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {matchingPairs.map(pair => (
                                            <tr key={pair.original.id} className={`transition-colors ${selectedIds.has(pair.original.id) ? 'bg-indigo-50/20' : 'opacity-40 grayscale bg-slate-50'}`}>
                                                <td className="px-4 py-3 text-center border-b">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-50 cursor-pointer"
                                                        checked={selectedIds.has(pair.original.id)}
                                                        onChange={() => handleToggleSelection(pair.original.id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap border-b">{pair.original.date}</td>
                                                <td className="px-4 py-3 text-sm text-slate-800 max-w-xs truncate border-b font-bold" title={pair.original.description}>{pair.original.description}</td>
                                                <td className="px-4 py-3 border-b space-y-1">
                                                    {renderChange('Category', pair.original.categoryId, pair.updated.categoryId, categoryMap)}
                                                    {renderChange('Counterparty', pair.original.counterpartyId, pair.updated.counterpartyId, counterpartyMap)}
                                                    {renderChange('Type', pair.original.typeId, pair.updated.typeId, typeMap)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <CloseIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Historical Matches</h3>
                            <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto font-medium">This logic is valid, but no existing transactions match the criteria.</p>
                        </div>
                    )}
                </main>

                <footer className="p-6 bg-slate-50 border-t flex justify-between items-center rounded-b-2xl">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{selectedIds.size} of {matchingPairs.length} targeted</p>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all shadow-sm">Discard</button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={selectedIds.size === 0}
                            className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-30 disabled:hover:bg-indigo-600 flex items-center gap-2"
                        >
                            <CheckCircleIcon className="w-5 h-5" />
                            Apply Historical Update
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default RulePreviewModal;