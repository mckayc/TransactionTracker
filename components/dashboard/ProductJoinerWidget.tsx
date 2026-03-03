
import React, { useMemo, useState } from 'react';
import type { JoinedMetric, ProductJoinerProject, DashboardWidget, View } from '../../types';
import { WorkflowIcon, TrendingUpIcon, ArrowRightIcon, ExclamationTriangleIcon, CloseIcon, BarChartIcon, YoutubeIcon, BoxIcon, SparklesIcon, DollarSign, SearchCircleIcon, ChevronDownIcon, ListIcon } from '../Icons';
import { formatDate } from '../../dateUtils';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

interface Props {
    projects: ProductJoinerProject[];
    config: DashboardWidget['config'];
    onNavigate: (view: View) => void;
}

export const ProductJoinerWidget: React.FC<Props> = ({ projects, config, onNavigate }: Props) => {
    const [inspectingAsset, setInspectingAsset] = useState<JoinedMetric | null>(null);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditSourceFilter, setAuditSourceFilter] = useState<'all' | 'youtube' | 'onsite' | 'offsite' | 'onsite_cc' | 'offsite_cc'>('all');

    const project = projects.find((p: ProductJoinerProject) => p.id === config?.projectId);
    const limit = config?.videoCount || 5;

    const aggregates = useMemo(() => {
        if (!project) return { youtube: 0, onsite: 0, offsite: 0, onsiteCC: 0, offsiteCC: 0, total: 0 };
        return project.metrics.reduce((acc: any, m: JoinedMetric) => ({
            youtube: acc.youtube + m.videoEstimatedRevenue,
            onsite: acc.onsite + m.amazonOnsiteRevenue,
            offsite: acc.offsite + m.amazonOffsiteRevenue,
            onsiteCC: acc.onsiteCC + m.creatorConnectionsOnsiteRevenue,
            offsiteCC: acc.offsiteCC + m.creatorConnectionsOffsiteRevenue,
            total: acc.total + m.totalRevenue
        }), { youtube: 0, onsite: 0, offsite: 0, onsiteCC: 0, offsiteCC: 0, total: 0 });
    }, [project]);

    const displayList = useMemo(() => {
        if (!project) return [];
        const sorted = [...project.metrics].sort((a, b) => b.totalRevenue - a.totalRevenue);
        return sorted.slice(0, limit);
    }, [project, limit]);

    const filteredAuditMetrics = useMemo(() => {
        if (!project) return [];
        let base = [...project.metrics].sort((a, b) => b.totalRevenue - a.totalRevenue);
        
        if (auditSearch) {
            const q = auditSearch.toLowerCase();
            base = base.filter((m: JoinedMetric) => m.mainTitle.toLowerCase().includes(q) || m.asin.toLowerCase().includes(q));
        }

        if (auditSourceFilter !== 'all') {
            base = base.filter((m: JoinedMetric) => {
                if (auditSourceFilter === 'youtube') return m.videoEstimatedRevenue > 0;
                if (auditSourceFilter === 'onsite') return m.amazonOnsiteRevenue > 0;
                if (auditSourceFilter === 'offsite') return m.amazonOffsiteRevenue > 0;
                if (auditSourceFilter === 'onsite_cc') return m.creatorConnectionsOnsiteRevenue > 0;
                if (auditSourceFilter === 'offsite_cc') return m.creatorConnectionsOffsiteRevenue > 0;
                return true;
            });
        }

        return base;
    }, [project, auditSearch, auditSourceFilter]);

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

    const maxRevenue = Math.max(...displayList.map((v: JoinedMetric) => v.totalRevenue), 1);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                <button 
                    onClick={() => setIsAuditOpen(true)}
                    className="flex flex-col text-left group hover:opacity-80 transition-opacity"
                >
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600">Synthesis Audit Registry</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-800 truncate max-w-[120px] group-hover:text-indigo-600 transition-colors">{project.name}</span>
                        {project.startDate && (
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">
                                ({project.startDate} - {project.endDate || 'Now'})
                            </span>
                        )}
                        <ArrowRightIcon className="w-2.5 h-2.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                </button>
                <button 
                    onClick={() => onNavigate('integration-product-joiner')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                >
                    Workspace <ArrowRightIcon className="w-3 h-3" />
                </button>
            </div>

            {/* Aggregate Cards */}
            <div className="grid grid-cols-5 gap-1.5 p-2 bg-slate-50/30 border-b border-slate-100 flex-shrink-0">
                {[
                    { label: 'Onsite', val: aggregates.onsite, icon: <BoxIcon className="w-2.5 h-2.5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Offsite', val: aggregates.offsite, icon: <BoxIcon className="w-2.5 h-2.5" />, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Onsite CC', val: aggregates.onsiteCC, icon: <SparklesIcon className="w-2.5 h-2.5" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Offsite CC', val: aggregates.offsiteCC, icon: <SparklesIcon className="w-2.5 h-2.5" />, color: 'text-violet-600', bg: 'bg-violet-50' },
                    { label: 'YouTube', val: aggregates.youtube, icon: <YoutubeIcon className="w-2.5 h-2.5" />, color: 'text-red-600', bg: 'bg-red-50' }
                ].map(card => (
                    <div key={card.label} className={`p-1.5 rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center text-center`}>
                        <div className={`p-1 rounded-lg ${card.bg} ${card.color} mb-1`}>{card.icon}</div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">{card.label}</p>
                        <p className={`text-[9px] font-black ${card.color} font-mono`}>{formatNumber(card.val)}</p>
                    </div>
                ))}
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

            {/* Audit Modal */}
            {isAuditOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAuditOpen(false)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-lg shadow-indigo-100"><ListIcon className="w-8 h-8" /></div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Institutional Audit Registry</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Comprehensive yield breakdown for {project.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Search assets..." 
                                        value={auditSearch}
                                        onChange={e => setAuditSearch(e.target.value)}
                                        className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:ring-0 focus:border-indigo-500 outline-none font-bold shadow-sm w-64"
                                    />
                                    <SearchCircleIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                                <div className="relative">
                                    <select 
                                        value={auditSourceFilter}
                                        onChange={e => setAuditSourceFilter(e.target.value as any)}
                                        className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-0 focus:border-indigo-500 outline-none shadow-sm appearance-none"
                                    >
                                        <option value="all">All Sources</option>
                                        <option value="youtube">YouTube AdSense</option>
                                        <option value="onsite">Amazon Onsite</option>
                                        <option value="offsite">Amazon Offsite</option>
                                        <option value="onsite_cc">Creator Conn. (On)</option>
                                        <option value="offsite_cc">Creator Conn. (Off)</option>
                                    </select>
                                    <ChevronDownIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                </div>
                                <button onClick={() => setIsAuditOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                            <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Asset Identity</th>
                                        <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Reach</th>
                                        <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Conversion</th>
                                        <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Yield Matrix</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredAuditMetrics.map(m => (
                                        <tr key={m.id} className="hover:bg-indigo-50/20 transition-all group cursor-pointer" onClick={() => { setInspectingAsset(m); setIsAuditOpen(false); }}>
                                            <td className="px-8 py-4 max-w-[400px]">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{m.mainTitle}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border ${m.videoId ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400'}`}>{m.videoId || 'NO_VID'}</span>
                                                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border ${m.asin ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400'}`}>{m.asin || 'NO_ASIN'}</span>
                                                        {m.publishDate && <span className="text-[7px] font-black text-slate-400 uppercase">{m.publishDate}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-right font-mono text-xs font-bold text-slate-600">
                                                {formatNumber(m.views)} <span className="text-[8px] text-slate-400">VIEWS</span>
                                            </td>
                                            <td className="px-8 py-4 text-right font-mono text-xs font-bold text-slate-600">
                                                {formatNumber(m.clicks)} <span className="text-[8px] text-slate-400">CLICKS</span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <p className="text-sm font-black text-indigo-600 font-mono">{formatCurrency(m.totalRevenue)}</p>
                                                <div className="flex justify-end gap-1 mt-1 opacity-40 group-hover:opacity-100">
                                                    {m.videoEstimatedRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="YouTube AdSense" />}
                                                    {m.amazonOnsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Amazon Onsite" />}
                                                    {m.creatorConnectionsOnsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="CC Onsite" />}
                                                    {m.amazonOffsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Amazon Offsite" />}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex justify-between items-center shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredAuditMetrics.length} Assets in current view</p>
                            <button onClick={() => setIsAuditOpen(false)} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Dismiss Audit</button>
                        </div>
                    </div>
                </div>
            )}

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
