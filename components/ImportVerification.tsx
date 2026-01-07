
import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Counterparty, User, Transaction, ReconciliationRule, Tag, Location } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon, CreditCardIcon, RobotIcon, WrenchIcon, ChevronDownIcon, TagIcon, BoxIcon, MapPinIcon, UserGroupIcon } from './Icons';
import { getTransactionSignature } from '../services/transactionService';
import { applyRulesToTransactions } from '../services/ruleService';
import RuleModal from './RuleModal';
import { generateUUID } from '../utils';

type VerifiableTransaction = RawTransaction & { 
    categoryId: string; 
    tempId: string;
    isIgnored?: boolean;
    conflictType?: 'batch' | 'database' | 'reversal' | null;
};

interface ImportVerificationProps {
    initialTransactions: VerifiableTransaction[];
    onComplete: (verifiedTransactions: (RawTransaction & { categoryId: string })[]) => void;
    onCancel: () => void;
    accounts: Account[];
    categories: Category[];
    transactionTypes: TransactionType[];
    counterparties: Counterparty[];
    locations: Location[];
    users: User[];
    tags: Tag[];
    onSaveRule: (rule: ReconciliationRule) => void;
    onSaveCategory: (category: Category) => void;
    onSaveCounterparty: (p: Counterparty) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
    existingTransactions: Transaction[];
    rules: ReconciliationRule[];
}

