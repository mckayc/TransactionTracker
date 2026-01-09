import React, { useState, useMemo } from 'react';
import type { ReconciliationRule, Category, Counterparty, Location, User, TransactionType, RuleImportDraft, Tag } from '../types';
// Fixed: Added missing ChecklistIcon and UserGroupIcon to imports
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

const ForecastFieldRow: React.FC<{ label: string, value?: string, status: 'update' | 'keep' | 'create' | 'skip', icon: React.ReactNode }> = ({ label, value, status, icon }) => {
    const colors = {
        update: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        keep: 'text-slate-400 bg-slate-50 border-slate-100 opacity-60',
        create: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        skip: 'text-red-600 bg-red-50 border-red-100'
    };

    return (
        <div className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${colors[status]}`}>
            <div className="flex items-center gap-3">
                <div className="opacity-70">{icon}</div>
                <div>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{label}</p>
                    <p className="text-xs font-black">{value || (status === 'keep' ? 'No Change' : 'N/A')}</p>
                </div>
            </div>
            <div className="px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter border border-current opacity-80">
                {status}
            </div>
        </div>
    );
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

    const getFieldStatus = (field: keyof ReconciliationRule, suggestedName?: string, mappingStatus?: string): 'update' | 'keep' | 'create' | 'skip' => {
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
                    {/* PATTERN MERGE ENGINE */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <SparklesIcon className="w-3 h-3" /> Pattern Resolution
                        </h4>
                        {isMerge ? (
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-6 shadow-xl border border-indigo-500/20">
                                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full w-max text-[8px] font-black uppercase tracking-widest border border-indigo-500/20">
                                    <RepeatIcon className="w-2.5 h-2.5" /> Strategy: Set-Based Logic Synthesis
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">Existing Stack</p>
                                        <div className="p-3 bg-white/5 rounded-xl text-[10px] font-mono text-slate-400 border border-white/5 line-clamp-3 italic">
                                            {existingRule?.conditions.map(c => c.value).join(' || ')}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black text-indigo-400 uppercase">Incoming Stack</p>
                                        <div className="p-3 bg-indigo-500/10 rounded-xl text-[10px] font-mono text-indigo-200 border border-indigo-500/20 line-clamp-3">
                                            {draft.conditions.map(c => c.value).join(' || ')}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/5 space-y-2">
                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircleIcon className="w-3 h-3" /> Resulting Engine Logic (Normalized)
                                    </p>
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-mono text-emerald-300 shadow-inner">
                                        {mergedPatternPreview}
                                    </div>
                                </div>
                            </div>
                        ) : isLogicRedundant ? (
                            <div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] space-y-3 shadow-sm">
                                <div className="flex items-center gap-2 text-emerald-800">
                                    <ShieldCheckIcon className="w-5 h-5" />
                                    <h4 className="font-black text-sm uppercase">Functional Identity</h4>
                                </div>
                                <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                                    The incoming detection pattern is already encapsulated by <strong>{existingRule?.name}</strong>. No synthesis required.
                                </p>
                            </div>
                        ) : (
                            <div className="p-6 bg-white border-2 border-slate-100 rounded-[2rem] space-y-2 shadow-sm">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Single Instance Pattern</p>
                                <div className="p-4 bg-slate-50 rounded-2xl text-xs font-mono text-slate-600 border border-slate-100">
                                    {draft.conditions.map(c => c.value).join(' || ')}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ACTION FORECAST */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <BoxIcon className="w-3 h-3" /> Logic Execution Forecast
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ForecastFieldRow 
                                label="Cleanup Description" 
                                value={draft.setDescription} 
                                status={getFieldStatus('setDescription')} 
                                icon={<TypeIcon className="w-4 h-4" />} 
                            />
                            <ForecastFieldRow 
                                label="Category Resolution" 
                                value={draft.suggestedCategoryName || categories.find(c => c.id === draft.setCategoryId)?.name} 
                                status={draft.mappingStatus.category === 'create' ? 'create' : getFieldStatus('setCategoryId')} 
                                icon={<TagIcon className="w-4 h-4" />} 
                            />
                            <ForecastFieldRow 
                                label="Counterparty Resolution" 
                                value={draft.suggestedCounterpartyName || payees.find(p => p.id === draft.setCounterpartyId)?.name} 
                                status={draft.mappingStatus.counterparty === 'create' ? 'create' : getFieldStatus('setCounterpartyId')} 
                                icon={<UsersIcon className="w-4 h-4" />} 
                            />
                            <ForecastFieldRow 
                                label="Location Assignment" 
                                value={draft.suggestedLocationName || locations.find(l => l.id === draft.setLocationId)?.name} 
                                status={draft.mappingStatus.location === 'create' ? 'create' : getFieldStatus('setLocationId')} 
                                icon={<MapPinIcon className="w-4 h-4" />} 
                            />
                            <ForecastFieldRow 
                                label="Transaction Type" 
                                value={draft.suggestedTypeName || transactionTypes.find(t => t.id === draft.setTransactionTypeId)?.name} 
                                status={getFieldStatus('setTransactionTypeId')} 
                                icon={<ChecklistIcon className="w-4 h-4" />} 
                            />
                            <ForecastFieldRow 
                                label="User Association" 
                                value={users.find(u => u.id === draft.setUserId)?.name} 
                                status={getFieldStatus('setUserId')} 
                                icon={<UserGroupIcon className="w-4 h-4" />} 
                            />
                            <ForecastFieldRow 
                                label="Tag Grouping" 
                                value={draft.suggestedTags?.join(', ') || (draft.assignTagIds?.length ? `${draft.assignTagIds.length} tags` : '')} 
                                status={draft.assignTagIds?.length || draft.suggestedTags?.length ? 'update' : 'keep'} 
                                icon={<ListIcon className="w-4 h-4" />} 
                            />
                            <ForecastFieldRow 
                                label="Ingestion Status" 
                                value={draft.skipImport ? 'Purge Record' : 'Process Record'} 
                                status={draft.skipImport ? 'skip' : 'keep'} 
                                icon={<SlashIcon className="w-4 h-4" />} 
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/20">
                                <InfoIcon className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h5 className="text-white font-black text-sm uppercase tracking-tight">Normalization Protocol</h5>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                                    The engine automatically squashes whitespace during synthesis. <code>"ALPINE&nbsp;&nbsp;&nbsp;&nbsp;UT"</code> and <code>"ALPINE UT"</code> are treated as functionally identical logic tokens.
                                </p>
                            </div>
                        </div>
                        <SparklesIcon className="absolute -right-8 -bottom-8 w-32 h-32 opacity-5 text-indigo-400" />
                    </div>
                </div>
                
                <div className="p-4 bg-white border-t border-slate-200">
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase rounded-2xl hover:bg-black transition-all shadow-xl">Dismiss Forecast</button>
                </div>
            </div>
        </div>
    );
};

const RuleImportVerification: React.FC<Props> = ({ 
    drafts: initialDrafts, onCancel, onFinalize, categories, payees, locations, users, tags, transactionTypes, 
    onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, existingRules
}) => {
    const existingNames = useMemo(() => new Map(existingRules.map(r => [r.name.toLowerCase(), r])), [existingRules]);

    const processedDrafts = useMemo(() => {
        return initialDrafts.map(d => {
            const existing = existingNames.get(d.name.toLowerCase());
            if (!existing) return d;
            const existingNormSet = new Set(existing.conditions.flatMap(c => getTokens(String(c.value || ''))));
            const incomingNormSet = new Set(d.conditions.flatMap(c => getTokens(String(c.value || ''))));
            const isLogicRedundant = Array.from(incomingNormSet).every(t => existingNormSet.has(t));
            const categoryMatch = existing.setCategoryId === d.setCategoryId || 
                (d.mappingStatus.category === 'match' && existing.setCategoryId === categories.find(c => c.name.toLowerCase() === d.suggestedCategoryName?.toLowerCase())?.id);

            if (isLogicRedundant && categoryMatch) return { ...d, isSelected: false };
            return d;
        });
    }, [initialDrafts, existingNames, categories]);

    const [drafts, setDrafts] = useState<RuleImportDraft[]>(processedDrafts);
    const [inspectingDraftId, setInspectingDraftId] = useState<string | null>(null);

    const toggleSelection = (id: string) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, isSelected: !d.isSelected } : d));
    };

    const updateDraftField = (id: string, field: keyof RuleImportDraft, value: any) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const handleConfirm = async () => {
        const selectedDrafts = drafts.filter(d => d.isSelected);
        if (selectedDrafts.length === 0) return;

        const finalizedRules: ReconciliationRule[] = [];
        const newCategories: Category[] = [];
        const newCounterparties: Counterparty[] = [];
        const newLocations: Location[] = [];

        const createdCats = new Map<string, string>();
        const createdCounterparties = new Map<string, string>();
        const createdLocs = new Map<string, string>();

        for (const draft of selectedDrafts) {
            let finalRule = { ...draft };
            const existing = existingRules.find(r => r.name.toLowerCase() === draft.name.toLowerCase());
            const isMergeCandidate = existing && (
                existing.setCategoryId === draft.setCategoryId || 
                (draft.mappingStatus.category === 'match' && existing.setCategoryId === categories.find(c => c.id === existing.setCategoryId)?.id)
            );

            if (isMergeCandidate && existing) {
                const existingValue = existing.conditions.map(c => c.value).join(' || ');
                const newValue = draft.conditions.map(c => c.value).join(' || ');
                const mergedValue = mergePatternsUniquely(existingValue, newValue);
                
                finalRule.id = existing.id;
                finalRule.conditions = [{
                    id: generateUUID(),
                    type: 'basic',
                    field: existing.conditions[0]?.field || 'description',
                    operator: existing.conditions[0]?.operator || 'contains',
                    value: mergedValue,
                    nextLogic: 'AND'
                }];
            } else {
                if (!draft.setCategoryId && draft.mappingStatus.category === 'create' && draft.suggestedCategoryName) {
                    const normName = draft.suggestedCategoryName.toLowerCase().trim();
                    let catId = createdCats.get(normName);
                    if (!catId) { catId = generateUUID(); newCategories.push({ id: catId, name: draft.suggestedCategoryName.trim() }); createdCats.set(normName, catId); }
                    finalRule.setCategoryId = catId;
                }
                if (!draft.setCounterpartyId && draft.mappingStatus.counterparty === 'create' && draft.suggestedCounterpartyName) {
                    const normName = draft.suggestedCounterpartyName.toLowerCase().trim();
                    let cpId = createdCounterparties.get(normName);
                    if (!cpId) { cpId = generateUUID(); newCounterparties.push({ id: cpId, name: draft.suggestedCounterpartyName.trim() }); createdCounterparties.set(normName, cpId); }
                    finalRule.setCounterpartyId = cpId;
                }
                if (!draft.setLocationId && draft.mappingStatus.location === 'create' && draft.suggestedLocationName) {
                    const normName = draft.suggestedLocationName.toLowerCase().trim();
                    let locId = createdLocs.get(normName);
                    if (!locId) { locId = generateUUID(); newLocations.push({ id: locId, name: draft.suggestedLocationName.trim() }); createdLocs.set(normName, locId); }
                    finalRule.setLocationId = locId;
                }
            }

            const { isSelected, mappingStatus, suggestedCategoryName, suggestedCounterpartyName, suggestedLocationName, suggestedTypeName, suggestedTags, ...cleanRule } = finalRule as any;
            finalizedRules.push(cleanRule);
        }

        if (newCategories.length > 0) onSaveCategories(newCategories);
        if (newCounterparties.length > 0) onSaveCounterparties(newCounterparties);
        if (newLocations.length > 0) onSaveLocations(newLocations);
        onFinalize(finalizedRules);
    };

    const stats = useMemo(() => {
        const sel = drafts.filter(d => d.isSelected);
        return {
            total: drafts.length,
            selected: sel.length,
            newEntities: sel.reduce((acc, d) => {
                let count = 0;
                if (!d.setCategoryId && d.mappingStatus.category === 'create') count++;
                if (!d.setCounterpartyId && d.mappingStatus.counterparty === 'create') count++;
                if (!d.setLocationId && d.mappingStatus.location === 'create') count++;
                return acc + count;
            }, 0),
            merges: sel.filter(d => {
                const ex = existingNames.get(d.name.toLowerCase());
                const categoryMatch = ex && (ex.setCategoryId === d.setCategoryId || d.suggestedCategoryName?.toLowerCase() === categories.find(c => c.id === existingNames.get(d.name.toLowerCase())?.setCategoryId)?.name.toLowerCase());
                if (!ex || !categoryMatch) return false;
                const existingNormSet = new Set(ex.conditions.flatMap(c => getTokens(String(c.value || ''))));
                const incomingNormSet = new Set(d.conditions.flatMap(c => getTokens(String(c.value || ''))));
                return Array.from(incomingNormSet).some(t => !existingNormSet.has(t));
            }).length
        };
    }, [drafts, existingNames, categories]);

    const inspectingDraft = useMemo(() => drafts.find(d => d.id === inspectingDraftId), [drafts, inspectingDraftId]);

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl flex justify-between items-center flex-shrink-0">
                <div className="flex gap-6">
                    <div>
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Staging Queue</p>
                        <p className="text-2xl font-black">{stats.total} Rules</p>
                    </div>
                    <div className="border-l border-white/10 pl-6">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">New Entities</p>
                        <p className="text-2xl font-black text-emerald-400">+{stats.newEntities}</p>
                    </div>
                    {stats.merges > 0 && (
                         <div className="border-l border-white/10 pl-6">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Functional Merges</p>
                            <p className="text-2xl font-black text-indigo-400">{stats.merges}</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-5 py-2 font-bold text-slate-400 hover:text-white transition-colors text-xs">Discard</button>
                    <button onClick={handleConfirm} disabled={stats.selected === 0} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl transition-all disabled:opacity-30 text-xs">Commit Ingestion</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden border border-slate-200 rounded-3xl bg-slate-50 flex flex-col shadow-inner">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 w-10 bg-slate-100 border-b border-slate-200"><input type="checkbox" checked={stats.selected === stats.total && stats.total > 0} onChange={() => setDrafts(prev => prev.map(p => ({ ...p, isSelected: stats.selected !== stats.total })))} className="rounded text-indigo-600 h-3 w-3" /></th>
                                <th className="px-2 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Identity Alias</th>
                                <th className="px-2 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Category</th>
                                <th className="px-2 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Counterparty</th>
                                <th className="px-2 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Type</th>
                                <th className="px-2 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Clean Desc</th>
                                <th className="px-2 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">User</th>
                                <th className="px-2 py-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Inspect</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {drafts.map(d => {
                                const existingRule = existingNames.get(d.name.toLowerCase());
                                const categoryMatch = existingRule && (existingRule.setCategoryId === d.setCategoryId || d.suggestedCategoryName?.toLowerCase() === categories.find(c => c.id === existingRule.setCategoryId)?.name.toLowerCase());
                                const existingNormSet = existingRule ? new Set(existingRule.conditions.flatMap(c => getTokens(String(c.value || '')))) : new Set();
                                const incomingNormSet = new Set(d.conditions.flatMap(c => getTokens(String(c.value || ''))));
                                const isLogicRedundant = existingRule && categoryMatch && Array.from(incomingNormSet).every(t => existingNormSet.has(t));
                                
                                const isMergeCandidate = categoryMatch && !isLogicRedundant;
                                const isCollision = existingRule && !categoryMatch;

                                return (
                                    <tr key={d.id} className={`${d.isSelected ? '' : 'opacity-30 grayscale'} hover:bg-slate-50 transition-all group`}>
                                        <td className="p-1.5 text-center border-b border-slate-100"><input type="checkbox" checked={d.isSelected} onChange={() => toggleSelection(d.id)} className="rounded text-indigo-600 h-3 w-3" /></td>
                                        <td className="px-2 py-1.5 min-w-[140px] border-b border-slate-100">
                                            <input type="text" value={d.name} onChange={e => updateDraftField(d.id, 'name', e.target.value)} className={`w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded p-0.5 font-bold text-[9px] ${isCollision ? 'text-amber-600' : isMergeCandidate ? 'text-indigo-600' : isLogicRedundant ? 'text-slate-400' : 'text-slate-800'}`} />
                                            {isLogicRedundant ? (
                                                <p className="text-[6px] font-black text-slate-400 uppercase mt-0.5 flex items-center gap-0.5"><ShieldCheckIcon className="w-1.5 h-1.5" /> Identity Match</p>
                                            ) : isMergeCandidate ? (
                                                <p className="text-[6px] font-black text-indigo-500 uppercase mt-0.5 flex items-center gap-0.5"><RepeatIcon className="w-1.5 h-1.5" /> Logical Synthesis</p>
                                            ) : isCollision ? (
                                                <p className="text-[6px] font-black text-amber-500 uppercase mt-0.5 flex items-center gap-0.5"><ExclamationTriangleIcon className="w-1.5 h-1.5" /> Identity Overlap</p>
                                            ) : null}
                                        </td>
                                        
                                        <td className="px-2 py-1.5 border-b border-slate-100 min-w-[100px]">
                                            <SearchableSelect options={categories} value={d.setCategoryId || ''} onChange={val => updateDraftField(d.id, 'setCategoryId', val)} placeholder={d.suggestedCategoryName || "Select..."} isHierarchical className="!bg-transparent text-[9px]" />
                                        </td>

                                        <td className="px-2 py-1.5 border-b border-slate-100 min-w-[100px]">
                                            <SearchableSelect options={payees} value={d.setCounterpartyId || ''} onChange={val => updateDraftField(d.id, 'setCounterpartyId', val)} placeholder={d.suggestedCounterpartyName || "Select..."} isHierarchical className="!bg-transparent text-[9px]" />
                                        </td>

                                        <td className="px-2 py-1.5 border-b border-slate-100 min-w-[80px]">
                                            <SearchableSelect options={transactionTypes} value={d.setTransactionTypeId || ''} onChange={val => updateDraftField(d.id, 'setTransactionTypeId', val)} placeholder={d.suggestedTypeName || "Select..."} className="!bg-transparent text-[9px]" />
                                        </td>

                                        <td className="px-2 py-1.5 border-b border-slate-100 min-w-[120px]">
                                            <input type="text" value={d.setDescription || ''} onChange={e => updateDraftField(d.id, 'setDescription', e.target.value)} placeholder="Keep Original" className="w-full bg-transparent border-none text-[9px] font-bold text-slate-600 focus:ring-1 focus:ring-indigo-500 rounded p-0.5" />
                                        </td>

                                        <td className="px-2 py-1.5 border-b border-slate-100 min-w-[80px]">
                                            <SearchableSelect options={users} value={d.setUserId || ''} onChange={val => updateDraftField(d.id, 'setUserId', val)} placeholder="Default" className="!bg-transparent text-[9px]" />
                                        </td>

                                        <td className="px-2 py-1.5 text-center border-b border-slate-100">
                                            <button onClick={() => setInspectingDraftId(d.id)} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-white transition-all opacity-0 group-hover:opacity-100"><WorkflowIcon className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                );
                            })}
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