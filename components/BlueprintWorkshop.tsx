
import React, { useState, useMemo } from 'react';
import type { 
    BlueprintTemplate, 
    BlueprintExample, 
    Category, 
    Payee, 
    Merchant, 
    Location, 
    User, 
    TransactionType, 
    Tag 
} from '../types';
import { 
    CloseIcon, 
    SparklesIcon, 
    AddIcon, 
    DeleteIcon, 
    RobotIcon, 
    InfoIcon, 
    CheckCircleIcon, 
    SaveIcon, 
    TagIcon, 
    BoxIcon, 
    MapPinIcon, 
    UserGroupIcon, 
    ChecklistIcon, 
    UsersIcon 
} from './Icons';
import { generateUUID } from '../utils';

interface BlueprintWorkshopProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (template: BlueprintTemplate) => void;
    rawLines: string[];
    categories: Category[];
    payees: Payee[];
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    types: TransactionType[];
    tags: Tag[];
    // Add save handlers for inline creation
    onSaveCategory: (c: Category) => void;
    onSavePayee: (p: Payee) => void;
    onSaveMerchant: (m: Merchant) => void;
    onSaveLocation: (l: Location) => void;
    onSaveUser: (u: User) => void;
}

const QuickAddInput: React.FC<{
    onSave: (name: string) => void;
    onCancel: () => void;
    placeholder: string;
}> = ({ onSave, onCancel, placeholder }) => {
    const [val, setVal] = useState('');
    return (
        <div className="flex gap-1 animate-fade-in">
            <input 
                autoFocus
                type="text" 
                value={val} 
                onChange={e => setVal(e.target.value)} 
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); onSave(val); }
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder={placeholder}
                className="flex-1 p-2 border-2 border-indigo-500 rounded-lg text-xs font-bold focus:ring-0"
            />
            <button onClick={() => onSave(val)} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"><CheckCircleIcon className="w-4 h-4"/></button>
            <button onClick={onCancel} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"><CloseIcon className="w-4 h-4"/></button>
        </div>
    );
};

