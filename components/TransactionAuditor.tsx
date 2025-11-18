
import React, { useState } from 'react';
import type { Transaction, AuditFinding, TransactionType, Category } from '../types';
import { auditTransactions } from '../services/geminiService';
import { CloseIcon, RobotIcon, CheckCircleIcon, ExclamationTriangleIcon, SearchCircleIcon, WrenchIcon, DuplicateIcon } from './Icons';

interface TransactionAuditorProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    transactionTypes: TransactionType[];
    categories: Category[];
    onApplyChanges: (updates: Transaction[]) => void;
}

const TransactionAuditor: React.FC<TransactionAuditorProps> = ({ isOpen, onClose, transactions, transactionTypes, categories, onApplyChanges }) => {
    const [mode, setMode] = useState<'select' | 'scanning' | 'review'>('select');
    const [findings, setFindings] = useState<AuditFinding[]>([]);
    const [customQuery, setCustomQuery] = useState('');
    const [completedFindings, setCompletedFindings] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const handleScan = async (auditType: string) => {
        setMode('scanning');
        try {
            // To avoid token limits, we'll send the last 150 transactions.
            // Ideally this would be user configurable or use a sliding window.
            const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const subset = sortedTransactions.slice(0, 150); 

            const results = await auditTransactions(subset, transactionTypes, categories, auditType);
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
        
        finding.affectedTransactionIds.forEach(txId => {
            const originalTx = transactions.find(t => t.id === txId);
            if (originalTx) {
                const updatedTx = { ...originalTx };
                if (finding.suggestedChanges.categoryId) updatedTx.categoryId = finding.suggestedChanges.categoryId;
                if (finding.suggestedChanges.typeId) updatedTx.typeId = finding.suggestedChanges.typeId;
                // Note: payeeName update requires finding/creating Payee ID which is complex, skipping for this simplified version
                updates.push(updatedTx);
            }
        });

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
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    
                    {mode === 'select' && (
                        <div className="space-y-8">
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold text-slate-800">What should I look for?</h3>
                                <p className="text-slate-500 max-w-md mx-auto">I can scan your recent transactions to find issues, hidden transfers, or answer specific questions.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                                <button onClick={() => handleScan('mortgage_splits')} className="flex flex-col items-center p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group">
                                    <div className="p-3 bg-purple-100 text-purple-600 rounded-full mb-3 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                        <DuplicateIcon className="w-6 h-6" />
                                    </div>
                                    <span className="font-semibold text-slate-700">Mortgage & Split Matcher</span>
                                    <span className="text-xs text-slate-400 mt-1 text-center">Find split payments (Principal + Interest) that duplicate a total withdrawal.</span>
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
                                    <p className="text-sm text-slate-400">The auditor didn't find any issues based on your criteria.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {findings.map(finding => {
                                        const isDone = completedFindings.has(finding.id);
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
