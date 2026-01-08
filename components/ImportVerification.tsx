import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Counterparty, User, Transaction, ReconciliationRule, Tag, Location } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon, CreditCardIcon, RobotIcon, WrenchIcon, ChevronDownIcon, TagIcon, BoxIcon, MapPinIcon, UserGroupIcon } from './Icons';
import { getTransactionSignature } from '../services/transactionService';
import { applyRulesToTransactions } from '../services/ruleService';
import RuleModal from './RuleModal';
import { generateUUID } from '../utils';
import SearchableSelect from './SearchableSelect';
import EntityModal from './EntityModal';
import { EntityType } from './EntityEditor';

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
    onSaveLocation: (loc: Location) => void;
    onSaveUser: (user: User) => void;
    onAddTransactionType: (type: TransactionType) => void;
    existingTransactions: Transaction[];
    rules: ReconciliationRule[];
}

type SortKey = 'date' | 'description' | 'counterpartyId' | 'categoryId' | 'amount' | '';
type SortDirection = 'asc' | 'desc';

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    initialTransactions, onComplete, onCancel, accounts, categories, transactionTypes, counterparties, locations, users, tags, onSaveRule, onSaveCategory, onSaveCounterparty, onSaveTag, onSaveLocation, onSaveUser, onAddTransactionType, existingTransactions, rules
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // UI State
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [ruleTransactionContext, setRuleTransactionContext] = useState<Transaction | null>(null);
    const [quickAddType, setQuickAddType] = useState<EntityType | null>(null);
    const [activeTxForQuickAdd, setActiveTxForQuickAdd] = useState<string | null>(null);

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

    const handleQuickAddSave = (type: EntityType, payload: any) => {
        switch (type) {
            case 'categories': onSaveCategory(payload); if (activeTxForQuickAdd) handleUpdate(activeTxForQuickAdd, 'categoryId', payload.id); break;
            case 'counterparties': onSaveCounterparty(payload); if (activeTxForQuickAdd) handleUpdate(activeTxForQuickAdd, 'counterpartyId', payload.id); break;
            case 'locations': onSaveLocation(payload); if (activeTxForQuickAdd) handleUpdate(activeTxForQuickAdd, 'locationId', payload.id); break;
            case 'users': onSaveUser(payload); if (activeTxForQuickAdd) handleUpdate(activeTxForQuickAdd, 'userId', payload.id); break;
            case 'transactionTypes': onAddTransactionType(payload); if (activeTxForQuickAdd) handleUpdate(activeTxForQuickAdd, 'typeId', payload.id); break;
            case 'tags': onSaveTag(payload); break;
        }
        setQuickAddType(null);
        setActiveTxForQuickAdd(null);
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
                                const amountColor = type?.balanceEffect === 'incoming' ? 'text-green-600' : type?.balanceEffect === 'neutral' ? 'text-slate-400' : 'text-red-600';
                                
                                // Dynamic row background: dim if ignored, light green if rule matched, standard hover otherwise
                                const rowClass = tx.isIgnored 
                                    ? 'opacity-30 bg-slate-50' 
                                    : matchedRule 
                                        ? 'bg-emerald-50/60 hover:bg-emerald-100/70' 
                                        : 'hover:bg-slate-50';

                                return (
                                    <tr key={tx.tempId} className={`transition-all ${rowClass}`}>
                                        <td className="p-2 text-center border-b border-slate-100"><input type="checkbox" checked={!tx.isIgnored} onChange={() => handleUpdate(tx.tempId, 'isIgnored', !tx.isIgnored)} className="rounded text-indigo-600 h-3.5 w-3.5" /></td>
                                        <td className="px-2 py-2 border-b border-slate-100">{tx.conflictType === 'database' ? (<span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[7px] font-black rounded uppercase flex items-center gap-1 w-max"><ExclamationTriangleIcon className="w-2 h-2" /> Exists</span>) : (<span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[7px] font-black rounded uppercase w-max">New</span>)}</td>
                                        <td className="px-2 py-2 text-[10px] text-slate-500 font-mono border-b border-slate-100">{tx.date}</td>
                                        <td className="px-2 py-2 border-b border-slate-100 max-w-[200px]">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[12px] font-bold text-slate-700 truncate" title={tx.description}>{tx.description}</span>
                                                {tx.originalDescription && tx.originalDescription !== tx.description && (
                                                    <span className="text-[9px] text-slate-400 font-mono truncate uppercase tracking-tighter" title={tx.originalDescription}>{tx.originalDescription}</span>
                                                )}
                                            </div>
                                        </td>
                                        
                                        <td className="px-2 py-2 border-b border-slate-100 min-w-[160px]">
                                            <SearchableSelect 
                                                options={counterparties} 
                                                value={tx.counterpartyId || ''} 
                                                onChange={val => handleUpdate(tx.tempId, 'counterpartyId', val)}
                                                placeholder="Entity..."
                                                isHierarchical
                                                onAddNew={() => { setActiveTxForQuickAdd(tx.tempId); setQuickAddType('counterparties'); }}
                                                className="!bg-transparent"
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-100 min-w-[120px]">
                                            <SearchableSelect 
                                                options={transactionTypes} 
                                                value={tx.typeId} 
                                                onChange={val => handleUpdate(tx.tempId, 'typeId', val)}
                                                placeholder="Type..."
                                                onAddNew={() => { setActiveTxForQuickAdd(tx.tempId); setQuickAddType('transactionTypes'); }}
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-100 min-w-[160px]">
                                            <SearchableSelect 
                                                options={categories} 
                                                value={tx.categoryId} 
                                                onChange={val => handleUpdate(tx.tempId, 'categoryId', val)}
                                                placeholder="Category..."
                                                isHierarchical
                                                onAddNew={() => { setActiveTxForQuickAdd(tx.tempId); setQuickAddType('categories'); }}
                                            />
                                        </td>

                                        <td className={`px-2 py-2 text-right text-xs font-black font-mono border-b border-slate-100 ${amountColor}`}>{formatCurrency(tx.amount)}</td>
                                        <td className="px-2 py-2 text-center border-b border-slate-100">
                                            {matchedRule ? (
                                                <button onClick={() => handleOpenExistingRule(matchedRule.id)} className="p-1 text-green-600 hover:scale-110 transition-transform flex flex-col items-center gap-0.5" title="Rule Applied Automatically">
                                                    <SparklesIcon className="w-3.5 h-3.5" />
                                                    <span className="text-[6px] font-black uppercase tracking-tighter">Applied</span>
                                                </button>
                                            ) : (
                                                <button onClick={() => handleOpenRuleCreator(tx)} className="p-1 text-slate-300 hover:text-indigo-600 transition-colors"><WrenchIcon className="w-3.5 h-3.5" /></button>
                                            )}
                                        </td>
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
                    onSaveLocation={onSaveLocation}
                    onSaveUser={onSaveUser}
                    onAddTransactionType={onAddTransactionType}
                    onSaveAndRun={(r) => {
                        onSaveRule(r);
                        const updated = applyRulesToTransactions(transactions, [r], accounts);
                        setTransactions(updated as VerifiableTransaction[]);
                        setIsRuleModalOpen(false);
                    }}
                    existingRules={rules}
                />
            )}

            <EntityModal 
                isOpen={!!quickAddType}
                onClose={() => { setQuickAddType(null); setActiveTxForQuickAdd(null); }}
                type={quickAddType || 'categories'}
                onSave={handleQuickAddSave}
                categories={categories}
                tags={tags}
                counterparties={counterparties}
                locations={locations}
                users={users}
                transactionTypes={transactionTypes}
                accountTypes={[]}
                accounts={accounts}
            />
        </div>
    );
};

export default ImportVerification;