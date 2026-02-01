
import React, { useState, useMemo } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, AccountType, Account, Location, Transaction, ReconciliationRule } from '../types';
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
    onSaveCategories: (cs: Category[]) => void;
    onSaveLocations: (ls: Location[]) => void;
    // Added for logic forge
    onSaveRules?: (rules: ReconciliationRule[]) => void;
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
    bulkSelectedIds: Set<string>; 
    onToggleBulk: (id: string) => void;
    searchFilter: string;
    onDelete: (id: string) => void;
}> = ({ item, all, level, selectedId, onSelect, usageMap, expandedIds, onToggleExpand, bulkSelectedIds, onToggleBulk, searchFilter, onDelete }) => {
    const children = all.filter(x => 'parentId' in x && x.parentId === item.id).sort((a,b) => a.name.localeCompare(b.name));
    
    const matchesSearch = item.name.toLowerCase().includes(searchFilter.toLowerCase());
    
    const hasVisibleChild = (node: any): boolean => {
        if (node.name.toLowerCase().includes(searchFilter.toLowerCase())) return true;
        const sub = all.filter(x => 'parentId' in x && x.parentId === node.id);
        return sub.some(s => hasVisibleChild(s));
    };

    if (searchFilter && !hasVisibleChild(item)) return null;

    const isExpanded = expandedIds.has(item.id) || !!searchFilter;
    const count = usageMap.get(item.id) || 0;
    const isChecked = bulkSelectedIds.has(item.id);
    
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
                        checked={isChecked} 
                        onClick={(e) => e.stopPropagation()} 
                        onChange={() => onToggleBulk(item.id)} 
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-50"
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
                    <span className={`text-sm font-bold truncate ${selectedId === item.id ? 'text-indigo-900' : 'text-slate-700'} ${matchesSearch && searchFilter ? 'bg-yellow-100' : ''}`}>{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                    {count > 0 && <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">{count}</span>}
                    <button onClick={(e) => { e.stopPropagation(); if(confirm(`Delete "${item.name}"?`)) onDelete(item.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"><TrashIcon className="w-4 h-4"/></button>
                </div>
            </div>
            {isExpanded && children.map(child => (
                <TreeNode 
                    key={child.id} item={child} all={all} level={level + 1} 
                    selectedId={selectedId} onSelect={onSelect} 
                    usageMap={usageMap} expandedIds={expandedIds} 
                    onToggleExpand={onToggleExpand} bulkSelectedIds={bulkSelectedIds}
                    onToggleBulk={onToggleBulk} searchFilter={searchFilter} onDelete={onDelete}
                />
            ))}
        </div>
    );
};

const ManagementHub: React.FC<ManagementHubProps> = (props) => {
    const [activeTab, setActiveTab] = useState<EntityType>('categories');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [search, setSearch] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

    const usageMap = useMemo(() => {
        const map = new Map<string, number>();
        props.transactions.forEach(tx => {
            const keys = [];
            if (activeTab === 'categories') keys.push(tx.categoryId);
            else if (activeTab === 'counterparties') keys.push(tx.counterpartyId);
            else if (activeTab === 'locations') keys.push(tx.locationId);
            else if (activeTab === 'tags' && tx.tagIds) keys.push(...tx.tagIds);
            else if (activeTab === 'users') keys.push(tx.userId);
            else if (activeTab === 'transactionTypes') keys.push(tx.typeId);
            else if (activeTab === 'accounts') keys.push(tx.accountId);
            
            keys.forEach(k => { if(k) map.set(k, (map.get(k) || 0) + 1); });
        });
        return map;
    }, [props.transactions, activeTab]);

    const activeList = useMemo(() => {
        switch (activeTab) {
            case 'categories': return props.categories;
            case 'tags': return props.tags;
            case 'counterparties': return props.counterparties;
            case 'locations': return props.locations;
            case 'users': return props.users;
            case 'transactionTypes': return props.transactionTypes;
            case 'accountTypes': return props.accountTypes;
            case 'accounts': return props.accounts;
            default: return [];
        }
    }, [activeTab, props]);

    const handleSave = (type: EntityType, payload: any) => {
        switch (type) {
            case 'categories': props.onSaveCategory(payload); break;
            case 'tags': props.onSaveTag(payload); break;
            case 'counterparties': props.onSaveCounterparty(payload); break;
            case 'locations': props.onSaveLocation(payload); break;
            case 'users': props.onSaveUser(payload); break;
            case 'transactionTypes': props.onSaveTransactionType(payload); break;
            case 'accountTypes': props.onSaveAccountType(payload); break;
            case 'accounts': props.onSaveAccount(payload); break;
        }
        setIsCreating(false);
        setSelectedId(payload.id);
    };

    const handleDelete = (id: string) => {
        switch (activeTab) {
            case 'categories': props.onDeleteCategory(id); break;
            case 'tags': props.onDeleteTag(id); break;
            case 'counterparties': props.onDeleteCounterparty(id); break;
            case 'locations': props.onDeleteLocation(id); break;
            case 'users': props.onDeleteUser(id); break;
            case 'transactionTypes': props.onDeleteTransactionType(id); break;
            case 'accountTypes': props.onDeleteAccountType(id); break;
            case 'accounts': props.onDeleteAccount(id); break;
        }
        if (selectedId === id) setSelectedId(null);
    };

    const handleToggleBulk = (id: string) => {
        const next = new Set(bulkSelectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setBulkSelectedIds(next);
    };

    const handleBulkAction = (action: 'delete' | 'move') => {
        if (action === 'delete') {
            if (confirm(`Permanently purge ${bulkSelectedIds.size} records?`)) {
                bulkSelectedIds.forEach(id => handleDelete(id));
                setBulkSelectedIds(new Set());
            }
        }
    };

    const TABS: { id: EntityType; label: string; icon: React.ReactNode }[] = [
        { id: 'categories', label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
        { id: 'counterparties', label: 'Counterparties', icon: <BoxIcon className="w-4 h-4" /> },
        { id: 'locations', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
        { id: 'tags', label: 'Labels & Tags', icon: <ShieldCheckIcon className="w-4 h-4" /> },
        { id: 'accounts', label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" /> },
        { id: 'transactionTypes', label: 'Tx Types', icon: <ChecklistIcon className="w-4 h-4" /> },
        { id: 'users', label: 'Identities', icon: <UsersIcon className="w-4 h-4" /> }
    ];

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-end flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Identity Hub</h1>
                    <p className="text-sm text-slate-500">Manage institutional entities, hierarchies, and system branding.</p>
                </div>
                <div className="flex gap-3">
                    {bulkSelectedIds.size > 0 && (
                        <div className="flex bg-slate-900 text-white p-1 rounded-2xl shadow-xl animate-slide-up">
                            <span className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">{bulkSelectedIds.size} Selected</span>
                            <button onClick={() => handleBulkAction('delete')} className="p-2 hover:bg-white/10 rounded-xl text-rose-400" title="Mass Delete"><TrashIcon className="w-4 h-4"/></button>
                            <button onClick={() => setBulkSelectedIds(new Set())} className="p-2 text-slate-500 hover:text-white"><CloseIcon className="w-4 h-4"/></button>
                        </div>
                    )}
                    <button onClick={() => { setIsCreating(true); setSelectedId(null); }} className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                        <AddIcon className="w-5 h-5" /> Register Entity
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* COLUMN 1: TAXONOMY */}
                <div className="w-64 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col p-4 flex-shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2">Taxonomy Clusters</p>
                    <div className="space-y-1">
                        {TABS.map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => { setActiveTab(tab.id); setSelectedId(null); setIsCreating(false); setBulkSelectedIds(new Set()); }} 
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* COLUMN 2: TREE/STREAM */}
                <div className="w-96 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-4 border-b bg-slate-50 rounded-t-3xl space-y-4">
                        <div className="relative">
                            <input type="text" placeholder="Filter registry..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold shadow-inner" />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {activeList.filter(x => !('parentId' in x) || !x.parentId).map(item => (
                            <TreeNode 
                                key={item.id} item={item} all={activeList} level={0} 
                                selectedId={selectedId} onSelect={setSelectedId} 
                                usageMap={usageMap} expandedIds={expandedIds} 
                                onToggleExpand={(id) => setExpandedIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })}
                                bulkSelectedIds={bulkSelectedIds}
                                onToggleBulk={handleToggleBulk}
                                searchFilter={search}
                                onDelete={handleDelete}
                            />
                        ))}
                        {activeList.length === 0 && (
                            <div className="p-12 text-center text-slate-300 italic opacity-50 flex flex-col items-center">
                                <SearchCircleIcon className="w-12 h-12 mb-2" />
                                <p className="text-[10px] font-black uppercase">No records found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMN 3: EDITOR */}
                <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
                    {selectedId || isCreating ? (
                        <EntityEditor 
                            type={activeTab} 
                            initialId={selectedId} 
                            onSave={handleSave} 
                            onCancel={() => { setSelectedId(null); setIsCreating(false); }}
                            categories={props.categories}
                            tags={props.tags}
                            counterparties={props.counterparties}
                            locations={props.locations}
                            users={props.users}
                            transactionTypes={props.transactionTypes}
                            accountTypes={props.accountTypes}
                            accounts={props.accounts}
                            onSaveRules={props.onSaveRules}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <SparklesIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Entity Workbench</h3>
                            <p className="text-slate-500 max-w-xs mt-4 font-medium leading-relaxed">Select an institutional record from the registry to audit its metadata, modify its hierarchy, or update its symbol branding.</p>
                            <button onClick={() => setIsCreating(true)} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">Start Creation</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagementHub;
