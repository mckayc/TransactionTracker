
import React, { useState, useMemo } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, Transaction, AccountType, Account, Location } from '../types';
import { TagIcon, UsersIcon, UserGroupIcon, ChecklistIcon, ShieldCheckIcon, AddIcon, ChevronRightIcon, ChevronDownIcon, CloseIcon, BoxIcon, MapPinIcon, TrashIcon, CreditCardIcon, SearchCircleIcon, SparklesIcon } from '../components/Icons';
import EntityEditor, { EntityType } from '../components/EntityEditor';

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
    searchFilter: string;
    onDelete: (id: string) => void;
}> = ({ item, all, level, selectedId, onSelect, usageMap, expandedIds, onToggleExpand, isBulkSelected, onToggleBulk, searchFilter, onDelete }) => {
    const children = all.filter(x => x.parentId === item.id).sort((a,b) => a.name.localeCompare(b.name));
    
    const matchesSearch = item.name.toLowerCase().includes(searchFilter.toLowerCase());
    
    const hasVisibleChild = (node: any): boolean => {
        if (node.name.toLowerCase().includes(searchFilter.toLowerCase())) return true;
        const sub = all.filter(x => x.parentId === node.id);
        return sub.some(s => hasVisibleChild(s));
    };

    if (searchFilter && !hasVisibleChild(item)) return null;

    const isExpanded = expandedIds.has(item.id) || !!searchFilter;
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
                    <span className={`text-sm font-bold truncate ${selectedId === item.id ? 'text-indigo-900' : 'text-slate-700'} ${matchesSearch && searchFilter ? 'bg-yellow-100 ring-2 ring-yellow-100 rounded' : ''}`}>{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                        className="p-1.5 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                        title="Delete Item"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
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
                    searchFilter={searchFilter}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

const ManagementHub: React.FC<ManagementHubProps> = (props) => {
    const { 
        transactions, categories, onSaveCategory, onDeleteCategory, tags, onSaveTag, onDeleteTag,
        counterparties, onSaveCounterparty, onDeleteCounterparty, onSaveCounterparties,
        locations, onSaveLocation, onDeleteLocation, users, onSaveUser, onDeleteUser,
        transactionTypes, onSaveTransactionType, onDeleteTransactionType,
        accountTypes, onSaveAccountType, onDeleteAccountType, accounts, onSaveAccount, onDeleteAccount
    } = props;

    const [activeTab, setActiveTab] = useState<EntityType>('categories');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const [searchFilter, setSearchFilter] = useState('');
    
    // Move Modal State
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [moveSearch, setMoveSearch] = useState('');

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
            case 'categories': list = categories; break;
            case 'tags': list = tags; break;
            case 'counterparties': list = counterparties; break;
            case 'locations': list = locations; break;
            case 'users': list = users; break;
            case 'transactionTypes': list = transactionTypes; break;
            case 'accountTypes': list = accountTypes; break;
            case 'accounts': list = accounts; break;
        }
        return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [activeTab, categories, tags, counterparties, locations, users, transactionTypes, accountTypes, accounts]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setIsCreating(false);
    };

    const handleBulkToggle = (id: string) => {
        const next = new Set(bulkSelectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setBulkSelectedIds(next);
    };

    const handleDeleteSingle = (id: string) => {
        const count = (usageCounts as any)[activeTab].get(id) || 0;
        if (count > 0) {
            alert(`This ${activeTab.slice(0, -1)} is currently used in ${count} records. Re-categorize those items before deleting.`);
            return;
        }
        if (!confirm(`Delete this ${activeTab.slice(0, -1)}?`)) return;

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
        if (selectedId === id) setSelectedId(null);
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

    const handleConfirmMove = (targetParentId: string | undefined) => {
        const updates = counterparties.map(c => 
            bulkSelectedIds.has(c.id) ? { ...c, parentId: targetParentId } : c
        );
        onSaveCounterparties(updates);
        setBulkSelectedIds(new Set());
        setIsMoveModalOpen(false);
    };

    const handleNew = () => {
        setSelectedId(null);
        setIsCreating(true);
    };

    const handleSaveEntity = (type: EntityType, payload: any) => {
        switch (type) {
            case 'categories': onSaveCategory(payload); break;
            case 'tags': onSaveTag(payload); break;
            case 'counterparties': onSaveCounterparty(payload); break;
            case 'locations': onSaveLocation(payload); break;
            case 'users': onSaveUser(payload); break;
            case 'transactionTypes': onSaveTransactionType(payload); break;
            case 'accountTypes': onSaveAccountType(payload); break;
            case 'accounts': onSaveAccount(payload); break;
        }
        setIsCreating(false);
        setSelectedId(payload.id);
    };

    const rootItems = useMemo(() => {
        if (activeTab === 'categories' || activeTab === 'counterparties') {
            return currentList.filter(x => !x.parentId);
        }
        return currentList;
    }, [currentList, activeTab]);

    const potentialParents = useMemo(() => {
        // Prevent moving an item to one of the currently selected items (avoids circular references simply)
        return counterparties
            .filter(c => !bulkSelectedIds.has(c.id))
            .filter(c => c.name.toLowerCase().includes(moveSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [counterparties, bulkSelectedIds, moveSearch]);

    const getPanelSubtitle = (type: EntityType) => {
        if (type === 'transactionTypes') return 'Transaction Types System Logic';
        if (type === 'accountTypes') return 'Account Types System Logic';
        return `${type.slice(0, -1)} System Logic`;
    };

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
                    { id: 'transactionTypes', label: 'Transaction Types', icon: <ChecklistIcon className="w-4 h-4" /> },
                    { id: 'accountTypes', label: 'Account Types', icon: <ShieldCheckIcon className="w-4 h-4" /> },
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as EntityType); setSelectedId(null); setIsCreating(false); setBulkSelectedIds(new Set()); setSearchFilter(''); }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* COLUMN 1: STREAM */}
                <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    <div className="p-4 border-b space-y-4 bg-slate-50">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    checked={bulkSelectedIds.size === currentList.length && currentList.length > 0} 
                                    onChange={() => setBulkSelectedIds(bulkSelectedIds.size === currentList.length ? new Set() : new Set(currentList.map(x => x.id)))} 
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-50"
                                />
                                <h3 className="font-black text-slate-700 capitalize tracking-tight">
                                    {activeTab === 'transactionTypes' ? 'Transaction Types' : activeTab === 'accountTypes' ? 'Account Types' : activeTab}
                                </h3>
                            </div>
                            <button onClick={handleNew} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                                <AddIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="relative group">
                            <input 
                                type="text" 
                                placeholder={`Search ${activeTab === 'transactionTypes' ? 'Transaction Types' : activeTab === 'accountTypes' ? 'Account Types' : activeTab}...`} 
                                value={searchFilter} 
                                onChange={e => setSearchFilter(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold" 
                            />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                            {searchFilter && <button onClick={() => setSearchFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"><CloseIcon className="w-3.5 h-3.5"/></button>}
                        </div>
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
                                    searchFilter={searchFilter}
                                    onDelete={handleDeleteSingle}
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
                                <button onClick={() => { setMoveSearch(''); setIsMoveModalOpen(true); }} className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2">
                                    <ChevronRightIcon className="w-3 h-3" /> Move Group
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* COLUMN 2: CONSOLE */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 relative">
                    {(selectedId || isCreating) ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">{isCreating ? 'Blueprint Designer' : 'Update Definition'}</h3>
                                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-0.5">{getPanelSubtitle(activeTab)}</p>
                                </div>
                                <button type="button" onClick={() => { setSelectedId(null); setIsCreating(false); }} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                            </div>

                            <EntityEditor 
                                type={activeTab}
                                initialId={selectedId}
                                onSave={handleSaveEntity}
                                onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                                categories={categories}
                                tags={tags}
                                counterparties={counterparties}
                                locations={locations}
                                users={users}
                                transactionTypes={transactionTypes}
                                accountTypes={accountTypes}
                                accounts={accounts}
                            />
                        </div>
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

            {/* In-App Move Modal */}
            {isMoveModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4" onClick={() => setIsMoveModalOpen(false)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
                            <div className="flex items-center gap-3">
                                <SparklesIcon className="w-6 h-6" />
                                <div><h3 className="font-black text-lg">Select New Parent</h3><p className="text-[10px] text-indigo-200 uppercase font-bold">Batch Relocation</p></div>
                            </div>
                            <button onClick={() => setIsMoveModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-white"/></button>
                        </div>
                        
                        <div className="p-4 bg-slate-50 border-b">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={moveSearch} 
                                    onChange={e => setMoveSearch(e.target.value)} 
                                    placeholder="Search for a parent..." 
                                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-indigo-500 outline-none"
                                    autoFocus
                                />
                                <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-96 p-2 custom-scrollbar bg-white">
                            <button 
                                onClick={() => handleConfirmMove(undefined)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-indigo-50 text-left transition-all border border-transparent hover:border-indigo-100 group"
                            >
                                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors text-slate-500"><ChevronRightIcon className="w-4 h-4"/></div>
                                <div>
                                    <p className="text-sm font-black text-slate-800">No Parent (Root)</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Move items to top level</p>
                                </div>
                            </button>
                            
                            {potentialParents.map(parent => (
                                <button 
                                    key={parent.id}
                                    onClick={() => handleConfirmMove(parent.id)}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-indigo-50 text-left transition-all border border-transparent hover:border-indigo-100 group"
                                >
                                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors text-indigo-400"><BoxIcon className="w-4 h-4"/></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{parent.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {parent.id.substring(0,8)}</p>
                                    </div>
                                </button>
                            ))}
                            
                            {potentialParents.length === 0 && moveSearch && (
                                <div className="p-12 text-center text-slate-400">
                                    <p className="text-sm font-bold italic">No matching counterparties found.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 bg-slate-50 border-t flex justify-end">
                            <button onClick={() => setIsMoveModalOpen(false)} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-800">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementHub;
