import React, { useMemo } from 'react';
import type { Transaction, Account, TransactionType } from '../types';
import { CloseIcon, LinkIcon, DeleteIcon } from './Icons';

interface DuplicateFinderProps {
    groups: Transaction[][][];
    onLinkGroup: (group: Transaction[][]) => void;
    onDismissGroup: (groupId: string) => void;
    onDelete: (txId: string) => void;
    onExit: () => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const TransactionCard: React.FC<{
    tx: Transaction;
    accountName?: string;
    typeName?: string;
    balanceEffect?: string;
    onDelete: (id: string) => void;
}> = ({ tx, accountName, typeName, balanceEffect, onDelete }) => {
    
    const isNegative = balanceEffect === 'expense';
    const amountColor = isNegative ? 'text-red-600' : (balanceEffect === 'transfer' ? 'text-slate-600' : 'text-green-600');
    const amountPrefix = isNegative ? '-' : (balanceEffect === 'transfer' ? '' : '+');

    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2 relative">
            <button 
                onClick={() => onDelete(tx.id)}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full"
                title="Delete this transaction"
            >
                <DeleteIcon className="w-4 h-4" />
            </button>
            <div className="flex justify-between items-baseline">
                <p className="font-bold text-slate-800">{tx.date}</p>
                <p className={`font-bold text-lg ${amountColor}`}>{amountPrefix}{formatCurrency(tx.amount)}</p>
            </div>
            <p className="text-sm text-slate-800 font-medium truncate" title={tx.description}>{tx.description}</p>
            <div className="text-xs text-slate-500 pt-1 border-t">
                <p><strong>Account:</strong> {accountName || 'N/A'}</p>
                <p><strong>Type:</strong> {typeName || 'N/A'}</p>
            </div>
        </div>
    );
}


const DuplicateFinder: React.FC<DuplicateFinderProps> = ({ groups, onLinkGroup, onDismissGroup, onDelete, onExit, accounts, transactionTypes }) => {
    const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);

    const handleDelete = (txId: string) => {
        if (window.confirm('Are you sure you want to permanently delete this transaction? This action cannot be undone.')) {
            onDelete(txId);
            const groupId = groups.find(g => g.flat().some(tx => tx.id === txId))?.[0]?.[0]?.id;
            if (groupId) {
                onDismissGroup(groupId);
            }
        }
    };

    return (
        <div className="bg-slate-50 p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-700">Potential Duplicates Found ({groups.length})</h2>
                <button onClick={onExit} className="mt-2 sm:mt-0 flex items-center gap-2 px-4 py-2 text-sm text-slate-700 font-semibold bg-slate-200 rounded-lg hover:bg-slate-300">
                    <CloseIcon className="w-5 h-5"/>
                    <span>Back to All Transactions</span>
                </button>
            </div>
            <p className="text-sm text-slate-600 mb-6 max-w-3xl">
                Review these groups of transactions. The sum of amounts on each side is equal, suggesting they might be a single transfer event recorded differently across accounts (e.g., a mortgage payment).
            </p>

            {groups.length > 0 ? (
                <div className="space-y-6">
                    {groups.map((group) => {
                        const sideA = group[0];
                        const sideB = group[1];
                        const totalA = sideA.reduce((sum, tx) => sum + tx.amount, 0);
                        const totalB = sideB.reduce((sum, tx) => sum + tx.amount, 0);
                        const groupId = sideA[0].id;

                        return (
                        <div key={groupId} className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                            <div className="grid md:grid-cols-2 gap-4 items-start">
                                {/* Side A */}
                                <div className="space-y-2 p-2 bg-white/50 rounded-md">
                                    {sideA.map(tx => (
                                        <TransactionCard 
                                            key={tx.id}
                                            tx={tx} 
                                            accountName={accountMap.get(tx.accountId || '')}
                                            typeName={typeMap.get(tx.typeId)?.name}
                                            balanceEffect={typeMap.get(tx.typeId)?.balanceEffect}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                    <div className="text-right font-bold text-slate-700 pr-2 pt-2 border-t">
                                        Side A Total: {formatCurrency(totalA)}
                                    </div>
                                </div>

                                {/* Side B */}
                                <div className="space-y-2 p-2 bg-white/50 rounded-md">
                                    {sideB.map(tx => (
                                        <TransactionCard 
                                            key={tx.id}
                                            tx={tx}
                                            accountName={accountMap.get(tx.accountId || '')}
                                            typeName={typeMap.get(tx.typeId)?.name}
                                            balanceEffect={typeMap.get(tx.typeId)?.balanceEffect}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                     <div className="text-right font-bold text-slate-700 pr-2 pt-2 border-t">
                                        Side B Total: {formatCurrency(totalB)}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-col sm:flex-row justify-end items-center gap-3">
                                <button onClick={() => onDismissGroup(groupId)} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100">
                                    Not a Duplicate
                                </button>
                                <button onClick={() => onLinkGroup(group)} className="w-full sm:w-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                                    <LinkIcon className="w-4 h-4"/>
                                    <span>Link as Transfer</span>
                                </button>
                            </div>
                        </div>
                    )})}
                </div>
            ) : ( 
                <div className="text-center py-16">
                    <h3 className="text-lg font-semibold text-slate-600">All Reconciled!</h3>
                    <p className="text-sm text-slate-500 mt-2">The scan didn't find any more transactions that look like transfers between accounts.</p>
                </div>
             )}
        </div>
    );
};

export default DuplicateFinder;