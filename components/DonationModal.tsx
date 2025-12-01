
import React, { useState, useEffect } from 'react';
import type { Transaction, Payee, TransactionType, Account, Category } from '../types';
import { CloseIcon, HeartIcon, AddIcon, DeleteIcon } from './Icons';
import { generateUUID } from '../utils';
import { getTodayDate } from '../dateUtils';

interface DonationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transaction: Transaction) => void;
    totalIncome: number;
    monthName: string;
    payees: Payee[];
    accounts: Account[];
    categories: Category[];
    transactionTypes: TransactionType[];
}

interface DonationItem {
    id: string;
    percentage: number | 'custom';
    customPercentage: string;
    amount: number;
    description: string;
}

const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose, onSave, totalIncome, monthName, accounts, categories, transactionTypes }) => {
    const [items, setItems] = useState<DonationItem[]>([]);
    const [date, setDate] = useState<string>(getTodayDate());
    const [accountId, setAccountId] = useState<string>('');

    // Initialize defaults
    useEffect(() => {
        if (isOpen) {
            setDate(getTodayDate());
            if (accounts.length > 0) setAccountId(accounts[0].id);
            
            // Default to one item with 10%
            setItems([{
                id: generateUUID(),
                percentage: 10,
                customPercentage: '',
                amount: Number((totalIncome * 0.10).toFixed(2)),
                description: 'Tithing'
            }]);
        }
    }, [isOpen, totalIncome, accounts]);

    const handlePercentageChange = (id: string, val: number | 'custom') => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            
            let newAmount = item.amount;
            if (val !== 'custom') {
                newAmount = Number((totalIncome * (val / 100)).toFixed(2));
            }
            
            return { ...item, percentage: val, amount: newAmount };
        }));
    };

    const handleCustomPercentageChange = (id: string, val: string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            
            let newAmount = item.amount;
            const num = parseFloat(val);
            if (!isNaN(num)) {
                newAmount = Number((totalIncome * (num / 100)).toFixed(2));
            }
            
            return { ...item, customPercentage: val, amount: newAmount };
        }));
    };

    const handleAmountChange = (id: string, val: number) => {
        setItems(prev => prev.map(item => 
            item.id === id ? { ...item, amount: val, percentage: 'custom', customPercentage: '' } : item
        ));
    };

    const handleDescriptionChange = (id: string, val: string) => {
        setItems(prev => prev.map(item => 
            item.id === id ? { ...item, description: val } : item
        ));
    };

    const addItem = () => {
        setItems(prev => [...prev, {
            id: generateUUID(),
            percentage: 'custom',
            customPercentage: '',
            amount: 0,
            description: ''
        }]);
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!accountId) {
            alert("Please select an account.");
            return;
        }

        // Find correct types and categories
        const donationType = transactionTypes.find(t => t.balanceEffect === 'donation') || transactionTypes[0];
        const donationCategory = categories.find(c => c.name.toLowerCase().includes('donation') || c.name.toLowerCase().includes('charity')) || categories[0];

        // Process all items
        items.forEach(item => {
            if (item.amount > 0) {
                const newTx: Transaction = {
                    id: generateUUID(),
                    date,
                    amount: item.amount,
                    description: item.description || 'Donation',
                    accountId,
                    typeId: donationType.id,
                    categoryId: donationCategory.id,
                    notes: `Calculated from ${monthName} income of $${totalIncome.toLocaleString()}.`,
                };
                onSave(newTx);
            }
        });

        onClose();
    };

    if (!isOpen) return null;

    const totalDonationAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-pink-600">
                        <HeartIcon className="w-6 h-6" />
                        <h2 className="text-xl font-bold text-slate-800">Calculate Donations</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Total Income ({monthName})</p>
                            <p className="text-xl font-mono font-bold text-slate-800">${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Total Donation</p>
                            <p className="text-xl font-mono font-bold text-pink-600">${totalDonationAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                            <input 
                                type="date" 
                                value={date} 
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-2 border rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                            <select 
                                value={accountId} 
                                onChange={(e) => setAccountId(e.target.value)}
                                className="w-full p-2 border rounded-md text-sm"
                            >
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={item.id} className="p-4 border rounded-lg bg-white shadow-sm relative group">
                                {items.length > 1 && (
                                    <button 
                                        onClick={() => removeItem(item.id)}
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"
                                        title="Remove line"
                                    >
                                        <DeleteIcon className="w-4 h-4" />
                                    </button>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                    {/* Description */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                        <input 
                                            type="text" 
                                            value={item.description} 
                                            onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
                                            className="w-full p-2 border rounded-md text-sm"
                                            placeholder="e.g. Tithing, Fast Offering"
                                        />
                                    </div>

                                    {/* Amount */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={item.amount} 
                                                onChange={(e) => handleAmountChange(item.id, parseFloat(e.target.value))}
                                                className="w-full pl-7 p-2 border rounded-md font-bold text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Percentage Selectors */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Calculate % of Income</label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {[10, 5, 1, 0.5].map((pct) => (
                                            <button
                                                key={pct}
                                                type="button"
                                                onClick={() => handlePercentageChange(item.id, pct)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${item.percentage === pct ? 'bg-pink-100 text-pink-700 border-pink-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                            >
                                                {pct}%
                                            </button>
                                        ))}
                                        <div className={`flex items-center gap-1 border rounded-full px-2 py-0.5 ${item.percentage === 'custom' ? 'border-pink-300 bg-pink-50' : 'border-slate-200 bg-slate-50'}`}>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                value={item.customPercentage} 
                                                onChange={(e) => handleCustomPercentageChange(item.id, e.target.value)}
                                                className="w-12 bg-transparent text-right text-xs focus:outline-none"
                                                placeholder="Custom"
                                            />
                                            <span className="text-xs text-slate-500">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 rounded-b-xl">
                    <button 
                        onClick={onClose} 
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={addItem} 
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            <AddIcon className="w-4 h-4" />
                            Add Donation
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700 shadow-sm transition-colors"
                        >
                            <HeartIcon className="w-4 h-4" />
                            Save Donations
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DonationModal;
