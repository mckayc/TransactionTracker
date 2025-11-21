
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category } from '../types';
import { CloseIcon } from './Icons';
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
    // Optional handlers for creating new items inline
    onSaveCategory?: (category: Category) => void;
    onSavePayee?: (payee: Payee) => void;
    onAddTransactionType?: (type: TransactionType) => void;
}

const RuleModal: React.FC<RuleModalProps> = ({ isOpen, onClose, onSaveRule, accounts, transactionTypes, categories, payees, transaction, onSaveCategory, onSavePayee, onAddTransactionType }) => {
    
    const getInitialState = () => ({
        name: transaction ? `${transaction.description} Rule` : '',
        descriptionContains: transaction?.description || '',
        accountId: transaction?.accountId || '',
        amountEquals: undefined,
        setCategoryId: transaction?.categoryId || '',
        setPayeeId: transaction?.payeeId || '',
        setTransactionTypeId: transaction?.typeId || '',
        setDescription: '',
    });

    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialState());
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
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'amountEquals' ? (value ? parseFloat(value) : undefined) : value,
        }));
    };

    const handleCreateCategory = () => {
        const name = prompt("Enter new Category name:");
        if (name && name.trim() && onSaveCategory) {
            const newCat = { id: generateUUID(), name: name.trim() };
            onSaveCategory(newCat);
            setFormData(prev => ({ ...prev, setCategoryId: newCat.id }));
        }
    };

    const handleCreatePayee = () => {
        const name = prompt("Enter new Payee name:");
        if (name && name.trim() && onSavePayee) {
            const newPayee = { id: generateUUID(), name: name.trim() };
            onSavePayee(newPayee);
            setFormData(prev => ({ ...prev, setPayeeId: newPayee.id }));
        }
    };

    const handleCreateType = () => {
        const name = prompt("Enter new Transaction Type name:");
        if (name && name.trim() && onAddTransactionType) {
            const newType = { id: generateUUID(), name: name.trim(), balanceEffect: 'expense' as const, isDefault: false };
            onAddTransactionType(newType);
            setFormData(prev => ({ ...prev, setTransactionTypeId: newType.id }));
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.descriptionContains.trim()) {
            alert('Rule Name and Description Contains fields are required.');
            return;
        }
        onSaveRule({
            ...formData,
            id: generateUUID(),
        });
        onClose();
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 m-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Create Automation Rule</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>
                 <form onSubmit={handleSave} className="space-y-4">
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">Create a rule to automatically categorize similar transactions in the future.</p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Rule Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Monthly Netflix Subscription" required />
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold text-slate-800 mb-2">Conditions (IF...)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Description Contains</label>
                                <input type="text" name="descriptionContains" value={formData.descriptionContains} onChange={handleChange} required />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Account (Optional)</label>
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
                    
                    <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold text-slate-800 mb-2">Actions (THEN...)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Set Category</label>
                                <div className="flex gap-1">
                                    <select name="setCategoryId" value={formData.setCategoryId} onChange={handleChange} className="flex-grow">
                                        <option value="">-- Don't Change --</option>
                                        {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    {onSaveCategory && <button type="button" onClick={handleCreateCategory} className="px-2 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200" title="Add Category">+</button>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Set Payee</label>
                                <div className="flex gap-1">
                                    <select name="setPayeeId" value={formData.setPayeeId} onChange={handleChange} className="flex-grow">
                                        <option value="">-- Don't Change --</option>
                                        {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    {onSavePayee && <button type="button" onClick={handleCreatePayee} className="px-2 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200" title="Add Payee">+</button>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Set Transaction Type</label>
                                <div className="flex gap-1">
                                    <select name="setTransactionTypeId" value={formData.setTransactionTypeId} onChange={handleChange} className="flex-grow">
                                        <option value="">-- Don't Change --</option>
                                        {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                    </select>
                                    {onAddTransactionType && <button type="button" onClick={handleCreateType} className="px-2 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200" title="Add Type">+</button>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Set Description</label>
                                <input type="text" name="setDescription" value={formData.setDescription || ''} onChange={handleChange} placeholder="e.g., Clean Name" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                        <button type="submit" className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Create Rule</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleModal;
