
import React, { useState, useEffect } from 'react';
import type { Transaction, AuditFinding, TransactionType, Category } from '../types';
import { auditTransactions } from '../services/geminiService';
import { CloseIcon, RobotIcon, CheckCircleIcon, ExclamationTriangleIcon, SearchCircleIcon, WrenchIcon, DuplicateIcon, SparklesIcon, CalendarIcon } from './Icons';

interface TransactionAuditorProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    transactionTypes: TransactionType[];
    categories: Category[];
    onApplyChanges: (updates: Transaction[]) => void;
    exampleGroup?: Transaction[];
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const SmartMatchCard: React.FC<{ 
    finding: AuditFinding; 
    transactions: Transaction[]; 
    onApply: () => void; 
    onIgnore: () => void; 
    isDone: boolean 
}> = ({ finding, transactions, onApply, onIgnore, isDone }) => {
    
    const relatedTxs = finding.affectedTransactionIds.map(id => transactions.find(t => t.id === id)).filter(Boolean) as Transaction[];
    
    // Logic: The "Payment" is usually the single largest transaction in the group.
    const sortedTxs = [...relatedTxs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    
    const paymentTx = sortedTxs[0];
    const expenseTxs = sortedTxs.slice(1);
    
    if (!paymentTx) return null;

    const paymentAmount = Math.abs(paymentTx.amount);
    const expensesTotal = expenseTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const difference = Math.abs(paymentAmount - expensesTotal);
    const isBalanced = difference < 0.05;

    return (
        <div className={`bg-white border rounded-xl overflow-hidden transition-opacity ${isDone ? 'opacity-50' : 'opacity-100'}`}>
            <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-white flex justify-between items-start">
                <div className="flex gap-3">
                    <SparklesIcon className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                    <div>
                        <h4 className="font-bold text-slate-800">{finding.title}</h4>
                        <p className="text-sm text-slate-600">{finding.reason}</p>
                    </div>
                </div>
                {isDone && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">Resolved</span>}
            </div>
            
            {!isDone && (
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Proposed Payment (Transfer)</p>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-700 truncate pr-2">{paymentTx.description}</span>
                                <span className="font-mono font-bold text-slate-800">{formatCurrency(paymentAmount)}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{paymentTx.date}</p>
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Linked Expenses</p>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-700">{expenseTxs.length} transactions</span>
                                <span className="font-mono font-bold text-slate-800">{formatCurrency(expensesTotal)}</span>
                            </div>
                            <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                                {expenseTxs.map(tx => (
                                    <div key={tx.id} className="flex justify-between text-xs text-slate-500">
                                        <span className="truncate pr-2">{tx.description}</span>
                                        <span>{formatCurrency(tx.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t">
                        <div className="flex items-center gap-2">
                            {isBalanced ? (
                                <span className="flex items-center gap-1 text-green-700 text-xs font-bold bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                    <CheckCircleIcon className="w-3 h-3" /> Balanced
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-amber-700 text-xs font-bold bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                                    <ExclamationTriangleIcon className="w-3 h-3" /> Difference: {formatCurrency(difference)}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onIgnore} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Ignore</button>
                            <button 
                                onClick={onApply}
                                className="px-4 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                            >
                                <WrenchIcon className="w-4 h-4" />
                                <span>Link as Group</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TransactionAuditor: React.FC<TransactionAuditorProps> = ({ isOpen, onClose, transactions, transactionTypes, categories, onApplyChanges, exampleGroup }) => {
    const [mode, setMode] = useState<'select' | 'scanning' | 'review'>('select');
    const [findings, setFindings] = useState<AuditFinding[]>([]);
    const [customQuery, setCustomQuery] = useState('');
    const [completedFindings, setCompletedFindings] = useState<Set<string>>(new Set());
    
    // Date Range State (Default to last 30 days)
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (isOpen && exampleGroup && mode === 'select') {
            handleScan('smart_match', [exampleGroup]);
        }
    }, [isOpen, exampleGroup]);

    if (!isOpen) return null;

    const getTrainingExamples = (txs: Transaction[]): Transaction[][] => {
        // Group by linkGroupId
        const groups = new Map<string, Transaction[]>();
        txs.forEach(tx => {
            if (tx.linkGroupId) {
                if (!groups.has(tx.linkGroupId)) groups.set(tx.linkGroupId, []);
                groups.get(tx.linkGroupId)?.push(tx);
            }
        });
        
        // Convert to array and take first 3 valid groups (must have > 1 tx)
        const examples = Array.from(groups.values())
            .filter(g => g.length > 1)
            .slice(0, 3);
            
        return examples;
    };

    const handleScan = async (auditType: string, explicitExamples?: Transaction[][]) => {
        setMode('scanning');
        try {
            // Filter by date range
            const start = new Date(startDate);
            const end = new Date(endDate);
            // Adjust end date to include the full day
            end.setHours(23, 59, 59, 999);

            const filteredTransactions = transactions.filter(tx => {
                const txDate = new Date(tx.date);
                return txDate >= start && txDate <= end;
            });

            // Use explicit examples if provided (manual training), otherwise gather history
            const examples = explicitExamples || getTrainingExamples(transactions);

            const results = await auditTransactions(filteredTransactions, transactionTypes, categories, auditType, examples);
            setFindings(results);
            setMode('review');
        } catch (error) {
            console.error("Scan failed", error);
            alert("Audit scan failed. Please check your API key and try again.");
            setMode('select');
        }
    };

    const handleApplyFix = (finding: AuditFinding) => {
        const updates: Transaction[] = [];
        
        const isSmartMatch = finding.title.toLowerCase().includes("smart match") || finding.title.toLowerCase().includes("link");
        
        if (isSmartMatch) {
            const relatedTxs = finding.affectedTransactionIds.map(id => transactions.find(t => t.id === id)).filter(Boolean) as Transaction[];
            // Identify payment vs expenses
            const sortedTxs = [...relatedTxs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
            const paymentTx = sortedTxs[0];
            const expenseTxs = sortedTxs.slice(1);
            const linkGroupId = crypto.randomUUID();

            // Find specific types
            // Fix: Use 'neutral' and 'outgoing' to match BalanceEffect type
            const transferType = transactionTypes.find(t => t.balanceEffect === 'neutral');
            const expenseType = transactionTypes.find(t => t.balanceEffect === 'outgoing');

            if (paymentTx) {
                updates.push({
                    ...paymentTx,
                    typeId: transferType ? transferType.id : paymentTx.typeId,
                    linkGroupId
                });
            }
            expenseTxs.forEach(tx => {
                updates.push({
                    ...tx,
                    typeId: expenseType ? expenseType.id : tx.typeId,
                    linkGroupId
                });
            });

        } else {
            // Standard fix logic
            finding.affectedTransactionIds.forEach(txId => {
                const originalTx = transactions.find(t => t.id === txId);
                if (originalTx) {
                    const updatedTx = { ...originalTx };
                    if (finding.suggestedChanges.categoryId) updatedTx.categoryId = finding.suggestedChanges.categoryId;
                    if (finding.suggestedChanges.typeId) updatedTx.typeId = finding.suggestedChanges.typeId;
                    updates.push(updatedTx);
                }
            });
        }

        onApplyChanges(updates);
        setCompletedFindings(prev => new Set(prev).add(finding.id));
    };

    const handleIgnore = (findingId: string) => {
        setCompletedFindings(prev => new Set(prev).add(findingId));
    };

    const reset = () => {
        setMode('select');
        setFindings([]);
        setCompletedFindings(new Set());
        setCustomQuery('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <RobotIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Transaction Auditor</h2>
                            <p className="text-indigo-100 text-xs">AI-Powered Issue Detection</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    
                    {mode === 'select' && (
                        <div className="space-y-8">
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold text-slate-800">What should I look for?</h3>
                                <p className="text-slate-500 max-w-md mx-auto">I can scan your recent transactions to find issues, hidden transfers, or link related payments.</p>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4 justify-center">
                                <div className="flex items-center gap-2 text-slate-600 font-medium">
                                    <CalendarIcon className="w-5 h-5 text-indigo-600" />
                                    <span>Scan Range:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
                                    <span className="text-slate-400">to</span>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={() => handleScan('smart_match')} className="flex flex-col items-center p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group col-span-1 sm:col-span-2">
                                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <SparklesIcon className="w-6 h-6" />
                                    </div>
                                    <span className="font-semibold text-slate-700">Smart Match & Link</span>
                                    <span className="text-xs text-slate-400 mt-1 text-center">I'll look for patterns in your history to find payments covering multiple expenses.</span>
                                </button>

                                <button onClick={() => handleScan('transfers')} className="flex flex-col items-center p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group">
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <WrenchIcon className="w-6 h-6" />
                                    </div>
                                    <span className="font-semibold text-slate-700">Find Hidden Transfers</span>
                                    <span className="text-xs text-slate-400 mt-1 text-center">Identify credit card payments marked as expenses.</span>
                                </button>

                                <button onClick={() => handleScan('subscriptions')} className="flex flex-col items-center p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group">
                                    <div className="p-3 bg-green-100 text-green-600 rounded-full mb-3 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                        <SearchCircleIcon className="w-6 h-6" />
                                    </div>
                                    <span className="font-semibold text-slate-700">Subscription Hunter</span>
                                    <span className="text-xs text-slate-400 mt-1 text-center">Find recurring charges hidden in 'General'.</span>
                                </button>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Custom Audit Query</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={customQuery} 
                                        onChange={(e) => setCustomQuery(e.target.value)}
                                        placeholder="e.g. 'Show me all dining expenses over $100'"
                                        className="flex-grow p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                    <button 
                                        onClick={() => handleScan(customQuery)}
                                        disabled={!customQuery.trim()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 font-medium"
                                    >
                                        Scan
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'scanning' && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            <p className="text-lg font-medium text-slate-600">Analyzing Transactions...</p>
                            {exampleGroup && <p className="text-sm text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Using your example for training</p>}
                            <p className="text-sm text-slate-400">This relies on AI and may take a few seconds.</p>
                        </div>
                    )}

                    {mode === 'review' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-800">Audit Findings ({findings.length})</h3>
                                <button onClick={reset} className="text-sm text-indigo-600 hover:underline">Start New Scan</button>
                            </div>

                            {findings.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                                    <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                    <p className="text-slate-600 font-medium">Clean Sheet!</p>
                                    <p className="text-sm text-slate-400">The auditor didn't find any matches or issues.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {findings.map(finding => {
                                        const isDone = completedFindings.has(finding.id);
                                        const isSmartMatch = finding.title.toLowerCase().includes("smart match") || finding.title.toLowerCase().includes("link");

                                        if (isSmartMatch) {
                                            return (
                                                <SmartMatchCard 
                                                    key={finding.id} 
                                                    finding={finding} 
                                                    transactions={transactions} 
                                                    onApply={() => handleApplyFix(finding)} 
                                                    onIgnore={() => handleIgnore(finding.id)}
                                                    isDone={isDone}
                                                />
                                            );
                                        }

                                        return (
                                            <div key={finding.id} className={`bg-white border rounded-xl overflow-hidden transition-opacity ${isDone ? 'opacity-50' : 'opacity-100'}`}>
                                                <div className="p-4 border-b bg-slate-50 flex justify-between items-start">
                                                    <div className="flex gap-3">
                                                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                                                        <div>
                                                            <h4 className="font-bold text-slate-800">{finding.title}</h4>
                                                            <p className="text-sm text-slate-600">{finding.reason}</p>
                                                        </div>
                                                    </div>
                                                    {isDone && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">Resolved</span>}
                                                </div>
                                                
                                                {!isDone && (
                                                    <div className="p-4">
                                                        <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Affected Transactions</p>
                                                        <ul className="space-y-2 mb-4">
                                                            {finding.affectedTransactionIds.map(txId => {
                                                                const tx = transactions.find(t => t.id === txId);
                                                                if (!tx) return null;
                                                                return (
                                                                    <li key={txId} className="flex justify-between text-sm p-2 bg-slate-50 rounded border border-slate-100">
                                                                        <span>{tx.date} - {tx.description}</span>
                                                                        <span className="font-mono font-semibold">${tx.amount.toFixed(2)}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>

                                                        <div className="flex justify-end gap-3 pt-2 border-t">
                                                            <button onClick={() => handleIgnore(finding.id)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Ignore</button>
                                                            <button 
                                                                onClick={() => handleApplyFix(finding)}
                                                                className="px-4 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                                                            >
                                                                <WrenchIcon className="w-4 h-4" />
                                                                <span>Apply Fix</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionAuditor;
