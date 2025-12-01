
import React, { useState, useEffect } from 'react';
import type { Transaction, Payee, TransactionType, Account, Category } from '../types';
import { CloseIcon, HeartIcon } from './Icons';
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

const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose, onSave, totalIncome, monthName, payees, accounts, categories, transactionTypes }) => {
    const [amount, setAmount] = useState<number>(0);
    const [percentage, setPercentage] = useState<number | 'custom'>(10);
    const [customPercentage, setCustomPercentage] = useState<string>('');
    const [payeeId, setPayeeId] = useState<string>('');
    const [date, setDate] = useState<string>(getTodayDate());
    const [accountId, setAccountId] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Pre-select defaults
    useEffect(() => {
        if (isOpen) {
            setPercentage(10);
            setCustomPercentage('');
            setNotes('');
            setDate(getTodayDate());
            if (accounts.length > 0) setAccountId(accounts[0].id);
            // Try to find a previous payee used for donations or just default empty
            const donationPayee = payees.find(p => p.name.toLowerCase().includes('church') || p.name.toLowerCase().includes('charity'));
            setPayeeId(donationPayee?.id || '');
            
            // Recalculate default amount
            setAmount(Number((totalIncome * 0.10).toFixed(2)));
        }
    }, [isOpen, totalIncome, accounts, payees]);

    const handlePercentageChange = (val: number | 'custom') => {
        setPercentage(val);
        if (val !== 'custom') {
            setAmount(Number((totalIncome * (val / 100)).toFixed(2)));
        }
    };

    const handleCustomPercentageChange = (val: string) => {
        setCustomPercentage(val);
        const num = parseFloat(val);
        if (!isNaN(num)) {
            setAmount(Number((totalIncome * (num / 100)).toFixed(2)));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!amount || amount <= 0) {
            alert("Please enter a valid amount.");
            return;
        }
        if (!accountId) {
            alert("Please select an account.");
            return;
        }

        // Find correct types and categories
        const donationType = transactionTypes.find(t => t.balanceEffect === 'donation') || transactionTypes[0];
        const donationCategory = categories.find(c => c.name.toLowerCase().includes('donation') || c.name.toLowerCase().includes('charity')) || categories[0];

        const newTx: Transaction = {
            id: generateUUID(),
            date,
            amount,
            description: `Donation (${percentage === 'custom' ? customPercentage : percentage}%)`,
            payeeId: payeeId || undefined,
            accountId,
            typeId: donationType.id,
            categoryId: donationCategory.id,
            notes: `Calculated from ${monthName} income of $${totalIncome.toLocaleString()}.\n${notes}`,
        };

        onSave(newTx);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 text-pink-600">
                        <HeartIcon className="w-6 h-6" />
                        <h2 className="text-xl font-bold text-slate-800">Calculate Donation</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                    <p className="text-sm text-slate-500 uppercase font-bold mb-1">Total Income ({monthName})</p>
                    <p className="text-2xl font-mono font-bold text-slate-800">${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Calculation Basis</label>
                        <div className="flex flex-wrap gap-2">
                            {[10, 5, 1, 0.5].map((pct) => (
                                <button
                                    key={pct}
                                    type="button"
                                    onClick={() => handlePercentageChange(pct)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${percentage === pct ? 'bg-pink-100 text-pink-700 border-pink-300' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                >
                                    {pct}%
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => handlePercentageChange('custom')}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${percentage === 'custom' ? 'bg-pink-100 text-pink-700 border-pink-300' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                                Custom
                            </button>
                        </div>
                        {percentage === 'custom' && (
                            <div className="mt-2 flex items-center gap-2">
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={customPercentage} 
                                    onChange={(e) => handleCustomPercentageChange(e.target.value)}
                                    className="w-20 p-1 border rounded text-right"
                                    placeholder="0.0"
                                    autoFocus
                                />
                                <span className="text-slate-500">%</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Donation Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={amount} 
                                onChange={(e) => setAmount(parseFloat(e.target.value))}
                                className="w-full pl-8 p-2 border rounded-md font-bold text-lg text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Payee (Optional)</label>
                        <select 
                            value={payeeId} 
                            onChange={(e) => setPayeeId(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                        >
                            <option value="">Select Payee...</option>
                            {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700 shadow-sm flex items-center gap-2">
                            <HeartIcon className="w-4 h-4" />
                            Create Donation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DonationModal;
