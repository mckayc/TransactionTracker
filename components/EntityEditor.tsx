
import React, { useState, useEffect, useMemo } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, AccountType, Account, BalanceEffect, Location, ReconciliationRule, ParsingProfile } from '../types';
import { generateUUID } from '../utils';
import { SaveIcon, CloseIcon, RobotIcon, SparklesIcon, CheckCircleIcon, WorkflowIcon, DatabaseIcon, TrashIcon, TableIcon, ShieldCheckIcon, EditIcon } from './Icons';
import SearchableSelect from './SearchableSelect';
import { generateAccountRulesFromSample } from '../services/geminiService';

export type EntityType = 'categories' | 'tags' | 'counterparties' | 'locations' | 'users' | 'transactionTypes' | 'accountTypes' | 'accounts';

interface EntityEditorProps {
    type: EntityType;
    initialId?: string | null;
    onSave: (type: EntityType, payload: any) => void;
    onCancel: () => void;
    categories: Category[];
    tags: Tag[];
    counterparties: Counterparty[];
    locations: Location[];
    users: User[];
    transactionTypes: TransactionType[];
    accountTypes: AccountType[];
    accounts: Account[];
    rules?: ReconciliationRule[];
    onSaveRules?: (rules: ReconciliationRule[]) => void;
    onDeleteRule?: (id: string) => void;
}

