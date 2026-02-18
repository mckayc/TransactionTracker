
import React, { useMemo, useState } from 'react';
import type { JoinedMetric, ProductJoinerProject, DashboardWidget, View } from '../../types';
import { WorkflowIcon, TrendingUpIcon, ArrowRightIcon, ExclamationTriangleIcon, CloseIcon, BarChartIcon, YoutubeIcon, BoxIcon, SparklesIcon, DollarSign } from '../Icons';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

interface Props {
    projects: ProductJoinerProject[];
    config: DashboardWidget['config'];
    onNavigate: (view: View) => void;
}

export const ProductJoinerWidget: React.FC<Props> = ({ projects, config, onNavigate }) => {
    const [inspectingAsset, setInspectingAsset] = useState<JoinedMetric | null>(null);
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
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-indigo-600 truncate max-w-[120px]">{project.name}</span>
                        {project.startDate && (
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">
                                ({project.startDate} - {project.endDate || 'Now'})
                            </span>
                        )}
                    </div>
                </div>
                <button 
                    onClick={() => onNavigate('integration-product-joiner')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                >
                    Workspace <ArrowRightIcon className="w-3 h-3" />
                </button>
            </div>
            
            <div className={`flex-1 p-4 space-y-3 custom-scrollbar ${limit > 10 ? 'overflow-y-auto' : 'overflow-y-visible'}`}>
                {displayList.map((v) => {
                    const conv = v.clicks > 0 ? (v.orderedItems / v.clicks) * 100 : 0;
                    const isSuspicious = conv > 100;

                    return (
                        <div 
                            key={v.id} 
                            onClick={() => setInspectingAsset(v)}
                            className="group p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 transition-all shadow-sm cursor-pointer"
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

            {inspectingAsset && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setInspectingAsset(null)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-white rounded-3xl shadow-sm text-indigo-600"><BarChartIcon className="w-8 h-8" /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 leading-tight">{inspectingAsset.mainTitle}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Institutional Yield Audit</p>
                                </div>
                            </div>
                            <button onClick={() => setInspectingAsset(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>

                        <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-900 text-white rounded-3xl relative overflow-hidden shadow-lg">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1 relative z-10">Lifetime Value</p>
                                    <p className="text-3xl font-black relative z-10">{formatCurrency(inspectingAsset.totalRevenue)}</p>
                                    <DollarSign className="absolute -right-4 -bottom-4 w-20 h-20 text-white opacity-5" />
                                </div>
                                <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Portfolio Reach</p>
                                    <p className="text-3xl font-black text-slate-800">{formatNumber(inspectingAsset.views)} <span className="text-[10px] text-slate-400">VIEWS</span></p>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Channel Yield Analysis</h4>
                                <div className="space-y-2">
                                    {[
                                        { label: 'YouTube AdSense', val: inspectingAsset.videoEstimatedRevenue, icon: <YoutubeIcon className="w-3.5 h-3.5 text-red-600"/> },
                                        { label: 'Amazon Onsite', val: inspectingAsset.amazonOnsiteRevenue, icon: <BoxIcon className="w-3.5 h-3.5 text-blue-600"/> },
                                        { label: 'Amazon Offsite', val: inspectingAsset.amazonOffsiteRevenue, icon: <BoxIcon className="w-3.5 h-3.5 text-green-600"/> },
                                        { label: 'Creator Connections (Onsite)', val: inspectingAsset.creatorConnectionsOnsiteRevenue, icon: <SparklesIcon className="w-3.5 h-3.5 text-indigo-600"/> },
                                        { label: 'Creator Connections (Offsite)', val: inspectingAsset.creatorConnectionsOffsiteRevenue, icon: <SparklesIcon className="w-3.5 h-3.5 text-violet-600"/> }
                                    ].map(item => (
                                        <div key={item.label} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3">
                                                {item.icon}
                                                <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                            </div>
                                            <span className="text-sm font-black font-mono text-slate-900">{formatCurrency(item.val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t shrink-0">
                            <button onClick={() => setInspectingAsset(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Dismiss Inspector</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
