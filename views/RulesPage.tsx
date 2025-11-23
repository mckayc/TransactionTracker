
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleCondition, Tag } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon, SearchCircleIcon, SortIcon, CloseIcon, SparklesIcon, CheckCircleIcon } from '../components/Icons';
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
    onAddTransactionType: (type: TransactionType) => void;
}

// --- Rule Card Component ---
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
    
    const categoryName = categories.find(c => c.id === rule.setCategoryId)?.name;
    const payeeName = payees.find(p => p.id === rule.setPayeeId)?.name;
    const typeName = types.find(t => t.id === rule.setTransactionTypeId)?.name;
    
    const conditionsCount = rule.conditions?.length || (rule.descriptionContains ? 1 : 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <h3 className="font-bold text-slate-800 truncate pr-2" title={rule.name}>{rule.name}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onRun(rule); }} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded" title="Run Rule">
                        <PlayIcon className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(rule); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Edit Rule">
                        <EditIcon className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(rule.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Rule">
                        <DeleteIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="p-4 flex-grow space-y-4">
                {/* Conditions Summary */}
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">If Match</p>
                    <div className="flex flex-wrap gap-2">
                        {rule.conditions && rule.conditions.length > 0 ? (
                            rule.conditions.map((c, i) => (
                                'field' in c ? (
                                    <span key={i} className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs border border-indigo-100">
                                        {c.field === 'description' && 'Desc'}
                                        {c.field === 'amount' && 'Amt'}
                                        {c.field === 'accountId' && 'Acct'}
                                        {' '}
                                        {c.operator === 'contains' && 'has'}
                                        {c.operator === 'equals' && '='}
                                        {c.operator === 'greater_than' && '>'}
                                        {c.operator === 'less_than' && '<'}
                                        {' '}
                                        <span className="font-mono ml-1 font-semibold max-w-[100px] truncate">"{c.value}"</span>
                                    </span>
                                ) : null
                            ))
                        ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs border border-indigo-100">
                                Desc has "{rule.descriptionContains}"
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions Summary */}
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Then Set</p>
                    <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                        {categoryName && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                                <span className="text-slate-500">Cat:</span> <strong>{categoryName}</strong>
                            </span>
                        )}
                        {payeeName && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                                <span className="text-slate-500">Payee:</span> <strong>{payeeName}</strong>
                            </span>
                        )}
                        {typeName && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                                <span className="text-slate-500">Type:</span> <strong>{typeName}</strong>
                            </span>
                        )}
                        {rule.setDescription && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                                <span className="text-slate-500">Rename:</span> <strong className="truncate max-w-[80px]">{rule.setDescription}</strong>
                            </span>
                        )}
                        {rule.assignTagIds && rule.assignTagIds.length > 0 && (
                             <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                                <span className="text-slate-500">Tags:</span> <strong>{rule.assignTagIds.length}</strong>
                            </span>
                        )}
                        {!categoryName && !payeeName && !typeName && !rule.setDescription && (!rule.assignTagIds || rule.assignTagIds.length === 0) && (
                            <span className="text-slate-400 text-xs italic">No actions defined</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Rule Editor Modal ---
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
    onAddTransactionType: (type: TransactionType) => void;
}> = ({ isOpen, selectedRule, onSave, onClose, accounts, transactionTypes, categories, tags, payees, onSaveCategory, onSavePayee, onAddTransactionType }) => {
    
    const [name, setName] = useState('');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setDescription, setSetDescription] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());

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
            } else {
                // New Rule Defaults
                setName('');
                setConditions([{ id: generateUUID(), field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                setSetCategoryId('');
                setSetPayeeId('');
                setSetTransactionTypeId('');
                setSetDescription('');
                setAssignTagIds(new Set());
            }
        }
    }, [isOpen, selectedRule]);
    
     const sortedPayeeOptions = useMemo(() => {
        const sorted: { id: string, name: string }[] = [];
        const parents = payees.filter(p => !p.parentId).sort((a, b) => a.name.localeCompare(b.name));
        parents.forEach(parent => {
          sorted.push({ id: parent.id, name: parent.name });
          const children = payees.filter(p => p.parentId === parent.id).sort((a, b) => a.name.localeCompare(b.name));
          children.forEach(child => {
            sorted.push({ id: child.id, name: `  - ${child.name}` });
          });
        });
        return sorted;
    }, [payees]);
    
    const sortedCategoryOptions = useMemo(() => {
        const sorted: { id: string, name: string }[] = [];
        const parents = categories.filter(c => !c.parentId).sort((a, b) => a.name.localeCompare(b.name));
        parents.forEach(parent => {
          sorted.push({ id: parent.id, name: parent.name });
          const children = categories.filter(c => c.parentId === parent.id).sort((a, b) => a.name.localeCompare(b.name));
          children.forEach(child => {
            sorted.push({ id: child.id, name: `  - ${child.name}` });
          });
        });
        return sorted;
    }, [categories]);

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
        const name = prompt("Enter new Payee name:");
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
        });
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
                    <h2 className="text-xl font-bold text-slate-700">{selectedRule ? 'Edit Rule' : 'Create New Rule'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 bg-slate-50 flex-grow">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly Netflix Subscription" className="w-full p-2 border rounded-md" required />
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-indigo-500"/> 
                            If transactions match...
                        </h3>
                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-green-500"/>
                            Then apply these changes:
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Set Category</label>
                                <div className="flex gap-1">
                                    <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-2 text-sm border rounded-md">
                                        <option value="">-- Don't Change --</option>
                                        {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    <button type="button" onClick={handleCreateCategory} className="px-2 bg-slate-100 text-slate-600 rounded border hover:bg-slate-200 font-bold">+</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Set Payee</label>
                                <div className="flex gap-1">
                                    <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-2 text-sm border rounded-md">
                                        <option value="">-- Don't Change --</option>
                                        {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <button type="button" onClick={handleCreatePayee} className="px-2 bg-slate-100 text-slate-600 rounded border hover:bg-slate-200 font-bold">+</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Set Type</label>
                                <div className="flex gap-1">
                                    <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2 text-sm border rounded-md">
                                        <option value="">-- Don't Change --</option>
                                        {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                    </select>
                                    <button type="button" onClick={handleCreateType} className="px-2 bg-slate-100 text-slate-600 rounded border hover:bg-slate-200 font-bold">+</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Rename To</label>
                                <input type="text" value={setDescription} onChange={(e) => setSetDescription(e.target.value)} placeholder="e.g., Clean Name" className="w-full p-2 text-sm border rounded-md" />
                            </div>
                            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Assign Tags</label>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map(tag => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={() => toggleTag(tag.id)}
                                            className={`px-2 py-1 rounded-full text-xs border transition-colors ${assignTagIds.has(tag.id) ? tag.color + ' ring-1 ring-offset-1 ring-slate-400' : 'bg-white text-slate-600 border-slate-300'}`}
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                    {tags.length === 0 && <span className="text-sm text-slate-400 italic">No tags available.</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t bg-white flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Save Rule</button>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
const RulesPage: React.FC<RulesPageProps> = ({ rules, onSaveRule, onDeleteRule, accounts, transactionTypes, categories, tags, payees, transactions, onUpdateTransactions, onSaveCategory, onSavePayee, onAddTransactionType }) => {
    const [selectedRule, setSelectedRule] = useState<ReconciliationRule | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [ruleToRun, setRuleToRun] = useState<ReconciliationRule | null>(null);
    
    // Filter & Sort State
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
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 font-medium transition-all"
                    >
                        <AddIcon className="w-5 h-5"/>
                        <span>Create Rule</span>
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 flex-shrink-0">
                    <div className="relative flex-grow">
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search rules..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                    <div className="relative min-w-[180px]">
                        <SortIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full pl-9 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none bg-white"
                        >
                            <option value="name_asc">Name (A-Z)</option>
                            <option value="name_desc">Name (Z-A)</option>
                        </select>
                    </div>
                </div>

                {/* Rules Grid */}
                <div className="flex-1 overflow-y-auto pr-2">
                    {filteredRules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredRules.map(rule => (
                                <RuleCard 
                                    key={rule.id}
                                    rule={rule}
                                    onEdit={handleOpenEditor}
                                    onRun={setRuleToRun}
                                    onDelete={onDeleteRule}
                                    categories={categories}
                                    payees={payees}
                                    types={transactionTypes}
                                    tags={tags}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                            <SparklesIcon className="w-12 h-12 mb-3 opacity-50" />
                            <p className="font-medium">No rules found.</p>
                            <p className="text-sm">Try a different search or create a new rule.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <RuleEditorModal 
                isOpen={isModalOpen} 
                selectedRule={selectedRule} 
                onSave={handleSave} 
                onClose={handleCloseEditor} 
                accounts={accounts} 
                transactionTypes={transactionTypes} 
                categories={categories} 
                tags={tags} 
                payees={payees} 
                onSaveCategory={onSaveCategory}
                onSavePayee={onSavePayee}
                onAddTransactionType={onAddTransactionType}
            />

            {ruleToRun && (
                <RulePreviewModal
                    isOpen={!!ruleToRun}
                    onClose={() => setRuleToRun(null)}
                    onApply={handleApplyRule}
                    rule={ruleToRun}
                    transactions={transactions}
                    accounts={accounts}
                    transactionTypes={transactionTypes}
                    categories={categories}
                    payees={payees}
                />
            )}
        </>
    );
};

export default React.memo(RulesPage);