const EntityEditor: React.FC<EntityEditorProps> = ({ 
    type, initialId, onSave, onCancel,
    categories, tags, counterparties, locations, users, transactionTypes, accountTypes, accounts, rules = [],
    onSaveRules, onDeleteRule
}) => {
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [color, setColor] = useState('bg-slate-100 text-slate-800');
    const [notes, setNotes] = useState('');
    const [userId, setUserId] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('');
    const [balanceEffect, setBalanceEffect] = useState<BalanceEffect>('outgoing');
    const [identifier, setIdentifier] = useState('');
    const [accountTypeId, setAccountTypeId] = useState('');
    const [parsingProfile, setParsingProfile] = useState<ParsingProfile | undefined>(undefined);

    // Account Logic Forge State
    const [csvSample, setCsvSample] = useState('');
    const [isForging, setIsForging] = useState(false);
    const [forgeProgress, setForgeProgress] = useState('');
    const [proposedRules, setProposedRules] = useState<ReconciliationRule[]>([]);
    const [proposedProfile, setProposedProfile] = useState<ParsingProfile | null>(null);

    const accountRules = useMemo(() => {
        if (type !== 'accounts' || !initialId) return [];
        return rules.filter(r => r.conditions.some(c => c.field === 'accountId' && c.value === initialId));
    }, [rules, initialId, type]);

    useEffect(() => {
        let list: any[] = [];
        switch (type) {
            case 'categories': list = categories; break;
            case 'tags': list = tags; break;
            case 'counterparties': list = counterparties; break;
            case 'locations': list = locations; break;
            case 'users': list = users; break;
            case 'transactionTypes': list = transactionTypes; break;
            case 'accountTypes': list = accountTypes; break;
            case 'accounts': list = accounts; break;
        }

        const item = list.find(x => x.id === initialId);
        if (item) {
            setName(item.name || '');
            if (type === 'categories') setParentId(item.parentId || '');
            else if (type === 'tags') setColor(item.color);
            else if (type === 'counterparties') { setParentId(item.parentId || ''); setNotes(item.notes || ''); setUserId(item.userId || ''); }
            else if (type === 'locations') { setCity(item.city || ''); setState(item.state || ''); setCountry(item.country || ''); }
            else if (type === 'transactionTypes') { setBalanceEffect(item.balanceEffect || 'outgoing'); setColor(item.color || 'text-slate-600'); }
            else if (type === 'accounts') { 
                setIdentifier(item.identifier || ''); 
                setAccountTypeId(item.accountTypeId || ''); 
                setParsingProfile(item.parsingProfile);
            }
        } else {
            setName('');
            setParentId('');
            setCity('');
            setState('');
            setCountry('');
            setNotes('');
            setIdentifier('');
            setAccountTypeId(accountTypes[0]?.id || '');
            setUserId(users.find(u => u.isDefault)?.id || users[0]?.id || '');
            setBalanceEffect('outgoing');
            setColor(type === 'transactionTypes' ? 'text-rose-600' : 'bg-slate-50 text-slate-600');
            setParsingProfile(undefined);
        }
        setProposedRules([]);
        setProposedProfile(null);
        setCsvSample('');
    }, [type, initialId, categories, tags, counterparties, locations, users, transactionTypes, accountTypes, accounts]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const id = initialId || generateUUID();
        const payload: any = { id, name: name.trim() };
        switch (type) {
            case 'categories': Object.assign(payload, { parentId: parentId || undefined }); break;
            case 'tags': Object.assign(payload, { color }); break;
            case 'counterparties': Object.assign(payload, { parentId: parentId || undefined, notes: notes || undefined, userId: userId || undefined }); break;
            case 'locations': Object.assign(payload, { city, state, country }); break;
            case 'transactionTypes': Object.assign(payload, { balanceEffect, color }); break;
            case 'accounts': Object.assign(payload, { identifier, accountTypeId, parsingProfile }); break;
        }
        onSave(type, payload);
    };

    const handleForgeLogic = async () => {
        if (!csvSample.trim() || !initialId) return;
        setIsForging(true);
        try {
            const account = accounts.find(a => a.id === initialId)!;
            const { rules, profile } = await generateAccountRulesFromSample(csvSample, account, categories, setForgeProgress);
            setProposedRules(rules);
            setProposedProfile(profile);
        } catch (e: any) {
            alert(e.message || "Forge failed.");
        } finally {
            setIsForging(false);
            setForgeProgress('');
        }
    };

    const handleCommitRules = () => {
        if (proposedRules.length > 0 && onSaveRules) {
            onSaveRules(proposedRules);
        }
        if (proposedProfile) {
            setParsingProfile(proposedProfile);
        }
        setProposedRules([]);
        setProposedProfile(null);
        setCsvSample('');
        alert("Account layout map and merchant rules committed to registry.");
    };

    const parentOptions = useMemo(() => {
        if (type === 'categories') return categories.filter(c => c.id !== initialId);
        if (type === 'counterparties') return counterparties.filter(c => c.id !== initialId);
        return [];
    }, [type, categories, counterparties, initialId]);

    const firstSampleLine = useMemo(() => {
        if (!csvSample) return [];
        return csvSample.split('\n')[0].split(',').map(s => s.trim());
    }, [csvSample]);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full relative">
            <div className="sticky top-0 p-4 border-b bg-white/95 backdrop-blur-sm flex justify-between items-center z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Discard</button>
                </div>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center gap-2">
                    <SaveIcon className="w-4 h-4" /> Save blueprint
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-50/10">
                <div className="space-y-8 max-w-2xl mx-auto pb-12">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 text-lg shadow-sm" placeholder="Display name..." required autoFocus />
                    </div>

                    {type === 'accounts' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unique Identifier</label>
                                    <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold" placeholder="e.g. Last 4 digits" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Category</label>
                                    <select value={accountTypeId} onChange={e => setAccountTypeId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold">
                                        {accountTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {initialId && (
                                <div className="space-y-8">
                                    {/* EXISTING PROFILE DISPLAY */}
                                    {parsingProfile && (
                                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><TableIcon className="w-4 h-4" /> Layout Fingerprint Mapped</h4>
                                                <button type="button" onClick={() => setParsingProfile(undefined)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-600">Clear Map</button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-white p-2.5 rounded-xl border border-indigo-100"><p className="text-[8px] font-black text-slate-400 uppercase">Date</p><p className="text-xs font-bold text-slate-800">{parsingProfile.dateColumn}</p></div>
                                                <div className="bg-white p-2.5 rounded-xl border border-indigo-100"><p className="text-[8px] font-black text-slate-400 uppercase">Description</p><p className="text-xs font-bold text-slate-800">{parsingProfile.descriptionColumn}</p></div>
                                                <div className="bg-white p-2.5 rounded-xl border border-indigo-100"><p className="text-[8px] font-black text-slate-400 uppercase">Amount</p><p className="text-xs font-bold text-slate-800">{parsingProfile.amountColumn}</p></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* NEURAL FORGE */}
                                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden">
                                        <div className="relative z-10 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/20"><RobotIcon className="w-6 h-6" /></div>
                                                <div>
                                                    <h4 className="text-lg font-black tracking-tight">Neural Template Forge</h4>
                                                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Identify bank layout & auto-categorize</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative z-10 space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Paste CSV Sample (Headers + 5 Rows)</label>
                                                <textarea 
                                                    value={csvSample} 
                                                    onChange={e => setCsvSample(e.target.value)}
                                                    className="w-full h-32 bg-black/40 border-white/5 rounded-2xl p-4 font-mono text-[10px] text-indigo-100 placeholder:text-slate-700 resize-none outline-none focus:border-indigo-500 transition-all"
                                                    placeholder="Date, Description, Amount..."
                                                />
                                            </div>
                                            
                                            <button 
                                                type="button"
                                                onClick={handleForgeLogic}
                                                disabled={isForging || !csvSample.trim()}
                                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                                            >
                                                {isForging ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                                                {isForging ? forgeProgress : 'Analyze Layout & Generate Logic'}
                                            </button>

                                            {(proposedRules.length > 0 || proposedProfile) && (
                                                <div className="space-y-6 animate-slide-up pt-4">
                                                    {proposedProfile && (
                                                        <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                                                            <h5 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Proposed Layout Map</h5>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                {['dateColumn', 'descriptionColumn', 'amountColumn', 'delimiter'].map(field => (
                                                                    <div key={field} className="bg-black/30 p-2 rounded-lg border border-white/5">
                                                                        <p className="text-[7px] text-slate-500 uppercase font-black">{field.replace('Column','')}</p>
                                                                        <input 
                                                                            type="text" 
                                                                            value={(proposedProfile as any)[field]} 
                                                                            onChange={e => setProposedProfile({...proposedProfile, [field]: e.target.value})}
                                                                            className="w-full bg-transparent border-none p-0 text-[11px] font-bold text-white focus:ring-0"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center px-1">
                                                            <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><CheckCircleIcon className="w-3 h-3" /> Proposed Merchant Rules ({proposedRules.length})</h5>
                                                            <button type="button" onClick={() => { setProposedRules([]); setProposedProfile(null); }} className="text-[9px] font-black text-slate-500 hover:text-white uppercase">Discard</button>
                                                        </div>
                                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                            {proposedRules.map((r, i) => (
                                                                <div key={i} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center group">
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-slate-200 truncate">{r.name}</p>
                                                                        <p className="text-[9px] text-indigo-400 font-mono mt-0.5 truncate">{r.conditions[0].value}</p>
                                                                    </div>
                                                                    <button type="button" onClick={() => setProposedRules(proposedRules.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><TrashIcon className="w-3.5 h-3.5"/></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <button onClick={handleCommitRules} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"><WorkflowIcon className="w-5 h-5" /> Commit to Rule Engine</button>
                                                </div>
                                            )}
                                        </div>
                                        <SparklesIcon className="absolute -right-16 -top-16 w-64 h-64 opacity-[0.03] text-indigo-400" />
                                    </div>

                                    {/* RULES LISTING */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheckIcon className="w-4 h-4 text-indigo-600" /> Active Account Logic</h4>
                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{accountRules.length}</span>
                                        </div>
                                        {accountRules.length === 0 ? (
                                            <div className="p-8 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200"><p className="text-xs text-slate-400 italic">No account-specific rules configured.</p></div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {accountRules.map(r => (
                                                    <div key={r.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{r.name}</p>
                                                            <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">{r.suggestedCategoryName || 'General'}</p>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => onDeleteRule?.(r.id)} 
                                                            className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {(type === 'categories' || type === 'counterparties') && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Parent Hierarchy</label>
                            <SearchableSelect options={parentOptions} value={parentId} onChange={setParentId} isHierarchical placeholder="-- No Parent (Root) --" />
                        </div>
                    )}

                    {type === 'counterparties' && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Default Ledger Assignment</label>
                            <SearchableSelect options={users} value={userId} onChange={setUserId} placeholder="-- Global System Default --" />
                        </div>
                    )}

                    {type === 'tags' && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Label Hue</label>
                            <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-inner">
                                {['bg-slate-100 text-slate-800', 'bg-red-100 text-red-800', 'bg-orange-100 text-orange-800', 'bg-amber-100 text-amber-800', 'bg-green-100 text-green-800', 'bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800', 'bg-purple-100 text-purple-800'].map(c => (
                                    <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-indigo-600 scale-110 shadow-md' : 'border-slate-100 opacity-60 hover:opacity-100'}`} style={{ backgroundColor: c.split(' ')[0].replace('bg-', '') }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {(type === 'counterparties' || type === 'categories' || type === 'accounts') && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Archival Context & Logic</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-medium min-h-[140px]" placeholder="Record account details, vendor logic, or institutional memory..." />
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
};

export default EntityEditor;
