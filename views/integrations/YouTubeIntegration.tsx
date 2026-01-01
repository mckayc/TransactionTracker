
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon, AddIcon, EditIcon, VideoIcon, SparklesIcon, TrendingUpIcon, LightBulbIcon, InfoIcon } from '../../components/Icons';
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
 * Supports:
 * - AND: word1 word2
 * - OR: word1 | word2
 * - NOT: -word1
 */
const matchAdvancedSearch = (title: string, search: string) => {
    if (!search) return true;
    const lowerTitle = title.toLowerCase();
    
    // Split by OR (|)
    const orParts = search.split('|').map(p => p.trim()).filter(Boolean);
    if (orParts.length === 0) return true;

    return orParts.some(orPart => {
        // Within each OR part, split by space for AND and - for NOT
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

/**
 * Actionable Insight Label with Tooltip
 */
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
            
            {/* Tooltip Info Graphic */}
            <div className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-slate-900 text-white rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/insight:opacity-100 group-hover/insight:translate-y-0 transition-all z-50">
                <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                    <LightBulbIcon className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">{title} Analysis</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                    {details}
                </p>
                <div className="bg-white/10 p-2 rounded-lg border border-white/5">
                    <p className="text-[10px] font-bold text-indigo-300 uppercase mb-1">Recommended Action</p>
                    <p className="text-[11px] text-white font-medium italic">
                        "{action}"
                    </p>
                </div>
                <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-900"></div>
            </div>
        </div>
    );
};

const ManageChannelsModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    channels: YouTubeChannel[]; 
    onSave: (ch: YouTubeChannel) => void; 
    onDelete: (id: string) => void;
}> = ({ isOpen, onClose, channels, onSave, onDelete }) => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            id: editingId || generateUUID(),
            name: name.trim(),
            url: url.trim() || undefined
        });
        setName('');
        setUrl('');
        setEditingId(null);
    };

    const handleEdit = (ch: YouTubeChannel) => {
        setName(ch.name);
        setUrl(ch.url || '');
        setEditingId(ch.id);
    };

    const handleDelete = (id: string) => {
        if(confirm("Delete this channel definition?")) onDelete(id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Manage Channels</h3>
                    <button onClick={onClose}><CloseIcon className="w-5 h-5 text-slate-500 hover:text-slate-700"/></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase">Channel Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="My Tech Channel" />
                        <label className="text-xs font-bold text-slate-500 uppercase mt-2 block">Channel URL (Optional)</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="https://youtube.com/..." />
                        <div className="flex justify-end pt-2">
                            <button onClick={handleSave} disabled={!name} className="px-4 py-1.5 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                                {editingId ? 'Update' : 'Add Channel'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {channels.length === 0 ? <p className="text-sm text-slate-400 text-center italic">No channels added yet.</p> : channels.map(ch => (
                            <div key={ch.id} className="flex items-center justify-between p-2 border rounded hover:bg-slate-50">
                                <div>
                                    <p className="font-bold text-sm text-slate-700">{ch.name}</p>
                                    {ch.url && <p className="text-xs text-slate-400 truncate max-w-[200px]">{ch.url}</p>}
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(ch)} className="p-1 text-slate-400 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                    <button onClick={() => handleDelete(ch.id)} className="p-1 text-slate-400 hover:text-red-600"><DeleteIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, channels, onSaveChannel, onDeleteChannel }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadYear, setUploadYear] = useState<string>('');
    const [uploadChannelId, setUploadChannelId] = useState<string>('');
    const [isManageChannelsOpen, setIsManageChannelsOpen] = useState(false);

    // Filter Logic
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterChannelId, setFilterChannelId] = useState('');
    
    // Insights Sorting & Filtering State
    const [insightsSortKey, setInsightsSortKey] = useState<keyof YouTubeMetric>('estimatedRevenue');
    const [insightsSortDir, setInsightsSortDir] = useState<'asc' | 'desc'>('desc');
    const [insightsLimit, setInsightsLimit] = useState<number>(50);
    const [insightsReportYear, setInsightsReportYear] = useState<string>('all');
    const [insightsCreatedYear, setInsightsCreatedYear] = useState<string>('all');

    // Fix: Added missing groupByVideo state
    const [groupByVideo, setGroupByVideo] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    const years = useMemo(() => Array.from({length: 51}, (_, i) => (2000 + i).toString()).reverse(), []);

    const availableReportYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => {
            if (m.reportYear) yearsSet.add(m.reportYear);
        });
        return Array.from(yearsSet).sort().reverse();
    }, [metrics]);

    const availableCreatedYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => {
            if (m.publishDate) {
                const y = m.publishDate.substring(0, 4);
                if (y.length === 4) yearsSet.add(y);
            }
        });
        return Array.from(yearsSet).sort().reverse();
    }, [metrics]);

    useEffect(() => {
        if (previewMetrics.length > 0) {
            if (!uploadYear) {
                let maxYear = 0;
                previewMetrics.forEach(m => {
                    if (m.publishDate) {
                        const y = parseInt(m.publishDate.substring(0, 4));
                        if (!isNaN(y) && y > maxYear) maxYear = y;
                    }
                });
                if (maxYear > 0) setUploadYear(maxYear.toString());
            }
            if (!uploadChannelId && channels.length === 1) {
                setUploadChannelId(channels[0].id);
            }
        }
    }, [previewMetrics, uploadYear, uploadChannelId, channels]);

    // Fix: Updated sortedMetrics useMemo to handle the missing groupByVideo logic and include it in dependencies
    const sortedMetrics = useMemo(() => {
        let result = metrics;

        if (groupByVideo) {
            const groups = new Map<string, YouTubeMetric>();
            metrics.forEach(m => {
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
        
        // Sorting for Data tab
        const sorted = [...result].sort((a, b) => {
            let valA = a.publishDate;
            let valB = b.publishDate;
            // Simple sort logic for data table
            const cmp = valA.toLowerCase().localeCompare(valB.toLowerCase());
            return cmp;
        });
        return sorted;
    }, [metrics, groupByVideo]);

    const totalPages = Math.ceil(sortedMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = sortedMetrics.slice(startIndex, startIndex + rowsPerPage);

    // Fix: Added groupByVideo to the pagination reset dependency list
    useEffect(() => { setCurrentPage(1); }, [rowsPerPage, groupByVideo]);

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
            const metricsWithChannel = previewMetrics.map(m => ({
                ...m,
                channelId: uploadChannelId,
                reportYear: uploadYear || undefined
            }));
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

    const previewSummary = useMemo(() => {
        return previewMetrics.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.estimatedRevenue,
            views: acc.views + curr.views,
            subs: acc.subs + curr.subscribersGained,
            watchTime: acc.watchTime + curr.watchTimeHours
        }), { revenue: 0, views: 0, subs: 0, watchTime: 0 });
    }, [previewMetrics]);

    // Insights Logic: Aggregated totals per video based on CURRENT FILTERS
    const videoInsights = useMemo(() => {
        let base = metrics;
        
        // 1. Filter by Channel
        if (filterChannelId) {
            base = base.filter(m => m.channelId === filterChannelId);
        }
        
        // 2. Filter by Reported Year
        if (insightsReportYear !== 'all') {
            base = base.filter(m => m.reportYear === insightsReportYear);
        }
        
        // 3. Filter by Created Year
        if (insightsCreatedYear !== 'all') {
            base = base.filter(m => m.publishDate.substring(0, 4) === insightsCreatedYear);
        }

        // 4. Group by Video ID
        const groups = new Map<string, YouTubeMetric>();
        base.forEach(m => {
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

        // 5. Apply Search Filter
        let list = Array.from(groups.values()).filter(v => matchAdvancedSearch(v.videoTitle, debouncedSearchTerm));

        // 6. Map calculated fields
        const result = list.map(v => ({
            ...v,
            rpm: v.views > 0 ? (v.estimatedRevenue / v.views) * 1000 : 0,
            watchPerView: v.views > 0 ? v.watchTimeHours / v.views : 0,
            subsPerView: v.views > 0 ? v.subscribersGained / v.views : 0
        }));

        // 7. Sort
        result.sort((a, b) => {
            const valA = a[insightsSortKey as keyof typeof a] as number;
            const valB = b[insightsSortKey as keyof typeof b] as number;
            return insightsSortDir === 'asc' ? valA - valB : valB - valA;
        });

        return result.slice(0, insightsLimit);
    }, [metrics, filterChannelId, insightsReportYear, insightsCreatedYear, insightsLimit, insightsSortKey, insightsSortDir, debouncedSearchTerm]);

    // Summary specifically for the current selection for the "Total" row
    const selectionSummary = useMemo(() => {
        let base = metrics;
        if (filterChannelId) {
            base = base.filter(m => m.channelId === filterChannelId);
        }
        if (insightsReportYear !== 'all') {
            base = base.filter(m => m.reportYear === insightsReportYear);
        }
        if (insightsCreatedYear !== 'all') {
            base = base.filter(m => m.publishDate.substring(0, 4) === insightsCreatedYear);
        }

        // Search filtering for selection summary
        const filteredBySearch = base.filter(v => matchAdvancedSearch(v.videoTitle, debouncedSearchTerm));

        const res = { revenue: 0, views: 0, watchTime: 0, subs: 0 };
        filteredBySearch.forEach(m => {
            res.revenue += m.estimatedRevenue;
            res.views += m.views;
            res.watchTime += m.watchTimeHours;
            res.subs += m.subscribersGained;
        });
        return {
            ...res,
            rpm: res.views > 0 ? (res.revenue / res.views) * 1000 : 0
        };
    }, [metrics, filterChannelId, insightsReportYear, insightsCreatedYear, debouncedSearchTerm]);

    const handleInsightsSort = (key: keyof YouTubeMetric | 'rpm') => {
        if (insightsSortKey === key) {
            setInsightsSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setInsightsSortKey(key as any);
            setInsightsSortDir('desc');
        }
    };

    const getInsightsSortIcon = (key: string) => {
        if (insightsSortKey !== key) return <SortIcon className="w-3 h-3 text-slate-300 opacity-50" />;
        return insightsSortDir === 'asc' ? <SortIcon className="w-3 h-3 text-red-600 transform rotate-180" /> : <SortIcon className="w-3 h-3 text-red-600" />;
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Permanently delete ${selectedIds.size} records?`)) {
            onDeleteMetrics(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const handleToggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleDeleteAll = () => {
        if (window.confirm("WARNING: This will delete ALL YouTube Analytics data. Are you sure?")) {
            onDeleteMetrics(metrics.map(m => m.id));
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
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><CloudArrowUpIcon className="w-4 h-4"/> Upload</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4 relative">
                
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 pb-8">
                        {/* High Level Stats */}
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

                        {/* TOP CONTENT INSIGHTS SECTION */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="mb-6 space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <SparklesIcon className="w-5 h-5 text-red-500" />
                                        <h3 className="font-bold text-slate-800 text-lg">Top Content Insights</h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <select 
                                                value={filterChannelId} 
                                                onChange={(e) => setFilterChannelId(e.target.value)} 
                                                className="p-1.5 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[120px]"
                                            >
                                                <option value="">All Channels</option>
                                                {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Limit</span>
                                            <select 
                                                value={insightsLimit} 
                                                onChange={e => setInsightsLimit(Number(e.target.value))}
                                                className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[70px]"
                                            >
                                                {[50, 100, 200, 500].map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select 
                                                value={insightsReportYear} 
                                                onChange={e => setInsightsReportYear(e.target.value)}
                                                className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]"
                                            >
                                                <option value="all">Reported: All Time</option>
                                                {availableReportYears.map(y => <option key={y} value={y}>Reported: {y}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select 
                                                value={insightsCreatedYear} 
                                                onChange={e => setInsightsCreatedYear(e.target.value)}
                                                className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]"
                                            >
                                                <option value="all">Created: All Time</option>
                                                {availableCreatedYears.map(y => <option key={y} value={y}>Created: {y}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section Search Bar */}
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <SearchCircleIcon className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Search video titles..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-12 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none font-medium shadow-sm"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center group/searchinfo">
                                        <InfoIcon className="w-5 h-5 text-slate-300 cursor-help hover:text-indigo-500 transition-colors" />
                                        <div className="absolute right-0 bottom-full mb-3 w-72 p-4 bg-slate-900 text-white rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/searchinfo:opacity-100 group-hover/searchinfo:translate-y-0 transition-all z-50">
                                            <p className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-white/10 pb-2">Advanced Search Tips</p>
                                            <div className="space-y-2 text-[11px]">
                                                <p><span className="text-indigo-400 font-bold">AND:</span> Just type words with spaces. <code className="bg-white/10 px-1 rounded">cat tech</code> matches titles with both words.</p>
                                                <p><span className="text-indigo-400 font-bold">OR:</span> Use the pipe symbol. <code className="bg-white/10 px-1 rounded">ios | android</code> matches either word.</p>
                                                <p><span className="text-indigo-400 font-bold">EXCLUDE:</span> Use a minus sign. <code className="bg-white/10 px-1 rounded">review -shorts</code> matches review but hides shorts.</p>
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
                                            <th 
                                                className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group"
                                                onClick={() => handleInsightsSort('views')}
                                            >
                                                <div className="flex items-center justify-end gap-1">Views {getInsightsSortIcon('views')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group"
                                                onClick={() => handleInsightsSort('watchTimeHours')}
                                            >
                                                <div className="flex items-center justify-end gap-1">Watch Time {getInsightsSortIcon('watchTimeHours')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group"
                                                onClick={() => handleInsightsSort('subscribersGained')}
                                            >
                                                <div className="flex items-center justify-end gap-1">Subs {getInsightsSortIcon('subscribersGained')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group"
                                                onClick={() => handleInsightsSort('rpm')}
                                            >
                                                <div className="flex items-center justify-end gap-1" title="Revenue per 1000 views">RPM {getInsightsSortIcon('rpm')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group"
                                                onClick={() => handleInsightsSort('estimatedRevenue')}
                                            >
                                                <div className="flex items-center justify-end gap-1">Revenue {getInsightsSortIcon('estimatedRevenue')}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {/* TOTALS ROW */}
                                        <tr className="bg-slate-50/80 font-bold border-b-2 border-slate-200">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500 uppercase tracking-widest">Total for Current Filters</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-800 font-mono">{formatNumber(selectionSummary.views)}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-800 font-mono">{formatNumber(selectionSummary.watchTime)}h</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-800 font-mono">{formatNumber(selectionSummary.subs)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-slate-500 font-mono">{formatCurrency(selectionSummary.rpm)}</td>
                                            <td className="px-4 py-3 text-right text-sm text-green-700 font-mono">{formatCurrency(selectionSummary.revenue)}</td>
                                        </tr>

                                        {videoInsights.map((video, idx) => {
                                            const isHighEarner = video.rpm > (summary.avgRPM || 0) * 1.5;
                                            // Mock averages for the helper labels since we filtered the global average
                                            const isHiddenGem = video.watchPerView > (summary.avgWatchPerView || 0) * 1.3 && video.ctr < (summary.avgCTR || 0);
                                            const isLowHook = video.ctr < (summary.avgCTR || 0) * 0.7 && video.impressions > 1000;
                                            const isFanMaker = video.subsPerView > (summary.totalSubs / (summary.totalViews || 1)) * 1.5;

                                            return (
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
                                                                    
                                                                    {isHighEarner && (
                                                                        <InsightLabel 
                                                                            type="high-earner" 
                                                                            title="High Earner" 
                                                                            details="This video has an RPM significantly higher than your average. It's highly optimized for high-value keywords or high-paying ads."
                                                                            action="Consider creating a series around this specific topic to maximize channel revenue."
                                                                        />
                                                                    )}
                                                                    
                                                                    {isHiddenGem && (
                                                                        <InsightLabel 
                                                                            type="hidden-gem" 
                                                                            title="Hidden Gem" 
                                                                            details="Viewers are staying longer than average, but the Click-Through Rate is low. Your content is solid, but your packaging is failing."
                                                                            action="Update the thumbnail and title immediately. A better hook could double this video's reach."
                                                                        />
                                                                    )}

                                                                    {isLowHook && (
                                                                        <InsightLabel 
                                                                            type="low-hook" 
                                                                            title="Hook Needed" 
                                                                            details="The Click-Through Rate (CTR) is very low compared to your channel average. The algorithm is showing it, but people aren't clicking."
                                                                            action="Run an A/B test on a new thumbnail with higher contrast or a more intriguing focal point."
                                                                        />
                                                                    )}

                                                                    {isFanMaker && (
                                                                        <InsightLabel 
                                                                            type="fan-maker" 
                                                                            title="Fan Maker" 
                                                                            details="This video converts viewers to subscribers at a very high rate. It builds high trust or provides extreme value."
                                                                            action="Link your high-view, low-sub videos to this one via end screens to grow your audience faster."
                                                                        />
                                                                    )}
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
                                            );
                                        })}
                                        {videoInsights.length === 0 && (
                                            <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">No video data found for this period or search.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-3">
                                <TrendingUpIcon className="w-4 h-4 text-red-500 mt-0.5" />
                                <div className="text-[11px] text-red-800 leading-relaxed">
                                    <strong>Pro Tip:</strong> Use the advanced search bar to find specific topics and analyze their evergreen performance. Hover over insights for tailored strategic recommendations.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4 h-full flex flex-col">
                        <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center justify-between text-sm text-red-900">
                            <span>Showing <strong>{sortedMetrics.length}</strong> records</span>
                            <div className="flex items-center gap-4">
                                <span className="font-bold hidden sm:inline">Total Revenue: {formatCurrency(summary.totalRevenue)}</span>
                                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition-colors shadow-sm select-none">
                                    <input type="checkbox" checked={groupByVideo} onChange={() => setGroupByVideo(!groupByVideo)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-xs font-bold text-red-700 uppercase">Group by Video</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end"><button onClick={handleDeleteAll} className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 px-3 py-1 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"><DeleteIcon className="w-3 h-3" /> Delete All Data</button></div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden relative">
                            <div className="overflow-auto flex-grow">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 w-10 bg-slate-50">
                                                {!groupByVideo && (
                                                    <input type="checkbox" checked={selectedIds.size === paginatedMetrics.length && paginatedMetrics.length > 0} onChange={() => { if (selectedIds.size === paginatedMetrics.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginatedMetrics.map(m => m.id))); }} className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" />
                                                )}
                                            </th>
                                            {!groupByVideo && (
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Year Reported</th>
                                            )}
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Published</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Video</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Views</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {paginatedMetrics.map((m) => (
                                            <tr key={m.id} className={!groupByVideo && selectedIds.has(m.id) ? "bg-red-50" : "hover:bg-slate-50 transition-colors"}>
                                                <td className="px-4 py-2 text-center">
                                                    {!groupByVideo && <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => handleToggleSelection(m.id)} className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" />}
                                                </td>
                                                {!groupByVideo && <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.reportYear || '-'}</td>}
                                                <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.publishDate}{m.channelId && <div className="text-[10px] text-indigo-600">{channelMap.get(m.channelId)}</div>}</td>
                                                <td className="px-4 py-2 text-sm text-slate-800">
                                                    <div className="line-clamp-1 max-w-md" title={m.videoTitle}>
                                                        <span className="text-slate-400 mr-2 font-mono">({m.publishDate})</span>
                                                        {m.videoTitle}
                                                    </div>
                                                    {groupByVideo && <div className="text-xs text-slate-400 mt-0.5">{m.videoId}</div>}
                                                </td>
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
                                            <button onClick={() => setIsManageChannelsOpen(true)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded border text-slate-600"><EditIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year (Optional)</label>
                                        <select value={uploadYear} onChange={(e) => setUploadYear(e.target.value)} className="w-full p-2 border rounded-md text-sm">
                                            <option value="">Auto-Detect from File</option>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
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

                        {previewMetrics.length > 0 && (
                            <div className="flex flex-col space-y-4 pt-4 border-t">
                                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex flex-col gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-red-100 rounded-full text-red-600"><CheckCircleIcon className="w-6 h-6" /></div>
                                        <div><h3 className="font-bold text-red-900 text-lg">Ready to Import</h3><p className="text-red-700 text-sm">Found <strong>{previewMetrics.length}</strong> records.</p></div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full pt-2 border-t border-red-200/50">
                                        <div><p className="text-xs font-bold text-red-800 uppercase opacity-70">Revenue</p><p className="text-lg font-bold text-red-900">{formatCurrency(previewSummary.revenue)}</p></div>
                                        <div><p className="text-xs font-bold text-red-800 uppercase opacity-70">Views</p><p className="text-lg font-bold text-red-900">{formatNumber(previewSummary.views)}</p></div>
                                        <div><p className="text-xs font-bold text-red-800 uppercase opacity-70">Subs</p><p className="text-lg font-bold text-red-900">{formatNumber(previewSummary.subs)}</p></div>
                                        <div><p className="text-xs font-bold text-red-800 uppercase opacity-70">Watch Time</p><p className="text-lg font-bold text-red-900">{formatNumber(previewSummary.watchTime)} hrs</p></div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button onClick={() => setPreviewMetrics([])} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                                    <button onClick={confirmImport} disabled={!uploadChannelId} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed">Confirm Import</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Manage Channels Modal */}
            <ManageChannelsModal 
                isOpen={isManageChannelsOpen} 
                onClose={() => setIsManageChannelsOpen(false)} 
                channels={channels} 
                onSave={onSaveChannel} 
                onDelete={onDeleteChannel} 
            />

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && activeTab === 'data' && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-slide-up">
                    <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                        <span className="font-medium text-sm">{selectedIds.size} selected</span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 rounded-full transition-colors shadow-sm"
                    >
                        <DeleteIcon className="w-4 h-4"/>
                        Delete Selected
                    </button>
                </div>
            )}
        </div>
    );
};

export default YouTubeIntegration;
