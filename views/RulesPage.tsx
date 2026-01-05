
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag } from '../types';
// Added ChevronDownIcon to imports
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon, SlashIcon, ChevronDownIcon } from '../components/Icons';
import RulePreviewModal from '../components/RulePreviewModal';
import { generateUUID } from '../utils';
import RuleBuilder from '../components/RuleBuilder';

interface RulesPageProps {
    rules: ReconciliationRule[];
    onSaveRule: (rule: ReconciliationRule) => void;
    onDeleteRule: (ruleId: string) => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    transactions: Transaction[];
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onSaveCategory: (category: Category) => void;
    onSavePayee: (payee: Payee) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
}

const RuleCard: React.FC<{
    rule: ReconciliationRule;
    onEdit: (rule: ReconciliationRule) => void;
    onRun: (rule: ReconciliationRule) => void;
    onDelete: (ruleId: string) => void;
    categories: Category[];
    payees: Payee[];
    types: TransactionType[];
    tags: Tag[];
}> = ({ rule, onEdit, onRun, onDelete, categories, payees, types, tags }) => {
    
    const getConditionSummary = () => {
        if (rule.conditions && rule.conditions.length > 0) {
            const first = rule.conditions[0] as RuleCondition; 
            if (!first.field) return "Complex Rule";
            
            let text = "";
            if (first.field === 'description') text = `Desc ${first.operator === 'contains' ? 'has' : first.operator} "${first.value}"`;
            else if (first.field === 'amount') text = `Amt ${first.operator === 'equals' ? '=' : first.operator} ${first.value}`;
            else if (first.field === 'accountId') {
                if (first.operator === 'equals') text = 'Acct Is (Exact Match)';
                else text = `Acct Name ${first.operator === 'contains' ? 'contains' : first.operator} "${first.value}"`;
            }
            
            if (rule.conditions.length > 1) {
                return `${text} +${rule.conditions.length - 1}`;
            }
            return text;
        }
        if (rule.descriptionContains) return `Desc has "${rule.descriptionContains}"`;
        if (rule.amountEquals) return `Amt = ${rule.amountEquals}`;
        return "All Transactions";
    };

    const getActionSummary = () => {
        if (rule.skipImport) return "SKIP IMPORT";
        
        const actions = [];
        if (rule.setCategoryId) {
            const name = categories.find(c => c.id === rule.setCategoryId)?.name;
            if (name) actions.push(`Cat: ${name}`);
        }
        if (rule.setPayeeId) {
            const name = payees.find(p => p.id === rule.setPayeeId)?.name;
            if (name) actions.push(`Payee: ${name}`);
        }
        if (rule.setTransactionTypeId) {
            const name = types.find(t => t.id === rule.setTransactionTypeId)?.name;
            if (name) actions.push(`Type: ${name}`);
        }
        if (rule.setDescription) actions.push(`Rename`);
        if (rule.assignTagIds && rule.assignTagIds.length > 0) actions.push(`+Tags`);

        if (actions.length === 0) return "No Actions";
        if (actions.length === 1) return actions[0];
        return `${actions[0]} +${actions.length - 1}`;
    };

    const summaryCond = getConditionSummary();
    const summaryAction = getActionSummary();

    return (
        <div 
            className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-3 flex flex-col gap-2 group h-full cursor-pointer"
            onClick={() => onEdit(rule)}
        >
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-800 text-sm truncate pr-2 flex-grow" title={rule.name}>{rule.name}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2">
                    {!rule.skipImport && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRun(rule); }} 
                            className="text-slate-400 hover:text-green-600 p-0.5" 
                            title="Run Rule on Existing Data"
                        >
                            <PlayIcon className="w-4 h-4" />
                        </button>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(rule.id); }} 
                        className="text-slate-400 hover:text-red-600 p-0.5" 
                        title="Delete Rule"
                    >
                        <DeleteIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="flex items-center text-[10px] gap-2 mt-auto">
                 <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded px-2 py-1 truncate text-slate-600 font-bold uppercase tracking-tighter" title={summaryCond}>
                    {summaryCond}
                 </div>
                 <span className="text-slate-300 font-bold">→</span>
                 <div className={`flex-1 min-w-0 border rounded px-2 py-1 truncate font-black text-center uppercase tracking-tighter ${rule.skipImport ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`} title={summaryAction}>
                    {summaryAction}
                 </div>
            </div>
        </div>
    );
};

