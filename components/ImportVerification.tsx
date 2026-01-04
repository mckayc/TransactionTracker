
import React, { useState, useMemo, useEffect } from 'react';
import type { RawTransaction, Account, Category, TransactionType, Payee, User, Transaction } from '../types';
import { DeleteIcon, CloseIcon, CheckCircleIcon, SlashIcon, AddIcon, SparklesIcon, SortIcon, InfoIcon, TableIcon, CopyIcon, ExclamationTriangleIcon, RepeatIcon } from './Icons';
import { getTransactionSignature } from '../services/transactionService';
import { suggestCategorization, hasApiKey } from '../services/geminiService';

type VerifiableTransaction = RawTransaction & { 
    categoryId: string; 
    tempId: string;
    isIgnored?: boolean;
    conflictType?: 'batch' | 'database' | 'reversal' | null;
    aiSuggested?: boolean;
    aiConfidence?: number;
    normalizedName?: string;
};

interface ImportVerificationProps {
    initialTransactions: VerifiableTransaction[];
    onComplete: (verifiedTransactions: (RawTransaction & { categoryId: string })[]) => void;
    onCancel: () => void;
    accounts: Account[];
    categories: Category[];
    transactionTypes: TransactionType[];
    payees: Payee[];
    users: User[];
    onCreateRule?: (tx: VerifiableTransaction) => void;
    existingTransactions: Transaction[];
}

const MetadataDrawer: React.FC<{ tx: VerifiableTransaction | null; onClose: () => void; }> = ({ tx, onClose }) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    if (!tx || !tx.metadata) return null;
    const copy = (t: string) => { navigator.clipboard.writeText(t); setCopiedKey(t); setTimeout(() => setCopiedKey(null), 2000); };
    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-slate-900 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800">
                    <div><h3 className="text-xl font-bold text-white flex items-center gap-2"><TableIcon className="w-6 h-6 text-indigo-400" />Source Data</h3></div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {Object.entries(tx.metadata).map(([key, value]) => (
                        <div key={key} className="bg-white/5 border border-white/5 rounded-xl p-4">
                            <div className="flex justify-between mb-2"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">{key}</span><button onClick={() => copy(key)} className="p-1 text-slate-500 hover:text-indigo-400"><CopyIcon className={`w-3.5 h-3.5 ${copiedKey === key ? 'text-green-400' : ''}`} /></button></div>
                            <div className="text-sm text-slate-100 break-words">{value || <em className="text-slate-700 italic">No data</em>}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ImportVerification: React.FC<ImportVerificationProps> = ({ initialTransactions, onComplete, onCancel, accounts, categories, transactionTypes, payees, users, existingTransactions }) => {
    const [transactions, setTransactions] = useState<VerifiableTransaction[]>([]);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [inspectedTx, setInspectedTx] = useState<VerifiableTransaction | null>(null);

    useEffect(() => {
        const process = async () => {
            let list = initialTransactions.filter(t => Math.abs(t.amount) > 0.001);
            const dbSigs = new Set(existingTransactions.map(t => getTransactionSignature(t)));
            const processed = list.map(tx => {
                const sig = getTransactionSignature(tx);
                const isConflict = dbSigs.has(sig);
                return { ...tx, conflictType: isConflict ? 'database' as const : null, isIgnored: isConflict };
            });
            setTransactions(processed);

            if (hasApiKey() && processed.length > 0) {
                setIsAiProcessing(true);
                try {
                    const suggestions = await suggestCategorization(processed, categories, payees);
                    setTransactions(prev => prev.map((tx, idx) => {
                        const sug = suggestions[idx];
                        if (!sug) return tx;
                        return {
                            ...tx,
                            categoryId: sug.confidence > 0.7 ? sug.categoryId : tx.categoryId,
                            payeeId: sug.payeeId || tx.payeeId,
                            normalizedName: sug.normalizedName,
                            aiSuggested: true,
                            aiConfidence: sug.confidence
                        };
                    }));
                } finally {
                    setIsAiProcessing(false);
                }
            }
        };
        process();
    }, [initialTransactions]);

    const handleUpdate = (txId: string, field: keyof VerifiableTransaction, value: any) => {
        setTransactions(prev => prev.map(tx => tx.tempId === txId ? { ...tx, [field]: value } : tx));
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    const importCount = transactions.filter(t => !t.isIgnored).length;

    return (
        <div className="space-y-4 relative min-h-[400px]">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-indigo-800">Verify Import Data</h2>
                    <p className="text-sm text-indigo-700">
                        {isAiProcessing ? (
                            <span className="flex items-center gap-2"><RepeatIcon className="w-4 h-4 animate-spin"/>AI is categorizing your data...</span>
                        ) : `${importCount} transactions ready for import.`}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg">Cancel</button>
                    <button onClick={() => onComplete(transactions.filter(t => !t.isIgnored))} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg flex items-center gap-2 shadow-sm">
                        <CheckCircleIcon className="w-4 h-4" /> Import {importCount} Items
                    </button>
                </div>
            </div>

            <div className="border rounded-lg shadow-sm bg-white overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Raw</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {transactions.map(tx => (
                            <tr key={tx.tempId} className={`hover:bg-slate-50 transition-all ${tx.isIgnored ? 'opacity-40 grayscale bg-slate-50' : ''}`}>
                                <td className="px-4 py-2">
                                    <button onClick={() => handleUpdate(tx.tempId, 'isIgnored', !tx.isIgnored)} className={`text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded border ${tx.isIgnored ? 'text-slate-400 border-slate-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
                                        {tx.isIgnored ? 'Skip' : 'Import'}
                                    </button>
                                </td>
                                <td className="px-4 py-2 text-xs font-mono text-slate-500">{tx.date}</td>
                                <td className="px-4 py-2">
                                    <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        {tx.normalizedName || tx.description}
                                        {tx.normalizedName && <span className="text-[10px] text-indigo-400 font-normal italic">(AI Cleaned)</span>}
                                    </div>
                                    {tx.location && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">@ {tx.location}</p>}
                                </td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-1.5">
                                        <select 
                                            value={tx.categoryId} 
                                            onChange={e => handleUpdate(tx.tempId, 'categoryId', e.target.value)}
                                            className="text-xs p-1 border rounded min-w-[120px]"
                                        >
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        {tx.aiSuggested && (
                                            <div className="group relative">
                                                <SparklesIcon className={`w-3.5 h-3.5 ${tx.aiConfidence! > 0.8 ? 'text-indigo-500' : 'text-slate-300'}`} />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                                    AI Confidence: {Math.round(tx.aiConfidence! * 100)}%
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-sm">
                                    <span className={tx.typeId.includes('expense') ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(tx.amount)}</span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => setInspectedTx(tx)} className="text-slate-300 hover:text-indigo-600"><TableIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <MetadataDrawer tx={inspectedTx} onClose={() => setInspectedTx(null)} />
        </div>
    );
};

export default ImportVerification;
