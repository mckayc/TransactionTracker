
import React, { useMemo } from 'react';
import type { Transaction, TransactionType, Account } from '../types';
import { CloseIcon, LinkIcon, SparklesIcon, TrashIcon, InfoIcon, SplitIcon, ListIcon } from './Icons';

interface LinkedGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    transactionTypes: TransactionType[];
    accounts: Account[];
    onUnlink: (transactions: Transaction[]) => void;
    onFindSimilar: (exampleGroup: Transaction[]) => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const LinkedGroupModal: React.FC<LinkedGroupModalProps> = ({ isOpen, onClose, transactions, transactionTypes, accounts, onUnlink, onFindSimilar }) => {
    const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t.name])), [transactionTypes]);

    const isSplitGroup = useMemo(() => transactions.some(t => t.isParent), [transactions]);
    const parentTx = useMemo(() => transactions.find(t => t.isParent), [transactions]);
    const childTxs = useMemo(() => transactions.filter(t => !t.isParent), [transactions]);

    if (!isOpen) return null;

    const handleUnlink = () => {
        const msg = isSplitGroup 
            ? "Unlinking this split will delete all individual parts and restore the parent as a single transaction. Proceed?"
            : "Remove the link between these transactions? They will remain in your list but will no longer be grouped.";
            
        if (window.confirm(msg)) {
            onUnlink(transactions);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                            {isSplitGroup ? <SplitIcon className="w-8 h-8" /> : <LinkIcon className="w-8 h-8" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                {isSplitGroup ? 'Split Logic Registry' : 'Linked Group Management'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                {transactions.length} record(s) participating in cluster
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><CloseIcon className="w-8 h-8" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 custom-scrollbar">
                    {isSplitGroup && parentTx && (
                        <div className="bg-white p-6 rounded-[2rem] border-2 border-indigo-500 shadow-sm relative">
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-lg shadow-md">Container (Original)</div>
                            <div className="flex justify-between items-start pt-2">
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-lg font-black text-slate-800 truncate pr-4">{parentTx.description}</h4>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[10px] font-mono text-slate-400">{parentTx.date}</span>
                                        <div className="h-3 w-px bg-slate-200" />
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{accountMap.get(parentTx.accountId || '')}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black text-slate-900 font-mono">{formatCurrency(parentTx.amount)}</span>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                            <ListIcon className="w-3 h-3" /> {isSplitGroup ? 'Defined Components' : 'Participating Transactions'}
                        </h5>
                        {(isSplitGroup ? childTxs : transactions).map(tx => (
                            <div key={tx.id} className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-indigo-200 transition-all`}>
                                <div className="min-w-0 flex-1 pr-6">
                                    <p className="text-sm font-bold text-slate-700 truncate">{tx.description}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-black text-indigo-400 uppercase bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{typeMap.get(tx.typeId) || 'Unknown Type'}</span>
                                        {!isSplitGroup && <span className="text-[9px] font-mono text-slate-400">{tx.date}</span>}
                                    </div>
                                </div>
                                <span className="text-sm font-black text-slate-800 font-mono shrink-0">{formatCurrency(tx.amount)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-start gap-4">
                        <InfoIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed font-medium">
                            {isSplitGroup 
                                ? "This record has been programmatically deconstructed. Changes to the container title or its parts will propagate across the ledger."
                                : "These items share a logical bond. Unlinking will detach them and return them to individual ledger entries."}
                        </p>
                    </div>
                </div>

                <div className="p-8 border-t bg-white flex justify-between items-center shrink-0">
                    <button 
                        onClick={handleUnlink}
                        className="px-6 py-3 bg-red-50 text-red-600 font-black rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest border border-red-100"
                    >
                        <TrashIcon className="w-4 h-4" /> Dissolve Link Logic
                    </button>
                    <div className="flex gap-3">
                        {!isSplitGroup && (
                            <button 
                                onClick={() => onFindSimilar(transactions)}
                                className="px-6 py-3 bg-indigo-50 text-indigo-600 font-black rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest border border-indigo-100"
                            >
                                <SparklesIcon className="w-4 h-4" /> Find Pattern Matches
                            </button>
                        )}
                        <button onClick={onClose} className="px-10 py-3 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Dismiss</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LinkedGroupModal;
