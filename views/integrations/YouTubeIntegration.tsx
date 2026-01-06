
import React, { useState, useMemo } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, SparklesIcon, TrendingUpIcon, CalendarIcon, UsersIcon, CloseIcon, AddIcon, InfoIcon, SearchCircleIcon, EyeIcon } from '../../components/Icons';
import { parseYouTubeReport } from '../../services/csvParserService';
import FileUpload from '../../components/FileUpload';

interface YouTubeIntegrationProps {
    metrics: YouTubeMetric[];
    onAddMetrics: (metrics: YouTubeMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    channels: YouTubeChannel[];
    onSaveChannel: (channel: YouTubeChannel) => void;
    onDeleteChannel: (channelId: string) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatLargeNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, channels, onSaveChannel, onDeleteChannel }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload' | 'channels'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    const [uploadChannelId, setUploadChannelId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredMetrics = useMemo(() => {
        return metrics.filter(m => !searchTerm || m.videoTitle.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [metrics, searchTerm]);

    const summary = useMemo(() => {
        return filteredMetrics.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.estimatedRevenue,
            views: acc.views + curr.views,
            subs: acc.subs + curr.subscribersGained,
            watch: acc.watch + curr.watchTimeHours,
            imp: acc.imp + (curr.impressions || 0)
        }), { revenue: 0, views: 0, subs: 0, watch: 0, imp: 0 });
    }, [filteredMetrics]);

    const processReportFiles = async (files: File[]) => {
        setIsUploading(true);
        try {
            const results = await parseYouTubeReport(files[0], (msg) => console.log(msg));
            setPreviewMetrics(results);
        } catch (e) {
            alert("Parsing failed. Use the 'Video Performance' export from YouTube Analytics.");
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = () => {
        if (!uploadChannelId) return alert("Select target channel.");
        const withMeta = previewMetrics.map(m => ({ ...m, channelId: uploadChannelId }));
        onAddMetrics(withMeta);
        setPreviewMetrics([]);
        setActiveTab('dashboard');
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0 px-1">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <YoutubeIcon className="w-10 h-10 text-red-600" /> YouTube Studio
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Video performance and AdSense ROI dashboard.</p>
                </div>
                <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200">
                    {['dashboard', 'data', 'channels', 'upload'].map((t: any) => (
                        <button 
                            key={t} 
                            onClick={() => setActiveTab(t)} 
                            className={`px-6 py-2 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${activeTab === t ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50 -mx-4 px-4 pt-4 custom-scrollbar">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">AdSense Earnings</p>
                                <p className="text-3xl font-black text-red-600 mt-2 relative z-10">{formatCurrency(summary.revenue)}</p>
                                <TrendingUpIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-red-50 opacity-50" />
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Views</p>
                                <p className="text-3xl font-black text-slate-800 mt-2">{formatLargeNumber(summary.views)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impressions</p>
                                <p className="text-3xl font-black text-indigo-600 mt-2">{formatLargeNumber(summary.imp)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subs Gained</p>
                                <p className="text-3xl font-black text-emerald-600 mt-2">+{formatLargeNumber(summary.subs)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Watch Time (Hrs)</p>
                                <p className="text-3xl font-black text-slate-800 mt-2">{formatLargeNumber(summary.watch)}</p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-red-50 rounded-2xl"><EyeIcon className="w-8 h-8 text-red-600" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Performance KPI</p>
                                    <h4 className="text-xl font-black text-slate-800">Overall CTR: <span className="text-red-600">{(summary.imp > 0 ? (summary.views / summary.imp) * 100 : 0).toFixed(2)}%</span></h4>
                                </div>
                            </div>
                            <div className="h-10 w-px bg-slate-100 hidden sm:block"></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Attribution</p>
                                <h4 className="text-xl font-black text-slate-800">RPM: <span className="text-emerald-600">{formatCurrency(summary.views > 0 ? (summary.revenue / summary.views) * 1000 : 0)}</span></h4>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="max-w-2xl mx-auto space-y-6 pt-10 animate-slide-up">
                        {previewMetrics.length > 0 ? (
                            <div className="bg-white p-10 rounded-[3rem] border-2 border-red-500 shadow-2xl space-y-8 relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Confirm Ingestion</h3>
                                    <p className="text-slate-500 font-medium mt-1">Tag {previewMetrics.length} video records to a specific channel.</p>
                                </div>
                                <div className="space-y-1.5 relative z-10">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Channel</label>
                                    <select value={uploadChannelId} onChange={e => setUploadChannelId(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black text-slate-700 bg-slate-50 shadow-inner">
                                        <option value="">Select Target Channel...</option>
                                        {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-4 relative z-10 pt-4">
                                    <button onClick={() => setPreviewMetrics([])} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs">Discard</button>
                                    <button onClick={confirmImport} className="flex-[2] py-4 bg-red-600 text-white font-black rounded-3xl shadow-xl hover:bg-red-700 transition-all uppercase tracking-widest text-xs">Commit Studio Data</button>
                                </div>
                                <YoutubeIcon className="absolute -right-12 -bottom-12 w-48 h-48 text-red-50 opacity-20 pointer-events-none" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-start gap-4">
                                    <InfoIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-black text-red-900 uppercase tracking-tight">Analytics Export Info</p>
                                        <p className="text-xs text-red-700 font-medium leading-relaxed mt-1">Export your 'Video Analytics' from YouTube Studio. Ensure the CSV contains columns for Video Title, Views, and Estimated Revenue.</p>
                                    </div>
                                </div>
                                <FileUpload onFileUpload={processReportFiles} disabled={isUploading} label="Click or drag files to import" acceptedFileTypes=".csv" />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                        <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4 flex-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Ledger ({filteredMetrics.length} Videos)</span>
                                <div className="relative flex-1 max-w-md group">
                                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Filter by title..." className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-red-500 outline-none" />
                                    <SearchCircleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Video Content</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">CTR</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Views</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Earnings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredMetrics.slice(0, 100).map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">{m.publishDate}</td>
                                            <td className="px-6 py-4">
                                                <div className="min-w-0 max-w-xl">
                                                    <p className="text-sm font-bold text-slate-700 truncate group-hover:text-red-600 transition-colors">{m.videoTitle}</p>
                                                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter mt-0.5">ID: {m.videoId}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border tabular-nums ${m.ctr >= 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                    {(m.ctr || 0).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-black text-slate-600 tabular-nums">{formatLargeNumber(m.views)}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-emerald-600 tabular-nums">{formatCurrency(m.estimatedRevenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YouTubeIntegration;
