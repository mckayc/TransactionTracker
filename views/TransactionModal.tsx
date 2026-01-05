import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User, Tag } from '../types';
import { CloseIcon } from '../components/Icons';

interface TransactionModalProps {
    isOpen: boolean;
    transaction: Transaction | null; // null for adding new
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id'>) => void;
    accounts: Account[];
    categories: Category[];
    tags: Tag[];
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

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, transaction, onClose, onSave, accounts, categories, tags, transactionTypes, payees, users }) => {
    
    const getDefaultState = (): Omit<Transaction, 'id'> => {
        const defaultExpenseType = transactionTypes.find(t => t.name === 'Purchase') || transactionTypes.find(t => t.balanceEffect === 'expense');
        const defaultCategory = categories.find(c => c.name === 'Other') || categories[0];
        const defaultUser = users.find(u => u.isDefault) || users[0];
        const today = getTodayDate();

        return {
            transaction_date: today,
            date: today,
            description_raw: '',
            description: '',
            amount: 0,
            direction: 'debit',
            categoryId: defaultCategory?.id || '',
            category: defaultCategory?.name || 'Other',
            typeId: defaultExpenseType ? defaultExpenseType.id : '',
            account_id: '',
            account_type: 'checking',
            status: 'cleared',
            currency: 'USD',
            is_internal_transfer: false,
            is_payment: false,
            cash_flow_effect: 'outflow',
            liability_effect: 'none',
            raw_import_row: {},
            userId: defaultUser?.id || '',
            tagIds: [],
            notes: '',
            location: ''
        };
    };
    
    const [formData, setFormData] = useState<Omit<Transaction, 'id'>>(getDefaultState());
    const isEditMode = transaction !== null;

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

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && transaction) {
                const { id, ...rest } = transaction;
                setFormData({ ...rest, tagIds: rest.tagIds || [] });
            } else {
                const defaultState = getDefaultState();
                const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';
                setFormData({
                    ...defaultState,
                    account_id: defaultAccountId,
                });
            }
        }
    }, [isOpen, transaction, accounts]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'categoryId') {
            const catName = categories.find(c => c.id === value)?.name || '';
            setFormData(prev => ({
                ...prev,
                categoryId: value,
                category: catName
            }));
        } else if (name === 'date') {
            setFormData(prev => ({
                ...prev,
                date: value,
                transaction_date: value
            }));
        } else if (name === 'description') {
            setFormData(prev => ({
                ...prev,
                description: value,
                description_raw: value
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: name === 'amount' ? parseFloat(value) || 0 : value,
            }));
        }
    };

    const toggleTag = (tagId: string) => {
        setFormData(prev => {
            const currentTags = prev.tagIds || [];
            if (currentTags.includes(tagId)) {
                return { ...prev, tagIds: currentTags.filter(id => id !== tagId) };
            } else {
                return { ...prev, tagIds: [...currentTags, tagId] };
            }
        });
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
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4 transform transition-all max-h-[90vh] overflow-y-auto"
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
                            <select name="account_id" value={formData.account_id || ''} onChange={handleChange} required>
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
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => toggleTag(tag.id)}
                                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${formData.tagIds?.includes(tag.id) ? tag.color + ' ring-1 ring-offset-1 ring-slate-400' : 'bg-white text-slate-600 border-slate-300'}`}
                                >
                                    {tag.name}
                                </button>
                            ))}
                            {tags.length === 0 && <span className="text-sm text-slate-400 italic">No tags available.</span>}
                        </div>
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