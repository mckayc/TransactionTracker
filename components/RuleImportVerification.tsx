
import React, { useState, useMemo } from 'react';
import type { ReconciliationRule, Category, Counterparty, Location, User, TransactionType, RuleImportDraft } from '../types';
import { CheckCircleIcon, SlashIcon, ExclamationTriangleIcon, AddIcon, BoxIcon, TagIcon, MapPinIcon, UsersIcon, ShieldCheckIcon, CloseIcon, EditIcon, RepeatIcon, WorkflowIcon, InfoIcon, DatabaseIcon, ChevronRightIcon, ArrowRightIcon, SparklesIcon } from './Icons';
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
    transactionTypes: TransactionType[];
    onSaveCategory: (c: Category) => void;
    onSaveCategories: (cs: Category[]) => void;
    onSaveCounterparty: (p: Counterparty) => void;
    onSaveCounterparties: (ps: Counterparty[]) => void;
    onSaveLocation: (location: Location) => void;
    onSaveLocations: (ls: Location[]) => void;
    existingRules: ReconciliationRule[];
}

/**
 * Normalizes and merges multiple condition strings into a single unique OR-chain.
 * Performs set-based de-duplication to prevent logical bloat.
 */
const mergePatternsUniquely = (existing: string, incoming: string): string => {
    const existingTokens = existing.split(/\s*\|\|\s*/).map(t => t.trim()).filter(Boolean);
    const incomingTokens = incoming.split(/\s*\|\|\s*/).map(t => t.trim()).filter(Boolean);
    
    const seen = new Set<string>();
    const result: string[] = [];
    
    [...existingTokens, ...incomingTokens].forEach(token => {
        const normalized = token.toLowerCase();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            result.push(token);
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
    onClose: () => void; 
}> = ({ draft, existingRule, categories, payees, locations, onClose }) => {
    const isMerge = !!existingRule && (
        existingRule.setCategoryId === draft.setCategoryId || 
        (draft.mappingStatus.category === 'match' && existingRule.setCategoryId === categories.find(c => c.name.toLowerCase() === draft.suggestedCategoryName?.toLowerCase())?.id)
    );

    const mergedPatternPreview = useMemo(() => {
        if (!existingRule) return '';
        const existing = existingRule.conditions.map(c => c.value).join(' || ');
        const incoming = draft.conditions.map(c => c.value).join(' || ');
        return mergePatternsUniquely(existing, incoming);
    }, [existingRule, draft]);

    const resolveEntity = (field: 'category' | 'counterparty' | 'location') => {
        const status = draft.mappingStatus[field];
        let sourceName = '';
        
        if (field === 'category') sourceName = draft.suggestedCategoryName || '';
        if (field === 'counterparty') sourceName = draft.suggestedCounterpartyName || '';
        if (field === 'location') sourceName = draft.suggestedLocationName || '';

        if (!sourceName) return null;

        return (
            <div className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field}</p>
                    <p className="text-sm font-bold text-slate-800">{sourceName}</p>
                </div>
                <div className="flex items-center gap-3">
                    <ArrowRightIcon className="w-4 h-4 text-slate-300" />
                    <div className={`px-3 py-1.5 rounded-xl border-2 flex items-center gap-2 ${status === 'match' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                        {status === 'match' ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <AddIcon className="w-3.5 h-3.5" />}
                        <span className="text-[10px] font-black uppercase">{status === 'match' ? 'Matched' : 'Creating New'}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[250] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-slate-50 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <WorkflowIcon className="w-5 h-5 text-indigo-600" />
                            Logic Resolution Forecast
                        </h3>
                        <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Rule ID: {draft.id.substring(0,8)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* MERGE LOGIC PREVIEW */}
                    {isMerge && existingRule && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full w-max text-[10px] font-black uppercase tracking-widest">
                                <RepeatIcon className="w-3 h-3" /> Synthesis Strategy: Set-Based Reconciliation
                            </div>
                            <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-6 shadow-xl border border-indigo-500/20">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Target Core Rule</p>
                                    <p className="text-lg font-black">{existingRule.name}</p>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2 opacity-60">
                                        <p className="text-[9px] font-black text-slate-500 uppercase">Existing Pattern</p>
                                        <code className="block p-3 bg-white/5 rounded-xl text-xs font-mono text-slate-300">
                                            {existingRule.conditions.map(c => c.value).join(' || ')}
                                        </code>
                                    </div>
                                    <div className="flex justify-center">
                                        <div className="px-4 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">De-duplication Check</div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase">Incoming Pattern</p>
                                        <code className="block p-3 bg-white/5 rounded-xl text-xs font-mono text-indigo-200">
                                            {draft.conditions.map(c => c.value).join(' || ')}
                                        </code>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10 space-y-2">
                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Resulting Engine Logic (Cleaned Result)</p>
                                    <code className="block p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm font-mono text-emerald-300">
                                        {mergedPatternPreview}
                                    </code>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ENTITY MAPPING PREVIEW */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <DatabaseIcon className="w-4 h-4" /> Entity Resolution
                        </h4>
                        <div className="space-y-2">
                            {resolveEntity('category')}
                            {resolveEntity('counterparty')}
                            {resolveEntity('location')}
                        </div>
                    </div>

                    <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] space-y-2">
                         <div className="flex items-center gap-2 text-amber-800">
                            <InfoIcon className="w-5 h-5" />
                            <h4 className="font-black text-sm uppercase">Verification Protocol</h4>
                         </div>
                         <p className="text-xs text-amber-700 leading-relaxed font-medium">
                            The system now uses <strong className="text-amber-900">Logical De-duplication</strong>. If an incoming search pattern already exists in the target rule, it will not be appended. This maintains optimal engine performance.
                         </p>
                    </div>
                </div>
                
                <div className="p-4 bg-white border-t border-slate-200">
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase rounded-2xl hover:bg-black transition-all">Dismiss Forecast</button>
                </div>
            </div>
        </div>
    );
};

const RuleImportVerification: React.FC<Props> = ({ 
    drafts: initialDrafts, onCancel, onFinalize, categories, payees, locations, users, transactionTypes, 
    onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, existingRules
}) => {
    const [drafts, setDrafts] = useState<RuleImportDraft[]>(initialDrafts);
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
                // If the user manually selected an ID, it will be in draft.setCategoryId, etc.
                // We only need to handle the 'create' logic if they left the suggested names
                
                // 1. Category Resolution
                if (!draft.setCategoryId && draft.mappingStatus.category === 'create' && draft.suggestedCategoryName) {
                    const normName = draft.suggestedCategoryName.toLowerCase().trim();
                    let catId = createdCats.get(normName);
                    if (!catId) {
                        catId = generateUUID();
                        const newCat: Category = { id: catId, name: draft.suggestedCategoryName.trim() };
                        newCategories.push(newCat);
                        createdCats.set(normName, catId);
                    }
                    finalRule.setCategoryId = catId;
                }

                // 2. Counterparty Resolution
                if (!draft.setCounterpartyId && draft.mappingStatus.counterparty === 'create' && draft.suggestedCounterpartyName) {
                    const normName = draft.suggestedCounterpartyName.toLowerCase().trim();
                    let cpId = createdCounterparties.get(normName);
                    if (!cpId) {
                        cpId = generateUUID();
                        const newCp: Counterparty = { id: cpId, name: draft.suggestedCounterpartyName.trim() };
                        newCounterparties.push(newCp);
                        createdCounterparties.set(normName, cpId);
                    }
                    finalRule.setCounterpartyId = cpId;
                }

                // 3. Location Resolution
                if (!draft.setLocationId && draft.mappingStatus.location === 'create' && draft.suggestedLocationName) {
                    const normName = draft.suggestedLocationName.toLowerCase().trim();
                    let locId = createdLocs.get(normName);
                    if (!locId) {
                        locId = generateUUID();
                        const newLoc: Location = { id: locId, name: draft.suggestedLocationName.trim() };
                        newLocations.push(newLoc);
                        createdLocs.set(normName, locId);
                    }
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

    const existingNames = useMemo(() => new Map(existingRules.map(r => [r.name.toLowerCase(), r])), [existingRules]);

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
            collisions: sel.filter(d => {
                const ex = existingNames.get(d.name.toLowerCase());
                return ex && ex.setCategoryId !== d.setCategoryId && d.suggestedCategoryName?.toLowerCase() !== categories.find(c => c.id === ex.setCategoryId)?.name.toLowerCase();
            }).length,
            merges: sel.filter(d => {
                const ex = existingNames.get(d.name.toLowerCase());
                return ex && (ex.setCategoryId === d.setCategoryId || d.suggestedCategoryName?.toLowerCase() === categories.find(c => c.id === existingNames.get(d.name.toLowerCase())?.setCategoryId)?.name.toLowerCase());
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
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Auto-Merges</p>
                            <p className="text-2xl font-black text-indigo-400">{stats.merges}</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-5 py-2 font-bold text-slate-400 hover:text-white transition-colors text-xs">Discard</button>
                    <button onClick={handleConfirm} disabled={stats.selected === 0} className="px-8 py-2 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-500 transition-all disabled:opacity-30 text-xs">Commit Ingestion</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden border border-slate-200 rounded-3xl bg-slate-50 flex flex-col shadow-inner">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 w-10 bg-slate-100 border-b border-slate-200"><input type="checkbox" checked={stats.selected === stats.total && stats.total > 0} onChange={() => setDrafts(prev => prev.map(p => ({ ...p, isSelected: stats.selected !== stats.total })))} className="rounded text-indigo-600 h-3 w-3" /></th>
                                <th className="px-3 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Logic Alias</th>
                                <th className="px-3 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Category</th>
                                <th className="px-3 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Counterparty</th>
                                <th className="px-3 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Location</th>
                                <th className="px-3 py-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Inspect</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {drafts.map(d => {
                                const existingRule = existingNames.get(d.name.toLowerCase());
                                const isMergeCandidate = existingRule && (existingRule.setCategoryId === d.setCategoryId || d.suggestedCategoryName?.toLowerCase() === categories.find(c => c.id === existingRule.setCategoryId)?.name.toLowerCase());
                                const isCollision = existingRule && !isMergeCandidate;

                                return (
                                    <tr key={d.id} className={`${d.isSelected ? '' : 'opacity-40 grayscale'} hover:bg-slate-50 transition-all group`}>
                                        <td className="p-1.5 text-center border-b border-slate-100"><input type="checkbox" checked={d.isSelected} onChange={() => toggleSelection(d.id)} className="rounded text-indigo-600 h-3 w-3" /></td>
                                        <td className="px-3 py-1.5 min-w-[150px] border-b border-slate-100">
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={d.name} 
                                                    onChange={e => updateDraftField(d.id, 'name', e.target.value)}
                                                    className={`w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded p-0.5 font-bold text-[10px] ${isCollision ? 'text-amber-600' : isMergeCandidate ? 'text-indigo-600' : 'text-slate-800'}`}
                                                />
                                            </div>
                                            {isCollision ? (
                                                <p className="text-[7px] font-black text-amber-500 uppercase mt-0.5 flex items-center gap-0.5">
                                                    <ExclamationTriangleIcon className="w-1.5 h-1.5" /> Collision
                                                </p>
                                            ) : isMergeCandidate ? (
                                                <p className="text-[7px] font-black text-indigo-500 uppercase mt-0.5 flex items-center gap-0.5">
                                                    <RepeatIcon className="w-1.5 h-1.5" /> Logical Merge
                                                </p>
                                            ) : null}
                                        </td>
                                        
                                        <td className="px-3 py-1.5 border-b border-slate-100 min-w-[120px]">
                                            <SearchableSelect 
                                                options={categories}
                                                value={d.setCategoryId || ''}
                                                onChange={val => updateDraftField(d.id, 'setCategoryId', val)}
                                                placeholder={d.suggestedCategoryName || "Select..."}
                                                isHierarchical
                                                className="!bg-transparent text-[10px]"
                                            />
                                        </td>

                                        <td className="px-3 py-1.5 border-b border-slate-100 min-w-[120px]">
                                            <SearchableSelect 
                                                options={payees}
                                                value={d.setCounterpartyId || ''}
                                                onChange={val => updateDraftField(d.id, 'setCounterpartyId', val)}
                                                placeholder={d.suggestedCounterpartyName || "Select..."}
                                                isHierarchical
                                                className="!bg-transparent text-[10px]"
                                            />
                                        </td>

                                        <td className="px-3 py-1.5 border-b border-slate-100 min-w-[120px]">
                                            <SearchableSelect 
                                                options={locations}
                                                value={d.setLocationId || ''}
                                                onChange={val => updateDraftField(d.id, 'setLocationId', val)}
                                                placeholder={d.suggestedLocationName || "Select..."}
                                                className="!bg-transparent text-[10px]"
                                            />
                                        </td>

                                        <td className="px-3 py-1.5 text-center border-b border-slate-100">
                                            <button 
                                                onClick={() => setInspectingDraftId(d.id)}
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                                                title="View Resolution Forecast"
                                            >
                                                <WorkflowIcon className="w-4 h-4" />
                                            </button>
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
                    onClose={() => setInspectingDraftId(null)}
                />
            )}
        </div>
    );
};

export default RuleImportVerification;
