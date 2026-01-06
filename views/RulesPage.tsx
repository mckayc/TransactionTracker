
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location, User, RuleImportDraft } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, ChevronDownIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, CloudArrowUpIcon, InfoIcon, ShieldCheckIcon, TagIcon, WrenchIcon, UsersIcon, UserGroupIcon, DownloadIcon } from '../components/Icons';
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
    { id: 'all', label: 'All Scopes', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'payeeId', label: 'Payees', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'merchantId', label: 'Merchants', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'locationId', label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
    { id: 'metadata', label: 'Metadata', icon: <RobotIcon className="w-4 h-4" /> },
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onSaveRules, onDeleteRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSaveCategories, onSavePayee, onSavePayees, onSaveMerchant, onSaveMerchants, onSaveLocation, onSaveLocations, onSaveTag, onAddTransactionType, onSaveUser 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    
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
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Scope Filter</p>
                    <div className="space-y-0.5">
                        {RULE_DOMAINS.map(domain => (
                            <button 
                                key={domain.id} 
                                onClick={() => { setSelectedDomain(domain.id); setSelectedRuleId(null); }}
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
                                <BoxIcon className="w-10 h-10 mb-2 opacity-10" /><p className="text-[11px] font-bold">No matching rules.</p>
                            </div>
                        ) : (
                            filteredRules.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => setSelectedRuleId(r.id)}
                                    className={`p-3 rounded-xl cursor-pointer border transition-all flex flex-col gap-1 group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold truncate ${selectedRuleId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{RULE_DOMAINS.find(d => d.id === r.ruleCategory)?.label || 'General'}</p>
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
                                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">{activeRule.ruleCategory}</span>
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
                            <p className="text-slate-500 max-w-sm mt-4 font-medium">Architect deterministic logic to automate your financial classification. Select a rule to inspect its logic.</p>
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
                                        <div className="prose prose-sm text-slate-600">
                                            <h3 className="text-xl font-bold text-slate-800">Import Manifest</h3>
                                            <p>Use our structured manifest to migrate entire logic sets at once.</p>
                                            <button onClick={downloadTemplate} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md mt-4"><DownloadIcon className="w-4 h-4" /> Download Manifest Template</button>
                                        </div>
                                        <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) parseRulesFromFile(f).then(prepareDrafts); }} className={`h-48 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all group ${isDragging ? 'bg-indigo-50 border-indigo-500 scale-[1.02]' : 'bg-slate-50 border-slate-200 hover:border-indigo-400'}`}>
                                            <CloudArrowUpIcon className={`w-12 h-12 mb-2 ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                            <input type="file" onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" id="rule-file" />
                                            <label htmlFor="rule-file" className="font-bold text-indigo-600 cursor-pointer hover:underline text-sm">Browse Logic Manifest</label>
                                        </div>
                                    </div>
                                    <div className="flex flex-col h-full space-y-4">
                                        <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste rows from your manifest spreadsheet here..." className="flex-1 p-4 border-2 border-slate-100 rounded-3xl font-mono text-[10px] bg-slate-50 focus:bg-white transition-all outline-none resize-none" />
                                        <button onClick={() => prepareDrafts(parseRulesFromLines(importText.split('\n')))} disabled={!importText.trim()} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 disabled:opacity-30">Process & Verify Manifest</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RulesPage;
