import React, { useMemo } from 'react';
import type { AmazonMetric } from '../../types';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

interface Props {
    metrics: AmazonMetric[];
}

export const AmazonSummaryWidget: React.FC<Props> = ({ metrics }) => {
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
