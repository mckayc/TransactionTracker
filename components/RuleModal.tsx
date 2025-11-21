
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, RuleCondition, RuleLogic } from '../types';
import { CloseIcon, DeleteIcon, AddIcon } from './Icons';
import { generateUUID } from '../utils';

interface RuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveRule: (rule: ReconciliationRule) => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    payees: Payee[];
    transaction: Transaction | null;
    onSaveCategory?: (category: Category) => void;
    onSavePayee?: (payee: Payee) => void;
    onAddTransactionType?: (type: TransactionType) => void;
}

const RuleModal: React.FC<RuleModalProps> = ({ isOpen, onClose, onSaveRule, accounts, transactionTypes, categories, payees, transaction, onSaveCategory, onSavePayee, onAddTransactionType }) => {
    
    const [name, setName] = useState('');
    const [matchLogic, setMatchLogic] = useState<RuleLogic>('AND');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    
    // Actions
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setDescription, setSetDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (transaction) {
                setName(`${transaction.description} Rule`);
                setConditions([
                    { id: generateUUID(), field: 'description', operator: 'contains', value: transaction.description },
                    ...(transaction.accountId ? [{ id: generateUUID(), field: 'accountId' as const, operator: 'equals' as const, value: transaction.accountId }] : [])
                ]);
                setSetCategoryId(transaction.categoryId || '');
                setSetPayeeId(transaction.payeeId || '');
                setSetTransactionTypeId(transaction.typeId || '');
            } else {
                setName('');
                setConditions([{ id: generateUUID(), field: 'description', operator: 'contains', value: '' }]);
                setSetCategoryId('');
                setSetPayeeId('');
                setSetTransactionTypeId('');
                setSetDescription('');
            }
        }
    }, [isOpen, transaction]);
    
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

    const handleAddCondition = () => {
        setConditions([...conditions, { id: generateUUID(), field: 'description', operator: 'contains', value: '' }]);
    };

    const handleRemoveCondition = (id: string) => {
        if (conditions.length > 1) {
            setConditions(conditions.filter(c => c.id !== id));
        }
    };

    const updateCondition = (id: string, field: keyof RuleCondition, value: any) => {
        setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleCreateCategory = () => {
        const name = prompt("Enter new Category name:");
        if (name && name.trim() && onSaveCategory) {
            const newCat = { id: generateUUID(), name: name.trim() };
            onSaveCategory(newCat);
            setSetCategoryId(newCat.id);
        }
    };

    const handleCreatePayee = () => {
        const name = prompt("Enter new Payee name:");
        if (name && name.trim() && onSavePayee) {
            const newPayee = { id: generateUUID(), name: name.trim() };
            onSavePayee(newPayee);
            setSetPayeeId(newPayee.id);
        }
    };

    const handleCreateType = () => {
        const name = prompt("Enter new Transaction Type name:");
        if (name && name.trim() && onAddTransactionType) {
            const newType = { id: generateUUID(), name: name.trim(), balanceEffect: 'expense' as const, isDefault: false };
            onAddTransactionType(newType);
            setSetTransactionTypeId(newType.id);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Rule Name is required.');
            return;
        }
        // Validate values
        for (const cond of conditions) {
            if (cond.operator !== 'equals' && (!cond.value || cond.value.toString().trim() === '')) {
                // accountId equals '' might be valid if 'Any Account' but checking empty value usually means user error
                if (cond.field !== 'accountId') { 
                    alert('Please provide a value for all conditions.');
                    return; 
                }
            }
        }

        onSaveRule({
            id: generateUUID(),
            name: name.trim(),
            matchLogic,
            conditions,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            setDescription: setDescription || undefined,
            // Backwards compat filling
            descriptionContains: conditions.find(c => c.field === 'description')?.value as string || '',
            accountId: conditions.find(c => c.field === 'accountId')?.value as string || undefined,
        });
        onClose();
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-slate-800">Create Automation Rule</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>
                 <form onSubmit={handleSave} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Monthly Netflix Subscription" className="w-full p-2 border rounded-md" required />
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-slate-800">Conditions</h3>
                            <div className="flex items-center gap-2 bg-white rounded-md border p-1">
                                <button type="button" onClick={() => setMatchLogic('AND')} className={`px-3 py-1 text-xs font-bold rounded ${matchLogic === 'AND' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Match ALL (AND)</button>
                                <button type="button" onClick={() => setMatchLogic('OR')} className={`px-3 py-1 text-xs font-bold rounded ${matchLogic === 'OR' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Match ANY (OR)</button>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            {conditions.map((cond, index) => (
                                <div key={cond.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                    <select 
                                        value={cond.field} 
                                        onChange={(e) => updateCondition(cond.id, 'field', e.target.value)}
                                        className="w-full sm:w-1/4 p-2 text-sm border rounded-md"
                                    >
                                        <option value="description">Description</option>
                                        <option value="amount">Amount</option>
                                        <option value="accountId">Account</option>
                                    </select>
                                    
                                    <select 
                                        value={cond.operator} 
                                        onChange={(e) => updateCondition(cond.id, 'operator', e.target.value)}
                                        className="w-full sm:w-1/4 p-2 text-sm border rounded-md"
                                    >
                                        {cond.field === 'description' && (
                                            <>
                                                <option value="contains">Contains</option>
                                                <option value="does_not_contain">Does Not Contain</option>
                                                <option value="starts_with">Starts With</option>
                                                <option value="ends_with">Ends With</option>
                                                <option value="equals">Equals</option>
                                            </>
                                        )}
                                        {cond.field === 'amount' && (
                                            <>
                                                <option value="equals">Equals</option>
                                                <option value="greater_than">Greater Than</option>
                                                <option value="less_than">Less Than</option>
                                            </>
                                        )}
                                        {cond.field === 'accountId' && (
                                            <option value="equals">Is</option>
                                        )}
                                    </select>

                                    {cond.field === 'accountId' ? (
                                        <select 
                                            value={cond.value} 
                                            onChange={(e) => updateCondition(cond.id, 'value', e.target.value)}
                                            className="w-full sm:flex-grow p-2 text-sm border rounded-md"
                                        >
                                            <option value="">Select Account...</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                        </select>
                                    ) : (
                                        <input 
                                            type={cond.field === 'amount' ? 'number' : 'text'} 
                                            step={cond.field === 'amount' ? '0.01' : undefined}
                                            value={cond.value} 
                                            onChange={(e) => updateCondition(cond.id, 'value', cond.field === 'amount' ? e.target.value : e.target.value)}
                                            placeholder="Value"
                                            className="w-full sm:flex-grow p-2 text-sm border rounded-md"
                                        />
                                    )}

                                    <button type="button" onClick={() => handleRemoveCondition(cond.id)} className="p-2 text-slate-400 hover:text-red-500" disabled={conditions.length === 1}>
                                        <DeleteIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={handleAddCondition} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                            <AddIcon className="w-4 h-4" /> Add Condition
                        </button>
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
                                    {onSaveCategory && <button type="button" onClick={handleCreateCategory} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Set Payee</label>
                                <div className="flex gap-1">
                                    <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-2 border rounded-md">
                                        <option value="">-- Don't Change --</option>
                                        {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    {onSavePayee && <button type="button" onClick={handleCreatePayee} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Set Transaction Type</label>
                                <div className="flex gap-1">
                                    <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2 border rounded-md">
                                        <option value="">-- Don't Change --</option>
                                        {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                    </select>
                                    {onAddTransactionType && <button type="button" onClick={handleCreateType} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Set Description</label>
                                <input type="text" value={setDescription} onChange={(e) => setSetDescription(e.target.value)} placeholder="e.g., Clean Name" className="w-full p-2 border rounded-md" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                        <button type="submit" className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Create Rule</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleModal;
