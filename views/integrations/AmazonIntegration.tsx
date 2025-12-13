



import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { AmazonMetric, AmazonReportType } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon } from '../../components/Icons';
import { parseAmazonReport } from '../../services/csvParserService';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
}

// A custom hook to debounce a value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// Helper for currency
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<AmazonMetric[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Filtering & Sorting State ---
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterTrackingId, setFilterTrackingId] = useState('');
    
    // Data Table Sorting
    const [sortKey, setSortKey] = useState<keyof AmazonMetric>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    
    // Top Products Sorting (Dashboard)
    const [productSortKey, setProductSortKey] = useState<'revenue' | 'clicks' | 'orderedItems' | 'conversionRate'>('revenue');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Unique Tracking IDs for filter
    const trackingIds = useMemo(() => {
        const ids = new Set<string>();
        metrics.forEach(m => {
            if (m.trackingId) ids.add(m.trackingId);
        });
        return Array.from(ids).sort();
    }, [metrics]);

    // Title Sync Logic (Memoized)
    const enrichedMetrics = useMemo(() => {
        const titleMap = new Map<string, string>();
        
        // Pass 1: Gather Titles
        metrics.forEach(m => {
            if (m.asin && m.title && !m.title.startsWith('Unknown Product') && m.reportType !== 'creator_connections') {
                const existing = titleMap.get(m.asin);
                if (!existing || m.title.length > existing.length) {
                    titleMap.set(m.asin, m.title);
                }
            }
        });

        // Pass 2: Enrich
        return metrics.map(m => {
            if (titleMap.has(m.asin) && (m.title.startsWith('Unknown Product') || m.reportType === 'creator_connections')) {
                return { ...m, title: titleMap.get(m.asin)! };
            }
            return m;
        });
    }, [metrics]);

    // Derived State: Filtered & Sorted Metrics for Display
    const displayMetrics = useMemo(() => {
        let result = enrichedMetrics;

        // 1. Filter by Search (Title or ASIN)
        if (debouncedSearchTerm) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            result = result.filter(m => 
                (m.title && m.title.toLowerCase().includes(lowerSearch)) || 
                (m.asin && m.asin.toLowerCase().includes(lowerSearch))
            );
        }

        // 2. Filter by Date
        if (startDate) {
            result = result.filter(m => m.date >= startDate);
        }
        if (endDate) {
            result = result.filter(m => m.date <= endDate);
        }

        // 3. Filter by Tracking ID
        if (filterTrackingId) {
            result = result.filter(m => m.trackingId === filterTrackingId);
        }

        // 4. Sort
        result.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];

            // Handle undefined/null values for optional fields
            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            // Handle strings vs numbers
            if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [enrichedMetrics, debouncedSearchTerm, startDate, endDate, filterTrackingId, sortKey, sortDirection]);

    // Pagination Logic
    const totalPages = Math.ceil(displayMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = displayMetrics.slice(startIndex, startIndex + rowsPerPage);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, startDate, endDate, filterTrackingId, rowsPerPage]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const newMetrics = await parseAmazonReport(file, (msg) => console.log(msg));
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
        if (previewMetrics.length > 0) {
            onAddMetrics(previewMetrics);
            setPreviewMetrics([]);
            alert(`Successfully imported ${previewMetrics.length} records.`);
            setActiveTab('dashboard');
        }
    };

    const cancelImport = () => {
        setPreviewMetrics([]);
    };

    // --- Deletion Handlers ---
    const handleToggleSelectAll = () => {
        if (selectedIds.size === displayMetrics.length && displayMetrics.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayMetrics.map(m => m.id)));
        }
    };

    const handleToggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Permanently delete ${selectedIds.size} records?`)) {
            onDeleteMetrics(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const handleDeleteAll = () => {
        if (window.confirm("WARNING: This will delete ALL Amazon Integration data. Are you sure?")) {
            const allIds = enrichedMetrics.map(m => m.id);
            onDeleteMetrics(allIds);
            setSelectedIds(new Set());
        }
    };

    // --- Header Sort Handler ---
    const handleHeaderClick = (key: keyof AmazonMetric) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc'); 
        }
    };

    const getSortIcon = (key: keyof AmazonMetric) => {
        if (sortKey !== key) return <SortIcon className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortDirection === 'asc' ? <SortIcon className="w-4 h-4 text-indigo-600 transform rotate-180" /> : <SortIcon className="w-4 h-4 text-indigo-600" />;
    };

    // --- aggregations (Global or Filtered) ---
    const summary = useMemo(() => {
        const result = {
            totalRevenue: 0,
            totalClicks: 0,
            totalOrdered: 0,
            avgConversion: 0,
            byType: {
                onsite: 0,
                offsite: 0,
                creator_connections: 0,
                unknown: 0
            } as Record<AmazonReportType, number>
        };

        displayMetrics.forEach(m => {
            result.totalRevenue += m.revenue;
            result.totalClicks += m.clicks;
            result.totalOrdered += m.orderedItems;
            
            if (result.byType[m.reportType] !== undefined) {
                result.byType[m.reportType] += m.revenue;
            }
        });

        result.avgConversion = result.totalClicks > 0 ? (result.totalOrdered / result.totalClicks) * 100 : 0;
        return result;
    }, [displayMetrics]);

    const topProducts = useMemo(() => {
        const productMap = new Map<string, { title: string, revenue: number, clicks: number, ordered: number }>();
        
        displayMetrics.forEach(m => {
            if (!productMap.has(m.asin)) {
                productMap.set(m.asin, { title: m.title, revenue: 0, clicks: 0, ordered: 0 });
            }
            const prod = productMap.get(m.asin)!;
            prod.revenue += m.revenue;
            prod.clicks += m.clicks;
            prod.ordered += m.orderedItems;
        });

        return Array.from(productMap.entries())
            .map(([asin, data]) => ({ 
                asin, 
                ...data,
                conversionRate: data.clicks > 0 ? (data.ordered / data.clicks) * 100 : 0
            }))
            .sort((a, b) => {
                if (productSortKey === 'revenue') return b.revenue - a.revenue;
                if (productSortKey === 'clicks') return b.clicks - a.clicks;
                if (productSortKey === 'orderedItems') return b.ordered - a.ordered;
                if (productSortKey === 'conversionRate') return b.conversionRate - a.conversionRate;
                return b.revenue - a.revenue;
            })
            .slice(0, 10);
    }, [displayMetrics, productSortKey]);

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

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BoxIcon className="w-8 h-8 text-orange-500" />
                        Amazon Associates
                    </h1>
                    <p className="text-slate-500">Track clicks, commissions, and top performing ASINs.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button 
                        onClick={() => setActiveTab('dashboard')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BarChartIcon className="w-4 h-4"/> Dashboard
                    </button>
                    <button 
                        onClick={() => setActiveTab('data')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <TableIcon className="w-4 h-4"/> Data
                    </button>
                    <button 
                        onClick={() => setActiveTab('upload')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CloudArrowUpIcon className="w-4 h-4"/> Upload
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4 relative">
                
                {/* GLOBAL FILTERS (Apply to Dashboard and Data) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4 flex-shrink-0 mb-6">
                    <div className="relative flex-grow w-full md:w-auto">
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search Title or ASIN..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                    
                    {/* Tracking ID Filter */}
                    <select 
                        value={filterTrackingId} 
                        onChange={(e) => setFilterTrackingId(e.target.value)}
                        className="p-2 border rounded-lg text-sm bg-white"
                    >
                        <option value="">All Tracking IDs</option>
                        {trackingIds.map(id => <option key={id} value={id}>{id}</option>)}
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

                    <button 
                        onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setFilterTrackingId(''); }} 
                        className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap px-2"
                    >
                        Clear
                    </button>
                </div>

                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Earnings</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalRevenue)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Clicks</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalClicks)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Items Ordered</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalOrdered)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Conversion Rate</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{summary.avgConversion.toFixed(2)}%</p>
                            </div>
                        </div>

                        {/* Breakdown by Type */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
                                <p className="text-xs font-bold text-slate-400 uppercase">Onsite Earnings</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(summary.byType.onsite)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
                                <p className="text-xs font-bold text-slate-400 uppercase">Offsite Earnings</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(summary.byType.offsite)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-purple-500">
                                <p className="text-xs font-bold text-slate-400 uppercase">Creator Connections</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(summary.byType.creator_connections)}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h3 className="font-bold text-slate-700">Top Performing Products</h3>
                                <div className="flex gap-2">
                                    {['revenue', 'clicks', 'orderedItems', 'conversionRate'].map(key => (
                                        <button 
                                            key={key}
                                            onClick={() => setProductSortKey(key as any)}
                                            className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors ${productSortKey === key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            {key.replace('Items', '').replace('Rate', '')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Clicks</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ordered</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Conv. %</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Earnings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {topProducts.map((prod) => (
                                            <tr key={prod.asin} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-medium text-slate-800 line-clamp-1" title={prod.title}>{prod.title}</div>
                                                    <a 
                                                        href={`https://www.amazon.com/dp/${prod.asin}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-xs text-indigo-500 hover:text-indigo-700 font-mono flex items-center gap-1 mt-0.5"
                                                    >
                                                        {prod.asin} <ExternalLinkIcon className="w-3 h-3" />
                                                    </a>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(prod.clicks)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(prod.ordered)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{prod.conversionRate.toFixed(1)}%</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-green-600">{formatCurrency(prod.revenue)}</td>
                                            </tr>
                                        ))}
                                        {topProducts.length === 0 && (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">No data available.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* DATA TAB */}
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

                        {/* Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden relative">
                            <div className="overflow-auto flex-grow">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 w-10 bg-slate-50">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.size === displayMetrics.length && displayMetrics.length > 0} 
                                                    onChange={handleToggleSelectAll}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group"
                                                onClick={() => handleHeaderClick('date')}
                                            >
                                                <div className="flex items-center gap-1">Date {getSortIcon('date')}</div>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Source</th>
                                            <th 
                                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group"
                                                onClick={() => handleHeaderClick('title')}
                                            >
                                                <div className="flex items-center gap-1">ASIN / Title {getSortIcon('title')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group"
                                                onClick={() => handleHeaderClick('trackingId')}
                                            >
                                                <div className="flex items-center gap-1">Tracking ID {getSortIcon('trackingId')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group"
                                                onClick={() => handleHeaderClick('clicks')}
                                            >
                                                <div className="flex items-center justify-end gap-1">Clicks {getSortIcon('clicks')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group"
                                                onClick={() => handleHeaderClick('orderedItems')}
                                            >
                                                <div className="flex items-center justify-end gap-1">Ordered {getSortIcon('orderedItems')}</div>
                                            </th>
                                            <th 
                                                className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group"
                                                onClick={() => handleHeaderClick('revenue')}
                                            >
                                                <div className="flex items-center justify-end gap-1">Earnings {getSortIcon('revenue')}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {paginatedMetrics.map((m) => (
                                            <tr key={m.id} className={selectedIds.has(m.id) ? "bg-indigo-50" : "hover:bg-slate-50 transition-colors"}>
                                                <td className="px-4 py-2 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedIds.has(m.id)} 
                                                        onChange={() => handleToggleSelection(m.id)}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.date}</td>
                                                <td className="px-4 py-2 text-sm">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                                        m.reportType === 'onsite' ? 'bg-blue-100 text-blue-700' : 
                                                        m.reportType === 'offsite' ? 'bg-green-100 text-green-700' : 
                                                        'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {m.reportType.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-800">
                                                    <div className="line-clamp-1 max-w-md" title={m.title}>{m.title}</div>
                                                    <a 
                                                        href={`https://www.amazon.com/dp/${m.asin}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-xs text-indigo-500 hover:text-indigo-700 font-mono mr-2 flex items-center gap-1 mt-0.5"
                                                    >
                                                        {m.asin} <ExternalLinkIcon className="w-3 h-3" />
                                                    </a>
                                                    {m.campaignTitle && <span className="text-xs text-purple-600 bg-purple-50 px-1 rounded">{m.campaignTitle}</span>}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-600">{m.trackingId}</td>
                                                <td className="px-4 py-2 text-right text-sm text-slate-600">{m.clicks}</td>
                                                <td className="px-4 py-2 text-right text-sm text-slate-600">{m.orderedItems}</td>
                                                <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.revenue)}</td>
                                            </tr>
                                        ))}
                                        {paginatedMetrics.length === 0 && (
                                            <tr><td colSpan={8} className="p-12 text-center text-slate-400 italic">No data matches your filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="border-t border-slate-200 p-3 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3 sticky bottom-0 z-20">
                                    <div className="flex items-center text-sm text-slate-600">
                                        <span className="mr-2 hidden sm:inline">Rows per page:</span>
                                        <select 
                                            value={rowsPerPage} 
                                            onChange={(e) => {
                                                setRowsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="p-1 border rounded text-xs bg-white focus:ring-indigo-500 w-16"
                                        >
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                            <option value={500}>500</option>
                                        </select>
                                        <span className="mx-4 text-slate-400 hidden sm:inline">|</span>
                                        <span className="hidden sm:inline">
                                            {startIndex + 1}-{Math.min(startIndex + rowsPerPage, displayMetrics.length)} of {displayMetrics.length}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                        >
                                            <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
                                        </button>
                                        <span className="text-sm font-medium text-slate-700 min-w-[3rem] text-center">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button 
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                        >
                                            <ChevronRightIcon className="w-5 h-5 text-slate-600" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* UPLOAD TAB */}
                {activeTab === 'upload' && (
                    <div className="h-full">
                        {previewMetrics.length > 0 ? (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-start justify-between">
                                    <div className="flex gap-3">
                                        <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
                                            <CheckCircleIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-indigo-900 text-lg">Ready to Import</h3>
                                            <p className="text-indigo-700 text-sm">
                                                Found <strong>{previewMetrics.length}</strong> records totaling <strong>{formatCurrency(previewMetrics.reduce((sum, m) => sum + m.revenue, 0))}</strong> in revenue.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                    <div className="p-3 border-b bg-slate-50 text-xs font-bold text-slate-500 uppercase">Preview Data</div>
                                    <div className="flex-1 overflow-auto">
                                        <table className="min-w-full divide-y divide-slate-200">
                                            <thead className="bg-white sticky top-0 shadow-sm">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Source</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">ASIN / Title</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Rev</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {previewMetrics.slice(0, 50).map(m => (
                                                    <tr key={m.id}>
                                                        <td className="px-4 py-2 text-xs text-slate-600">{m.date}</td>
                                                        <td className="px-4 py-2 text-xs text-slate-600 capitalize">{m.reportType.replace('_', ' ')}</td>
                                                        <td className="px-4 py-2 text-xs text-slate-800">
                                                            <div className="truncate max-w-xs">{m.title}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{m.asin}</div>
                                                        </td>
                                                        <td className="px-4 py-2 text-xs text-right font-medium text-green-600">{formatCurrency(m.revenue)}</td>
                                                    </tr>
                                                ))}
                                                {previewMetrics.length > 50 && (
                                                    <tr><td colSpan={4} className="p-2 text-center text-xs text-slate-400 italic">...and {previewMetrics.length - 50} more rows</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button 
                                        onClick={cancelImport}
                                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={confirmImport}
                                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
                                    >
                                        Confirm Import
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border-2 border-dashed border-slate-300 p-12">
                                <div className="bg-orange-50 p-4 rounded-full mb-4">
                                    <CloudArrowUpIcon className="w-8 h-8 text-orange-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700 mb-2">Upload Amazon Report</h3>
                                <p className="text-slate-500 text-center max-w-md mb-6">
                                    Supports <strong>Standard Associates</strong> (Onsite/Offsite) and <strong>Creator Connections</strong> CSV exports.
                                </p>
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    accept=".csv,.tsv" 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-slate-300 transition-colors"
                                >
                                    {isUploading ? 'Parsing...' : 'Select CSV File'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

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

export default AmazonIntegration;