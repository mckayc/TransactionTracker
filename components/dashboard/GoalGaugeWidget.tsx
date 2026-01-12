import React from 'react';
import type { FinancialGoal, DashboardWidget } from '../../types';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

interface Props {
    goals: FinancialGoal[];
    config: DashboardWidget['config'];
}

export const GoalGaugeWidget: React.FC<Props> = ({ goals, config }) => {
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
