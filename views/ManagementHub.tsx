import React, { useState, useMemo } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, Transaction, AccountType, Account, BalanceEffect, Location } from '../types';
import { TagIcon, UsersIcon, UserGroupIcon, ChecklistIcon, ShieldCheckIcon, AddIcon, DeleteIcon, EditIcon, ChevronRightIcon, ChevronDownIcon, NotesIcon, CloseIcon, SparklesIcon, TableIcon, BoxIcon, MapPinIcon, ExclamationTriangleIcon, TrashIcon, CreditCardIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface ManagementHubProps {
    transactions: Transaction[];
    categories: Category[];
    onSaveCategory: (c: Category) => void;
    onDeleteCategory: (id: string) => void;
    tags: Tag[];
    onSaveTag: (t: Tag) => void;
    onDeleteTag: (id: string) => void;
    counterparties: Counterparty[];
    onSaveCounterparty: (p: Counterparty) => void;
    onDeleteCounterparty: (id: string) => void;
    onSaveCounterparties: (ps: Counterparty[]) => void;
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
    onSaveAccount: (a: Account) => void;
    onDeleteAccount: (id: string) => void;
}

type Tab = 'categories' | 'tags' | 'counterparties' | 'locations' | 'users' | 'transactionTypes' | 'accountTypes' | 'accounts';

const TreeNode: React.FC<{ 
    item: any; 
    all: any[]; 
    level: number; 
    selectedId: string | null; 
    onSelect: (id: string) => void; 
    usageMap: Map<string, number>;
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    isBulkSelected: boolean;
    onToggleBulk: (id: string) => void;
}> = ({ item, all, level, selectedId, onSelect, usageMap, expandedIds, onToggleExpand, isBulkSelected, onToggleBulk }) => {
    const children = all.filter(x => x.parentId === item.id).sort((a,b) => a.name.localeCompare(b.name));
    const isExpanded = expandedIds.has(item.id);
    const count = usageMap.get(item.id) || 0;
    
    return (
        <div className="select-none">
            <div 
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border-2 group ${selectedId === item.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}
                style={{ marginLeft: `${level * 16}px` }}
                onClick={() => onSelect(item.id)}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <input 
                        type="checkbox" 
                        checked={isBulkSelected} 
                        onClick={(e) => e.stopPropagation()} 
                        onChange={() => onToggleBulk(item.id)} 
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {children.length > 0 ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400"
                        >
                            {isExpanded ? <ChevronDownIcon className="w-3.5 h-3.5"/> : <ChevronRightIcon className="w-3.5 h-3.5"/>}
                        </button>
                    ) : (
                        <div className="w-5" />
                    )}
                    <span className={`text-sm font-bold truncate ${selectedId === item.id ? 'text-indigo-900' : 'text-slate-700'}`}>{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">{count}</span>
                </div>
            </div>
            {isExpanded && children.map(child => (
                <TreeNode 
                    key={child.id} 
                    item={child} 
                    all={all} 
                    level={level + 1} 
                    selectedId={selectedId} 
                    onSelect={onSelect} 
                    usageMap={usageMap}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    isBulkSelected={isBulkSelected}
                    onToggleBulk={onToggleBulk}
                />
            ))}
        </div>
    );
};

const ManagementHub: React.FC<ManagementHubProps> = ({ 
    transactions, categories, onSaveCategory, onDeleteCategory, tags, onSaveTag, onDeleteTag,
    counterparties, onSaveCounterparty, onDeleteCounterparty, onSaveCounterparties,
    locations, onSaveLocation, onDeleteLocation, users, onSaveUser, onDeleteUser,
    transactionTypes, onSaveTransactionType, onDeleteTransactionType,
    accountTypes, onSaveAccountType, onDeleteAccountType, accounts, onSaveAccount, onDeleteAccount
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('categories');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    
    // Form states
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [color, setColor] = useState('bg-slate-100 text-slate-800');
    const [notes, setNotes] = useState('');
    const [userId, setUserId] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('');
    const [balanceEffect, setBalanceEffect] = useState<BalanceEffect>('expense');
    const [identifier, setIdentifier] = useState('');
    const [accountTypeId, setAccountTypeId] = useState('');

    const usageCounts = useMemo(() => {
        const counts = {
            categories: new Map<string, number>(),
            tags: new Map<string, number>(),
            counterparties: new Map<string, number>(),
            locations: new Map<string, number>(),
            users: new Map<string, number>(),
            transactionTypes: new Map<string, number>(),
            accountTypes: new Map<string, number>(),
            accounts: new Map<string, number>()
        };
        transactions.forEach(tx => {
            counts.categories.set(tx.categoryId, (counts.categories.get(tx.categoryId) || 0) + 1);
            tx.tagIds?.forEach(tid => counts.tags.set(tid, (counts.tags.get(tid) || 0) + 1));
            if (tx.counterpartyId) counts.counterparties.set(tx.counterpartyId, (counts.counterparties.get(tx.counterpartyId) || 0) + 1);
            if (tx.locationId) counts.locations.set(tx.locationId, (counts.locations.get(tx.locationId) || 0) + 1);
            if (tx.userId) counts.users.set(tx.userId, (counts.users.get(tx.userId) || 0) + 1);
            counts.transactionTypes.set(tx.typeId, (counts.transactionTypes.get(tx.typeId) || 0) + 1);
            if (tx.accountId) counts.accounts.set(tx.accountId, (counts.accounts.get(tx.accountId) || 0) + 1);
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
            case 'counterparties': list = [...counterparties]; break;
            case 'locations': list = [...locations]; break;
            case 'users': list = [...users]; break;
            case 'transactionTypes': list = [...transactionTypes]; break;
            case 'accountTypes': list = [...accountTypes]; break;
            case 'accounts': list = [...accounts]; break;
        }
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [activeTab, categories, tags, counterparties, locations, users, transactionTypes, accountTypes, accounts]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setIsCreating(false);
        const item = currentList.find(x => x.id === id);
        if (!item) return;

        setName(item.name || '');
        if (activeTab === 'categories') setParentId(item.parentId || '');
        else if (activeTab === 'tags') setColor(item.color);
        else if (activeTab === 'counterparties') { setParentId(item.parentId || ''); setNotes(item.notes || ''); setUserId(item.userId || ''); }
        else if (activeTab === 'locations') { setCity(item.city || ''); setState(item.state || ''); setCountry(item.country || ''); }
        else if (activeTab === 'transactionTypes') { setBalanceEffect(item.balanceEffect); setColor(item.color || 'text-slate-600'); }
        else if (activeTab === 'accounts') { setIdentifier(item.identifier || ''); setAccountTypeId(item.accountTypeId || ''); }
    };

    const handleBulkToggle = (id: string) => {
        const next = new Set(bulkSelectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setBulkSelectedIds(next);
    };

    const handleBulkDelete = () => {
        if (bulkSelectedIds.size === 0) return;
        if (!confirm(`Delete ${bulkSelectedIds.size} selected items? (Only unused items will be removed)`)) return;
        bulkSelectedIds.forEach(id => {
            const count = (usageCounts as any)[activeTab].get(id) || 0;
            if (count === 0) {
                switch (activeTab) {
                    case 'categories': onDeleteCategory(id); break;
                    case 'tags': onDeleteTag(id); break;
                    case 'counterparties': onDeleteCounterparty(id); break;
                    case 'locations': onDeleteLocation(id); break;
                    case 'users': onDeleteUser(id); break;
                    case 'transactionTypes': onDeleteTransactionType(id); break;
                    case 'accountTypes': onDeleteAccountType(id); break;
                    case 'accounts': onDeleteAccount(id); break;
                }
            }
        });
        setBulkSelectedIds(new Set());
    };

    const handleBulkMove = () => {
        if (activeTab !== 'counterparties' || bulkSelectedIds.size === 0) return;
        const newParent = prompt("Enter the ID or exact name of the new parent (or leave empty for root):");
        const foundParent = counterparties.find(c => c.id === newParent || c.name.toLowerCase() === newParent?.toLowerCase());
        const targetParentId = foundParent ? foundParent.id : (newParent === '' ? undefined : null);
        
        if (targetParentId === null) {
            alert("Parent not found.");
            return;
        }

        const updates = counterparties.map(c => 
            bulkSelectedIds.has(c.id) ? { ...c, parentId: targetParentId } : c
        );
        onSaveCounterparties(updates);
        setBulkSelectedIds(new Set());
    };

    const handleNew = () => {
        setSelectedId(null);
        setIsCreating(true);
        setName('');
        setParentId('');
        setCity('');
        setState('');
        setCountry('');
        setNotes('');
        setIdentifier('');
        setAccountTypeId(accountTypes[0]?.id || '');
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
            case 'counterparties': onSaveCounterparty({ ...payload, parentId: parentId || undefined, notes: notes || undefined, userId: userId || undefined }); break;
            case 'locations': onSaveLocation({ ...payload, city, state, country }); break;
            case 'users': onSaveUser(payload); break;
            case 'transactionTypes': onSaveTransactionType({ ...payload, balanceEffect, color }); break;
            case 'accountTypes': onSaveAccountType(payload); break;
            case 'accounts': onSaveAccount({ ...payload, identifier, accountTypeId }); break;
        }
        setIsCreating(false);
        setSelectedId(id);
    };

    const rootItems = useMemo(() => {
        if (activeTab === 'categories' || activeTab === 'counterparties') {
            return currentList.filter(x => !x.parentId);
        }
        return currentList;
    }, [currentList, activeTab]);

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Organization</h1>
                    <p className="text-sm text-slate-500">Master entity and categorization management.</p>
                </div>
            </div>

            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                {[
                    { id: 'categories', label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
                    { id: 'counterparties', label: 'Counterparties', icon: <UsersIcon className="w-4 h-4" /> },
                    { id: 'accounts', label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" /> },
                    { id: 'tags', label: 'Tags', icon: <TagIcon className="w-4 h-4" /> },
                    { id: 'locations', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
                    { id: 'users', label: 'Users', icon: <UserGroupIcon className="w-4 h-4" /> },
                    { id: 'transactionTypes', label: 'Tx Types', icon: <ChecklistIcon className="w-4 h-4" /> },
                    { id: 'accountTypes', label: 'Acct Types', icon: <ShieldCheckIcon className="w-4 h-4" /> },
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as Tab); setSelectedId(null); setIsCreating(false); setBulkSelectedIds(new Set()); }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* COLUMN 1: STREAM */}
                <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                checked={bulkSelectedIds.size === currentList.length && currentList.length > 0} 
                                onChange={() => setBulkSelectedIds(bulkSelectedIds.size === currentList.length ? new Set() : new Set(currentList.map(x => x.id)))} 
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-50"
                            />
                            <h3 className="font-black text-slate-700 capitalize tracking-tight">{activeTab}</h3>
                        </div>
                        <button onClick={handleNew} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                            <AddIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
                        {rootItems.length === 0 ? (
                            <div className="p-10 text-center text-slate-300">
                                <BoxIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p className="text-xs font-bold">Empty list.</p>
                            </div>
                        ) : (
                            rootItems.map(item => (
                                <TreeNode 
                                    key={item.id} 
                                    item={item} 
                                    all={currentList} 
                                    level={0} 
                                    selectedId={selectedId} 
                                    onSelect={handleSelect} 
                                    usageMap={(usageCounts as any)[activeTab]}
                                    expandedIds={expandedIds}
                                    onToggleExpand={(id) => { const n = new Set(expandedIds); if(n.has(id)) n.delete(id); else n.add(id); setExpandedIds(n); }}
                                    isBulkSelected={bulkSelectedIds.has(item.id)}
                                    onToggleBulk={handleBulkToggle}
                                />
                            ))
                        )}
                    </div>
                    {bulkSelectedIds.size > 0 && (
                        <div className="p-3 border-t bg-indigo-50 flex gap-2">
                            <button onClick={handleBulkDelete} className="flex-1 py-2 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-red-700 shadow-sm flex items-center justify-center gap-2">
                                <TrashIcon className="w-3 h-3" /> Delete {bulkSelectedIds.size}
                            </button>
                            {activeTab === 'counterparties' && (
                                <button onClick={handleBulkMove} className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2">
                                    <ChevronRightIcon className="w-3 h-3" /> Move Group
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* COLUMN 2: CONSOLE */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 relative">
                    {(selectedId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex flex-col h-full animate-fade-in">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">{isCreating ? 'Blueprint Designer' : 'Update Definition'}</h3>
                                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-0.5">{activeTab.slice(0, -1)} System Logic</p>
                                </div>
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-white">
                                <div className="space-y-6 max-w-2xl">
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 text-lg shadow-sm" placeholder="Display name..." required />
                                    </div>

                                    {activeTab === 'accounts' && (
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

                                    {(activeTab === 'categories' || activeTab === 'counterparties') && (
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parent Hierarchy</label>
                                            <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white">
                                                <option value="">-- No Parent (Root) --</option>
                                                {currentList.filter(x => x.id !== (selectedId || 'none')).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {activeTab === 'counterparties' && (
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Ledger Assignment</label>
                                            <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white">
                                                <option value="">-- Global System Default --</option>
                                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {activeTab === 'tags' && (
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

                                    {(activeTab === 'counterparties' || activeTab === 'categories' || activeTab === 'accounts') && (
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Archival Context & Logic</label>
                                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-medium min-h-[140px]" placeholder="Record account details, vendor logic, or institutional memory..." />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Discard</button>
                                <button type="submit" className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl active:scale-95 transition-all">
                                    {isCreating ? 'Register Logic' : 'Update definition'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-100 mb-6 animate-bounce-subtle">
                                <ChecklistIcon className="w-10 h-10 text-indigo-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Entity Architect</h3>
                            <p className="text-slate-400 text-sm mt-3 font-medium max-w-xs leading-relaxed">Select an active registry item to manage its structural logic or visual styling.</p>
                            <button onClick={handleNew} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg">Register New {activeTab.slice(0,-1)}</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagementHub;