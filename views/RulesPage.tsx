
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag, Merchant, Location, User, SystemSettings, BlueprintTemplate } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, CloseIcon, SparklesIcon, RobotIcon, TableIcon, BoxIcon, MapPinIcon, InfoIcon, ShieldCheckIcon, TagIcon, LightBulbIcon, WrenchIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import RuleBuilder from '../components/RuleBuilder';
import RulePreviewModal from '../components/RulePreviewModal';
import BlueprintWorkshop from '../components/BlueprintWorkshop';
import FileUpload from '../components/FileUpload';
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

const DOMAINS = [
    { id: 'all', label: 'All Logic Scopes', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'blueprints', label: 'Smart Templates', icon: <SparklesIcon className="w-4 h-4" /> },
    { id: 'payeeId', label: 'Counterparties', icon: <BoxIcon className="w-4 h-4" /> },
    { id: 'tagIds', label: 'Taxonomy (Tags)', icon: <TagIcon className="w-4 h-4" /> },
];

const RulesPage: React.FC<RulesPageProps> = ({ 
    rules, onSaveRule, onDeleteRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, transactions, onUpdateTransactions, onSaveCategory, onSavePayee, onSaveMerchant, onSaveLocation, onSaveTag, onAddTransactionType, systemSettings 
}) => {
    const [selectedDomain, setSelectedDomain] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);
    
    const [blueprints, setBlueprints] = useState<BlueprintTemplate[]>([]);
    const [isWorkshopOpen, setIsWorkshopOpen] = useState(false);
    const [workshopRawLines, setWorkshopRawLines] = useState<string[]>([]);
    const [isAiGenerating, setIsAiGenerating] = useState(false);

    const [previewRule, setPreviewRule] = useState<ReconciliationRule | null>(null);

    // Rule Form states
    const [ruleName, setRuleName] = useState('');
    const [ruleScope, setRuleScope] = useState('description');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [actionCategoryId, setActionCategoryId] = useState('');
    const [actionPayeeId, setActionPayeeId] = useState('');
    const [actionUserId, setActionUserId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    useEffect(() => {
        const loadBlueprints = async () => {
            try {
                const data = await api.loadAll();
                setBlueprints(data.blueprints || []);
            } catch (e) {}
        };
        loadBlueprints();
    }, []);

    const filteredRules = useMemo(() => {
        let list = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedDomain !== 'all' && selectedDomain !== 'blueprints') list = list.filter(r => r.scope === selectedDomain);
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [rules, searchTerm, selectedDomain]);

    const filteredBlueprints = useMemo(() => blueprints.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())), [blueprints, searchTerm]);

    const handleSelectRule = (id: string) => {
        const r = rules.find(x => x.id === id);
        if (!r) return;
        setSelectedRuleId(id);
        setSelectedBlueprintId(null);
        setIsCreating(false);
        setRuleName(r.name);
        setRuleScope(r.scope || 'description');
        setConditions(r.conditions);
        setActionCategoryId(r.setCategoryId || '');
        setActionPayeeId(r.setPayeeId || '');
        setActionUserId(r.setUserId || '');
        setAssignTagIds(new Set(r.assignTagIds || []));
        setSkipImport(!!r.skipImport);
    };

    const handleSelectBlueprint = (id: string) => {
        setSelectedBlueprintId(id);
        setSelectedRuleId(null);
        setIsCreating(false);
    };

    const handleNew = () => {
        setSelectedRuleId(null);
        setSelectedBlueprintId(null);
        setIsCreating(true);
        setRuleName('');
        setRuleScope('description');
        setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
        setActionCategoryId('');
        setActionPayeeId('');
        setActionUserId('');
        setAssignTagIds(new Set());
        setSkipImport(false);
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
            setUserId: actionUserId || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport
        };
        onSaveRule(rule);
        setIsCreating(false);
        setSelectedRuleId(rule.id);
    };

    const handleBlueprintUpload = async (files: File[]) => {
        const file = files[0];
        if (!file) return;
        setIsAiGenerating(true);
        try {
            const reader = new FileReader();
            const text = await new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string);
                reader.readAsText(file);
            });
            setWorkshopRawLines(text.split('\n').filter(l => l.trim()).slice(0, 50));
            setIsWorkshopOpen(true);
        } catch (e) {
            alert("Failed to read document.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleSaveBlueprint = async (template: BlueprintTemplate) => {
        const updated = [...blueprints, template];
        setBlueprints(updated);
        await api.save('blueprints', updated);
        handleSelectBlueprint(template.id);
    };

    const handleDeleteBlueprint = async (id: string) => {
        if (!confirm("Permanently delete this Smart Template?")) return;
        const updated = blueprints.filter(b => b.id !== id);
        setBlueprints(updated);
        await api.save('blueprints', updated);
        if (selectedBlueprintId === id) setSelectedBlueprintId(null);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Rule Engine</h1>
                    <p className="text-sm text-slate-500 font-medium">Logic mapping and data normalization architect.</p>
                </div>
                <button onClick={() => setIsAiCreatorOpen(!isAiCreatorOpen)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg font-black transition-all uppercase text-[10px] tracking-widest ${isAiCreatorOpen ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}>
                    <SparklesIcon className="w-5 h-5" /> {isAiCreatorOpen ? 'Close Factory' : 'Smart Templates'}
                </button>
            </div>

            {isAiCreatorOpen && !isCreating && (
                <div className="bg-white border-2 border-indigo-100 rounded-3xl p-8 shadow-xl animate-fade-in space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><RobotIcon className="w-7 h-7 text-indigo-600" />Blueprint Workshop</h3>
                            <p className="text-sm text-slate-600 font-medium leading-relaxed">Upload a statement to teach Gemini by example. This creates a deterministic few-shot Smart Template for that specific bank's format.</p>
                            <FileUpload onFileUpload={handleBlueprintUpload} disabled={isAiGenerating} multiple={false} label="Click or drag files to import" />
                        </div>
                        <div className="bg-indigo-50 p-7 rounded-[2rem] border-2 border-indigo-100 space-y-4 relative overflow-hidden">
                            <h4 className="font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 text-xs"><LightBulbIcon className="w-4 h-4"/> Instruction Manual</h4>
                            <p className="text-xs text-indigo-800 leading-relaxed font-semibold">
                                Smart Templates are different from rules. Instead of fuzzy regex, you provide a "Training Set" of raw lines. When you import future files from the same source, Gemini uses your Blueprint to map data with 100% format accuracy.
                            </p>
                            <SparklesIcon className="absolute -right-8 -bottom-8 w-32 h-32 text-indigo-200 opacity-20 pointer-events-none" />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                <div className="w-64 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col p-4 shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-4">Navigational Logic</p>
                    <div className="space-y-1">
                        {DOMAINS.map(domain => (
                            <button key={domain.id} onClick={() => setSelectedDomain(domain.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all uppercase tracking-wider ${selectedDomain === domain.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {domain.icon}<span>{domain.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col min-h-0 shrink-0">
                    <div className="p-4 border-b border-slate-100"><input type="text" placeholder="Search patterns..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" /></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                        {selectedDomain === 'blueprints' ? (
                            filteredBlueprints.map(b => (
                                <div key={b.id} onClick={() => handleSelectBlueprint(b.id)} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col group ${selectedBlueprintId === b.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-800 uppercase truncate">{b.name}</span><SparklesIcon className="w-3.5 h-3.5 text-indigo-500" /></div>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-100/50 px-2 py-0.5 rounded">{b.examples.length} Training Rows</p>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteBlueprint(b.id); }} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            filteredRules.map(r => (
                                <div key={r.id} onClick={() => handleSelectRule(r.id)} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-800 uppercase truncate">{r.name}</span>{r.isAiDraft && <SparklesIcon className="w-3.5 h-3.5 text-indigo-500" />}</div>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{r.scope}</p>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setPreviewRule(r); }} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><PlayIcon className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); }} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><DeleteIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-4 border-t bg-slate-50 rounded-b-[2rem]"><button onClick={handleNew} className="w-full py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">New Manual Pattern</button></div>
                </div>

                <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    {selectedBlueprintId ? (
                        <div className="flex-1 flex flex-col min-h-0 animate-fade-in p-10 overflow-y-auto custom-scrollbar">
                             <div className="flex justify-between items-start mb-10">
                                <div>
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">{blueprints.find(b => b.id === selectedBlueprintId)?.name}</h3>
                                    <p className="text-xs text-slate-400 uppercase font-black tracking-widest mt-1">Teaching Dataset for Gemini AI</p>
                                </div>
                                <button onClick={() => handleDeleteBlueprint(selectedBlueprintId)} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all"><DeleteIcon className="w-6 h-6"/></button>
                            </div>
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><RobotIcon className="w-4 h-4" /> Established Examples</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    {blueprints.find(b => b.id === selectedBlueprintId)?.examples.map((ex, i) => (
                                        <div key={i} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl flex items-center justify-between">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-mono text-slate-500 truncate leading-relaxed select-all cursor-text">{ex.rawLine}</p>
                                                <div className="flex items-center gap-3 mt-3">
                                                    <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm">Category: {categories.find(c => c.id === ex.suggestedRule.setCategoryId)?.name || 'Generic'}</div>
                                                    <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm">Payee: {payees.find(p => p.id === ex.suggestedRule.setPayeeId)?.name || 'Generic'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (selectedRuleId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 animate-fade-in">
                            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                                <div><h3 className="text-2xl font-black tracking-tight text-slate-800">{isCreating ? 'Forge New Logic' : 'Refine Automation'}</h3></div>
                                <div className="flex gap-3">
                                    <button type="submit" className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 uppercase text-[10px] tracking-widest">Save Pattern</button>
                                    <button type="button" onClick={() => { setSelectedRuleId(null); setIsCreating(false); }} className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition-colors shadow-sm"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pattern Identifier</label><input type="text" value={ruleName} onChange={e => setRuleName(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 focus:ring-0" placeholder="e.g. Starbucks Mobile Pay" required /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logical Scope</label><select value={ruleScope} onChange={e => setRuleScope(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white focus:border-indigo-500 focus:ring-0">{DOMAINS.filter(d => d.id !== 'all' && d.id !== 'blueprints').map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
                                </div>
                                <div className="space-y-4"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-600"/> Conditions</h4><div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 shadow-inner"><RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} /></div></div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-600"/> Enrichments</h4><label className="flex items-center gap-3 cursor-pointer bg-red-50 px-4 py-2 rounded-xl border border-red-100"><input type="checkbox" checked={skipImport} onChange={e => setSkipImport(e.target.checked)} className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500" /><span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Exclude Matching Records</span></label></div>
                                    {!skipImport && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Category</label><select value={actionCategoryId} onChange={e => setActionCategoryId(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white focus:border-indigo-500 focus:ring-0"><option value="">-- No Transformation --</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Involved Party</label><select value={actionPayeeId} onChange={e => setActionPayeeId(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white focus:border-indigo-500 focus:ring-0"><option value="">-- No Transformation --</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Responsible User</label><select value={actionUserId} onChange={e => setActionUserId(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-white focus:border-indigo-500 focus:ring-0"><option value="">-- No Transformation --</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/30">
                            <div className="p-10 bg-white rounded-full shadow-xl border border-slate-100 mb-10 animate-bounce-subtle"><LightBulbIcon className="w-20 h-20 text-indigo-400" /></div>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Automation Architect</h3>
                            <p className="text-slate-500 max-w-sm mt-4 font-medium text-lg leading-relaxed">Select an active pattern from the left to refine its logic, or create a Smart Template above to teach Gemini your data format.</p>
                            <button onClick={handleNew} className="mt-12 px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-2xl shadow-indigo-100 transition-transform hover:-translate-y-1 uppercase tracking-widest text-xs">Create Manual Pattern</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Added 'tags' prop to BlueprintWorkshop to fix line 315 error */}
            <BlueprintWorkshop isOpen={isWorkshopOpen} onClose={() => setIsWorkshopOpen(false)} onSave={handleSaveBlueprint} rawLines={workshopRawLines} categories={categories} payees={payees} merchants={merchants} locations={locations} users={users} types={transactionTypes} tags={tags} />
            {previewRule && <RulePreviewModal isOpen={!!previewRule} onClose={() => setPreviewRule(null)} onApply={onUpdateTransactions} rule={previewRule} transactions={transactions} accounts={accounts} transactionTypes={transactionTypes} categories={categories} payees={payees} />}
        </div>
    );
};

export default RulesPage;
