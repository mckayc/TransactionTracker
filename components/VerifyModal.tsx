
import React, { useState } from 'react';
import { parseTransactionsFromText } from '../services/csvParserService';
import type { Transaction, TransactionType, RawTransaction } from '../types';
import { CloseIcon, ShieldCheckIcon, CheckCircleIcon, ExclamationTriangleIcon } from './Icons';

interface VerifyModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTransactions: Transaction[];
    transactionTypes: TransactionType[];
}

interface VerificationResult {
    matched: { appTx: Transaction; stmtTx: RawTransaction }[];
    missingInApp: RawTransaction[];
    missingInStatement: Transaction[];
}

const VerifyModal: React.FC<VerifyModalProps> = ({ isOpen, onClose, currentTransactions, transactionTypes }) => {
    const [step, setStep] = useState<'input' | 'results'>('input');
    const [pastedText, setPastedText] = useState('');
    const [results, setResults] = useState<VerificationResult | null>(null);
    const [activeTab, setActiveTab] = useState<'missing_app' | 'missing_stmt' | 'matched'>('missing_app');
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleVerify = async () => {
        setIsProcessing(true);
        try {
            // 1. Parse pasted text
            // We pass a dummy account ID because we are just comparing values, not importing yet
            const parsedTransactions = await parseTransactionsFromText(pastedText, 'dummy-account', transactionTypes, (msg: string) => {});
            
            // 2. Perform comparison
            const matchedPairs: { appTx: Transaction; stmtTx: RawTransaction }[] = [];
            const missingInApp: RawTransaction[] = [];
            const appTxMatchedSet = new Set<string>();

            // For every parsed transaction, try to find a match in currentTransactions
            parsedTransactions.forEach((stmtTx: RawTransaction) => {
                const stmtDate = new Date(stmtTx.date).getTime();
                const stmtAmount = stmtTx.amount;

                // Simple matching logic: 
                // Date within +/- 2 days
                // Amount matches exactly (0.01 tolerance)
                
                // Find best match that hasn't been used
                const match = currentTransactions.find(appTx => {
                    if (appTxMatchedSet.has(appTx.id)) return false;
                    
                    const appDate = new Date(appTx.date).getTime();
                    const dateDiff = Math.abs(appDate - stmtDate) / (1000 * 60 * 60 * 24);
                    const amountDiff = Math.abs(appTx.amount - stmtAmount);

                    return dateDiff <= 2 && amountDiff < 0.01;
                });

                if (match) {
                    matchedPairs.push({ appTx: match, stmtTx });
                    appTxMatchedSet.add(match.id);
                } else {
                    missingInApp.push(stmtTx);
                }
            });

            const missingInStatement = currentTransactions.filter(tx => !appTxMatchedSet.has(tx.id));

            setResults({
                matched: matchedPairs,
                missingInApp,
                missingInStatement
            });
            setStep('results');
            // Default to showing problems if any
            if (missingInApp.length > 0) setActiveTab('missing_app');
            else if (missingInStatement.length > 0) setActiveTab('missing_stmt');
            else setActiveTab('matched');

        } catch (e) {
            console.error(e);
            alert("Failed to parse text. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setStep('input');
        setPastedText('');
        setResults(null);
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-xl">
                    <div className="flex items-center gap-2 text-indigo-800">
                        <ShieldCheckIcon className="w-6 h-6" />
                        <h2 className="text-xl font-bold">Reconcile & Verify</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'input' ? (
                        <div className="space-y-4">
                            <p className="text-slate-600 text-sm">
                                Paste transactions from your bank statement (CSV text or copied table rows) below. 
                                We will compare them against the <span className="font-bold">{currentTransactions.length}</span> transactions currently visible in your list to find discrepancies.
                            </p>
                            <textarea
                                value={pastedText}
                                onChange={e => setPastedText(e.target.value)}
                                placeholder="Date, Description, Amount..."
                                className="w-full h-64 p-4 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <div className="flex justify-end">
                                <button 
                                    onClick={handleVerify} 
                                    disabled={!pastedText.trim() || isProcessing}
                                    className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isProcessing ? 'Analyzing...' : 'Verify Transactions'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex gap-4 border-b">
                                <button 
                                    onClick={() => setActiveTab('missing_app')}
                                    className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'missing_app' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    Missing in App ({results?.missingInApp.length})
                                </button>
                                <button 
                                    onClick={() => setActiveTab('missing_stmt')}
                                    className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'missing_stmt' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    Missing in Statement ({results?.missingInStatement.length})
                                </button>
                                <button 
                                    onClick={() => setActiveTab('matched')}
                                    className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'matched' ? 'border-green-500 text-green-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    Matches ({results?.matched.length})
                                </button>
                            </div>

                            <div className="space-y-2">
                                {activeTab === 'missing_app' && (
                                    <>
                                        <p className="text-sm text-slate-500 mb-2">These transactions were found in your pasted text but NOT in your current list. You may need to import them.</p>
                                        {results?.missingInApp.length === 0 ? (
                                            <p className="text-center text-slate-400 py-8 italic">No missing transactions found.</p>
                                        ) : (
                                            results?.missingInApp.map((tx, i) => (
                                                <div key={i} className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                                                    <div>
                                                        <span className="font-bold text-slate-700 mr-3">{tx.date}</span>
                                                        <span className="text-slate-800">{tx.description}</span>
                                                    </div>
                                                    <span className="font-mono font-semibold text-red-700">{formatCurrency(tx.amount)}</span>
                                                </div>
                                            ))
                                        )}
                                    </>
                                )}

                                {activeTab === 'missing_stmt' && (
                                    <>
                                        <p className="text-sm text-slate-500 mb-2">These transactions are in your list but were NOT found in the pasted text. They might be duplicates, from a different period, or manual entries.</p>
                                        {results?.missingInStatement.length === 0 ? (
                                            <p className="text-center text-slate-400 py-8 italic">Everything in your list was found in the statement.</p>
                                        ) : (
                                            results?.missingInStatement.map(tx => (
                                                <div key={tx.id} className="flex justify-between items-center p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm">
                                                    <div>
                                                        <span className="font-bold text-slate-700 mr-3">{tx.date}</span>
                                                        <span className="text-slate-800">{tx.description}</span>
                                                    </div>
                                                    <span className="font-mono font-semibold text-orange-700">{formatCurrency(tx.amount)}</span>
                                                </div>
                                            ))
                                        )}
                                    </>
                                )}

                                {activeTab === 'matched' && (
                                    <>
                                        <p className="text-sm text-slate-500 mb-2">These transactions matched successfully.</p>
                                        {results?.matched.map((pair, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 border-b border-slate-100 text-sm hover:bg-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                                    <span className="text-slate-600">{pair.appTx.date}</span>
                                                    <span className="text-slate-800 font-medium">{pair.appTx.description}</span>
                                                </div>
                                                <span className="font-mono text-slate-600">{formatCurrency(pair.appTx.amount)}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-between items-center rounded-b-xl">
                    {step === 'results' ? (
                        <button onClick={reset} className="text-sm text-indigo-600 hover:underline">Start Over</button>
                    ) : <div></div>}
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border rounded-lg hover:bg-slate-50">Close</button>
                </div>
            </div>
        </div>
    );
};

export default VerifyModal;