const BlueprintWorkshop: React.FC<BlueprintWorkshopProps> = ({ 
    isOpen, onClose, onSave, rawLines, categories, payees, merchants, locations, users, types, tags,
    onSaveCategory, onSavePayee, onSaveMerchant, onSaveLocation, onSaveUser
}) => {
    const [name, setName] = useState('');
    const [examples, setExamples] = useState<BlueprintExample[]>([]);
    const [activeLine, setActiveLine] = useState<string | null>(null);

    // Full Example Mapping Form State
    const [eCatId, setECatId] = useState('');
    const [ePayId, setEPayId] = useState('');
    const [eMerId, setEMerId] = useState('');
    const [eLocId, setELocId] = useState('');
    const [eUserId, setEUserId] = useState(users.find(u => u.isDefault)?.id || users[0]?.id || '');
    const [eTypeId, setETypeId] = useState(types.find(t => t.balanceEffect === 'expense')?.id || types[0]?.id || '');
    const [eTagIds, setETagIds] = useState<Set<string>>(new Set());

    // Inline Creation State
    const [inlineType, setInlineType] = useState<null | 'category' | 'payee' | 'merchant' | 'location' | 'user'>(null);

    if (!isOpen) return null;

    const toggleTag = (id: string) => {
        setETagIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleQuickAdd = (value: string) => {
        if (!value.trim()) { setInlineType(null); return; }
        const id = generateUUID();
        const payload = { id, name: value.trim() };

        switch (inlineType) {
            case 'category': onSaveCategory(payload); setECatId(id); break;
            case 'payee': onSavePayee(payload); setEPayId(id); break;
            case 'merchant': onSaveMerchant(payload); setEMerId(id); break;
            case 'location': onSaveLocation(payload); setELocId(id); break;
            case 'user': onSaveUser(payload); setEUserId(id); break;
        }
        setInlineType(null);
    };

    const handleAddExample = () => {
        if (!activeLine) return;
        const newExample: BlueprintExample = {
            rawLine: activeLine,
            suggestedRule: {
                name: `Example: ${activeLine.substring(0, 25)}`,
                setCategoryId: eCatId || undefined,
                setPayeeId: ePayId || undefined,
                setMerchantId: eMerId || undefined,
                setLocationId: eLocId || undefined,
                setUserId: eUserId || undefined,
                setTransactionTypeId: eTypeId || undefined,
                assignTagIds: eTagIds.size > 0 ? Array.from(eTagIds) : undefined
            }
        };
        setExamples([...examples, newExample]);
        setActiveLine(null);
        // Reset form but keep User/Type as they are usually consistent across a file
        setECatId(''); setEPayId(''); setEMerId(''); setELocId('');
        setETagIds(new Set());
    };

    const handleSave = () => {
        if (!name.trim() || examples.length === 0) {
            alert("Blueprint name and at least one example mapping are required.");
            return;
        }
        onSave({
            id: generateUUID(),
            name: name.trim(),
            examples
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-8 h-8" />
                        <div>
                            <h3 className="text-xl font-black">Smart Template Workshop</h3>
                            <p className="text-xs text-indigo-200 uppercase font-bold tracking-widest">Blueprint Design Phase</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6"/></button>
                </div>

                <div className="flex-1 flex min-h-0">
                    {/* LEFT: RAW LINES */}
                    <div className="w-2/5 border-r border-slate-100 flex flex-col bg-slate-50">
                        <div className="p-4 border-b bg-white">
                            <h4 className="text-xs font-black text-slate-400 uppercase mb-2">Raw File Content</h4>
                            <p className="text-[10px] text-slate-500 leading-tight">Select a line that represents a unique transaction pattern.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {rawLines.map((line, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setActiveLine(line)}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all font-mono text-[10px] break-all ${activeLine === line ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:border-slate-200'}`}
                                >
                                    {line}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: BUILDER & EXAMPLES */}
                    <div className="w-3/5 flex flex-col bg-white overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Template Label</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AMEX Platinum Statement Blueprint" className="w-full p-3 border-2 border-white rounded-xl font-bold text-slate-800 text-lg shadow-sm" />
                            </div>

                            {activeLine ? (
                                <div className="p-6 bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] animate-fade-in space-y-6 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <h5 className="font-black text-indigo-900 text-sm uppercase tracking-widest flex items-center gap-2"><AddIcon className="w-4 h-4"/> Map Training Instance</h5>
                                        <button onClick={() => setActiveLine(null)} className="text-indigo-400 hover:text-indigo-600"><CloseIcon className="w-5 h-5"/></button>
                                    </div>
                                    
                                    <div className="bg-white p-4 rounded-xl border border-indigo-100 font-mono text-[10px] text-slate-500 leading-relaxed shadow-inner break-all">
                                        {activeLine}
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        {/* Category */}
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex justify-between">
                                                <span className="flex items-center gap-1"><TagIcon className="w-3 h-3"/> Category</span>
                                                {inlineType !== 'category' && <button type="button" onClick={() => setInlineType('category')} className="text-indigo-600 hover:underline">Create New</button>}
                                            </label>
                                            {inlineType === 'category' ? (
                                                <QuickAddInput onSave={handleQuickAdd} onCancel={() => setInlineType(null)} placeholder="New Category Name..." />
                                            ) : (
                                                <select value={eCatId} onChange={e => setECatId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-700">
                                                    <option value="">-- Inherit or Auto --</option>
                                                    {categories.sort((a,b)=>a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            )}
                                        </div>

                                        {/* Payee */}
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex justify-between">
                                                <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3"/> Payee</span>
                                                {inlineType !== 'payee' && <button type="button" onClick={() => setInlineType('payee')} className="text-indigo-600 hover:underline">Create New</button>}
                                            </label>
                                            {inlineType === 'payee' ? (
                                                <QuickAddInput onSave={handleQuickAdd} onCancel={() => setInlineType(null)} placeholder="New Payee Name..." />
                                            ) : (
                                                <select value={ePayId} onChange={e => setEPayId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-700">
                                                    <option value="">-- Inherit or Auto --</option>
                                                    {payees.sort((a,b)=>a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            )}
                                        </div>

                                        {/* Merchant */}
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex justify-between">
                                                <span className="flex items-center gap-1"><BoxIcon className="w-3 h-3"/> Merchant</span>
                                                {inlineType !== 'merchant' && <button type="button" onClick={() => setInlineType('merchant')} className="text-indigo-600 hover:underline">Create New</button>}
                                            </label>
                                            {inlineType === 'merchant' ? (
                                                <QuickAddInput onSave={handleQuickAdd} onCancel={() => setInlineType(null)} placeholder="New Merchant Name..." />
                                            ) : (
                                                <select value={eMerId} onChange={e => setEMerId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-700">
                                                    <option value="">-- No Merchant --</option>
                                                    {merchants.sort((a,b)=>a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                            )}
                                        </div>

                                        {/* Location */}
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex justify-between">
                                                <span className="flex items-center gap-1"><MapPinIcon className="w-3 h-3"/> Location</span>
                                                {inlineType !== 'location' && <button type="button" onClick={() => setInlineType('location')} className="text-indigo-600 hover:underline">Create New</button>}
                                            </label>
                                            {inlineType === 'location' ? (
                                                <QuickAddInput onSave={handleQuickAdd} onCancel={() => setInlineType(null)} placeholder="New Location..." />
                                            ) : (
                                                <select value={eLocId} onChange={e => setELocId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-700">
                                                    <option value="">-- No Location --</option>
                                                    {locations.sort((a,b)=>a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                </select>
                                            )}
                                        </div>

                                        {/* Owner */}
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex justify-between">
                                                <span className="flex items-center gap-1"><UserGroupIcon className="w-3 h-3"/> Owner</span>
                                                {inlineType !== 'user' && <button type="button" onClick={() => setInlineType('user')} className="text-indigo-600 hover:underline">Create New</button>}
                                            </label>
                                            {inlineType === 'user' ? (
                                                <QuickAddInput onSave={handleQuickAdd} onCancel={() => setInlineType(null)} placeholder="New User Name..." />
                                            ) : (
                                                <select value={eUserId} onChange={e => setEUserId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-700">
                                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </select>
                                            )}
                                        </div>

                                        {/* Direction */}
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex items-center gap-1"><ChecklistIcon className="w-3 h-3"/> Direction</label>
                                            <select value={eTypeId} onChange={e => setETypeId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-700">
                                                {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.balanceEffect})</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Append Taxonomy Tags</label>
                                        <div className="flex flex-wrap gap-2 p-3 bg-white/50 rounded-xl border border-indigo-100">
                                            {tags.map(tag => (
                                                <button 
                                                    key={tag.id} 
                                                    type="button"
                                                    onClick={() => toggleTag(tag.id)}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border-2 transition-all ${eTagIds.has(tag.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}
                                                >
                                                    {tag.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={handleAddExample} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Confirm Training Pair</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-16 border-2 border-dashed border-slate-200 rounded-[3rem] text-center bg-slate-50/50">
                                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl mx-auto mb-6">
                                        <RobotIcon className="w-10 h-10 text-indigo-600" />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">Deterministic Learning</h4>
                                    <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2 leading-relaxed">Select a line from the raw statement text on the left to teach Gemini how to map this specific bank's format.</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span>Blueprint Training Set ({examples.length})</span>
                                    </h4>
                                    {examples.length >= 3 && <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase flex items-center gap-1 shadow-sm border border-emerald-200 animate-pulse"><CheckCircleIcon className="w-3 h-3"/> High Reliability</div>}
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {examples.map((ex, idx) => (
                                        <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center group hover:border-indigo-300 transition-all shadow-sm">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-mono text-slate-400 truncate mb-2">{ex.rawLine}</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black uppercase">{categories.find(c => c.id === ex.suggestedRule.setCategoryId)?.name || 'Generic'}</span>
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black uppercase">{payees.find(p => p.id === ex.suggestedRule.setPayeeId)?.name || 'Auto'}</span>
                                                    {ex.suggestedRule.assignTagIds?.map(tid => (
                                                        <span key={tid} className="px-2 py-0.5 bg-slate-800 text-white rounded text-[8px] font-black uppercase">{tags.find(t => t.id === tid)?.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button onClick={() => setExamples(examples.filter((_, i) => i !== idx))} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteIcon className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm"><InfoIcon className="w-5 h-5 text-indigo-400" /></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Requirement</p>
                            <p className="text-xs font-bold text-slate-400">At least 1 example mapping required. 3+ recommended.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                         <button onClick={onClose} className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Discard</button>
                         <button 
                            onClick={handleSave} 
                            disabled={examples.length === 0 || !name.trim()}
                            className="px-12 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 disabled:opacity-30 flex items-center gap-2 transition-all transform active:scale-95"
                        >
                            <SaveIcon className="w-5 h-5" /> Commit Blueprint
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BlueprintWorkshop;
