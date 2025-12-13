
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon, AddIcon, EditIcon } from '../../components/Icons';
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

// Simple SVG Bar Chart Component
const SimpleBarChart: React.FC<{ data: { label: string; value: number }[]; color: string }> = ({ data, color }) => {
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data to display</div>;

    const maxValue = Math.max(...data.map(d => d.value));
    const barWidth = 100 / data.length;

    return (
        <div className="h-48 flex items-end gap-1 pt-6 pb-2">
            {data.map((d, i) => {
                const heightPct = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
                return (
                    <div key={i} className="flex-1 flex flex-col justify-end group relative min-w-[4px]">
                        <div 
                            className={`w-full rounded-t-sm transition-all duration-500 ${color} opacity-80 hover:opacity-100`}
                            style={{ height: `${Math.max(heightPct, 2)}%` }}
                        ></div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 shadow-lg">
                            <div className="font-bold">{d.label}</div>
                            <div>{formatCurrency(d.value)}</div>
                        </div>
                    </div>
                );
            })}
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

    // Upload Context State
    const [uploadYear, setUploadYear] = useState<string>('');
    const [uploadChannelId, setUploadChannelId] = useState<string>('');
    const [isManageChannelsOpen, setIsManageChannelsOpen] = useState(false);

    // Filter & Sort
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterChannelId, setFilterChannelId] = useState('');
    
    const [sortKey, setSortKey] = useState<keyof YouTubeMetric>('publishDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [productSortKey, setProductSortKey] = useState<'estimatedRevenue' | 'views' | 'subscribersGained' | 'watchTimeHours'>('estimatedRevenue');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Years for dropdown (2000-2050)
    const years = useMemo(() => Array.from({length: 51}, (_, i) => (2000 + i).toString()).reverse(), []);

    // Guess Year & Channel Effect
    useEffect(() => {
        if (previewMetrics.length > 0) {
            // 1. Guess Year from most frequent year in publishDate
            if (!uploadYear) {
                const yearCounts: Record<string, number> = {};
                previewMetrics.forEach(m => {
                    if (m.publishDate) {
                        const y = m.publishDate.substring(0, 4);
                        if (!isNaN(Number(y))) yearCounts[y] = (yearCounts[y] || 0) + 1;
                    }
                });
                // Find most frequent year
                let maxCount = 0;
                let bestYear = '';
                for (const [y, count] of Object.entries(yearCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        bestYear = y;
                    }
                }
                if (bestYear) setUploadYear(bestYear);
            }

            // 2. Guess Channel if only one exists
            if (!uploadChannelId && channels.length === 1) {
                setUploadChannelId(channels[0].id);
            }
        }
    }, [previewMetrics, uploadYear, uploadChannelId, channels]);

    const displayMetrics = useMemo(() => {
        let result = metrics;

        if (debouncedSearchTerm) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            result = result.filter(m => m.videoTitle.toLowerCase().includes(lowerSearch) || m.videoId.toLowerCase().includes(lowerSearch));
        }

        if (startDate) {
            result = result.filter(m => m.publishDate >= startDate);
        }
        if (endDate) {
            result = result.filter(m => m.publishDate <= endDate);
        }
        
        if (filterChannelId) {
            result = result.filter(m => m.channelId === filterChannelId);
        }

        result.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];
            
            // Normalize undefined/null
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

        return result;
    }, [metrics, debouncedSearchTerm, startDate, endDate, sortKey, sortDirection, filterChannelId]);

    const totalPages = Math.ceil(displayMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = displayMetrics.slice(startIndex, startIndex + rowsPerPage);

    // Reset pagination
    useEffect(() => { setCurrentPage(1); }, [debouncedSearchTerm, startDate, endDate, rowsPerPage, filterChannelId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const newMetrics = await parseYouTubeReport(file, (msg) => console.log(msg));
            if (newMetrics.length > 0) {
                setPreviewMetrics(newMetrics);
            } else {
                alert("No valid records found in file.");
            }
        } catch (error) {
            console.error(error);
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        if (!uploadChannelId) {
            alert("Please select a Channel for this data.");
            return;
        }
        if (previewMetrics.length > 0) {
            // Apply selected channel ID to all imported metrics
            const metricsWithChannel = previewMetrics.map(m => ({
                ...m,
                channelId: uploadChannelId
                // Note: We don't overwrite the publishDate year because actual date is better,
                // but we could use uploadYear for metadata if we had a field for it.
            }));
            onAddMetrics(metricsWithChannel);
            setPreviewMetrics([]);
            setUploadYear('');
            // Keep channel ID selected for convenience
            alert(`Successfully imported ${previewMetrics.length} records.`);
            setActiveTab('dashboard');
        }
    };

    const summary = useMemo(() => {
        const result = {
            totalRevenue: 0,
            totalViews: 0,
            totalSubs: 0,
            totalWatchTime: 0,
            avgRPM: 0
        };
        displayMetrics.forEach(m => {
            result.totalRevenue += m.estimatedRevenue;
            result.totalViews += m.views;
            result.totalSubs += m.subscribersGained;
            result.totalWatchTime += m.watchTimeHours;
        });
        
        // RPM = (Revenue / Views) * 1000
        if (result.totalViews > 0) {
            result.avgRPM = (result.totalRevenue / result.totalViews) * 1000;
        }

        return result;
    }, [displayMetrics]);

    const previewSummary = useMemo(() => {
        return previewMetrics.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.estimatedRevenue,
            views: acc.views + curr.views,
            subs: acc.subs + curr.subscribersGained,
            watchTime: acc.watchTime + curr.watchTimeHours
        }), { revenue: 0, views: 0, subs: 0, watchTime: 0 });
    }, [previewMetrics]);

    // Chart Data: Aggregated Revenue by Publish Month
    const revenueByMonth = useMemo(() => {
        const grouped = new Map<string, number>();
        displayMetrics.forEach(m => {
            const monthKey = m.publishDate.substring(0, 7); // YYYY-MM
            grouped.set(monthKey, (grouped.get(monthKey) || 0) + m.estimatedRevenue);
        });
        
        return Array.from(grouped.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, value]) => ({ label: date, value }));
    }, [displayMetrics]);

    // Aggregate by Year
    const yearStats = useMemo(() => {
        const grouped = new Map<string, { revenue: number, views: number, subs: number, impressions: number, clicks: number }>();
        
        displayMetrics.forEach(m => {
            const year = m.publishDate.substring(0, 4);
            if (!grouped.has(year)) {
                grouped.set(year, { revenue: 0, views: 0, subs: 0, impressions: 0, clicks: 0 });
            }
            const data = grouped.get(year)!;
            data.revenue += m.estimatedRevenue;
            data.views += m.views;
            data.subs += m.subscribersGained;
            data.impressions += m.impressions;
            // Estimated clicks based on impression * ctr%
            data.clicks += (m.impressions * (m.ctr / 100)); 
        });

        return Array.from(grouped.entries())
            .sort((a, b) => b[0].localeCompare(a[0])) // Descending Year
            .map(([year, d]) => ({
                year,
                ...d,
                avgCtr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
            }));
    }, [displayMetrics]);

    const topVideos = useMemo(() => {
        return [...displayMetrics]
            .sort((a, b) => b[productSortKey] - a[productSortKey])
            .slice(0, 10);
    }, [displayMetrics, productSortKey]);

    const handleHeaderClick = (key: keyof YouTubeMetric) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc'); 
        }
    };

    const getSortIcon = (key: keyof YouTubeMetric) => {
        if (sortKey !== key) return <SortIcon className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortDirection === 'asc' ? <SortIcon className="w-4 h-4 text-red-600 transform rotate-180" /> : <SortIcon className="w-4 h-4 text-red-600" />;
    };

    const handleToggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Permanently delete ${selectedIds.size} records?`)) {
            onDeleteMetrics(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const handleDeleteAll = () => {
        if (window.confirm("WARNING: This will delete ALL YouTube Analytics data. Are you sure?")) {
            const allIds = metrics.map(m => m.id);
            onDeleteMetrics(allIds);
            setSelectedIds(new Set());
        }
    };

    // Date Range Presets
    const setDateRange = (type: 'thisYear' | 'lastYear' | 'thisMonth' | 'lastMonth') => {
        const now = new Date();
        let start, end;
        
        if (type === 'thisYear') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        } else if (type === 'lastYear') {
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31);
        } else if (type === 'thisMonth') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
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
                        
                        {/* Channel Filter */}
                        <select 
                            value={filterChannelId} 
                            onChange={(e) => setFilterChannelId(e.target.value)}
                            className="p-2 border rounded-lg text-sm bg-white"
                        >
                            <option value="">All Channels</option>
                            {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                        </select>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="p-2 border rounded-lg text-sm w-full md:w-auto" 
                            />
                            <span className="text-slate-400">-</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                className="p-2 border rounded-lg text-sm w-full md:w-auto" 
                            />
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setDateRange('thisMonth')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md font-medium text-slate-600">This Month</button>
                            <button onClick={() => setDateRange('thisYear')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md font-medium text-slate-600">This Year</button>
                        </div>

                        <button onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setFilterChannelId(''); }} className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap px-2">Clear</button>
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 pb-8">
                        {/* Summary Cards */}
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
                                <p className="text-[10px] text-slate-400">per 1k views</p>
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

                        {/* Yearly Performance Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-700">Yearly Performance</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Year</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Views</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Subs</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Avg CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {yearStats.map((stat) => (
                                            <tr key={stat.year} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-sm font-bold text-slate-800">{stat.year}</td>
                                                <td className="px-4 py-3 text-right text-sm font-medium text-green-600">{formatCurrency(stat.revenue)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(stat.views)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(stat.subs)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{stat.avgCtr.toFixed(2)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Visual Chart - Revenue by Publish Date */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="mb-4">
                                <h3 className="font-bold text-slate-700">Revenue by Publish Month</h3>
                                <p className="text-xs text-slate-500">Cumulative estimated revenue for videos published in each month.</p>
                            </div>
                            <SimpleBarChart data={revenueByMonth} color="bg-red-500" />
                        </div>

                        {/* Top Videos Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h3 className="font-bold text-slate-700">Top Performing Videos</h3>
                                <div className="flex gap-2">
                                    {['estimatedRevenue', 'views', 'subscribersGained', 'watchTimeHours'].map(key => (
                                        <button 
                                            key={key}
                                            onClick={() => setProductSortKey(key as any)}
                                            className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors ${productSortKey === key ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            {key.replace('estimatedRevenue', 'Revenue').replace('subscribersGained', 'Subs').replace('watchTimeHours', 'Watch Time')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Video</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Views</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Subs</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {topVideos.map((video) => (
                                            <tr key={video.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-medium text-slate-800 line-clamp-1" title={video.videoTitle}>{video.videoTitle}</div>
                                                    <span className="text-xs text-slate-400">{video.publishDate}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(video.views)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(video.subscribersGained)}</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-green-600">{formatCurrency(video.estimatedRevenue)}</td>
                                            </tr>
                                        ))}
                                        {topVideos.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">No data available.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4 h-full flex flex-col">
                        
                        {/* Summary Bar for Data Table */}
                        <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center justify-between text-sm text-red-900">
                            <span>Showing <strong>{displayMetrics.length}</strong> records</span>
                            <span className="font-bold">Total Revenue: {formatCurrency(summary.totalRevenue)}</span>
                        </div>

                        {/* Delete All Button */}
                        <div className="flex justify-end">
                             <button 
                                onClick={handleDeleteAll} 
                                className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 px-3 py-1 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
                            >
                                <DeleteIcon className="w-3 h-3" /> Delete All Data
                            </button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden relative">
                            <div className="overflow-auto flex-grow">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 w-10 bg-slate-50">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.size === displayMetrics.length && displayMetrics.length > 0}
                                                    onChange={() => {
                                                        if (selectedIds.size === displayMetrics.length) setSelectedIds(new Set());
                                                        else setSelectedIds(new Set(displayMetrics.map(m => m.id)));
                                                    }}
                                                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                                />
                                            </th>
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
                                            <tr key={m.id} className={selectedIds.has(m.id) ? "bg-red-50" : "hover:bg-slate-50 transition-colors"}>
                                                <td className="px-4 py-2 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedIds.has(m.id)} 
                                                        onChange={() => handleToggleSelection(m.id)}
                                                        className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">
                                                    {m.publishDate}
                                                    {m.channelId && <div className="text-xs text-indigo-600">{channelMap.get(m.channelId)}</div>}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-800">
                                                    <div className="line-clamp-1 max-w-md" title={m.videoTitle}>{m.videoTitle}</div>
                                                </td>
                                                <td className="px-4 py-2 text-right text-sm text-slate-600">{formatNumber(m.views)}</td>
                                                <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.estimatedRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className="border-t border-slate-200 p-3 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3 sticky bottom-0 z-20">
                                    <div className="text-sm text-slate-600">{startIndex + 1}-{Math.min(startIndex + rowsPerPage, displayMetrics.length)} of {displayMetrics.length}</div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronLeftIcon className="w-5 h-5 text-slate-600" /></button>
                                        <span className="text-sm font-medium text-slate-700">Page {currentPage}</span>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronRightIcon className="w-5 h-5 text-slate-600" /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="h-full space-y-6">
                        
                        {/* 1. Configuration & Upload */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            
                            {/* Upload Area */}
                            <div className="space-y-4">
                                <div className="flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-300 p-8">
                                    <div className="bg-red-50 p-4 rounded-full mb-4"><CloudArrowUpIcon className="w-8 h-8 text-red-500" /></div>
                                    <h3 className="text-xl font-bold text-slate-700 mb-2">Select CSV File</h3>
                                    <input type="file" ref={fileInputRef} accept=".csv,.tsv" onChange={handleFileUpload} className="hidden" />
                                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-300 transition-colors">
                                        {isUploading ? 'Parsing...' : 'Choose File'}
                                    </button>
                                </div>

                                {/* Context Selectors */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                                    <h4 className="font-bold text-slate-700 border-b pb-2">Import Context</h4>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">YouTube Channel <span className="text-red-500">*</span></label>
                                        <div className="flex gap-2">
                                            <select 
                                                value={uploadChannelId} 
                                                onChange={(e) => setUploadChannelId(e.target.value)} 
                                                className="w-full p-2 border rounded-md text-sm"
                                            >
                                                <option value="">Select Channel...</option>
                                                {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                            </select>
                                            <button onClick={() => setIsManageChannelsOpen(true)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded border text-slate-600" title="Manage Channels">
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {channels.length === 0 && <p className="text-xs text-red-500 mt-1">Please add a channel to continue.</p>}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year (Optional)</label>
                                        <select 
                                            value={uploadYear} 
                                            onChange={(e) => setUploadYear(e.target.value)} 
                                            className="w-full p-2 border rounded-md text-sm"
                                        >
                                            <option value="">Auto-Detect from File</option>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <ExternalLinkIcon className="w-5 h-5 text-indigo-600" />
                                    How to Export
                                </h3>
                                <p className="text-sm text-slate-600 mb-2">Follow these exact steps:</p>
                                <ol className="space-y-3 list-decimal list-inside text-sm text-slate-600 font-medium">
                                    <li>Go to <a href="https://studio.youtube.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">YouTube Studio</a>.</li>
                                    <li>Click <strong>Analytics</strong> in the left sidebar.</li>
                                    <li>Click <strong>Advanced Mode</strong> (top right).</li>
                                    <li>Select the <strong>Year</strong> in the date dropdown (top right).</li>
                                    <li>Click <strong>Export current view</strong> (top right) and choose <strong>Comma-separated values (.csv)</strong>.</li>
                                    <li>Upload that file here.</li>
                                </ol>
                            </div>
                        </div>

                        {/* Preview Area */}
                        {previewMetrics.length > 0 && (
                            <div className="flex flex-col space-y-4 pt-4 border-t">
                                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex flex-col gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-red-100 rounded-full text-red-600"><CheckCircleIcon className="w-6 h-6" /></div>
                                        <div>
                                            <h3 className="font-bold text-red-900 text-lg">Ready to Import</h3>
                                            <p className="text-red-700 text-sm">Found <strong>{previewMetrics.length}</strong> records.</p>
                                            {uploadYear && <p className="text-xs text-red-600 mt-1 font-bold">Detected/Selected Year: {uploadYear}</p>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full pt-2 border-t border-red-200/50">
                                        <div>
                                            <p className="text-xs font-bold text-red-800 uppercase opacity-70">Total Revenue</p>
                                            <p className="text-lg font-bold text-red-900">{formatCurrency(previewSummary.revenue)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-red-800 uppercase opacity-70">Total Views</p>
                                            <p className="text-lg font-bold text-red-900">{formatNumber(previewSummary.views)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-red-800 uppercase opacity-70">Subscribers</p>
                                            <p className="text-lg font-bold text-red-900">{formatNumber(previewSummary.subs)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-red-800 uppercase opacity-70">Watch Time</p>
                                            <p className="text-lg font-bold text-red-900">{formatNumber(previewSummary.watchTime)} hrs</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col max-h-96">
                                    <div className="flex-1 overflow-auto">
                                        <table className="min-w-full divide-y divide-slate-200">
                                            <thead className="bg-white sticky top-0 shadow-sm">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Publish Date</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Views</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Subs</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {previewMetrics.slice(0, 1000).map(m => (
                                                    <tr key={m.id}>
                                                        <td className="px-4 py-2 text-xs text-slate-600">{m.publishDate}</td>
                                                        <td className="px-4 py-2 text-xs text-slate-800 truncate max-w-xs">{m.videoTitle}</td>
                                                        <td className="px-4 py-2 text-xs text-right text-slate-600">{formatNumber(m.views)}</td>
                                                        <td className="px-4 py-2 text-xs text-right text-slate-600">{formatNumber(m.subscribersGained)}</td>
                                                        <td className="px-4 py-2 text-xs text-right font-medium text-green-600">{formatCurrency(m.estimatedRevenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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

            {selectedIds.size > 0 && activeTab === 'data' && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-slide-up">
                    <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                        <span className="font-medium text-sm">{selectedIds.size} selected</span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"><CloseIcon className="w-4 h-4" /></button>
                    </div>
                    <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 rounded-full transition-colors shadow-sm"><DeleteIcon className="w-4 h-4"/> Delete Selected</button>
                </div>
            )}

            <ManageChannelsModal 
                isOpen={isManageChannelsOpen}
                onClose={() => setIsManageChannelsOpen(false)}
                channels={channels}
                onSave={onSaveChannel}
                onDelete={onDeleteChannel}
            />
        </div>
    );
};

export default YouTubeIntegration;
