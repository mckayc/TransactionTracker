
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Counterparty, Category, RuleCondition, Tag, Location, User, RuleImportDraft, RuleCategory, RuleForgePrompt, SystemSettings, ImportBatchStats } from '../types';
import { DeleteIcon, AddIcon, SearchCircleIcon, SparklesIcon, ShieldCheckIcon, TagIcon, TableIcon, BoxIcon, MapPinIcon, UserGroupIcon, CloudArrowUpIcon, TrashIcon, CloseIcon, FileCodeIcon, UploadIcon, DownloadIcon, InfoIcon, ExclamationTriangleIcon, EditIcon, ChevronRightIcon, FolderIcon, CheckCircleIcon, RobotIcon, PlayIcon, SaveIcon, RepeatIcon, ListIcon } from '../components/Icons';
import RuleModal from '../components/RuleModal';
import RuleImportVerification from '../components/RuleImportVerification';
import { parseRulesFromFile, parseRulesFromLines, generateRuleTemplate, validateRuleFormat } from '../services/csvParserService';
import { forgeRulesWithCustomPrompt } from '../services/geminiService';
import { generateUUID } from '../utils';
import ConfirmationModal from '../components/ConfirmationModal';

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
    ruleCategories: RuleCategory[];
    onSaveRuleCategory: (rc: RuleCategory) => void;
    onDeleteRuleCategory: (id: string) => void;
    systemSettings: SystemSettings;
    onUpdateSystemSettings: (s: SystemSettings) => void;
}

interface AppNotification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    description?: string;
}

const DEFAULT_FORGE_PROMPTS: RuleForgePrompt[] = [
    {
        id: 'forge-loc',
        name: 'Location Geography Protocol',
        prompt: 'Identify city and state patterns in the raw transaction descriptions. Generate rules that set the Location ID based on those patterns. Use "contains" operator. Only generate rules if a geographic location is likely.'
    },
    {
        id: 'forge-norm',
        name: 'Identity & Logic Normalizer',
        prompt: 'Generate comprehensive rules for clean Descriptions, logical Categories, Transaction Types, and Counterparties. Standardize vendor names (e.g., remove store numbers) and categorize accurately for tax purposes.'
    },
    {
        id: 'forge-subs',
        name: 'Subscription Hunter Protocol',
        prompt: 'Identify potential recurring monthly subscriptions or software services. Generate rules that assign them to a "Subscriptions" category and set appropriate recurring tags.'
    },
    {
        id: 'forge-audit',
        name: 'High-Value Integrity Audit',
        prompt: 'Identify transactions exceeding $500 or unusual patterns. Create rules that assign "Review Required" or "Capital Expenditure" tags to these records.'
    }
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onSaveRules, onDeleteRule, accounts, transactionTypes, categories, tags, counterparties, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, onSaveTag, onAddTransactionType, onSaveUser,
    ruleCategories, onSaveRuleCategory, onDeleteRuleCategory, systemSettings, onUpdateSystemSettings
}) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    
    // UI State
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [newCatName, setNewCatName] = useState('');
    const [ruleToDeleteId, setRuleToDeleteId] = useState<string | null>(null);

    // Fullscreen View State
    const [isImportHubOpen, setIsImportHubOpen] = useState(false);

    // Notification State
    const [notification, setNotification] = useState<AppNotification | null>(null);

    // Import Flow State
    const [importMethod, setImportMethod] = useState<'upload' | 'paste' | 'ai'>('upload');
    const [pastedRules, setPastedRules] = useState('');
    const [importDrafts, setImportDrafts] = useState<RuleImportDraft[]>([]);
    const [isVerifyingImport, setIsVerifyingImport] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [batchStats, setBatchStats] = useState<ImportBatchStats | null>(null);
    
    // AI Forge State
    const forgePrompts = useMemo(() => {
        return systemSettings.ruleForgePrompts && systemSettings.ruleForgePrompts.length > 0
            ? systemSettings.ruleForgePrompts
            : DEFAULT_FORGE_PROMPTS;
    }, [systemSettings.ruleForgePrompts]);

    const [selectedForgePromptId, setSelectedForgePromptId] = useState<string>(DEFAULT_FORGE_PROMPTS[1].id);
    const [forgePromptText, setForgePromptText] = useState<string>(DEFAULT_FORGE_PROMPTS[1].prompt);
    const [forgeData, setForgeData] = useState<string>('');
    const [isForging, setIsForging] = useState(false);
    const [forgeProgress, setForgeProgress] = useState<string>('');
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [isNewPromptModalOpen, setIsNewPromptModalOpen] = useState(false);
    const [newPromptName, setNewPromptName] = useState('');

    const notify = (type: AppNotification['type'], message: string, description?: string) => {
        const id = generateUUID();
        setNotification({ id, type, message, description });
        setTimeout(() => setNotification(prev => prev?.id === id ? null : prev), 5000);
    };

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedCategoryId !== 'all') {
            list = list.filter(r => r.ruleCategoryId === selectedCategoryId);
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedCategoryId]);

    const activeRule = useMemo(() => rules.find(r => r.id === selectedRuleId), [rules, selectedRuleId]);

    const handleBulkDelete = () => {
        bulkSelectedIds.forEach(id => onDeleteRule(id));
        setBulkSelectedIds(new Set());
        setSelectedRuleId(null);
        notify('success', 'Rules Purged', `${bulkSelectedIds.size} logical records removed.`);
    };

    const toggleSelectAll = () => {
        if (bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0) {
            setBulkSelectedIds(new Set());
        } else {
            setBulkSelectedIds(new Set(filteredRules.map(r => r.id)));
        }
    };

    const processDrafts = (rawRules: ReconciliationRule[]) => {
        const rows = forgeData.split('\n').filter(l => l.trim());
        const totalRows = rows.length;
        
        let existingRuleCount = 0;
        let synthesisCount = 0;

        const drafts: RuleImportDraft[] = rawRules.map(r => {
            const existing = existingNames.get(r.name.toLowerCase());
            const catMatch = categories.find(c => c.name.toLowerCase() === r.suggestedCategoryName?.toLowerCase());
            
            // Logic state evaluation
            let state: RuleImportDraft['mappingStatus']['logicalState'] = 'new';
            if (existing) {
                existingRuleCount++;
                const existingVal = existing.conditions[0]?.value || '';
                const incomingVal = r.conditions[0]?.value || '';
                const tokensE = new Set(String(existingVal).split('||').map(t => t.trim().toLowerCase()));
                const tokensI = new Set(String(incomingVal).split('||').map(t => t.trim().toLowerCase()));
                
                const isIdentical = tokensI.size === tokensE.size && Array.from(tokensI).every(t => tokensE.has(t));
                if (isIdentical) state = 'identity';
                else if (existing.setCategoryId === (r.setCategoryId || catMatch?.id)) {
                    state = 'synthesis';
                    synthesisCount++;
                }
                else state = 'conflict';
            }

            // Coverage Calculation (Mock for now, would ideally run real logic)
            const coverage = rows.filter(row => row.toLowerCase().includes(r.conditions[0]?.value?.toLowerCase() || 'impossible_match')).length;

            return {
                ...r,
                ruleCategoryId: r.ruleCategoryId || 'rcat_manual',
                isSelected: state !== 'identity',
                coverageCount: coverage,
                mappingStatus: {
                    category: catMatch ? 'match' : (r.suggestedCategoryName ? 'create' : 'none'),
                    counterparty: counterparties.find(p => p.name.toLowerCase() === r.suggestedCounterpartyName?.toLowerCase()) ? 'match' : (r.suggestedCounterpartyName ? 'create' : 'none'),
                    location: locations.find(l => l.name.toLowerCase() === r.suggestedLocationName?.toLowerCase()) ? 'match' : (r.suggestedLocationName ? 'create' : 'none'),
                    type: transactionTypes.find(t => t.name.toLowerCase() === r.suggestedTypeName?.toLowerCase()) ? 'match' : (r.suggestedTypeName ? 'create' : 'none'),
                    logicalState: state
                }
            } as RuleImportDraft;
        });

        const coveredCount = rows.filter(row => 
            drafts.some(d => row.toLowerCase().includes(d.conditions[0]?.value?.toLowerCase() || 'impossible_match'))
        ).length;

        setBatchStats({
            rowsEvaluated: totalRows,
            rowsCovered: coveredCount,
            rulesCreated: drafts.length - existingRuleCount,
            rulesMerged: synthesisCount
        });

        setImportDrafts(drafts);
        setIsVerifyingImport(true);
        setIsImportHubOpen(true);
    };

    const handleDownloadTemplate = () => {
        const csv = generateRuleTemplate();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'finparser-rules-template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError(null);
        try {
            const reader = new FileReader();
            const text = await new Promise<string>((res) => {
                reader.onload = () => res(reader.result as string);
                reader.readAsText(file);
            });
            const lines = text.split('\n');
            const validation = validateRuleFormat(lines);
            if (!validation.isValid) {
                setImportError(validation.error || "Invalid file format.");
                return;
            }
            const imported = await parseRulesFromFile(file);
            processDrafts(imported);
        } catch (err) {
            setImportError("Failed to parse file. Ensure it is a valid CSV.");
        }
    };

    const handleForgeAiSubmit = async () => {
        if (!forgeData.trim() || !forgePromptText.trim() || isForging) return;
        setIsForging(true);
        setImportError(null);
        try {
            const forgedRules = await forgeRulesWithCustomPrompt(forgePromptText, forgeData, transactionTypes, setForgeProgress);
            processDrafts(forgedRules);
        } catch (err: any) {
            setImportError(err.message || "AI Forge failed. Neural Core error.");
        } finally {
            setIsForging(false);
        }
    };

    const handleForgePromptSelect = (id: string) => {
        const found = forgePrompts.find(p => p.id === id);
        if (found) {
            setSelectedForgePromptId(id);
            setForgePromptText(found.prompt);
            setIsEditingPrompt(false);
        }
    };

    const handleSaveProtocolToLibrary = () => {
        const currentPrompts = [...forgePrompts];
        const idx = currentPrompts.findIndex(p => p.id === selectedForgePromptId);
        if (idx > -1) currentPrompts[idx] = { ...currentPrompts[idx], prompt: forgePromptText };
        onUpdateSystemSettings({ ...systemSettings, ruleForgePrompts: currentPrompts });
        setIsEditingPrompt(false);
        notify('success', 'Protocol Updated', 'Protocol saved to library.');
    };

    const handleCreateNewProtocol = () => {
        if (!newPromptName.trim()) return;
        const newPrompt: RuleForgePrompt = { id: generateUUID(), name: newPromptName.trim(), prompt: forgePromptText };
        onUpdateSystemSettings({ ...systemSettings, ruleForgePrompts: [...forgePrompts, newPrompt] });
        setSelectedForgePromptId(newPrompt.id);
        setIsNewPromptModalOpen(false);
        setIsEditingPrompt(false);
        notify('success', 'Protocol Registered', `"${newPromptName}" added.`);
    };

    const handleDeleteProtocol = (id: string) => {
        const currentPrompts = (systemSettings.ruleForgePrompts && systemSettings.ruleForgePrompts.length > 0)
            ? systemSettings.ruleForgePrompts
            : DEFAULT_FORGE_PROMPTS;
            
        const nextPrompts = currentPrompts.filter(p => p.id !== id);
        onUpdateSystemSettings({ ...systemSettings, ruleForgePrompts: nextPrompts });
        
        if (selectedForgePromptId === id) {
            const fallback = nextPrompts.length > 0 ? nextPrompts[0] : (DEFAULT_FORGE_PROMPTS.find(p => p.id !== id) || DEFAULT_FORGE_PROMPTS[0]);
            setSelectedForgePromptId(fallback.id);
            setForgePromptText(fallback.prompt);
        }
        notify('success', 'Protocol Removed', 'Logic template deleted from library.');
    };

    const handleSaveRuleValidated = (rule: ReconciliationRule) => {
        onSaveRule(rule);
        setIsCreating(false);
        setSelectedRuleId(rule.id);
        notify('success', 'Logic Committed', `Rule "${rule.name}" synchronized.`);
    };

    const handleSaveRuleCat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        onSaveRuleCategory({ id: editingCategoryId || generateUUID(), name: newCatName.trim() });
        setNewCatName('');
        setIsCreatingCategory(false);
        setEditingCategoryId(null);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const existingNames = useMemo(() => new Map(rules.map(r => [r.name.toLowerCase(), r])), [rules]);

    // Render Fullscreen Import Hub
    if (isImportHubOpen) {
        return (
            <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col overflow-hidden animate-fade-in">
                {/* Header Navigation */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
                            <CloudArrowUpIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">Rule Import Hub</h2>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Logic Synthesis Console</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => { setIsImportHubOpen(false); setIsVerifyingImport(false); }}
                            className="px-6 py-2 text-xs font-black uppercase bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2"
                        >
                            <CloseIcon className="w-4 h-4" /> Exit Hub
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col p-8">
                    {isVerifyingImport ? (
                        <RuleImportVerification 
                            drafts={importDrafts}
                            onCancel={() => setIsVerifyingImport(false)}
                            onFinalize={(finalRules) => {
                                onSaveRules(finalRules);
                                setIsVerifyingImport(false);
                                setIsImportHubOpen(false);
                                notify('success', 'Import Complete', `${finalRules.length} rules committed.`);
                            }}
                            categories={categories}
                            payees={counterparties}
                            locations={locations}
                            users={users}
                            tags={tags}
                            transactionTypes={transactionTypes}
                            onSaveCategory={onSaveCategory}
                            onSaveCategories={onSaveCategories}
                            onSaveCounterparty={onSaveCounterparty}
                            onSaveCounterparties={onSaveCounterparties}
                            onSaveLocation={onSaveLocation}
                            onSaveLocations={onSaveLocations}
                            existingRules={rules}
                            batchStats={batchStats}
                        />
                    ) : (
                        <div className="flex-1 bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col">
                            <div className="flex bg-slate-50 border-b p-2">
                                <button onClick={() => setImportMethod('upload')} className={`flex items-center gap-2 px-8 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${importMethod === 'upload' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
                                    <UploadIcon className="w-4 h-4" /> Manifest Upload
                                </button>
                                <button onClick={() => setImportMethod('ai')} className={`flex items-center gap-2 px-8 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${importMethod === 'ai' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
                                    <RobotIcon className="w-4 h-4" /> AI Rule Forge
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                                {importMethod === 'upload' && (
                                    <div className="max-w-4xl mx-auto space-y-10">
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-4 border-dashed border-slate-100 rounded-[3rem] p-24 flex flex-col items-center justify-center text-center group hover:border-indigo-200 hover:bg-slate-50/50 transition-all cursor-pointer"
                                        >
                                            <div className="p-8 bg-indigo-50 rounded-full mb-8 group-hover:scale-110 transition-transform">
                                                <CloudArrowUpIcon className="w-16 h-16 text-indigo-400" />
                                            </div>
                                            <p className="text-2xl font-black text-slate-800">Select Rule Manifest</p>
                                            <p className="text-sm text-slate-400 mt-2 font-medium">Drag and drop your exported CSV or Excel rule definitions</p>
                                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                        </div>
                                        <div className="flex justify-center">
                                            <button onClick={handleDownloadTemplate} className="text-xs font-black uppercase text-indigo-600 flex items-center gap-2 hover:underline">
                                                <DownloadIcon className="w-4 h-4" /> Download Manifest Template
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {importMethod === 'ai' && (
                                    <div className="h-full flex flex-col gap-8 max-w-6xl mx-auto">
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            {/* PROTOCOL SIDEBAR */}
                                            <div className="lg:col-span-1 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200 space-y-6">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FORGE PROTOCOLS</h4>
                                                    <button onClick={() => { setNewPromptName(''); setIsNewPromptModalOpen(true); }} className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm hover:bg-indigo-600 hover:text-white transition-all"><AddIcon className="w-4 h-4"/></button>
                                                </div>
                                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                    {forgePrompts.map(p => (
                                                        <div 
                                                            key={p.id} 
                                                            onClick={() => handleForgePromptSelect(p.id)}
                                                            className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex justify-between items-center group/p ${selectedForgePromptId === p.id ? 'bg-white border-indigo-500 shadow-md' : 'bg-transparent border-transparent hover:bg-white/50 hover:border-slate-300'}`}
                                                        >
                                                            <div className="min-w-0">
                                                                <p className={`text-xs font-black truncate ${selectedForgePromptId === p.id ? 'text-indigo-900' : 'text-slate-600'}`}>{p.name}</p>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteProtocol(p.id); }} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/p:opacity-100 transition-opacity"><TrashIcon className="w-3.5 h-3.5"/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* DATA INPUT */}
                                            <div className="lg:col-span-2 space-y-6">
                                                <div className="bg-slate-900 rounded-[2.5rem] p-2 relative overflow-hidden group shadow-2xl">
                                                    <textarea 
                                                        value={forgeData}
                                                        onChange={e => setForgeData(e.target.value)}
                                                        className="w-full h-[300px] bg-transparent border-none focus:ring-0 p-8 text-indigo-200 font-mono text-xs leading-relaxed resize-none"
                                                        placeholder="Drop a bank CSV or paste raw ledger data here..."
                                                    />
                                                    <div className="absolute top-4 right-4 flex gap-2">
                                                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-md transition-all">Upload Sample</button>
                                                        {forgeData && <button onClick={() => setForgeData('')} className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/40 border border-red-500/20"><CloseIcon className="w-4 h-4"/></button>}
                                                    </div>
                                                </div>

                                                <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                                            <RobotIcon className="w-4 h-4" /> Execution Parameters
                                                        </h4>
                                                        <button onClick={() => setIsEditingPrompt(!isEditingPrompt)} className="text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors">
                                                            {isEditingPrompt ? 'Cancel Manual Edit' : 'Modify Core Instructions'}
                                                        </button>
                                                    </div>
                                                    <textarea 
                                                        value={forgePromptText}
                                                        onChange={e => setForgePromptText(e.target.value)}
                                                        disabled={!isEditingPrompt}
                                                        className={`w-full p-4 rounded-xl text-xs leading-relaxed border-2 transition-all ${isEditingPrompt ? 'border-indigo-400 bg-indigo-50 shadow-inner' : 'border-slate-50 bg-slate-50 text-slate-500'}`}
                                                        rows={3}
                                                    />
                                                    {isEditingPrompt && (
                                                        <button onClick={handleSaveProtocolToLibrary} className="w-full py-3 bg-emerald-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-100">Save to Library</button>
                                                    )}
                                                </div>

                                                <button 
                                                    onClick={handleForgeAiSubmit}
                                                    disabled={isForging || !forgeData.trim()}
                                                    className="w-full py-6 bg-indigo-600 text-white font-black rounded-[2.5rem] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-4 text-xl active:scale-95 disabled:opacity-30"
                                                >
                                                    {isForging ? <div className="w-8 h-8 border-4 border-t-white rounded-full animate-spin" /> : <PlayIcon className="w-8 h-8" />}
                                                    {isForging ? forgeProgress : 'Ignite AI Rule Forge'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* New Prompt Modal */}
                {isNewPromptModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-slate-800">Register Protocol</h3>
                                <button onClick={() => setIsNewPromptModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                            </div>
                            <input 
                                type="text" 
                                value={newPromptName} 
                                onChange={e => setNewPromptName(e.target.value)} 
                                className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold mb-6" 
                                placeholder="e.g. Amazon Specialist"
                                autoFocus
                            />
                            <div className="flex gap-4">
                                <button onClick={() => setIsNewPromptModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500">Cancel</button>
                                <button onClick={handleCreateNewProtocol} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100">Add to Library</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Standard Rules View
    return (
        <div className="h-full flex flex-col gap-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Automation Engine</h1>
                    <p className="text-sm text-slate-500">Programmatic ingestion rules for the system ledger.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setIsImportHubOpen(true); setImportError(null); setImportMethod('upload'); }} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl shadow-sm hover:bg-slate-50 font-bold transition-all transform active:scale-95">
                        <CloudArrowUpIcon className="w-5 h-5 text-indigo-500" /> Rule Import Hub
                    </button>
                    <button onClick={() => { setIsCreating(true); setSelectedRuleId(null); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 font-black transition-all transform active:scale-95">
                        <AddIcon className="w-5 h-5" /> New Logic
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* COLUMN 1: CATEGORIES */}
                <div className="w-64 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 flex-shrink-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rules Category</p>
                        <button onClick={() => { setIsCreatingCategory(true); setEditingCategoryId(null); setNewCatName(''); }} className="p-1 hover:bg-slate-100 rounded text-indigo-600"><AddIcon className="w-4 h-4"/></button>
                    </div>

                    {isCreatingCategory && (
                        <form onSubmit={handleSaveRuleCat} className="px-2 mb-4">
                            <input 
                                type="text" 
                                value={newCatName} 
                                onChange={e => setNewCatName(e.target.value)} 
                                placeholder="Category Name" 
                                className="w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 mb-2"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 bg-indigo-600 text-white text-[10px] font-black py-1 rounded">Save</button>
                                <button type="button" onClick={() => setIsCreatingCategory(false)} className="flex-1 bg-slate-100 text-slate-500 text-[10px] font-black py-1 rounded">Cancel</button>
                            </div>
                        </form>
                    )}

                    <div className="space-y-0.5 overflow-y-auto custom-scrollbar">
                        <button 
                            onClick={() => setSelectedCategoryId('all')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <ShieldCheckIcon className="w-4 h-4" />
                            <span>All Rules</span>
                        </button>
                        {ruleCategories.map(rc => (
                            <div key={rc.id} className="group flex items-center">
                                <button 
                                    onClick={() => setSelectedCategoryId(rc.id)}
                                    className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === rc.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <FolderIcon className="w-4 h-4 text-slate-400" />
                                    <span className="truncate">{rc.name}</span>
                                </button>
                                {!rc.isDefault && (
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingCategoryId(rc.id); setNewCatName(rc.name); setIsCreatingCategory(true); }} className="p-1.5 text-slate-300 hover:text-indigo-600"><EditIcon className="w-3 h-3"/></button>
                                        <button onClick={() => { if(confirm("Dissolve category?")) onDeleteRuleCategory(rc.id); }} className="p-1.5 text-slate-300 hover:text-red-500"><TrashIcon className="w-3 h-3"/></button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* COLUMN 2: STREAM */}
                <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b flex flex-col gap-3 bg-slate-50 rounded-t-2xl">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0}
                                    onChange={toggleSelectAll}
                                />
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                                >
                                    {bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0 ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            {bulkSelectedIds.size > 0 && (
                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                    {bulkSelectedIds.size} SELECTED
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="Search rules..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none font-bold" />
                            <SearchCircleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-white/50">
                        {filteredRules.length === 0 ? (
                            <div className="p-10 text-center text-slate-300">
                                <BoxIcon className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                <p className="text-[10px] font-black uppercase">Empty</p>
                            </div>
                        ) : (
                            filteredRules.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => { setSelectedRuleId(r.id); setIsCreating(false); }} 
                                    className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all border-2 group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'} ${bulkSelectedIds.has(r.id) ? 'ring-1 ring-indigo-200' : ''}`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
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
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-xs font-bold truncate ${selectedRuleId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                                {ruleCategories.find(rc => rc.id === r.ruleCategoryId)?.name || 'Other'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setRuleToDeleteId(r.id); }}
                                            className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* COLUMN 3: EDITOR */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
                    {(selectedRuleId || isCreating) ? (
                        <div className="flex flex-col h-full animate-fade-in bg-white">
                            <RuleModal 
                                isOpen={true} 
                                onClose={() => { setSelectedRuleId(null); setIsCreating(false); }} 
                                onSaveRule={handleSaveRuleValidated}
                                onDeleteRule={(id) => { onDeleteRule(id); setSelectedRuleId(null); setIsCreating(false); }}
                                accounts={accounts}
                                transactionTypes={transactionTypes}
                                categories={categories}
                                tags={tags}
                                counterparties={counterparties}
                                locations={locations}
                                users={users}
                                ruleCategories={ruleCategories}
                                onSaveRuleCategory={onSaveRuleCategory}
                                transaction={activeRule ? { ...activeRule, description: activeRule.conditions[0]?.value || '' } as any : null}
                                onSaveCategory={onSaveCategory}
                                onSaveCounterparty={onSaveCounterparty}
                                onSaveTag={onSaveTag}
                                onAddTransactionType={onAddTransactionType}
                                existingRules={rules}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <ShieldCheckIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Logic Workbench</h3>
                            <p className="text-slate-500 max-sm mt-4 font-medium leading-relaxed">Design rules to standardize your ledger automatically. Define criteria for descriptions, amounts, or accounts to auto-apply categories and entities.</p>
                            <button onClick={() => setIsCreating(true)} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">Start Designing</button>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal 
                isOpen={!!ruleToDeleteId}
                onClose={() => setRuleToDeleteId(null)}
                onConfirm={() => ruleToDeleteId && onDeleteRule(ruleToDeleteId)}
                title="Discard Automation Logic?"
                message="Future ingestion of matching transactions will default to 'Other' until a new rule is defined."
            />
        </div>
    );
};

export default RulesPage;
