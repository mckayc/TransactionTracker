
import React, { useState, useMemo, useEffect } from 'react';
import type { Category, Tag, Payee, User, TransactionType, Transaction, AccountType, Account, BalanceEffect, Merchant, Location, FlowDesignation, EconomicImpact } from '../types';
import { TagIcon, UsersIcon, UserGroupIcon, ChecklistIcon, ShieldCheckIcon, AddIcon, DeleteIcon, EditIcon, ChevronRightIcon, ChevronDownIcon, NotesIcon, CloseIcon, SparklesIcon, TableIcon, LightBulbIcon, BoxIcon, MapPinIcon, ExclamationTriangleIcon, TrashIcon, TrendingUpIcon, RepeatIcon } from '../components/Icons';
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
    flowDesignations: FlowDesignation[];
    onSaveFlowDesignation: (fd: FlowDesignation) => void;
    onDeleteFlowDesignation: (id: string) => void;
    accounts: Account[];
}

type Tab = 'categories' | 'tags' | 'payees' | 'flowDesignations' | 'merchants' | 'locations' | 'users' | 'transactionTypes' | 'accountTypes';

const ManagementHub: React.FC<ManagementHubProps> = ({ 
    transactions, categories, onSaveCategory, onDeleteCategory, tags, onSaveTag, onDeleteTag,
    payees, onSavePayee, onDeletePayee, merchants, onSaveMerchant, onDeleteMerchant,
    locations, onSaveLocation, onDeleteLocation, users, onSaveUser, onDeleteUser,
    transactionTypes, onSaveTransactionType, onDeleteTransactionType,
    accountTypes, onSaveAccountType, onDeleteAccountType, 
    flowDesignations, onSaveFlowDesignation, onDeleteFlowDesignation,
    accounts
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('categories');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

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
    const [economicImpact, setEconomicImpact] = useState<EconomicImpact>('outflow');

    useEffect(() => {
        setBulkSelectedIds(new Set());
    }, [activeTab]);

    const usageCounts = useMemo(() => {
        const counts = {
            categories: new Map<string, number>(),
            tags: new Map<string, number>(),
            payees: new Map<string, number>(),
            merchants: new Map<string, number>(),
            locations: new Map<string, number>(),
            users: new Map<string, number>(),
            transactionTypes: new Map<string, number>(),
            accountTypes: new Map<string, number>(),
            flowDesignations: new Map<string, number>()
        };

        transactions.forEach(tx => {
            counts.categories.set(tx.categoryId, (counts.categories.get(tx.categoryId) || 0) + 1);
            tx.tagIds?.forEach(tid => counts.tags.set(tid, (counts.tags.get(tid) || 0) + 1));
            if (tx.payeeId) counts.payees.set(tx.payeeId, (counts.payees.get(tx.payeeId) || 0) + 1);
            if (tx.merchantId) counts.merchants.set(tx.merchantId, (counts.merchants.get(tx.merchantId) || 0) + 1);
            if (tx.locationId) counts.locations.set(tx.locationId, (counts.locations.get(tx.locationId) || 0) + 1);
            if (tx.userId) counts.users.set(tx.userId, (counts.users.get(tx.userId) || 0) + 1);
            if (tx.flowDesignationId) counts.flowDesignations.set(tx.flowDesignationId, (counts.flowDesignations.get(tx.flowDesignationId) || 0) + 1);
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
            case 'flowDesignations': list = [...flowDesignations]; break;
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTab, categories, tags, payees, merchants, locations, users, transactionTypes, accountTypes, flowDesignations]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setIsCreating(false);
        if (activeTab === 'categories') {
            const c = categories.find(x => x.id === id);
            if (c) { setName(c.name); setParentId(c.parentId || ''); }
        } else if (activeTab === 'tags') {
            const t = tags.find(x => x.id === id);
            if (t) { setName(t.name); setColor(t.color); }
        } else if (activeTab === 'flowDesignations') {
            const fd = flowDesignations.find(x => x.id === id);
            if (fd) { setName(fd.name); setEconomicImpact(fd.impact); }
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
        setEconomicImpact('outflow');
        setColor('bg-slate-100 text-slate-800');
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
            case 'transactionTypes': onSaveTransactionType({ ...payload, balanceEffect }); break;
            case 'accountTypes': onSaveAccountType(payload); break;
            case 'flowDesignations': onSaveFlowDesignation({ ...payload, impact: economicImpact }); break;
        }
        setIsCreating(false);
        setSelectedId(id);
    };

    const handleIndividualDelete = (id: string) => {
        const count = (usageCounts as any)[activeTab].get(id) || 0;
        if (count > 0) {
            alert(`Cannot delete. Currently linked to ${count} records.`);
            return;
        }
        executeDeletion(id);
        if (selectedId === id) setSelectedId(null);
    };

    const toggleBulkSelection = (id: string) => {
        const next = new Set(bulkSelectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setBulkSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (bulkSelectedIds.size === currentList.length) setBulkSelectedIds(new Set());
        else setBulkSelectedIds(new Set(currentList.map(item => item.id)));
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
            case 'flowDesignations': onDeleteFlowDesignation(id); break;
        }
    };

    const handleConfirmBulkDelete = () => {
        Array.from(bulkSelectedIds).forEach(handleIndividualDelete);
        setBulkSelectedIds(new Set());
        setIsBulkDeleteModalOpen(false);
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'categories', label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
        { id: 'tags', label: 'Tags', icon: <TagIcon className="w-4 h-4" /> },
        { id: 'flowDesignations', label: 'Flow Designations', icon: <RepeatIcon className="w-4 h-4" /> },
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
                <p className="text-slate-500 mt-1">Refine the architectural blueprints of your financial ledger.</p>
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
                            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer" checked={bulkSelectedIds.size === currentList.length && currentList.length > 0} onChange={toggleSelectAll} />
                            <h3 className="font-bold text-slate-700 capitalize">{activeTab.replace(/([A-Z])/g, ' $1')}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {bulkSelectedIds.size > 0 && <button onClick={() => setIsBulkDeleteModalOpen(true)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all border border-red-200 flex items-center gap-1.5"><DeleteIcon className="w-4 h-4" /><span className="text-[10px] font-black">{bulkSelectedIds.size}</span></button>}
                            <button onClick={handleNew} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-md"><AddIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {currentList.map(item => (
                            <div key={item.id} onClick={() => handleSelect(item.id)} className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all border-2 ${selectedId === item.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'} ${bulkSelectedIds.has(item.id) ? 'ring-1 ring-indigo-200' : ''}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer flex-shrink-0" checked={bulkSelectedIds.has(item.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleBulkSelection(item.id)} />
                                    {activeTab === 'tags' && <div className={`w-3 h-3 rounded-full flex-shrink-0 ${(item as Tag).color}`} />}
                                    <span className={`text-sm font-bold truncate ${selectedId === item.id ? 'text-indigo-900' : 'text-slate-700'}`}>{item.name}</span>
                                    {activeTab === 'flowDesignations' && <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${(item as FlowDesignation).impact === 'inflow' ? 'bg-green-100 text-green-700' : (item as FlowDesignation).impact === 'outflow' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{(item as FlowDesignation).impact}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-1.5 rounded-full">{(usageCounts as any)[activeTab].get(item.id) || 0}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleIndividualDelete(item.id); }} className="p-1.5 text-slate-300 hover:text-red-500"><DeleteIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    {(selectedId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div><h3 className="text-xl font-black text-slate-800">{isCreating ? 'Architect New Entry' : 'Edit Entry Properties'}</h3><p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-0.5">Control Panel</p></div>
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="p-2 rounded-full hover:bg-slate-200"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title / Identification Label</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 text-lg" placeholder="Enter name..." required />
                                </div>

                                {activeTab === 'flowDesignations' && (
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Economic Impact Classification</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {(['inflow', 'outflow', 'neutral'] as EconomicImpact[]).map(impact => (
                                                <button 
                                                    key={impact} 
                                                    type="button" 
                                                    onClick={() => setEconomicImpact(impact)}
                                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${economicImpact === impact ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'}`}
                                                >
                                                    {impact === 'inflow' && <TrendingUpIcon className="w-6 h-6" />}
                                                    {impact === 'outflow' && <TrendingUpIcon className="w-6 h-6 transform rotate-180" />}
                                                    {impact === 'neutral' && <RepeatIcon className="w-6 h-6" />}
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{impact === 'inflow' ? 'Earnings' : impact === 'outflow' ? 'Loss' : 'Neutral'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'categories' && (
                                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Parent Hierarchy</label><select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white"><option value="">-- Top Level --</option>{categories.filter(c => !c.parentId && c.id !== selectedId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                )}

                                {activeTab === 'transactionTypes' && (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ledger Balance Effect</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {(['income', 'expense', 'transfer', 'investment', 'donation', 'tax', 'savings', 'debt'] as const).map(effect => (
                                                <button key={effect} type="button" onClick={() => setBalanceEffect(effect)} className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${balanceEffect === effect ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'}`}>{effect}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3"><button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Discard</button><button type="submit" className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl">{isCreating ? 'Create Entry' : 'Update Entry'}</button></div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="p-8 bg-white rounded-full shadow-2xl border border-slate-100 mb-8 animate-bounce-subtle"><LightBulbIcon className="w-16 h-16 text-indigo-300" /></div>
                            <h3 className="text-2xl font-black text-slate-800">Resource Architect</h3>
                            <p className="text-slate-500 max-w-sm mt-3 font-medium">Select an item from the list to refine its properties or manage its classification.</p>
                            <button onClick={handleNew} className="mt-8 px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl transition-transform hover:-translate-y-1">Create New Item</button>
                        </div>
                    )}
                </div>
            </div>

            {isBulkDeleteModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-red-100"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Mass Deletion Alert</h2>
                            <p className="text-slate-500 font-medium">Purge <span className="text-red-600 font-black">{bulkSelectedIds.size}</span> item(s) from the <span className="capitalize font-bold">{activeTab}</span> dataset?</p>
                        </div>
                        <div className="p-8 flex flex-col gap-3"><button onClick={handleConfirmBulkDelete} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 shadow-xl flex items-center justify-center gap-2"><TrashIcon className="w-5 h-5" /> Execute Deletion</button><button onClick={() => setIsBulkDeleteModalOpen(false)} className="w-full py-3 bg-white border-2 border-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-colors">Nevermind, Cancel</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementHub;
