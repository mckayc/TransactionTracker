import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User } from '../types';
import { CloseIcon } from '../components/Icons';

interface TransactionModalProps {
    isOpen: boolean;
    transaction: Transaction | null; // null for adding new
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id'>) => void;
    accounts: Account[];
    categories: Category[];
    transactionTypes: TransactionType[];
    payees: Payee[];
    users: User[];
}

const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, transaction, onClose, onSave, accounts, categories, transactionTypes, payees, users }) => {
    
    const getDefaultState = () => {
        const defaultExpenseType = transactionTypes.find(t => t.name === 'Purchase') || transactionTypes.find(t => t.balanceEffect === 'expense');
        const defaultCategory = categories.find(c => c.name === 'Other') || categories[0];
        const defaultUser = users.find(u => u.isDefault) || users[0];
        return {
            date: getTodayDate(),
            description: '',
            categoryId: defaultCategory?.id || '',
            amount: 0,
            typeId: defaultExpenseType ? defaultExpenseType.id : '',
            location: '',
            accountId: '',
            notes: '',
            payeeId: '',
            userId: defaultUser?.id || '',
        }
    };
    
    const [formData, setFormData] = useState<Omit<Transaction, 'id'>>(getDefaultState());
    const isEditMode = transaction !== null;

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

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && transaction) {
                setFormData(transaction);
            } else {
                const defaultState = getDefaultState();
                const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';
                setFormData({
                    ...defaultState,
                    accountId: defaultAccountId,
                });
            }
        }
    }, [transaction, isOpen, isEditMode, categories, accounts, transactionTypes, users]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'amount' ? parseFloat(value) || 0 : value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4 transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">{isEditMode ? 'Edit Transaction' : 'Add New Transaction'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100" aria-label="Close modal">
                        <CloseIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Amount</label>
                            <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required />
                        </div>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Description</label>
                        <input type="text" name="description" value={formData.description} onChange={handleChange} required />
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Payee</label>
                            <select name="payeeId" value={formData.payeeId || ''} onChange={handleChange}>
                                <option value="">-- No Payee --</option>
                                {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Category</label>
                            <select name="categoryId" value={formData.categoryId} onChange={handleChange}>
                                 {sortedCategoryOptions.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Account</label>
                            <select name="accountId" value={formData.accountId || ''} onChange={handleChange} required>
                                <option value="" disabled>Select an account...</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">User</label>
                            <select name="userId" value={formData.userId || ''} onChange={handleChange} required>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Transaction Type</label>
                        <select name="typeId" value={formData.typeId} onChange={handleChange}>
                           {transactionTypes.map(type => (
                               <option key={type.id} value={type.id}>{type.name}</option>
                           ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Notes</label>
                        <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3}></textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                        <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransactionModal;