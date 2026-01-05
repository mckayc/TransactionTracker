import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, AddIcon, EditIcon, VideoIcon, SparklesIcon, TrendingUpIcon, LightBulbIcon, InfoIcon, HeartIcon, CalendarIcon } from '../../components/Icons';
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

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const matchAdvancedSearch = (title: string, search: string) => {
    if (!search) return true;
    const lowerTitle = title.toLowerCase();
    const orParts = search.split('|').map(p => p.trim()).filter(Boolean);
    if (orParts.length === 0) return true;

    return orParts.some(orPart => {
        const words = orPart.split(/\s+/).filter(Boolean);
        if (words.length === 0) return true;
        return words.every(word => {
            if (word.startsWith('-')) {
                const exclude = word.substring(1).toLowerCase();
                return exclude === '' || !lowerTitle.includes(exclude);
            }
            return lowerTitle.includes(word.toLowerCase());
        });
    });
};

const InsightLabel: React.FC<{ 
    type: 'high-earner' | 'hidden-gem' | 'low-hook' | 'fan-maker'; 
    title: string;
    details: string;
    action: string;
}> = ({ type, title, details, action }) => {
    const colors = {
        'high-earner': 'bg-green-100 text-green-700 border-green-200',
        'hidden-gem': 'bg-purple-100 text-purple-700 border-purple-200',
        'low-hook': 'bg-red-100 text-red-700 border-red-200',
        'fan-maker': 'bg-indigo-100 text-indigo-700 border-indigo-200'
    };

    return (
        <div className="relative group/insight inline-block">
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase cursor-help transition-all hover:scale-105 ${colors[type]}`}>
                {title}
            </span>
            <div className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-slate-900 text-white rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/insight:opacity-100 group-hover/insight:translate-y-0 transition-all z-50">
                <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                    <LightBulbIcon className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">{title} Analysis</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-3">{details}</p>
                <div className="bg-white/10 p-2 rounded-lg border border-white/5">
                    <p className="text-[10px] font-bold text-indigo-300 uppercase mb-1">Recommended Action</p>
                    <p className="text-[11px] text-white font-medium italic">"{action}"</p>
                </div>
                <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-900"></div>
            </div>
        </div>
    );
};

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, channels, onSaveChannel, onDeleteChannel }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'insights' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadYear, setUploadYear] = useState<string>('');
    const [uploadChannelId, setUploadChannelId] = useState<string>('');

    // Filter & Search Logic
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterChannelId, setFilterChannelId] = useState('');
    
    // Insights & Dashboard Stats State
    const [insightsSortKey, setInsightsSortKey] = useState<keyof YouTubeMetric | 'rpm'>('estimatedRevenue');
    const [insightsSortDir, setInsightsSortDir] = useState<'asc' | 'desc'>('desc');
    const [insightsLimit, setInsightsLimit] = useState<number>(50);

    const availableReportYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => { if (m.reportYear) yearsSet.add(m.reportYear); });
        return Array.from(yearsSet).sort().reverse();
    }, [metrics]);

    const channelMap = useMemo(() => new Map(channels.map(c => [c.id, c.name])), [channels]);

    const summary = useMemo(() => {
        const result = { totalRevenue: 0, totalViews: 0, totalSubs: 0, totalWatchTime: 0, avgRPM: 0 };
        const data = filterChannelId ? metrics.filter(m => m.channelId === filterChannelId) : metrics;
        data.forEach(m => {
            result.totalRevenue += m.estimatedRevenue;
            result.totalViews += m.views;
            result.totalSubs += m.subscribersGained;
            result.totalWatchTime += m.watchTimeHours;
        });
        if (result.totalViews > 0) {
            result.avgRPM = (result.totalRevenue / result.totalViews) * 1000;
        }
        return result;
    }, [metrics, filterChannelId]);

    const videoInsights = useMemo(() => {
        let base = metrics;
        if (filterChannelId) base = base.filter(m => m.channelId === filterChannelId);

        const groups = new Map<string, YouTubeMetric>();
        base.forEach(m => {
            if (!groups.has(m.videoId)) groups.set(m.videoId, { ...m });
            else {
                const ex = groups.get(m.videoId)!;
                ex.views += m.views;
                ex.watchTimeHours += m.watchTimeHours;
                ex.subscribersGained += m.subscribersGained;
                ex.estimatedRevenue += m.estimatedRevenue;
                ex.impressions += m.impressions;
            }
        });

        let list = Array.from(groups.values()).filter(v => matchAdvancedSearch(v.videoTitle, debouncedSearchTerm));
        const result = list.map(v => ({
            ...v,
            rpm: v.views > 0 ? (v.estimatedRevenue / v.views) * 1000 : 0
        }));

        result.sort((a, b) => {
            const valA = (a as any)[insightsSortKey];
            const valB = (b as any)[insightsSortKey];
            return insightsSortDir === 'asc' ? valA - valB : valB - valA;
        });

        return result.slice(0, insightsLimit);
    }, [metrics, filterChannelId, insightsLimit, insightsSortKey, insightsSortDir, debouncedSearchTerm]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const newMetrics = await parseYouTubeReport(file, (msg) => console.log(msg));
            if (newMetrics.length > 0) {
                setPreviewMetrics(newMetrics);
                // Detection logic from filename
                const fileName = file.name;
                const yearMatch = fileName.match(/\b(20\d{2})\b/);
                if (yearMatch) setUploadYear(yearMatch[1]);
                
                const matchedChannel = channels.find(c => fileName.toLowerCase().includes(c.name.toLowerCase()));
                if (matchedChannel) setUploadChannelId(matchedChannel.id);
            }
        } catch (error) {
            console.error(error);
            alert("Import failed.");
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = () => {
        if (!uploadChannelId) { alert("Please select a Channel."); return; }
        const metricsWithChannel = previewMetrics.map(m => ({ ...m, channelId: uploadChannelId, reportYear: uploadYear || undefined }));
        onAddMetrics(metricsWithChannel);
        setPreviewMetrics([]);
        setActiveTab('dashboard');
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <YoutubeIcon className="w-8 h-8 text-red-600" /> YouTube Integration
                    </h1>
                    <p className="text-slate-500">Video performance and AdSense tracking.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'dashboard' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('insights')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'insights' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}>Insights</button>
                    <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'data' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}>Data</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'upload' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}>Upload</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Revenue</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalRevenue)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Views</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalViews)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Avg RPM</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.avgRPM)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Watch Time</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalWatchTime)}h</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Subscribers</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalSubs)}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-slate-800">Top Content Performance</h3>
                                <input 
                                    type="text" 
                                    placeholder="Search videos..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="p-2 border rounded-lg text-sm w-64"
                                />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Video Title</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Views</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">RPM</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {videoInsights.map(v => (
                                            <tr key={v.videoId} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-sm font-bold text-slate-700 truncate max-w-md" title={v.videoTitle}>{v.videoTitle}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(v.views)}</td>
                                                <td className="px-4 py-3 text-right text-xs text-slate-400 font-mono">{formatCurrency(v.rpm)}</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-green-600 font-mono">{formatCurrency(v.estimatedRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="p-8 flex flex-col items-center">
                        {previewMetrics.length > 0 ? (
                            <div className="bg-white p-8 rounded-2xl border-2 border-red-500 shadow-xl max-w-md w-full space-y-6">
                                <h3 className="text-xl font-bold">Review Import</h3>
                                <p className="text-sm text-slate-600">Found {previewMetrics.length} records. Please assign a channel.</p>
                                <select value={uploadChannelId} onChange={e => setUploadChannelId(e.target.value)} className="w-full p-2 border rounded-lg">
                                    <option value="">Select Channel...</option>
                                    {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <div className="flex gap-4">
                                    <button onClick={() => setPreviewMetrics([])} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">Cancel</button>
                                    <button onClick={confirmImport} className="flex-[2] py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg">Confirm Import</button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-12 rounded-[2rem] border-2 border-dashed border-slate-300 flex flex-col items-center text-center space-y-4">
                                <CloudArrowUpIcon className="w-12 h-12 text-slate-300" />
                                <h3 className="text-xl font-bold">Import YouTube Analytics</h3>
                                <p className="text-sm text-slate-500">Upload your CSV export from YouTube Studio.</p>
                                <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileUpload} className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">
                                    {isUploading ? 'Parsing...' : 'Select CSV'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200">
                        <p className="text-center py-12 text-slate-400 italic">Historical data management view is coming soon.</p>
                    </div>
                )}

                {activeTab === 'insights' && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200">
                        <p className="text-center py-12 text-slate-400 italic">Advanced ROI insights and RPM trends are coming soon.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YouTubeIntegration;