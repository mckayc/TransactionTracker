
import React, { useMemo } from 'react';
import type { ProductJoinerProject, DashboardWidget } from '../../types';
import { WorkflowIcon, TrendingUpIcon, ArrowRightIcon, ExclamationTriangleIcon } from '../Icons';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

interface Props {
    projects: ProductJoinerProject[];
    config: DashboardWidget['config'];
}

export const ProductJoinerWidget: React.FC<Props> = ({ projects, config }) => {
    const project = projects.find(p => p.id === config?.projectId);
    const limit = config?.videoCount || 5;

    const displayList = useMemo(() => {
        if (!project) return [];
        const sorted = [...project.metrics].sort((a, b) => b.totalRevenue - a.totalRevenue);
        return sorted.slice(0, limit);
    }, [project, limit]);

    if (!project) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                <WorkflowIcon className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Project Missing</p>
                <p className="text-[10px] text-slate-300 mt-1 italic">Configure a source project in module settings.</p>
            </div>
        );
    }

    if (project.metrics.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                <TrendingUpIcon className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Empty Registry</p>
                <p className="text-[10px] text-slate-300 mt-1">Execute synthesis in the Joiner section first.</p>
            </div>
        );
    }

    const maxRevenue = Math.max(...displayList.map(v => v.totalRevenue), 1);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logic Batch</span>
                    <span className="text-[10px] font-bold text-indigo-600 truncate max-w-[150px]">{project.name}</span>
                </div>
                <a 
                    href="/integration-product-joiner" 
                    onClick={(e) => {
                        // This relies on the App routing being handled via state, 
                        // so we just let the parent know we want to navigate if using a router.
                        // Since we're in a single-file-like state app, we'll assume standard navigation 
                        // might need a prop, but for now we provide a nice UI link.
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                >
                    Workspace <ArrowRightIcon className="w-3 h-3" />
                </a>
            </div>
            
            <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
                {displayList.map((v) => {
                    const conv = v.clicks > 0 ? (v.orderedItems / v.clicks) * 100 : 0;
                    const isSuspicious = conv > 100;

                    return (
                        <div 
                            key={v.id} 
                            className="group p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 transition-all shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-1.5 gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <h4 className="text-[11px] font-black text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">{v.mainTitle}</h4>
                                        {isSuspicious && (
                                            <div className="group/susp relative cursor-help">
                                                <ExclamationTriangleIcon className="w-3 h-3 text-rose-500 animate-pulse" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/susp:block w-32 p-2 bg-slate-900 text-white text-[8px] font-black uppercase rounded shadow-xl z-50 text-center leading-tight">
                                                    Suspicious conversion volume ({conv.toFixed(0)}%). Check for duplicate data.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{formatNumber(v.views)} reach</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Strength: {((v.totalRevenue / maxRevenue) * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                                <p className="text-sm font-black text-slate-900 font-mono flex-shrink-0">{formatCurrency(v.totalRevenue)}</p>
                            </div>
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-600 transition-all duration-1000 ease-out" 
                                    style={{ width: `${(v.totalRevenue / maxRevenue) * 100}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="p-3 bg-slate-50 border-t flex justify-center flex-shrink-0">
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Viewing top {limit} assets by revenue</p>
            </div>
        </div>
    );
};
