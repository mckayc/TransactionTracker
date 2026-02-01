
import React, { useState, useEffect, useMemo } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, AccountType, Account, BalanceEffect, Location, ReconciliationRule } from '../types';
import { generateUUID } from '../utils';
import { SaveIcon, CloseIcon, RobotIcon, SparklesIcon, CheckCircleIcon, WorkflowIcon, DatabaseIcon, TrashIcon } from './Icons';
import SearchableSelect from './SearchableSelect';
import { generateAccountRulesFromSample } from '../services/geminiService';

export type EntityType = 'categories' | 'tags' | 'counterparties' | 'locations' | 'users' | 'transactionTypes' | 'accountTypes' | 'accounts';

interface EntityEditorProps {
    type: EntityType;
    initialId?: string | null;
    onSave: (type: EntityType, payload: any) => void;
    onCancel: () => void;
    // Context data for selects
    categories: Category[];
    tags: Tag[];
    counterparties: Counterparty[];
    locations: Location[];
    users: User[];
    transactionTypes: TransactionType[];
    accountTypes: AccountType[];
    accounts: Account[];
    // For account logic forge
    onSaveRules?: (rules: ReconciliationRule[]) => void;
}

const EntityEditor: React.FC<EntityEditorProps> = ({ 
    type, initialId, onSave, onCancel,
    categories, tags, counterparties, locations, users, transactionTypes, accountTypes, accounts,
    onSaveRules
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

    // Account Logic Forge State
    const [csvSample, setCsvSample] = useState('');
    const [isForging, setIsForging] = useState(false);
    const [forgeProgress, setForgeProgress] = useState('');
    const [proposedRules, setProposedRules] = useState<ReconciliationRule[]>([]);

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
            else if (type === 'accounts') { setIdentifier(item.identifier || ''); setAccountTypeId(item.accountTypeId || ''); }
        } else {
            // Reset for new
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
        }
        setProposedRules([]);
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
            case 'accounts': Object.assign(payload, { identifier, accountTypeId }); break;
        }
        onSave(type, payload);
    };

    const handleForgeLogic = async () => {
        if (!csvSample.trim() || !initialId) return;
        setIsForging(true);
        try {
            const account = accounts.find(a => a.id === initialId)!;
            const rules = await generateAccountRulesFromSample(csvSample, account, categories, setForgeProgress);
            setProposedRules(rules);
        } catch (e: any) {
            alert(e.message || "Forge failed.");
        } finally {
            setIsForging(false);
            setForgeProgress('');
        }
    };

    const handleCommitRules = () => {
        if (onSaveRules && proposedRules.length > 0) {
            onSaveRules(proposedRules);
            setProposedRules([]);
            setCsvSample('');
            alert(`${proposedRules.length} account-specific rules added to system logic.`);
        }
    };

    const parentOptions = useMemo(() => {
        if (type === 'categories') return categories.filter(c => c.id !== initialId);
        if (type === 'counterparties') return counterparties.filter(c => c.id !== initialId);
        return [];
    }, [type, categories, counterparties, initialId]);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full relative">
            {/* Top Action Bar */}
            <div className="sticky top-0 p-4 border-b bg-white/95 backdrop-blur-sm flex justify-between items-center z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Discard</button>
                </div>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center gap-2">
                    <SaveIcon className="w-4 h-4" /> Save blueprint
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-50/10">
                <div className="space-y-8 max-w-xl mx-auto pb-12">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 text-lg shadow-sm" placeholder="Display name..." required autoFocus />
                    </div>

                    {type === 'transactionTypes' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Balance Impact Mapping</label>
                                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                                    {(['incoming', 'outgoing', 'neutral'] as const).map(effect => (
                                        <button
                                            key={effect}
                                            type="button"
                                            onClick={() => setBalanceEffect(effect)}
                                            className={`py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${balanceEffect === effect ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                                        >
                                            {effect === 'incoming' ? 'Incoming (+)' : effect === 'outgoing' ? 'Outgoing (-)' : 'Neutral'}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 italic ml-1">Determines how records increment or decrement totals.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol Branding</label>
                                <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-inner">
                                    {[
                                        'text-slate-600', 'text-red-600', 'text-orange-600', 'text-amber-600', 'text-yellow-600',
                                        'text-lime-600', 'text-green-600', 'text-emerald-600', 'text-teal-600', 'text-cyan-600',
                                        'text-sky-600', 'text-blue-600', 'text-indigo-600', 'text-violet-600', 'text-purple-600',
                                        'text-fuchsia-600', 'text-pink-600', 'text-rose-600', 'text-gray-900', 'text-black'
                                    ].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center font-black text-lg ${color === c ? 'border-indigo-600 bg-indigo-50 scale-110 shadow-md' : 'border-transparent bg-slate-50 hover:bg-slate-100 opacity-60 hover:opacity-100'}`}
                                        >
                                            <span className={c}>$</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {type === 'accounts' && (
                        <div className="space-y-8 animate-fade-in">
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
                                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden">
                                    <div className="relative z-10 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/20">
                                                <RobotIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black tracking-tight">Neural Template Forge</h4>
                                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Teach AI your bank's fingerprint</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-10 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Paste CSV Sample (Headers + 5 Rows)</label>
                                            <textarea 
                                                value={csvSample} 
                                                onChange={e => setCsvSample(e.target.value)}
                                                className="w-full h-32 bg-black/40 border-white/5 rounded-2xl p-4 font-mono text-[10px] text-indigo-100 placeholder:text-slate-700 resize-none focus:border-indigo-500 transition-all outline-none"
                                                placeholder="Date, Description, Amount, Category..."
                                            />
                                        </div>
                                        
                                        <button 
                                            type="button"
                                            onClick={handleForgeLogic}
                                            disabled={isForging || !csvSample.trim()}
                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30"
                                        >
                                            {isForging ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                                            {isForging ? forgeProgress : 'Analyze Signature & Generate Rules'}
                                        </button>

                                        {proposedRules.length > 0 && (
                                            <div className="space-y-4 animate-slide-up pt-4">
                                                <div className="flex justify-between items-center">
                                                    <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                                        <CheckCircleIcon className="w-3 h-3" /> Proposed Logic ({proposedRules.length})
                                                    </h5>
                                                    <button type="button" onClick={() => setProposedRules([])} className="text-[9px] font-black text-slate-500 hover:text-white uppercase">Discard</button>
                                                </div>
                                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                    {proposedRules.map((r, i) => (
                                                        <div key={i} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center group">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-bold text-slate-200 truncate">{r.name}</p>
                                                                <p className="text-[9px] text-indigo-400 font-mono mt-0.5 truncate">{r.conditions.map(c => c.value).join(', ')}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase">{r.suggestedCategoryName || 'Categorized'}</span>
                                                                <button type="button" onClick={() => setProposedRules(proposedRules.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><TrashIcon className="w-3.5 h-3.5"/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={handleCommitRules}
                                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    <WorkflowIcon className="w-5 h-5" /> Commit to Rule Engine
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <SparklesIcon className="absolute -right-16 -top-16 w-64 h-64 opacity-[0.03] text-indigo-400" />
                                </div>
                            )}
                        </div>
                    )}

                    {(type === 'categories' || type === 'counterparties') && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Parent Hierarchy</label>
                            <SearchableSelect 
                                options={parentOptions} 
                                value={parentId} 
                                onChange={setParentId} 
                                isHierarchical 
                                placeholder="-- No Parent (Root) --"
                            />
                        </div>
                    )}

                    {type === 'counterparties' && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Default Ledger Assignment</label>
                            <SearchableSelect 
                                options={users} 
                                value={userId} 
                                onChange={setUserId} 
                                placeholder="-- Global System Default --"
                            />
                        </div>
                    )}

                    {type === 'tags' && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Label Hue</label>
                            <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-inner">
                                {[
                                    'bg-slate-100 text-slate-800', 'bg-red-100 text-red-800', 'bg-orange-100 text-orange-800',
                                    'bg-amber-100 text-amber-800', 'bg-green-100 text-green-800', 'bg-emerald-100 text-emerald-800',
                                    'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800', 'bg-purple-100 text-purple-800'
                                ].map(c => (
                                    <button 
                                        key={c} type="button" onClick={() => setColor(c)}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-indigo-600 scale-110 shadow-md' : 'border-slate-100 opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: c.split(' ')[0].replace('bg-', '') }} 
                                    />
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
