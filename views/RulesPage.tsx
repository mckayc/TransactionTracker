
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ReconciliationRule, Account, TransactionType, Payee, Category } from '../types';
import { DeleteIcon, EditIcon, AddIcon, PlayIcon } from '../components/Icons';
import RulePreviewModal from '../components/RulePreviewModal';
import { generateUUID } from '../utils';

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
    
    const getInitialState = () => ({
        id: '',
        name: '',
        descriptionContains: '',
        accountId: '',
        amountEquals: undefined,
        setCategoryId: '',
        setPayeeId: '',
        setTransactionTypeId: '',
        setDescription: '',
    });

    const [formData, setFormData] = useState(selectedRule || getInitialState());

    useEffect(() => {
        setFormData(selectedRule || getInitialState());
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'amountEquals' ? (value ? parseFloat(value) : undefined) : value,
        }));
    };

    const handleCreateCategory = () => {
        const name = prompt("Enter new Category name:");
        if (name && name.trim()) {
            const newCat = { id: generateUUID(), name: name.trim() };
            onSaveCategory(newCat);
            setFormData(prev => ({ ...prev, setCategoryId: newCat.id }));
        }
    };

    const handleCreatePayee = () => {
        const name = prompt("Enter new Payee name:");
        if (name && name.trim()) {
            const newPayee = { id: generateUUID(), name: name.trim() };
            onSavePayee(newPayee);
            setFormData(prev => ({ ...prev, setPayeeId: newPayee.id }));
        }
    };

    const handleCreateType = () => {
        const name = prompt("Enter new Transaction Type name:");
        if (name && name.trim()) {
            const newType = { id: generateUUID(), name: name.trim(), balanceEffect: 'expense' as const, isDefault: false };
            onAddTransactionType(newType);
            setFormData(prev => ({ ...prev, setTransactionTypeId: newType.id }));
        }
    };

    const handleSave = () => {
        if (!formData.name.trim() || !formData.descriptionContains.trim()) {
            alert('Rule Name and Description Contains fields are required.');
            return;
        }
        onSave({
            ...formData,
            id: selectedRule?.id || generateUUID(),
        });
    };
    
    return (
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xl font-bold text-slate-700">{selectedRule ? 'Edit Rule' : 'Create New Rule'}</h2>
            <div>
                <label className="block text-sm font-medium text-slate-700">Rule Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Monthly Netflix Subscription" required />
            </div>
            
            <div className="p-4 border rounded-lg bg-slate-50/50">
                <h3 className="font-semibold text-slate-800 mb-2">Conditions (IF...)</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Description Contains</label>
                        <input type="text" name="descriptionContains" value={formData.descriptionContains} onChange={handleChange} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Account is (Optional)</label>
                            <select name="accountId" value={formData.accountId} onChange={handleChange}>
                                <option value="">Any Account</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Amount Equals (Optional)</label>
                            <input type="number" step="0.01" name="amountEquals" value={formData.amountEquals || ''} onChange={handleChange} />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="p-4 border rounded-lg bg-slate-50/50">
                <h3 className="font-semibold text-slate-800 mb-2">Actions (THEN SET...)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Category</label>
                        <div className="flex gap-1">
                            <select name="setCategoryId" value={formData.setCategoryId} onChange={handleChange} className="flex-grow">
                                <option value="">-- Don't Change --</option>
                                {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                            <button type="button" onClick={handleCreateCategory} className="px-2 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200" title="Add Category">+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Payee</label>
                        <div className="flex gap-1">
                            <select name="setPayeeId" value={formData.setPayeeId} onChange={handleChange} className="flex-grow">
                                <option value="">-- Don't Change --</option>
                                {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button type="button" onClick={handleCreatePayee} className="px-2 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200" title="Add Payee">+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Transaction Type</label>
                        <div className="flex gap-1">
                            <select name="setTransactionTypeId" value={formData.setTransactionTypeId} onChange={handleChange} className="flex-grow">
                                <option value="">-- Don't Change --</option>
                                {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                            </select>
                            <button type="button" onClick={handleCreateType} className="px-2 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200" title="Add Type">+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Description</label>
                        <input type="text" name="setDescription" value={formData.setDescription || ''} onChange={handleChange} placeholder="e.g., Clean Name" />
                        <p className="text-xs text-slate-500 mt-1">Leave empty to keep original.</p>
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

    const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc.name])), [accounts]);
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p.name])), [payees]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t.name])), [transactionTypes]);

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
                             <ul className="space-y-2">
                                {rules.map(rule => (
                                    <li key={rule.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRule?.id === rule.id ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-slate-50'}`} onClick={() => handleSelectRule(rule)}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-grow">
                                                <p className="font-semibold">{rule.name}</p>
                                                <p className="text-xs text-slate-500 truncate">If description contains "{rule.descriptionContains}"</p>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {rule.setCategoryId && <span className="inline-block bg-slate-200 rounded px-1.5 py-0.5 mr-1">Set Cat: {categoryMap.get(rule.setCategoryId)}</span>}
                                                    {rule.setDescription && <span className="inline-block bg-slate-200 rounded px-1.5 py-0.5 mr-1">Set Desc: {rule.setDescription}</span>}
                                                </div>
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
