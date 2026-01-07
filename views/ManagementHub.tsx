import React, { useState, useMemo, useEffect } from 'react';
import type { Category, Tag, Payee, User, TransactionType, Transaction, AccountType, Account, BalanceEffect, Merchant, Location } from '../types';
import { TagIcon, UsersIcon, UserGroupIcon, ChecklistIcon, ShieldCheckIcon, AddIcon, DeleteIcon, EditIcon, ChevronRightIcon, ChevronDownIcon, NotesIcon, CloseIcon, SparklesIcon, TableIcon, LightBulbIcon, BoxIcon, MapPinIcon, ExclamationTriangleIcon, TrashIcon } from '../components/Icons';
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
    
    // Bulk Selection State
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

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
    /* Renamed flowImpact state to balanceEffect for consistency */
    const [balanceEffect, setBalanceEffect] = useState<BalanceEffect>('expense');

    // Reset selection when tab changes
    useEffect(() => {
        setBulkSelectedIds(new Set());
    }, [activeTab]);

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

    const currentList = useMemo(() => {
        let list: any[] = [];
        switch (activeTab) {
            case 'categories': list = [...categories]; break;
            case 'tags': list = [...tags]; break;
            case 'payees': list = [...payees]; break;
            case 'merchants': list = [...merchants]; break;
            case 'locations': list = [...locations]; break;
            case 'users': list = [...users]; break;
            case 'transactionTypes': list = [...transactionTypes]; break;
            case 'accountTypes': list = [...accountTypes]; break;
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTab, categories, tags, payees, merchants, locations, users, transactionTypes, accountTypes]);

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
            /* Updated to use balanceEffect property name */
            if (t) { setName(t.name); setBalanceEffect(t.balanceEffect); setColor(t.color || 'text-slate-600'); }
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
        setColor(activeTab === 'transactionTypes' ? 'text-rose-600' : 'bg-slate-100 text-slate-800');
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const id = selectedId || generateUUID();
        const payload: any = { id, name: name.trim() };

        switch (activeTab) {
            case 'categories': onSaveCategory({ ...payload, parentId: parentId || undefined }); break;
            case 'tags': onSaveTag({ ...payload, color }); break;
            case 'payees': onSavePayee({ ...payload, parentId: parentId || undefined, notes: notes || undefined, userId: userId || undefined }); break;
            case 'merchants': onSaveMerchant({ ...payload, payeeId: payeeId || undefined, notes: notes || undefined }); break;
            case 'locations': onSaveLocation({ ...payload, city, state, country }); break;
            case 'users': onSaveUser(payload); break;
            /* Updated to use balanceEffect property name */
            case 'transactionTypes': onSaveTransactionType({ ...payload, balanceEffect, color }); break;
            case 'accountTypes': onSaveAccountType(payload); break;
        }
        setIsCreating(false);
        setSelectedId(id);
    };

    const handleIndividualDelete = (id: string) => {
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

        executeDeletion(id);
        if (selectedId === id) setSelectedId(null);
    };

    const toggleBulkSelection = (id: string) => {
        const next = new Set(bulkSelectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setBulkSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (bulkSelectedIds.size === currentList.length) {
            setBulkSelectedIds(new Set());
        } else {
            setBulkSelectedIds(new Set(currentList.map(item => item.id)));
        }
    };

    const executeDeletion = (id: string) => {
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
    };

    const handleConfirmBulkDelete = () => {
        const selected = Array.from(bulkSelectedIds);
        const validToDelete: string[] = [];
        const inUse: string[] = [];

        selected.forEach(id => {
            const item = currentList.find(x => x.id === id);
            const count = (usageCounts as any)[activeTab].get(id) || 0;
            const isDefaultUser = activeTab === 'users' && item?.isDefault;

            if (count > 0 || isDefaultUser) {
                inUse.push(item?.name || id);
            } else {
                validToDelete.push(id);
            }
        });

        if (inUse.length > 0) {
            alert(`Skipping ${inUse.length} items that are either in use or system defaults: ${inUse.join(', ')}`);
        }

        validToDelete.forEach(executeDeletion);
        setBulkSelectedIds(new Set());
        setIsBulkDeleteModalOpen(false);
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

    return (
        <div className="h-full flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Organization Hub</h1>
                <p className="text-slate-500 mt-1">Refine the logical blueprints of your financial ledger.</p>
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
                <div className="w-1/3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={bulkSelectedIds.size === currentList.length && currentList.length > 0}
                                onChange={toggleSelectAll}
                            />
                            <h3 className="font-bold text-slate-700 capitalize">{activeTab}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {bulkSelectedIds.size > 0 && (
                                <button 
                                    onClick={() => setIsBulkDeleteModalOpen(true)}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all border border-red-200 flex items-center gap-1.5"
                                    title="Bulk Delete"
                                >
                                    <DeleteIcon className="w-4 h-4" />
                                    <span className="text-[10px] font-black">{bulkSelectedIds.size}</span>
                                </button>
                            )}
                            <button onClick={handleNew} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-transform active:scale-95 shadow-md">
                                <AddIcon className="w-4 h-4" />
                            </button>
                        </div>
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
                                    const isItemBulkSelected = bulkSelectedIds.has(item.id);

                                    return (
                                        <div 
                                            key={item.id}
                                            onClick={() => handleSelect(item.id)}
                                            className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all border-2 ${selectedId === item.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'} ${isItemBulkSelected ? 'ring-1 ring-indigo-200' : ''}`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                                                    checked={isItemBulkSelected}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={() => toggleBulkSelection(item.id)}
                                                />
                                                {activeTab === 'tags' && <div className={`w-3 h-3 rounded-full flex-shrink-0 ${(item as Tag).color}`} />}
                                                <span className={`text-sm font-bold truncate ${selectedId === item.id ? 'text-indigo-900' : 'text-slate-700'}`}>{item.name}</span>
                                                {isDefaultUser && <span className="text-[8px] bg-indigo-600 text-white px-1 rounded uppercase font-black">System</span>}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full" title="Usage count">
                                                    {count}
                                                </span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleIndividualDelete(item.id); }}
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

                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                    {(selectedId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">{isCreating ? 'Architect New Entry' : 'Edit Entry Properties'}</h3>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-0.5">Entity Controller v1.1</p>
                                </div>
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="p-2 rounded-full hover:bg-slate-200"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title / Identification Label</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 text-lg" 
                                            placeholder="Enter a descriptive name..."
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
                                                <option value="">-- Top Level Category --</option>
                                                {categories.filter(c => !c.parentId && c.id !== selectedId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {activeTab === 'tags' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Visual Marker Color</label>
                                            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
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

                                    {activeTab === 'transactionTypes' && (
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Impact Flow</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {(['income', 'expense', 'neutral'] as const).map(impact => (
                                                        <button 
                                                            key={impact} 
                                                            type="button"
                                                            onClick={() => setBalanceEffect(impact)}
                                                            className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${balanceEffect === impact ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'}`}
                                                        >
                                                            {impact}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Label Color</label>
                                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    {[
                                                        'text-emerald-600', 'text-rose-600', 'text-slate-600', 'text-orange-600', 'text-sky-600', 'text-indigo-600', 'text-purple-600'
                                                    ].map(c => (
                                                        <button 
                                                            key={c} 
                                                            type="button" 
                                                            onClick={() => setColor(c)}
                                                            className={`w-10 h-10 rounded-xl border-2 transition-all bg-white font-bold flex items-center justify-center ${color === c ? 'border-indigo-600 scale-110 shadow-lg' : 'border-slate-100'} ${c}`}
                                                        >
                                                            $
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'payees' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Parent Entity</label>
                                                <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white">
                                                    <option value="">-- No Parent (Root) --</option>
                                                    {payees.filter(p => !p.parentId && p.id !== selectedId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Assigned Account User</label>
                                                <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white">
                                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Internal Reference Notes</label>
                                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-medium min-h-[120px]" placeholder="Add context, branch details, or relationship history..." />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'merchants' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Associated Payee</label>
                                                <select value={payeeId} onChange={e => setPayeeId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white">
                                                    <option value="">-- Direct Parent --</option>
                                                    {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Merchant Details</label>
                                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-medium min-h-[120px]" placeholder="Store number, specialized branch info..." />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'locations' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Municipality / City</label>
                                                <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white" placeholder="e.g. Salt Lake City" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Region / State</label>
                                                <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white" placeholder="e.g. Utah" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nation / Country</label>
                                                <input type="text" value={country} onChange={e => setCountry(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white" placeholder="e.g. USA" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {!isCreating && selectedId && (
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between shadow-inner">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-indigo-500">
                                                <TableIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Database References</p>
                                                <p className="text-xl font-black text-slate-800">Linked to {(usageCounts as any)[activeTab].get(selectedId) || 0} total records</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Discard</button>
                                <button type="submit" className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                                    {isCreating ? 'Confirm & Create' : 'Update Entry'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="p-8 bg-white rounded-full shadow-2xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <LightBulbIcon className="w-16 h-16 text-indigo-300" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Resource Architect</h3>
                            <p className="text-slate-500 max-w-sm mt-3 font-medium">Select an item from the list to refine its properties or manage its hierarchy. Use bulk selection for mass cleanup.</p>
                            <button onClick={handleNew} className="mt-8 px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl transition-transform hover:-translate-y-1">Create New Item</button>
                        </div>
                    )}
                </div>
            </div>

            {isBulkDeleteModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 pb-4 text-center">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-red-100">
                                <ExclamationTriangleIcon className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Massive Deletion Alert</h2>
                            <p className="text-slate-500 font-medium">You are about to purge <span className="text-red-600 font-black">{bulkSelectedIds.size}</span> item(s) from the <span className="capitalize font-bold">{activeTab}</span> dataset.</p>
                        </div>

                        <div className="p-8 py-4">
                            <div className="bg-slate-50 rounded-2xl border-2 border-slate-100 p-4 max-h-48 overflow-y-auto custom-scrollbar">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">Targeted List</p>
                                <div className="space-y-2">
                                    {Array.from(bulkSelectedIds).map(id => {
                                        const item = currentList.find(x => x.id === id);
                                        const count = (usageCounts as any)[activeTab].get(id) || 0;
                                        return (
                                            <div key={id} className="flex justify-between items-center text-sm font-bold text-slate-700">
                                                <span className="truncate">{item?.name || id}</span>
                                                {count > 0 && <span className="text-[10px] text-red-500 uppercase font-black tracking-tighter">In Use!</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 flex flex-col gap-3">
                            <button 
                                onClick={handleConfirmBulkDelete}
                                className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 shadow-xl shadow-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Execute Deletion
                            </button>
                            <button 
                                onClick={() => setIsBulkDeleteModalOpen(false)}
                                className="w-full py-3 bg-white border-2 border-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-colors"
                            >
                                Nevermind, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementHub;