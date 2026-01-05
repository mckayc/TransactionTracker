
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location } from '../types';
/* Added TagIcon and WrenchIcon to imports to fix component not found errors */
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, ChevronDownIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, CloudArrowUpIcon, InfoIcon, ShieldCheckIcon, TagIcon, WrenchIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import RuleBuilder from '../components/RuleBuilder';
import { api } from '../services/apiService';

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
    transactions: Transaction[];
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onSaveCategory: (category: Category) => void;
    onSavePayee: (payee: Payee) => void;
    onSaveMerchant: (merchant: Merchant) => void;
    onSaveLocation: (location: Location) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
}

const RULE_DOMAINS = [
    { id: 'all', label: 'All Logic Scopes', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'payeeId', label: 'Payees', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'merchantId', label: 'Merchants', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'locationId', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
    { id: 'tagIds', label: 'Taxonomy (Tags)', icon: <TagIcon className="w-4 h-4" /> },
    { id: 'metadata', label: 'Extraction Hints', icon: <RobotIcon className="w-4 h-4" /> },
    { id: 'ai-drafts', label: 'AI Proposed', icon: <SparklesIcon className="w-4 h-4 text-indigo-500" /> },
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onDeleteRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, transactions, onUpdateTransactions, onSaveCategory, onSavePayee, onSaveMerchant, onSaveLocation, onSaveTag, onAddTransactionType 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);

    // AI Creator State
    const [aiFile, setAiFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiProposedRules, setAiProposedRules] = useState<ReconciliationRule[]>([]);

    // Form State
    const [name, setName] = useState('');
    const [scope, setScope] = useState('description');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setMerchantId, setSetMerchantId] = useState('');
    const [setLocationId, setSetLocationId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setDescription, setSetDescription] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedDomain === 'ai-drafts') {
            list = list.filter(r => r.isAiDraft);
        } else if (selectedDomain !== 'all') {
            // Check explicit scope first, fallback to condition-based domain detection for legacy
            list = list.filter(r => r.scope === selectedDomain || (!r.scope && r.conditions.some(c => c.field === selectedDomain)));
        }
        return list.sort((a, b) => (a.priority || 0) - (b.priority || 0) || a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedDomain]);

    const handleSelectRule = (id: string) => {
        const r = rules.find(x => x.id === id);
        if (!r) return;
        setSelectedRuleId(id);
        setIsCreating(false);
        setName(r.name);
        setScope(r.scope || 'description');
        setConditions(r.conditions);
        setSetCategoryId(r.setCategoryId || '');
        setSetPayeeId(r.setPayeeId || '');
        setSetMerchantId(r.setMerchantId || '');
        setSetLocationId(r.setLocationId || '');
        setSetTransactionTypeId(r.setTransactionTypeId || '');
        setSetDescription(r.setDescription || '');
        setAssignTagIds(new Set(r.assignTagIds || []));
        setSkipImport(!!r.skipImport);
    };

    const handleNew = () => {
        setSelectedRuleId(null);
        setIsCreating(true);
        setName('');
        setScope(selectedDomain !== 'all' && selectedDomain !== 'ai-drafts' ? selectedDomain : 'description');
        setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
        setSetCategoryId('');
        setSetPayeeId('');
        setSetMerchantId('');
        setSetLocationId('');
        setSetTransactionTypeId('');
        setSetDescription('');
        setAssignTagIds(new Set());
        setSkipImport(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const rule: ReconciliationRule = {
            id: selectedRuleId || generateUUID(),
            name: name.trim(),
            scope,
            conditions,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setMerchantId: setMerchantId || undefined,
            setLocationId: setLocationId || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            setDescription: setDescription || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport
        };
        onSaveRule(rule);
        setIsCreating(false);
        setSelectedRuleId(rule.id);
    };

    const handleAiInspect = async () => {
        if (!aiFile) return;
        setIsAiGenerating(true);
        try {
            // Simulated AI call for the spec - in real app, we'd call Gemini here
            await new Promise(r => setTimeout(r, 2000));
            const proposed: ReconciliationRule[] = [
                {
                    id: generateUUID(),
                    name: "AI Proposed: Starbucks Normalization",
                    isAiDraft: true,
                    scope: 'description',
                    conditions: [{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: 'STARBUCKS', nextLogic: 'AND' }],
                    setDescription: "Starbucks Coffee",
                    setCategoryId: categories.find(c => c.name.toLowerCase().includes('dining'))?.id
                }
            ];
            setAiProposedRules(proposed);
        } catch (e) {
            alert("AI Inspection failed.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const acceptAiRule = (proposed: ReconciliationRule) => {
        onSaveRule({ ...proposed, isAiDraft: false });
        setAiProposedRules(prev => prev.filter(p => p.id !== proposed.id));
    };

    // Drag and Drop Logic
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.type === 'application/pdf' || file.name.endsWith('.csv'))) {
            setAiFile(file);
        } else {
            alert("Please upload a PDF or CSV file.");
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Rule Engine</h1>
                    <p className="text-slate-500 mt-1">High-performance parsing and data normalization logic.</p>
                </div>
                <button 
                    onClick={() => setIsAiCreatorOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 font-bold transition-all"
                >
                    <SparklesIcon className="w-5 h-5" /> AI Rule Creator
                </button>
            </div>

            {/* AI CREATOR DRAWER */}
            {isAiCreatorOpen && (
                <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-xl animate-fade-in space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <div className="flex items-center gap-3">
                            <RobotIcon className="w-6 h-6 text-indigo-600" />
                            <h3 className="text-xl font-bold text-slate-800">AI Rule Forge</h3>
                        </div>
                        <button onClick={() => setIsAiCreatorOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><CloseIcon className="w-6 h-6" /></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 font-medium">Upload a statement or document for the AI to analyze. It will suggest normalization and categorization rules based on your data patterns.</p>
                            <div 
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all group ${isDragging ? 'border-indigo-600 bg-indigo-50 shadow-inner scale-[1.02]' : 'border-slate-200 bg-slate-50 hover:border-indigo-400'}`}
                            >
                                <CloudArrowUpIcon className={`w-12 h-12 mb-2 transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                <input type="file" onChange={e => setAiFile(e.target.files?.[0] || null)} className="hidden" id="ai-file" />
                                <label htmlFor="ai-file" className="text-sm font-bold text-indigo-600 cursor-pointer hover:underline">
                                    {aiFile ? aiFile.name : (isDragging ? 'Release to Upload' : 'Drop file here or Select PDF/CSV')}
                                </label>
                            </div>
                            <textarea 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)} 
                                placeholder="Optional instructions (e.g., 'Look for subscriptions and tag them as Recurring')"
                                className="w-full p-3 border rounded-xl text-sm min-h-[80px]"
                            />
                            <button 
                                onClick={handleAiInspect} 
                                disabled={!aiFile || isAiGenerating}
                                className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black disabled:opacity-30 flex items-center justify-center gap-2"
                            >
                                {isAiGenerating ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                Inspect & Forge Rules
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 overflow-y-auto max-h-[350px] custom-scrollbar">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Proposed Logic</h4>
                            {aiProposedRules.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <TableIcon className="w-10 h-10 mb-2 opacity-20" />
                                    <p className="text-sm font-bold">No suggestions yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {aiProposedRules.map(r => (
                                        <div key={r.id} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <h5 className="text-sm font-bold text-slate-800">{r.name}</h5>
                                                <button onClick={() => acceptAiRule(r)} className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded uppercase hover:bg-indigo-700">Accept</button>
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded">
                                                If {r.conditions[0].field} {r.conditions[0].operator} "{r.conditions[0].value}"
                                                <br/>&rarr; Set Category: {categories.find(c => c.id === r.setCategoryId)?.name || 'Unchanged'}
                                            </div>
                                        </div>
                                    ))}
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
                            <button 
                                key={domain.id} 
                                onClick={() => setSelectedDomain(domain.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedDomain === domain.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                {domain.icon}
                                <span>{domain.label}</span>
                                {domain.id === 'ai-drafts' && rules.filter(r => r.isAiDraft).length > 0 && (
                                    <span className="ml-auto w-4 h-4 bg-indigo-600 text-white text-[8px] flex items-center justify-center rounded-full animate-pulse">
                                        {rules.filter(r => r.isAiDraft).length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: LIST (CONDENSED) */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 flex-shrink-0">
                    <div className="p-3 border-b border-slate-100">
                        <div className="relative group">
                            <input 
                                type="text" 
                                placeholder="Search rules..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all outline-none" 
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2"><SearchCircleIcon className="w-4 h-4 text-slate-300" /></div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredRules.length === 0 ? (
                            <div className="p-10 text-center text-slate-300 flex flex-col items-center">
                                <BoxIcon className="w-10 h-10 mb-2 opacity-10" />
                                <p className="text-[11px] font-bold">No rules found.</p>
                            </div>
                        ) : (
                            filteredRules.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => handleSelectRule(r.id)}
                                    className={`p-2 px-3 rounded-lg cursor-pointer border transition-all flex flex-col gap-0.5 group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold truncate ${selectedRuleId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</span>
                                        {r.isAiDraft && <SparklesIcon className="w-3 h-3 text-indigo-500" />}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight truncate pr-2">{r.scope || 'Unset'}</p>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); if(selectedRuleId === r.id) setSelectedRuleId(null); }} className="text-slate-300 hover:text-red-500"><DeleteIcon className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 border-t bg-slate-50 rounded-b-2xl">
                        <button onClick={handleNew} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                            <AddIcon className="w-4 h-4" /> New Rule
                        </button>
                    </div>
                </div>

                {/* RIGHT: EDITOR */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    {(selectedRuleId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <WrenchIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800">{isCreating ? 'Architect Rule' : 'Refine Rule'}</h3>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Precision Logical Scoping</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 uppercase text-[10px] tracking-widest">Commit Rule</button>
                                    <button type="button" onClick={() => { setSelectedRuleId(null); setIsCreating(false); }} className="p-2 rounded-full hover:bg-slate-200 text-slate-400"><CloseIcon className="w-6 h-6" /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> Logical Name
                                        </div>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-lg" 
                                            placeholder="Friendly label..."
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Rule Scope
                                        </div>
                                        <select 
                                            value={scope} 
                                            onChange={e => setScope(e.target.value)}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-sm"
                                        >
                                            {RULE_DOMAINS.filter(d => d.id !== 'all' && d.id !== 'ai-drafts').map(d => (
                                                <option key={d.id} value={d.id}>{d.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> Condition Tree
                                        </div>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Transformations
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Map Category</label>
                                            <select value={setCategoryId} onChange={e => setSetCategoryId(e.target.value)} className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold bg-white focus:border-indigo-500 outline-none text-xs">
                                                <option value="">-- No Change --</option>
                                                {categories.sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Payee</label>
                                            <select value={setPayeeId} onChange={e => setSetPayeeId(e.target.value)} className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white focus:border-indigo-500 outline-none text-xs">
                                                <option value="">-- No Change --</option>
                                                {payees.sort((a,b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Type</label>
                                            <select value={setTransactionTypeId} onChange={e => setSetTransactionTypeId(e.target.value)} className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white focus:border-indigo-500 outline-none text-xs">
                                                <option value="">-- No Change --</option>
                                                {transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Override String</label>
                                            <input type="text" value={setDescription} onChange={e => setSetDescription(e.target.value)} className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold focus:border-indigo-500 outline-none text-xs" placeholder="Custom label..." />
                                        </div>
                                        <div className="flex items-center gap-3 bg-red-50 p-3 rounded-2xl border border-red-100 mt-4 sm:mt-0">
                                            <input type="checkbox" checked={skipImport} onChange={e => setSkipImport(e.target.checked)} className="w-5 h-5 rounded text-red-600 focus:ring-red-500" />
                                            <div>
                                                <label className="text-xs font-black text-red-800 uppercase block">Suppress Record</label>
                                                <p className="text-[10px] text-red-600 font-medium">Auto-ignore matching imports.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Append Taxonomy Tags</label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                            {tags.map(tag => (
                                                <button 
                                                    key={tag.id} 
                                                    type="button" 
                                                    onClick={() => { const s = new Set(assignTagIds); if(s.has(tag.id)) s.delete(tag.id); else s.add(tag.id); setAssignTagIds(s); }}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border-2 ${assignTagIds.has(tag.id) ? tag.color + ' border-indigo-500 shadow-md ring-4 ring-indigo-50' : 'bg-white text-slate-400 border-slate-200 grayscale opacity-60'}`}
                                                >
                                                    {tag.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <ShieldCheckIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Master Rule Engine</h3>
                            <p className="text-slate-500 max-w-sm mt-4 font-medium">Select a rule to refine its logic, or start a new architectural pattern. Use the AI Rule Creator to automatically ingest logic from your documentation.</p>
                            <div className="flex gap-4 mt-8">
                                <button onClick={handleNew} className="px-10 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-black shadow-lg shadow-slate-200 transition-all hover:-translate-y-1">Create Rule</button>
                                <button onClick={() => setIsAiCreatorOpen(true)} className="px-10 py-3 bg-white border-2 border-indigo-600 text-indigo-600 font-black rounded-2xl hover:bg-indigo-50 transition-all">AI Forge</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RulesPage;
