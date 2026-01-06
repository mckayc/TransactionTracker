
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location, User, RuleImportDraft } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, ChevronDownIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, CloudArrowUpIcon, InfoIcon, ShieldCheckIcon, TagIcon, WrenchIcon, UsersIcon, UserGroupIcon, DownloadIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import RuleBuilder from '../components/RuleBuilder';
import { generateRulesFromData, hasApiKey, healDataSnippet } from '../services/geminiService';
import { parseRulesFromFile, parseRulesFromLines } from '../services/csvParserService';
import RuleImportVerification from '../components/RuleImportVerification';

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
    rules, onSaveRule, onSaveRules, onDeleteRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSaveCategories, onSavePayee, onSavePayees, onSaveMerchant, onSaveMerchants, onSaveLocation, onSaveLocations, onSaveTag, onAddTransactionType 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);
    
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

    // Form State
    const [ruleName, setRuleName] = useState('');
    const [ruleCategory, setRuleCategory] = useState('General');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    
    const [actionCategoryId, setActionCategoryId] = useState('');
    const [actionPayeeId, setActionPayeeId] = useState('');
    const [actionMerchantId, setActionMerchantId] = useState('');
    const [actionLocationId, setActionLocationId] = useState('');
    const [actionUserId, setActionUserId] = useState('');
    const [actionTypeId, setActionTypeId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedDomain !== 'all') {
            list = list.filter(r => r.ruleCategory === selectedDomain || r.conditions.some((c: RuleCondition) => c.field === selectedDomain));
        }
        return list.sort((a, b) => (a.priority || 0) - (b.priority || 0) || a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedDomain]);

    const handleSelectRule = (id: string) => {
        const r = rules.find(x => x.id === id);
        if (!r) return;
        setSelectedRuleId(id);
        setIsCreating(false);
        setRuleName(r.name);
        setRuleCategory(r.ruleCategory || 'General');
        setConditions(r.conditions);
        setActionCategoryId(r.setCategoryId || '');
        setActionPayeeId(r.setPayeeId || '');
        setActionMerchantId(r.setMerchantId || '');
        setActionLocationId(r.setLocationId || '');
        setActionUserId(r.setUserId || '');
        setActionTypeId(r.setTransactionTypeId || '');
        setAssignTagIds(new Set(r.assignTagIds || []));
        setSkipImport(!!r.skipImport);
    };

    const handleNew = () => {
        setSelectedRuleId(null);
        setIsCreating(true);
        setRuleName('');
        setRuleCategory('General');
        setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
        setActionCategoryId('');
        setActionPayeeId('');
        setActionMerchantId('');
        setActionLocationId('');
        setActionUserId('');
        setActionTypeId('');
        setAssignTagIds(new Set());
        setSkipImport(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const rule: ReconciliationRule = {
            id: selectedRuleId || generateUUID(),
            name: ruleName.trim(),
            ruleCategory,
            conditions,
            setCategoryId: actionCategoryId || undefined,
            setPayeeId: actionPayeeId || undefined,
            setMerchantId: actionMerchantId || undefined,
            setLocationId: actionLocationId || undefined,
            setUserId: actionUserId || undefined,
            setTransactionTypeId: actionTypeId || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport
        };
        onSaveRule(rule);
        setIsCreating(false);
        setSelectedRuleId(rule.id);
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

    // Importer Logic
    const downloadTemplate = () => {
        const headers = ["Rule Name", "Rule Category", "Match Field", "Operator", "Match Value", "Set Category", "Set Payee", "Set Merchant", "Set Location", "Set Type", "Tags", "Skip Import"];
        const example = ["Example Rule", "General", "description", "contains", "Starbucks", "Dining", "Starbucks", "Starbucks", "Main St", "Purchase", "Food;Coffee", "FALSE"];
        const csvContent = [headers.join(','), example.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'finparser-rules-template.csv';
        a.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const results = await parseRulesFromFile(file);
        prepareDrafts(results);
    };

    const handlePasteImport = async () => {
        if (!importText.trim()) return;
        let rulesToImport: ReconciliationRule[] = [];
        
        if (hasApiKey() && (importText.length < 50 || !importText.includes(','))) {
            setIsHealing(true);
            try {
                const healed = await healDataSnippet(importText);
                if (Array.isArray(healed)) rulesToImport = healed;
                else if (healed.rules) rulesToImport = healed.rules;
            } catch (e) {
                console.warn("AI healing failed, falling back to line parse.");
            } finally { setIsHealing(false); }
        }

        if (rulesToImport.length === 0) {
            rulesToImport = parseRulesFromLines(importText.split('\n'));
        }
        prepareDrafts(rulesToImport);
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

    const handleFinalizeImport = (finalRules: ReconciliationRule[]) => {
        // Correctly use bulk save to prevent race condition
        onSaveRules(finalRules);
        setImportDrafts([]);
        setIsImporterOpen(false);
        setImportText('');
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Rule Engine</h1>
                    <p className="text-slate-500 mt-1">Normalize data using deterministic logic and intelligent pattern matching.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsImporterOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl shadow-sm hover:bg-indigo-50 font-bold transition-all"
                    >
                        <CloudArrowUpIcon className="w-5 h-5" /> Rule Importer
                    </button>
                    <button 
                        onClick={() => setIsAiCreatorOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 font-bold transition-all"
                    >
                        <SparklesIcon className="w-5 h-5" /> AI Rule Discovery
                    </button>
                </div>
            </div>

            {/* RULE IMPORTER OVERLAY */}
            {isImporterOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><CloudArrowUpIcon className="w-8 h-8" /></div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">Rule Importer</h2>
                                    <p className="text-sm text-slate-500 font-medium">Bulk ingest logic from CSV, Excel, or formatted text.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsImporterOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><CloseIcon className="w-8 h-8 text-slate-400"/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-white flex flex-col min-h-0">
                            {importDrafts.length > 0 ? (
                                <RuleImportVerification 
                                    drafts={importDrafts} 
                                    onCancel={() => setImportDrafts([])} 
                                    onFinalize={handleFinalizeImport}
                                    categories={categories}
                                    payees={payees}
                                    merchants={merchants}
                                    locations={locations}
                                    users={users}
                                    transactionTypes={transactionTypes}
                                    onSaveCategory={onSaveCategory}
                                    onSaveCategories={onSaveCategories}
                                    onSavePayee={onSavePayee}
                                    onSavePayees={onSavePayees}
                                    onSaveMerchant={onSaveMerchant}
                                    onSaveMerchants={onSaveMerchants}
                                    onSaveLocation={onSaveLocation}
                                    onSaveLocations={onSaveLocations}
                                />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                <InfoIcon className="w-5 h-5 text-indigo-600" /> Instructions
                                            </h3>
                                            <div className="prose prose-sm text-slate-600">
                                                <p>Bulk import allows you to define dozens of rules in a single spreadsheet. Our engine will intelligently map your text to existing entities or create them automatically.</p>
                                                <ul className="space-y-2">
                                                    <li><strong>Step 1:</strong> Download the CSV Template to see required columns.</li>
                                                    <li><strong>Step 2:</strong> Fill in your patterns (e.g. "contains", "equals").</li>
                                                    <li><strong>Step 3:</strong> Upload or paste the data. AI can help format messy text.</li>
                                                </ul>
                                            </div>
                                            <button onClick={downloadTemplate} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md">
                                                <DownloadIcon className="w-4 h-4" /> Download Manifest Template
                                            </button>
                                        </div>

                                        <div 
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) parseRulesFromFile(f).then(prepareDrafts); }}
                                            className={`h-48 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all group ${isDragging ? 'bg-indigo-50 border-indigo-500 scale-[1.02]' : 'bg-slate-50 border-slate-200 hover:border-indigo-400'}`}
                                        >
                                            <CloudArrowUpIcon className={`w-12 h-12 mb-2 ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                            <input type="file" onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" id="import-file" />
                                            <label htmlFor="import-file" className="font-bold text-indigo-600 cursor-pointer hover:underline text-sm">Drop file here or browse</label>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">CSV, Excel supported</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col h-full space-y-4">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paste Manifest Data</label>
                                            <div className="flex items-center gap-2">
                                                <RobotIcon className="w-4 h-4 text-indigo-600" />
                                                <span className="text-[10px] font-bold text-indigo-700">AI Repair Enabled</span>
                                            </div>
                                        </div>
                                        <textarea 
                                            value={importText}
                                            onChange={e => setImportText(e.target.value)}
                                            placeholder="Paste rows from Excel or a messy list..."
                                            className="flex-1 p-4 border-2 border-slate-100 rounded-3xl font-mono text-[10px] bg-slate-50 focus:bg-white focus:border-indigo-500 transition-all outline-none resize-none"
                                        />
                                        <button 
                                            onClick={handlePasteImport}
                                            disabled={!importText.trim() || isHealing}
                                            className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 disabled:opacity-30 flex items-center justify-center gap-2"
                                        >
                                            {isHealing ? <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                                            Process & Verify Logic
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                            <p className="text-sm text-slate-600 font-medium">Analyze a data sample to discover patterns. This tool suggests rules but doesn't commit them until you click "Accept".</p>
                            
                            {!aiRawData && (
                                <div 
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) setAiFile(f); }}
                                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all group ${isDragging ? 'border-indigo-600 bg-indigo-50 shadow-inner scale-[1.02]' : 'border-slate-200 bg-slate-50 hover:border-indigo-400'}`}
                                >
                                    <CloudArrowUpIcon className={`w-10 h-10 mb-2 transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                    <input type="file" onChange={e => setAiFile(e.target.files?.[0] || null)} className="hidden" id="ai-file" />
                                    <label htmlFor="ai-file" className="text-xs font-bold text-indigo-600 cursor-pointer hover:underline">
                                        {aiFile ? aiFile.name : 'Drop file here or browse'}
                                    </label>
                                </div>
                            )}

                            {!aiFile && (
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Paste Data Sample</label>
                                    <textarea 
                                        value={aiRawData} 
                                        onChange={e => setAiRawData(e.target.value)} 
                                        placeholder="Paste CSV rows here..."
                                        className="w-full h-32 p-3 border rounded-xl text-[10px] font-mono bg-slate-50 focus:bg-white transition-all resize-none"
                                    />
                                </div>
                            )}

                            <textarea 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)} 
                                placeholder="Special instructions for AI discovery..."
                                className="w-full p-3 border rounded-xl text-sm min-h-[60px]"
                            />
                            <button 
                                onClick={handleAiInspect} 
                                disabled={(!aiFile && !aiRawData) || isAiGenerating}
                                className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black disabled:opacity-30 flex items-center justify-center gap-2"
                            >
                                {isAiGenerating ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                Start Pattern Discovery
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 overflow-y-auto max-h-[450px] custom-scrollbar">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Proposed Rules ({aiProposedRules.length})</h4>
                            {aiProposedRules.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <BoxIcon className="w-10 h-10 mb-2 opacity-20" />
                                    <p className="text-sm font-bold">No suggestions yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {aiProposedRules.map(r => (
                                        <div key={r.id} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm space-y-3 animate-fade-in">
                                            <div className="flex justify-between items-start">
                                                <h5 className="text-sm font-bold text-slate-800">{r.name}</h5>
                                                <button onClick={() => { onSaveRule(r); setAiProposedRules(prev => prev.filter(p => p.id !== r.id)); }} className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded uppercase hover:bg-indigo-700">Accept</button>
                                            </div>
                                            <div className="text-[10px] text-slate-500 space-y-1 font-mono p-2 bg-slate-50 rounded">
                                                If {r.conditions[0].field} {r.conditions[0].operator} "{r.conditions[0].value}"
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
                {/* LEFT: CATEGORIES */}
                <div className="w-56 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 flex-shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Category Logic</p>
                    <div className="space-y-0.5">
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

                {/* MIDDLE: RULE LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 flex-shrink-0">
                    <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search rules..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:bg-white outline-none" 
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2"><SearchCircleIcon className="w-4 h-4 text-slate-300" /></div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredRules.length === 0 ? (
                            <div className="p-10 text-center text-slate-300 flex flex-col items-center">
                                <BoxIcon className="w-10 h-10 mb-2 opacity-10" />
                                <p className="text-[11px] font-bold">No matching rules.</p>
                            </div>
                        ) : (
                            filteredRules.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => handleSelectRule(r.id)}
                                    className={`p-3 rounded-xl cursor-pointer border transition-all flex flex-col gap-1 group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold truncate ${selectedRuleId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{r.ruleCategory || 'Uncategorized'}</p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 border-t bg-slate-50 rounded-b-2xl">
                        <button onClick={handleNew} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                            <AddIcon className="w-4 h-4" /> Create Deterministic Rule
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
                                        <h3 className="text-xl font-black text-slate-800">{isCreating ? 'Architect New Logic' : 'Refine Automation'}</h3>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">v0.6 Deterministic Logic Controller</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 uppercase text-[10px] tracking-widest">Save Rule</button>
                                    <button type="button" onClick={() => { setSelectedRuleId(null); setIsCreating(false); }} className="p-2 rounded-full hover:bg-slate-200"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> Identity
                                        </div>
                                        <input 
                                            type="text" 
                                            value={ruleName} 
                                            onChange={e => setRuleName(e.target.value)} 
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-lg" 
                                            placeholder="Friendly label for this rule..."
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Rule Category
                                        </div>
                                        <input 
                                            type="text"
                                            value={ruleCategory}
                                            onChange={e => setRuleCategory(e.target.value)}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-sm"
                                            placeholder="e.g. Subscriptions"
                                        />
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> Logic Constraints
                                        </div>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-tight">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Enrichments
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Map Category</label>
                                            <select value={actionCategoryId} onChange={e => setActionCategoryId(e.target.value)} className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold bg-white focus:border-indigo-500 text-xs">
                                                <option value="">-- No Change --</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Associate Merchant</label>
                                            <select value={actionMerchantId} onChange={e => setActionMerchantId(e.target.value)} className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white focus:border-indigo-500 text-xs">
                                                <option value="">-- No Change --</option>
                                                {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign User</label>
                                            <select value={actionUserId} onChange={e => setActionUserId(e.target.value)} className="w-full p-2.5 border-2 border-slate-100 rounded-xl font-bold text-slate-700 bg-white focus:border-indigo-500 text-xs">
                                                <option value="">-- No Change --</option>
                                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-3 bg-red-50 p-3 rounded-2xl border border-red-100">
                                            <input type="checkbox" checked={skipImport} onChange={e => setSkipImport(e.target.checked)} className="w-5 h-5 rounded text-red-600 focus:ring-red-500" />
                                            <div>
                                                <label className="text-xs font-black text-red-800 uppercase block">Skip Import</label>
                                                <p className="text-[10px] text-red-600 font-medium">Auto-ignore matching data.</p>
                                            </div>
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
                            <h3 className="text-2xl font-black text-slate-800">Rule Center</h3>
                            <p className="text-slate-500 max-w-sm mt-4 font-medium">Create deterministic rules to automate your financial classification. Use the Rule Importer for bulk migration.</p>
                            <div className="flex gap-4 mt-8">
                                <button onClick={handleNew} className="px-10 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-black shadow-lg transition-all">New Rule</button>
                                <button onClick={() => setIsImporterOpen(true)} className="px-10 py-3 bg-white border-2 border-indigo-600 text-indigo-600 font-black rounded-2xl hover:bg-indigo-50 transition-all">Bulk Import</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RulesPage;
