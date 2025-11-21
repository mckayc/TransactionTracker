
import React, { useMemo } from 'react';
import type { Transaction, TransactionType, Account } from '../types';
import { CloseIcon, LinkIcon } from './Icons';

interface LinkedGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    transactionTypes: TransactionType[];
    accounts: Account[];
    onUnlink: (transactions: Transaction[]) => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const LinkedGroupModal: React.FC<LinkedGroupModalProps> = ({ isOpen, onClose, transactions, transactionTypes, accounts, onUnlink }) => {
    const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t.name])), [transactionTypes]);

    if (!isOpen) return null;

    const handleUnlink = () => {
        if (window.confirm("Are you sure you want to remove the link between these transactions? They will remain in your list but will no longer be grouped.")) {
            onUnlink(transactions);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <LinkIcon className="w-6 h-6 text-indigo-600" />
                            Linked Transaction Group
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">These transactions are linked together as a single event (e.g., transfer & splits).</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="space-y-3">
                        {transactions.map(tx => (
                            <div key={tx.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="font-bold text-slate-700 block">{tx.date}</span>
                                        <span className="text-xs text-slate-500">{accountMap.get(tx.accountId || '')}</span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-900">{formatCurrency(tx.amount)}</span>
                                </div>
                                <p className="text-sm text-slate-800 font-medium mb-1">{tx.description}</p>
                                <p className="text-xs text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded-full">{typeMap.get(tx.typeId) || 'Unknown Type'}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                        Close
                    </button>
                    <button 
                        onClick={handleUnlink}
                        className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm"
                    >
                        Unlink Group
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LinkedGroupModal;
