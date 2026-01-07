
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, Counterparty, Category, User, Tag } from '../types';
import { CloseIcon, AddIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import EntityModal from '../components/EntityModal';
import { EntityType } from '../components/EntityEditor';

interface TransactionModalProps {
    isOpen: boolean;
    transaction: Transaction | null; // null for adding new
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id'>) => void;
    accounts: Account[];
    categories: Category[];
    tags: Tag[];
    transactionTypes: TransactionType[];
    counterparties: Counterparty[];
    users: User[];
    onSaveCategory?: (c: Category) => void;
    onSaveCounterparty?: (p: Counterparty) => void;
}

const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TransactionModal: React.FC<TransactionModalProps> = ({ 
    isOpen, transaction, onClose, onSave, accounts, categories, tags, transactionTypes, counterparties, users,
    onSaveCategory, onSaveCounterparty
}) => {
    
    const getDefaultState = () => {
        // Fix: Use 'outgoing' to match BalanceEffect type
        const defaultExpenseType = transactionTypes.find(t => t.name === 'Purchase') || transactionTypes.find(t => t.balanceEffect === 'outgoing');
        const defaultCategory = categories.find(c => c.name === 'Other') || categories[0];
        const defaultUser = users.find(u => u.isDefault) || users[0];
        return {
            date: getTodayDate(),
            description: '',
            categoryId: defaultCategory?.id || '',
            category: defaultCategory?.name || '',
            amount: 0,
            typeId: defaultExpenseType ? defaultExpenseType.id : '',
            location: '',
            accountId: '',
            notes: '',
            counterpartyId: '',
            userId: defaultUser?.id || '',
            tagIds: [] as string[],
        }
    };
    
    const [formData, setFormData] = useState<Omit<Transaction, 'id'>>(getDefaultState());
    const [quickAddType, setQuickAddType] = useState<EntityType | null>(null);
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

    const sortedCounterpartyOptions = useMemo(() => getSortedOptions(counterparties), [counterparties]);
    const sortedCategoryOptions = useMemo(() => getSortedOptions(categories), [categories]);

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && transaction) {
                setFormData({ ...transaction, tagIds: transaction.tagIds || [] });
            } else {
                const defaultState = getDefaultState();
                const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';
                setFormData({ ...defaultState, accountId: defaultAccountId });
            }
        }
    }, [isOpen, transaction]);

    const handleQuickAddSave = (type: EntityType, payload: any) => {
        if (type === 'counterparties') {
            onSaveCounterparty?.(payload);
            setFormData(prev => ({ ...prev, counterpartyId: payload.id }));
        } else if (type === 'categories') {
            onSaveCategory?.(payload);
            setFormData(prev => ({ ...prev, categoryId: payload.id, category: payload.name }));
        }
        setQuickAddType(null);
    };

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'categoryId') {
            const catName = categories.find(c => c.id === value)?.name || '';
            setFormData(prev => ({ ...prev, categoryId: value, category: catName }));
        } else {
            setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) || 0 : value }));
        }
    };

    const toggleTag = (tagId: string) => {
        setFormData(prev => {
            const currentTags = prev.tagIds || [];
            return { ...prev, tagIds: currentTags.includes(tagId) ? currentTags.filter(id => id !== tagId) : [...currentTags, tagId] };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 overflow-hidden flex flex-col max-h-[90vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">{isEditMode ? 'Edit Transaction' : 'New Transaction'}</h2>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto custom-scrollbar pr-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-2 border rounded-xl" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                                <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required className="w-full p-2 border rounded-xl font-mono font-bold" />
                            </div>
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Memo / Original Statement Line</label>
                            <input type="text" name="description" value={formData.description} onChange={handleChange} required className="w-full p-2 border rounded-xl font-bold" placeholder="Statement description..." />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <span>Counterparty</span>
                                    <button type="button" onClick={() => setQuickAddType('counterparties')} className="text-indigo-600 hover:underline">NEW</button>
                                </label>
                                <select name="counterpartyId" value={formData.counterpartyId || ''} onChange={handleChange} className="w-full p-2 border rounded-xl font-medium">
                                    <option value="">-- No Entity --</option>
                                    {sortedCounterpartyOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <span>Category</span>
                                    <button type="button" onClick={() => setQuickAddType('categories')} className="text-indigo-600 hover:underline">NEW</button>
                                </label>
                                <select name="categoryId" value={formData.categoryId} onChange={handleChange} className="w-full p-2 border rounded-xl font-medium">
                                    {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Account</label>
                                <select name="accountId" value={formData.accountId || ''} onChange={handleChange} required className="w-full p-2 border rounded-xl font-medium">
                                    <option value="" disabled>Select account...</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ledger Owner</label>
                                <select name="userId" value={formData.userId || ''} onChange={handleChange} required className="w-full p-2 border rounded-xl font-medium">
                                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transaction Logic Type</label>
                            <select name="typeId" value={formData.typeId} onChange={handleChange} className="w-full p-2 border rounded-xl font-bold">
                            {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Organizational Tags</label>
                            <div className="flex flex-wrap gap-2 p-3 border rounded-2xl bg-slate-50">
                                {tags.map(tag => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all ${formData.tagIds?.includes(tag.id) ? tag.color + ' border-slate-400 ring-2 ring-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                    >
                                        {tag.name}
                                    </button>
                                ))}
                                {tags.length === 0 && <p className="text-[10px] text-slate-400 italic">No tags configured.</p>}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded-xl" placeholder="Additional context..." />
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t">
                            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
                            <button type="submit" className="px-10 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100">Save Transaction</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <EntityModal 
                isOpen={!!quickAddType}
                onClose={() => setQuickAddType(null)}
                type={quickAddType || 'categories'}
                onSave={handleQuickAddSave}
                categories={categories}
                tags={tags}
                counterparties={counterparties}
                locations={[]}
                users={users}
                transactionTypes={transactionTypes}
                accountTypes={[]}
                accounts={accounts}
            />
        </>
    );
};

export default TransactionModal;
