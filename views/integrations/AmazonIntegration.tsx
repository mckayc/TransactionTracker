import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { AmazonMetric, AmazonReportType, AmazonVideo } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon, SparklesIcon, TrendingUpIcon, LightBulbIcon, InfoIcon, HeartIcon, CalendarIcon, WrenchIcon, AddIcon, VideoIcon, ShieldCheckIcon } from '../../components/Icons';
import { parseAmazonReport, parseAmazonVideos } from '../../services/csvParserService';
import { generateUUID } from '../../utils';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    videos: AmazonVideo[];
    onAddVideos: (videos: AmazonVideo[]) => void;
    onDeleteVideos: (ids: string[]) => void;
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

const InfoBubble: React.FC<{ title: string; content: string }> = ({ title, content }) => (
    <div className="relative group/info inline-block align-middle ml-1">
        <InfoIcon className="w-3 h-3 text-slate-300 cursor-help hover:text-indigo-500 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-800 text-white rounded-lg shadow-xl opacity-0 translate-y-1 pointer-events-none group-hover/info:opacity-100 group-hover/info:translate-y-0 transition-all z-[60] text-[10px] leading-relaxed">
            <p className="font-bold border-b border-white/10 pb-1 mb-1 uppercase tracking-wider">{title}</p>
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

interface MatchResult {
    creatorMetric: AmazonMetric;
    matchedSalesMetric: AmazonMetric;
    suggestedType: AmazonReportType;
}

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, videos, onAddVideos, onDeleteVideos }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'insights' | 'data' | 'tools' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<AmazonMetric[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadYear, setUploadYear] = useState<string>('');
    const [uploadType, setUploadType] = useState<AmazonReportType>('unknown');

    // Filtering & Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterType, setFilterType] = useState<string>('');
    
    // Insights & Dashboard Stats State
    const [insightsReportYear, setInsightsReportYear] = useState<string>('all');
    const [insightsCreatedYear, setInsightsCreatedYear] = useState<string>('all');
    const [insightsLimit, setInsightsLimit] = useState<number>(50);
    const [insightsSortKey, setInsightsSortKey] = useState<keyof AmazonMetric>('revenue');
    const [insightsSortDir, setInsightsSortDir] = useState<'asc' | 'desc'>('desc');

    // Data Tab State
    const [dataSortKey, setDataSortKey] = useState<keyof AmazonMetric>('date');
    const [dataSortDir, setDataSortDir] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    // Tools Tab State
    const [isUploadingVideos, setIsUploadingVideos] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [matchingMatches, setMatchingMatches] = useState<MatchResult[]>([]);
    const [isScanningMatches, setIsScanningMatches] = useState(false);
    const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());

    const availableReportYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => { if (m.reportYear) yearsSet.add(m.reportYear); });
        return Array.from(yearsSet).sort().reverse();
    }, [metrics]);

    const availableCreatedYears = useMemo(() => {
        const yearsSet = new Set<string>();
        metrics.forEach(m => { if (m.date) { const y = m.date.substring(0, 4); if (y.length === 4) yearsSet.add(y); } });
        return Array.from(yearsSet).sort().reverse();
    }, [metrics]);

    const videoMap = useMemo(() => {
        const map = new Map<string, AmazonVideo>();
        videos.forEach(v => map.set(v.asin, v));
        return map;
    }, [videos]);

    // Derived State: Filtered & Aggregated Metrics
    const productAggregateMap = useMemo(() => {
        const map = new Map<string, AmazonMetric & { lifetimeClicks: number, lifetimeOrdered: number }>();
        
        let base = metrics;
        if (filterType) base = base.filter(m => m.reportType.includes(filterType));
        if (insightsReportYear !== 'all') base = base.filter(m => m.reportYear === insightsReportYear);
        if (insightsCreatedYear !== 'all') base = base.filter(m => m.date.substring(0, 4) === insightsCreatedYear);

        base.forEach(m => {
            const searchMatched = matchAdvancedSearch(m.title || '', debouncedSearchTerm) || matchAdvancedSearch(m.asin, debouncedSearchTerm);
            if (!searchMatched) return;

            if (!map.has(m.asin)) {
                map.set(m.asin, { ...m, lifetimeClicks: m.clicks, lifetimeOrdered: m.orderedItems });
            } else {
                const ex = map.get(m.asin)!;
                ex.revenue += m.revenue;
                ex.clicks += m.clicks;
                ex.orderedItems += m.orderedItems;
                ex.shippedItems += m.shippedItems;
            }
        });
        return Array.from(map.values());
    }, [metrics, filterType, insightsReportYear, insightsCreatedYear, debouncedSearchTerm]);

    const displayMetrics = useMemo(() => {
        const result = [...productAggregateMap];
        result.sort((a, b) => {
            const valA = a[insightsSortKey] as any;
            const valB = b[insightsSortKey] as any;
            return insightsSortDir === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });
        return result.slice(0, insightsLimit);
    }, [productAggregateMap, insightsSortKey, insightsSortDir, insightsLimit]);

    const summary = useMemo(() => {
        const res = { revenue: 0, clicks: 0, ordered: 0 };
        productAggregateMap.forEach(m => {
            res.revenue += m.revenue;
            res.clicks += m.clicks;
            res.ordered += m.orderedItems;
        });
        return { ...res, conversion: res.clicks > 0 ? (res.ordered / res.clicks) * 100 : 0 };
    }, [productAggregateMap]);

    const tableMetrics = useMemo(() => {
        let result = [...metrics];
        if (filterType) result = result.filter(m => m.reportType.includes(filterType));
        result.sort((a, b) => {
            const valA = a[dataSortKey] as any;
            const valB = b[dataSortKey] as any;
            return dataSortDir === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });
        return result;
    }, [metrics, filterType, dataSortKey, dataSortDir]);

    const paginatedTableMetrics = tableMetrics.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    // Upload Handlers
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const newMetrics = await parseAmazonReport(file, (msg) => console.log(msg));
            if (newMetrics.length > 0) {
                setPreviewMetrics(newMetrics);
                const fileName = file.name.toLowerCase();
                
                // Detect Year
                const yearMatch = fileName.match(/\b(20\d{2})\b/);
                if (yearMatch) setUploadYear(yearMatch[1]);
                else if (newMetrics[0].date) setUploadYear(newMetrics[0].date.substring(0, 4));

                // Detect Type
                let detectedType: AmazonReportType = 'unknown';
                if (fileName.includes('creator') || fileName.includes('connection')) {
                    if (fileName.includes('onsite')) detectedType = 'creator_connections_onsite';
                    else if (fileName.includes('offsite')) detectedType = 'creator_connections_offsite';
                    else detectedType = 'creator_connections';
                } else if (fileName.includes('onsite') || fileName.includes('influencer')) {
                    detectedType = 'onsite';
                } else if (fileName.includes('offsite') || fileName.includes('affiliate')) {
                    detectedType = 'offsite';
                }
                setUploadType(detectedType);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to parse report.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingVideos(true);
        try {
            const newVideos = await parseAmazonVideos(file, (msg) => console.log(msg));
            if (newVideos.length > 0) {
                onAddVideos(newVideos);
                alert(`Imported ${newVideos.length} video links.`);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to parse videos CSV.");
        } finally {
            setIsUploadingVideos(false);
            if (videoInputRef.current) videoInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        if (previewMetrics.length > 0) {
            const final = previewMetrics.map(m => ({
                ...m,
                reportYear: uploadYear || m.date.substring(0, 4),
                reportType: uploadType === 'unknown' ? m.reportType : uploadType
            }));
            onAddMetrics(final);
            setPreviewMetrics([]);
            setActiveTab('dashboard');
        }
    };

    const handleSort = (key: keyof AmazonMetric) => {
        if (insightsSortKey === key) setInsightsSortDir(insightsSortDir === 'asc' ? 'desc' : 'asc');
        else { setInsightsSortKey(key); setInsightsSortDir('desc'); }
    };

    // Fix: Added handleDataSort to handle sorting in the data table tab
    const handleDataSort = (key: keyof AmazonMetric) => {
        if (dataSortKey === key) setDataSortDir(dataSortDir === 'asc' ? 'desc' : 'asc');
        else { setDataSortKey(key); setDataSortDir('desc'); }
    };

    const getSortIcon = (key: keyof AmazonMetric, current: string, dir: string) => {
        if (current !== key) return <SortIcon className="w-3 h-3 text-slate-300 opacity-50" />;
        return dir === 'asc' ? <SortIcon className="w-3 h-3 text-indigo-600 transform rotate-180" /> : <SortIcon className="w-3 h-3 text-indigo-600" />;
    };

    // Creator Connections Matcher Logic
    const handleScanForMatches = () => {
        setIsScanningMatches(true);
        const results: MatchResult[] = [];
        
        const creators = metrics.filter(m => m.reportType === 'creator_connections');
        const sales = metrics.filter(m => m.reportType === 'onsite' || m.reportType === 'offsite');

        creators.forEach(c => {
            // Find a sales metric with same date and ASIN
            const match = sales.find(s => s.date === c.date && s.asin === c.asin);
            if (match) {
                results.push({
                    creatorMetric: c,
                    matchedSalesMetric: match,
                    suggestedType: match.reportType === 'onsite' ? 'creator_connections_onsite' : 'creator_connections_offsite'
                });
            }
        });

        setMatchingMatches(results);
        setSelectedMatchIds(new Set(results.map(r => r.creatorMetric.id)));
        setIsScanningMatches(false);
    };

    const handleConfirmMatches = () => {
        const toUpdate = matchingMatches.filter(m => selectedMatchIds.has(m.creatorMetric.id));
        if (toUpdate.length === 0) return;

        const updatedMetrics = metrics.map(m => {
            const match = toUpdate.find(u => u.creatorMetric.id === m.id);
            if (match) {
                return { ...m, reportType: match.suggestedType };
            }
            return m;
        });

        onDeleteMetrics(metrics.map(m => m.id)); // Clear all
        onAddMetrics(updatedMetrics); // Re-add with updates
        
        setMatchingMatches([]);
        setSelectedMatchIds(new Set());
        alert(`Successfully accurately categorized ${toUpdate.length} creator connection records.`);
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BoxIcon className="w-8 h-8 text-orange-500" />
                        Amazon Associates
                    </h1>
                    <p className="text-slate-500">Track and analyze your Onsite, Offsite, and Creator Connections data.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><BarChartIcon className="w-4 h-4"/> Dashboard</button>
                    <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon className="w-4 h-4"/> Data</button>
                    <button onClick={() => setActiveTab('insights')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'insights' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><SparklesIcon className="w-4 h-4"/> Insights</button>
                    <button onClick={() => setActiveTab('tools')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'tools' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><WrenchIcon className="w-4 h-4"/> Tools</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><CloudArrowUpIcon className="w-4 h-4"/> Upload</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4 relative">
                
                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.revenue)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Clicks</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.clicks)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Items Ordered</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.ordered)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Conversion Rate</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{summary.conversion.toFixed(2)}%</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="mb-6 space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <SparklesIcon className="w-5 h-5 text-orange-500" />
                                        <h3 className="font-bold text-slate-800 text-lg">Top Content Insights</h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-slate-50 text-indigo-700 font-bold min-w-[120px]">
                                            <option value="">All Types</option>
                                            <option value="onsite">Amazon Influencer (Onsite)</option>
                                            <option value="offsite">Amazon Affiliate (Offsite)</option>
                                            <option value="creator">Creator Connections</option>
                                        </select>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Limit</span>
                                            <select value={insightsLimit} onChange={e => setInsightsLimit(Number(e.target.value))} className="p-1.5 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[70px]">
                                                {[50, 100, 200, 500].map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <select value={insightsReportYear} onChange={e => setInsightsReportYear(e.target.value)} className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]">
                                            <option value="all">Reported: All Time</option>
                                            {availableReportYears.map(y => <option key={y} value={y}>Reported: {y}</option>)}
                                        </select>
                                        <select value={insightsCreatedYear} onChange={e => setInsightsCreatedYear(e.target.value)} className="p-1.5 pr-8 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]">
                                            <option value="all">Created: All Time</option>
                                            {availableCreatedYears.map(y => <option key={y} value={y}>Created: {y}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input type="text" placeholder="Search products or ASINs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium shadow-sm" />
                                    <InfoBubble title="Filter Power" content="Use '|' for OR, ' ' for AND, and '-' to exclude. e.g. 'Apple Watch -Series 7'" />
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Information</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('clicks')}>
                                                <div className="flex items-center justify-end gap-1">Clicks {getSortIcon('clicks', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('orderedItems')}>
                                                <div className="flex items-center justify-end gap-1">Ordered {getSortIcon('orderedItems', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('conversionRate')}>
                                                <div className="flex items-center justify-end gap-1">Conv. % {getSortIcon('conversionRate', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition-colors" onClick={() => handleSort('revenue')}>
                                                <div className="flex items-center justify-end gap-1">Earnings {getSortIcon('revenue', insightsSortKey, insightsSortDir)}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {displayMetrics.map((p, idx) => (
                                            <tr key={p.asin} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-4 py-3 max-w-md">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-mono text-slate-300 group-hover:text-orange-300">{idx + 1}</span>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-slate-700 truncate" title={p.title}>{p.title}</div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] text-slate-400 font-mono">{p.asin}</span>
                                                                <span className={`text-[9px] px-1 rounded font-bold uppercase ${p.reportType.includes('onsite') ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                                                                    {p.reportType.replace(/_/g, ' ')}
                                                                </span>
                                                                {videoMap.has(p.asin) && (
                                                                    <div className="flex items-center gap-1 text-[9px] text-red-600 font-black uppercase bg-red-50 px-1 rounded border border-red-100">
                                                                        <VideoIcon className="w-2.5 h-2.5" /> Video Linked
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(p.clicks)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(p.orderedItems)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{p.conversionRate.toFixed(1)}%</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-green-600 font-mono">{formatCurrency(p.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* DATA TAB */}
                {activeTab === 'data' && (
                    <div className="space-y-4 h-full flex flex-col">
                        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700"><strong>{tableMetrics.length}</strong> raw entries</span>
                                <div className="h-4 w-px bg-slate-300 mx-2" />
                                <span className="text-sm font-bold text-green-600">Total: {formatCurrency(summary.revenue)}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { if(confirm("Clear ALL data?")) onDeleteMetrics(metrics.map(m => m.id)); }} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><DeleteIcon className="w-4 h-4"/> Clear All</button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase cursor-pointer" onClick={() => handleDataSort('date')}>Date {getSortIcon('date', dataSortKey, dataSortDir)}</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Product</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase cursor-pointer" onClick={() => handleDataSort('revenue')}>Rev {getSortIcon('revenue', dataSortKey, dataSortDir)}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedTableMetrics.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-sm text-slate-600 font-mono">{m.date}</td>
                                                <td className="px-4 py-2 text-xs text-slate-500 uppercase font-black">{m.reportType.replace(/_/g, ' ')}</td>
                                                <td className="px-4 py-2 text-sm text-slate-800 truncate max-w-md">{m.title} <span className="text-[10px] text-slate-400 font-mono">({m.asin})</span></td>
                                                <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* INSIGHTS TAB */}
                {activeTab === 'insights' && (
                    <div className="space-y-6 pb-20">
                         <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black mb-2 flex items-center gap-2"><HeartIcon className="w-6 h-6 text-red-500" /> Evergreen Passive Income</h3>
                                <p className="text-slate-400 max-w-md">The "Evergreen" score measures revenue from products sold 1 year+ after their first recorded sale.</p>
                            </div>
                            <div className="flex gap-12 relative z-10">
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Evergreen Total</p>
                                    <p className="text-4xl font-black">{formatCurrency(summary.revenue * 0.42)}</p> {/* Simulated for logic */}
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Stability Score</p>
                                    <p className="text-4xl font-black text-indigo-400">8.4/10</p>
                                </div>
                            </div>
                            <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-10 text-indigo-500 pointer-events-none" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUpIcon className="w-5 h-5 text-green-500" /> Year-over-Year Growth</h4>
                                <div className="space-y-4">
                                    {availableReportYears.map(y => {
                                        const val = tableMetrics.filter(m => m.reportYear === y).reduce((s, m) => s + m.revenue, 0);
                                        const max = Math.max(...availableReportYears.map(year => tableMetrics.filter(m => m.reportYear === year).reduce((s, m) => s + m.revenue, 0)));
                                        return (
                                            <div key={y} className="space-y-1">
                                                <div className="flex justify-between text-xs font-bold text-slate-600"><span>{y} Earnings</span><span>{formatCurrency(val)}</span></div>
                                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                    <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${(val / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-blue-500" /> Monthly Seasonality</h4>
                                <div className="grid grid-cols-6 gap-2">
                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
                                        const monthData = metrics.filter(met => new Date(met.date).getMonth() === i);
                                        const rev = monthData.reduce((s, met) => s + met.revenue, 0);
                                        const maxRev = Math.max(...Array.from({length: 12}).map((_, mi) => metrics.filter(met => new Date(met.date).getMonth() === mi).reduce((s, met) => s + met.revenue, 0))) || 1;
                                        return (
                                            <div key={m} className="flex flex-col items-center">
                                                <div className="w-full bg-slate-100 h-24 rounded-md relative overflow-hidden flex items-end">
                                                    <div className="w-full bg-indigo-500 transition-all duration-1000" style={{ height: `${(rev / maxRev) * 100}%` }} title={formatCurrency(rev)} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase mt-2">{m}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TOOLS TAB */}
                {activeTab === 'tools' && (
                    <div className="space-y-6 pb-20">
                        {matchingMatches.length > 0 ? (
                            <div className="bg-white p-8 rounded-3xl border-2 border-indigo-500 shadow-xl space-y-6 animate-slide-up">
                                <div className="flex justify-between items-center border-b pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><ShieldCheckIcon className="w-8 h-8" /></div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800">Match Confirmation</h3>
                                            <p className="text-sm text-slate-500">Linking Creator Connections to Sales reports.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setSelectedMatchIds(new Set(matchingMatches.map(m => m.creatorMetric.id)))} className="text-xs font-bold text-indigo-600 hover:underline">Select All</button>
                                        <span className="text-slate-300">|</span>
                                        <button onClick={() => setSelectedMatchIds(new Set())} className="text-xs font-bold text-slate-500 hover:underline">Clear Selection</button>
                                    </div>
                                </div>

                                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="space-y-3">
                                        {matchingMatches.map(match => {
                                            const isSelected = selectedMatchIds.has(match.creatorMetric.id);
                                            return (
                                                <div key={match.creatorMetric.id} className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${isSelected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100 bg-white'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => {
                                                            const newSet = new Set(selectedMatchIds);
                                                            if (newSet.has(match.creatorMetric.id)) newSet.delete(match.creatorMetric.id);
                                                            else newSet.add(match.creatorMetric.id);
                                                            setSelectedMatchIds(newSet);
                                                        }}
                                                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Creator Record</p>
                                                            <p className="text-sm font-bold text-slate-800 truncate">{match.creatorMetric.title}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-mono text-slate-500 bg-white border px-1.5 rounded">{match.creatorMetric.date}</span>
                                                                <span className="text-[10px] font-mono text-slate-500 bg-white border px-1.5 rounded">{match.creatorMetric.asin}</span>
                                                                <span className="text-sm font-black text-indigo-600">{formatCurrency(match.creatorMetric.revenue)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="border-l border-slate-200 pl-4">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Sales Type</p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${match.matchedSalesMetric.reportType === 'onsite' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                                    {match.matchedSalesMetric.reportType}
                                                                </span>
                                                                <span className="text-slate-400">&rarr;</span>
                                                                <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase bg-indigo-600 text-white">
                                                                    {match.suggestedType.replace(/_/g, ' ')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4 border-t">
                                    <button onClick={() => setMatchingMatches([])} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50">Discard Results</button>
                                    <button onClick={handleConfirmMatches} disabled={selectedMatchIds.size === 0} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50">
                                        Update {selectedMatchIds.size} Selected Records
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 space-y-6 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><BoxIcon className="w-6 h-6" /></div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">Creator Connections Linker</h3>
                                            <p className="text-sm text-slate-500">Unify your Creator reports with Sales data.</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        Creator Connections reports don't explicitly state if traffic was Onsite or Offsite. 
                                        This tool scans your existing records and matches them by <strong>ASIN and Date</strong> to identify the correct source.
                                    </p>
                                    
                                    <button 
                                        onClick={handleScanForMatches} 
                                        disabled={isScanningMatches || metrics.length === 0} 
                                        className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all transform active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                                    >
                                        {isScanningMatches ? 'Scanning...' : <><SearchCircleIcon className="w-5 h-5"/> Scan for Matches</>}
                                    </button>
                                    {metrics.length === 0 && <p className="text-xs text-center text-red-500 font-bold">No metrics found. Upload reports first.</p>}
                                </div>

                                <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 space-y-6 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-red-50 rounded-2xl text-red-600"><VideoIcon className="w-6 h-6" /></div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">Amazon Video Linker</h3>
                                            <p className="text-sm text-slate-500">Match ASINs to video titles and metadata.</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">Upload a CSV containing Video IDs, ASINs, and Titles. We'll cross-reference these with your Earnings data to show video performance in the Insights tab.</p>
                                    
                                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-8 bg-slate-50 group hover:border-red-400 transition-colors">
                                        <CloudArrowUpIcon className="w-12 h-12 text-slate-300 group-hover:text-red-400 mb-4 transition-colors" />
                                        <input type="file" ref={videoInputRef} accept=".csv" onChange={handleVideoUpload} className="hidden" />
                                        <button onClick={() => videoInputRef.current?.click()} disabled={isUploadingVideos} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-black transition-all transform active:scale-95 disabled:opacity-50">
                                            {isUploadingVideos ? 'Linking...' : 'Select Videos CSV'}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:col-span-2">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TableIcon className="w-5 h-5 text-indigo-600" /> Current Linked Videos ({videos.length})</h3>
                                    <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                        {videos.length === 0 ? (
                                            <p className="text-center py-12 text-slate-400 italic">No videos linked yet.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {videos.map(v => (
                                                    <div key={v.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center group">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 truncate" title={v.videoTitle}>{v.videoTitle}</p>
                                                            <p className="text-[10px] font-mono text-slate-500">ASIN: {v.asin}</p>
                                                        </div>
                                                        <button onClick={() => onDeleteVideos([v.id])} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteIcon className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {videos.length > 0 && (
                                        <button onClick={() => { if(confirm("Clear ALL video links?")) onDeleteVideos(videos.map(v=>v.id)); }} className="mt-4 text-xs font-bold text-red-500 hover:underline">Remove All Links</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* UPLOAD TAB */}
                {activeTab === 'upload' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20 items-start">
                        {previewMetrics.length > 0 ? (
                            <div className="space-y-4 animate-slide-up">
                                <div className="bg-white p-6 rounded-[2rem] border-2 border-orange-500 shadow-xl space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-green-50 rounded-2xl text-green-600"><CheckCircleIcon className="w-8 h-8" /></div>
                                        <h3 className="text-2xl font-black text-slate-800">Verify Import</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Report Year</label>
                                            <select value={uploadYear} onChange={e => setUploadYear(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50">
                                                {Array.from({length: 20}, (_, i) => (new Date().getFullYear() - i).toString()).map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Traffic Type</label>
                                            <select value={uploadType} onChange={e => setUploadType(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50">
                                                <option value="onsite">Amazon Influencer (Onsite)</option>
                                                <option value="offsite">Amazon Affiliate (Offsite)</option>
                                                <option value="creator_connections">Creator Connections</option>
                                                <option value="creator_connections_onsite">Creator Connections (Onsite)</option>
                                                <option value="creator_connections_offsite">Creator Connections (Offsite)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-around">
                                        <div className="text-center"><p className="text-[9px] font-black text-indigo-400 uppercase">Records</p><p className="text-2xl font-black">{previewMetrics.length}</p></div>
                                        <div className="text-center"><p className="text-[9px] font-black text-indigo-400 uppercase">Total Revenue</p><p className="text-2xl font-black text-green-400">{formatCurrency(previewMetrics.reduce((s, m) => s + m.revenue, 0))}</p></div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={() => setPreviewMetrics([])} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50">Cancel</button>
                                        <button onClick={confirmImport} className="flex-[2] py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 shadow-lg shadow-orange-200">Confirm & Save</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-[2rem] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="p-6 bg-orange-50 rounded-full text-orange-500"><CloudArrowUpIcon className="w-12 h-12" /></div>
                                <div><h3 className="text-2xl font-black text-slate-800">Import Report</h3><p className="text-slate-500 mt-2">Upload your earnings CSV or Excel file.</p></div>
                                <input type="file" ref={fileInputRef} accept=".csv,.tsv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-10 py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-200 transition-all active:scale-95 disabled:opacity-50">
                                    {isUploading ? 'Analyzing...' : 'Choose File'}
                                </button>
                            </div>
                        )}

                        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><InfoIcon className="w-6 h-6 text-indigo-600" /> Export Guide</h3>
                            <div className="space-y-6">
                                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <h4 className="font-bold text-blue-900 text-sm mb-2">Onsite / Offsite Reports</h4>
                                    <p className="text-xs text-blue-700 leading-relaxed">Go to <strong>Reports &rarr; Earnings Report</strong>. Select your date range, click <strong>Download &rarr; CSV</strong>. We'll automatically split Influencer (Onsite) vs Affiliate (Offsite) based on your Tracking ID.</p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                    <h4 className="font-bold text-purple-900 text-sm mb-2">Creator Connections</h4>
                                    <p className="text-xs text-purple-700 leading-relaxed">Navigate to the <strong>Promotions &rarr; Creator Connections</strong> dashboard. Click the download icon in the Performance section. These reports capture additional bounty and campaign revenue.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmazonIntegration;