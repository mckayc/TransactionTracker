
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Counterparty, Category, RuleCondition, Tag, Location, User, RuleImportDraft, RuleCategory, RuleForgePrompt, SystemSettings, ImportBatchStats, FieldRequirement } from '../types';
import { DeleteIcon, AddIcon, SearchCircleIcon, SparklesIcon, ShieldCheckIcon, TagIcon, TableIcon, BoxIcon, MapPinIcon, UserGroupIcon, CloudArrowUpIcon, TrashIcon, CloseIcon, FileCodeIcon, UploadIcon, DownloadIcon, InfoIcon, ExclamationTriangleIcon, EditIcon, ChevronRightIcon, FolderIcon, CheckCircleIcon, RobotIcon, PlayIcon, SaveIcon, RepeatIcon, ListIcon, DatabaseIcon, WorkflowIcon, SlashIcon, TypeIcon, ChecklistIcon, UsersIcon } from '../components/Icons';
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
        prompt: 'Identify city and state patterns in the raw transaction descriptions. Name the rule "Location - City, ST". Only generate rules if a geographic location is likely.',
        ruleCategoryId: 'rcat_loc',
        fields: { location: 'required', category: 'omit', type: 'omit' }
    },
    {
        id: 'forge-norm',
        name: 'Identity & Logic Normalizer',
        prompt: 'Generate comprehensive rules for clean Descriptions, logical Categories, Transaction Types, and Counterparties. Standardize vendor names and categorize accurately for tax purposes.',
        ruleCategoryId: 'rcat_desc',
        fields: { description: 'required', category: 'required', counterparty: 'required', type: 'required' }
    },
    {
        id: 'forge-subs',
        name: 'Subscription Hunter Protocol',
        prompt: 'Identify potential recurring monthly subscriptions. Assign them to a "Subscriptions" category.',
        ruleCategoryId: 'rcat_desc',
        fields: { category: 'required', tags: 'optional' }
    }
];

const FieldController: React.FC<{
    label: string;
    value?: FieldRequirement;
    onChange: (val: FieldRequirement) => void;
    icon: React.ReactNode;
}> = ({ label, value = 'optional', onChange, icon }) => {
    return (
        <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${value === 'required' ? 'bg-indigo-50 text-indigo-600' : value === 'omit' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                    {icon}
                </div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-tight">{label}</span>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['required', 'optional', 'omit'] as FieldRequirement[]).map(v => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onChange(v)}
                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${value === v ? (v === 'required' ? 'bg-indigo-600 text-white' : v === 'omit' ? 'bg-red-600 text-white' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );
};

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
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);

    // Fullscreen View State
    const [isImportHubOpen, setIsImportHubOpen] = useState(false);

    // Notification State
    const [notification, setNotification] = useState<AppNotification | null>(null);

    // Import Flow State
    const [importMethod, setImportMethod] = useState<'upload' | 'ai'>('upload');
    const [pastedRules, setPastedRules] = useState('');
    const [importDrafts, setImportDrafts] = useState<RuleImportDraft[]>([]);
    const [isVerifyingImport, setIsVerifyingImport] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [batchStats, setBatchStats] = useState<ImportBatchStats | null>(null);
    
    // AI Forge State
    const forgePrompts = useMemo(() => {
        return (systemSettings.ruleForgePrompts && systemSettings.ruleForgePrompts.length > 0)
            ? systemSettings.ruleForgePrompts
            : DEFAULT_FORGE_PROMPTS;
    }, [systemSettings.ruleForgePrompts]);

    const [selectedForgePromptId, setSelectedForgePromptId] = useState<string>(forgePrompts[0].id);
    const [isForging, setIsForging] = useState(false);
    const [forgeProgress, setForgeProgress] = useState<string>('');
    const [forgeData, setForgeData] = useState<string>('');
    const [isNewPromptModalOpen, setIsNewPromptModalOpen] = useState(false);
    const [newPromptName, setNewPromptName] = useState('');

    const activeForgePrompt = useMemo(() => forgePrompts.find(p => p.id === selectedForgePromptId) || forgePrompts[0], [forgePrompts, selectedForgePromptId]);

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
        setIsBulkDeleteModalOpen(false);
    };

    const handleBulkMove = (targetCategoryId: string) => {
        const updatedRules = rules.map(r => {
            if (bulkSelectedIds.has(r.id)) {
                return { ...r, ruleCategoryId: targetCategoryId };
            }
            return r;
        });
        onSaveRules(updatedRules);
        setBulkSelectedIds(new Set());
        notify('success', 'Rules Reorganized', `${bulkSelectedIds.size} rules moved to new category.`);
        setIsBulkMoveModalOpen(false);
    };

    const toggleSelectAll = () => {
        if (bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0) {
            setBulkSelectedIds(new Set());
        } else {
            setBulkSelectedIds(new Set(filteredRules.map(r => r.id)));
        }
    };

    const processDrafts = (rawRules: ReconciliationRule[]) => {
        const rows = (importMethod === 'ai' ? forgeData : pastedRules).split('\n').filter(l => l.trim());
        const totalRows = rows.length;
        
        let existingRuleCount = 0;
        let synthesisCount = 0;

        const drafts: RuleImportDraft[] = rawRules.map(r => {
            const existing = existingNames.get(r.name.toLowerCase());
            const catMatch = r.suggestedCategoryName ? categories.find(c => c.name.toLowerCase() === r.suggestedCategoryName?.toLowerCase()) : null;
            const typeMatch = r.suggestedTypeName ? transactionTypes.find(t => t.name.toLowerCase() === r.suggestedTypeName?.toLowerCase()) : null;
            const payeeMatch = r.suggestedCounterpartyName ? counterparties.find(p => p.name.toLowerCase() === r.suggestedCounterpartyName?.toLowerCase()) : null;
            const locMatch = r.suggestedLocationName ? locations.find(l => l.name.toLowerCase() === r.suggestedLocationName?.toLowerCase()) : null;
            
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

            // Coverage Calculation (Count matching rows in sample)
            const matchValue = r.conditions[0]?.value?.toLowerCase() || '';
            const dataToEvaluate = importMethod === 'ai' ? forgeData : pastedRules;
            const coverage = rows.filter(row => row.toLowerCase().includes(matchValue)).length;

            return {
                ...r,
                ruleCategoryId: importMethod === 'ai' ? (activeForgePrompt.ruleCategoryId || 'rcat_other') : (r.ruleCategoryId || 'rcat_manual'),
                isSelected: state !== 'identity',
                coverageCount: coverage,
                setTransactionTypeId: typeMatch?.id || undefined,
                mappingStatus: {
                    category: catMatch ? 'match' : (r.suggestedCategoryName ? 'create' : 'none'),
                    counterparty: payeeMatch ? 'match' : (r.suggestedCounterpartyName ? 'create' : 'none'),
                    location: locMatch ? 'match' : (r.suggestedLocationName ? 'create' : 'none'),
                    type: typeMatch ? 'match' : (r.suggestedTypeName ? 'create' : 'none'),
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

    const handlePasteSubmit = () => {
        if (!pastedRules.trim()) return;
        setImportError(null);
        try {
            const lines = pastedRules.split('\n');
            const validation = validateRuleFormat(lines);
            if (!validation.isValid) {
                setImportError(validation.error || "Invalid format detected in pasted text.");
                return;
            }
            const imported = parseRulesFromLines(lines);
            processDrafts(imported);
        } catch (err) {
            setImportError("Parsing failed.");
        }
    };

    const handleForgeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const reader = new FileReader();
            reader.onload = () => setForgeData(reader.result as string);
            reader.readAsText(file);
        } catch (err) {
            alert("Failed to read file.");
        }
    };

    const handleForgeAiSubmit = async () => {
        if (!forgeData.trim() || isForging) return;
        setIsForging(true);
        setImportError(null);
        try {
            const forgedRules = await forgeRulesWithCustomPrompt(activeForgePrompt, forgeData, transactionTypes, setForgeProgress);
            processDrafts(forgedRules);
        } catch (err: any) {
            setImportError(err.message || "AI Forge failed. Neural Core error.");
        } finally {
            setIsForging(false);
        }
    };

    const updateCurrentProtocol = (updates: Partial<RuleForgePrompt>) => {
        const nextPrompts = forgePrompts.map(p => p.id === selectedForgePromptId ? { ...p, ...updates } : p);
        onUpdateSystemSettings({ ...systemSettings, ruleForgePrompts: nextPrompts });
    };

    const updateFieldRequirement = (fieldName: keyof Required<RuleForgePrompt>['fields'], val: FieldRequirement) => {
        const currentFields = activeForgePrompt.fields || {};
        updateCurrentProtocol({ fields: { ...currentFields, [fieldName]: val } });
    };

    const handleCreateNewProtocol = () => {
        if (!newPromptName.trim()) return;
        const newPrompt: RuleForgePrompt = { id: generateUUID(), name: newPromptName.trim(), prompt: '', ruleCategoryId: 'rcat_other', fields: {} };
        onUpdateSystemSettings({ ...systemSettings, ruleForgePrompts: [...forgePrompts, newPrompt] });
        setSelectedForgePromptId(newPrompt.id);
        setIsNewPromptModalOpen(false);
        notify('success', 'Protocol Registered', `"${newPromptName}" added.`);
    };

    const handleDeleteProtocol = (id: string) => {
        if (!confirm("Permanently delete this logic template?")) return;
        const nextPrompts = forgePrompts.filter(p => p.id !== id);
        onUpdateSystemSettings({ ...systemSettings, ruleForgePrompts: nextPrompts });
        if (selectedForgePromptId === id && nextPrompts.length > 0) {
            setSelectedForgePromptId(nextPrompts[0].id);
        }
        notify('success', 'Protocol Removed', 'Logic template deleted.');
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
    const forgeFileInputRef = useRef<HTMLInputElement>(null);
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
                                    <ListIcon className="w-4 h-4" /> Rule Parser
                                </button>
                                <button onClick={() => setImportMethod('ai')} className={`flex items-center gap-2 px-8 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${importMethod === 'ai' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
                                    <RobotIcon className="w-4 h-4" /> AI Rule Generator
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                {importMethod === 'upload' && (
                                    <div className="flex h-full animate-fade-in">
                                        {/* LEFT COLUMN: INSTRUCTIONS */}
                                        <div className="w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col p-10 space-y-8">
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-800">Rule Parser</h3>
                                                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                                    Use the parser to ingest rules generated manually or by external AI engines. 
                                                    Upload a file or paste raw CSV text to start normalization.
                                                </p>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Protocol Requirements</h4>
                                                    <ul className="text-xs space-y-3 font-medium text-slate-600">
                                                        <li className="flex items-start gap-2"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> CSV/Excel format supported</li>
                                                        <li className="flex items-start gap-2"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> Required headers: Rule Name, Match Field, Operator, Match Value</li>
                                                        <li className="flex items-start gap-2"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> Logical ORs supported via "||" in Match Value</li>
                                                    </ul>
                                                </div>

                                                <div className="p-6 bg-indigo-600 rounded-[2rem] text-white space-y-4 shadow-xl shadow-indigo-100">
                                                    <p className="text-xs font-bold leading-relaxed">Need a baseline? Download our structural blueprint to see supported fields.</p>
                                                    <button onClick={handleDownloadTemplate} className="w-full py-3 bg-white text-indigo-600 font-black rounded-xl text-xs uppercase hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                                                        <DownloadIcon className="w-4 h-4" /> Rules Template
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* RIGHT COLUMN: INPUT */}
                                        <div className="flex-1 bg-white p-10 overflow-y-auto custom-scrollbar flex flex-col gap-8">
                                            <div 
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    const file = e.dataTransfer.files[0];
                                                    if (file) {
                                                        const event = { target: { files: [file] } } as any;
                                                        handleFileUpload(event);
                                                    }
                                                }}
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-4 border-dashed border-slate-100 rounded-[3rem] p-16 flex flex-col items-center justify-center text-center group hover:border-indigo-200 hover:bg-slate-50/50 transition-all cursor-pointer"
                                            >
                                                <div className="p-6 bg-indigo-50 rounded-full mb-6 group-hover:scale-110 transition-transform">
                                                    <CloudArrowUpIcon className="w-12 h-12 text-indigo-400" />
                                                </div>
                                                <p className="text-xl font-black text-slate-800">Drop Manifest or Click to Browse</p>
                                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                            </div>

                                            <div className="relative flex-1 flex flex-col min-h-0">
                                                <div className="flex justify-between items-center mb-2 px-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paste Manifest Data</label>
                                                    {pastedRules && <button onClick={() => setPastedRules('')} className="text-[9px] font-black text-red-500 uppercase hover:underline">Clear</button>}
                                                </div>
                                                <textarea 
                                                    value={pastedRules}
                                                    onChange={e => setPastedRules(e.target.value)}
                                                    placeholder="Paste CSV rows here..."
                                                    className="flex-1 w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-mono text-xs focus:bg-white focus:ring-0 focus:border-indigo-400 transition-all resize-none min-h-[300px]"
                                                />
                                            </div>

                                            <button 
                                                onClick={handlePasteSubmit}
                                                disabled={!pastedRules.trim()}
                                                className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl hover:bg-indigo-700 disabled:opacity-30 transition-all text-sm uppercase tracking-widest active:scale-95"
                                            >
                                                Execute Parser
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {importMethod === 'ai' && (
                                    <div className="h-full flex gap-0 animate-fade-in">
                                        {/* COLUMN 1: PROTOCOL LIBRARY */}
                                        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col min-h-0">
                                            <div className="p-6 border-b flex justify-between items-center bg-white/50">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <WorkflowIcon className="w-3 h-3" /> Protocols
                                                </h4>
                                                <button onClick={() => { setNewPromptName(''); setIsNewPromptModalOpen(true); }} className="p-1.5 bg-white border border-slate-200 rounded-lg text-indigo-600 shadow-sm hover:bg-indigo-600 hover:text-white transition-all active:scale-90"><AddIcon className="w-4 h-4"/></button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                                                {forgePrompts.map(p => (
                                                    <div 
                                                        key={p.id} 
                                                        onClick={() => setSelectedForgePromptId(p.id)}
                                                        className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col gap-1.5 group/p relative ${selectedForgePromptId === p.id ? 'bg-white border-indigo-500 shadow-lg ring-4 ring-indigo-50 z-10' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-300'}`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <p className={`text-xs font-black truncate max-w-[80%] ${selectedForgePromptId === p.id ? 'text-indigo-900' : 'text-slate-600'}`}>{p.name}</p>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteProtocol(p.id); }} 
                                                                className="opacity-0 group-hover/p:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5"/>
                                                            </button>
                                                        </div>
                                                        <p className="text-[9px] line-clamp-1 text-slate-400 font-medium">{p.prompt || 'No instructions'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* COLUMN 2: LOGIC STUDIO */}
                                        <div className="flex-1 bg-white flex flex-col min-h-0 border-r border-slate-200 relative">
                                            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{activeForgePrompt.name}</h3>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Generator Settings</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 pb-32">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Directives</label>
                                                    <textarea 
                                                        value={activeForgePrompt.prompt}
                                                        onChange={e => updateCurrentProtocol({ prompt: e.target.value })}
                                                        placeholder="Instructions..."
                                                        className="w-full h-24 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-medium focus:bg-white focus:border-indigo-400 transition-all resize-none"
                                                    />
                                                </div>

                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fields to Edit</label>
                                                    <div className="space-y-2">
                                                        <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                                                                <FolderIcon className="w-3.5 h-3.5 text-indigo-400" /> Target Logic Folder
                                                            </label>
                                                            <select 
                                                                value={activeForgePrompt.ruleCategoryId || 'rcat_other'}
                                                                onChange={e => updateCurrentProtocol({ ruleCategoryId: e.target.value })}
                                                                className="w-full text-xs font-bold border-none bg-slate-50 rounded-xl focus:ring-0 p-2"
                                                            >
                                                                {ruleCategories.map(rc => <option key={rc.id} value={rc.id}>{rc.name}</option>)}
                                                            </select>
                                                        </div>
                                                        <FieldController label="Categories" value={activeForgePrompt.fields?.category} onChange={v => updateFieldRequirement('category', v)} icon={<TagIcon className="w-4 h-4"/>} />
                                                        <FieldController label="Counterparties" value={activeForgePrompt.fields?.counterparty} onChange={v => updateFieldRequirement('counterparty', v)} icon={<UsersIcon className="w-4 h-4"/>} />
                                                        <FieldController label="Tags" value={activeForgePrompt.fields?.tags} onChange={v => updateFieldRequirement('tags', v)} icon={<RepeatIcon className="w-4 h-4"/>} />
                                                        <FieldController label="Locations" value={activeForgePrompt.fields?.location} onChange={v => updateFieldRequirement('location', v)} icon={<MapPinIcon className="w-4 h-4"/>} />
                                                        <FieldController label="Tx Types" value={activeForgePrompt.fields?.type} onChange={v => updateFieldRequirement('type', v)} icon={<ChecklistIcon className="w-4 h-4"/>} />
                                                        <FieldController label="Normalization" value={activeForgePrompt.fields?.description} onChange={v => updateFieldRequirement('description', v)} icon={<TypeIcon className="w-4 h-4"/>} />
                                                        <FieldController label="Filtering" value={activeForgePrompt.fields?.skip} onChange={v => updateFieldRequirement('skip', v)} icon={<SlashIcon className="w-4 h-4"/>} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100">
                                                <button 
                                                    onClick={handleForgeAiSubmit}
                                                    disabled={isForging || !forgeData.trim()}
                                                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 text-xs active:scale-95 disabled:opacity-30 group"
                                                >
                                                    {isForging ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <PlayIcon className="w-4 h-4 group-hover:scale-125 transition-transform" />}
                                                    {isForging ? forgeProgress : 'Generate Rules'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* COLUMN 3: DATA CONSOLE */}
                                        <div className="flex-1 bg-slate-900 flex flex-col min-h-0 relative">
                                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                    <DatabaseIcon className="w-3.5 h-3.5" /> Ledger Input
                                                </h4>
                                                <div className="flex gap-1">
                                                    <button onClick={() => forgeFileInputRef.current?.click()} className="p-2 text-white/50 hover:text-white transition-colors" title="Upload CSV"><UploadIcon className="w-4 h-4"/></button>
                                                    {forgeData && <button onClick={() => setForgeData('')} className="p-2 text-red-400/50 hover:text-red-400 transition-colors"><CloseIcon className="w-4 h-4"/></button>}
                                                </div>
                                                <input type="file" ref={forgeFileInputRef} className="hidden" accept=".csv,.txt" onChange={handleForgeFileUpload} />
                                            </div>
                                            
                                            <div 
                                                className="flex-1 relative flex flex-col"
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    const file = e.dataTransfer.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = () => setForgeData(reader.result as string);
                                                        reader.readAsText(file);
                                                    }
                                                }}
                                            >
                                                <textarea 
                                                    value={forgeData}
                                                    onChange={e => setForgeData(e.target.value)}
                                                    className="flex-1 bg-transparent border-none focus:ring-0 p-6 text-indigo-100 font-mono text-[10px] leading-relaxed resize-none custom-scrollbar"
                                                    placeholder="Paste statement rows here or drag file..."
                                                />
                                                {!forgeData && (
                                                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-10">
                                                        <TableIcon className="w-20 h-20 text-white mb-4" />
                                                        <p className="font-black text-white uppercase tracking-widest text-sm">Awaiting Stream</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Modal */}
                {isForging && (
                    <div className="fixed inset-0 bg-indigo-900/90 backdrop-blur-xl z-[300] flex items-center justify-center">
                        <div className="max-w-md w-full p-12 text-center space-y-8 animate-fade-in">
                            <div className="relative w-32 h-32 mx-auto">
                                <div className="absolute inset-0 border-8 border-white/10 rounded-full" />
                                <div className="absolute inset-0 border-8 border-indigo-400 rounded-full border-t-transparent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <SparklesIcon className="w-12 h-12 text-white animate-pulse" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-3xl font-black text-white tracking-tight uppercase">Neural Synthesis</h3>
                                <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs animate-pulse">{forgeProgress}</p>
                            </div>
                        </div>
                    </div>
                )}

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
                                className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold mb-6 focus:border-indigo-500 outline-none" 
                                placeholder="e.g. Amazon Specialist"
                                autoFocus
                            />
                            <div className="flex gap-4">
                                <button onClick={() => setIsNewPromptModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={handleCreateNewProtocol} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Add to Library</button>
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
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
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
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setIsBulkMoveModalOpen(true)}
                                        className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg uppercase shadow-sm hover:bg-indigo-600 hover:text-white transition-all"
                                    >
                                        Move {bulkSelectedIds.size}
                                    </button>
                                    <button 
                                        onClick={() => setIsBulkDeleteModalOpen(true)}
                                        className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-1 rounded-lg uppercase shadow-sm hover:bg-red-600 hover:text-white transition-all"
                                    >
                                        Purge {bulkSelectedIds.size}
                                    </button>
                                </div>
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

            <ConfirmationModal 
                isOpen={isBulkDeleteModalOpen}
                onClose={() => setIsBulkDeleteModalOpen(false)}
                onConfirm={handleBulkDelete}
                title="Purge Logic Batch?"
                message={`You are about to permanently remove ${bulkSelectedIds.size} logical records. This will affect future ingestion logic.`}
            />

            {isBulkMoveModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Move Logic Batch</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{bulkSelectedIds.size} Items Targeted</p>
                            </div>
                            <button onClick={() => setIsBulkMoveModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <div className="space-y-2 mb-8 max-h-64 overflow-y-auto custom-scrollbar">
                            {ruleCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleBulkMove(cat.id)}
                                    className="w-full flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                                >
                                    <FolderIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                                    <span className="font-bold text-slate-700 group-hover:text-indigo-900">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsBulkMoveModalOpen(false)} className="w-full py-4 bg-slate-100 rounded-2xl font-black text-slate-500">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RulesPage;
