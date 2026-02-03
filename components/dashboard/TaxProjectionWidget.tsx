
import React, { useMemo } from 'react';
import type { Transaction, DashboardWidget } from '../../types';
import { parseISOLocal } from '../../dateUtils';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

interface Props {
    transactions: Transaction[];
    config?: DashboardWidget['config'];
}

export const TaxProjectionWidget: React.FC<Props> = ({ transactions, config }) => {
    const userIds = config?.userIds || [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const stats = useMemo(() => {
        let income = 0;
        let deductible = 0;
        transactions.forEach(tx => {
            const d = parseISOLocal(tx.date);
            if (d.getFullYear() === currentYear && !tx.isParent) {
                if (userIds && userIds.length > 0 && !userIds.includes(tx.userId || '')) return;

                if (tx.typeId.includes('income')) income += tx.amount;
                else if (tx.typeId.includes('tax') || tx.categoryId.includes('business') || tx.categoryId.includes('office')) deductible += tx.amount;
            }
        });
        const taxable = Math.max(0, income - deductible);
        const estimatedTax = taxable * 0.25; 
        return { estimatedTax, taxable, income };
    }, [transactions, currentYear, userIds]);

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
