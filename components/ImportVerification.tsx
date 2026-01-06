
import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User, Transaction, BalanceEffect, ReconciliationRule, Tag, Merchant, Location, SystemSettings } from '../types';
import { 
    DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, 
    SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon, 
    CreditCardIcon, RobotIcon, WrenchIcon, ChevronDownIcon, TagIcon, 
    BoxIcon, MapPinIcon, CloudArrowUpIcon, ShieldCheckIcon, UsersIcon, 
    UserGroupIcon, LightBulbIcon, EditIcon, EyeIcon 
} from './Icons';
import { getTransactionSignature } from '../services/transactionService';
import { getRuleSignature, applyRulesToTransactions } from '../services/ruleService';
import { generateRulesFromData, hasApiKey } from '../services/geminiService';
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
    systemSettings?: SystemSettings;
}

type SortKey = 'date' | 'description' | 'payeeId' | 'categoryId' | 'amount' | '';
type SortDirection = 'asc' | 'desc';

const MetadataDrawer: React.FC<{ tx: VerifiableTransaction | null; onClose: () => void; }> = ({ tx, onClose }) => {
    if (!tx || !tx.metadata) return null;
    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-slate-900 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-white/10 bg-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Line Inspector</h3>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold">Raw Source Data</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {Object.entries(tx.metadata).map(([k, v]) => (
                        <div key={k} className="bg-white/5 border border-white/5 rounded-xl p-4">
                            <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">{k}</p>
                            <p className="text-sm text-slate-100 font-medium break-words">{v || <em className="text-slate-700 italic">empty</em>}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const RuleInspectorDrawer: React.FC<{ 
    rule: ReconciliationRule | null; 
    onClose: () => void; 
    categories: Category[]; 
    payees: Payee[]; 
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    tags: Tag[];
    types: TransactionType[];
    onEdit: (rule: ReconciliationRule) => void;
}> = ({ rule, onClose, categories, payees, merchants, locations, users, tags, types, onEdit }) => {
    if (!rule) return null;

    const getCatName = (id?: string) => categories.find(c => c.id === id)?.name || 'Unknown';
    const getPayeeName = (id?: string) => payees.find(p => p.id === id)?.name || 'Unknown';
    const getMerchantName = (id?: string) => merchants.find(m => m.id === id)?.name || 'Unknown';
    const getLocationName = (id?: string) => locations.find(l => l.id === id)?.name || 'Unknown';
    const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Unknown';
    const getTypeName = (id?: string) => types.find(t => t.id === id)?.name || 'Unknown';
    const getTagName = (id: string) => tags.find(t => t.id === id)?.name || id;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-slate-900 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-white/10 bg-indigo-900 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-indigo-400" />
                            Rule Inspector
                        </h3>
                        <p className="text-xs text-indigo-300 mt-1 uppercase font-bold tracking-widest">{rule.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onEdit(rule)} className="p-2 text-white/50 hover:text-white rounded-full transition-colors" title="Edit Rule"><WrenchIcon className="w-5 h-5"/></button>
                        <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full"><CloseIcon className="w-6 h-6" /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    <div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Matching Logic</h4>
                        <div className="space-y-2">
                            {(rule.conditions || []).map((c, i) => (
                                <div key={c.id} className="bg-white/5 border border-white/5 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Field: {c.field}</p>
                                        {i < (rule.conditions?.length || 0) - 1 && (
                                            <span className="px-1.5 py-0.5 bg-indigo-600/30 text-indigo-300 text-[8px] font-black rounded uppercase">{c.nextLogic || 'AND'}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-200">
                                        <span className="text-indigo-400 font-bold">{c.operator?.replace('_', ' ') || ''}</span> "{c.value}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-4">Atomic Transforms</h4>
                        <div className="bg-green-900/10 border border-green-900/20 rounded-2xl p-4 space-y-4">
                            {rule.skipImport && <div className="flex items-center gap-2 text-red-400 font-bold text-sm"><SlashIcon className="w-4 h-4" /> Automatically Ignored</div>}
                            {rule.setCategoryId && <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Category</span><span className="font-bold text-slate-100 bg-white/5 px-2 py-1 rounded-lg">{getCatName(rule.setCategoryId)}</span></div>}
                            {rule.setMerchantId && <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Merchant</span><span className="font-bold text-slate-100 bg-white/5 px-2 py-1 rounded-lg">{getMerchantName(rule.setMerchantId)}</span></div>}
                            {rule.setLocationId && <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Location</span><span className="font-bold text-slate-100 bg-white/5 px-2 py-1 rounded-lg">{getLocationName(rule.setLocationId)}</span></div>}
                            {rule.setUserId && <div className="flex justify-between items-center text-sm"><span className="text-slate-400">User</span><span className="font-bold text-slate-100 bg-white/5 px-2 py-1 rounded-lg">{getUserName(rule.setUserId)}</span></div>}
                            {rule.setPayeeId && <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Payee</span><span className="font-bold text-slate-100 bg-white/5 px-2 py-1 rounded-lg">{getPayeeName(rule.setPayeeId)}</span></div>}
                            {rule.setTransactionTypeId && <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Type</span><span className="font-bold text-slate-100 bg-white/5 px-2 py-1 rounded-lg">{getTypeName(rule.setTransactionTypeId)}</span></div>}
                            {rule.assignTagIds && rule.assignTagIds.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-xs text-slate-400 block">Append Taxonomy Tags</span>
                                    <div className="flex flex-wrap gap-1">
                                        {rule.assignTagIds.map(tid => (
                                            <span key={tid} className={`px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-widest`}>{getTagName(tid)}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ImportVerification: React.FC<ImportVerificationProps> = ({ 
    initialTransactions, onComplete, onCancel, accounts, categories, transactionTypes, payees, merchants, locations, users, tags, onSaveRule, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, existingTransactions, rules, systemSettings
}) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [inspectedTx, setInspectedTx] = useState<VerifiableTransaction | null>(null);
    const [inspectedRule, setInspectedRule] = useState<ReconciliationRule | null>(null);
    const [ruleContextTx, setRuleContextTx] = useState<VerifiableTransaction | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Bulk AI Forge State
    const [isAiForgeOpen, setIsAiForgeOpen] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiProposedRules, setAiProposedRules] = useState<(ReconciliationRule & { isExcluded?: boolean })[]>([]);
    const [skippedDuplicateCount, setSkippedDuplicateCount] = useState(0);

    // Inline Rule Creator State
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
            
            let finalPayeeId = tx.payeeId;
            if (tx.payeeId?.startsWith('guess_')) {
                const guessedName = tx.payeeId.replace('guess_', '');
                const match = payees.find(p => p.name.toLowerCase() === guessedName.toLowerCase());
                finalPayeeId = match ? match.id : undefined;
            }

            return { ...tx, payeeId: finalPayeeId, conflictType: conflict as any, isIgnored: tx.isIgnored || !!conflict };
        });
        setTransactions(processed);
    }, [initialTransactions, existingTransactions, payees]);

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

    // --- Bulk AI Forge Logic ---
    const handleSmartGenerate = async () => {
        setIsAiGenerating(true);
        setSkippedDuplicateCount(0);
        try {
            // Sample data from current import (desc, amount, etc.)
            const sampleRows = transactions.filter(t => !t.isIgnored).slice(0, 50);
            if (sampleRows.length === 0) {
                alert("No transactions available for analysis. Un-ignore some items first.");
                return;
            }

            const sample = sampleRows.map(t => `${t.date},${t.description},${t.amount}`).join('\n');
            const proposed = await generateRulesFromData(sample, categories, payees, merchants, locations, users, "Create normalizing rules for this data batch.", systemSettings);
            
            const existingSignatures = new Set(rules.map(r => getRuleSignature(r)));
            
            const uniqueProposed: (ReconciliationRule & { isExcluded?: boolean })[] = [];
            let duplicates = 0;

            proposed.forEach(p => {
                if (existingSignatures.has(getRuleSignature(p))) {
                    duplicates++;
                } else {
                    uniqueProposed.push({ ...p, isExcluded: false });
                }
            });

            setAiProposedRules(uniqueProposed);
            setSkippedDuplicateCount(duplicates);
            setIsAiForgeOpen(true);
        } catch (e: any) {
            alert(e.message || "AI logic generation failed.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const toggleRuleExclusion = (ruleId: string) => {
        setAiProposedRules(prev => prev.map(r => r.id === ruleId ? { ...r, isExcluded: !r.isExcluded } : r));
    };

    const handleAcceptAllProposed = () => {
        const toSave = aiProposedRules.filter(r => !r.isExcluded);
        if (toSave.length === 0) {
            alert("No rules selected for acceptance.");
            return;
        }

        if (!confirm(`Commit ${toSave.length} automation rules to your ledger settings?`)) return;

        toSave.forEach(rule => {
            const finalRule = { ...rule, isAiDraft: false };
            
            // Auto-resolve new entity creation if possible
            if (rule.suggestedCategoryName && !rule.setCategoryId) {
                const existing = categories.find(c => c.name.toLowerCase() === rule.suggestedCategoryName?.toLowerCase());
                if (existing) finalRule.setCategoryId = existing.id;
                else {
                    const cat = { id: generateUUID(), name: rule.suggestedCategoryName };
                    onSaveCategory(cat);
                    finalRule.setCategoryId = cat.id;
                }
            }

            if (rule.suggestedPayeeName && !rule.setPayeeId) {
                const existing = payees.find(p => p.name.toLowerCase() === rule.suggestedPayeeName?.toLowerCase());
                if (existing) finalRule.setPayeeId = existing.id;
                else {
                    const p = { id: generateUUID(), name: rule.suggestedPayeeName };
                    onSavePayee(p);
                    finalRule.setPayeeId = p.id;
                }
            }

            onSaveRule(finalRule);
        });

        // Eagerly re-apply new rules to current verification batch
        const allRules = [...toSave, ...rules];
        const refreshedTxs = applyRulesToTransactions(transactions, allRules, accounts);
        setTransactions(refreshedTxs as VerifiableTransaction[]);

        setAiProposedRules([]);
        setIsAiForgeOpen(false);
        alert(`Successfully committed ${toSave.length} new automation rules and updated the current batch.`);
    };

    const sortedPayeeOptions = useMemo(() => [...payees].sort((a,b) => a.name.localeCompare(b.name)), [payees]);
    const sortedCategoryOptions = useMemo(() => [...categories].sort((a,b) => a.name.localeCompare(b.name)), [categories]);

    return (
        <div className="space-y-4 flex flex-col h-full w-full min-h-0 overflow-hidden relative">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                        <TableIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Verify Ingestion</h2>
                        <p className="text-sm text-slate-500">Review {transactions.length} detected records. {transactions.filter(t => t.conflictType === 'database').length} potential duplicates flagged.</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                        onClick={handleSmartGenerate} 
                        disabled={isAiGenerating || transactions.length === 0}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-700 font-black rounded-xl hover:bg-indigo-100 transition-all shadow-sm disabled:opacity-50"
                    >
                        {isAiGenerating ? <div className="w-4 h-4 border-2 border-t-indigo-600 rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                        Smart Generate Rules
                    </button>
                    <div className="h-10 w-px bg-slate-200 mx-1 hidden sm:block" />
                    <button onClick={onCancel} className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Discard</button>
                    <button onClick={() => onComplete(transactions.filter(t => !t.isIgnored))} className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Finalize Import</button>
                </div>
            </div>

            {/* AI FORGE OVERLAY (Inside Verification) */}
            {isAiForgeOpen && (
                <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-2xl animate-fade-in flex flex-col gap-6 max-h-[450px] overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-4 gap-4">
                        <div className="flex items-center gap-3">
                            <RobotIcon className="w-8 h-8 text-indigo-400" />
                            <div>
                                <h3 className="text-xl font-bold">Suggested Automations</h3>
                                <p className="text-indigo-300 text-xs font-medium">Bulk logic synthesized from current statement rows.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                            {skippedDuplicateCount > 0 && (
                                <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                                    <ExclamationTriangleIcon className="w-3 h-3" />
                                    {skippedDuplicateCount} Existing Rules Skipped
                                </div>
                            )}
                            <button 
                                onClick={handleAcceptAllProposed}
                                disabled={aiProposedRules.filter(r => !r.isExcluded).length === 0}
                                className="px-6 py-2.5 bg-white text-indigo-900 font-black rounded-xl shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2 text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckCircleIcon className="w-4 h-4" />
                                Accept All Selected ({aiProposedRules.filter(r => !r.isExcluded).length})
                            </button>
                            <button onClick={() => setIsAiForgeOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar flex gap-4 min-h-0">
                        {aiProposedRules.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-indigo-400/50 italic py-10 min-w-[400px]">
                                <LightBulbIcon className="w-10 h-10 mb-2 opacity-20" />
                                <p className="text-sm font-bold">Everything looks already optimized!</p>
                                <p className="text-xs">No new patterns detected that aren't already covered by your rules.</p>
                            </div>
                        ) : (
                            aiProposedRules.map(r => (
                                <div key={r.id} className={`w-80 flex-shrink-0 bg-white/5 border-2 rounded-2xl p-4 transition-all relative group flex flex-col ${r.isExcluded ? 'border-transparent opacity-30 grayscale scale-95' : 'border-white/10 hover:border-indigo-400 hover:bg-white/10'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="min-w-0 flex-1">
                                            <h4 className={`text-sm font-bold truncate pr-2 ${r.isExcluded ? 'line-through' : ''}`}>{r.name}</h4>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{r.scope}</p>
                                        </div>
                                        <button 
                                            onClick={() => toggleRuleExclusion(r.id)} 
                                            className={`p-1.5 rounded-lg transition-all transform active:scale-90 ${r.isExcluded ? 'bg-red-600 text-white shadow-lg rotate-0' : 'bg-white/10 text-white/40 hover:text-white hover:bg-white/20'}`}
                                            title={r.isExcluded ? 'Include in Bulk Accept' : 'Exclude from Bulk Accept'}
                                        >
                                            {r.isExcluded ? <CloseIcon className="w-4 h-4" /> : <SlashIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-1.5 mb-4 flex-grow min-h-0 overflow-y-auto custom-scrollbar">
                                        {(r.conditions || []).map((c, i) => (
                                            <div key={i} className="text-[10px] bg-black/20 p-2 rounded border border-white/5 font-mono">
                                                <span className="text-indigo-400 font-bold uppercase mr-1">{c.operator}</span>
                                                <span className="text-slate-300">"{c.value}"</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-white/10">
                                        {r.suggestedCategoryName && (
                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-500/20 flex items-center gap-1">
                                                <TagIcon className="w-2 h-2" /> {r.suggestedCategoryName}
                                            </span>
                                        )}
                                        {r.suggestedPayeeName && (
                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-200 border border-blue-500/20 flex items-center gap-1">
                                                <UsersIcon className="w-2 h-2" /> {r.suggestedPayeeName}
                                            </span>
                                        )}
                                        {r.suggestedMerchantName && (
                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-200 border border-orange-500/20 flex items-center gap-1">
                                                <BoxIcon className="w-2 h-2" /> {r.suggestedMerchantName}
                                            </span>
                                        )}
                                        {r.skipImport && (
                                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-red-500/30 text-red-200 border border-red-500/20">Auto-Skip</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar min-h-0">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 text-center bg-slate-50 border-b border-slate-200">
                                    <input type="checkbox" className="rounded text-indigo-600 h-4 w-4" checked={selectedIds.size === transactions.length && transactions.length > 0} onChange={() => setSelectedIds(selectedIds.size === transactions.length ? new Set() : new Set(transactions.map(t => t.tempId)))} />
                                </th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Status</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('date')}>
                                    <div className="flex items-center gap-1">Date <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('description')}>
                                    <div className="flex items-center gap-1">Description <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Entity / Payee</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Tags</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Direction</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('categoryId')}>
                                    <div className="flex items-center gap-1">Category <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors border-b border-slate-200" onClick={() => requestSort('amount')}>
                                    <div className="flex items-center justify-end gap-1">Amount <SortIcon className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Rule</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Raw</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sortedTransactions.map(tx => {
                                const type = typeMap.get(tx.typeId);
                                const effect = type?.balanceEffect || 'expense';
                                const matchedRule = tx.appliedRuleId ? ruleMap.get(tx.appliedRuleId) : null;
                                
                                const amountColor = effect === 'income' ? 'text-green-600' : effect === 'transfer' ? 'text-slate-400' : 'text-red-600';

                                return (
                                    <tr key={tx.tempId} className={`transition-all ${tx.isIgnored ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <td className="p-4 text-center"><input type="checkbox" checked={!tx.isIgnored} onChange={() => handleUpdate(tx.tempId, 'isIgnored', !tx.isIgnored)} className="rounded text-indigo-600 h-4 w-4" /></td>
                                        <td className="px-4 py-2">{tx.conflictType === 'database' ? (<span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase flex items-center gap-1 w-max"><ExclamationTriangleIcon className="w-2.5 h-2.5" /> Exists</span>) : (<span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase w-max">New Entry</span>)}</td>
                                        <td className="px-4 py-2 text-xs text-slate-500 font-mono">{tx.date}</td>
                                        <td className="px-4 py-2 text-sm font-bold text-slate-700 truncate max-w-xs">{tx.description}</td>
                                        <td className="px-4 py-2 min-w-[180px]"><select value={tx.payeeId || ''} onChange={e => handleUpdate(tx.tempId, 'payeeId', e.target.value)} className="p-1.5 text-xs border border-slate-200 rounded-lg w-full font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 bg-white"><option value="">Select Merchant...</option>{sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                                        <td className="px-4 py-2"><div className="flex flex-wrap gap-1 min-w-[80px]">{tx.tagIds && tx.tagIds.length > 0 ? (tx.tagIds.map(tid => { const tag = tagMap.get(tid); return tag ? (<span key={tid} className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded ${tag.color}`}>{tag.name}</span>) : null; })) : (<span className="text-[8px] text-slate-300 font-bold uppercase italic">None</span>)}</div></td>
                                        <td className="px-4 py-2"><div className="relative group/select"><select value={effect} onChange={e => { const targetEffect = e.target.value as BalanceEffect; const matchingType = transactionTypes.find(t => t.balanceEffect === targetEffect); if (matchingType) handleUpdate(tx.tempId, 'typeId', matchingType.id); }} className="p-1.5 pr-6 text-[10px] border border-slate-200 rounded-lg w-full font-black uppercase tracking-tighter text-slate-700 focus:border-indigo-500 focus:ring-0 bg-slate-50 appearance-none cursor-pointer"><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select><div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDownIcon className="w-3.5 h-3.5" /></div></div></td>
                                        <td className="px-4 py-2"><select value={tx.categoryId} onChange={e => handleUpdate(tx.tempId, 'categoryId', e.target.value)} className="p-1.5 text-xs border border-slate-200 rounded-lg w-full font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 bg-white"><option value="">Uncategorized</option>{sortedCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                                        <td className={`px-4 py-2 text-right text-sm font-black font-mono ${amountColor}`}>{effect === 'income' ? '+' : effect === 'transfer' ? '' : '-'}{formatCurrency(tx.amount)}</td>
                                        <td className="px-4 py-2 text-center">{matchedRule ? (<button onClick={() => { setInspectedRule(matchedRule); setRuleContextTx(tx); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all border border-green-200 shadow-sm group/rule" title={`Applied: ${matchedRule.name}. Click to view/edit.`}><SparklesIcon className="w-4 h-4" /></button>) : (<button onClick={() => handleOpenRuleCreator(tx)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Create Rule"><WrenchIcon className="w-4 h-4" /></button>)}</td>
                                        <td className="px-4 py-2 text-center"><button onClick={() => setInspectedTx(tx)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Raw Data"><TableIcon className="w-4 h-4"/></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <MetadataDrawer tx={inspectedTx} onClose={() => setInspectedTx(null)} />
            <RuleInspectorDrawer 
                rule={inspectedRule} 
                onClose={() => setInspectedRule(null)} 
                categories={categories} 
                payees={payees} 
                merchants={merchants}
                locations={locations}
                users={users}
                tags={tags}
                types={transactionTypes} 
                onEdit={(r) => { setInspectedRule(null); setRuleTransactionContext({ ...ruleContextTx, id: 'temp-context' } as any); setIsRuleModalOpen(true); }}
            />
            
            <RuleModal 
                isOpen={isRuleModalOpen} 
                onClose={() => setIsRuleModalOpen(false)} 
                onSaveRule={onSaveRule}
                accounts={accounts}
                transactionTypes={transactionTypes}
                categories={categories}
                tags={tags}
                payees={payees}
                merchants={merchants}
                locations={locations}
                users={users}
                transaction={ruleTransactionContext}
                onSaveCategory={onSaveCategory}
                onSavePayee={onSavePayee}
                onSaveTag={onSaveTag}
                onAddTransactionType={onAddTransactionType}
            />
        </div>
    );
};

export default ImportVerification;
