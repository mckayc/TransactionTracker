
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location, User, RuleImportDraft } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, ChevronDownIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, CloudArrowUpIcon, InfoIcon, ShieldCheckIcon, TagIcon, WrenchIcon, UsersIcon, UserGroupIcon, DownloadIcon, TrashIcon, ExclamationTriangleIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import RuleModal from '../components/RuleModal';
import { generateRulesFromData, hasApiKey, healDataSnippet } from '../services/geminiService';
import { parseRulesFromFile, parseRulesFromLines } from '../services/csvParserService';
import RuleImportVerification from '../components/RuleImportVerification';
import RulePreviewModal from '../components/RulePreviewModal';

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
    { id: 'all', label: 'All Rule Categories', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'payeeId', label: 'Payees', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'merchantId', label: 'Merchants', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'locationId', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
    { id: 'metadata', label: 'Extraction Hints', icon: <RobotIcon className="w-4 h-4" /> },
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onSaveRules, onDeleteRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSaveCategories, onSavePayee, onSavePayees, onSaveMerchant, onSaveMerchants, onSaveLocation, onSaveLocations, onSaveTag, onAddTransactionType, onSaveUser 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    
    // Bulk Management State
    const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Architect Modal State
    const [isArchitectOpen, setIsArchitectOpen] = useState(false);
    const [architectContextRule, setArchitectContextRule] = useState<ReconciliationRule | null>(null);

    // Run/Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewTargetRule, setPreviewTargetRule] = useState<ReconciliationRule | null>(null);
    
    // Importer State
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [importDrafts, setImportDrafts] = useState<RuleImportDraft[]>([]);
    const [isHealing, setIsHealing] = useState(false);
    const [importText, setImportText] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // AI Discovery State
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);
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
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedDomain]);

    const activeRule = useMemo(() => rules.find(r => r.id === selectedRuleId), [rules, selectedRuleId]);

    const handleEdit = (rule: ReconciliationRule) => {
        setArchitectContextRule(rule);
        setIsArchitectOpen(true);
    };

    const handleNew = () => {
        setArchitectContextRule(null);
        setIsArchitectOpen(true);
    };

    const handleRunRule = (rule: ReconciliationRule) => {
        setPreviewTargetRule(rule);
        setIsPreviewOpen(true);
    };

    const onArchitectSave = (rule: ReconciliationRule, runImmediately?: boolean) => {
        onSaveRule(rule);
        if (runImmediately) {
            handleRunRule(rule);
        }
    };

    // Bulk Logic
    const toggleRuleSelection = (id: string) => {
        const next = new Set(selectedRuleIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRuleIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedRuleIds.size === filteredRules.length && filteredRules.length > 0) {
            setSelectedRuleIds(new Set());
        } else {
            setSelectedRuleIds(new Set(filteredRules.map(r => r.id)));
        }
    };

    const handleBulkDelete = () => {
        if (selectedRuleIds.size === 0) return;
        setIsBulkDeleteModalOpen(true);
    };

    const confirmBulkDelete = () => {
        selectedRuleIds.forEach(id => onDeleteRule(id));
        setSelectedRuleIds(new Set());
        setIsBulkDeleteModalOpen(false);
        setSelectedRuleId(null);
    };

    // Importer Template
    const downloadTemplate = () => {
        const headers = ["Rule Name", "Rule Category", "Match Field", "Operator", "Match Value", "Set Category", "Set Payee", "Set Merchant", "Set Location", "Set Type", "Set Direction", "Set User", "Tags", "Skip Import"];
        const rows = [
            ["Subscriptions", "description", "description", "contains", "NETFLIX", "Media", "", "", "", "Purchase", "expense", "Family", "Monthly", "FALSE"],
            ["Ignore Internal", "metadata", "description", "contains", "INTERNAL AD", "", "", "", "", "", "", "", "", "TRUE"]
        ];
        const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'finparser-rules-manifest.csv';
        a.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const results = await parseRulesFromFile(file);
        prepareDrafts(results);
    };

    const prepareDrafts = (raw: ReconciliationRule[]) => {
        const drafts: RuleImportDraft[] = raw.map(r => {
            const cat = categories.find(c => c.name.toLowerCase() === r.suggestedCategoryName?.toLowerCase());
            const pay = payees.find(p => p.name.toLowerCase() === r.suggestedPayeeName?.toLowerCase());
            const mer = merchants.find(m => m.name.toLowerCase() === r.suggestedMerchantName?.toLowerCase());
            const loc = locations.find(l => l.name.toLowerCase() === r.suggestedLocationName?.toLowerCase());
            const typ = transactionTypes.find(t => t.name.toLowerCase() === r.suggestedTypeName?.toLowerCase());

            return {
                ...r,
                isSelected: true,
                setCategoryId: cat?.id,
                setPayeeId: pay?.id,
                setMerchantId: mer?.id,
                setLocationId: loc?.id,
                setTransactionTypeId: typ?.id,
                mappingStatus: {
                    category: cat ? 'match' : (r.suggestedCategoryName ? 'create' : 'none'),
                    payee: pay ? 'match' : (r.suggestedPayeeName ? 'create' : 'none'),
                    merchant: mer ? 'match' : (r.suggestedMerchantName ? 'create' : 'none'),
                    location: loc ? 'match' : (r.suggestedLocationName ? 'create' : 'none'),
                    type: typ ? 'match' : (r.suggestedTypeName ? 'create' : 'none')
                }
            };
        });
        setImportDrafts(drafts);
    };

    const handleAiInspect = async () => {
        const input = aiFile || aiRawData;
        if (!input) return;
        setIsAiGenerating(true);
        try {
            const result = await generateRulesFromData(input, categories, payees, merchants, locations, users, aiPrompt);
            setAiProposedRules(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAiGenerating(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Rule Engine</h1>
                    <p className="text-slate-500 mt-1">Manage pattern matching logic and bulk automation.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsImporterOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl shadow-sm hover:bg-indigo-50 font-bold transition-all"><CloudArrowUpIcon className="w-5 h-5" /> Bulk Manifest</button>
                    <button onClick={() => setIsAiCreatorOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 font-bold transition-all"><SparklesIcon className="w-5 h-5" /> AI Discovery</button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: DOMAINS */}
                <div className="w-56 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 flex-shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Rule Category</p>
                    <div className="space-y-0.5">
                        {RULE_DOMAINS.map(domain => (
                            <button 
                                key={domain.id} 
                                onClick={() => { setSelectedDomain(domain.id); setSelectedRuleId(null); setSelectedRuleIds(new Set()); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedDomain === domain.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                {domain.icon}
                                <span>{domain.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: RULE LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 flex-shrink-0">
                    <div className="p-3 border-b border-slate-100 flex flex-col gap-2 bg-slate-50 rounded-t-2xl">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search rules..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm" 
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2"><SearchCircleIcon className="w-4 h-4 text-slate-300" /></div>
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={selectedRuleIds.size === filteredRules.length && filteredRules.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select All</span>
                            </label>
                            {selectedRuleIds.size > 0 && (
                                <button onClick={handleBulkDelete} className="text-red-600 p-1 hover:bg-red-50 rounded transition-colors flex items-center gap-1">
                                    <TrashIcon className="w-4 h-4" />
                                    <span className="text-[10px] font-black">{selectedRuleIds.size}</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredRules.length === 0 ? (
                            <div className="p-10 text-center text-slate-300 flex flex-col items-center">
                                <BoxIcon className="w-10 h-10 mb-2 opacity-10" /><p className="text-[11px] font-bold">No matching rules.</p>
                            </div>
                        ) : (
                            filteredRules.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => setSelectedRuleId(r.id)}
                                    className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center gap-3 group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={selectedRuleIds.has(r.id)} 
                                        onClick={(e) => { e.stopPropagation(); toggleRuleSelection(r.id); }}
                                        onChange={() => {}}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 cursor-pointer"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between items-center">
                                            <span className={`text-xs font-bold truncate ${selectedRuleId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</span>
                                            <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete rule?')) onDeleteRule(r.id); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{RULE_DOMAINS.find(d => d.id === r.ruleCategory)?.label || 'General'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 border-t bg-slate-50 rounded-b-2xl">
                        <button onClick={handleNew} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                            <AddIcon className="w-4 h-4" /> Add Rule
                        </button>
                    </div>
                </div>

                {/* RIGHT: PREVIEW/DETAIL */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    {activeRule ? (
                        <div className="flex-1 flex flex-col animate-fade-in">
                            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center shadow-lg"><ShieldCheckIcon className="w-8 h-8" /></div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800">{activeRule.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {RULE_DOMAINS.find(d => d.id === activeRule.ruleCategory)?.label || 'General'}
                                            </span>
                                            {activeRule.skipImport && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><SlashIcon className="w-2 h-2"/> Exclusion</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleRunRule(activeRule)} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 shadow-sm transition-all"><PlayIcon className="w-4 h-4" /> Dry Run</button>
                                    <button onClick={() => handleEdit(activeRule)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg transition-all"><EditIcon className="w-4 h-4" /> Edit Logic</button>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                                <section>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-600"/> Matching Logic</p>
                                    <div className="grid grid-cols-1 gap-3">
                                        {activeRule.conditions.map((c, i) => (
                                            <div key={c.id} className="flex items-center gap-4">
                                                <div className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase w-20">{c.field}</span>
                                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">{c.operator}</span>
                                                    <span className="text-sm font-bold text-slate-700">"{c.value}"</span>
                                                </div>
                                                {i < activeRule.conditions.length - 1 && <span className="text-[9px] font-black text-indigo-400 bg-white px-2 py-1 border rounded-lg shadow-sm z-10">{c.nextLogic || 'AND'}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500"/> Resulting Transformations</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Direction', value: activeRule.setBalanceEffect },
                                            { label: 'Category', value: categories.find(c => c.id === activeRule.setCategoryId)?.name },
                                            { label: 'Type', value: transactionTypes.find(t => t.id === activeRule.setTransactionTypeId)?.name },
                                            { label: 'Payee', value: payees.find(p => p.id === activeRule.setPayeeId)?.name },
                                            { label: 'Merchant', value: merchants.find(m => m.id === activeRule.setMerchantId)?.name },
                                            { label: 'User', value: users.find(u => u.id === activeRule.setUserId)?.name },
                                        ].filter(x => x.value).map(x => (
                                            <div key={x.label} className="p-4 bg-white border-2 border-slate-100 rounded-2xl">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{x.label}</p>
                                                <p className="text-sm font-black text-slate-800">{x.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {activeRule.assignTagIds && activeRule.assignTagIds.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {activeRule.assignTagIds.map(tid => {
                                                const tag = tags.find(t => t.id === tid);
                                                return tag ? <span key={tid} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${tag.color}`}>{tag.name}</span> : null;
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <ShieldCheckIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Rule Center</h3>
                            <p className="text-slate-500 max-w-sm mt-4 font-medium">Architect deterministic logic to automate your financial classification. Select a rule or use bulk selection to manage your logic library.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SHARED ARCHITECT MODAL */}
            <RuleModal 
                isOpen={isArchitectOpen}
                onClose={() => { setIsArchitectOpen(false); setArchitectContextRule(null); }}
                onSaveRule={onArchitectSave}
                existingRule={architectContextRule}
                accounts={accounts}
                transactionTypes={transactionTypes}
                categories={categories}
                tags={tags}
                payees={payees}
                merchants={merchants}
                locations={locations}
                users={users}
                onSaveCategory={onSaveCategory}
                onSavePayee={onSavePayee}
                onSaveTag={onSaveTag}
                onAddTransactionType={onAddTransactionType}
            />

            {/* DRY RUN MODAL */}
            {isPreviewOpen && previewTargetRule && (
                <RulePreviewModal 
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    rule={previewTargetRule}
                    transactions={transactions}
                    accounts={accounts}
                    transactionTypes={transactionTypes}
                    categories={categories}
                    payees={payees}
                    onApply={(updatedTxs) => {
                        onUpdateTransactions(updatedTxs);
                        setIsPreviewOpen(false);
                    }}
                />
            )}

            {/* BULK DELETE CONFIRMATION MODAL */}
            {isBulkDeleteModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-red-100">
                                <ExclamationTriangleIcon className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Rule Purge Alert</h2>
                            <p className="text-slate-500 font-medium">You are about to delete <span className="text-red-600 font-black">{selectedRuleIds.size}</span> rule(s). This automation logic will be permanently removed.</p>
                        </div>

                        <div className="px-8 py-2">
                            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 max-h-48 overflow-y-auto custom-scrollbar">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">Targeted Rule Set</p>
                                <div className="space-y-2">
                                    {Array.from(selectedRuleIds).map(id => {
                                        const rule = rules.find(r => r.id === id);
                                        return (
                                            <div key={id} className="flex justify-between items-center text-sm font-bold text-slate-700">
                                                <span className="truncate">{rule?.name || 'Unknown Rule'}</span>
                                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">
                                                    {rule?.ruleCategory}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 flex flex-col gap-3">
                            <button 
                                onClick={confirmBulkDelete}
                                className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 shadow-xl shadow-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Execute Deletion
                            </button>
                            <button 
                                onClick={() => setIsBulkDeleteModalOpen(false)}
                                className="w-full py-3 bg-white border-2 border-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-colors"
                            >
                                Nevermind, Keep Them
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RULE IMPORTER OVERLAY */}
            {isImporterOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><CloudArrowUpIcon className="w-8 h-8" /></div>
                                <div><h2 className="text-2xl font-black text-slate-800">Rule Importer</h2><p className="text-sm text-slate-500 font-medium">Bulk ingest logic from CSV/Excel manifests.</p></div>
                            </div>
                            <button onClick={() => setIsImporterOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><CloseIcon className="w-8 h-8 text-slate-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-white flex flex-col min-h-0">
                            {importDrafts.length > 0 ? (
                                <RuleImportVerification drafts={importDrafts} onCancel={() => setImportDrafts([])} onFinalize={(final) => { onSaveRules(final); setImportDrafts([]); setIsImporterOpen(false); }} categories={categories} payees={payees} merchants={merchants} locations={locations} users={users} transactionTypes={transactionTypes} onSaveCategory={onSaveCategory} onSaveCategories={onSaveCategories} onSavePayee={onSavePayee} onSavePayees={onSavePayees} onSaveMerchant={onSaveMerchant} onSaveMerchants={onSaveMerchants} onSaveLocation={onSaveLocation} onSaveLocations={onSaveLocations} />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                <InfoIcon className="w-5 h-5 text-indigo-600" /> Usage Instructions
                                            </h3>
                                            <div className="prose prose-sm text-slate-600 leading-relaxed">
                                                <p>The Importer allows you to define massive logic sets in a spreadsheet and ingest them as functional rules.</p>
                                                <ul className="space-y-2 list-disc pl-5">
                                                    <li><strong>Step 1:</strong> Download the official <code>.csv</code> manifest template below.</li>
                                                    <li><strong>Step 2:</strong> Map your "Match Field" to a valid database key (e.g., <code>description</code>, <code>payeeId</code>).</li>
                                                    <li><strong>Step 3:</strong> Use the "Match Value" column to specify what triggers the rule. You can use <code>||</code> for multiple OR conditions.</li>
                                                    <li><strong>Step 4:</strong> Fill in enrichment columns. If a name doesn't exist in your system, FinParser will offer to create it during verification.</li>
                                                    <li><strong>Step 5:</strong> Drag the file here or paste the raw rows into the text area.</li>
                                                </ul>
                                            </div>
                                            <button onClick={downloadTemplate} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md mt-4"><DownloadIcon className="w-4 h-4" /> Download Manifest Template</button>
                                        </div>
                                        <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) parseRulesFromFile(f).then(prepareDrafts); }} className={`h-48 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all group ${isDragging ? 'bg-indigo-50 border-indigo-500 scale-[1.02]' : 'bg-slate-50 border-slate-200 hover:border-indigo-400'}`}>
                                            <CloudArrowUpIcon className={`w-12 h-12 mb-2 ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                            <input type="file" onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" id="rule-file" />
                                            <label htmlFor="rule-file" className="font-bold text-indigo-600 cursor-pointer hover:underline text-sm">Browse Logic Manifest</label>
                                        </div>
                                    </div>
                                    <div className="flex flex-col h-full space-y-4">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paste CSV Data</label>
                                            <div className="flex items-center gap-2">
                                                <RobotIcon className="w-4 h-4 text-indigo-600" />
                                                <span className="text-[10px] font-bold text-indigo-700">AI Healing Enabled</span>
                                            </div>
                                        </div>
                                        <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste rows from your manifest spreadsheet here..." className="flex-1 p-4 border-2 border-slate-100 rounded-3xl font-mono text-[10px] bg-slate-50 focus:bg-white transition-all outline-none resize-none" />
                                        <button onClick={() => prepareDrafts(parseRulesFromLines(importText.split('\n')))} disabled={!importText.trim()} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 disabled:opacity-30">Process & Verify Manifest</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI CREATOR DRAWER */}
            {isAiCreatorOpen && (
                <div className="bg-white border-2 border-indigo-100 rounded-[2rem] p-8 shadow-2xl animate-fade-in space-y-6">
                    <div className="flex justify-between items-start border-b pb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><RobotIcon className="w-8 h-8" /></div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">AI Pattern Discovery</h3>
                                <p className="text-sm text-slate-500 mt-1 font-medium">Discover complex automation logic by feeding Gemini raw transaction samples.</p>
                            </div>
                        </div>
                        <button onClick={() => setIsAiCreatorOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-8 h-8 text-slate-400" /></button>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <div className="prose prose-sm text-slate-600">
                                <p>Instead of manual logic, AI Discovery analyzes patterns in your data to suggest rules. <strong>Accepted rules will be added to your library.</strong></p>
                            </div>
                            
                            {!aiRawData && (
                                <div 
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) setAiFile(f); }}
                                    className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center transition-all group ${isDragging ? 'border-indigo-600 bg-indigo-50 shadow-inner scale-[1.02]' : 'border-slate-200 bg-slate-50 hover:border-indigo-400'}`}
                                >
                                    <CloudArrowUpIcon className={`w-12 h-12 mb-3 transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                    <input type="file" onChange={e => setAiFile(e.target.files?.[0] || null)} className="hidden" id="ai-file" />
                                    <label htmlFor="ai-file" className="text-sm font-bold text-indigo-600 cursor-pointer hover:underline">
                                        {aiFile ? aiFile.name : 'Drop sample data here or browse'}
                                    </label>
                                    <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-widest">CSV or statements supported</p>
                                </div>
                            )}

                            {!aiFile && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Paste Data Snippet</label>
                                    <textarea 
                                        value={aiRawData} 
                                        onChange={e => setAiRawData(e.target.value)} 
                                        placeholder="Paste a few rows of transactions here..."
                                        className="w-full h-40 p-4 border-2 border-slate-100 rounded-3xl text-[10px] font-mono bg-slate-50 focus:bg-white focus:border-indigo-500 transition-all resize-none"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Tuning Prompt (Optional)</label>
                                <textarea 
                                    value={aiPrompt} 
                                    onChange={e => setAiPrompt(e.target.value)} 
                                    placeholder="e.g. 'Categorize software subscriptions separately from hardware'"
                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl text-sm min-h-[80px] focus:border-indigo-500 outline-none shadow-sm"
                                />
                            </div>
                            <button 
                                onClick={handleAiInspect} 
                                disabled={(!aiFile && !aiRawData) || isAiGenerating}
                                className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-30 flex items-center justify-center gap-3 transition-all active:scale-95"
                            >
                                {isAiGenerating ? <div className="w-6 h-6 border-4 border-t-white/30 border-white rounded-full animate-spin" /> : <SparklesIcon className="w-6 h-6" />}
                                Start Cognitive Pattern Discovery
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-[2rem] border-2 border-slate-200 p-6 overflow-hidden flex flex-col min-h-[500px]">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex justify-between items-center px-2">
                                Proposed Logic Set
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{aiProposedRules.length} Suggested</span>
                            </h4>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                                {aiProposedRules.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                        <BoxIcon className="w-16 h-16 mb-4 opacity-10" />
                                        <p className="text-sm font-bold max-w-[200px] text-center">Results will appear here after analysis.</p>
                                    </div>
                                ) : (
                                    aiProposedRules.map(r => (
                                        <div key={r.id} className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-4 animate-fade-in group">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <h5 className="text-sm font-bold text-slate-800 truncate">{r.name}</h5>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{r.ruleCategory}</p>
                                                </div>
                                                <button onClick={() => { onSaveRule(r); setAiProposedRules(prev => prev.filter(p => p.id !== r.id)); }} className="flex-shrink-0 text-[10px] font-black bg-indigo-600 text-white px-4 py-1.5 rounded-lg uppercase hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95">Accept</button>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-[10px] text-slate-500 font-mono p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    {r.conditions.map((c, i) => (
                                                        <span key={c.id}>
                                                            IF <span className="text-indigo-600 font-bold">{c.field}</span> {c.operator} "{c.value}"
                                                            {i < r.conditions.length - 1 && <span className="text-indigo-300 mx-1">{c.nextLogic}</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {r.setCategoryId && <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-black uppercase">Category Assigned</span>}
                                                    {r.setPayeeId && <span className="text-[8px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-black uppercase">Payee Identified</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RulesPage;
