
import React, { useMemo } from 'react';
import type { Transaction, FinancialGoal, DashboardWidget, Category, AmazonMetric, YouTubeMetric, FinancialPlan } from '../types';
import { ShieldCheckIcon, CalendarIcon, RobotIcon, SparklesIcon, TrendingUpIcon, BoxIcon, YoutubeIcon } from './Icons';
import { parseISOLocal } from '../dateUtils';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

export const GoalGaugeModule: React.FC<{ goals: FinancialGoal[], config: DashboardWidget['config'] }> = ({ goals, config }) => {
    const goal = goals.find(g => g.id === config?.goalId) || goals[0];
    if (!goal) return <div className="p-6 text-center text-slate-400 text-xs italic">No goals defined.</div>;

    const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full items-center justify-center">
            <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * progress) / 100} className="text-indigo-600 transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-800">{progress.toFixed(0)}%</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">Target</span>
                </div>
            </div>
            <div className="text-center">
                <p className="text-lg font-black text-slate-800">{formatCurrency(goal.currentAmount)}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">of {formatCurrency(goal.targetAmount)}</p>
            </div>
        </div>
    );
};

export const TaxProjectionModule: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const stats = useMemo(() => {
        let income = 0;
        let deductible = 0;
        transactions.forEach(tx => {
            const d = parseISOLocal(tx.date);
            if (d.getFullYear() === currentYear && !tx.isParent) {
                if (tx.typeId.includes('income')) income += tx.amount;
                else if (tx.typeId.includes('tax') || tx.categoryId.includes('business') || tx.categoryId.includes('office')) deductible += tx.amount;
            }
        });
        const taxable = Math.max(0, income - deductible);
        const estimatedTax = taxable * 0.25; 
        return { estimatedTax, taxable, income };
    }, [transactions, currentYear]);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full justify-center">
            <div className="space-y-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Liability (25%)</p>
                    <p className="text-2xl font-black text-orange-600">{formatCurrency(stats.estimatedTax)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-2 bg-slate-50 rounded-xl">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Taxable Basis</p>
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(stats.taxable)}</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-xl">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Net Income</p>
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(stats.income)}</p>
                    </div>
                </div>
            </div>
            <p className="text-[9px] text-slate-300 italic text-center uppercase tracking-tighter">Heuristic logic for {currentYear}</p>
        </div>
    );
};

export const AiInsightsModule: React.FC<{ plan: FinancialPlan | null }> = ({ plan }) => {
    return (
        <div className="p-6 space-y-4 flex flex-col h-full bg-indigo-900 text-white relative">
            <div className="relative z-10 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {plan ? (
                        <p className="text-sm text-indigo-100 leading-relaxed italic line-clamp-6">
                            "{plan.strategy.split('\n')[0] || plan.strategy}"
                        </p>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                            <RobotIcon className="w-8 h-8 text-indigo-400 opacity-50" />
                            <p className="text-xs text-indigo-300 font-medium">No strategy generated yet.</p>
                        </div>
                    )}
                </div>
            </div>
            <SparklesIcon className="absolute -right-12 -top-12 w-48 h-48 opacity-10 text-indigo-400 pointer-events-none" />
        </div>
    );
};

export const TopExpensesModule: React.FC<{ transactions: Transaction[], categories: Category[] }> = ({ transactions, categories }) => {
    const topCats = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const map = new Map<string, number>();
        
        transactions.forEach(tx => {
            const d = parseISOLocal(tx.date);
            if (d >= start && (tx.typeId.includes('purchase') || tx.typeId.includes('tax')) && !tx.isParent) {
                map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
            }
        });

        return Array.from(map.entries())
            .map(([id, amt]) => ({ name: categories.find(c => c.id === id)?.name || 'Other', amt }))
            .sort((a, b) => b.amt - a.amt)
            .slice(0, 5);
    }, [transactions, categories]);

    const totalExpense = topCats.reduce((s, c) => s + c.amt, 0);

    return (
        <div className="p-6 space-y-4 flex flex-col h-full overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
                {topCats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50 italic text-xs"><p>No expense data yet.</p></div>
                ) : (
                    topCats.map(c => (
                        <div key={c.name} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-600 truncate">{c.name}</span>
                                <span className="text-slate-800">{formatCurrency(c.amt)}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500" style={{ width: `${(c.amt / totalExpense) * 100}%` }} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export const AmazonSummaryModule: React.FC<{ metrics: AmazonMetric[] }> = ({ metrics }) => {
    const stats = useMemo(() => {
        const res = { rev: 0, clicks: 0, items: 0 };
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        metrics.forEach(m => {
            if (m.saleDate >= start) {
                res.rev += m.revenue;
                res.clicks += m.clicks;
                res.items += m.orderedItems;
            }
        });
        return res;
    }, [metrics]);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full justify-center">
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 text-center">
                <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">MTD Earnings</p>
                <p className="text-2xl font-black text-orange-700">{formatCurrency(stats.rev)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clicks</p>
                    <p className="text-lg font-black text-slate-700">{stats.clicks.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Items</p>
                    <p className="text-lg font-black text-slate-700">{stats.items.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};

export const YouTubeSummaryModule: React.FC<{ metrics: YouTubeMetric[] }> = ({ metrics }) => {
    const stats = useMemo(() => {
        const res = { rev: 0, views: 0, subs: 0 };
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        metrics.forEach(m => {
            if (m.publishDate >= start) {
                res.rev += m.estimatedRevenue;
                res.views += m.views;
                res.subs += m.subscribersGained;
            }
        });
        return res;
    }, [metrics]);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full justify-center">
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-center">
                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">MTD AdSense</p>
                <p className="text-2xl font-black text-red-700">{formatCurrency(stats.rev)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Views</p>
                    <p className="text-lg font-black text-slate-700">{stats.views.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subs</p>
                    <p className="text-lg font-black text-slate-700">{stats.subs.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};
