
import React, { useState, useMemo, useRef } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Counterparty, Category, RuleCondition, Tag, Location, User, RuleImportDraft, RuleCategory } from '../types';
import { DeleteIcon, AddIcon, SearchCircleIcon, SparklesIcon, ShieldCheckIcon, TagIcon, TableIcon, BoxIcon, MapPinIcon, UserGroupIcon, CloudArrowUpIcon, TrashIcon, CloseIcon, FileCodeIcon, UploadIcon, DownloadIcon, InfoIcon, ExclamationTriangleIcon, EditIcon, ChevronRightIcon, FolderIcon, CheckCircleIcon } from '../components/Icons';
import RuleModal from '../components/RuleModal';
import RuleImportVerification from '../components/RuleImportVerification';
import { parseRulesFromFile, parseRulesFromLines, generateRuleTemplate, validateRuleFormat } from '../services/csvParserService';
import { generateUUID } from '../utils';

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
}

interface AppNotification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    description?: string;
}

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onSaveRules, onDeleteRule, accounts, transactionTypes, categories, tags, counterparties, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSaveCategories, onSaveCounterparty, onSaveCounterparties, onSaveLocation, onSaveLocations, onSaveTag, onAddTransactionType, onSaveUser,
    ruleCategories, onSaveRuleCategory, onDeleteRuleCategory
}) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

    // Notification State
    const [notification, setNotification] = useState<AppNotification | null>(null);

    // Import Flow State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importMethod, setImportMethod] = useState<'upload' | 'paste'>('upload');
    const [pastedRules, setPastedRules] = useState('');
    const [importDrafts, setImportDrafts] = useState<RuleImportDraft[]>([]);
    const [isVerifyingImport, setIsVerifyingImport] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    
    // Category management
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const notify = (type: AppNotification['type'], message: string, description?: string) => {
        const id = generateUUID();
        setNotification({ id, type, message, description });
        setTimeout(() => setNotification(prev => prev?.id === id ? null : prev), 5000);
    };

    // Filter rules by category and search
    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedCategoryId !== 'all') {
            list = list.filter(r => r.ruleCategoryId === selectedCategoryId);
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedCategoryId]);

    const activeRule = useMemo(() => rules.find(r => r.id === selectedRuleId), [rules, selectedRuleId]);

    const handleBulkDelete = () => {
        if (confirm(`Permanently delete ${bulkSelectedIds.size} selected rules?`)) {
            bulkSelectedIds.forEach(id => onDeleteRule(id));
            setBulkSelectedIds(new Set());
            setSelectedRuleId(null);
            notify('success', 'Rules Purged', `${bulkSelectedIds.size} logical records removed.`);
        }
    };

    const handleBulkMove = (targetCategoryId: string) => {
        const rulesToUpdate = rules.filter(r => bulkSelectedIds.has(r.id));
        const updatedRules = rulesToUpdate.map(r => ({ ...r, ruleCategoryId: targetCategoryId }));
        onSaveRules(updatedRules);
        setBulkSelectedIds(new Set());
        setIsMoveModalOpen(false);
        notify('success', 'Logic Repositioned', `${updatedRules.length} rules moved to new cluster.`);
    };

    const toggleSelectAll = () => {
        if (bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0) {
            setBulkSelectedIds(new Set());
        } else {
            setBulkSelectedIds(new Set(filteredRules.map(r => r.id)));
        }
    };

    const processDrafts = (rawRules: ReconciliationRule[]) => {
        const drafts: RuleImportDraft[] = rawRules.map(r => {
            const catMatch = categories.find(c => c.name.toLowerCase() === r.suggestedCategoryName?.toLowerCase());
            const cpMatch = counterparties.find(cp => cp.name.toLowerCase() === r.suggestedCounterpartyName?.toLowerCase());
            const locMatch = locations.find(l => l.name.toLowerCase() === r.suggestedLocationName?.toLowerCase());
            const typeMatch = transactionTypes.find(t => t.name.toLowerCase() === r.suggestedTypeName?.toLowerCase());

            // Handle rule category matching
            let mappedRuleCategoryId = 'rcat_manual';
            if (r.ruleCategory) {
                const rcMatch = ruleCategories.find(rc => rc.name.toLowerCase() === r.ruleCategory?.toLowerCase());
                if (rcMatch) mappedRuleCategoryId = rcMatch.id;
            }

            return {
                ...r,
                ruleCategoryId: mappedRuleCategoryId,
                isSelected: true,
                mappingStatus: {
                    category: catMatch ? 'match' : (r.suggestedCategoryName ? 'create' : 'none'),
                    counterparty: cpMatch ? 'match' : (r.suggestedCounterpartyName ? 'create' : 'none'),
                    location: locMatch ? 'match' : (r.suggestedLocationName ? 'create' : 'none'),
                    type: typeMatch ? 'match' : (r.suggestedTypeName ? 'create' : 'none')
                }
            } as RuleImportDraft;
        });
        setImportDrafts(drafts);
        setIsVerifyingImport(true);
        setIsImportModalOpen(false);
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
        const lines = pastedRules.split('\n');
        const validation = validateRuleFormat(lines);
        if (!validation.isValid) {
            setImportError(validation.error || "Malformed header or data.");
            return;
        }
        const imported = parseRulesFromLines(lines);
        processDrafts(imported);
        setPastedRules('');
    };

    const handleSaveRuleValidated = (rule: ReconciliationRule) => {
        const duplicate = rules.find(r => r.name.toLowerCase() === rule.name.toLowerCase() && r.id !== rule.id);
        if (duplicate) {
            notify('warning', 'Name Collision', `A rule named "${rule.name}" already exists. Using Overwrite protocol.`);
        }
        onSaveRule(rule);
        setIsCreating(false);
        setSelectedRuleId(rule.id);
        notify('success', 'Logic Committed', `Rule "${rule.name}" has been synchronized.`);
    };

    const handleSaveRuleCat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        onSaveRuleCategory({
            id: editingCategoryId || generateUUID(),
            name: newCatName.trim()
        });
        setNewCatName('');
        setIsCreatingCategory(false);
        setEditingCategoryId(null);
        notify('success', 'Cluster Registered', `New category "${newCatName}" is ready.`);
    };

    const handleDeleteCat = (id: string) => {
        const affectedRules = rules.filter(r => r.ruleCategoryId === id);
        if (affectedRules.length > 0) {
            if (confirm(`This category contains ${affectedRules.length} rules. Delete anyway? They will be moved to 'Other'.`)) {
                const migrated = affectedRules.map(r => ({ ...r, ruleCategoryId: 'rcat_other' }));
                onSaveRules(migrated);
                onDeleteRuleCategory(id);
                notify('info', 'Cluster Dissolved', `${migrated.length} rules re-routed to default.`);
            }
        } else {
            onDeleteRuleCategory(id);
        }
    };

    const handleDeleteRuleSingle = (id: string) => {
        if (confirm("Delete this rule? This action cannot be undone.")) {
            onDeleteRule(id);
            if (selectedRuleId === id) setSelectedRuleId(null);
            notify('info', 'Logic Discarded', 'The rule was removed from the engine.');
        }
    }

    if (isVerifyingImport) {
        return (
            <div className="h-full animate-fade-in">
                <RuleImportVerification 
                    drafts={importDrafts}
                    onCancel={() => setIsVerifyingImport(false)}
                    onFinalize={(finalRules) => {
                        const existingIdsSet = new Set(rules.map(r => r.id));
                        const existingNamesMap = new Map(rules.map(r => [r.name.toLowerCase(), r.id]));
                        
                        // Separate rules into UPDATES (existing IDs) and NEW (unique names)
                        const rulesToSync: ReconciliationRule[] = [];
                        let skippedCount = 0;

                        finalRules.forEach(fr => {
                            const nameLower = fr.name.toLowerCase();
                            const existingId = existingNamesMap.get(nameLower);

                            // If it's a legitimate merge/update, it will have an ID matching the system
                            if (existingIdsSet.has(fr.id)) {
                                rulesToSync.push(fr);
                            } 
                            // If it has a matching name but different ID, it's a collision
                            else if (existingId && existingId !== fr.id) {
                                skippedCount++;
                            }
                            // Otherwise it's completely new
                            else {
                                rulesToSync.push(fr);
                            }
                        });

                        onSaveRules(rulesToSync);
                        setIsVerifyingImport(false);
                        
                        if (skippedCount > 0) {
                            notify('warning', 'Ingestion Collision', `${skippedCount} rules were skipped due to name collisions. Names must be unique.`);
                        } else {
                            notify('success', 'Ingestion Complete', `${rulesToSync.length} rules successfully committed to engine.`);
                        }
                    }}
                    categories={categories}
                    payees={counterparties}
                    locations={locations}
                    users={users}
                    transactionTypes={transactionTypes}
                    onSaveCategory={onSaveCategory}
                    onSaveCategories={onSaveCategories}
                    onSaveCounterparty={onSaveCounterparty}
                    onSaveCounterparties={onSaveCounterparties}
                    onSaveLocation={onSaveLocation}
                    onSaveLocations={onSaveLocations}
                    existingRules={rules}
                />
            </div>
        );
    }

    const isAllSelected = bulkSelectedIds.size === filteredRules.length && filteredRules.length > 0;

    return (
        <div className="h-full flex flex-col gap-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Automation Engine</h1>
                    <p className="text-sm text-slate-500">Programmatic ingestion rules for the system ledger.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setIsImportModalOpen(true); setImportError(null); }} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl shadow-sm hover:bg-slate-50 font-bold transition-all transform active:scale-95">
                        <CloudArrowUpIcon className="w-5 h-5 text-indigo-500" /> Import Rules
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
                                        <button onClick={() => handleDeleteCat(rc.id)} className="p-1.5 text-slate-300 hover:text-red-500"><TrashIcon className="w-3 h-3"/></button>
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
                                    checked={isAllSelected}
                                    onChange={toggleSelectAll}
                                />
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                                >
                                    {isAllSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            {bulkSelectedIds.size > 0 && (
                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full animate-pulse">
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
                                            onClick={(e) => { e.stopPropagation(); handleDeleteRuleSingle(r.id); }}
                                            className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {bulkSelectedIds.size > 0 && (
                        <div className="p-3 border-t bg-white rounded-b-2xl flex gap-2">
                            <button onClick={handleBulkDelete} className="flex-1 py-2 bg-red-50 text-red-600 font-black rounded-xl text-[10px] uppercase shadow-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all">
                                <TrashIcon className="w-3.5 h-3.5" /> Delete
                            </button>
                            <div className="relative">
                                <button onClick={() => setIsMoveModalOpen(!isMoveModalOpen)} className="w-full py-2 bg-indigo-50 text-indigo-600 font-black rounded-xl text-[10px] uppercase shadow-sm flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all px-4">
                                    <ChevronRightIcon className="w-3.5 h-3.5" /> Move
                                </button>
                                {isMoveModalOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden z-50 animate-slide-up">
                                        <div className="p-2 border-b bg-slate-50 text-[9px] font-black text-slate-400 uppercase">Target Category</div>
                                        <div className="max-h-40 overflow-y-auto">
                                            {ruleCategories.map(rc => (
                                                <button key={rc.id} onClick={() => handleBulkMove(rc.id)} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">{rc.name}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUMN 3: EDITOR */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
                    {(selectedRuleId || isCreating) ? (
                        <div className="flex flex-col h-full animate-fade-in bg-white">
                            <RuleModal 
                                isOpen={true} 
                                onClose={() => { setSelectedRuleId(null); setIsCreating(false); }} 
                                onSaveRule={handleSaveRuleValidated}
                                onDeleteRule={(id) => { onDeleteRule(id); setSelectedRuleId(null); setIsCreating(false); notify('info', 'Logic Removed', 'The rule was deleted.'); }}
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

            {/* In-App Notification Toast */}
            {notification && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                    <div className={`px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 border min-w-[320px] backdrop-blur-md ${
                        notification.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' :
                        notification.type === 'warning' ? 'bg-amber-900/90 border-amber-500 text-white' :
                        notification.type === 'info' ? 'bg-indigo-900/90 border-indigo-500 text-white' :
                        'bg-slate-900/90 border-white/10 text-white'
                    }`}>
                        <div className={`p-2 rounded-full ${
                            notification.type === 'success' ? 'bg-emerald-50' :
                            notification.type === 'warning' ? 'bg-amber-50' :
                            'bg-indigo-50'
                        }`}>
                            {notification.type === 'success' ? <CheckCircleIcon className="w-5 h-5 text-emerald-600" /> : 
                             notification.type === 'warning' ? <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" /> : 
                             <InfoIcon className="w-5 h-5 text-indigo-600" />}
                        </div>
                        <div>
                            <p className="text-sm font-black tracking-tight">{notification.message}</p>
                            {notification.description && <p className="text-[10px] font-bold text-white/60 uppercase">{notification.description}</p>}
                        </div>
                        <button onClick={() => setNotification(null)} className="ml-auto p-1 hover:bg-white/10 rounded-full transition-colors">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {isImportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={() => setIsImportModalOpen(false)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Rule Ingestion Hub</h3>
                                <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-0.5">Bulk automation logic upload</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setShowInstructions(!showInstructions)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 border-2 ${showInstructions ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <InfoIcon className="w-4 h-4" /> Help
                                </button>
                                <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl text-xs font-black uppercase text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-2">
                                    <DownloadIcon className="w-4 h-4" /> Template
                                </button>
                                <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            {/* INSTRUCTIONS SIDEBAR */}
                            {showInstructions && (
                                <div className="w-full md:w-80 border-r border-slate-100 bg-slate-50 p-6 overflow-y-auto custom-scrollbar animate-slide-in-left">
                                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-4">Ingestion Protocols</h4>
                                    <div className="space-y-6 text-xs text-slate-600 leading-relaxed font-medium">
                                        <section>
                                            <p className="font-black text-slate-800 uppercase mb-2 text-[9px] tracking-tight">Format Requirements</p>
                                            <p>Upload a <strong>CSV</strong> file with headers. You can use our template to ensure AI generates compatible rows.</p>
                                        </section>
                                        <section>
                                            <p className="font-black text-slate-800 uppercase mb-2 text-[9px] tracking-tight">Boolean Logic</p>
                                            <p>Use <code className="bg-slate-200 px-1 rounded">||</code> (pipe) symbols in the "Match Value" column to create <strong>OR</strong> logic (e.g. <code className="bg-indigo-50 text-indigo-700 px-1 rounded">UBER || LYFT</code>).</p>
                                        </section>
                                        <section>
                                            <p className="font-black text-slate-800 uppercase mb-2 text-[9px] tracking-tight">Match Fields</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                <li><strong>description</strong> (Default)</li>
                                                <li><strong>amount</strong> (Use numeric values)</li>
                                                <li><strong>accountId</strong> (Use system IDs)</li>
                                            </ul>
                                        </section>
                                        <section>
                                            <p className="font-black text-slate-800 uppercase mb-2 text-[9px] tracking-tight">Operators</p>
                                            <p>Supported: <code className="text-indigo-600">contains</code>, <code className="text-indigo-600">starts_with</code>, <code className="text-indigo-600">equals</code>, <code className="text-indigo-600">less_than</code>, <code className="text-indigo-600">greater_than</code>.</p>
                                        </section>
                                    </div>
                                </div>
                            )}

                            {/* MAIN UPLOAD AREA */}
                            <div className="flex-1 p-8 space-y-8 bg-white overflow-y-auto custom-scrollbar">
                                {importError && (
                                    <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-3 animate-slide-up">
                                        <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-black text-red-800 uppercase">Verification Failed</p>
                                            <p className="text-xs text-red-700 mt-1">{importError}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex bg-slate-100 p-1 rounded-[1.25rem] w-full max-w-sm mx-auto">
                                    <button onClick={() => { setImportMethod('upload'); setImportError(null); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${importMethod === 'upload' ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <UploadIcon className="w-4 h-4" /> File
                                    </button>
                                    <button onClick={() => { setImportMethod('paste'); setImportError(null); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${importMethod === 'paste' ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <FileCodeIcon className="w-4 h-4" /> Text
                                    </button>
                                </div>

                                {importMethod === 'upload' ? (
                                    <div className="space-y-6">
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center group hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-inner bg-slate-50/20"
                                        >
                                            <CloudArrowUpIcon className="w-16 h-16 text-slate-300 group-hover:text-indigo-500 mb-6 transition-transform group-hover:-translate-y-2 duration-300" />
                                            <p className="text-lg font-black text-slate-700">Drop Logic Manifest</p>
                                            <p className="text-xs text-slate-400 mt-2 uppercase font-bold tracking-widest">CSV, Excel, or JSON accepted</p>
                                        </div>
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx" onChange={handleFileUpload} />
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="relative">
                                            <textarea 
                                                value={pastedRules}
                                                onChange={e => setPastedRules(e.target.value)}
                                                placeholder={`Rule Name, Match Field, Operator, Match Value...\n"Taxi Service", "description", "contains", "Uber || Lyft"`}
                                                className="w-full h-80 p-6 font-mono text-[11px] bg-slate-900 text-indigo-100 border-none rounded-[2rem] focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none resize-none shadow-2xl"
                                            />
                                            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[8px] font-black text-indigo-300 uppercase tracking-widest backdrop-blur-sm border border-white/5">
                                                Raw Data Stream
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handlePasteSubmit}
                                            disabled={!pastedRules.trim()}
                                            className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-2xl shadow-indigo-200 disabled:opacity-30 transition-all active:scale-95"
                                        >
                                            Verify & Commit logic
                                        </button>
                                    </div>
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
