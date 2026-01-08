import React, { useState, useMemo } from 'react';
import type { ReconciliationRule, Category, Counterparty, Location, User, TransactionType, RuleImportDraft } from '../types';
import { CheckCircleIcon, SlashIcon, ExclamationTriangleIcon, AddIcon, BoxIcon, TagIcon, MapPinIcon, UsersIcon, ShieldCheckIcon, CloseIcon, EditIcon } from './Icons';
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

            if (draft.mappingStatus.category === 'create' && draft.suggestedCategoryName) {
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

            if (draft.mappingStatus.counterparty === 'create' && draft.suggestedCounterpartyName) {
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

            if (draft.mappingStatus.location === 'create' && draft.suggestedLocationName) {
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

            if (draft.mappingStatus.type === 'create' && draft.suggestedTypeName) {
                const matchedType = transactionTypes.find(t => t.name.toLowerCase() === draft.suggestedTypeName?.toLowerCase());
                if (matchedType) finalRule.setTransactionTypeId = matchedType.id;
            }

            const { isSelected, mappingStatus, suggestedCategoryName, suggestedCounterpartyName, suggestedLocationName, suggestedTypeName, suggestedTags, ...cleanRule } = finalRule as any;
            finalizedRules.push(cleanRule);
        }

        if (newCategories.length > 0) onSaveCategories(newCategories);
        if (newCounterparties.length > 0) onSaveCounterparties(newCounterparties);
        if (newLocations.length > 0) onSaveLocations(newLocations);

        onFinalize(finalizedRules);
    };

    const existingNames = useMemo(() => new Set(existingRules.map(r => r.name.toLowerCase())), [existingRules]);

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
            collisions: sel.filter(d => existingNames.has(d.name.toLowerCase())).length
        };
    }, [drafts, existingNames]);

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center">
                <div className="flex gap-8">
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Queue Size</p>
                        <p className="text-3xl font-black">{stats.total} Rules</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Selection</p>
                        <p className="text-3xl font-black">{stats.selected} / {stats.total}</p>
                    </div>
                    <div className="border-l border-white/10 pl-8">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">New Entities</p>
                        <p className="text-3xl font-black text-emerald-400">+{stats.newEntities}</p>
                    </div>
                    {stats.collisions > 0 && (
                        <div className="border-l border-white/10 pl-8">
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Collisions</p>
                            <p className="text-3xl font-black text-amber-400">{stats.collisions}</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors">Discard</button>
                    <button onClick={handleConfirm} disabled={stats.selected === 0} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-500 transition-all disabled:opacity-30">Confirm & Commit Logic</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden border border-slate-200 rounded-3xl bg-slate-50 flex flex-col shadow-inner">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 bg-slate-100 border-b"><input type="checkbox" checked={stats.selected === stats.total && stats.total > 0} onChange={() => setDrafts(prev => prev.map(p => ({ ...p, isSelected: stats.selected !== stats.total })))} className="rounded text-indigo-600 h-4 w-4" /></th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Rule Identity</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Match Condition</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Resolution Metadata</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Scope</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {drafts.map(d => {
                                const isCollision = existingNames.has(d.name.toLowerCase());
                                return (
                                    <tr key={d.id} className={`${d.isSelected ? '' : 'opacity-40 grayscale'} hover:bg-slate-50 transition-all`}>
                                        <td className="p-4 text-center"><input type="checkbox" checked={d.isSelected} onChange={() => toggleSelection(d.id)} className="rounded text-indigo-600 h-4 w-4" /></td>
                                        <td className="px-4 py-3 min-w-[200px]">
                                            <div className="relative group">
                                                <input 
                                                    type="text" 
                                                    value={d.name} 
                                                    onChange={e => updateDraftField(d.id, 'name', e.target.value)}
                                                    className={`w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded p-1 font-bold text-sm ${isCollision ? 'text-amber-600' : 'text-slate-800'}`}
                                                />
                                                <EditIcon className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none" />
                                            </div>
                                            {isCollision && (
                                                <p className="text-[8px] font-black text-amber-500 uppercase mt-0.5 flex items-center gap-1">
                                                    <ExclamationTriangleIcon className="w-2 h-2" /> Existing name - will be skipped
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="bg-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-mono border border-slate-100 max-w-xs overflow-hidden leading-relaxed">
                                                {d.conditions.map((c, i) => (
                                                    <span key={c.id}>
                                                        {c.field} {c.operator} <strong className="text-indigo-600">"{c.value}"</strong>
                                                        {i < d.conditions.length - 1 && <span className="mx-1 text-indigo-400 font-black">{c.nextLogic || 'AND'}</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                {d.suggestedCategoryName && (
                                                    <div className="group/edit relative">
                                                        <input 
                                                            className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border focus:ring-1 focus:ring-indigo-500 outline-none ${d.mappingStatus.category === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                                            value={d.suggestedCategoryName}
                                                            onChange={e => updateDraftField(d.id, 'suggestedCategoryName', e.target.value)}
                                                            title="Category"
                                                        />
                                                    </div>
                                                )}
                                                {d.suggestedCounterpartyName && (
                                                    <input 
                                                        className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border focus:ring-1 focus:ring-indigo-500 outline-none ${d.mappingStatus.counterparty === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                                        value={d.suggestedCounterpartyName}
                                                        onChange={e => updateDraftField(d.id, 'suggestedCounterpartyName', e.target.value)}
                                                        title="Counterparty"
                                                    />
                                                )}
                                                {d.skipImport && (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5">
                                                        <SlashIcon className="w-3 h-3" /> Auto-Ignore
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-widest">{d.ruleCategory || 'Logic'}</span>
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