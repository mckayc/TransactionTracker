import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location, User, RuleImportDraft } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, ChevronDownIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, CloudArrowUpIcon, InfoIcon, ShieldCheckIcon, TagIcon, WrenchIcon, UsersIcon, UserGroupIcon, DownloadIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import RuleBuilder from '../components/RuleBuilder';
import RuleModal from '../components/RuleModal';
import { generateRulesFromData, hasApiKey, healDataSnippet } from '../services/geminiService';
import { parseRulesFromFile, parseRulesFromLines } from '../services/csvParserService';
import RuleImportVerification from '../components/RuleImportVerification';
import { applyRulesToTransactions } from '../services/ruleService';

interface RulesPageProps {
    rules: ReconciliationRule[];
    onSaveRule: (rule: ReconciliationRule) => void;
    onSaveRules: (rules: ReconciliationRule[]) => void;
    onDeleteRule: (ruleId: string) => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    transactions: Transaction[];
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onSaveCategory: (category: Category) => void;
    onSaveCategories: (categories: Category[]) => void;
    onSavePayee: (payee: Payee) => void;
    onSavePayees: (payees: Payee[]) => void;
    onSaveMerchant: (merchant: Merchant) => void;
    onSaveMerchants: (merchants: Merchant[]) => void;
    onSaveLocation: (location: Location) => void;
    onSaveLocations: (locations: Location[]) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
    onSaveUser: (user: User) => void;
}

