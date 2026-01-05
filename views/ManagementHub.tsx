
import React, { useState, useMemo } from 'react';
import type { Category, Tag, Payee, User, TransactionType, Transaction, AccountType, Account, BalanceEffect, Merchant, Location } from '../types';
import { TagIcon, UsersIcon, UserGroupIcon, ChecklistIcon, ShieldCheckIcon, AddIcon, DeleteIcon, EditIcon, ChevronRightIcon, ChevronDownIcon, NotesIcon, CloseIcon, SparklesIcon, TableIcon, LightBulbIcon, BoxIcon, MapPinIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface ManagementHubProps {
    transactions: Transaction[];
    categories: Category[];
    onSaveCategory: (c: Category) => void;
    onDeleteCategory: (id: string) => void;
    tags: Tag[];
    onSaveTag: (t: Tag) => void;
    onDeleteTag: (id: string) => void;
    payees: Payee[];
    onSavePayee: (p: Payee) => void;
    onDeletePayee: (id: string) => void;
    merchants: Merchant[];
    onSaveMerchant: (m: Merchant) => void;
    onDeleteMerchant: (id: string) => void;
    locations: Location[];
    onSaveLocation: (l: Location) => void;
    onDeleteLocation: (id: string) => void;
    users: User[];
    onSaveUser: (u: User) => void;
    onDeleteUser: (id: string) => void;
    transactionTypes: TransactionType[];
    onSaveTransactionType: (t: TransactionType) => void;
    onDeleteTransactionType: (id: string) => void;
    accountTypes: AccountType[];
    onSaveAccountType: (t: AccountType) => void;
    onDeleteAccountType: (id: string) => void;
    accounts: Account[];
}

type Tab = 'categories' | 'tags' | 'payees' | 'merchants' | 'locations' | 'users' | 'transactionTypes' | 'accountTypes';

const ManagementHub: React.FC<ManagementHubProps> = ({ 
    transactions, categories, onSaveCategory, onDeleteCategory, tags, onSaveTag, onDeleteTag,
    payees, onSavePayee, onDeletePayee, merchants, onSaveMerchant, onDeleteMerchant,
    locations, onSaveLocation, onDeleteLocation, users, onSaveUser, onDeleteUser,
    transactionTypes, onSaveTransactionType, onDeleteTransactionType,
    accountTypes, onSaveAccountType, onDeleteAccountType, accounts
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('categories');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [color, setColor] = useState('bg-slate-100 text-slate-800');
    const [notes, setNotes] = useState('');
    const [userId, setUserId] = useState('');
    const [payeeId, setPayeeId] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('');
    const [balanceEffect, setBalanceEffect] = useState<BalanceEffect>('expense');

    // Usage analysis
    const usageCounts = useMemo(() => {
        const counts = {
            categories: new Map<string, number>(),
            tags: new Map<string, number>(),
            payees: new Map<string, number>(),
            merchants: new Map<string, number>(),
            locations: new Map<string, number>(),
            users: new Map<string, number>(),
            transactionTypes: new Map<string, number>(),
            accountTypes: new Map<string, number>()
        };

        transactions.forEach(tx => {
            counts.categories.set(tx.categoryId, (counts.categories.get(tx.categoryId) || 0) + 1);
            tx.tagIds?.forEach(tid => counts.tags.set(tid, (counts.tags.get(tid) || 0) + 1));
            if (tx.payeeId) counts.payees.set(tx.payeeId, (counts.payees.get(tx.payeeId) || 0) + 1);
            if (tx.merchantId) counts.merchants.set(tx.merchantId, (counts.merchants.get(tx.merchantId) || 0) + 1);
            if (tx.locationId) counts.locations.set(tx.locationId, (counts.locations.get(tx.locationId) || 0) + 1);
            if (tx.userId) counts.users.set(tx.userId, (counts.users.get(tx.userId) || 0) + 1);
            counts.transactionTypes.set(tx.typeId, (counts.transactionTypes.get(tx.typeId) || 0) + 1);
        });

        accounts.forEach(acc => {
            counts.accountTypes.set(acc.accountTypeId, (counts.accountTypes.get(acc.accountTypeId) || 0) + 1);
        });

        return counts;
    }, [transactions, accounts]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setIsCreating(false);
        // Hydrate form based on tab
        if (activeTab === 'categories') {
            const c = categories.find(x => x.id === id);
            if (c) { setName(c.name); setParentId(c.parentId || ''); }
        } else if (activeTab === 'tags') {
            const t = tags.find(x => x.id === id);
            if (t) { setName(t.name); setColor(t.color); }
        } else if (activeTab === 'payees') {
            const p = payees.find(x => x.id === id);
            if (p) { setName(p.name); setParentId(p.parentId || ''); setNotes(p.notes || ''); setUserId(p.userId || ''); }
        } else if (activeTab === 'merchants') {
            const m = merchants.find(x => x.id === id);
            if (m) { setName(m.name); setPayeeId(m.payeeId || ''); setNotes(m.notes || ''); }
        } else if (activeTab === 'locations') {
            const l = locations.find(x => x.id === id);
            if (l) { setName(l.name); setCity(l.city || ''); setState(l.state || ''); setCountry(l.country || ''); }
        } else if (activeTab === 'users') {
            const u = users.find(x => x.id === id);
            if (u) { setName(u.name); }
        } else if (activeTab === 'transactionTypes') {
            const t = transactionTypes.find(x => x.id === id);
            if (t) { setName(t.name); setBalanceEffect(t.balanceEffect); }
        } else if (activeTab === 'accountTypes') {
            const t = accountTypes.find(x => x.id === id);
            if (t) { setName(t.name); }
        }
    };

    const handleNew = () => {
        setSelectedId(null);
        setIsCreating(true);
        setName('');
        setParentId('');
        setPayeeId('');
        setCity('');
        setState('');
        setCountry('');
        setNotes('');
        setUserId(users.find(u => u.isDefault)?.id || users[0]?.id || '');
        setBalanceEffect('expense');
        setColor('bg-slate-100 text-slate-800');
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const id = selectedId || generateUUID();
        const payload: any = { id, name: name.trim() };

        switch (activeTab) {
            case 'categories':
                onSaveCategory({ ...payload, parentId: parentId || undefined });
                break;
            case 'tags':
                onSaveTag({ ...payload, color });
                break;
            case 'payees':
                onSavePayee({ ...payload, parentId: parentId || undefined, notes: notes || undefined, userId: userId || undefined });
                break;
            case 'merchants':
                onSaveMerchant({ ...payload, payeeId: payeeId || undefined, notes: notes || undefined });
                break;
            case 'locations':
                onSaveLocation({ ...payload, city, state, country });
                break;
            case 'users':
                onSaveUser(payload);
                break;
            case 'transactionTypes':
                onSaveTransactionType({ ...payload, balanceEffect });
                break;
            case 'accountTypes':
                onSaveAccountType(payload);
                break;
        }
        setIsCreating(false);
        setSelectedId(id);
    };

    const handleDelete = (id: string) => {
        if (activeTab === 'users') {
            const user = users.find(u => u.id === id);
            if (user?.isDefault) {
                alert("The primary system user cannot be deleted.");
                return;
            }
        }
        const count = (usageCounts as any)[activeTab].get(id) || 0;
        if (count > 0) {
            alert(`Cannot delete this ${activeTab.slice(0, -1)}. It is currently being used by ${count} records.`);
            return;
        }
        if (!confirm("Permanently delete this item?")) return;

        switch (activeTab) {
            case 'categories': onDeleteCategory(id); break;
            case 'tags': onDeleteTag(id); break;
            case 'payees': onDeletePayee(id); break;
            case 'merchants': onDeleteMerchant(id); break;
            case 'locations': onDeleteLocation(id); break;
            case 'users': onDeleteUser(id); break;
            case 'transactionTypes': onDeleteTransactionType(id); break;
            case 'accountTypes': onDeleteAccountType(id); break;
        }
        setSelectedId(null);
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'categories', label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
        { id: 'tags', label: 'Tags', icon: <TagIcon className="w-4 h-4" /> },
        { id: 'payees', label: 'Payees', icon: <UsersIcon className="w-4 h-4" /> },
        { id: 'merchants', label: 'Merchants', icon: <BoxIcon className="w-4 h-4" /> },
        { id: 'locations', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
        { id: 'users', label: 'Users', icon: <UserGroupIcon className="w-4 h-4" /> },
        { id: 'transactionTypes', label: 'Tx Types', icon: <ChecklistIcon className="w-4 h-4" /> },
        { id: 'accountTypes', label: 'Acct Types', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    ];

    const currentList = useMemo(() => {
        switch (activeTab) {
            case 'categories': return categories.sort((a,b) => a.name.localeCompare(b.name));
            case 'tags': return tags.sort((a,b) => a.name.localeCompare(b.name));
            case 'payees': return payees.sort((a,b) => a.name.localeCompare(b.name));
            case 'merchants': return merchants.sort((a,b) => a.name.localeCompare(b.name));
            case 'locations': return locations.sort((a,b) => a.name.localeCompare(b.name));
            case 'users': return users.sort((a,b) => a.name.localeCompare(b.name));
            case 'transactionTypes': return transactionTypes.sort((a,b) => a.name.localeCompare(b.name));
            case 'accountTypes': return accountTypes.sort((a,b) => a.name.localeCompare(b.name));
            default: return [];
        }
    }, [activeTab, categories, tags, payees, merchants, locations, users, transactionTypes, accountTypes]);

    return (
        <div className="h-full flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Organization Hub</h1>
                <p className="text-slate-500 mt-1">Manage the taxonomies and logical structures that power your accounting.</p>
            </div>

            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSelectedId(null); setIsCreating(false); }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LIST PANEL */}
                <div className="w-1/3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                        <h3 className="font-bold text-slate-700 capitalize">{activeTab}</h3>
                        <button onClick={handleNew} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-transform active:scale-95 shadow-md">
                            <AddIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {currentList.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">
                                <SparklesIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Empty list.</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {currentList.map(item => {
                                    const count = (usageCounts as any)[activeTab].get(item.id) || 0;
                                    const isDefaultUser = activeTab === 'users' && (item as User).isDefault;
                                    return (
                                        <div 
                                            key={item.id}
                                            onClick={() => handleSelect(item.id)}
                                            className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all border-2 ${selectedId === item.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                {activeTab === 'tags' && <div className={`w-3 h-3 rounded-full ${(item as Tag).color}`} />}
                                                <span className={`text-sm font-bold truncate ${selectedId === item.id ? 'text-indigo-900' : 'text-slate-700'}`}>{item.name}</span>
                                                {isDefaultUser && <span className="text-[8px] bg-indigo-600 text-white px-1 rounded uppercase font-black">System</span>}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full" title="Usage count">
                                                    {count}
                                                </span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                    disabled={isDefaultUser}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-10"
                                                >
                                                    <DeleteIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* EDITOR PANEL */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                    {(selectedId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">{isCreating ? 'Create New Entry' : 'Edit Entry'}</h3>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-0.5">Management Cockpit</p>
                                </div>
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="p-2 rounded-full hover:bg-slate-200"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title / Label</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800" 
                                            placeholder="e.g. My Custom Category"
                                            required 
                                        />
                                    </div>

                                    {activeTab === 'categories' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Parent Hierarchy</label>
                                            <select 
                                                value={parentId} 
                                                onChange={e => setParentId(e.target.value)} 
                                                className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white"
                                            >
                                                <option value="">-- Top Level (No Parent) --</option>
                                                {categories.filter(c => !c.parentId && c.id !== selectedId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {activeTab === 'tags' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Visual Color Marker</label>
                                            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                {[
                                                    'bg-slate-100 text-slate-800', 'bg-red-100 text-red-800', 'bg-orange-100 text-orange-800',
                                                    'bg-amber-100 text-amber-800', 'bg-green-100 text-green-800', 'bg-emerald-100 text-emerald-800',
                                                    'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800', 'bg-purple-100 text-purple-800',
                                                    'bg-pink-100 text-pink-800'
                                                ].map(c => (
                                                    <button 
                                                        key={c} 
                                                        type="button" 
                                                        onClick={() => setColor(c)}
                                                        className={`w-10 h-10 rounded-xl border-2 transition-all ${color === c ? 'border-indigo-600 scale-110 shadow-lg ring-4 ring-indigo-50' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                        style={{ backgroundColor: c.split(' ')[0].replace('bg-', '') }} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'payees' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Parent Hierarchy</label>
                                                <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white">
                                                    <option value="">-- No Parent --</option>
                                                    {payees.filter(p => !p.parentId && p.id !== selectedId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Assigned User</label>
                                                <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white">
                                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Internal Reference / Notes</label>
                                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-medium min-h-[100px]" placeholder="Add account details, URLs, or pattern info..." />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'merchants' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Parent Payee</label>
                                                <select value={payeeId} onChange={e => setPayeeId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white">
                                                    <option value="">-- No Payee --</option>
                                                    {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Merchant Notes</label>
                                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-medium min-h-[100px]" placeholder="Specific branch info, etc..." />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'locations' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">City</label>
                                                <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">State</label>
                                                <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Country</label>
                                                <input type="text" value={country} onChange={e => setCountry(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white" />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'transactionTypes' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Net Worth / Balance Effect</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {(['income', 'expense', 'transfer', 'investment', 'donation', 'tax', 'savings', 'debt'] as const).map(effect => (
                                                    <button 
                                                        key={effect} 
                                                        type="button"
                                                        onClick={() => setBalanceEffect(effect)}
                                                        className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${balanceEffect === effect ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'}`}
                                                    >
                                                        {effect}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium mt-3 italic">
                                                This determines how the AI calculates your profit/loss summaries. Use 'Transfer' for internal account moves.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                {!isCreating && selectedId && (
                                    <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                                                <TableIcon className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase">Usage Statistics</p>
                                                <p className="text-xl font-black text-slate-800">Linked to {(usageCounts as any)[activeTab].get(selectedId) || 0} records</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Discard</button>
                                <button type="submit" className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                                    {isCreating ? 'Create Entry' : 'Update Item'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="p-6 bg-slate-50 rounded-full border border-slate-200 mb-6">
                                <LightBulbIcon className="w-16 h-16 text-indigo-300" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Master Data Editor</h3>
                            <p className="text-slate-500 max-w-sm mt-2">Select an item from the left to refine its properties, or create a new taxonomy label to start organizing your ledger.</p>
                            <button onClick={handleNew} className="mt-8 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg transition-transform hover:-translate-y-1">Add First Item</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagementHub;
