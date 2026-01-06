
import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User, Transaction, BalanceEffect, ReconciliationRule, Tag, Merchant, Location, FlowDesignation } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon, CreditCardIcon, RobotIcon, WrenchIcon, ChevronDownIcon, TagIcon, BoxIcon, MapPinIcon, UserGroupIcon, RepeatIcon } from './Icons';
import { getTransactionSignature } from '../services/transactionService';
import { applyRulesToTransactions } from '../services/ruleService';
import RuleModal from './RuleModal';

type VerifiableTransaction = RawTransaction & { 
    categoryId: string; 
    tempId: string;
    isIgnored?: boolean;
    conflictType?: 'batch' | 'database' | 'reversal' | null;
};

interface ImportVerificationProps {
    rawTransactions: RawTransaction[];
    onComplete: (verifiedTransactions: (RawTransaction & { categoryId: string })[]) => void;
    onCancel: () => void;
    accounts: Account[];
    categories: Category[];
    transactionTypes: TransactionType[];
    flowDesignations: FlowDesignation[];
    payees: Payee[];
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    tags: Tag[];
    onSaveRule: (rule: ReconciliationRule) => void;
    onSaveCategory: (category: Category) => void;
    onSavePayee: (payee: Payee) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
    existingTransactions: Transaction[];
    rules: ReconciliationRule[];
}

