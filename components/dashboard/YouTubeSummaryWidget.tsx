import React, { useMemo } from 'react';
import type { YouTubeMetric } from '../../types';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

interface Props {
    metrics: YouTubeMetric[];
}

export const YouTubeSummaryWidget: React.FC<Props> = ({ metrics }) => {
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
