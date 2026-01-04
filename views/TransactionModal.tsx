import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User, Tag } from '../types';
import { CloseIcon, RepeatIcon, ShieldCheckIcon } from '../components/Icons';

interface TransactionModalProps {
    isOpen: boolean;
    transaction: Transaction | null; 
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id'>) => void;
    accounts: Account[];
    categories: Category[];
    tags: Tag[];
    transactionTypes: TransactionType[];
    payees: Payee[];
    users: User[];
}

const getTodayDate = () => new Date().toISOString().split('T')[0];

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, transaction, onClose, onSave, accounts, categories, tags, transactionTypes, payees, users }) => {
    
    const getDefaultState = () => ({
        date: getTodayDate(), description: '', categoryId: categories[0]?.id || '', category: categories[0]?.name || '',
        amount: 0, typeId: transactionTypes[0]?.id || '', location: '', accountId: accounts[0]?.id || '',
        notes: '', payeeId: '', userId: users.find(u => u.isDefault)?.id || users[0]?.id || '',
        tagIds: [] as string[],
        originalDescription: '', originalDate: '', originalAmount: 0
    });
    
    const [formData, setFormData] = useState<Omit<Transaction, 'id'>>(getDefaultState());
    const isEditMode = !!transaction;

    useEffect(() => {
        if (isOpen) {
            if (transaction) setFormData({ ...transaction });
            else setFormData(getDefaultState());
        }
    }, [isOpen, transaction]);

    if (!isOpen) return null;

    const handleRevert = () => {
        if (!confirm("Revert to the original bank record? This will discard your current description, date, and amount edits.")) return;
        setFormData(prev => ({
            ...prev,
            description: prev.originalDescription || prev.description,
            date: prev.originalDate || prev.date,
            amount: prev.originalAmount || prev.amount
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const hasDrift = formData.description !== formData.originalDescription || formData.amount !== formData.originalAmount || formData.date !== formData.originalDate;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                        {isEditMode ? 'Edit Transaction' : 'Manual Entry'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white shadow-sm"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                    {isEditMode && hasDrift && (
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between gap-4 animate-fade-in">
                            <div className="flex items-center gap-3">
                                <ShieldCheckIcon className="w-5 h-5 text-indigo-600" />
                                <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Data has drifted from source</span>
                            </div>
                            <button type="button" onClick={handleRevert} className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                                Revert to Bank Truth
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Date</label>
                            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="font-bold border-slate-100 rounded-xl" required />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Amount</label>
                            <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} className="font-black font-mono border-slate-100 rounded-xl text-lg" required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Working Description</label>
                        <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="font-bold border-slate-100 rounded-xl" placeholder="Describe the transaction..." required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Category</label>
                            <select value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value, category: categories.find(c => c.id === e.target.value)?.name || ''})} className="font-bold border-slate-100 rounded-xl bg-white">
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Account</label>
                            <select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} className="font-bold border-slate-100 rounded-xl bg-white">
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl">Cancel</button>
                        <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransactionModal;