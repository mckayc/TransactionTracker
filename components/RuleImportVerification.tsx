
import React, { useState, useMemo } from 'react';
import type { ReconciliationRule, Category, Counterparty, Location, User, TransactionType, RuleImportDraft, Tag, ImportBatchStats } from '../types';
import { CheckCircleIcon, SlashIcon, ExclamationTriangleIcon, AddIcon, BoxIcon, TagIcon, MapPinIcon, UsersIcon, ShieldCheckIcon, CloseIcon, EditIcon, RepeatIcon, WorkflowIcon, InfoIcon, DatabaseIcon, ChevronRightIcon, ArrowRightIcon, SparklesIcon, TypeIcon, ListIcon, ChecklistIcon, UserGroupIcon } from './Icons';
import { generateUUID } from '../utils';

interface Props {
    drafts: RuleImportDraft[];
    onCancel: () => void;
    onFinalize: (rules: ReconciliationRule[]) => void;
    categories: Category[];
    payees: Counterparty[];
    locations: Location[];
    users: User[];
    tags: Tag[];
    transactionTypes: TransactionType[];
    onSaveCategory: (c: Category) => void;
    onSaveCategories: (cs: Category[]) => void;
    onSaveCounterparty: (p: Counterparty) => void;
    onSaveCounterparties: (ps: Counterparty[]) => void;
    onSaveLocation: (location: Location) => void;
    onSaveLocations: (locations: Location[]) => void;
    existingRules: ReconciliationRule[];
    batchStats: ImportBatchStats | null;
}

const normalizeToken = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const getTokens = (value: string): string[] => {
    return value.split(/\s*\|\|\s*|\s*\|\s*/).map(t => normalizeToken(t)).filter(Boolean);
};

const mergePatternsUniquely = (existing: string, incoming: string): string => {
    const existingTokens = existing.split(/\s*\|\|\s*|\s*\|\s*/).map(t => t.trim()).filter(Boolean);
    const incomingTokens = incoming.split(/\s*\|\|\s*|\s*\|\s*/).map(t => t.trim()).filter(Boolean);
    const seenNormalized = new Set<string>();
    const result: string[] = [];
    [...existingTokens, ...incomingTokens].forEach(token => {
        const norm = normalizeToken(token);
        if (!seenNormalized.has(norm)) {
            seenNormalized.add(norm);
            result.push(token.replace(/\s+/g, ' ').trim());
        }
    });
    return result.join(' || ');
};

