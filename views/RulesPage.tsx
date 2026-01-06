
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location, User, SystemSettings } from '../types';
/* Fixed: Resolved duplicate imports and missing icons from corrupted file content */
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, InfoIcon, ShieldCheckIcon, TagIcon, UserGroupIcon, LightBulbIcon, ExclamationTriangleIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import RuleBuilder from '../components/RuleBuilder';
import RulePreviewModal from '../components/RulePreviewModal';
import { generateRulesFromData } from '../services/geminiService';
import { getRuleSignature } from '../services/ruleService';

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
    
    const [previewRule, setPreviewRule] = useState<ReconciliationRule | null>(null);

    const [aiFile, setAiFile] = useState<File | null>(null);
    const [aiRawData, setAiRawData] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiProposedRules, setAiProposedRules] = useState<(ReconciliationRule & { isExcluded?: boolean })[]>([]);
    const [skippedDuplicateCount, setSkippedDuplicateCount] = useState(0);

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
    const [originalDescription, setOriginalDescription] = useState<string | undefined>(undefined);

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedDomain !== 'all') {
            list = list.filter(r => r.scope === selectedDomain);
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
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
        setOriginalDescription(r.originalDescription);
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
        setOriginalDescription(undefined);
    };

    const handleCancelEdit = () => {
        setSelectedRuleId(null);
        setIsCreating(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const rule: ReconciliationRule = {
            id: selectedRuleId || generateUUID(),
            name: ruleName.trim(),
            scope: ruleScope,
            conditions,
            setCategoryId: actionCategoryId || undefined,
            setPayeeId: actionPayeeId || undefined,
            setMerchantId: actionMerchantId || undefined,
            setLocationId: actionLocationId || undefined,
            setUserId: actionUserId || undefined,
            setTransactionTypeId: actionTypeId || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport,
            originalDescription
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
            const rawProposed = await generateRulesFromData(input, categories, payees, merchants, locations, users, aiPrompt, systemSettings, rules);
            const existingSignatures = new Set(rules.map(r => getRuleSignature(r, categories, payees, merchants, locations)));
            const uniqueProposed: (ReconciliationRule & { isExcluded?: boolean })[] = [];
            let dupCount = 0;
            rawProposed.forEach(p => {
                const sig = getRuleSignature(p, categories, payees, merchants, locations);
                if (existingSignatures.has(sig)) dupCount++;
                else uniqueProposed.push({ ...p, isExcluded: false });
            });
            setAiProposedRules(uniqueProposed);
            setSkippedDuplicateCount(dupCount);
        } catch (e: any) {
            alert(e.message || "AI Analysis failed.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleAcceptAllProposed = () => {
        const toSave = aiProposedRules.filter(r => !r.isExcluded);
        if (toSave.length === 0) return;
        if (!confirm(`Commit ${toSave.length} rules to your engine?`)) return;
        toSave.forEach(proposed => {
            onSaveRule({ ...proposed, isAiDraft: false });
        });
        setAiProposedRules([]);
        setSkippedDuplicateCount(0);
        alert(`Successfully synchronized ${toSave.length} new logical patterns.`);
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

    const toggleTag = (tagId: string) => {
        const next = new Set(assignTagIds);
        if (next.has(tagId)) next.delete(tagId);
        else next.add(tagId);
        setAssignTagIds(next);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Rule Engine</h1>
                    <p className="text-slate-500 mt-1">Intelligent data normalization and logic mapping.</p>
                </div>
                <button onClick={() => setIsAiCreatorOpen(!isAiCreatorOpen)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg font-bold transition-all ${isAiCreatorOpen ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                    <SparklesIcon className="w-5 h-5" /> {isAiCreatorOpen ? 'Close AI Forge' : 'AI Rule Creator'}
                </button>
            </div>

            {isAiCreatorOpen && !isCreating && (
                <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-xl animate-fade-in space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <div className="flex items-center gap-3"><RobotIcon className="w-6 h-6 text-indigo-600" /><h3 className="text-xl font-bold">AI Rule Forge</h3></div>
                        <div className="flex items-center gap-3">
                            {skippedDuplicateCount > 0 && <div className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase flex items-center gap-2"><ExclamationTriangleIcon className="w-3 h-3" />{skippedDuplicateCount} Logical Duplicates Skipped</div>}
                            {aiProposedRules.length > 0 && <button onClick={handleAcceptAllProposed} className="px-6 py-2 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" />Accept Selected ({aiProposedRules.filter(r => !r.isExcluded).length})</button>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            {!aiRawData && (
                                <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setAiFile(f); }} className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                                    <input type="file" onChange={e => setAiFile(e.target.files?.[0] || null)} className="hidden" id="ai-file" />
                                    <label htmlFor="ai-file" className="text-xs font-bold text-indigo-600 cursor-pointer">{aiFile ? aiFile.name : 'Drop file or Select'}</label>
                                </div>
                            )}
                            {!aiFile && <textarea value={aiRawData} onChange={e => setAiRawData(e.target.value)} placeholder="Paste CSV rows..." className="w-full h-32 p-3 border rounded-xl text-[10px] font-mono bg-slate-50" />}
                            <button onClick={handleAiInspect} disabled={(!aiFile && !aiRawData) || isAiGenerating} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2">{isAiGenerating ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}Forge Rules</button>
                        </div>
                        <div className="bg-slate-50 rounded-2xl border p-4 overflow-y-auto max-h-[400px]">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Proposed Rules ({aiProposedRules.length})</h4>
                            <div className="space-y-3">
                                {aiProposedRules.map(r => (
                                    <div key={r.id} className={`bg-white p-4 rounded-xl border transition-all shadow-sm flex justify-between items-start ${r.isExcluded ? 'opacity-40 grayscale' : 'border-indigo-100'}`}>
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h5 className="text-sm font-bold truncate">{r.name}</h5>
                                            <p className="text-[8px] uppercase text-slate-400">{r.scope}</p>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => setAiProposedRules(prev => prev.map(x => x.id === r.id ? {...x, isExcluded: !x.isExcluded} : x))} className="p-1 text-slate-300 hover:text-red-500"><SlashIcon className="w-4 h-4"/></button>
                                            <button onClick={() => { onSaveRule({...r, isAiDraft: false}); setAiProposedRules(prev => prev.filter(x => x.id !== r.id)); }} className="p-1 text-green-600 hover:bg-green-50 rounded"><CheckCircleIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                <div className="w-56 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Scopes</p>
                    <div className="space-y-0.5">
                        {RULE_DOMAINS.map(domain => (
                            <button key={domain.id} onClick={() => setSelectedDomain(domain.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedDomain === domain.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {domain.icon}<span>{domain.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 shrink-0">
                    <div className="p-3 border-b border-slate-100"><input type="text" placeholder="Search rules..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border rounded-xl text-xs" /></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredRules.map(r => (
                            <div key={r.id} onClick={() => handleSelectRule(r.id)} className={`p-2 px-3 rounded-lg cursor-pointer border transition-all flex flex-col group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                <div className="flex justify-between items-center"><span className="text-xs font-bold truncate">{r.name}</span>{r.isAiDraft && <SparklesIcon className="w-3 h-3 text-indigo-500" />}</div>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{r.scope}</p>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleRunRuleManual(e, r)} className="p-1 text-emerald-500"><PlayIcon className="w-3.5 h-3.5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); }} className="p-1 text-slate-300 hover:text-red-500"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t bg-slate-50 rounded-b-2xl"><button onClick={handleNew} className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs">New Rule</button></div>
                </div>

                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    {(selectedRuleId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 animate-fade-in">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div><h3 className="text-xl font-black">Rule Architect</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Logic Design</p></div>
                                <div className="flex gap-2">
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg uppercase text-[10px]">Save Rule</button>
                                    <button type="button" onClick={handleCancelEdit} className="p-2 hover:bg-slate-200 rounded-full"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="col-span-2 space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label><input type="text" value={ruleName} onChange={e => setRuleName(e.target.value)} className="w-full p-4 border rounded-2xl font-bold" required /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope</label><select value={ruleScope} onChange={e => setRuleScope(e.target.value)} className="w-full p-4 border rounded-2xl font-bold">{RULE_DOMAINS.filter(d => d.id !== 'all').map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
                                </div>
                                
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-slate-400 uppercase">Conditions</h4>
                                    <div className="p-6 bg-slate-50 rounded-3xl border shadow-inner"><RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} /></div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-black text-slate-400 uppercase">Actions</h4>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={skipImport} onChange={e => setSkipImport(e.target.checked)} className="rounded text-red-600" />
                                            <span className="text-xs font-bold text-red-600">SKIP INGESTION</span>
                                        </label>
                                    </div>
                                    {!skipImport && (
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase">Category</label>
                                                <select value={actionCategoryId} onChange={e => setActionCategoryId(e.target.value)} className="w-full p-3 border rounded-xl font-bold">
                                                    <option value="">-- No Change --</option>
                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase">Merchant</label>
                                                <select value={actionMerchantId} onChange={e => setActionMerchantId(e.target.value)} className="w-full p-3 border rounded-xl font-bold">
                                                    <option value="">-- No Change --</option>
                                                    {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase">Payee</label>
                                                <select value={actionPayeeId} onChange={e => setActionPayeeId(e.target.value)} className="w-full p-3 border rounded-xl font-bold">
                                                    <option value="">-- No Change --</option>
                                                    {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase">Location</label>
                                                <select value={actionLocationId} onChange={e => setActionLocationId(e.target.value)} className="w-full p-3 border rounded-xl font-bold">
                                                    <option value="">-- No Change --</option>
                                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase">User</label>
                                                <select value={actionUserId} onChange={e => setActionUserId(e.target.value)} className="w-full p-3 border rounded-xl font-bold">
                                                    <option value="">-- No Change --</option>
                                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase">Type</label>
                                                <select value={actionTypeId} onChange={e => setActionTypeId(e.target.value)} className="w-full p-3 border rounded-xl font-bold">
                                                    <option value="">-- No Change --</option>
                                                    {transactionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-full">
                                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">Append Tags</label>
                                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border">
                                                    {tags.map(tag => (
                                                        <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`px-3 py-1.5 rounded-full text-xs border-2 transition-all font-bold ${assignTagIds.has(tag.id) ? tag.color + ' border-indigo-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}>{tag.name}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="p-6 bg-slate-50 rounded-full border mb-6"><LightBulbIcon className="w-16 h-16 text-indigo-300" /></div>
                            <h3 className="text-2xl font-black">Rule Architect</h3>
                            <p className="text-slate-500 max-w-sm mt-2">Select a rule from the list or use the AI Forge to synthesize new logic from your statement rows.</p>
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
