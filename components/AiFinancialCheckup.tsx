import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Category, Account } from '../types';
/* Fixed: Updated imports to use exported alias names ExclamationTriangleIcon and LightBulbIcon */
import { SparklesIcon, TrendingUpIcon, ExclamationTriangleIcon, LightBulbIcon, CheckCircleIcon, ArrowRightIcon } from './Icons';
import { getAiFinancialAnalysis } from '../services/geminiService';

interface AiInsight {
    id: string;
    type: 'alert' | 'opportunity' | 'summary';
    title: string;
    content: string;
    impact?: string;
    action?: string;
}

interface AiFinancialCheckupProps {
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
}

const AiFinancialCheckup: React.FC<AiFinancialCheckupProps> = ({ transactions, categories, accounts }) => {
    const [insights, setInsights] = useState<AiInsight[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastRun, setLastRun] = useState<string | null>(null);

    const generateInsights = async () => {
        setIsLoading(true);
        try {
            const categoryMap = new Map(categories.map(c => [c.id, c.name]));
            const accountMap = new Map(accounts.map(a => [a.id, a.name]));

            // Prepare a compact context
            const recentData = transactions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 150)
                .map(tx => ({
                    d: tx.date,
                    m: tx.amount,
                    c: categoryMap.get(tx.categoryId) || 'Other',
                    a: accountMap.get(tx.accountId || '') || 'Unknown',
                    desc: tx.description
                }));

            const prompt = `Act as a proactive personal CFO. Analyze these 150 recent transactions and provide 3-4 distinct actionable insights. 
            Return a JSON array of objects with fields: id, type ('alert' | 'opportunity' | 'summary'), title, content, impact, action.
            - Alerts: Overspending, spikes in subscriptions, unusual fees.
            - Opportunities: Tax deductions found, high cash balance needing investment, goal progress.
            - Summary: A quick health score statement.
            Keep it extremely concise and based on real data provided.`;

            const stream = await getAiFinancialAnalysis(prompt, { recentData });
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
            }

            // Extract JSON from markdown if needed
            const jsonMatch = fullText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                setInsights(parsed);
                setLastRun(new Date().toLocaleTimeString());
            }
        } catch (e) {
            console.error("AI Checkup failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (transactions.length > 0 && insights.length === 0) {
            generateInsights();
        }
    }, [transactions.length]);

    /* Fixed: Updated icon mapping to use exported component names */
    const getIcon = (type: string) => {
        switch (type) {
            case 'alert': return <ExclamationTriangleIcon className="w-5 h-5 text-rose-500" />;
            case 'opportunity': return <LightBulbIcon className="w-5 h-5 text-amber-500" />;
            default: return <SparklesIcon className="w-5 h-5 text-indigo-500" />;
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg">
                        <SparklesIcon className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="font-bold text-slate-800">AI Health Checkup</h2>
                </div>
                <div className="flex items-center gap-3">
                    {lastRun && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last run: {lastRun}</span>}
                    <button 
                        onClick={generateInsights} 
                        disabled={isLoading}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                        {isLoading ? 'Scanning...' : 'Refresh Scan'}
                    </button>
                </div>
            </div>

            <div className="p-4">
                {isLoading && insights.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-sm font-medium text-slate-500">AI is reviewing your ledgers...</p>
                    </div>
                ) : insights.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-sm text-slate-400">Run a checkup to see AI-driven insights.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {insights.map(insight => (
                            <div key={insight.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 hover:shadow-md transition-all group flex flex-col h-full">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                                        {getIcon(insight.type)}
                                    </div>
                                    {insight.impact && (
                                        <span className="text-[9px] font-black text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 uppercase">
                                            {insight.impact}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm mb-1">{insight.title}</h3>
                                <p className="text-xs text-slate-500 leading-relaxed flex-grow">{insight.content}</p>
                                {insight.action && (
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest group-hover:gap-3 transition-all cursor-pointer">
                                        <span>{insight.action}</span>
                                        <ArrowRightIcon className="w-3 h-3" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiFinancialCheckup;