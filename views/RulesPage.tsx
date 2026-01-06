
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location, User, SystemSettings } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, ChevronDownIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, CloudArrowUpIcon, InfoIcon, ShieldCheckIcon, TagIcon, WrenchIcon, UsersIcon, UserGroupIcon, LightBulbIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import RuleBuilder from '../components/RuleBuilder';
import RulePreviewModal from '../components/RulePreviewModal';
import { generateRulesFromData, hasApiKey } from '../services/geminiService';

interface RulesPageProps {
    rules: ReconciliationRule[];
    onSaveRule: (rule: ReconciliationRule) => void;
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
    onSavePayee: (payee: Payee) => void;
    onSaveMerchant: (merchant: Merchant) => void;
    onSaveLocation: (location: Location) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
    systemSettings?: SystemSettings;
}

const RULE_DOMAINS = [
    { id: 'all', label: 'All Logic Scopes', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'payeeId', label: 'Payees', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'merchantId', label: 'Merchants', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'locationId', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
    { id: 'userId', label: 'Users', icon: <UserGroupIcon className="w-4 h-4" /> },
    { id: 'tagIds', label: 'Taxonomy (Tags)', icon: <TagIcon className="w-4 h-4" /> },
    { id: 'metadata', label: 'Extraction Hints', icon: <RobotIcon className="w-4 h-4" /> },
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onDeleteRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSavePayee, onSaveMerchant, onSaveLocation, onSaveTag, onAddTransactionType, systemSettings 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);
    
    // Play/Preview state
    const [previewRule, setPreviewRule] = useState<ReconciliationRule | null>(null);

    // AI Creator State
    const [aiFile, setAiFile] = useState<File | null>(null);
    const [aiRawData, setAiRawData] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiProposedRules, setAiProposedRules] = useState<ReconciliationRule[]>([]);

    // Form State
    const [ruleName, setRuleName] = useState('');
    const [ruleScope, setRuleScope] = useState('description');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [actionCategoryId, setActionCategoryId] = useState('');
    const [actionPayeeId, setActionPayeeId] = useState('');
    const [actionMerchantId, setActionMerchantId] = useState('');
    const [actionLocationId, setActionLocationId] = useState('');
    const [actionUserId, setActionUserId] = useState('');
    const [actionTypeId, setActionTypeId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    // Proposed Names (Tracking AI suggestions for UI badges)
    const [proposedNames, setProposedNames] = useState<{cat?: string; payee?: string; merc?: string; loc?: string}>({});

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedDomain !== 'all') {
            list = list.filter(r => r.scope === selectedDomain);
        }
        return list.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    }, [rules, searchTerm, selectedDomain]);

    const handleSelectRule = (id: string) => {
        const r = rules.find(x => x.id === id);
        if (!r) return;
        setSelectedRuleId(id);
        setIsCreating(false);
        setRuleName(r.name);
        setRuleScope(r.scope || 'description');
        setConditions(r.conditions);
        setActionCategoryId(r.setCategoryId || '');
        setActionPayeeId(r.setPayeeId || '');
        setActionMerchantId(r.setMerchantId || '');
        setActionLocationId(r.setLocationId || '');
        setActionUserId(r.setUserId || '');
        setActionTypeId(r.setTransactionTypeId || '');
        setAssignTagIds(new Set(r.assignTagIds || []));
        setSkipImport(!!r.skipImport);
        setProposedNames({});
    };

    const handleNew = () => {
        setSelectedRuleId(null);
        setIsCreating(true);
        setRuleName('');
        setRuleScope('description');
        setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
        setActionCategoryId('');
        setActionPayeeId('');
        setActionMerchantId('');
        setActionLocationId('');
        setActionUserId('');
        setActionTypeId('');
        setAssignTagIds(new Set());
        setSkipImport(false);
        setProposedNames({});
    };

    const handleEditProposed = (proposed: ReconciliationRule) => {
        setIsCreating(true);
        setSelectedRuleId(null);
        
        setRuleName(proposed.name);
        // Correctly set Logic Scope based on AI suggestion
        setRuleScope(proposed.scope || 'description');
        setConditions(proposed.conditions);
        
        // Track proposed names for visual badges
        setProposedNames({
            cat: proposed.suggestedCategoryName,
            payee: proposed.suggestedPayeeName,
            merc: proposed.suggestedMerchantName,
            loc: proposed.suggestedLocationName
        });

        // Hydrate selects if match exists, otherwise they stay empty (showing 'New' badge)
        let finalCatId = proposed.setCategoryId || '';
        if (!finalCatId && proposed.suggestedCategoryName) {
            const match = categories.find(c => c.name.toLowerCase() === proposed.suggestedCategoryName?.toLowerCase());
            if (match) finalCatId = match.id;
        }
        
        let finalPayeeId = proposed.setPayeeId || '';
        if (!finalPayeeId && proposed.suggestedPayeeName) {
            const match = payees.find(p => p.name.toLowerCase() === proposed.suggestedPayeeName?.toLowerCase());
            if (match) finalPayeeId = match.id;
        }

        let finalMerchantId = proposed.setMerchantId || '';
        if (!finalMerchantId && proposed.suggestedMerchantName) {
            const match = merchants.find(m => m.name.toLowerCase() === proposed.suggestedMerchantName?.toLowerCase());
            if (match) finalMerchantId = match.id;
        }

        let finalLocationId = proposed.setLocationId || '';
        if (!finalLocationId && proposed.suggestedLocationName) {
            const match = locations.find(l => l.name.toLowerCase() === proposed.suggestedLocationName?.toLowerCase());
            if (match) finalLocationId = match.id;
        }

        setActionCategoryId(finalCatId);
        setActionPayeeId(finalPayeeId);
        setActionMerchantId(finalMerchantId);
        setActionLocationId(finalLocationId);
        setActionUserId(proposed.setUserId || '');
        setActionTypeId(proposed.setTransactionTypeId || '');
        setAssignTagIds(new Set(proposed.assignTagIds || []));
        setSkipImport(!!proposed.skipImport);
    };

    const handleCancelEdit = () => {
        setSelectedRuleId(null);
        setIsCreating(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Handle logic for auto-creating entities if they were proposed but not matched
        let finalCatId = actionCategoryId;
        if (!finalCatId && proposedNames.cat) {
            const cat = { id: generateUUID(), name: proposedNames.cat };
            onSaveCategory(cat);
            finalCatId = cat.id;
        }

        let finalPayeeId = actionPayeeId;
        if (!finalPayeeId && proposedNames.payee) {
            const p = { id: generateUUID(), name: proposedNames.payee };
            onSavePayee(p);
            finalPayeeId = p.id;
        }

        let finalMerchantId = actionMerchantId;
        if (!finalMerchantId && proposedNames.merc) {
            const m = { id: generateUUID(), name: proposedNames.merc };
            onSaveMerchant(m);
            finalMerchantId = m.id;
        }

        let finalLocationId = actionLocationId;
        if (!finalLocationId && proposedNames.loc) {
            const l = { id: generateUUID(), name: proposedNames.loc, city: proposedNames.loc.split(',')[0].trim(), state: proposedNames.loc.split(',')[1]?.trim() };
            onSaveLocation(l);
            finalLocationId = l.id;
        }

        const rule: ReconciliationRule = {
            id: selectedRuleId || generateUUID(),
            name: ruleName.trim(),
            scope: ruleScope,
            conditions,
            setCategoryId: finalCatId || undefined,
            setPayeeId: finalPayeeId || undefined,
            setMerchantId: finalMerchantId || undefined,
            setLocationId: finalLocationId || undefined,
            setUserId: actionUserId || undefined,
            setTransactionTypeId: actionTypeId || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport
        };
        
        onSaveRule(rule);
        setIsCreating(false);
        setSelectedRuleId(rule.id);
        setAiProposedRules(prev => prev.filter(p => p.name !== rule.name));
        alert(`Rule "${rule.name}" saved and added to engine.`);
    };

    const handleAiInspect = async () => {
        const input = aiFile || aiRawData;
        if (!input) return;
        setIsAiGenerating(true);
        try {
            const proposed = await generateRulesFromData(input, categories, payees, merchants, locations, users, aiPrompt, systemSettings);
            setAiProposedRules(proposed);
        } catch (e: any) {
            alert(e.message || "AI Analysis failed.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const acceptAiRule = (proposed: ReconciliationRule) => {
        let finalRule = { ...proposed, isAiDraft: false };

        if (proposed.suggestedCategoryName && !proposed.setCategoryId) {
            const existing = categories.find(c => c.name.toLowerCase() === proposed.suggestedCategoryName?.toLowerCase());
            if (existing) finalRule.setCategoryId = existing.id;
            else {
                const cat = { id: generateUUID(), name: proposed.suggestedCategoryName };
                onSaveCategory(cat);
                finalRule.setCategoryId = cat.id;
            }
        }

        if (proposed.suggestedPayeeName && !proposed.setPayeeId) {
            const existing = payees.find(p => p.name.toLowerCase() === proposed.suggestedPayeeName?.toLowerCase());
            if (existing) finalRule.setPayeeId = existing.id;
            else {
                const p = { id: generateUUID(), name: proposed.suggestedPayeeName };
                onSavePayee(p);
                finalRule.setPayeeId = p.id;
            }
        }

        if (proposed.suggestedMerchantName && !proposed.setMerchantId) {
            const existing = merchants.find(m => m.name.toLowerCase() === proposed.suggestedMerchantName?.toLowerCase());
            if (existing) finalRule.setMerchantId = existing.id;
            else {
                const m = { id: generateUUID(), name: proposed.suggestedMerchantName };
                onSaveMerchant(m);
                finalRule.setMerchantId = m.id;
            }
        }

        if (proposed.suggestedLocationName && !proposed.setLocationId) {
            const existing = locations.find(l => l.name.toLowerCase() === proposed.suggestedLocationName?.toLowerCase());
            if (existing) finalRule.setLocationId = existing.id;
            else {
                const l = { id: generateUUID(), name: proposed.suggestedLocationName };
                onSaveLocation(l);
                finalRule.setLocationId = l.id;
            }
        }

        onSaveRule(finalRule);
        setAiProposedRules(prev => prev.filter(p => p.id !== proposed.id));
    };

    const handleRunRuleManual = (e: React.MouseEvent, rule: ReconciliationRule) => {
        e.stopPropagation();
        setPreviewRule(rule);
    };

    const handleApplyPreview = (updates: Transaction[]) => {
        onUpdateTransactions(updates);
        setPreviewRule(null);
        alert(`Successfully updated ${updates.length} records.`);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Rule Engine</h1>
                    <p className="text-slate-500 mt-1">Intelligent data normalization and logic mapping.</p>
                </div>
                <button 
                    onClick={() => setIsAiCreatorOpen(!isAiCreatorOpen)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg font-bold transition-all ${isAiCreatorOpen ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                    <SparklesIcon className="w-5 h-5" /> {isAiCreatorOpen ? 'Close AI Forge' : 'AI Rule Creator'}
                </button>
            </div>

            {isAiCreatorOpen && !isCreating && (
                <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-xl animate-fade-in space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <div className="flex items-center gap-3"><RobotIcon className="w-6 h-6 text-indigo-600" /><h3 className="text-xl font-bold text-slate-800">AI Rule Forge</h3></div>
                        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                            <LightBulbIcon className="w-4 h-4" />
                            <span className="text-xs font-bold">Pro-tip: Ask for specific targets like "Only find locations" for better precision.</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Prompt Engineering Guide</h4>
                                <ul className="text-xs text-slate-600 space-y-1.5">
                                    <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" /> <strong>"Extract Locations":</strong> standardizes cities to "City, ST".</li>
                                    <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" /> <strong>"Categorize only":</strong> skips merchant/location creation.</li>
                                    <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" /> <strong>"Clean Merchants":</strong> finds the brand keyword from bank text.</li>
                                </ul>
                            </div>
                            {!aiRawData && (
                                <div 
                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setAiFile(f); }}
                                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
                                >
                                    <input type="file" onChange={e => setAiFile(e.target.files?.[0] || null)} className="hidden" id="ai-file" />
                                    <label htmlFor="ai-file" className="text-xs font-bold text-indigo-600 cursor-pointer">{aiFile ? aiFile.name : 'Drop file here or Select'}</label>
                                </div>
                            )}
                            {!aiFile && <textarea value={aiRawData} onChange={e => setAiRawData(e.target.value)} placeholder="Paste CSV rows here..." className="w-full h-32 p-3 border rounded-xl text-[10px] font-mono bg-slate-50" />}
                            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Specific instructions (e.g. 'Find categories only')..." className="w-full p-3 border rounded-xl text-sm min-h-[60px] focus:ring-1 focus:ring-indigo-500 outline-none" />
                            <button onClick={handleAiInspect} disabled={(!aiFile && !aiRawData) || isAiGenerating} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black disabled:opacity-30 flex items-center justify-center gap-2">
                                {isAiGenerating ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                Forge Proposed Rules
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 overflow-y-auto max-h-[500px] custom-scrollbar">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Proposed Rules ({aiProposedRules.length})</h4>
                            {aiProposedRules.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300"><TableIcon className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm font-bold">No suggestions yet.</p></div>
                            ) : (
                                <div className="space-y-3">
                                    {aiProposedRules.map((r, idx) => {
                                        const needsCategory = r.suggestedCategoryName && !categories.some(c => c.name.toLowerCase() === r.suggestedCategoryName?.toLowerCase());
                                        const needsMerchant = r.suggestedMerchantName && !merchants.some(m => m.name.toLowerCase() === r.suggestedMerchantName?.toLowerCase());
                                        const needsPayee = r.suggestedPayeeName && !payees.some(p => p.name.toLowerCase() === r.suggestedPayeeName?.toLowerCase());
                                        const needsLocation = r.suggestedLocationName && !locations.some(l => l.name.toLowerCase() === r.suggestedLocationName?.toLowerCase());

                                        return (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm space-y-3 animate-fade-in group/card">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <div className="flex items-center gap-2">
                                                            <h5 className="text-sm font-bold text-slate-800 truncate">{r.name}</h5>
                                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black rounded uppercase">{r.scope}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {needsCategory && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-black rounded uppercase border border-purple-100">+ New Category</span>}
                                                            {needsMerchant && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[8px] font-black rounded uppercase border border-orange-100">+ New Merchant</span>}
                                                            {needsPayee && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black rounded uppercase border border-blue-100">+ New Payee</span>}
                                                            {needsLocation && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded uppercase border border-emerald-100">+ New Location</span>}
                                                            
                                                            {r.suggestedCategoryName && !needsCategory && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded uppercase border border-slate-200">Cat: {r.suggestedCategoryName}</span>}
                                                            {r.suggestedMerchantName && !needsMerchant && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded uppercase border border-slate-200">Merc: {r.suggestedMerchantName}</span>}
                                                            {r.suggestedLocationName && !needsLocation && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded uppercase border border-slate-200">Loc: {r.suggestedLocationName}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => handleEditProposed(r)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Refine Logic"><EditIcon className="w-4 h-4"/></button>
                                                        <button onClick={() => acceptAiRule(r)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Quick Accept"><CheckCircleIcon className="w-4 h-4"/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: SCOPES */}
                <div className="w-56 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 flex-shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Rule Scopes</p>
                    <div className="space-y-0.5">
                        {RULE_DOMAINS.map(domain => (
                            <button key={domain.id} onClick={() => setSelectedDomain(domain.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedDomain === domain.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {domain.icon}<span>{domain.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 flex-shrink-0">
                    <div className="p-3 border-b border-slate-100">
                        <div className="relative"><input type="text" placeholder="Search rules..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border rounded-xl text-xs font-medium focus:ring-0 focus:border-indigo-500" /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredRules.map(r => (
                            <div key={r.id} onClick={() => handleSelectRule(r.id)} className={`p-2 px-3 rounded-lg cursor-pointer border transition-all flex flex-col gap-0.5 group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                <div className="flex justify-between items-center"><span className="text-xs font-bold truncate">{r.name}</span>{r.isAiDraft && <SparklesIcon className="w-3 h-3 text-indigo-500" />}</div>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{r.scope}</p>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleRunRuleManual(e, r)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded" title="Run Rule Now"><PlayIcon className="w-3.5 h-3.5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); }} className="p-1 text-slate-300 hover:text-red-500 rounded" title="Delete"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t bg-slate-50 rounded-b-2xl"><button onClick={handleNew} className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-transform">New Rule</button></div>
                </div>

                {/* RIGHT: EDITOR */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    {(selectedRuleId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 animate-fade-in">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div><h3 className="text-xl font-black text-slate-800">Rule Architect</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Logic Design & Atomic Transforms</p></div>
                                <div className="flex gap-2">
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg uppercase text-[10px] active:scale-95 transition-transform">Save & Apply Rule</button>
                                    <button type="button" onClick={handleCancelEdit} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-white">
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="col-span-2 space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rule Name</label><input type="text" value={ruleName} onChange={e => setRuleName(e.target.value)} className="w-full p-4 border rounded-2xl font-bold focus:ring-0 focus:border-indigo-500 bg-slate-50/50" required /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Scope</label><select value={ruleScope} onChange={e => setRuleScope(e.target.value)} className="w-full p-4 border rounded-2xl font-bold bg-slate-50/50">{RULE_DOMAINS.filter(d => d.id !== 'all').map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
                                </div>
                                <div className="space-y-4">
                                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    Conditional Logic Tree 
                                    <span title="Drag and drop conditions to reorder or re-group.">
                                      <InfoIcon className="w-3.5 h-3.5" />
                                    </span>
                                  </h4>
                                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner"><RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} /></div>
                                </div>
                                <div className="space-y-6">
                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Atomic Transformations</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-1 relative">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Map Category</label>
                                            <select value={actionCategoryId} onChange={e => setActionCategoryId(e.target.value)} className={`w-full p-2.5 border rounded-xl font-bold bg-white text-xs ${proposedNames.cat && !actionCategoryId ? 'border-purple-400 ring-1 ring-purple-100' : ''}`}><option value="">-- No Change --</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                            {proposedNames.cat && !actionCategoryId && <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[7px] font-black px-1 rounded shadow">+ NEW</span>}
                                        </div>
                                        <div className="space-y-1 relative">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Payee</label>
                                            <select value={actionPayeeId} onChange={e => setActionPayeeId(e.target.value)} className={`w-full p-2.5 border rounded-xl font-bold bg-white text-xs ${proposedNames.payee && !actionPayeeId ? 'border-blue-400 ring-1 ring-blue-100' : ''}`}><option value="">-- No Change --</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                            {proposedNames.payee && !actionPayeeId && <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[7px] font-black px-1 rounded shadow">+ NEW</span>}
                                        </div>
                                        <div className="space-y-1 relative">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Merchant</label>
                                            <select value={actionMerchantId} onChange={e => setActionMerchantId(e.target.value)} className={`w-full p-2.5 border rounded-xl font-bold bg-white text-xs ${proposedNames.merc && !actionMerchantId ? 'border-orange-400 ring-1 ring-orange-100' : ''}`}><option value="">-- No Change --</option>{merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                                            {proposedNames.merc && !actionMerchantId && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[7px] font-black px-1 rounded shadow">+ NEW</span>}
                                        </div>
                                        <div className="space-y-1 relative">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pin Location</label>
                                            <select value={actionLocationId} onChange={e => setActionLocationId(e.target.value)} className={`w-full p-2.5 border rounded-xl font-bold bg-white text-xs ${proposedNames.loc && !actionLocationId ? 'border-emerald-400 ring-1 ring-emerald-100' : ''}`}><option value="">-- No Change --</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                                            {proposedNames.loc && !actionLocationId && <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[7px] font-black px-1 rounded shadow">+ NEW</span>}
                                        </div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign User</label><select value={actionUserId} onChange={e => setActionUserId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold bg-white text-xs"><option value="">-- No Change --</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                                        <div className="flex items-center gap-3 bg-red-50 p-3 rounded-2xl border border-red-100 self-end"><input type="checkbox" checked={skipImport} onChange={e => setSkipImport(e.target.checked)} className="w-5 h-5 rounded text-red-600 focus:ring-red-500" /><div><label className="text-xs font-black text-red-800 uppercase block">Suppress Record</label><p className="text-[10px] text-red-600">Auto-ignore matching imports.</p></div></div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8 animate-bounce-subtle"><ShieldCheckIcon className="w-12 h-12 text-indigo-200" /></div>
                            <h3 className="text-2xl font-black text-slate-800">Master Rule Engine</h3>
                            <p className="text-slate-500 max-w-sm mt-4 leading-relaxed font-medium">Select a rule to refine, or use the AI Rule Creator to automatically detect patterns like Merchant snippets or City/State locations from your statements.</p>
                        </div>
                    )}
                </div>
            </div>

            {previewRule && (
                <RulePreviewModal
                    isOpen={!!previewRule}
                    onClose={() => setPreviewRule(null)}
                    onApply={handleApplyPreview}
                    rule={previewRule}
                    transactions={transactions}
                    accounts={accounts}
                    transactionTypes={transactionTypes}
                    categories={categories}
                    payees={payees}
                />
            )}
        </div>
    );
};

export default RulesPage;
