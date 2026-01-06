
import React, { useState, useMemo } from 'react';
import type { ReconciliationRule, Category, Payee, Merchant, Location, User, TransactionType, RuleImportDraft } from '../types';
import { CheckCircleIcon, SlashIcon, ExclamationTriangleIcon, AddIcon, BoxIcon, TagIcon, MapPinIcon, UsersIcon, ShieldCheckIcon, CloseIcon } from './Icons';
import { generateUUID } from '../utils';

interface Props {
    drafts: RuleImportDraft[];
    onCancel: () => void;
    onFinalize: (rules: ReconciliationRule[]) => void;
    categories: Category[];
    payees: Payee[];
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    transactionTypes: TransactionType[];
    onSaveCategory: (c: Category) => void;
    onSavePayee: (p: Payee) => void;
    onSaveMerchant: (m: Merchant) => void;
    onSaveLocation: (l: Location) => void;
}

const RuleImportVerification: React.FC<Props> = ({ 
    drafts: initialDrafts, onCancel, onFinalize, categories, payees, merchants, locations, users, transactionTypes, onSaveCategory, onSavePayee, onSaveMerchant, onSaveLocation 
}) => {
    const [drafts, setDrafts] = useState<RuleImportDraft[]>(initialDrafts);

    const toggleSelection = (id: string) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, isSelected: !d.isSelected } : d));
    };

    const handleConfirm = async () => {
        const selectedDrafts = drafts.filter(d => d.isSelected);
        if (selectedDrafts.length === 0) return;

        const finalizedRules: ReconciliationRule[] = [];

        for (const draft of selectedDrafts) {
            let finalRule = { ...draft };

            // 1. Resolve Category
            if (draft.mappingStatus.category === 'create' && draft.suggestedCategoryName) {
                const newCat: Category = { id: generateUUID(), name: draft.suggestedCategoryName };
                onSaveCategory(newCat);
                finalRule.setCategoryId = newCat.id;
            }

            // 2. Resolve Payee
            if (draft.mappingStatus.payee === 'create' && draft.suggestedPayeeName) {
                const newPayee: Payee = { id: generateUUID(), name: draft.suggestedPayeeName };
                onSavePayee(newPayee);
                finalRule.setPayeeId = newPayee.id;
            }

            // 3. Resolve Merchant
            if (draft.mappingStatus.merchant === 'create' && draft.suggestedMerchantName) {
                const newMerchant: Merchant = { id: generateUUID(), name: draft.suggestedMerchantName };
                onSaveMerchant(newMerchant);
                finalRule.setMerchantId = newMerchant.id;
            }

            // 4. Resolve Location
            if (draft.mappingStatus.location === 'create' && draft.suggestedLocationName) {
                const newLoc: Location = { id: generateUUID(), name: draft.suggestedLocationName };
                onSaveLocation(newLoc);
                finalRule.setLocationId = newLoc.id;
            }

            // 5. Resolve Type
            if (draft.mappingStatus.type === 'create' && draft.suggestedTypeName) {
                const matchedType = transactionTypes.find(t => t.name.toLowerCase() === draft.suggestedTypeName?.toLowerCase());
                if (matchedType) finalRule.setTransactionTypeId = matchedType.id;
            }

            // Clean internal draft fields before saving
            delete (finalRule as any).isSelected;
            delete (finalRule as any).mappingStatus;
            delete (finalRule as any).suggestedCategoryName;
            delete (finalRule as any).suggestedPayeeName;
            delete (finalRule as any).suggestedMerchantName;
            delete (finalRule as any).suggestedLocationName;
            delete (finalRule as any).suggestedTypeName;
            delete (finalRule as any).suggestedTags;

            finalizedRules.push(finalRule);
        }

        onFinalize(finalizedRules);
    };

    const stats = useMemo(() => {
        const sel = drafts.filter(d => d.isSelected);
        return {
            total: drafts.length,
            selected: sel.length,
            newEntities: sel.reduce((acc, d) => {
                let count = 0;
                if (d.mappingStatus.category === 'create') count++;
                if (d.mappingStatus.payee === 'create') count++;
                if (d.mappingStatus.merchant === 'create') count++;
                if (d.mappingStatus.location === 'create') count++;
                return acc + count;
            }, 0)
        };
    }, [drafts]);

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
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Auto-Creation</p>
                        <p className="text-3xl font-black text-emerald-400">+{stats.newEntities} Entities</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors">Discard</button>
                    <button onClick={handleConfirm} disabled={stats.selected === 0} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-500 transition-all disabled:opacity-30">Confirm & Commit Logic</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden border border-slate-200 rounded-3xl bg-slate-50 flex flex-col">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 bg-slate-100 border-b"><input type="checkbox" checked={stats.selected === stats.total} onChange={() => setDrafts(prev => prev.map(p => ({ ...p, isSelected: stats.selected !== stats.total })))} className="rounded text-indigo-600 h-4 w-4" /></th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Rule Identity</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Match Condition</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Resolution Decisions</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {drafts.map(d => (
                                <tr key={d.id} className={`${d.isSelected ? '' : 'opacity-40 grayscale'} hover:bg-slate-50 transition-all`}>
                                    <td className="p-4 text-center"><input type="checkbox" checked={d.isSelected} onChange={() => toggleSelection(d.id)} className="rounded text-indigo-600 h-4 w-4" /></td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-slate-800 text-sm">{d.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{d.ruleCategory || 'General'}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-[11px] font-mono border border-slate-200">
                                            If {d.conditions[0].field} {d.conditions[0].operator} <strong className="text-indigo-600">"{d.conditions[0].value}"</strong>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            {d.suggestedCategoryName && (
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border ${d.mappingStatus.category === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                                    <TagIcon className="w-3 h-3" /> Cat: {d.suggestedCategoryName} {d.mappingStatus.category === 'match' ? '(Matched)' : '(New)'}
                                                </span>
                                            )}
                                            {d.suggestedMerchantName && (
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border ${d.mappingStatus.merchant === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                                    <BoxIcon className="w-3 h-3" /> Merc: {d.suggestedMerchantName} {d.mappingStatus.merchant === 'match' ? '(Matched)' : '(New)'}
                                                </span>
                                            )}
                                            {d.suggestedLocationName && (
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border ${d.mappingStatus.location === 'match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                                    <MapPinIcon className="w-3 h-3" /> Loc: {d.suggestedLocationName} {d.mappingStatus.location === 'match' ? '(Matched)' : '(New)'}
                                                </span>
                                            )}
                                            {d.skipImport && (
                                                <span className="px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5">
                                                    <SlashIcon className="w-3 h-3" /> Auto-Ignore
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => toggleSelection(d.id)} className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border transition-all ${d.isSelected ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'}`}>
                                            {d.isSelected ? 'Exclude' : 'Include'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RuleImportVerification;