const RULE_DOMAINS = [
    { id: 'all', label: 'All Scopes', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'payeeId', label: 'Payees', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'merchantId', label: 'Merchants', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'locationId', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
    { id: 'userId', label: 'Users', icon: <UserGroupIcon className="w-4 h-4" /> },
    { id: 'tagIds', label: 'Taxonomy', icon: <TagIcon className="w-4 h-4" /> },
    { id: 'metadata', label: 'Extraction', icon: <RobotIcon className="w-4 h-4" /> },
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onSaveRules, onDeleteRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSaveCategories, onSavePayee, onSavePayees, onSaveMerchant, onSaveMerchants, onSaveLocation, onSaveLocations, onSaveTag, onAddTransactionType, onSaveUser 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);
    
    // Selection for bulk actions
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
    const [bulkTargetCategoryId, setBulkTargetCategoryId] = useState('');
    
    // Importer State
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [importDrafts, setImportDrafts] = useState<RuleImportDraft[]>([]);
    const [isHealing, setIsHealing] = useState(false);
    const [importText, setImportText] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // AI Creator State
    const [aiFile, setAiFile] = useState<File | null>(null);
    const [aiRawData, setAiRawData] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiProposedRules, setAiProposedRules] = useState<ReconciliationRule[]>([]);

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedDomain !== 'all') {
            list = list.filter(r => r.ruleCategory === selectedDomain || r.conditions.some((c: RuleCondition) => c.field === selectedDomain));
        }
        return list.sort((a, b) => (a.priority || 0) - (b.priority || 0) || a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedDomain]);

    const activeRule = useMemo(() => rules.find(r => r.id === selectedRuleId), [rules, selectedRuleId]);

    const handleSelectRule = (id: string) => {
        setSelectedRuleId(id);
        setIsCreating(false);
    };

    const handleNew = () => {
        setSelectedRuleId(null);
        setIsCreating(true);
    };

    const handleBulkDelete = () => {
        if (confirm(`Permanently delete ${bulkSelectedIds.size} rules?`)) {
            bulkSelectedIds.forEach(id => onDeleteRule(id));
            setBulkSelectedIds(new Set());
        }
    };

    const handleBulkCategoryChange = () => {
        if (!bulkTargetCategoryId) return;
        const updatedRules = Array.from(bulkSelectedIds).map(id => {
            const r = rules.find(x => x.id === id);
            return r ? { ...r, setCategoryId: bulkTargetCategoryId } : null;
        }).filter(Boolean) as ReconciliationRule[];
        
        onSaveRules(updatedRules);
        setBulkSelectedIds(new Set());
        setIsBulkCategoryModalOpen(false);
    };

    const handleAiInspect = async () => {
        const input = aiFile || aiRawData;
        if (!input) return;
        setIsAiGenerating(true);
        try {
            const result = await generateRulesFromData(input, categories, payees, merchants, locations, users, aiPrompt);
            setAiProposedRules(result);
        } catch (e) { console.error(e); } finally { setIsAiGenerating(false); }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Automation Engine</h1>
                    <p className="text-sm text-slate-500">Programmatic ledger normalization logic.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsImporterOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl shadow-sm hover:bg-indigo-50 font-bold transition-all"><CloudArrowUpIcon className="w-5 h-5" /> Import Manifest</button>
                    <button onClick={() => setIsAiCreatorOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 font-bold transition-all"><SparklesIcon className="w-5 h-5" /> AI Rule Forge</button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: CATEGORIES */}
                <div className="w-56 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 flex-shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Rule Categories</p>
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

                {/* MIDDLE: LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b flex items-center gap-3 bg-slate-50 rounded-t-2xl">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                            checked={bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0}
                            onChange={() => setBulkSelectedIds(bulkSelectedIds.size === filteredRules.length ? new Set() : new Set(filteredRules.map(r => r.id)))}
                        />
                        <div className="relative flex-1">
                            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none" />
                            <SearchCircleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredRules.map(r => (
                            <div key={r.id} onClick={() => handleSelectRule(r.id)} className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all border-2 ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}>
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
                                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{categories.find(c => c.id === r.setCategoryId)?.name || 'Unassigned'}</p>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); }} className="p-1.5 text-slate-300 hover:text-red-500"><DeleteIcon className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t bg-white rounded-b-2xl flex gap-2">
                        {bulkSelectedIds.size > 0 ? (
                            <>
                                <button onClick={() => setIsBulkCategoryModalOpen(true)} className="flex-1 py-2 bg-indigo-50 text-indigo-700 font-black rounded-xl text-[10px] uppercase shadow-sm flex items-center justify-center gap-2"><TagIcon className="w-3.5 h-3.5" /> Reassign</button>
                                <button onClick={handleBulkDelete} className="flex-1 py-2 bg-red-50 text-red-600 font-black rounded-xl text-[10px] uppercase shadow-sm flex items-center justify-center gap-2"><DeleteIcon className="w-3.5 h-3.5" /> Purge</button>
                            </>
                        ) : (
                            <button onClick={handleNew} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700 flex items-center justify-center gap-2"><AddIcon className="w-4 h-4" /> Create Rule</button>
                        )}
                    </div>
                </div>

                {/* RIGHT: EDITOR */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    {(selectedRuleId || isCreating) ? (
                        <RuleModal 
                            isOpen={true} 
                            onClose={() => { setSelectedRuleId(null); setIsCreating(false); }} 
                            onSaveRule={(r) => { onSaveRule(r); setIsCreating(false); setSelectedRuleId(r.id); }}
                            accounts={accounts}
                            transactionTypes={transactionTypes}
                            categories={categories}
                            tags={tags}
                            payees={payees}
                            merchants={merchants}
                            locations={locations}
                            users={users}
                            transaction={activeRule ? { ...activeRule, description: activeRule.conditions[0]?.value || '' } as any : null}
                            onSaveCategory={onSaveCategory}
                            onSavePayee={onSavePayee}
                            onSaveTag={onSaveTag}
                            onAddTransactionType={onAddTransactionType}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8">
                                <ShieldCheckIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Rule Center</h3>
                            <p className="text-slate-500 max-w-sm mt-4 font-medium">Select a logic set from the list to refine its properties or use the importer for bulk migrations.</p>
                            <button onClick={handleNew} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg">Architect New Rule</button>
                        </div>
                    )}
                </div>
            </div>

            {/* BULK CATEGORY MODAL */}
            {isBulkCategoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 flex flex-col gap-6 animate-slide-up">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Mass Category Shift</h3>
                            <button onClick={() => setIsBulkCategoryModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><CloseIcon className="w-6 h-6"/></button>
                        </div>
                        <p className="text-sm text-slate-500">Set <strong>{bulkSelectedIds.size}</strong> rules to target this category:</p>
                        <select 
                            value={bulkTargetCategoryId} 
                            onChange={e => setBulkTargetCategoryId(e.target.value)}
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white"
                        >
                            <option value="">Select Target...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setIsBulkCategoryModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Abort</button>
                            <button onClick={handleBulkCategoryChange} disabled={!bulkTargetCategoryId} className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl disabled:opacity-30">Confirm Reassignment</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RulesPage;