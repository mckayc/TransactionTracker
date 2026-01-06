
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
    { id: 'all', label: 'All Scopes', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: 'description', label: 'Descriptions', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'blueprints', label: 'Smart Templates', icon: <SparklesIcon className="w-4 h-4" /> },
    { id: 'payeeId', label: 'Payees', icon: <BoxIcon className="w-4 h-4" /> },
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Rule Engine</h1>
                    <p className="text-slate-500 mt-1">Logic mapping and data normalization.</p>
                </div>
                <button onClick={() => setIsAiCreatorOpen(!isAiCreatorOpen)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg font-bold transition-all ${isAiCreatorOpen ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                    <SparklesIcon className="w-5 h-5" /> {isAiCreatorOpen ? 'Close AI Tools' : 'Smart Templates'}
                </button>
            </div>

            {isAiCreatorOpen && !isCreating && (
                <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-xl animate-fade-in space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-2"><RobotIcon className="w-6 h-6 text-indigo-600" />Blueprint Creator</h3>
                            <p className="text-sm text-slate-600 font-medium">Upload a statement to teach the AI by example. This creates a few-shot Smart Template.</p>
                            <FileUpload onFileUpload={handleBlueprintUpload} disabled={isAiGenerating} multiple={false} label="Click or drag files to import" />
                        </div>
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 space-y-4">
                            <h4 className="font-bold text-indigo-900 flex items-center gap-2"><LightBulbIcon className="w-4 h-4"/>Teaching by Example</h4>
                            <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                                Smart Templates differ from standard rules. By mapping a few rows manually, you define the "Blueprint" for this specific document source. Gemini uses this few-shot training to handle every row thereafter with deterministic accuracy.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                <div className="w-56 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-3 shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Navigation</p>
                    <div className="space-y-0.5">
                        {DOMAINS.map(domain => (
                            <button key={domain.id} onClick={() => setSelectedDomain(domain.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedDomain === domain.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {domain.icon}<span>{domain.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 shrink-0">
                    <div className="p-3 border-b border-slate-100"><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border rounded-xl text-xs" /></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {selectedDomain === 'blueprints' ? (
                            filteredBlueprints.map(b => (
                                <div key={b.id} onClick={() => handleSelectBlueprint(b.id)} className={`p-3 rounded-xl cursor-pointer border transition-all flex flex-col group ${selectedBlueprintId === b.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-center"><span className="text-xs font-bold truncate">{b.name}</span><SparklesIcon className="w-3 h-3 text-indigo-500" /></div>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">{b.examples.length} Examples</p>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteBlueprint(b.id); }} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            filteredRules.map(r => (
                                <div key={r.id} onClick={() => handleSelectRule(r.id)} className={`p-3 rounded-xl cursor-pointer border transition-all flex flex-col group ${selectedRuleId === r.id ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-center"><span className="text-xs font-bold truncate">{r.name}</span>{r.isAiDraft && <SparklesIcon className="w-3 h-3 text-indigo-500" />}</div>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">{r.scope}</p>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setPreviewRule(r); }} className="p-1 text-emerald-500"><PlayIcon className="w-3.5 h-3.5" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteRule(r.id); }} className="p-1 text-slate-300 hover:text-red-500"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 border-t bg-slate-50 rounded-b-2xl"><button onClick={handleNew} className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md">New Inbound Logic</button></div>
                </div>

                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    {selectedBlueprintId ? (
                        <div className="flex-1 flex flex-col min-h-0 animate-fade-in p-8">
                             <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800">{blueprints.find(b => b.id === selectedBlueprintId)?.name}</h3>
                                    <p className="text-sm text-slate-500 uppercase font-bold tracking-widest mt-1">Smart Template Training Set</p>
                                </div>
                                <button onClick={() => handleDeleteBlueprint(selectedBlueprintId)} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"><DeleteIcon className="w-5 h-5"/></button>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Training Rows</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    {blueprints.find(b => b.id === selectedBlueprintId)?.examples.map((ex, i) => (
                                        <div key={i} className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-mono text-slate-500 truncate">{ex.rawLine}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase">Category: {categories.find(c => c.id === ex.suggestedRule.setCategoryId)?.name || 'N/A'}</div>
                                                    <div className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-black uppercase">Payee: {payees.find(p => p.id === ex.suggestedRule.setPayeeId)?.name || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (selectedRuleId || isCreating) ? (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 animate-fade-in">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div><h3 className="text-xl font-black">{isCreating ? 'Forge New Logic' : 'Refine Rule'}</h3></div>
                                <div className="flex gap-2">
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg uppercase text-[10px]">Save Rule</button>
                                    <button type="button" onClick={() => { setSelectedRuleId(null); setIsCreating(false); }} className="p-2 hover:bg-slate-200 rounded-full"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rule Identity</label><input type="text" value={ruleName} onChange={e => setRuleName(e.target.value)} className="w-full p-3 border rounded-xl font-bold" required /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope</label><select value={ruleScope} onChange={e => setRuleScope(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-white">{DOMAINS.filter(d => d.id !== 'all' && d.id !== 'blueprints').map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
                                </div>
                                <div className="space-y-4"><h4 className="text-sm font-black text-slate-400 uppercase">Logic Conditions</h4><div className="p-6 bg-slate-50 rounded-3xl border shadow-inner"><RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} /></div></div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center"><h4 className="text-sm font-black text-slate-400 uppercase">Transform Actions</h4><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={skipImport} onChange={e => setSkipImport(e.target.checked)} className="rounded text-red-600" /><span className="text-xs font-bold text-red-600">SKIP INGESTION</span></label></div>
                                    {!skipImport && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Set Category</label><select value={actionCategoryId} onChange={e => setActionCategoryId(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-white"><option value="">-- No Change --</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Assign User</label><select value={actionUserId} onChange={e => setActionUserId(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-white"><option value="">-- No Change --</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                                            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Counterparty</label><select value={actionPayeeId} onChange={e => setActionPayeeId(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-white"><option value="">-- No Change --</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="p-6 bg-slate-50 rounded-full border border-slate-200 mb-6"><LightBulbIcon className="w-16 h-16 text-indigo-300" /></div>
                            <h3 className="text-2xl font-black text-slate-800">Master Data Editor</h3>
                            <p className="text-slate-500 max-w-sm mt-2 font-medium">Select an item from the left to refine its properties, or create a new logic blueprint to automate your ledger.</p>
                            <button onClick={handleNew} className="mt-8 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg transition-transform hover:-translate-y-1">Add First Item</button>
                        </div>
                    )}
                </div>
            </div>

            <BlueprintWorkshop isOpen={isWorkshopOpen} onClose={() => setIsWorkshopOpen(false)} onSave={handleSaveBlueprint} rawLines={workshopRawLines} categories={categories} payees={payees} merchants={merchants} locations={locations} users={users} types={transactionTypes} />
            {previewRule && <RulePreviewModal isOpen={!!previewRule} onClose={() => setPreviewRule(null)} onApply={onUpdateTransactions} rule={previewRule} transactions={transactions} accounts={accounts} transactionTypes={transactionTypes} categories={categories} payees={payees} />}
        </div>
    );
};

export default RulesPage;
