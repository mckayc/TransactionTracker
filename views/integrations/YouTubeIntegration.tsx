import React, { useState, useMemo, useRef } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, YoutubeIcon, CheckCircleIcon, SparklesIcon, CalendarIcon, ChevronDownIcon, CloseIcon, TrendingUpIcon, ChartPieIcon } from '../../components/Icons';
import { parseYouTubeReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';

interface YouTubeIntegrationProps {
    metrics: YouTubeMetric[];
    onAddMetrics: (metrics: YouTubeMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    channels: YouTubeChannel[];
    onSaveChannel: (channel: YouTubeChannel) => void;
    onDeleteChannel: (channelId: string) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ 
    metrics, 
    onAddMetrics, 
    onDeleteMetrics, 
    channels, 
    onSaveChannel, 
    onDeleteChannel 
}) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    
    // Year Detection
    const [detectedYear, setDetectedYear] = useState<string>('');
    const [manualYear, setManualYear] = useState<string>('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            // Logic to look for years in the file name
            const yearMatch = file.name.match(/\b(20[12]\d)\b/);
            const foundYear = yearMatch ? yearMatch[1] : '';
            setDetectedYear(foundYear);
            setManualYear(foundYear);
            
            const parsed = await parseYouTubeReport(file, (msg) => console.log(msg));
            setPreviewMetrics(parsed);
            setActiveTab('upload');
        } catch (error) {
            alert("Error parsing file: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        const finalYear = manualYear || detectedYear;
        if (!finalYear) {
            alert("Please specify a report year.");
            return;
        }
        
        const dataWithYear = previewMetrics.map(m => ({ ...m, reportYear: finalYear }));
        onAddMetrics(dataWithYear);
        setPreviewMetrics([]);
        setActiveTab('dashboard');
    };

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <YoutubeIcon className="w-8 h-8 text-red-600" /> YouTube Analytics
                </h1>
                <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-red-50 text-red-700' : 'text-slate-50' && 'text-slate-500 hover:text-slate-700'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'upload' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}>Upload</button>
                </div>
            </div>

            {activeTab === 'upload' && (
                <div className="space-y-6">
                    {previewMetrics.length > 0 ? (
                        <div className="bg-white p-6 rounded-2xl border-2 border-red-50 shadow-sm animate-fade-in max-w-2xl mx-auto">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Review YouTube Data</h2>
                                    <p className="text-sm text-slate-500">Found {previewMetrics.length} videos in report.</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-[200px]">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Set Data Year</label>
                                    <select 
                                        value={manualYear} 
                                        onChange={(e) => setManualYear(e.target.value)} 
                                        className="w-full text-sm font-bold border rounded-lg focus:ring-red-500"
                                    >
                                        <option value="">Select Year...</option>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    {!detectedYear && <p className="text-[9px] text-red-500 mt-1 font-bold">Year not detected in filename.</p>}
                                    {detectedYear && <p className="text-[9px] text-green-600 mt-1 font-bold">Filename suggests: {detectedYear}</p>}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-6 border-t">
                                <button onClick={() => setPreviewMetrics([])} className="flex-1 py-3 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                                <button onClick={confirmImport} className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition-all active:scale-95">Confirm & Import</button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()} 
                            className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-all group max-w-2xl mx-auto"
                        >
                            <CloudArrowUpIcon className="w-16 h-16 text-slate-200 mx-auto group-hover:scale-110 group-hover:text-red-400 transition-all" />
                            <h3 className="text-xl font-bold text-slate-700 mt-4">Drop YouTube export CSV</h3>
                            <p className="text-sm text-slate-400 mt-2">Export from YouTube Studio > Analytics > Advanced > Export CSV.</p>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'dashboard' && (
                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Views</p>
                            <p className="text-2xl font-black text-slate-800 mt-1">{formatNumber(metrics.reduce((s, m) => s + m.views, 0))}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Revenue</p>
                            <p className="text-2xl font-black text-red-600 mt-1">{formatCurrency(metrics.reduce((s, m) => s + m.estimatedRevenue, 0))}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Watch Time</p>
                            <p className="text-2xl font-black text-slate-800 mt-1">{formatNumber(metrics.reduce((s, m) => s + m.watchTimeHours, 0))}h</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subs Gained</p>
                            <p className="text-2xl font-black text-green-600 mt-1">+{formatNumber(metrics.reduce((s, m) => s + m.subscribersGained, 0))}</p>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Video Performance</h3>
                            <button onClick={() => onDeleteMetrics(metrics.map(m => m.id))} className="text-[10px] font-bold text-red-500 hover:underline">Reset Analytics</button>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {metrics.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-12">
                                    <TrendingUpIcon className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm font-medium">No YouTube data imported.</p>
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-slate-100">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Video Title</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Views</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">CTR</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {metrics.slice(0, 100).map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 text-sm font-medium text-slate-700 truncate max-w-md" title={m.videoTitle}>{m.videoTitle}</td>
                                                <td className="px-6 py-3 text-right text-sm text-slate-500 font-mono">{m.views.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-right text-sm text-slate-500 font-mono">{m.ctr.toFixed(1)}%</td>
                                                <td className="px-6 py-3 text-right text-sm font-bold text-red-600 font-mono">{formatCurrency(m.estimatedRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default YouTubeIntegration;