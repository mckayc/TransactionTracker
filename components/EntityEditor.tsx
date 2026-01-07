import React, { useState, useEffect } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, AccountType, Account, BalanceEffect, Location } from '../types';
import { generateUUID } from '../utils';

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
}

const EntityEditor: React.FC<EntityEditorProps> = ({ 
    type, initialId, onSave, onCancel,
    categories, tags, counterparties, locations, users, transactionTypes, accountTypes, accounts 
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
            setColor(type === 'transactionTypes' ? 'text-rose-600' : 'bg-slate-100 text-slate-800');
        }
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

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
                <div className="space-y-6 max-w-2xl mx-auto pb-6">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 text-lg shadow-sm" placeholder="Display name..." required autoFocus />
                    </div>

                    {type === 'transactionTypes' && (
                        <div className="space-y-6 animate-fade-in">
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
                                <p className="text-[10px] text-slate-400 italic ml-1">Determines whether transactions of this type increment or decrement your account totals.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visual Branding (Text Color)</label>
                                <div className="grid grid-cols-5 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
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
                                            className={`py-3 rounded-xl border-2 transition-all flex items-center justify-center font-black text-xs ${color === c ? 'border-indigo-600 bg-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                        >
                                            <span className={c}>$</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {type === 'accounts' && (
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
                    )}

                    {(type === 'categories' || type === 'counterparties') && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parent Hierarchy</label>
                            <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white">
                                <option value="">-- No Parent (Root) --</option>
                                {(type === 'categories' ? categories : counterparties)
                                    .filter(x => x.id !== initialId)
                                    .sort((a,b) => a.name.localeCompare(b.name))
                                    .map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                        </div>
                    )}

                    {type === 'counterparties' && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Ledger Assignment</label>
                            <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white">
                                <option value="">-- Global System Default --</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    )}

                    {type === 'tags' && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Label Hue</label>
                            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                {[
                                    'bg-slate-100 text-slate-800', 'bg-red-100 text-red-800', 'bg-orange-100 text-orange-800',
                                    'bg-amber-100 text-amber-800', 'bg-green-100 text-green-800', 'bg-emerald-100 text-emerald-800',
                                    'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800', 'bg-purple-100 text-purple-800'
                                ].map(c => (
                                    <button 
                                        key={c} type="button" onClick={() => setColor(c)}
                                        className={`w-10 h-10 rounded-xl border-2 transition-all ${color === c ? 'border-indigo-600 scale-110 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'}`}
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

            <div className="sticky bottom-0 p-4 border-t bg-slate-50/90 backdrop-blur-sm flex justify-end gap-3 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all">Discard</button>
                <button type="submit" className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl active:scale-95 transition-all">
                    Commit Updates
                </button>
            </div>
        </form>
    );
};

export default EntityEditor;