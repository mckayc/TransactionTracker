
import React from 'react';
import type { Transaction } from '../types';
import Loader from './Loader';
import { CheckCircleIcon, ExclamationTriangleIcon } from './Icons';

interface ResultsDisplayProps {
    appState: 'processing' | 'success' | 'error';
    error: string | null;
    progressMessage: string;
    transactions: Transaction[];
    duplicatesIgnored: number;
    duplicatesImported: number;
    onClear: () => void;
}

const RecentlyAddedTable: React.FC<{transactions: Transaction[]}> = ({transactions}) => {
    const formatCurrency = (amount: number, typeId: string) => {
        const value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
        const sign = typeId.includes('incoming') ? '+' : (typeId.includes('outgoing') ? '-' : '');
        return `${sign}${value}`;
    }
    return (
        <div className="overflow-hidden border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {transactions.map(tx => (
                        <tr key={tx.id}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{tx.date}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-800 truncate max-w-xs">{tx.description}</td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${tx.typeId.includes('incoming') ? 'text-green-600' : (tx.typeId.includes('outgoing') ? 'text-red-600' : 'text-slate-600')}`}>
                                {formatCurrency(tx.amount, tx.typeId)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ appState, error, progressMessage, transactions, duplicatesIgnored, duplicatesImported, onClear }) => {
    
    const renderContent = () => {
        switch (appState) {
            case 'processing':
                return <Loader message={progressMessage} />;
            case 'success':
                const getSuccessMessage = () => {
                    let message = `Successfully imported ${transactions.length} transaction(s).`;
                    const totalDuplicates = duplicatesImported + duplicatesIgnored;

                    if (duplicatesImported > 0 && duplicatesIgnored > 0) {
                        message += ` You chose to import ${duplicatesImported} of ${totalDuplicates} potential duplicates.`;
                    } else if (duplicatesImported > 0) {
                        message += ` You chose to import all ${duplicatesImported} potential duplicate(s).`;
                    } else if (duplicatesIgnored > 0) {
                        message += ` ${duplicatesIgnored} potential duplicate(s) were ignored.`;
                    }
                    return message;
                };

                return (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <CheckCircleIcon className="w-8 h-8 text-green-500 flex-shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-green-800">Processing Complete</h3>
                                    <p className="text-sm text-green-700">
                                        {getSuccessMessage()}
                                    </p>
                                </div>
                            </div>
                             <button
                                onClick={onClear}
                                className="w-full sm:w-auto flex-shrink-0 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                            >
                                Import More
                            </button>
                        </div>
                        {transactions.length > 0 ? (
                            <div>
                                <h4 className="text-lg font-semibold text-slate-700 mb-2">Imported Transactions</h4>
                               <RecentlyAddedTable transactions={transactions} />
                            </div>
                        ) : (
                             <p className="text-center text-slate-500 py-4">No new transactions were ultimately imported.</p>
                        )}
                    </div>
                );
            case 'error':
                return (
                     <div className="space-y-4">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                           <div className="flex items-center gap-3">
                                <ExclamationTriangleIcon className="w-8 h-8 text-red-500 flex-shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-red-800">An Error Occurred</h3>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClear}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                        >
                            Try Again
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return <div className="min-h-[200px] flex flex-col justify-center">{renderContent()}</div>;
};
