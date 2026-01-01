import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon, AddIcon, EditIcon, VideoIcon, SparklesIcon, TrendingUpIcon } from '../../components/Icons';
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

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterChannelId, setFilterChannelId] = useState('');
    const [filterReportYear, setFilterReportYear] = useState('');
    
    const [groupByVideo, setGroupByVideo] = useState(false);
    
    const [sortKey, setSortKey] = useState<keyof YouTubeMetric>('publishDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    
    // Insights Sorting State
    const [insightsSortKey, setInsightsSortKey] = useState<keyof YouTubeMetric>('estimatedRevenue');
    const [insightsSortDir, setInsightsSortDir] = useState<'asc' | 'desc'>('desc');
    const [insightsLimit, setInsightsLimit] = useState<number>(10);
    const [insightsYear, setInsightsYear] = useState<string>('all');

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

    const availableRevenueYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => {
            if (m.publishDate) yearsSet.add(m.publishDate.substring(0, 4));
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

    const filteredMetrics = useMemo(() => {
        let result = metrics;
        if (debouncedSearchTerm) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            result = result.filter(m => m.videoTitle.toLowerCase().includes(lowerSearch) || m.videoId.toLowerCase().includes(lowerSearch));
        }
        if (startDate) result = result.filter(m => m.publishDate >= startDate);
        if (endDate) result = result.filter(m => m.publishDate <= endDate);
        if (filterChannelId) result = result.filter(m => m.channelId === filterChannelId);
        if (filterReportYear) result = result.filter(m => m.reportYear === filterReportYear);
        return result;
    }, [metrics, debouncedSearchTerm, startDate, endDate, filterChannelId, filterReportYear]);

    const finalDisplayMetrics = useMemo(() => {
        if (!groupByVideo) return filteredMetrics;
        const groups = new Map<string, YouTubeMetric & { _clicks: number }>();
        filteredMetrics.forEach(m => {
            if (!groups.has(m.videoId)) {
                groups.set(m.videoId, { ...m, _clicks: m.impressions * (m.ctr / 100) });
            } else {
                const existing = groups.get(m.videoId)!;
                existing.views += m.views;
                existing.watchTimeHours += m.watchTimeHours;
                existing.subscribersGained += m.subscribersGained;
                existing.estimatedRevenue += m.estimatedRevenue;
                const newClicks = m.impressions * (m.ctr / 100);
                existing.impressions += m.impressions;
                existing._clicks += newClicks;
            }
        });
        return Array.from(groups.values()).map(g => ({
            ...g,
            ctr: g.impressions > 0 ? (g._clicks / g.impressions) * 100 : 0
        }));
    }, [filteredMetrics, groupByVideo]);

    const sortedMetrics = useMemo(() => {
        const sorted = [...finalDisplayMetrics].sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];
            if (valA === undefined || valA === null) valA = (typeof valB === 'number' ? 0 : '');
            if (valB === undefined || valB === null) valB = (typeof valA === 'number' ? 0 : '');
            if (typeof valA === 'string' && typeof valB === 'string') {
                const cmp = valA.toLowerCase().localeCompare(valB.toLowerCase());
                return sortDirection === 'asc' ? cmp : -cmp;
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [finalDisplayMetrics, sortKey, sortDirection]);

    const totalPages = Math.ceil(sortedMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = sortedMetrics.slice(startIndex, startIndex + rowsPerPage);

    useEffect(() => { setCurrentPage(1); }, [debouncedSearchTerm, startDate, endDate, rowsPerPage, filterChannelId, filterReportYear, groupByVideo]);

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
        const result = { totalRevenue: 0, totalViews: 0, totalSubs: 0, totalWatchTime: 0, avgRPM: 0 };
        filteredMetrics.forEach(m => {
            result.totalRevenue += m.estimatedRevenue;
            result.totalViews += m.views;
            result.totalSubs += m.subscribersGained;
            result.totalWatchTime += m.watchTimeHours;
        });
        if (result.totalViews > 0) result.avgRPM = (result.totalRevenue / result.totalViews) * 1000;
        return result;
    }, [filteredMetrics]);

    const previewSummary = useMemo(() => {
        return previewMetrics.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.estimatedRevenue,
            views: acc.views + curr.views,
            subs: acc.subs + curr.subscribersGained,
            watchTime: acc.watchTime + curr.watchTimeHours
        }), { revenue: 0, views: 0, subs: 0, watchTime: 0 });
    }, [previewMetrics]);

    // Insights Logic: Filtered top videos with sorting and RPM calculation
    const videoInsights = useMemo(() => {
        let base = metrics;
        if (insightsYear !== 'all') {
            base = base.filter(m => m.reportYear === insightsYear);
        }

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
            }
        });

        const list = Array.from(groups.values()).map(v => ({
            ...v,
            rpm: v.views > 0 ? (v.estimatedRevenue / v.views) * 1000 : 0
        }));

        list.sort((a, b) => {
            const valA = a[insightsSortKey as keyof typeof a] as number;
            const valB = b[insightsSortKey as keyof typeof b] as number;
            return insightsSortDir === 'asc' ? valA - valB : valB - valA;
        });

        return list.slice(0, insightsLimit);
    }, [metrics, insightsYear, insightsLimit, insightsSortKey, insightsSortDir]);

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

    const setDateRange = (type: 'thisYear' | 'lastYear' | 'thisMonth' | 'lastMonth') => {
        const now = new Date();
        let start, end;
        if (type === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); }
        else if (type === 'lastYear') { start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() - 1, 11, 31); }
        else if (type === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
        else { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    // Fix: Added missing getSortIcon function for the data table
    const getSortIcon = (key: keyof YouTubeMetric) => {
        if (sortKey !== key) return <SortIcon className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortDirection === 'asc' ? <SortIcon className="w-4 h-4 text-red-600 transform rotate-180" /> : <SortIcon className="w-4 h-4 text-red-600" />;
    };

    // Fix: Added missing handleBulkDelete function for the data table
    const handleBulkDelete = () => {
        if (window.confirm(`Permanently delete ${selectedIds.size} records?`)) {
            onDeleteMetrics(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const handleHeaderClick = (key: keyof YouTubeMetric) => {
        if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('desc'); }
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
                
                {activeTab !== 'upload' && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4 flex-shrink-0 mb-6">
                        <div className="relative flex-grow w-full md:w-auto">
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search Video Title..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                        
                        <select value={filterChannelId} onChange={(e) => setFilterChannelId(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                            <option value="">All Channels</option>
                            {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                        </select>

                        <select value={filterReportYear} onChange={(e) => setFilterReportYear(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                            <option value="">All Reported Years</option>
                            {availableReportYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-lg text-sm w-full md:w-auto" />
                            <span className="text-slate-400">-</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-lg text-sm w-full md:w-auto" />
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setDateRange('thisMonth')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md font-medium text-slate-600">This Month</button>
                            <button onClick={() => setDateRange('thisYear')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md font-medium text-slate-600">This Year</button>
                        </div>
                    </div>
                )}

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

                        {/* NEW INSIGHTS SECTION */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <SparklesIcon className="w-5 h-5 text-red-500" />
                                    <h3 className="font-bold text-slate-800 text-lg">Top Content Insights</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Limit</span>
                                        <select 
                                            value={insightsLimit} 
                                            onChange={e => setInsightsLimit(Number(e.target.value))}
                                            className="p-1.5 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold"
                                        >
                                            {[10, 20, 30, 50, 100].map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Year</span>
                                        <select 
                                            value={insightsYear} 
                                            onChange={e => setInsightsYear(e.target.value)}
                                            className="p-1.5 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold"
                                        >
                                            <option value="all">All Time</option>
                                            {availableReportYears.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
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
                                        {videoInsights.map((video, idx) => (
                                            <tr key={video.videoId} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-4 py-3 max-w-md">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-mono text-slate-300 group-hover:text-red-300">{idx + 1}</span>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-slate-700 truncate" title={video.videoTitle}>{video.videoTitle}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-slate-400 font-mono">{video.videoId}</span>
                                                                {video.rpm > summary.avgRPM * 1.5 && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded font-bold uppercase">High Earner</span>}
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
                                        {videoInsights.length === 0 && (
                                            <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">No video data found for this period.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-3">
                                <TrendingUpIcon className="w-4 h-4 text-red-500 mt-0.5" />
                                <div className="text-[11px] text-red-800 leading-relaxed">
                                    <strong>Pro Tip:</strong> Look for videos with high <strong>RPM</strong> but low views; these are prime candidates for updated thumbnails or search optimization as they convert views to revenue most efficiently.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4 h-full flex flex-col">
                        <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center justify-between text-sm text-red-900">
                            <span>Showing <strong>{finalDisplayMetrics.length}</strong> {groupByVideo ? 'videos' : 'records'}</span>
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
                                                    <input type="checkbox" checked={selectedIds.size === finalDisplayMetrics.length && finalDisplayMetrics.length > 0} onChange={() => { if (selectedIds.size === finalDisplayMetrics.length) setSelectedIds(new Set()); else setSelectedIds(new Set(finalDisplayMetrics.map(m => m.id))); }} className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" />
                                                )}
                                            </th>
                                            {!groupByVideo && (
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('reportYear')}>
                                                    <div className="flex items-center gap-1">Year Reported {getSortIcon('reportYear')}</div>
                                                </th>
                                            )}
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('publishDate')}>
                                                <div className="flex items-center gap-1">Published {getSortIcon('publishDate')}</div>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('videoTitle')}>
                                                <div className="flex items-center gap-1">Video {getSortIcon('videoTitle')}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('views')}>
                                                <div className="flex items-center justify-end gap-1">Views {getSortIcon('views')}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('estimatedRevenue')}>
                                                <div className="flex items-center justify-end gap-1">Revenue {getSortIcon('estimatedRevenue')}</div>
                                            </th>
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
                                                <td className="px-4 py-2 text-sm text-slate-800"><div className="line-clamp-1 max-w-md" title={m.videoTitle}>{m.videoTitle}</div>{groupByVideo && <div className="text-xs text-slate-400 mt-0.5">{m.videoId}</div>}</td>
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