const LogicForecastDrawer: React.FC<{ 
    draft: RuleImportDraft; 
    existingRule?: ReconciliationRule;
    categories: Category[];
    payees: Counterparty[];
    locations: Location[];
    users: User[];
    transactionTypes: TransactionType[];
    onClose: () => void; 
}> = ({ draft, existingRule, categories, payees, locations, users, transactionTypes, onClose }) => {
    
    const existingNormSet = useMemo(() => {
        if (!existingRule) return new Set<string>();
        return new Set(existingRule.conditions.flatMap(c => getTokens(String(c.value || ''))));
    }, [existingRule]);

    const incomingNormSet = useMemo(() => {
        return new Set(draft.conditions.flatMap(c => getTokens(String(c.value || ''))));
    }, [draft]);

    const isLogicRedundant = useMemo(() => {
        if (!existingRule) return false;
        return Array.from(incomingNormSet).every(t => existingNormSet.has(t));
    }, [incomingNormSet, existingNormSet, existingRule]);

    const isMerge = draft.mappingStatus.logicalState === 'synthesis';

    const mergedPatternPreview = useMemo(() => {
        if (!existingRule) return '';
        const existingPattern = existingRule.conditions.map(c => c.value).join(' || ');
        const incomingPattern = draft.conditions.map(c => c.value).join(' || ');
        return mergePatternsUniquely(existingPattern, incomingPattern);
    }, [existingRule, draft]);

    const getCompareValue = (type: 'cat' | 'entity' | 'type' | 'location', source: 'existing' | 'incoming') => {
        const target = source === 'existing' ? existingRule : draft;
        if (!target) return '--';
        
        if (type === 'cat') {
            const id = target.setCategoryId;
            return categories.find(c => c.id === id)?.name || (source === 'incoming' ? draft.suggestedCategoryName : null) || '--';
        }
        if (type === 'entity') {
            // Check both new and legacy keys
            const id = target.setCounterpartyId || (target as any).setPayeeId;
            return payees.find(p => p.id === id)?.name || (source === 'incoming' ? (draft.suggestedCounterpartyName || (draft as any).suggestedPayeeName) : null) || '--';
        }
        if (type === 'type') {
            const id = target.setTransactionTypeId;
            return transactionTypes.find(t => t.id === id)?.name || (source === 'incoming' ? draft.suggestedTypeName : null) || '--';
        }
        if (type === 'location') {
            const id = target.setLocationId;
            return locations.find(l => l.id === id)?.name || (source === 'incoming' ? draft.suggestedLocationName : null) || '--';
        }
        return '--';
    };

    return (
        <div className="fixed inset-0 z-[300] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-3xl bg-slate-50 shadow-2xl flex flex-col h-full animate-slide-in-right border-l border-white/10">
                <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <WorkflowIcon className="w-5 h-5 text-indigo-600" />
                            Synthesis Forecast
                        </h3>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Comparing Logic Patterns</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-24">
                    {/* Logic Pattern Comparison */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <SparklesIcon className="w-3 h-3" /> Logic String Synthesis
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Current System Logic</p>
                                <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-mono text-slate-400 italic">
                                    {existingRule ? existingRule.conditions.map(c => c.value).join(' || ') : 'NO RECORD'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1">Incoming Logic Proposal</p>
                                <div className="p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-xs font-mono text-indigo-700 font-bold">
                                    {draft.conditions.map(c => c.value).join(' || ')}
                                </div>
                            </div>
                        </div>

                        {isMerge && (
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4 shadow-xl border border-indigo-500/20">
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircleIcon className="w-3 h-3" /> Resulting Logic (Synthesized Merge)
                                </p>
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-mono text-emerald-300 break-words leading-relaxed font-black">
                                    {mergedPatternPreview}
                                </div>
                                <p className="text-[10px] text-slate-400 italic">The system will combine both sets of unique tokens into a single rule while preserving your targeting settings.</p>
                            </div>
                        )}
                    </div>

                    {/* Field Mapping Comparison */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <BoxIcon className="w-3 h-3" /> Target Comparison
                        </h4>
                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-100 text-xs">
                                <thead className="bg-slate-50 font-black text-slate-400 uppercase text-[9px]">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Property</th>
                                        <th className="px-4 py-3 text-left">Current System</th>
                                        <th className="px-4 py-3 text-left">Incoming Draft</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-bold">
                                    <tr>
                                        <td className="px-4 py-4 text-slate-400 uppercase text-[9px]">Target Category</td>
                                        <td className="px-4 py-4 text-slate-500">{getCompareValue('cat', 'existing')}</td>
                                        <td className="px-4 py-4 text-indigo-600">{getCompareValue('cat', 'incoming')}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-4 text-slate-400 uppercase text-[9px]">Counterparty</td>
                                        <td className="px-4 py-4 text-slate-500">{getCompareValue('entity', 'existing')}</td>
                                        <td className="px-4 py-4 text-indigo-600">{getCompareValue('entity', 'incoming')}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-4 text-slate-400 uppercase text-[9px]">Location</td>
                                        <td className="px-4 py-4 text-slate-500">{getCompareValue('location', 'existing')}</td>
                                        <td className="px-4 py-4 text-indigo-600">{getCompareValue('location', 'incoming')}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-4 text-slate-400 uppercase text-[9px]">Tx Type</td>
                                        <td className="px-4 py-4 text-slate-500">{getCompareValue('type', 'existing')}</td>
                                        <td className="px-4 py-4 text-indigo-600">{getCompareValue('type', 'incoming')}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-4 text-slate-400 uppercase text-[9px]">Cleanup Memo</td>
                                        <td className="px-4 py-4 text-slate-500 truncate max-w-[150px]">{existingRule?.setDescription || '--'}</td>
                                        <td className="px-4 py-4 text-indigo-600 truncate max-w-[150px]">{draft.setDescription || '--'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div className="p-4 bg-white border-t border-slate-200 shadow-lg">
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all active:scale-95 shadow-xl">Dismiss Forecast</button>
                </div>
            </div>
        </div>
    );
};

const StateBadge: React.FC<{ state?: RuleImportDraft['mappingStatus']['logicalState'] }> = ({ state }) => {
    const config = {
        new: { label: 'New', color: 'bg-blue-100 text-blue-700', icon: <AddIcon className="w-2.5 h-2.5" /> },
        identity: { label: 'Identity', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircleIcon className="w-2.5 h-2.5" /> },
        synthesis: { label: 'Synthesis', color: 'bg-violet-100 text-violet-700', icon: <WorkflowIcon className="w-2.5 h-2.5" /> },
        conflict: { label: 'Conflict', color: 'bg-amber-100 text-amber-700', icon: <ExclamationTriangleIcon className="w-2.5 h-2.5" /> },
        redundant: { label: 'Redundant', color: 'bg-slate-100 text-slate-500', icon: <SlashIcon className="w-2.5 h-2.5" /> }
    };
    const c = config[state || 'new'];
    return (
        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter flex items-center gap-1.5 shadow-sm border border-black/5 ${c.color}`}>
            {c.icon} {c.label}
        </span>
    );
};

const RuleImportVerification: React.FC<Props> = ({ 
    drafts, onCancel, onFinalize, categories, payees, locations, users, tags, transactionTypes, 
    onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, existingRules, batchStats
}) => {
    const [inspectingDraftId, setInspectingDraftId] = useState<string | null>(null);
    const existingNames = useMemo(() => new Map(existingRules.map(r => [r.name.toLowerCase(), r])), [existingRules]);
    
    const [selectionSet, setSelectionSet] = useState<Set<string>>(new Set(drafts.filter(d => d.isSelected).map(d => d.id)));

    const toggleSelection = (id: string) => {
        const next = new Set(selectionSet);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectionSet(next);
    };

    const handleFinalCommit = () => {
        const selectedDrafts = drafts.filter(d => selectionSet.has(d.id));
        
        // 1. Logic for auto-creating entities marked as 'create'
        const newCats: Category[] = [];
        const newPayees: Counterparty[] = [];
        const newLocs: Location[] = [];

        const catMap = new Map<string, string>();
        const payeeMap = new Map<string, string>();
        const locMap = new Map<string, string>();

        selectedDrafts.forEach(d => {
            if (d.mappingStatus.category === 'create' && d.suggestedCategoryName) {
                const name = d.suggestedCategoryName.trim();
                if (!catMap.has(name.toLowerCase())) {
                    const id = generateUUID();
                    catMap.set(name.toLowerCase(), id);
                    newCats.push({ id, name });
                }
            }
            // Compatibility for legacy 'suggestedPayeeName'
            const suggestedCounterparty = d.suggestedCounterpartyName || (d as any).suggestedPayeeName;
            if (d.mappingStatus.counterparty === 'create' && suggestedCounterparty) {
                const name = suggestedCounterparty.trim();
                if (!payeeMap.has(name.toLowerCase())) {
                    const id = generateUUID();
                    payeeMap.set(name.toLowerCase(), id);
                    newPayees.push({ id, name });
                }
            }
            if (d.mappingStatus.location === 'create' && d.suggestedLocationName) {
                const name = d.suggestedLocationName.trim();
                if (!locMap.has(name.toLowerCase())) {
                    const id = generateUUID();
                    locMap.set(name.toLowerCase(), id);
                    newLocs.push({ id, name });
                }
            }
        });

        // 2. Commit new entities to system state
        if (newCats.length > 0) onSaveCategories(newCats);
        if (newPayees.length > 0) onSaveCounterparties(newPayees);
        if (newLocs.length > 0) onSaveLocations(newLocs);

        // 3. Update drafts with new IDs before final save
        const finalRules: ReconciliationRule[] = selectedDrafts.map(d => {
            let rule = { ...d };
            if (d.mappingStatus.category === 'create' && d.suggestedCategoryName) {
                rule.setCategoryId = catMap.get(d.suggestedCategoryName.trim().toLowerCase());
            }
            // Compatibility for legacy 'suggestedPayeeName'
            const suggestedCounterparty = d.suggestedCounterpartyName || (d as any).suggestedPayeeName;
            if (d.mappingStatus.counterparty === 'create' && suggestedCounterparty) {
                rule.setCounterpartyId = payeeMap.get(suggestedCounterparty.trim().toLowerCase());
            }
            if (d.mappingStatus.location === 'create' && d.suggestedLocationName) {
                rule.setLocationId = locMap.get(d.suggestedLocationName.trim().toLowerCase());
            }
            return rule;
        });

        onFinalize(finalRules);
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Batch Statistics Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-[2.5rem] shadow-2xl flex justify-between items-center flex-shrink-0 relative overflow-hidden">
                <div className="relative z-10 flex gap-10">
                    <div>
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">DATA ANALYSIS</p>
                        <p className="text-3xl font-black">{batchStats?.rowsEvaluated || 0} <span className="text-xs font-bold text-slate-500 uppercase">Rows Analyzed</span></p>
                    </div>
                    <div className="border-l border-white/10 pl-10">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">COVERAGE GAP</p>
                        <p className="text-3xl font-black text-emerald-400">
                            {batchStats ? Math.round((batchStats.rowsCovered / batchStats.rowsEvaluated) * 100) : 0}% 
                            <span className="text-xs font-bold text-emerald-900 uppercase ml-2">Logical Coverage</span>
                        </p>
                    </div>
                    <div className="border-l border-white/10 pl-10">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">SYNTHESIS STATS</p>
                        <div className="flex gap-4">
                            <div><span className="text-xl font-black">+{batchStats?.rulesCreated || 0}</span> <span className="text-[9px] font-bold text-slate-500 uppercase">New</span></div>
                            <div><span className="text-xl font-black text-indigo-400">+{batchStats?.rulesMerged || 0}</span> <span className="text-[9px] font-bold text-slate-500 uppercase">Merged</span></div>
                        </div>
                    </div>
                </div>
                <div className="relative z-10 flex gap-3">
                    <button onClick={onCancel} className="px-6 py-2 font-black text-slate-400 hover:text-white transition-colors text-xs uppercase">Discard Batch</button>
                    <button onClick={handleFinalCommit} disabled={selectionSet.size === 0} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-900/40 transition-all disabled:opacity-30 text-xs uppercase active:scale-95">Commit Institutional Logic</button>
                </div>
                <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-10 text-indigo-400 pointer-events-none" />
            </div>

            <div className="flex-1 overflow-hidden border-2 border-slate-200 rounded-[2.5rem] bg-white flex flex-col shadow-sm">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 bg-slate-50 border-b border-slate-200">
                                    <input 
                                        type="checkbox" 
                                        className="rounded text-indigo-600 h-4 w-4" 
                                        checked={selectionSet.size === drafts.length && drafts.length > 0} 
                                        onChange={() => setSelectionSet(selectionSet.size === drafts.length ? new Set() : new Set(drafts.map(d => d.id)))} 
                                    />
                                </th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">State</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Logic Identity</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Category</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Entity Target</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Location Target</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Type Resolution</th>
                                <th className="px-4 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Coverage</th>
                                <th className="px-4 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Forecast</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {drafts.map(d => (
                                <tr key={d.id} className={`${selectionSet.has(d.id) ? '' : 'opacity-40 grayscale'} hover:bg-indigo-50/20 transition-all group`}>
                                    <td className="p-4 text-center border-b border-slate-50">
                                        <input 
                                            type="checkbox" 
                                            checked={selectionSet.has(d.id)} 
                                            onChange={() => toggleSelection(d.id)} 
                                            className="rounded text-indigo-600 h-4 w-4 cursor-pointer" 
                                        />
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50">
                                        <StateBadge state={d.mappingStatus.logicalState} />
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[180px]">
                                        <p className="text-sm font-black text-slate-800">{d.name}</p>
                                        <p className="text-[10px] font-mono text-slate-400 truncate max-w-[200px] mt-1">{d.conditions[0]?.value}</p>
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[140px]">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${d.mappingStatus.category === 'create' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {categories.find(c => c.id === d.setCategoryId)?.name || d.suggestedCategoryName || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[140px]">
                                        <p className="text-xs font-bold text-slate-600">{payees.find(p => p.id === (d.setCounterpartyId || (d as any).setPayeeId))?.name || (d.suggestedCounterpartyName || (d as any).suggestedPayeeName) || '--'}</p>
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[140px]">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${d.mappingStatus.location === 'create' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {locations.find(l => l.id === d.setLocationId)?.name || d.suggestedLocationName || '--'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[140px]">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${d.mappingStatus.type === 'match' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                            {transactionTypes.find(t => t.id === d.setTransactionTypeId)?.name || d.suggestedTypeName || 'Other'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center border-b border-slate-50">
                                        <span className={`px-2 py-1 text-[10px] font-black rounded-lg ${d.coverageCount && d.coverageCount > 0 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}>
                                            {(d.coverageCount || 0)} ROWS
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center border-b border-slate-50">
                                        <button onClick={() => setInspectingDraftId(d.id)} className="p-2 text-slate-300 hover:text-indigo-600 rounded-xl hover:bg-white transition-all shadow-sm">
                                            <WorkflowIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {inspectingDraftId && (
                <LogicForecastDrawer 
                    draft={drafts.find(d => d.id === inspectingDraftId)!}
                    existingRule={existingNames.get(drafts.find(d => d.id === inspectingDraftId)!.name.toLowerCase())}
                    categories={categories}
                    payees={payees}
                    locations={locations}
                    users={users}
                    transactionTypes={transactionTypes}
                    onClose={() => setInspectingDraftId(null)}
                />
            )}
        </div>
    );
};

export default RuleImportVerification;
