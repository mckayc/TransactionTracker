
import React, { useState, useMemo } from 'react';
import type { ReconciliationRule, Category, Counterparty, Location, User, TransactionType, RuleImportDraft, Tag } from '../types';
import { CheckCircleIcon, SlashIcon, ExclamationTriangleIcon, AddIcon, BoxIcon, TagIcon, MapPinIcon, UsersIcon, ShieldCheckIcon, CloseIcon, EditIcon, RepeatIcon, WorkflowIcon, InfoIcon, DatabaseIcon, ChevronRightIcon, ArrowRightIcon, SparklesIcon, TypeIcon, ListIcon, ChecklistIcon, UserGroupIcon } from './Icons';
import { generateUUID } from '../utils';
import SearchableSelect from './SearchableSelect';

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
    onSaveLocations: (ls: Location[]) => void;
    existingRules: ReconciliationRule[];
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

    const isMerge = !!existingRule && !isLogicRedundant && (
        existingRule.setCategoryId === draft.setCategoryId || 
        (draft.mappingStatus.category === 'match' && existingRule.setCategoryId === categories.find(c => c.name.toLowerCase() === draft.suggestedCategoryName?.toLowerCase())?.id)
    );

    const mergedPatternPreview = useMemo(() => {
        if (!existingRule) return '';
        const existing = existingRule.conditions.map(c => c.value).join(' || ');
        const incoming = draft.conditions.map(c => c.value).join(' || ');
        return mergePatternsUniquely(existing, incoming);
    }, [existingRule, draft]);

    const getFieldStatus = (field: keyof ReconciliationRule, mappingStatus?: string): 'update' | 'keep' | 'create' | 'skip' => {
        if (field === 'skipImport' && draft.skipImport) return 'skip';
        if (draft[field]) return 'update';
        if (mappingStatus === 'create' || mappingStatus === 'match') return 'update';
        return 'keep';
    };

    return (
        <div className="fixed inset-0 z-[300] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-slate-50 shadow-2xl flex flex-col h-full animate-slide-in-right border-l border-white/10">
                <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <WorkflowIcon className="w-5 h-5 text-indigo-600" />
                            Synthesis Forecast
                        </h3>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Rule ID: {draft.id.substring(0,12)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-24">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <SparklesIcon className="w-3 h-3" /> Pattern Resolution
                        </h4>
                        {isMerge ? (
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-6 shadow-xl border border-indigo-500/20">
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircleIcon className="w-3 h-3" /> Resulting Logic (Merged)
                                </p>
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-mono text-emerald-300 break-words leading-relaxed">
                                    {mergedPatternPreview}
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-white border-2 border-slate-100 rounded-[2rem] space-y-2 shadow-sm">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Pattern</p>
                                <div className="p-4 bg-slate-50 rounded-2xl text-xs font-mono text-slate-600 border border-slate-100 break-words">
                                    {draft.conditions.map(c => c.value).join(' || ')}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <BoxIcon className="w-3 h-3" /> Impact Simulation
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ForecastFieldRow label="Cleanup Description" value={draft.setDescription} status={getFieldStatus('setDescription')} icon={<TypeIcon className="w-4 h-4" />} />
                            <ForecastFieldRow label="Category" value={draft.suggestedCategoryName} status={draft.mappingStatus.category === 'create' ? 'create' : getFieldStatus('setCategoryId')} icon={<TagIcon className="w-4 h-4" />} />
                            <ForecastFieldRow label="Counterparty" value={draft.suggestedCounterpartyName} status={draft.mappingStatus.counterparty === 'create' ? 'create' : getFieldStatus('setCounterpartyId')} icon={<UsersIcon className="w-4 h-4" />} />
                            <ForecastFieldRow label="Ingestion" value={draft.skipImport ? 'Purge' : 'Import'} status={draft.skipImport ? 'skip' : 'keep'} icon={<SlashIcon className="w-4 h-4" />} />
                        </div>
                    </div>
                </div>
                
                <div className="p-4 bg-white border-t border-slate-200">
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase rounded-2xl hover:bg-black transition-all">Dismiss Forecast</button>
                </div>
            </div>
        </div>
    );
};

const ForecastFieldRow: React.FC<{ label: string, value?: string, status: 'update' | 'keep' | 'create' | 'skip', icon: React.ReactNode }> = ({ label, value, status, icon }) => {
    const colors = {
        update: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        keep: 'text-slate-400 bg-slate-50 border-slate-100',
        create: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        skip: 'text-red-600 bg-red-50 border-red-100'
    };
    return (
        <div className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${colors[status]}`}>
            <div className="flex items-center gap-3">
                <div className="opacity-70">{icon}</div>
                <div>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{label}</p>
                    <p className="text-xs font-black">{value || 'No Change'}</p>
                </div>
            </div>
        </div>
    );
};

const StateBadge: React.FC<{ state?: RuleImportDraft['mappingStatus']['logicalState'] }> = ({ state }) => {
    const config = {
        new: { label: 'New', color: 'bg-blue-100 text-blue-700', info: 'Completely unique detection logic and name.' },
        identity: { label: 'Identity', color: 'bg-emerald-100 text-emerald-700', info: 'Logic exactly matches an existing system rule.' },
        synthesis: { label: 'Synthesis', color: 'bg-violet-100 text-violet-700', info: 'Name matches, but expands existing detection logic.' },
        conflict: { label: 'Conflict', color: 'bg-amber-100 text-amber-700', info: 'Name matches but targets a different category or entity.' },
        redundant: { label: 'Redundant', color: 'bg-slate-100 text-slate-500', info: 'Logic is covered by another rule in this batch.' }
    };
    const c = config[state || 'new'];
    return (
        <div className="relative group/badge inline-block">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter cursor-help shadow-sm border border-black/5 ${c.color}`}>{c.label}</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white rounded-lg text-[10px] opacity-0 translate-y-2 pointer-events-none group-hover/badge:opacity-100 group-hover/badge:translate-y-0 transition-all z-50 text-center font-bold">
                {c.info}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
            </div>
        </div>
    );
};

const RuleImportVerification: React.FC<Props> = ({ 
    drafts, onCancel, onFinalize, categories, payees, locations, users, tags, transactionTypes, 
    onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, existingRules
}) => {
    const [inspectingDraftId, setInspectingDraftId] = useState<string | null>(null);
    const existingNames = useMemo(() => new Map(existingRules.map(r => [r.name.toLowerCase(), r])), [existingRules]);
    const inspectingDraft = useMemo(() => drafts.find(d => d.id === inspectingDraftId), [drafts, inspectingDraftId]);

    const stats = useMemo(() => {
        const sel = drafts.filter(d => d.isSelected);
        return {
            total: drafts.length,
            selected: sel.length,
            newEntities: sel.reduce((acc, d) => {
                let count = 0;
                if (!d.setCategoryId && d.mappingStatus.category === 'create') count++;
                if (!d.setCounterpartyId && d.mappingStatus.counterparty === 'create') count++;
                return acc + count;
            }, 0),
            merges: sel.filter(d => d.mappingStatus.logicalState === 'synthesis').length
        };
    }, [drafts]);

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl flex justify-between items-center flex-shrink-0 relative overflow-hidden">
                <div className="relative z-10 flex gap-10">
                    <div>
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">EVALUATION QUEUE</p>
                        <p className="text-3xl font-black">{stats.total} <span className="text-xs font-bold text-slate-500">RULES</span></p>
                    </div>
                    <div className="border-l border-white/10 pl-10">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">DATA COVERAGE</p>
                        <p className="text-3xl font-black text-emerald-400">{Math.round((stats.selected / (stats.total || 1)) * 100)}% <span className="text-xs font-bold text-emerald-900">ACTIVE</span></p>
                    </div>
                    <div className="border-l border-white/10 pl-10">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">LOGIC SYNTHESIS</p>
                        <p className="text-3xl font-black text-indigo-400">+{stats.merges}</p>
                    </div>
                </div>
                <div className="relative z-10 flex gap-3">
                    <button onClick={onCancel} className="px-6 py-2 font-black text-slate-400 hover:text-white transition-colors text-xs uppercase">Discard Batch</button>
                    <button onClick={() => onFinalize(drafts.filter(d => d.isSelected))} disabled={stats.selected === 0} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl transition-all disabled:opacity-30 text-xs uppercase active:scale-95">Commit Institutional Logic</button>
                </div>
                <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-5 text-indigo-400 pointer-events-none" />
            </div>

            <div className="flex-1 overflow-hidden border-2 border-slate-200 rounded-[2.5rem] bg-white flex flex-col shadow-sm">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 bg-slate-50 border-b border-slate-200"></th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">State</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Logic Identity</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Category Resolution</th>
                                <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Counterparty</th>
                                <th className="px-4 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Coverage</th>
                                <th className="px-4 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Forecast</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {drafts.map(d => (
                                <tr key={d.id} className={`${d.isSelected ? '' : 'opacity-40 grayscale'} hover:bg-indigo-50/20 transition-all group`}>
                                    <td className="p-4 text-center border-b border-slate-50">
                                        <input type="checkbox" checked={d.isSelected} onChange={() => {}} className="rounded text-indigo-600 h-4 w-4" />
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50">
                                        <StateBadge state={d.mappingStatus.logicalState} />
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[180px]">
                                        <p className="text-sm font-black text-slate-800">{d.name}</p>
                                        <p className="text-[10px] font-mono text-slate-400 truncate max-w-[200px] mt-1">{d.conditions[0]?.value}</p>
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[140px]">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${d.mappingStatus.category === 'create' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {d.suggestedCategoryName || 'N/A'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 border-b border-slate-50 min-w-[140px]">
                                        <p className="text-xs font-bold text-slate-600">{d.suggestedCounterpartyName || '--'}</p>
                                    </td>
                                    <td className="px-4 py-4 text-center border-b border-slate-50">
                                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg">{(d.coverageCount || 0)} ROWS</span>
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

            {inspectingDraftId && inspectingDraft && (
                <LogicForecastDrawer 
                    draft={inspectingDraft}
                    existingRule={existingNames.get(inspectingDraft.name.toLowerCase())}
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
