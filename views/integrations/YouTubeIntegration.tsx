
import React, { useState, useMemo, useEffect } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, SparklesIcon, TrendingUpIcon, CalendarIcon, UsersIcon, CloseIcon, AddIcon } from '../../components/Icons';
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

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, channels, onSaveChannel, onDeleteChannel }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    const [uploadChannelId, setUploadChannelId] = useState('');

    const summary = useMemo(() => {
        return metrics.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.estimatedRevenue,
            views: acc.views + curr.views
        }), { revenue: 0, views: 0 });
    }, [metrics]);

    const processReportFiles = async (files: File[]) => {
        setIsUploading(true);
        try {
            const results = await parseYouTubeReport(files[0], (msg) => console.log(msg));
            setPreviewMetrics(results);
        } catch (e) {
            alert("Parsing failed.");
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = () => {
        if (!uploadChannelId) return alert("Select channel.");
        const withMeta = previewMetrics.map(m => ({ ...m, channelId: uploadChannelId }));
        onAddMetrics(withMeta);
        setPreviewMetrics([]);
        setActiveTab('dashboard');
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><YoutubeIcon className="w-8 h-8 text-red-600" /> YouTube Analytics</h1>
                    <p className="text-slate-500">Video performance and AdSense ROI.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    {['dashboard', 'data', 'upload'].map((t: any) => (
                        <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${activeTab === t ? 'bg-red-50 text-red-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{t}</button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center text-center"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Earnings</p><p className="text-4xl font-black text-red-600 mt-2">{formatCurrency(summary.revenue)}</p></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center text-center"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Views</p><p className="text-4xl font-black text-slate-800 mt-2">{summary.views.toLocaleString()}</p></div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {previewMetrics.length > 0 ? (
                            <div className="bg-white p-8 rounded-3xl border-2 border-red-500 shadow-2xl space-y-6 animate-slide-up">
                                <h3 className="text-2xl font-black text-slate-800">Verify Import</h3>
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Target Channel</label><select value={uploadChannelId} onChange={e => setUploadChannelId(e.target.value)} className="w-full p-2 border rounded-xl font-bold"><option value="">Select Channel...</option>{channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                <div className="flex gap-4"><button onClick={() => setPreviewMetrics([])} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">Cancel</button><button onClick={confirmImport} className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg">Confirm {previewMetrics.length} Records</button></div>
                            </div>
                        ) : (
                            <FileUpload onFileUpload={processReportFiles} disabled={isUploading} label="Click or drag files to import" acceptedFileTypes=".csv" />
                        )}
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-[10px] font-black uppercase text-slate-400">Date</th><th className="px-6 py-3 text-left text-[10px] font-black uppercase text-slate-400">Video Title</th><th className="px-6 py-3 text-right text-[10px] font-black uppercase text-slate-400">Views</th><th className="px-6 py-3 text-right text-[10px] font-black uppercase text-slate-400">Revenue</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{metrics.slice(0, 50).map(m => <tr key={m.id}><td className="px-6 py-3 text-xs font-mono text-slate-500">{m.publishDate}</td><td className="px-6 py-3 text-sm font-bold text-slate-700 truncate max-w-md">{m.videoTitle}</td><td className="px-6 py-3 text-right text-xs text-slate-500">{m.views.toLocaleString()}</td><td className="px-6 py-3 text-right text-sm font-black text-green-600">{formatCurrency(m.estimatedRevenue)}</td></tr>)}</tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YouTubeIntegration;
