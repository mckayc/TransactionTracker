
import React, { useState, useMemo } from 'react';
import type { AmazonMetric, AmazonReportType, AmazonVideo, AmazonCCType } from '../../types';
/* Added ExclamationTriangleIcon to imports to fix line 237 error */
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, DeleteIcon, CheckCircleIcon, SparklesIcon, TrendingUpIcon, CalendarIcon, WrenchIcon, VideoIcon, ShieldCheckIcon, CloseIcon, SortIcon, SearchCircleIcon, InfoIcon, ExclamationTriangleIcon } from '../../components/Icons';
import { parseAmazonReport } from '../../services/csvParserService';
import FileUpload from '../../components/FileUpload';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    videos: AmazonVideo[];
    onAddVideos: (videos: AmazonVideo[]) => void;
    onDeleteVideos: (ids: string[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, videos, onAddVideos, onDeleteVideos }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<AmazonMetric[]>([]);
    const [uploadYear, setUploadYear] = useState<string>(new Date().getFullYear().toString());
    const [uploadType, setUploadType] = useState<AmazonReportType>('onsite');

    // Filtering State
    const [filterYear, setFilterYear] = useState<string>('All');
    const [filterTrackingId, setFilterTrackingId] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');

    const years = useMemo(() => {
        const set = new Set(metrics.map(m => m.reportYear).filter(Boolean));
        return ['All', ...Array.from(set).sort().reverse()];
    }, [metrics]);

    const trackingIds = useMemo(() => {
        const set = new Set(metrics.map(m => m.trackingId));
        return ['All', ...Array.from(set).sort()];
    }, [metrics]);

    const filteredMetrics = useMemo(() => {
        return metrics.filter(m => {
            const matchesYear = filterYear === 'All' || m.reportYear === filterYear;
            const matchesTracking = filterTrackingId === 'All' || m.trackingId === filterTrackingId;
            const matchesSearch = !searchTerm || m.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) || m.asin.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesYear && matchesTracking && matchesSearch;
        });
    }, [metrics, filterYear, filterTrackingId, searchTerm]);

    const summary = useMemo(() => {
        return filteredMetrics.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            clicks: acc.clicks + curr.clicks,
            ordered: acc.ordered + curr.orderedItems,
            shipped: acc.shipped + curr.shippedItems
        }), { revenue: 0, clicks: 0, ordered: 0, shipped: 0 });
    }, [filteredMetrics]);

    const processReportFiles = async (files: File[]) => {
        setIsUploading(true);
        try {
            const results = await parseAmazonReport(files[0], (msg) => console.log(msg));
            setPreviewMetrics(results);
        } catch (e) {
            alert("Parsing failed. Ensure you are using an Amazon Earnings Report CSV.");
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = () => {
        const withMeta = previewMetrics.map(m => ({ ...m, reportYear: uploadYear || undefined, reportType: uploadType }));
        onAddMetrics(withMeta);
        setPreviewMetrics([]);
        setActiveTab('dashboard');
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0 px-1">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <BoxIcon className="w-10 h-10 text-orange-500" /> Amazon Associates
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Affiliate ROI and conversion analytics.</p>
                </div>
                <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200">
                    {['dashboard', 'data', 'upload'].map((t: any) => (
                        <button 
                            key={t} 
                            onClick={() => setActiveTab(t)} 
                            className={`px-6 py-2 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${activeTab === t ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50 -mx-4 px-4 pt-4 custom-scrollbar">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Total Invoiced</p>
                                <p className="text-3xl font-black text-orange-600 mt-2 relative z-10">{formatCurrency(summary.revenue)}</p>
                                <TrendingUpIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-orange-50 opacity-50" />
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inbound Traffic</p>
                                <p className="text-3xl font-black text-slate-800 mt-2">{summary.clicks.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conv Rate</p>
                                <p className="text-3xl font-black text-indigo-600 mt-2">{(summary.clicks > 0 ? (summary.ordered / summary.clicks) * 100 : 0).toFixed(1)}%</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orders / Shipped</p>
                                <p className="text-3xl font-black text-emerald-600 mt-2">{summary.ordered} / {summary.shipped}</p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Performance Filters</h3>
                                <button onClick={() => { setFilterYear('All'); setFilterTrackingId('All'); setSearchTerm(''); }} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Reset Views</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Fiscal Year</label>
                                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-slate-50">
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tracking ID</label>
                                    <select value={filterTrackingId} onChange={e => setFilterTrackingId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-slate-50">
                                        {trackingIds.map(id => <option key={id} value={id}>{id}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Quick Search</label>
                                    <div className="relative">
                                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ASIN or Product Name..." className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 bg-slate-50 pl-10" />
                                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="max-w-2xl mx-auto space-y-6 pt-10 animate-slide-up">
                        {previewMetrics.length > 0 ? (
                            <div className="bg-white p-10 rounded-[3rem] border-2 border-orange-500 shadow-2xl space-y-8 relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Sanity Check</h3>
                                    <p className="text-slate-500 font-medium mt-1">Review meta-tagging for the {previewMetrics.length} records detected.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-6 relative z-10">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference Year</label>
                                        <input type="text" value={uploadYear} onChange={e => setUploadYear(e.target.value)} placeholder="2025" className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black text-slate-700 shadow-inner" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Stream</label>
                                        <select value={uploadType} onChange={e => setUploadType(e.target.value as any)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black text-slate-700 bg-slate-50 shadow-inner">
                                            <option value="onsite">Onsite (Storefront/Hub)</option>
                                            <option value="offsite">Offsite (Links/Social)</option>
                                            <option value="creator_connections">Creator Connections (Campaigns)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-4 relative z-10 pt-4">
                                    <button onClick={() => setPreviewMetrics([])} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs">Discard</button>
                                    <button onClick={confirmImport} className="flex-[2] py-4 bg-orange-600 text-white font-black rounded-3xl shadow-xl hover:bg-orange-700 transition-all uppercase tracking-widest text-xs">Confirm Ingestion</button>
                                </div>
                                <BoxIcon className="absolute -right-12 -bottom-12 w-48 h-48 text-orange-50 opacity-20 pointer-events-none" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex items-start gap-4">
                                    <InfoIcon className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-black text-orange-900 uppercase tracking-tight">Format Requirement</p>
                                        <p className="text-xs text-orange-700 font-medium leading-relaxed mt-1">Export your 'Earnings Report' from Amazon Associates. Ensure the CSV includes ASIN, Earnings, and Tracking ID columns.</p>
                                    </div>
                                </div>
                                <FileUpload onFileUpload={processReportFiles} disabled={isUploading} label="Click or drag files to import" acceptedFileTypes=".csv" />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                        <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing {filteredMetrics.length} of {metrics.length} entries</span>
                            {filteredMetrics.length !== metrics.length && <button onClick={() => { setFilterYear('All'); setFilterTrackingId('All'); }} className="text-[9px] font-black text-orange-600 hover:underline">Clear Filter</button>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Source / Tracking</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Product / ASIN</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Clicks</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Earnings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredMetrics.slice(0, 100).map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">{m.saleDate}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded w-max">{m.reportType.replace('_', ' ')}</span>
                                                    <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase">{m.trackingId}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="min-w-0 max-w-md">
                                                    <p className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{m.productTitle}</p>
                                                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter mt-0.5">{m.asin}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-black text-slate-500 tabular-nums">{m.clicks}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-emerald-600 tabular-nums">{formatCurrency(m.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredMetrics.length === 0 && (
                                <div className="py-20 text-center flex flex-col items-center">
                                    <ExclamationTriangleIcon className="w-12 h-12 text-slate-200 mb-2" />
                                    <p className="text-sm font-bold text-slate-400 uppercase">No matching data points</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmazonIntegration;
