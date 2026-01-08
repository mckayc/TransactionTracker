
import React, { useState, useMemo } from 'react';
import type { ReconciliationRule, Category, Counterparty, Location, User, TransactionType, RuleImportDraft } from '../types';
import { CheckCircleIcon, SlashIcon, ExclamationTriangleIcon, AddIcon, BoxIcon, TagIcon, MapPinIcon, UsersIcon, ShieldCheckIcon, CloseIcon, EditIcon, RepeatIcon } from './Icons';
import { generateUUID } from '../utils';

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

const RULE_SCOPES = [
    { id: 'all', name: 'Global' },
    { id: 'description', name: 'Description' },
    { id: 'counterpartyId', name: 'Entity' },
    { id: 'locationId', name: 'Location' },
    { id: 'userId', name: 'User' },
    { id: 'tagIds', name: 'Taxonomy' }
];

const RuleImportVerification: React.FC<Props> = ({ 
    drafts: initialDrafts, onCancel, onFinalize, categories, payees, locations, users, transactionTypes, 
    onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, existingRules
}) => {
    const [drafts, setDrafts] = useState<RuleImportDraft[]>(initialDrafts);

    const toggleSelection = (id: string) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, isSelected: !d.isSelected } : d));
    };

    const updateDraftField = (id: string, field: string, value: string) => {
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

            // Logic to handle "Mergeable" rules
            const existing = existingRules.find(r => r.name.toLowerCase() === draft.name.toLowerCase());
            
            // A rule is mergeable if it has the exact same TARGET (Category) 
            // This prevents logical collisions where two different rules share a name
            const isMergeCandidate = existing && (
                existing.setCategoryId === draft.setCategoryId || 
                (draft.mappingStatus.category === 'match' && existing.setCategoryId === categories.find(c => c.name.toLowerCase() === draft.suggestedCategoryName?.toLowerCase())?.id)
            );

            if (isMergeCandidate && existing) {
                // If the rule already exists and maps to the same category, merge the logic
                // Merge conditions by joining values with OR logic (||)
                const existingValues = existing.conditions.map(c => c.value).join(' || ');
                const newValues = draft.conditions.map(c => c.value).join(' || ');
                
                // Construct a merged condition set
                finalRule.id = existing.id; // CRITICAL: Use existing ID to trigger UPDATE in the DB
                finalRule.conditions = [{
                    id: generateUUID(),
                    type: 'basic',
                    field: existing.conditions[0]?.field || 'description',
                    operator: existing.conditions[0]?.operator || 'contains',
                    value: `${existingValues} || ${newValues}`,
                    nextLogic: 'AND'
                }];
            } else {
                // 1. RESOLVE OR CREATE CATEGORY
                if (draft.mappingStatus.category === 'match' && draft.suggestedCategoryName) {
                    const match = categories.find(c => c.name.toLowerCase().trim() === draft.suggestedCategoryName?.toLowerCase().trim());
                    if (match) finalRule.setCategoryId = match.id;
                } else if (draft.mappingStatus.category === 'create' && draft.suggestedCategoryName) {
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

                // 2. RESOLVE OR CREATE COUNTERPARTY
                if (draft.mappingStatus.counterparty === 'match' && draft.suggestedCounterpartyName) {
                    const match = payees.find(p => p.name.toLowerCase().trim() === draft.suggestedCounterpartyName?.toLowerCase().trim());
                    if (match) finalRule.setCounterpartyId = match.id;
                } else if (draft.mappingStatus.counterparty === 'create' && draft.suggestedCounterpartyName) {
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

                // 3. RESOLVE OR CREATE LOCATION
                if (draft.mappingStatus.location === 'match' && draft.suggestedLocationName) {
                    const match = locations.find(l => l.name.toLowerCase().trim() === draft.suggestedLocationName?.toLowerCase().trim());
                    if (match) finalRule.setLocationId = match.id;
                } else if (draft.mappingStatus.location === 'create' && draft.suggestedLocationName) {
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

                // 4. RESOLVE TRANSACTION TYPE
                if (draft.suggestedTypeName) {
                    const matchedType = transactionTypes.find(t => t.name.toLowerCase().trim() === draft.suggestedTypeName?.toLowerCase().trim());
                    if (matchedType) finalRule.setTransactionTypeId = matchedType.id;
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
                if (d.mappingStatus.category === 'create') count++;
                if (d.mappingStatus.counterparty === 'create') count++;
                if (d.mappingStatus.location === 'create') count++;
                return acc + count;
            }, 0),
            collisions: sel.filter(d => {
                const ex = existingNames.get(d.name.toLowerCase());
                // True conflict ONLY if name matches but target category differs (logical discrepancy)
                return ex && ex.setCategoryId !== d.setCategoryId && d.suggestedCategoryName?.toLowerCase() !== categories.find(c => c.id === ex.setCategoryId)?.name.toLowerCase();
            }).length,
            merges: sel.filter(d => {
                const ex = existingNames.get(d.name.toLowerCase());
                // Merge candidate if name matches AND target matches
                return ex && (ex.setCategoryId === d.setCategoryId || d.suggestedCategoryName?.toLowerCase() === categories.find(c => c.id === existingNames.get(d.name.toLowerCase())?.setCategoryId)?.name.toLowerCase());
            }).length
        };
    }, [drafts, existingNames, categories]);

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
                    {stats.collisions > 0 && (
                        <div className="border-l border-white/10 pl-6">
                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-0.5">Conflicts</p>
                            <p className="text-2xl font-black text-amber-400">{stats.collisions}</p>
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
                                <th className="px-3 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Scope</th>
                                <th className="px-3 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Criterial Definition</th>
                                <th className="px-3 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Entity Mapping</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {drafts.map(d => {
                                const existingRule = existingNames.get(d.name.toLowerCase());
                                const isMergeCandidate = existingRule && (existingRule.setCategoryId === d.setCategoryId || d.suggestedCategoryName?.toLowerCase() === categories.find(c => c.id === existingRule.setCategoryId)?.name.toLowerCase());
                                const isCollision = existingRule && !isMergeCandidate;

                                return (
                                    <tr key={d.id} className={`${d.isSelected ? '' : 'opacity-40 grayscale'} hover:bg-slate-50 transition-all`}>
                                        <td className="p-1.5 text-center border-b border-slate-100"><input type="checkbox" checked={d.isSelected} onChange={() => toggleSelection(d.id)} className="rounded text-indigo-600 h-3 w-3" /></td>
                                        <td className="px-3 py-1.5 min-w-[150px] border-b border-slate-100">
                                            <div className="relative group">
                                                <input 
                                                    type="text" 
                                                    value={d.name} 
                                                    onChange={e => updateDraftField(d.id, 'name', e.target.value)}
                                                    className={`w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded p-0.5 font-bold text-[10px] ${isCollision ? 'text-amber-600' : isMergeCandidate ? 'text-indigo-600' : 'text-slate-800'}`}
                                                />
                                                <EditIcon className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none" />
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
                                        <td className="px-3 py-1.5 border-b border-slate-100">
                                            <select 
                                                value={d.ruleCategory || 'all'}
                                                onChange={e => updateDraftField(d.id, 'ruleCategory', e.target.value)}
                                                className="bg-transparent border-none p-0 text-[10px] font-black uppercase text-slate-500 focus:ring-0 cursor-pointer hover:text-indigo-600"
                                            >
                                                {RULE_SCOPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-3 py-1.5 border-b border-slate-100">
                                            <div className="bg-slate-50 px-2 py-0.5 rounded-lg text-[9px] font-mono border border-slate-100 max-w-[240px] overflow-hidden truncate text-slate-500">
                                                {d.conditions.map((c, i) => (
                                                    <span key={c.id}>
                                                        {c.field} {c.operator} <strong className="text-indigo-600">"{c.value}"</strong>
                                                        {i < d.conditions.length - 1 && <span className="mx-0.5 text-indigo-400 font-black">{c.nextLogic || 'AND'}</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 border-b border-slate-100">
                                            <div className="flex flex-wrap gap-1">
                                                {d.suggestedCategoryName !== undefined && (
                                                    <input 
                                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border focus:ring-1 focus:ring-indigo-500 outline-none w-20 ${d.mappingStatus.category === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                                        value={d.suggestedCategoryName || ''}
                                                        onChange={e => updateDraftField(d.id, 'suggestedCategoryName', e.target.value)}
                                                        placeholder="CAT"
                                                    />
                                                )}
                                                {d.suggestedCounterpartyName !== undefined && (
                                                    <input 
                                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border focus:ring-1 focus:ring-indigo-500 outline-none w-20 ${d.mappingStatus.counterparty === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                                        value={d.suggestedCounterpartyName || ''}
                                                        onChange={e => updateDraftField(d.id, 'suggestedCounterpartyName', e.target.value)}
                                                        placeholder="ENTITY"
                                                    />
                                                )}
                                                {d.suggestedLocationName !== undefined && (
                                                    <input 
                                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border focus:ring-1 focus:ring-indigo-500 outline-none w-20 ${d.mappingStatus.location === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                                        value={d.suggestedLocationName || ''}
                                                        onChange={e => updateDraftField(d.id, 'suggestedLocationName', e.target.value)}
                                                        placeholder="LOC"
                                                    />
                                                )}
                                                {d.skipImport && (
                                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded text-[8px] font-black uppercase flex items-center gap-1">
                                                        <SlashIcon className="w-2 h-2" /> IGNORE
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RuleImportVerification;
