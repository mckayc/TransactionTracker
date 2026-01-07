import React, { useState, useMemo } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Counterparty, Category, RuleCondition, Tag, Location, User, RuleImportDraft } from '../types';
import { DeleteIcon, AddIcon, SearchCircleIcon, SparklesIcon, ShieldCheckIcon, TagIcon, TableIcon, BoxIcon, MapPinIcon, UserGroupIcon, CloudArrowUpIcon, TrashIcon, PlayIcon, CloseIcon } from '../components/Icons';
import RuleModal from '../components/RuleModal';
import { generateRulesFromData } from '../services/geminiService';

interface RulesPageProps {
    rules: ReconciliationRule[];
    onSaveRule: (rule: ReconciliationRule) => void;
    onSaveRules: (rules: ReconciliationRule[]) => void;
    onDeleteRule: (ruleId: string) => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    tags: Tag[];
    counterparties: Counterparty[];
    locations: Location[];
    users: User[];
    transactions: Transaction[];
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onSaveCategory: (category: Category) => void;
    onSaveCategories: (categories: Category[]) => void;
    onSaveCounterparty: (p: Counterparty) => void;
    onSaveCounterparties: (ps: Counterparty[]) => void;
    onSaveLocation: (location: Location) => void;
    onSaveLocations: (locations: Location[]) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
    onSaveUser: (user: User) => void;
}

const RULE_DOMAINS = [
    { id: 'all', label: 'All Domains', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'counterpartyId', label: 'Entities', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'locationId', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
    { id: 'userId', label: 'Users', icon: <UserGroupIcon className="w-4 h-4" /> },
    { id: 'tagIds', label: 'Taxonomy', icon: <TagIcon className="w-4 h-4" /> },
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onSaveRules, onDeleteRule, accounts, transactionTypes, categories, tags, counterparties, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, onSaveTag, onAddTransactionType, onSaveUser 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedDomain !== 'all') {
            list = list.filter(r => r.ruleCategory === selectedDomain || r.conditions.some((c: RuleCondition) => c.field === selectedDomain));
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedDomain]);

    const activeRule = useMemo(() => rules.find(r => r.id === selectedRuleId), [rules, selectedRuleId]);

    const handleBulkDelete = () => {
        if (confirm(`Permanently delete ${bulkSelectedIds.size} selected rules?`)) {
            bulkSelectedIds.forEach(id => onDeleteRule(id));
            setBulkSelectedIds(new Set());
            setSelectedRuleId(null);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Automation logic</h1>
                    <p className="text-sm text-slate-500">Programmatic ingestion rules for the system ledger.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 font-black transition-all transform active:scale-95">
                        <AddIcon className="w-5 h-5" /> New Rule
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: SCOPES */}
                <div className="w-56 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 flex-shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Filter Scopes</p>
                    <div className="space-y-0.5 overflow-y-auto custom-scrollbar">
                        {RULE_DOMAINS.map(domain => (
                            <button 
                                key={domain.id} 
                                onClick={() => setSelectedDomain(domain.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedDomain === domain.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                {domain.icon}
                                <span>{domain.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: RULES LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b flex items-center gap-3 bg-slate-50 rounded-t-2xl">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0}
                            onChange={() => setBulkSelectedIds(bulkSelectedIds.size === filteredRules.length ? new Set() : new Set(filteredRules.map(r => r.id)))}
                        />
                        <div className="relative flex-1">
                            <input type="text" placeholder="Search logic..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none font-bold" />
                            <SearchCircleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredRules.length === 0 ? (
                            <div className="p-10 text-center text-slate-300">
                                <BoxIcon className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                <p className="text-[10px] font-black uppercase">No rules matched</p>
                            </div>
                        ) : (
                            filteredRules.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => { setSelectedRuleId(r.id); setIsCreating(false); }} 
                                    className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all border-2 ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'} ${bulkSelectedIds.has(r.id) ? 'ring-1 ring-indigo-200' : ''}`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 flex-shrink-0"
                                            checked={bulkSelectedIds.has(r.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => {
                                                const n = new Set(bulkSelectedIds);
                                                if (n.has(r.id)) n.delete(r.id); else n.add(r.id);
                                                setBulkSelectedIds(n);
                                            }}
                                        />
                                        <div className="min-w-0">
                                            <p className={`text-xs font-bold truncate ${selectedRuleId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{r.ruleCategory || 'general'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {bulkSelectedIds.size > 0 && (
                        <div className="p-3 border-t bg-white rounded-b-2xl">
                            <button onClick={handleBulkDelete} className="w-full py-2 bg-red-50 text-red-600 font-black rounded-xl text-[10px] uppercase shadow-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all">
                                <TrashIcon className="w-3.5 h-3.5" /> Purge {bulkSelectedIds.size} Rules
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT: EDITOR PREVIEW */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
                    {(selectedRuleId || isCreating) ? (
                        <RuleModal 
                            isOpen={true} 
                            onClose={() => { setSelectedRuleId(null); setIsCreating(false); }} 
                            onSaveRule={(r) => { onSaveRule(r); setIsCreating(false); setSelectedRuleId(r.id); }}
                            accounts={accounts}
                            transactionTypes={transactionTypes}
                            categories={categories}
                            tags={tags}
                            counterparties={counterparties}
                            locations={locations}
                            users={users}
                            transaction={activeRule ? { ...activeRule, description: activeRule.conditions[0]?.value || '' } as any : null}
                            onSaveCategory={onSaveCategory}
                            onSaveCounterparty={onSaveCounterparty}
                            onSaveTag={onSaveTag}
                            onAddTransactionType={onAddTransactionType}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8">
                                <ShieldCheckIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Logic Hub</h3>
                            <p className="text-slate-500 max-w-sm mt-4 font-medium leading-relaxed">Design rules to standardize your ledger automatically. Define criteria for descriptions, amounts, or accounts to auto-apply categories and entities.</p>
                            <button onClick={() => setIsCreating(true)} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">New System Rule</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RulesPage;