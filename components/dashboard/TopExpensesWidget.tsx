
import React, { useMemo } from 'react';
import type { Transaction, Category, DashboardWidget } from '../../types';
import { parseISOLocal } from '../../dateUtils';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

interface Props {
    transactions: Transaction[];
    categories: Category[];
    config?: DashboardWidget['config'];
}

export const TopExpensesWidget: React.FC<Props> = ({ transactions, categories, config }) => {
    const userIds = config?.userIds || [];

    const topCats = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const map = new Map<string, number>();
        
        transactions.forEach(tx => {
            const d = parseISOLocal(tx.date);
            if (d >= start && (tx.typeId.includes('purchase') || tx.typeId.includes('tax')) && !tx.isParent) {
                if (userIds && userIds.length > 0 && !userIds.includes(tx.userId || '')) return;
                map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
            }
        });

        return Array.from(map.entries())
            .map(([id, amt]) => ({ name: categories.find(c => c.id === id)?.name || 'Other', amt }))
            .sort((a, b) => b.amt - a.amt)
            .slice(0, 5);
    }, [transactions, categories, userIds]);

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
