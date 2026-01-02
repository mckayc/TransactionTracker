
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
/* Fixed: Added missing HeartIcon to the imports from components/Icons */
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon, AddIcon, EditIcon, VideoIcon, SparklesIcon, TrendingUpIcon, LightBulbIcon, InfoIcon, ChartPieIcon, BoxIcon, HeartIcon } from '../../components/Icons';
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

/**
 * Advanced Search Logic
 */
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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadYear, setUploadYear] = useState<string>('');
    const [uploadChannelId, setUploadChannelId] = useState<string>('');

    // Filter & Search Logic
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterChannelId, setFilterChannelId] = useState('');
    
    // Insights & Dashboard Stats State
    /* Fixed: Broadened state type to include 'rpm' to allow sorting by the calculated RPM metric */
    const [insightsSortKey, setInsightsSortKey] = useState<keyof YouTubeMetric | 'rpm'>('estimatedRevenue');
    const [insightsSortDir, setInsightsSortDir] = useState<'asc' | 'desc'>('desc');
    const [insightsLimit, setInsightsLimit] = useState<number>(50);
    const [insightsReportYear, setInsightsReportYear] = useState<string>('all');
    const [insightsCreatedYear, setInsightsCreatedYear] = useState<string>('all');

    // Data Tab Sorting & Pagination
    const [dataSortKey, setDataSortKey] = useState<keyof YouTubeMetric>('publishDate');
    const [dataSortDir, setDataSortDir] = useState<'asc' | 'desc'>('desc');
    const [groupByVideo, setGroupByVideo] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const availableReportYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => { if (m.reportYear) yearsSet.add(m.reportYear); });
        return Array.from(yearsSet).sort().reverse();
    }, [metrics]);

    const availableCreatedYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => { if (m.publishDate) { const y = m.publishDate.substring(0, 4); if (y.length === 4) yearsSet.add(y); } });
        return Array.from(yearsSet).sort().reverse();
    }, [metrics]);

    // Derived State: Processed Data for the Data Table
    const tableMetrics = useMemo(() => {
        let result = [...metrics];
        
        if (groupByVideo) {
            const groups = new Map<string, YouTubeMetric>();
            result.forEach(m => {
                if (!groups.has(m.videoId)) {
                    groups.set(m.videoId, { ...m });
                } else {
                    const ex = groups.get(m.videoId)!;
                    ex.views += m.views;
                    ex.watchTimeHours += m.watchTimeHours;
                    ex.subscribersGained += m.subscribersGained;
                    ex.estimatedRevenue += m.estimatedRevenue;
                    ex.impressions += m.impressions;
                }
            });
            result = Array.from(groups.values());
        }

        result.sort((a, b) => {
            let valA = a[dataSortKey] as any;
            let valB = b[dataSortKey] as any;
            if (typeof valA === 'string') {
                const cmp = valA.localeCompare(valB);
                return dataSortDir === 'asc' ? cmp : -cmp;
            }
            return dataSortDir === 'asc' ? valA - valB : valB - valA;
        });

        return result;
    }, [metrics, groupByVideo, dataSortKey, dataSortDir]);

    const totalPages = Math.ceil(tableMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = tableMetrics.slice(startIndex, startIndex + rowsPerPage);

    useEffect(() => { setCurrentPage(1); }, [rowsPerPage, groupByVideo, dataSortKey, dataSortDir]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const newMetrics = await parseYouTubeReport(file, (msg) => console.log(msg));
            if (newMetrics.length > 0) setPreviewMetrics(newMetrics);
            else alert("No valid records found in file.");
        } catch (error) {
            console.error(error);
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        if (!uploadChannelId) { alert("Please select a Channel for this data."); return; }
        if (previewMetrics.length > 0) {
            const metricsWithChannel = previewMetrics.map(m => ({ ...m, channelId: uploadChannelId, reportYear: uploadYear || undefined }));
            onAddMetrics(metricsWithChannel);
            setPreviewMetrics([]);
            setUploadYear('');
            alert(`Successfully imported ${previewMetrics.length} records.`);
            setActiveTab('dashboard');
        }
    };

    const summary = useMemo(() => {
        const result = { totalRevenue: 0, totalViews: 0, totalSubs: 0, totalWatchTime: 0, avgRPM: 0, avgCTR: 0, avgWatchPerView: 0 };
        metrics.forEach(m => {
            result.totalRevenue += m.estimatedRevenue;
            result.totalViews += m.views;
            result.totalSubs += m.subscribersGained;
            result.totalWatchTime += m.watchTimeHours;
        });
        if (result.totalViews > 0) {
            result.avgRPM = (result.totalRevenue / result.totalViews) * 1000;
            result.avgWatchPerView = result.totalWatchTime / result.totalViews;
        }
        const totalImpressions = metrics.reduce((acc, m) => acc + m.impressions, 0);
        const totalClicks = metrics.reduce((acc, m) => acc + (m.impressions * (m.ctr / 100)), 0);
        if (totalImpressions > 0) result.avgCTR = (totalClicks / totalImpressions) * 100;
        return result;
    }, [metrics]);

    // Insights Logic: Complex Data Facts
    const generatedInsights = useMemo(() => {
        if (metrics.length === 0) return null;

        const yearlyChampions = new Map<string, YouTubeMetric>();
        const videosPerYear = new Map<string, number>();
        const keywordMap = new Map<string, { totalRevenue: number, count: number }>();
        const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'for', 'with', 'on', 'my', 'how', 'to', 'why']);

        let evergreenRevenue = 0;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Process Metrics
        metrics.forEach(m => {
            const year = m.publishDate.substring(0, 4);
            
            // Champion by Year
            const currentChamp = yearlyChampions.get(year);
            if (!currentChamp || m.estimatedRevenue > currentChamp.estimatedRevenue) {
                yearlyChampions.set(year, m);
            }

            // Created Count
            videosPerYear.set(year, (videosPerYear.get(year) || 0) + 1);

            // Evergreen analysis
            if (new Date(m.publishDate) < oneYearAgo) {
                evergreenRevenue += m.estimatedRevenue;
            }

            // Keyword analysis (simplified)
            const words = m.videoTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
            words.forEach(word => {
                if (word.length > 3 && !stopWords.has(word)) {
                    const stats = keywordMap.get(word) || { totalRevenue: 0, count: 0 };
                    stats.totalRevenue += m.estimatedRevenue;
                    stats.count += 1;
                    keywordMap.set(word, stats);
                }
            });
        });

        // Top Keywords
        const topKeywords = Array.from(keywordMap.entries())
            .map(([word, stats]) => ({ word, avgRevenue: stats.totalRevenue / stats.count, count: stats.count }))
            .filter(k => k.count >= 3)
            .sort((a, b) => b.avgRevenue - a.avgRevenue)
            .slice(0, 5);

        return {
            champions: Array.from(yearlyChampions.entries()).sort((a, b) => b[0].localeCompare(a[0])),
            counts: Array.from(videosPerYear.entries()).sort((a, b) => b[0].localeCompare(a[0])),
            topKeywords,
            evergreenRevenue,
            evergreenPercent: (evergreenRevenue / (summary.totalRevenue || 1)) * 100
        };
    }, [metrics, summary.totalRevenue]);

    const videoInsights = useMemo(() => {
        let base = metrics;
        if (filterChannelId) base = base.filter(m => m.channelId === filterChannelId);
        if (insightsReportYear !== 'all') base = base.filter(m => m.reportYear === insightsReportYear);
        if (insightsCreatedYear !== 'all') base = base.filter(m => m.publishDate.substring(0, 4) === insightsCreatedYear);

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
            rpm: v.views > 0 ? (v.estimatedRevenue / v.views) * 1000 : 0,
            watchPerView: v.views > 0 ? v.watchTimeHours / v.views : 0,
            subsPerView: v.views > 0 ? v.subscribersGained / v.views : 0
        }));

        result.sort((a, b) => {
            const valA = a[insightsSortKey as keyof typeof a] as number;
            const valB = b[insightsSortKey as keyof typeof b] as number;
            return insightsSortDir === 'asc' ? valA - valB : valB - valA;
        });

        return result.slice(0, insightsLimit);
    }, [metrics, filterChannelId, insightsReportYear, insightsCreatedYear, insightsLimit, insightsSortKey, insightsSortDir, debouncedSearchTerm]);

    const selectionSummary = useMemo(() => {
        let base = metrics;
        if (filterChannelId) base = base.filter(m => m.channelId === filterChannelId);
        if (insightsReportYear !== 'all') base = base.filter(m => m.reportYear === insightsReportYear);
        if (insightsCreatedYear !== 'all') base = base.filter(m => m.publishDate.substring(0, 4) === insightsCreatedYear);
        const filteredBySearch = base.filter(v => matchAdvancedSearch(v.videoTitle, debouncedSearchTerm));
        const res = { revenue: 0, views: 0, watchTime: 0, subs: 0 };
        filteredBySearch.forEach(m => {
            res.revenue += m.estimatedRevenue;
            res.views += m.views;
            res.watchTime += m.watchTimeHours;
            res.subs += m.subscribersGained;
        });
        return { ...res, rpm: res.views > 0 ? (res.revenue / res.views) * 1000 : 0 };
    }, [metrics, filterChannelId, insightsReportYear, insightsCreatedYear, debouncedSearchTerm]);

    const handleDataSort = (key: keyof YouTubeMetric) => {
        if (dataSortKey === key) setDataSortDir(dataSortDir === 'asc' ? 'desc' : 'asc');
        else { setDataSortKey(key); setDataSortDir('desc'); }
    };

    const handleInsightsSort = (key: keyof YouTubeMetric | 'rpm') => {
        if (insightsSortKey === key) setInsightsSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setInsightsSortKey(key); setInsightsSortDir('desc'); }
    };

    /* Fixed: Updated getSortIcon parameter type to include 'rpm' to fix line 461 error where 'rpm' was passed as an invalid argument */
    const getSortIcon = (key: keyof YouTubeMetric | 'rpm', currentKey: string, currentDir: string) => {
        if (currentKey !== key) return <SortIcon className="w-3 h-3 text-slate-300 opacity-50" />;
        return currentDir === 'asc' ? <SortIcon className="w-3 h-3 text-red-600 transform rotate-180" /> : <SortIcon className="w-3 h-3 text-red-600" />;
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Permanently delete ${selectedIds.size} records?`)) {
            onDeleteMetrics(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const channelMap = useMemo(() => new Map(channels.map(c => [c.id, c.name])), [channels]);

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <YoutubeIcon className="w-8 h-8 text-red-600" />
                        YouTube Analytics
                    </h1>
                    <p className="text-slate-500">Track video performance, revenue, and audience growth.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><BarChartIcon className="w-4 h-4"/> Dashboard</button>
                    <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon className="w-4 h-4"/> Data</button>
                    <button onClick={() => setActiveTab('insights')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'insights' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><SparklesIcon className="w-4 h-4"/> Insights</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><CloudArrowUpIcon className="w-4 h-4"/> Upload</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4 relative">
                
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalRevenue)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Views</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalViews)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Avg RPM</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.avgRPM)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Subscribers</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalSubs)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Watch Time (Hrs)</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalWatchTime)}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="mb-6 space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <SparklesIcon className="w-5 h-5 text-red-500" />
                                        <h3 className="font-bold text-slate-800 text-lg">Top Content Insights</h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <select value={filterChannelId} onChange={(e) => setFilterChannelId(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[120px]">
                                                <option value="">All Channels</option>
                                                {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Limit</span>
                                            <select value={insightsLimit} onChange={e => setInsightsLimit(Number(e.target.value))} className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[70px]">
                                                {[50, 100, 200, 500].map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select value={insightsReportYear} onChange={e => setInsightsReportYear(e.target.value)} className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]">
                                                <option value="all">Reported: All Time</option>
                                                {availableReportYears.map(y => <option key={y} value={y}>Reported: {y}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select value={insightsCreatedYear} onChange={e => setInsightsCreatedYear(e.target.value)} className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]">
                                                <option value="all">Created: All Time</option>
                                                {availableCreatedYears.map(y => <option key={y} value={y}>Created: {y}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <input type="text" placeholder="Search video titles..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none font-medium shadow-sm" />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center group/searchinfo">
                                        <InfoIcon className="w-5 h-5 text-slate-300 cursor-help hover:text-indigo-500 transition-colors" />
                                        <div className="absolute right-0 bottom-full mb-3 w-72 p-4 bg-slate-900 text-white rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/searchinfo:opacity-100 group-hover/searchinfo:translate-y-0 transition-all z-50">
                                            <p className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-white/10 pb-2">Advanced Search Tips</p>
                                            <div className="space-y-2 text-[11px]">
                                                <p><span className="text-indigo-400 font-bold">AND:</span> Just type words. <code className="bg-white/10 px-1 rounded">cat tech</code> matches both.</p>
                                                <p><span className="text-indigo-400 font-bold">OR:</span> Use pipe. <code className="bg-white/10 px-1 rounded">ios | android</code> matches either.</p>
                                                <p><span className="text-indigo-400 font-bold">EXCLUDE:</span> Use minus. <code className="bg-white/10 px-1 rounded">review -shorts</code> hides shorts.</p>
                                            </div>
                                            <div className="absolute top-full right-4 border-8 border-transparent border-t-slate-900"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Video Content</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('views')}>
                                                <div className="flex items-center justify-end gap-1">Views {getSortIcon('views', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('watchTimeHours')}>
                                                <div className="flex items-center justify-end gap-1">Watch Time {getSortIcon('watchTimeHours', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('subscribersGained')}>
                                                <div className="flex items-center justify-end gap-1">Subs {getSortIcon('subscribersGained', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('rpm')}>
                                                <div className="flex items-center justify-end gap-1" title="Revenue per 1000 views">RPM {getSortIcon('rpm', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('estimatedRevenue')}>
                                                <div className="flex items-center justify-end gap-1">Revenue {getSortIcon('estimatedRevenue', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        <tr className="bg-slate-50/80 font-bold border-b-2 border-slate-200">
                                            <td className="px-4 py-3"><span className="text-xs text-slate-500 uppercase tracking-widest">Total for Current Filters</span></td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-800 font-mono">{formatNumber(selectionSummary.views)}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-800 font-mono">{formatNumber(selectionSummary.watchTime)}h</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-800 font-mono">{formatNumber(selectionSummary.subs)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-slate-500 font-mono">{formatCurrency(selectionSummary.rpm)}</td>
                                            <td className="px-4 py-3 text-right text-sm text-green-700 font-mono">{formatCurrency(selectionSummary.revenue)}</td>
                                        </tr>
                                        {videoInsights.map((video, idx) => (
                                            <tr key={video.videoId} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-4 py-3 max-w-md">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-mono text-slate-300 group-hover:text-red-300">{idx + 1}</span>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-slate-700 truncate" title={video.videoTitle}>
                                                                <span className="text-slate-400 mr-2 font-mono">({video.publishDate})</span>
                                                                {video.videoTitle}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                <span className="text-[10px] text-slate-400 font-mono mr-1">{video.videoId}</span>
                                                                {video.rpm > (summary.avgRPM || 0) * 1.5 && <InsightLabel type="high-earner" title="High Earner" details="Higher RPM than average." action="Double down on this topic." />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(video.views)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(video.watchTimeHours)}h</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(video.subscribersGained)}</td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-400 font-mono">{formatCurrency(video.rpm)}</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-green-600 font-mono">{formatCurrency(video.estimatedRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'insights' && (
                    <div className="space-y-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
                                    <TrendingUpIcon className="w-5 h-5 text-red-500" /> Yearly Performance Champions
                                </h3>
                                <div className="space-y-3">
                                    {generatedInsights?.champions.map(([year, video]) => (
                                        <div key={year} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <div className="min-w-0 pr-4">
                                                <span className="text-xs font-bold text-slate-400 uppercase block">{year} Top Video</span>
                                                <p className="text-sm font-bold text-slate-800 truncate" title={video.videoTitle}>{video.videoTitle}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-green-600">{formatCurrency(video.estimatedRevenue)}</span>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">{formatNumber(video.views)} Views</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
                                    <VideoIcon className="w-5 h-5 text-red-500" /> Content Velocity
                                </h3>
                                <div className="space-y-2">
                                    {generatedInsights?.counts.map(([year, count]) => {
                                        const maxCount = Math.max(...Array.from(generatedInsights.counts.map(c => c[1])));
                                        const percent = (count / maxCount) * 100;
                                        return (
                                            <div key={year} className="space-y-1">
                                                <div className="flex justify-between text-xs font-bold text-slate-600 uppercase">
                                                    <span>{year}</span>
                                                    <span>{count} Videos</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div className="h-full bg-red-500 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
                                    <LightBulbIcon className="w-5 h-5 text-yellow-500" /> High-Value Keywords
                                </h3>
                                <p className="text-xs text-slate-500 mb-4 italic">Words in titles with the highest average revenue (minimum 3 videos per word).</p>
                                <div className="flex flex-wrap gap-2">
                                    {generatedInsights?.topKeywords.map(k => (
                                        <div key={k.word} className="flex flex-col p-3 bg-red-50 border border-red-100 rounded-xl min-w-[120px]">
                                            <span className="text-sm font-bold text-red-700 capitalize">"{k.word}"</span>
                                            <span className="text-xs font-bold text-slate-600 mt-1">{formatCurrency(k.avgRevenue)} avg</span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 uppercase font-bold">{k.count} Videos</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-xl flex flex-col justify-between overflow-hidden relative">
                                <SparklesIcon className="absolute -bottom-8 -right-8 w-48 h-48 opacity-10" />
                                <div>
                                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
                                        <HeartIcon className="w-5 h-5 text-red-500" /> Content Durability
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <span className="text-slate-400 text-xs uppercase font-bold tracking-widest block mb-1">Evergreen Revenue (1yr+ old)</span>
                                            <p className="text-3xl font-bold">{formatCurrency(generatedInsights?.evergreenRevenue || 0)}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-xs uppercase font-bold tracking-widest block mb-1">% of Lifetime Earnings</span>
                                            <p className="text-3xl font-bold">{generatedInsights?.evergreenPercent.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-8 italic relative z-10">This represents the revenue generated by content created more than one year ago, showing the passive power of your library.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4 h-full flex flex-col">
                        <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center justify-between text-sm text-red-900">
                            <span>Showing <strong>{tableMetrics.length}</strong> {groupByVideo ? 'videos' : 'records'}</span>
                            <div className="flex items-center gap-4">
                                <span className="font-bold hidden sm:inline">Total Revenue: {formatCurrency(summary.totalRevenue)}</span>
                                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-red-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Per Page</span>
                                    <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} className="border-none p-0 text-xs font-bold text-red-600 focus:ring-0">
                                        {[50, 100, 200, 500].map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition-colors shadow-sm select-none">
                                    <input type="checkbox" checked={groupByVideo} onChange={() => setGroupByVideo(!groupByVideo)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-xs font-bold text-red-700 uppercase">Group by Video</span>
                                </label>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden relative">
                            <div className="overflow-auto flex-grow">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 w-10 bg-slate-50">
                                                {!groupByVideo && <input type="checkbox" checked={selectedIds.size === tableMetrics.length && tableMetrics.length > 0} onChange={() => { if (selectedIds.size === tableMetrics.length) setSelectedIds(new Set()); else setSelectedIds(new Set(tableMetrics.map(m => m.id))); }} className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" />}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('reportYear')}>
                                                <div className="flex items-center gap-1">Report Year {getSortIcon('reportYear', dataSortKey, dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('publishDate')}>
                                                <div className="flex items-center gap-1">Published {getSortIcon('publishDate', dataSortKey, dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('videoTitle')}>
                                                <div className="flex items-center gap-1">Video {getSortIcon('videoTitle', dataSortKey, dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('views')}>
                                                <div className="flex items-center justify-end gap-1">Views {getSortIcon('views', dataSortKey, dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('estimatedRevenue')}>
                                                <div className="flex items-center justify-end gap-1">Revenue {getSortIcon('estimatedRevenue', dataSortKey, dataSortDir)}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {paginatedMetrics.map((m) => (
                                            <tr key={m.id} className={!groupByVideo && selectedIds.has(m.id) ? "bg-red-50" : "hover:bg-slate-50 transition-colors"}>
                                                <td className="px-4 py-2 text-center">
                                                    {!groupByVideo && <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => { const s = new Set(selectedIds); if(s.has(m.id)) s.delete(m.id); else s.add(m.id); setSelectedIds(s); }} className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" />}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.reportYear || '-'}</td>
                                                <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.publishDate}{m.channelId && <div className="text-[10px] text-indigo-600">{channelMap.get(m.channelId)}</div>}</td>
                                                <td className="px-4 py-2 text-sm text-slate-800"><div className="line-clamp-1 max-w-md" title={m.videoTitle}>{m.videoTitle}</div></td>
                                                <td className="px-4 py-2 text-right text-sm text-slate-600">{formatNumber(m.views)}</td>
                                                <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.estimatedRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="h-full space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div className="space-y-4">
                                <div className="flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-300 p-8">
                                    <div className="bg-red-50 p-4 rounded-full mb-4"><CloudArrowUpIcon className="w-8 h-8 text-red-500" /></div>
                                    <h3 className="text-xl font-bold text-slate-700 mb-2">Select CSV File</h3>
                                    <input type="file" ref={fileInputRef} accept=".csv,.tsv" onChange={handleFileUpload} className="hidden" />
                                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-300 transition-colors">
                                        {isUploading ? 'Parsing...' : 'Choose File'}
                                    </button>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                                    <h4 className="font-bold text-slate-700 border-b pb-2">Import Context</h4>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">YouTube Channel <span className="text-red-500">*</span></label>
                                        <div className="flex gap-2">
                                            <select value={uploadChannelId} onChange={(e) => setUploadChannelId(e.target.value)} className="w-full p-2 border rounded-md text-sm">
                                                <option value="">Select Channel...</option>
                                                {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year (Optional)</label>
                                        <select value={uploadYear} onChange={(e) => setUploadYear(e.target.value)} className="w-full p-2 border rounded-md text-sm">
                                            <option value="">Auto-Detect from File</option>
                                            {Array.from({length: 25}, (_, i) => (2010 + i).toString()).reverse().map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ExternalLinkIcon className="w-5 h-5 text-indigo-600" />How to Export</h3>
                                <p className="text-sm text-slate-600 mb-2">Follow these exact steps:</p>
                                <ol className="space-y-3 list-decimal list-inside text-sm text-slate-600 font-medium">
                                    <li>Go to <a href="https://studio.youtube.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">YouTube Studio</a>.</li>
                                    <li>Click <strong>Analytics</strong> in the left sidebar.</li>
                                    <li>Click <strong>Advanced Mode</strong> (top right).</li>
                                    <li>Select the <strong>Year</strong> in the date dropdown (top right).</li>
                                    <li>Click <strong>Export current view</strong> (top right) and choose <strong>Comma-separated values (.csv)</strong>.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YouTubeIntegration;
