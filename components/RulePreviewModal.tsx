import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category } from '../types';
import { findMatchingTransactions } from '../services/ruleService';
import { CloseIcon } from './Icons';

interface RulePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (transactionsToUpdate: Transaction[]) => void;
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
        return findMatchingTransactions(transactions, rule);
    }, [isOpen, transactions, rule]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    
    const handleApply = () => {
        const transactionsToUpdate = matchingPairs
            .filter(pair => selectedIds.has(pair.original.id))
            .map(pair => pair.updated);
        onApply(transactionsToUpdate);
    };
    
    const renderChange = (label: string, originalId: string | undefined, updatedId: string | undefined, map: Map<string, string>) => {
        if (originalId === updatedId) return null;
        return (
            <p className="text-xs">
                <span className="font-semibold">{label}:</span>{' '}
                <span className="text-slate-500 line-through">{map.get(originalId || '') || 'None'}</span>
                {' → '}
                <span className="text-green-600 font-semibold">{map.get(updatedId || '') || 'None'}</span>
            </p>
        );
    }
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Run Rule: {rule.name}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </header>

                <main className="flex-1 p-4 overflow-y-auto">
                    {matchingPairs.length > 0 ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">This rule matches <span className="font-bold">{matchingPairs.length}</span> transaction(s). Uncheck any you don't want to change.</p>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={selectedIds.size === matchingPairs.length}
                                                    onChange={handleToggleSelectAll}
                                                />
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Changes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {matchingPairs.map(pair => (
                                            <tr key={pair.original.id}>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        checked={selectedIds.has(pair.original.id)}
                                                        onChange={() => handleToggleSelection(pair.original.id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-500 whitespace-nowrap">{pair.original.date}</td>
                                                <td className="px-4 py-2 text-sm text-slate-800 max-w-xs truncate" title={pair.original.description}>{pair.original.description}</td>
                                                <td className="px-4 py-2">
                                                    {renderChange('Category', pair.original.categoryId, pair.updated.categoryId, categoryMap)}
                                                    {renderChange('Payee', pair.original.payeeId, pair.updated.payeeId, payeeMap)}
                                                    {renderChange('Type', pair.original.typeId, pair.updated.typeId, typeMap)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <h3 className="text-lg font-semibold text-slate-600">No Matching Transactions</h3>
                            <p className="text-sm text-slate-500 mt-2">This rule did not find any existing transactions to update.</p>
                        </div>
                    )}
                </main>

                <footer className="p-4 bg-slate-50 border-t flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-600">{selectedIds.size} of {matchingPairs.length} selected for update.</p>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300">Cancel</button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={selectedIds.size === 0}
                            className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
                        >
                            Apply Changes
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default RulePreviewModal;
