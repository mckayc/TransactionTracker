import React, { useMemo, useState } from 'react';
import type { JoinedMetric, DashboardWidget } from '../../types';
import { BoxIcon, YoutubeIcon, VideoIcon, TrendingUpIcon, CloseIcon, DollarSign, SparklesIcon } from '../Icons';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

interface Props {
    metrics: JoinedMetric[];
    config: DashboardWidget['config'];
}

export const VideoEarningsWidget: React.FC<Props> = ({ metrics, config }) => {
    const [inspectingVideo, setInspectingVideo] = useState<JoinedMetric | null>(null);
    
    const displayList = useMemo(() => {
        let base = [...metrics];
        const reportYear = config?.reportYear || 'all';
        const publishYear = config?.publishYear || 'all';
        const limit = config?.videoCount || 5;

        if (reportYear !== 'all') base = base.filter(m => m.reportYear === reportYear);
        if (publishYear !== 'all') base = base.filter(m => m.publishDate?.startsWith(publishYear));

        // Group by Video
        const map = new Map<string, JoinedMetric>();
        base.forEach(m => {
            const key = m.videoId || m.asin || m.id;
            if (!map.has(key)) {
                map.set(key, { ...m });
            } else {
                const ex = map.get(key)!;
                ex.totalRevenue += m.totalRevenue;
                ex.videoEstimatedRevenue += m.videoEstimatedRevenue;
                ex.amazonOnsiteRevenue += m.amazonOnsiteRevenue;
                ex.amazonOffsiteRevenue += m.amazonOffsiteRevenue;
                ex.creatorConnectionsOnsiteRevenue += m.creatorConnectionsOnsiteRevenue;
                ex.creatorConnectionsOffsiteRevenue += m.creatorConnectionsOffsiteRevenue;
                ex.views += m.views;
                ex.clicks += m.clicks;
                ex.orderedItems += m.orderedItems;
            }
        });

        const grouped = Array.from(map.values());
        grouped.sort((a, b) => b.totalRevenue - a.totalRevenue);
        return grouped.slice(0, limit);
    }, [metrics, config]);

    if (metrics.length === 0) return <div className="p-6 text-center text-slate-400 text-xs italic">No content data. Use Joiner to link sources.</div>;

    const maxRevenue = Math.max(...displayList.map(v => v.totalRevenue), 1);

    return (
        <div className="flex flex-col h-full min-h-[300px]">
            <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                {displayList.map((v) => (
                    <div 
                        key={v.id} 
                        onClick={() => setInspectingVideo(v)}
                        className="group p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-white transition-all cursor-pointer shadow-sm"
                    >
                        <div className="flex justify-between items-start mb-1.5 gap-4">
                            <div className="min-w-0 flex-1">
                                <h4 className="text-[11px] font-black text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">{v.subTitle || v.mainTitle}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{formatNumber(v.views)} Reach</span>
                                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">ROI: {((v.totalRevenue / maxRevenue) * 100).toFixed(0)}% Strength</span>
                                </div>
                            </div>
                            <p className="text-sm font-black text-slate-900 font-mono flex-shrink-0">{formatCurrency(v.totalRevenue)}</p>
                        </div>
                        <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-600 transition-all duration-1000 ease-out" 
                                style={{ width: `${(v.totalRevenue / maxRevenue) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {inspectingVideo && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setInspectingVideo(null)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b bg-slate-50 flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100"><TrendingUpIcon className="w-5 h-5" /></div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-black text-slate-800 truncate leading-tight">{inspectingVideo.subTitle || inspectingVideo.mainTitle}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Video Yield Breakdown</p>
                                </div>
                            </div>
                            <button onClick={() => setInspectingVideo(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>

                        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl relative overflow-hidden">
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest relative z-10">Combined ROI</p>
                                    <p className="text-2xl font-black relative z-10">{formatCurrency(inspectingVideo.totalRevenue)}</p>
                                    <DollarSign className="absolute -right-2 -bottom-2 w-16 h-16 text-white opacity-5" />
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-center flex flex-col justify-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Conversion Strength</p>
                                    <p className="text-xl font-black text-indigo-600">{inspectingVideo.clicks > 0 ? ((inspectingVideo.orderedItems / inspectingVideo.clicks) * 100).toFixed(1) : 0}%</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yield Components</p>
                                <div className="space-y-1.5">
                                    {[
                                        { label: 'YouTube AdSense', val: inspectingVideo.videoEstimatedRevenue, icon: <YoutubeIcon className="w-3.5 h-3.5 text-red-600"/> },
                                        { label: 'Amazon Onsite', val: inspectingVideo.amazonOnsiteRevenue, icon: <BoxIcon className="w-3.5 h-3.5 text-blue-600"/> },
                                        { label: 'Amazon Offsite', val: inspectingVideo.amazonOffsiteRevenue, icon: <BoxIcon className="w-3.5 h-3.5 text-green-600"/> },
                                        { label: 'CC (Onsite)', val: inspectingVideo.creatorConnectionsOnsiteRevenue, icon: <SparklesIcon className="w-3.5 h-3.5 text-indigo-600"/> },
                                        { label: 'CC (Offsite)', val: inspectingVideo.creatorConnectionsOffsiteRevenue, icon: <SparklesIcon className="w-3.5 h-3.5 text-violet-600"/> }
                                    ].map(item => (
                                        <div key={item.label} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between shadow-sm transition-all hover:border-indigo-100">
                                            <div className="flex items-center gap-2.5">
                                                {item.icon}
                                                <span className="text-xs font-bold text-slate-600">{item.label}</span>
                                            </div>
                                            <span className="text-sm font-black font-mono text-slate-900">{formatCurrency(item.val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</p>
                                    <p className="text-xs font-bold text-slate-700 truncate">ID: {inspectingVideo.videoId || inspectingVideo.asin}</p>
                                    <p className="text-xs font-bold text-slate-500">Published: {inspectingVideo.publishDate || '---'}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Velocity</p>
                                    <p className="text-xs font-bold text-slate-700">{formatNumber(inspectingVideo.clicks)} Clicks</p>
                                    <p className="text-xs font-bold text-slate-700">{formatNumber(inspectingVideo.orderedItems)} Sales</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex-shrink-0">
                            <button 
                                onClick={() => setInspectingVideo(null)} 
                                className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                            >
                                Dismiss Inspector
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
