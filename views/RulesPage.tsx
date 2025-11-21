
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category, RuleLogic, RuleItem, RuleCondition } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon } from '../components/Icons';
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
    payees: Payee[];
    transactions: Transaction[];
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onSaveCategory: (category: Category) => void;
    onSavePayee: (payee: Payee) => void;
    onAddTransactionType: (type: TransactionType) => void;
}

const RuleEditor: React.FC<{
    selectedRule: ReconciliationRule | null;
    onSave: (rule: ReconciliationRule) => void;
    onCancel: () => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    payees: Payee[];
    onSaveCategory: (category: Category) => void;
    onSavePayee: (payee: Payee) => void;
    onAddTransactionType: (type: TransactionType) => void;
}> = ({ selectedRule, onSave, onCancel, accounts, transactionTypes, categories, payees, onSaveCategory, onSavePayee, onAddTransactionType }) => {
    
    const [name, setName] = useState('');
    const [matchLogic, setMatchLogic] = useState<RuleLogic>('AND');
    const [conditions, setConditions] = useState<RuleItem[]>([]);
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setDescription, setSetDescription] = useState('');

    useEffect(() => {
        if (selectedRule) {
            setName(selectedRule.name);
            setMatchLogic(selectedRule.matchLogic || 'AND');
            if (selectedRule.conditions && selectedRule.conditions.length > 0) {
                setConditions(selectedRule.conditions);
            } else {
                // Convert legacy to new format for editing
                const newConditions: RuleCondition[] = [];
                if (selectedRule.descriptionContains) newConditions.push({ id: generateUUID(), field: 'description', operator: 'contains', value: selectedRule.descriptionContains });
                if (selectedRule.accountId) newConditions.push({ id: generateUUID(), field: 'accountId', operator: 'equals', value: selectedRule.accountId });
                if (selectedRule.amountEquals) newConditions.push({ id: generateUUID(), field: 'amount', operator: 'equals', value: selectedRule.amountEquals });
                setConditions(newConditions.length > 0 ? newConditions : [{ id: generateUUID(), field: 'description', operator: 'contains', value: '' }]);
            }
            setSetCategoryId(selectedRule.setCategoryId || '');
            setSetPayeeId(selectedRule.setPayeeId || '');
            setSetTransactionTypeId(selectedRule.setTransactionTypeId || '');
            setSetDescription(selectedRule.setDescription || '');
        } else {
            setName('');
            setMatchLogic('AND');
            setConditions([{ id: generateUUID(), field: 'description', operator: 'contains', value: '' }]);
            setSetCategoryId('');
            setSetPayeeId('');
            setSetTransactionTypeId('');
            setSetDescription('');
        }
    }, [selectedRule]);
    
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

    const handleSave = () => {
        if (!name.trim()) {
            alert('Rule Name is required.');
            return;
        }
        
        onSave({
            id: selectedRule?.id || generateUUID(),
            name: name.trim(),
            matchLogic,
            conditions,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            setDescription: setDescription || undefined,
        });
    };
    
    return (
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-xl font-bold text-slate-700">{selectedRule ? 'Edit Rule' : 'Create New Rule'}</h2>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly Netflix Subscription" className="w-full p-2 border rounded-md" required />
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">Conditions</h3>
                    <div className="flex items-center gap-2 bg-white rounded-md border p-1">
                        <button type="button" onClick={() => setMatchLogic('AND')} className={`px-3 py-1 text-xs font-bold rounded ${matchLogic === 'AND' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Match ALL (AND)</button>
                        <button type="button" onClick={() => setMatchLogic('OR')} className={`px-3 py-1 text-xs font-bold rounded ${matchLogic === 'OR' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Match ANY (OR)</button>
                    </div>
                </div>
                
                <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3">Actions (Set Values)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Set Category</label>
                        <div className="flex gap-1">
                            <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-2 border rounded-md">
                                <option value="">-- Don't Change --</option>
                                {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                            <button type="button" onClick={handleCreateCategory} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Set Payee</label>
                        <div className="flex gap-1">
                            <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-2 border rounded-md">
                                <option value="">-- Don't Change --</option>
                                {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button type="button" onClick={handleCreatePayee} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Set Transaction Type</label>
                        <div className="flex gap-1">
                            <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2 border rounded-md">
                                <option value="">-- Don't Change --</option>
                                {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                            </select>
                            <button type="button" onClick={handleCreateType} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Set Description</label>
                        <input type="text" value={setDescription} onChange={(e) => setSetDescription(e.target.value)} placeholder="e.g., Clean Name" className="w-full p-2 border rounded-md" />
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
                <button onClick={onCancel} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Rule</button>
            </div>
         </div>
    );
};

const RulesPage: React.FC<RulesPageProps> = ({ rules, onSaveRule, onDeleteRule, accounts, transactionTypes, categories, payees, transactions, onUpdateTransactions, onSaveCategory, onSavePayee, onAddTransactionType }) => {
    const [selectedRule, setSelectedRule] = useState<ReconciliationRule | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [ruleToRun, setRuleToRun] = useState<ReconciliationRule | null>(null);

    const handleSelectRule = (rule: ReconciliationRule) => {
        setSelectedRule(rule);
        setIsCreating(false);
    };

    const handleAddNew = () => {
        setSelectedRule(null);
        setIsCreating(true);
    };

    const handleSave = (rule: ReconciliationRule) => {
        onSaveRule(rule);
        setSelectedRule(rule);
        setIsCreating(false);
    };

    const handleCancel = () => {
        setSelectedRule(null);
        setIsCreating(false);
    };

    const handleApplyRule = (transactionsToUpdate: Transaction[]) => {
        onUpdateTransactions(transactionsToUpdate);
        setRuleToRun(null);
    };
    
    return (
        <>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Automation Rules</h1>
                    <p className="text-slate-500 mt-1">Automate the categorization of your transactions.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-700">Your Rules</h2>
                            <button onClick={handleAddNew} className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700" title="Create new rule">
                                <AddIcon className="w-5 h-5"/>
                            </button>
                        </div>
                        {rules.length > 0 ? (
                             <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
                                {rules.map(rule => (
                                    <li key={rule.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRule?.id === rule.id ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-slate-50'}`} onClick={() => handleSelectRule(rule)}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-grow min-w-0">
                                                <p className="font-semibold truncate">{rule.name}</p>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {rule.conditions?.length ? `${rule.conditions.length} conditions` : `If contains "${rule.descriptionContains}"`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                <button onClick={(e) => { e.stopPropagation(); setRuleToRun(rule); }} className="text-slate-500 hover:text-green-600" title="Run rule on existing transactions">
                                                    <PlayIcon className="w-5 h-5"/>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleSelectRule(rule); }} className="text-slate-500 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteRule(rule.id); }} className="text-slate-500 hover:text-red-500"><DeleteIcon className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-slate-500 py-8">No rules yet. Click '+' to create one!</p>
                        )}
                    </div>

                    <div className="lg:col-span-2">
                        {(selectedRule || isCreating) ? (
                            <RuleEditor 
                                selectedRule={selectedRule} 
                                onSave={handleSave} 
                                onCancel={handleCancel} 
                                accounts={accounts} 
                                transactionTypes={transactionTypes} 
                                categories={categories} 
                                payees={payees} 
                                onSaveCategory={onSaveCategory}
                                onSavePayee={onSavePayee}
                                onAddTransactionType={onAddTransactionType}
                            />
                        ) : (
                            <div className="text-center bg-white p-12 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-600">Select a rule to view or edit, or create a new one.</h3>
                                <p className="text-sm text-slate-500 mt-2">Rules help automatically categorize transactions, assign payees, and set transaction types when you import new data.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
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