type SortKey = 'date' | 'description' | 'counterpartyId' | 'categoryId' | 'amount' | '';
type SortDirection = 'asc' | 'desc';

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    initialTransactions, onComplete, onCancel, accounts, categories, transactionTypes, counterparties, locations, users, tags, onSaveRule, onSaveCategory, onSaveCounterparty, onSaveTag, onAddTransactionType, existingTransactions, rules
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [ruleTransactionContext, setRuleTransactionContext] = useState<Transaction | null>(null);

    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
    const ruleMap = useMemo(() => new Map(rules.map(r => [r.id, r])), [rules]);
    const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

    useEffect(() => {
        const dbSigs = new Set(existingTransactions.map(t => getTransactionSignature(t)));
        const processed = initialTransactions.filter(t => Math.abs(t.amount) > 0.001).map(tx => {
            const sig = getTransactionSignature(tx);
            const conflict = dbSigs.has(sig) ? 'database' : null;
            return { ...tx, conflictType: conflict as any, isIgnored: tx.isIgnored || !!conflict };
        });
        setTransactions(processed);
    }, [initialTransactions, existingTransactions]);

    const handleUpdate = (txId: string, field: keyof VerifiableTransaction, value: any) => {
        setTransactions(prev => prev.map(tx => tx.tempId === txId ? { ...tx, [field]: value } : tx));
    };

    const requestSort = (key: SortKey) => {
        if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('asc'); }
    };

    const sortedTransactions = useMemo(() => {
        if (!sortKey) return transactions;
        return [...transactions].sort((a, b) => {
            let valA = a[sortKey as keyof VerifiableTransaction] as any;
            let valB = b[sortKey as keyof VerifiableTransaction] as any;
            if (sortKey === 'amount') return sortDirection === 'asc' ? valA - valB : valB - valA;
            return sortDirection === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });
    }, [transactions, sortKey, sortDirection]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    
    const handleOpenRuleCreator = (tx: RawTransaction) => {
        setRuleTransactionContext({ ...tx, id: 'temp-context' } as Transaction);
        setIsRuleModalOpen(true);
    };

    const handleOpenExistingRule = (ruleId: string) => {
        const rule = ruleMap.get(ruleId);
        if (rule) {
            setRuleTransactionContext({ ...rule, id: 'temp-context', description: rule.conditions[0]?.value || '' } as any);
            setIsRuleModalOpen(true);
        }
    };

    const handleCreateCounterparty = () => {
        const name = prompt("Counterparty Name:");
        if (name && name.trim()) {
            const cp: Counterparty = { id: generateUUID(), name: name.trim() };
            onSaveCounterparty(cp);
        }
    };

    return (
        <div className="space-y-3 flex flex-col h-full w-full min-h-0 overflow-hidden">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg"><TableIcon className="w-5 h-5 text-indigo-600" /></div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 tracking-tight">Verify Import</h2>
                        <p className="text-[11px] text-slate-500">{transactions.length} records. {transactions.filter(t => t.conflictType === 'database').length} potential duplicates.</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200">Discard</button>
                    <button onClick={() => onComplete(transactions.filter(t => !t.isIgnored))} className="px-6 py-2 bg-indigo-600 text-white font-black rounded-xl shadow-md text-xs hover:bg-indigo-700">Finalize Import</button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar min-h-0">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 w-10 text-center bg-slate-50 border-b border-slate-200">
                                    <input type="checkbox" className="rounded text-indigo-600 h-3.5 w-3.5" checked={selectedIds.size === transactions.length && transactions.length > 0} onChange={() => setSelectedIds(selectedIds.size === transactions.length ? new Set() : new Set(transactions.map(t => t.tempId)))} />
                                </th>
                                <th className="px-2 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Status</th>
                                <th className="px-2 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('date')}>Date</th>
                                <th className="px-2 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('description')}>Description</th>
                                <th className="px-2 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Counterparty</th>
                                <th className="px-2 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Tags</th>
                                <th className="px-2 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Type</th>
                                <th className="px-2 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('categoryId')}>Category</th>
                                <th className="px-2 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('amount')}>Amount</th>
                                <th className="px-2 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Rule</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sortedTransactions.map(tx => {
                                const matchedRule = tx.appliedRuleId ? ruleMap.get(tx.appliedRuleId) : null;
                                const type = typeMap.get(tx.typeId);
                                const amountColor = type?.balanceEffect === 'income' ? 'text-green-600' : type?.balanceEffect === 'neutral' ? 'text-slate-400' : 'text-red-600';
                                return (
                                    <tr key={tx.tempId} className={`transition-all ${tx.isIgnored ? 'opacity-30 bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <td className="p-2 text-center border-b border-slate-100"><input type="checkbox" checked={!tx.isIgnored} onChange={() => handleUpdate(tx.tempId, 'isIgnored', !tx.isIgnored)} className="rounded text-indigo-600 h-3.5 w-3.5" /></td>
                                        <td className="px-2 py-2 border-b border-slate-100">{tx.conflictType === 'database' ? (<span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[7px] font-black rounded uppercase flex items-center gap-1 w-max"><ExclamationTriangleIcon className="w-2 h-2" /> Exists</span>) : (<span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[7px] font-black rounded uppercase w-max">New</span>)}</td>
                                        <td className="px-2 py-2 text-[10px] text-slate-500 font-mono border-b border-slate-100">{tx.date}</td>
                                        <td className="px-2 py-2 text-[12px] font-bold text-slate-700 truncate max-w-[150px] border-b border-slate-100">{tx.description}</td>
                                        <td className="px-2 py-2 border-b border-slate-100"><select value={tx.counterpartyId || ''} onChange={e => handleUpdate(tx.tempId, 'counterpartyId', e.target.value)} className="p-1 text-[10px] border border-slate-200 rounded-md w-full font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 bg-white shadow-none transition-none">{counterparties.sort((a,b)=>a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                                        <td className="px-2 py-2 border-b border-slate-100"><div className="flex flex-wrap gap-0.5">{tx.tagIds?.map(tid => (<span key={tid} className={`px-1 py-0.5 text-[7px] font-black uppercase rounded ${tagMap.get(tid)?.color}`}>{tagMap.get(tid)?.name}</span>))}</div></td>
                                        <td className="px-2 py-2 border-b border-slate-100"><select value={tx.typeId} onChange={e => handleUpdate(tx.tempId, 'typeId', e.target.value)} className="p-1 text-[10px] border border-slate-200 rounded-md w-full font-black uppercase tracking-tighter text-slate-700 focus:border-indigo-500 focus:ring-0 bg-slate-50 shadow-none transition-none">{transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
                                        <td className="px-2 py-2 border-b border-slate-100"><select value={tx.categoryId} onChange={e => handleUpdate(tx.tempId, 'categoryId', e.target.value)} className="p-1 text-[10px] border border-slate-200 rounded-md w-full font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 bg-white shadow-none transition-none">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                                        <td className={`px-2 py-2 text-right text-xs font-black font-mono border-b border-slate-100 ${amountColor}`}>{formatCurrency(tx.amount)}</td>
                                        <td className="px-2 py-2 text-center border-b border-slate-100">{matchedRule ? (<button onClick={() => handleOpenExistingRule(matchedRule.id)} className="p-1 text-green-600 hover:scale-110 transition-transform"><SparklesIcon className="w-3.5 h-3.5" /></button>) : (<button onClick={() => handleOpenRuleCreator(tx)} className="p-1 text-slate-300 hover:text-indigo-600 transition-colors"><WrenchIcon className="w-3.5 h-3.5" /></button>)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {isRuleModalOpen && (
                <RuleModal 
                    isOpen={isRuleModalOpen} 
                    onClose={() => setIsRuleModalOpen(false)} 
                    onSaveRule={(r) => { onSaveRule(r); setIsRuleModalOpen(false); }}
                    accounts={accounts}
                    transactionTypes={transactionTypes}
                    categories={categories}
                    tags={tags}
                    counterparties={counterparties}
                    locations={locations}
                    users={users}
                    transaction={ruleTransactionContext}
                    onSaveCategory={onSaveCategory}
                    onSaveCounterparty={onSaveCounterparty}
                    onSaveTag={onSaveTag}
                    onAddTransactionType={onAddTransactionType}
                    onSaveAndRun={(r) => {
                        onSaveRule(r);
                        const updated = applyRulesToTransactions(transactions, [r], accounts);
                        setTransactions(updated as VerifiableTransaction[]);
                        setIsRuleModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default ImportVerification;