const RuleEditorModal: React.FC<{
    isOpen: boolean;
    selectedRule: ReconciliationRule | null;
    onSave: (rule: ReconciliationRule) => void;
    onClose: () => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    onSaveCategory: (category: Category) => void;
    onSavePayee: (payee: Payee) => void;
    onSaveTag: (tag: Tag) => void;
    onAddTransactionType: (type: TransactionType) => void;
}> = ({ isOpen, selectedRule, onSave, onClose, accounts, transactionTypes, categories, tags, payees, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType }) => {
    
    const [name, setName] = useState('');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setDescription, setSetDescription] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (selectedRule) {
                setName(selectedRule.name);
                if (selectedRule.conditions && selectedRule.conditions.length > 0) {
                    const validConditions = selectedRule.conditions.filter(c => 'field' in c) as RuleCondition[];
                    setConditions(validConditions);
                } else {
                    const newConditions: RuleCondition[] = [];
                    if (selectedRule.descriptionContains) newConditions.push({ id: generateUUID(), field: 'description', operator: 'contains', value: selectedRule.descriptionContains, nextLogic: 'AND' });
                    if (selectedRule.accountId) newConditions.push({ id: generateUUID(), field: 'accountId', operator: 'equals', value: selectedRule.accountId, nextLogic: 'AND' });
                    if (selectedRule.amountEquals) newConditions.push({ id: generateUUID(), field: 'amount', operator: 'equals', value: selectedRule.amountEquals, nextLogic: 'AND' });
                    setConditions(newConditions.length > 0 ? newConditions : [{ id: generateUUID(), field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                }
                setSetCategoryId(selectedRule.setCategoryId || '');
                setSetPayeeId(selectedRule.setPayeeId || '');
                setSetTransactionTypeId(selectedRule.setTransactionTypeId || '');
                setSetDescription(selectedRule.setDescription || '');
                setAssignTagIds(new Set(selectedRule.assignTagIds || []));
                setSkipImport(!!selectedRule.skipImport);
            } else {
                setName('');
                setConditions([{ id: generateUUID(), field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                setSetCategoryId('');
                setSetPayeeId('');
                setSetTransactionTypeId('');
                setSetDescription('');
                setAssignTagIds(new Set());
                setSkipImport(false);
            }
        }
    }, [isOpen, selectedRule]);
    
    // Recursive helper for deep hierarchies (parents, children, grandchildren)
    const getSortedOptions = (items: any[], parentId?: string, depth = 0): { id: string, name: string }[] => {
        return items
            .filter(i => i.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .flatMap(item => [
                { id: item.id, name: `${'\u00A0'.repeat(depth * 3)}${depth > 0 ? '⌞ ' : ''}${item.name}` },
                ...getSortedOptions(items, item.id, depth + 1)
            ]);
    };

    const sortedPayeeOptions = useMemo(() => getSortedOptions(payees), [payees]);
    const sortedCategoryOptions = useMemo(() => getSortedOptions(categories), [categories]);

    if (!isOpen) return null;

    const handleCreateCategory = () => {
        const name = prompt("Enter new Category name:");
        if (name && name.trim()) {
            const newCat = { id: generateUUID(), name: name.trim() };
            onSaveCategory(newCat);
            setSetCategoryId(newCat.id);
        }
    };

    const handleCreatePayee = () => {
        const name = prompt("Enter new Source/Entity name:");
        if (name && name.trim()) {
            const newPayee = { id: generateUUID(), name: name.trim() };
            onSavePayee(newPayee);
            setSetPayeeId(newPayee.id);
        }
    };

    const handleCreateType = () => {
        const name = prompt("Enter new Transaction Type name:");
        if (name && name.trim()) {
            const newType = { id: generateUUID(), name: name.trim(), balanceEffect: 'expense' as const, isDefault: false };
            onAddTransactionType(newType);
            setSetTransactionTypeId(newType.id);
        }
    };

    const handleCreateTag = () => {
        const name = prompt("Enter new Tag name:");
        if (name && name.trim()) {
            const newTag = { 
                id: generateUUID(), 
                name: name.trim(), 
                color: 'bg-slate-100 text-slate-800' 
            };
            onSaveTag(newTag);
            setAssignTagIds(prev => new Set(prev).add(newTag.id));
        }
    };

    const toggleTag = (tagId: string) => {
        setAssignTagIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tagId)) newSet.delete(tagId);
            else newSet.add(tagId);
            return newSet;
        });
    };

    const handleSave = () => {
        if (!name.trim()) {
            alert('Rule Name is required.');
            return;
        }
        onSave({
            id: selectedRule?.id || generateUUID(),
            name: name.trim(),
            conditions,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            setDescription: setDescription || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport
        });
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[110] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center px-6 py-4 border-b bg-white rounded-t-2xl">
                    <h2 className="text-xl font-bold text-slate-700">{selectedRule ? 'Edit Rule' : 'Create New Rule'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 bg-slate-50 flex-grow custom-scrollbar">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Rule Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly Netflix Subscription" className="w-full p-2.5 border rounded-xl font-bold text-slate-800" required />
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-tighter">
                            <SparklesIcon className="w-4 h-4 text-indigo-500"/> 
                            1. Define Matching Criteria
                        </h3>
                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-tighter">
                                <CheckCircleIcon className="w-4 h-4 text-green-500"/>
                                2. Automatic Transformation
                            </h3>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300 hover:border-red-400 transition-colors shadow-sm group select-none">
                                <input 
                                    type="checkbox" 
                                    checked={skipImport} 
                                    onChange={() => setSkipImport(!skipImport)} 
                                    className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" 
                                />
                                <span className="text-[10px] font-black text-red-700 uppercase flex items-center gap-1">
                                    <SlashIcon className="w-3 h-3" /> Exclude from Import
                                </span>
                            </label>
                        </div>

                        {skipImport ? (
                            <div className="py-8 text-center bg-red-50 rounded-xl border border-red-100 border-dashed animate-pulse">
                                <p className="text-sm font-bold text-red-800 uppercase">Automatic Filtering Active</p>
                                <p className="text-[11px] text-red-600 mt-1 max-w-sm mx-auto font-medium leading-relaxed">Transactions matching these criteria will be automatically unchecked and suppressed during future statement imports.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Set Category</label>
                                    <div className="flex gap-1">
                                        <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-2 text-xs border rounded-lg font-bold text-slate-700">
                                            <option value="">-- Don't Change --</option>
                                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                        <button type="button" onClick={handleCreateCategory} className="px-2 bg-slate-100 text-slate-600 rounded-lg border hover:bg-slate-200 font-bold">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Set Entity</label>
                                    <div className="flex gap-1">
                                        <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-2 text-xs border rounded-lg font-bold text-slate-700">
                                            <option value="">-- Don't Change --</option>
                                            {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <button type="button" onClick={handleCreatePayee} className="px-2 bg-slate-100 text-slate-600 rounded-lg border hover:bg-slate-200 font-bold">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Set Type</label>
                                    <div className="flex gap-1">
                                        <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2 text-xs border rounded-lg font-bold text-slate-700">
                                            <option value="">-- Don't Change --</option>
                                            {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </select>
                                        <button type="button" onClick={handleCreateType} className="px-2 bg-slate-100 text-slate-600 rounded-lg border hover:bg-slate-200 font-bold">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Rename To</label>
                                    <input type="text" value={setDescription} onChange={(e) => setSetDescription(e.target.value)} placeholder="e.g., Clean Name" className="w-full p-2 text-xs border rounded-lg font-bold text-slate-700" />
                                </div>
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Assign Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-2 py-1 rounded-full text-[10px] border font-black uppercase transition-all ${assignTagIds.has(tag.id) ? tag.color + ' ring-1 ring-offset-1 ring-slate-400 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={handleCreateTag}
                                            className="px-2 py-1 rounded-full text-[10px] border-2 border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 bg-white transition-all active:scale-95 font-black uppercase"
                                            title="Create new tag"
                                        >
                                            + New
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Cancel</button>
                    <button onClick={handleSave} className="px-10 py-2 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">Save Rule</button>
                </div>
            </div>
        </div>
    );
};

const RulesPage: React.FC<RulesPageProps> = ({ rules, onSaveRule, onDeleteRule, accounts, transactionTypes, categories, tags, payees, transactions, onUpdateTransactions, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType }) => {
    const [selectedRule, setSelectedRule] = useState<ReconciliationRule | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [ruleToRun, setRuleToRun] = useState<ReconciliationRule | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc'>('name_asc');

    const handleOpenEditor = (rule: ReconciliationRule | null) => {
        setSelectedRule(rule);
        setIsModalOpen(true);
    };

    const handleCloseEditor = () => {
        setSelectedRule(null);
        setIsModalOpen(false);
    };

    const handleSave = (rule: ReconciliationRule) => {
        onSaveRule(rule);
        handleCloseEditor();
    };

    const handleApplyRule = (transactionsToUpdate: Transaction[]) => {
        onUpdateTransactions(transactionsToUpdate);
        setRuleToRun(null);
    };

    const filteredRules = useMemo(() => {
        let result = rules.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        result.sort((a, b) => {
            if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
            if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
            return 0;
        });
        return result;
    }, [rules, searchTerm, sortBy]);
    
    return (
        <>
            <div className="space-y-6 h-full flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Automation Rules</h1>
                        <p className="text-slate-500 mt-1">Manage logic to automatically categorize and clean your transactions.</p>
                    </div>
                    <button 
                        onClick={() => handleOpenEditor(null)} 
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 font-black text-sm transition-all active:scale-95"
                    >
                        <AddIcon className="w-5 h-5"/>
                        <span>Create Rule</span>
                    </button>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 flex-shrink-0">
                    <div className="relative flex-grow group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchCircleIcon className="w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Filter rules by name..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="block w-full pl-10 pr-4 py-2 border border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-sm" 
                        />
                    </div>
                    <div className="relative min-w-[200px] group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SortIcon className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as any)} 
                            className="block w-full pl-10 pr-10 py-2 border border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none appearance-none font-bold text-sm text-slate-700 cursor-pointer"
                        >
                            <option value="name_asc">Name (A-Z)</option>
                            <option value="name_desc">Name (Z-A)</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
                    {filteredRules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredRules.map(rule => (
                                <RuleCard key={rule.id} rule={rule} onEdit={handleOpenEditor} onRun={setRuleToRun} onDelete={onDeleteRule} categories={categories} payees={payees} types={transactionTypes} tags={tags}/>
                            ))}
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 animate-fade-in">
                            <SparklesIcon className="w-12 h-12 mb-3 opacity-20" />
                            <p className="font-bold">No rules found.</p>
                            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">Refine search or create first rule</p>
                        </div>
                    )}
                </div>
            </div>
            <RuleEditorModal isOpen={isModalOpen} selectedRule={selectedRule} onSave={handleSave} onClose={handleCloseEditor} accounts={accounts} transactionTypes={transactionTypes} categories={categories} tags={tags} payees={payees} onSaveCategory={onSaveCategory} onSavePayee={onSavePayee} onSaveTag={onSaveTag} onAddTransactionType={onAddTransactionType} />
            {ruleToRun && (
                <RulePreviewModal isOpen={!!ruleToRun} onClose={() => setRuleToRun(null)} onApply={handleApplyRule} rule={ruleToRun} transactions={transactions} accounts={accounts} transactionTypes={transactionTypes} categories={categories} payees={payees} />
            )}
        </>
    );
};

export default RulesPage;