type SortKey = 'date' | 'description' | 'payeeId' | 'categoryId' | 'amount' | '';
type SortDirection = 'asc' | 'desc';

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    rawTransactions, onComplete, onCancel, accounts, categories, transactionTypes, flowDesignations, payees, merchants, locations, users, tags, onSaveRule, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, existingTransactions, rules
}) => {
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [inspectedTxId, setInspectedTxId] = useState<string | null>(null);
    const [inspectedRuleId, setInspectedRuleId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // User manual overrides are stored locally. Manual choices always win over rules.
    const [manualOverrides, setManualOverrides] = useState<Record<string, Partial<VerifiableTransaction>>>({});

    // 1. Prepare truly raw base with consistent IDs and duplicate detection
    const baseTransactions = useMemo(() => {
        const dbSigs = new Set(existingTransactions.map(t => getTransactionSignature(t)));
        const defaultUserId = users.find(u => u.isDefault)?.id || users[0]?.id || 'user_primary';
        const otherCategoryId = categories.find(c => c.name.toLowerCase() === 'other')?.id || categories[0]?.id || '';

        return rawTransactions.map((raw, idx) => {
            const sig = getTransactionSignature(raw);
            const conflict = dbSigs.has(sig) ? 'database' : null;
            const tempId = `import_${idx}`;

            return { 
                ...raw, 
                userId: raw.userId || defaultUserId,
                tempId,
                conflictType: conflict as any, 
                isIgnored: !!conflict,
                categoryId: otherCategoryId
            };
        });
    }, [rawTransactions, existingTransactions, users, categories]);

    // 2. Reactively project the rule-applied state whenever rules change
    // This derived state ensures "Save and Apply" works instantly.
    const ruleAppliedTransactions = useMemo(() => {
        return applyRulesToTransactions(baseTransactions as any, rules, accounts) as VerifiableTransaction[];
    }, [baseTransactions, rules, accounts]);

    // 3. Final merge: Rule results + Manual Overrides
    const displayedTransactions = useMemo(() => {
        return ruleAppliedTransactions.map(applied => {
            const override = manualOverrides[applied.tempId];
            return { ...applied, ...override };
        });
    }, [ruleAppliedTransactions, manualOverrides]);

    const handleUpdateManual = (txId: string, field: keyof VerifiableTransaction, value: any) => {
        setManualOverrides(prev => ({
            ...prev,
            [txId]: { ...(prev[txId] || {}), [field]: value }
        }));
    };

    const sortedTransactions = useMemo(() => {
        if (!sortKey) return displayedTransactions;
        return [...displayedTransactions].sort((a, b) => {
            let valA = a[sortKey as keyof VerifiableTransaction] as any;
            let valB = b[sortKey as keyof VerifiableTransaction] as any;
            if (sortKey === 'amount') return sortDirection === 'asc' ? valA - valB : valB - valA;
            return sortDirection === 'asc' ? (String(valA).localeCompare(String(valB))) : (String(valB).localeCompare(String(valA)));
        });
    }, [displayedTransactions, sortKey, sortDirection]);

    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
    const ruleMap = useMemo(() => new Map(rules.map(r => [r.id, r])), [rules]);
    const flowMap = useMemo(() => new Map(flowDesignations.map(f => [f.id, f])), [flowDesignations]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [ruleTransactionContext, setRuleTransactionContext] = useState<Transaction | null>(null);

    return (
        <div className="space-y-4 flex flex-col h-full w-full min-h-0 overflow-hidden">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl"><TableIcon className="w-6 h-6 text-indigo-600" /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Verify Import</h2>
                        <p className="text-sm text-slate-500">Recalculating {displayedTransactions.length} records against {rules.length} patterns.</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={onCancel} className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Discard</button>
                    <button onClick={() => onComplete(displayedTransactions.filter(t => !t.isIgnored))} className="flex-1 sm:flex-none px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Finalize Import</button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar min-h-0">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 text-center bg-slate-50 border-b border-slate-200"><input type="checkbox" className="rounded text-indigo-600 h-4 w-4" checked={selectedIds.size === displayedTransactions.length && displayedTransactions.length > 0} onChange={() => setSelectedIds(selectedIds.size === displayedTransactions.length ? new Set() : new Set(displayedTransactions.map(t => t.tempId)))} /></th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Status</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:text-indigo-600" onClick={() => { setSortKey('date'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>Date <SortIcon className="w-3 h-3 inline ml-1"/></th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Description</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Designation</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Category</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amount</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Logic</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sortedTransactions.map(tx => {
                                const type = typeMap.get(tx.typeId);
                                const effect = type?.balanceEffect || 'expense';
                                const matchedRule = tx.appliedRuleId ? ruleMap.get(tx.appliedRuleId) : null;
                                const impact = flowMap.get(tx.flowDesignationId || '')?.impact;
                                
                                return (
                                    <tr key={tx.tempId} className={`transition-all ${tx.isIgnored ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <td className="p-4 text-center"><input type="checkbox" checked={!tx.isIgnored} onChange={() => handleUpdateManual(tx.tempId, 'isIgnored', !tx.isIgnored)} className="rounded text-indigo-600 h-4 w-4" /></td>
                                        <td className="px-4 py-2">{tx.conflictType === 'database' ? (<span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase flex items-center gap-1 w-max">Duplicate</span>) : (<span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase w-max">New</span>)}</td>
                                        <td className="px-4 py-2 text-xs text-slate-500 font-mono">{tx.date}</td>
                                        <td className="px-4 py-2 text-sm font-bold text-slate-700 truncate max-w-xs">{tx.description}</td>
                                        <td className="px-4 py-2 min-w-[150px]">
                                            <select value={tx.flowDesignationId || ''} onChange={e => handleUpdateManual(tx.tempId, 'flowDesignationId', e.target.value)} className="p-1.5 text-[10px] border border-slate-200 rounded-lg w-full font-black uppercase tracking-tight text-slate-600 focus:border-indigo-500 bg-white shadow-sm">
                                                <option value="">No Designation</option>
                                                {flowDesignations.map(fd => <option key={fd.id} value={fd.id}>{fd.name} ({fd.impact})</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <select value={tx.categoryId} onChange={e => handleUpdateManual(tx.tempId, 'categoryId', e.target.value)} className="p-1.5 text-xs border border-slate-200 rounded-lg w-full font-bold text-slate-700 focus:border-indigo-500 bg-white shadow-sm">
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td className={`px-4 py-2 text-right text-sm font-black font-mono ${effect === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount)}</td>
                                        <td className="px-4 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {matchedRule && <button onClick={() => { setInspectedRuleId(matchedRule.id); setRuleTransactionContext(tx as any); setIsRuleModalOpen(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 border border-green-200 shadow-sm"><SparklesIcon className="w-4 h-4" /></button>}
                                                <button onClick={() => { setRuleTransactionContext(tx as any); setIsRuleModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><WrenchIcon className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <RuleModal 
                isOpen={isRuleModalOpen} 
                onClose={() => { setIsRuleModalOpen(false); setRuleTransactionContext(null); setInspectedRuleId(null); }} 
                onSaveRule={onSaveRule}
                accounts={accounts}
                transactionTypes={transactionTypes}
                flowDesignations={flowDesignations}
                categories={categories}
                tags={tags}
                payees={payees}
                merchants={merchants}
                locations={locations}
                users={users}
                transaction={ruleTransactionContext}
                existingRule={inspectedRuleId ? ruleMap.get(inspectedRuleId) : null}
            />
        </div>
    );
};

export default ImportVerification;
