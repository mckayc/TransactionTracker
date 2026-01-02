import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { AmazonMetric, AmazonReportType, AmazonVideo } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, SearchCircleIcon, ExternalLinkIcon, SparklesIcon, TrendingUpIcon, LightBulbIcon, InfoIcon, HeartIcon, CalendarIcon, WrenchIcon, AddIcon, VideoIcon, ShieldCheckIcon } from '../../components/Icons';
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

const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/&#39;/g, "'").replace(/[^a-z0-9]/g, '').trim();

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

// Helper for multi-title hierarchy and hover
const MultiTitleDisplay: React.FC<{ metric: AmazonMetric }> = ({ metric }) => {
    const titles = useMemo(() => {
        const list: { type: string, value: string }[] = [];
        
        if (metric.reportType.includes('onsite')) {
            if (metric.title) list.push({ type: 'Product', value: metric.title });
            if (metric.videoTitle) list.push({ type: 'Video', value: metric.videoTitle });
            if (metric.campaignTitle) list.push({ type: 'CC Campaign', value: metric.campaignTitle });
        } else {
            if (metric.videoTitle) list.push({ type: 'Video', value: metric.videoTitle });
            if (metric.title) list.push({ type: 'Product', value: metric.title });
            if (metric.campaignTitle) list.push({ type: 'CC Campaign', value: metric.campaignTitle });
        }
        
        // Ensure unique values
        const seen = new Set<string>();
        return list.filter(item => {
            const val = item.value.trim();
            if (!val || seen.has(val.toLowerCase())) return false;
            seen.add(val.toLowerCase());
            return true;
        });
    }, [metric]);

    if (titles.length === 0) return <span>Unknown Title</span>;

    const primary = titles[0];
    const alternates = titles.slice(1);

    return (
        <div className="relative group/titles flex flex-col min-w-0">
            <div className="text-sm font-bold text-slate-700 truncate cursor-help" title={primary.value}>
                {primary.value}
            </div>
            {alternates.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-72 p-4 bg-slate-900 text-white rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/titles:opacity-100 group-hover/titles:translate-y-0 transition-all z-[70]">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Alternative Titles</p>
                    <div className="space-y-3">
                        {alternates.map((alt, i) => (
                            <div key={i}>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{alt.type}</p>
                                <p className="text-xs font-medium text-slate-200">{alt.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-900"></div>
                </div>
            )}
        </div>
    );
};

interface MatchResult {
    creatorMetric: AmazonMetric;
    matchedSalesMetric: AmazonMetric;
    suggestedType: AmazonReportType;
}

interface VideoMatchResult {
    salesMetric: AmazonMetric;
    videoData: AmazonVideo;
}

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, videos, onAddVideos, onDeleteVideos }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'insights' | 'data' | 'tools' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<AmazonMetric[]>([]);
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
    const [dataCreatedYearFilter, setDataCreatedYearFilter] = useState<string>('all');
    const [isMergedAsins, setIsMergedAsins] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    // Tools Tab State
    const [isUploadingVideos, setIsUploadingVideos] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [matchingMatches, setMatchingMatches] = useState<MatchResult[]>([]);
    const [isScanningMatches, setIsScanningMatches] = useState(false);
    const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
    
    // Video Linker Specific State
    const [videoMatches, setVideoMatches] = useState<VideoMatchResult[]>([]);
    const [isScanningVideos, setIsScanningVideos] = useState(false);
    const [videoScanProgress, setVideoScanProgress] = useState<{ current: number; total: number } | null>(null);
    const [isVideoMatchModalOpen, setIsVideoMatchModalOpen] = useState(false);

    const [mergeProgress, setMergeProgress] = useState<{ current: number; total: number } | null>(null);

    // Helper for complex type filtering
    const matchesReportType = (metricType: string, selectedFilter: string) => {
        if (!selectedFilter) return true;
        if (selectedFilter === 'creator_connections') {
            return metricType === 'creator_connections' || 
                   metricType === 'creator_connections_onsite' || 
                   metricType === 'creator_connections_offsite';
        }
        return metricType === selectedFilter;
    };

    // PERFORMANCE FIX: Granular pass for report years
    const { availableReportYears, availableCreatedYears } = useMemo(() => {
        const reportYears = new Set<string>();
        const createdYears = new Set<string>();
        metrics.forEach(m => {
            if (m.reportYear) reportYears.add(m.reportYear);
            if (m.date) {
                const y = m.date.substring(0, 4);
                if (y.length === 4) createdYears.add(y);
            }
        });
        return {
            availableReportYears: Array.from(reportYears).sort().reverse(),
            availableCreatedYears: Array.from(createdYears).sort().reverse()
        };
    }, [metrics]);

    const videoMap = useMemo(() => {
        const map = new Map<string, AmazonVideo>();
        videos.forEach(v => {
            if (v.asins) {
                v.asins.forEach(asin => map.set(asin, v));
            } else if (v.asin) {
                map.set(v.asin, v);
            }
        });
        return map;
    }, [videos]);

    // OPTIMIZED: Aggregated metrics for Dashboard and Insights
    const productAggregateMap = useMemo(() => {
        const map = new Map<string, AmazonMetric>();
        
        let base = metrics;
        if (filterType) base = base.filter(m => matchesReportType(m.reportType, filterType));
        if (insightsReportYear !== 'all') base = base.filter(m => m.reportYear === insightsReportYear);
        if (insightsCreatedYear !== 'all') base = base.filter(m => m.date.substring(0, 4) === insightsCreatedYear);

        base.forEach(m => {
            const searchMatched = matchAdvancedSearch(m.title || '', debouncedSearchTerm) || matchAdvancedSearch(m.asin, debouncedSearchTerm) || matchAdvancedSearch(m.videoTitle || '', debouncedSearchTerm);
            if (!searchMatched) return;

            if (!map.has(m.asin)) {
                map.set(m.asin, { ...m });
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

    // OPTIMIZATION: Single pass aggregator for Insights Tab
    const insightsAggregates = useMemo(() => {
        const yearBuckets: Record<string, number> = {};
        const monthBuckets: number[] = Array(12).fill(0);
        
        metrics.forEach(m => {
            // YoY Growth
            if (m.reportYear) {
                yearBuckets[m.reportYear] = (yearBuckets[m.reportYear] || 0) + m.revenue;
            }
            // Seasonality
            const date = new Date(m.date);
            if (!isNaN(date.getTime())) {
                monthBuckets[date.getMonth()] += m.revenue;
            }
        });

        return { 
            yearData: Object.entries(yearBuckets).sort((a, b) => b[0].localeCompare(a[0])),
            monthData: monthBuckets,
            maxMonth: Math.max(...monthBuckets, 1),
            maxYear: Math.max(...Object.values(yearBuckets), 1)
        };
    }, [metrics]);

    const tableMetrics = useMemo(() => {
        let result = [...metrics];
        if (filterType) result = result.filter(m => matchesReportType(m.reportType, filterType));
        if (dataCreatedYearFilter !== 'all') result = result.filter(m => m.date.startsWith(dataCreatedYearFilter));

        if (isMergedAsins) {
            const merged = new Map<string, AmazonMetric>();
            result.forEach(m => {
                const key = `${m.asin}_${m.reportType}`;
                if (!merged.has(key)) {
                    merged.set(key, { ...m });
                } else {
                    const ex = merged.get(key)!;
                    ex.revenue += m.revenue;
                    ex.clicks += m.clicks;
                    ex.orderedItems += m.orderedItems;
                    ex.shippedItems += m.shippedItems;
                }
            });
            result = Array.from(merged.values());
        }

        result.sort((a, b) => {
            const valA = a[dataSortKey] as any;
            const valB = b[dataSortKey] as any;
            if (typeof valA === 'string') {
                const cmp = valA.localeCompare(valB);
                return dataSortDir === 'asc' ? cmp : -cmp;
            }
            return dataSortDir === 'asc' ? valA - valB : valB - valA;
        });
        return result;
    }, [metrics, filterType, dataCreatedYearFilter, isMergedAsins, dataSortKey, dataSortDir]);

    const dataTabRevenue = useMemo(() => tableMetrics.reduce((sum, m) => sum + m.revenue, 0), [tableMetrics]);

    const paginatedTableMetrics = useMemo(() => {
        return tableMetrics.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    }, [tableMetrics, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(tableMetrics.length / rowsPerPage);

    // Reset pagination when filters change
    useEffect(() => { setCurrentPage(1); }, [filterType, dataCreatedYearFilter, rowsPerPage, isMergedAsins]);

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
                const yearMatch = fileName.match(/\b(20\d{2})\b/);
                if (yearMatch) setUploadYear(yearMatch[1]);
                else if (newMetrics[0].date) setUploadYear(newMetrics[0].date.substring(0, 4));

                let detectedType: AmazonReportType = 'unknown';
                if (fileName.includes('creator') || fileName.includes('connection')) {
                    if (fileName.includes('onsite')) detectedType = 'creator_connections_onsite';
                    else if (fileName.includes('offsite')) detectedType = 'creator_connections_offsite';
                    else detectedType = 'creator_connections';
                } else if (fileName.includes('onsite')) detectedType = 'onsite';
                else if (fileName.includes('offsite')) detectedType = 'offsite';
                setUploadType(detectedType);
            }
        } catch (error) { console.error(error); alert("Failed to parse report."); } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const confirmImport = () => {
        if (previewMetrics.length > 0) {
            const metricsWithMeta = previewMetrics.map(m => ({ 
                ...m, 
                reportYear: uploadYear || undefined, 
                reportType: uploadType !== 'unknown' ? uploadType : m.reportType 
            }));
            onAddMetrics(metricsWithMeta);
            setPreviewMetrics([]);
            setUploadYear('');
            setUploadType('unknown');
            alert(`Successfully imported ${previewMetrics.length} records.`);
            setActiveTab('dashboard');
        }
    };

    const handleVideoImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsScanningVideos(true);
        try {
            const importedVideos = await parseAmazonVideos(file, (msg) => console.log(msg));
            if (importedVideos.length === 0) {
                setIsScanningVideos(false);
                return;
            }

            // Perform chunked matching to keep UI responsive
            const totalVideos = importedVideos.length;
            setVideoScanProgress({ current: 0, total: totalVideos });
            
            const results: VideoMatchResult[] = [];
            const onsiteSales = metrics.filter(m => m.reportType === 'onsite');
            
            // Index sales for faster lookup
            const salesByAsin = new Map<string, AmazonMetric[]>();
            onsiteSales.forEach(s => {
                if (!salesByAsin.has(s.asin)) salesByAsin.set(s.asin, []);
                salesByAsin.get(s.asin)!.push(s);
            });

            // Process in chunks of 50
            const CHUNK_SIZE = 50;
            const processBatch = async (startIndex: number) => {
                const endIndex = Math.min(startIndex + CHUNK_SIZE, totalVideos);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const v = importedVideos[i];
                    let matchedSales: AmazonMetric[] = [];
                    
                    // Priority 1: Match by ASINs
                    if (v.asins && v.asins.length > 0) {
                        v.asins.forEach(asin => {
                            const found = salesByAsin.get(asin);
                            if (found) matchedSales = [...matchedSales, ...found];
                        });
                    }

                    // Priority 2: Match by Title (fuzzy)
                    if (matchedSales.length === 0) {
                        const normalizedVideoTitle = normalizeStr(v.videoTitle);
                        onsiteSales.forEach(s => {
                            if (normalizeStr(s.title) === normalizedVideoTitle) {
                                matchedSales.push(s);
                            }
                        });
                    }

                    // Dedup and create results
                    const uniqueMatchedSales = Array.from(new Set(matchedSales));
                    uniqueMatchedSales.forEach(s => {
                        results.push({
                            salesMetric: s,
                            videoData: v
                        });
                    });
                }

                setVideoScanProgress({ current: endIndex, total: totalVideos });

                if (endIndex < totalVideos) {
                    // Pause for a tiny bit to let browser breath
                    await new Promise(resolve => setTimeout(resolve, 1));
                    await processBatch(endIndex);
                } else {
                    // Done
                    setVideoMatches(results);
                    setIsVideoMatchModalOpen(true);
                    setIsScanningVideos(false);
                    setVideoScanProgress(null);
                }
            };

            await processBatch(0);

        } catch (error) {
            console.error(error);
            alert("Failed to parse videos. " + (error instanceof Error ? error.message : ""));
            setIsScanningVideos(false);
            setVideoScanProgress(null);
        } finally {
            if (videoInputRef.current) videoInputRef.current.value = '';
        }
    };

    const handleMergeVideos = async () => {
        if (videoMatches.length === 0) return;
        setIsVideoMatchModalOpen(false);
        const total = videoMatches.length;
        setMergeProgress({ current: 0, total });

        const updatedMetrics = [...metrics];
        const batchSize = 100;
        
        for (let i = 0; i < videoMatches.length; i += batchSize) {
            const chunk = videoMatches.slice(i, i + batchSize);
            chunk.forEach(match => {
                const index = updatedMetrics.findIndex(m => m.id === match.salesMetric.id);
                if (index !== -1) {
                    updatedMetrics[index] = { 
                        ...updatedMetrics[index], 
                        videoTitle: match.videoData.videoTitle,
                        videoDuration: match.videoData.duration,
                        videoUrl: match.videoData.videoUrl,
                        uploadDate: match.videoData.uploadDate
                    };
                }
            });
            setMergeProgress({ current: Math.min(i + batchSize, total), total });
            await new Promise(r => setTimeout(r, 30));
        }

        onDeleteMetrics(metrics.map(m => m.id));
        onAddMetrics(updatedMetrics);
        setMergeProgress(null);
        setVideoMatches([]);
        alert(`Successfully associated ${total} onsite sales records with video metadata.`);
    };

    const handleConfirmCCMatches = async () => {
        if (matchingMatches.length === 0) return;
        
        setIsMatchModalOpen(false);
        const total = matchingMatches.length;
        setMergeProgress({ current: 0, total });

        // Process in chunks to maintain UI responsiveness and simulate progress
        const updatedMetrics = [...metrics];
        const batchSize = 50;
        
        for (let i = 0; i < matchingMatches.length; i += batchSize) {
            const chunk = matchingMatches.slice(i, i + batchSize);
            chunk.forEach(match => {
                const index = updatedMetrics.findIndex(m => m.id === match.creatorMetric.id);
                if (index !== -1) {
                    updatedMetrics[index] = { ...updatedMetrics[index], reportType: match.suggestedType };
                }
            });
            
            setMergeProgress({ current: Math.min(i + batchSize, total), total });
            await new Promise(r => setTimeout(r, 50)); // Tiny delay for progress bar visibility
        }

        onDeleteMetrics(metrics.map(m => m.id));
        onAddMetrics(updatedMetrics);
        setMergeProgress(null);
        setMatchingMatches([]);
        alert(`Successfully accurately categorized ${total} creator connection records.`);
    };

    const handleSort = (key: keyof AmazonMetric) => {
        if (insightsSortKey === key) setInsightsSortDir(insightsSortDir === 'asc' ? 'desc' : 'asc');
        else { setInsightsSortKey(key); setInsightsSortDir('desc'); }
    };

    const handleDataSort = (key: keyof AmazonMetric) => {
        if (dataSortKey === key) setDataSortDir(dataSortDir === 'asc' ? 'desc' : 'asc');
        else { setDataSortKey(key); setDataSortDir('desc'); }
    };

    const getSortIcon = (key: keyof AmazonMetric, current: string, dir: string) => {
        if (current !== key) return <SortIcon className="w-3 h-3 text-slate-300 opacity-50" />;
        return dir === 'asc' ? <SortIcon className="w-3 h-3 text-indigo-600 transform rotate-180" /> : <SortIcon className="w-3 h-3 text-indigo-600" />;
    };

    // Creator Connections Matcher Logic
    const handleScanForMatches = async () => {
        setIsScanningMatches(true);
        
        // Wait for state to settle
        await new Promise(r => setTimeout(r, 100));

        const results: MatchResult[] = [];
        const creators = metrics.filter(m => m.reportType === 'creator_connections');
        const onsiteOffsiteSales = metrics.filter(m => m.reportType === 'onsite' || m.reportType === 'offsite');

        // Use lookup map for performance
        const salesLookup = new Map<string, AmazonMetric>();
        onsiteOffsiteSales.forEach(s => salesLookup.set(`${s.date}_${s.asin}`, s));

        // Processing in non-blocking batches
        const BATCH_SIZE = 200;
        for (let i = 0; i < creators.length; i += BATCH_SIZE) {
            const batch = creators.slice(i, i + BATCH_SIZE);
            batch.forEach(c => {
                const match = salesLookup.get(`${c.date}_${c.asin}`);
                if (match) {
                    results.push({ 
                        creatorMetric: c, 
                        matchedSalesMetric: match, 
                        suggestedType: match.reportType === 'onsite' ? 'creator_connections_onsite' : 'creator_connections_offsite' 
                    });
                }
            });
            // Yield back to browser
            await new Promise(r => setTimeout(r, 1));
        }

        setMatchingMatches(results);
        setIsScanningMatches(false);
        setIsMatchModalOpen(true);
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BoxIcon className="w-8 h-8 text-orange-500" /> Amazon Associates
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
                            <div className="mb-6">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <SparklesIcon className="w-5 h-5 text-orange-500" />
                                        <h3 className="font-bold text-slate-800 text-lg">Top Content Insights</h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="relative group">
                                            <select 
                                                value={filterType} 
                                                onChange={e => setFilterType(e.target.value)} 
                                                className="p-1.5 pr-8 border rounded-lg text-xs bg-white text-indigo-700 font-bold min-w-[150px] focus:ring-orange-500 outline-none appearance-none"
                                            >
                                                <option value="">All Types</option>
                                                <option value="onsite">Onsite</option>
                                                <option value="offsite">Offsite</option>
                                                <option value="creator_connections">Creator Connections</option>
                                                <option value="creator_connections_onsite">CC Onsite</option>
                                                <option value="creator_connections_offsite">CC Offsite</option>
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <ChevronDownIcon className="w-4 h-4 text-indigo-400" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LIMIT</span>
                                            <select value={insightsLimit} onChange={e => setInsightsLimit(Number(e.target.value))} className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold min-w-[65px] focus:ring-orange-500 outline-none">
                                                {[50, 100, 200, 500].map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <select value={insightsReportYear} onChange={e => setInsightsReportYear(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold min-w-[140px] focus:ring-orange-500 outline-none">
                                            <option value="all">Reported: All Time</option>
                                            {availableReportYears.map(y => <option key={y} value={y}>Reported: {y}</option>)}
                                        </select>
                                        <select value={insightsCreatedYear} onChange={e => setInsightsCreatedYear(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold min-w-[140px] focus:ring-orange-500 outline-none">
                                            <option value="all">Created: All Time</option>
                                            {availableCreatedYears.map(y => <option key={y} value={y}>Created: {y}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="relative mt-4">
                                    <input type="text" placeholder="Search products, ASINs, or videos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium shadow-sm" />
                                    <InfoBubble title="Filter Power" content="Use '|' for OR, ' ' for AND, and '-' to exclude. e.g. 'Apple Watch -Series 7'" />
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product / Video Information</th>
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
                                                            <MultiTitleDisplay metric={p} />
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] text-slate-400 font-mono">{p.asin}</span>
                                                                <span className={`text-[9px] px-1 rounded font-bold uppercase ${p.reportType.includes('onsite') ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                                                                    {p.reportType.replace(/_/g, ' ')}
                                                                </span>
                                                                {p.videoDuration && (
                                                                    <div className="flex items-center gap-1 text-[9px] text-red-600 font-black uppercase bg-red-50 px-1 rounded border border-red-100">
                                                                        <VideoIcon className="w-2.5 h-2.5" /> {p.videoDuration}
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
                        <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700">Showing <strong>{tableMetrics.length}</strong> records</span>
                                <div className="h-4 w-px bg-slate-300 mx-2" />
                                <span className="text-sm font-medium text-slate-500">Revenue: {formatCurrency(dataTabRevenue)}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type:</span>
                                    <select 
                                        value={filterType} 
                                        onChange={e => setFilterType(e.target.value)} 
                                        className="p-1.5 border rounded-lg text-xs bg-white text-indigo-700 font-bold focus:ring-orange-500 min-w-[140px]"
                                    >
                                        <option value="">All Types</option>
                                        <option value="onsite">Onsite (Influencer)</option>
                                        <option value="offsite">Offsite (Affiliate)</option>
                                        <option value="creator_connections">Creator Connections</option>
                                        <option value="creator_connections_onsite">CC Onsite</option>
                                        <option value="creator_connections_offsite">CC Offsite</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Published:</span>
                                    <select 
                                        value={dataCreatedYearFilter} 
                                        onChange={(e) => setDataCreatedYearFilter(e.target.value)} 
                                        className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold focus:ring-orange-500 min-w-[100px]"
                                    >
                                        <option value="all">All Time</option>
                                        {availableCreatedYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show:</span>
                                    <select 
                                        value={rowsPerPage} 
                                        onChange={(e) => setRowsPerPage(Number(e.target.value))} 
                                        className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold focus:ring-orange-500 min-w-[80px]"
                                    >
                                        {[50, 100, 200, 500, 1000].map(v => <option key={v} value={v}>{v} rows</option>)}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors shadow-sm select-none group">
                                        <input 
                                            type="checkbox" 
                                            checked={isMergedAsins} 
                                            onChange={() => setIsMergedAsins(!isMergedAsins)} 
                                            className="h-4 w-4 text-orange-600 rounded border-orange-300 focus:ring-orange-500 cursor-pointer" 
                                        />
                                        <span className="text-xs font-bold text-orange-700 uppercase">Merge ASINs</span>
                                    </label>
                                </div>
                                
                                <button onClick={() => { if(confirm("Clear ALL data?")) onDeleteMetrics(metrics.map(m => m.id)); }} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><DeleteIcon className="w-4 h-4"/> Clear All</button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('date')}>
                                                <div className="flex items-center gap-1">Date {getSortIcon('date', dataSortKey, dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('title')}>
                                                <div className="flex items-center gap-1">Product / Video {getSortIcon('title', dataSortKey, dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('clicks')}>
                                                <div className="flex items-center justify-end gap-1">Clicks {getSortIcon('clicks', dataSortKey, dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('revenue')}>
                                                <div className="flex items-center justify-end gap-1">Revenue {getSortIcon('revenue', dataSortKey, dataSortDir)}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {paginatedTableMetrics.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2 text-sm text-slate-600 font-mono">{isMergedAsins ? 'MERGED' : m.date}</td>
                                                <td className="px-4 py-2 text-[10px] text-slate-500 uppercase font-black">
                                                    <span className={`px-2 py-0.5 rounded border ${m.reportType.includes('creator') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : (m.reportType === 'onsite' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100')}`}>
                                                        {m.reportType.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-800 truncate max-w-md">
                                                    <MultiTitleDisplay metric={m} />
                                                    <span className="text-[10px] text-slate-400 font-mono">({m.asin})</span>
                                                </td>
                                                <td className="px-4 py-2 text-right text-sm text-slate-600 font-mono">{formatNumber(m.clicks)}</td>
                                                <td className="px-4 py-2 text-right text-sm font-bold text-green-600 font-mono">{formatCurrency(m.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Simple Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="p-3 bg-slate-50 border-t flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Page {currentPage} of {totalPages}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4"/></button>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronRightIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* INSIGHTS TAB */}
                {activeTab === 'insights' && (
                    <div className="space-y-6 pb-20">
                         <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black mb-2 flex items-center gap-2"><HeartIcon className="w-6 h-6 text-red-500" /> Passive Consistency</h3>
                                <p className="text-slate-400 max-w-md">Your revenue spread suggests {((insightsAggregates.monthData.filter(v => v > 0).length / 12) * 100).toFixed(0)}% month-over-month coverage.</p>
                            </div>
                            <div className="flex gap-12 relative z-10">
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Max Monthly</p>
                                    <p className="text-4xl font-black">{formatCurrency(insightsAggregates.maxMonth)}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Avg Month</p>
                                    <p className="text-4xl font-black text-indigo-400">{formatCurrency(summary.revenue / 12)}</p>
                                </div>
                            </div>
                            <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-10 text-indigo-500 pointer-events-none" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUpIcon className="w-5 h-5 text-green-500" /> Year-over-Year Growth</h4>
                                <div className="space-y-4">
                                    {insightsAggregates.yearData.map(([year, rev]) => (
                                        <div key={year} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-600"><span>{year} Earnings</span><span>{formatCurrency(rev)}</span></div>
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${(rev / (insightsAggregates.maxYear || 1)) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-blue-500" /> Monthly Seasonality</h4>
                                <div className="grid grid-cols-6 gap-2">
                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
                                        const rev = insightsAggregates.monthData[i];
                                        return (
                                            <div key={m} className="flex flex-col items-center">
                                                <div className="w-full bg-slate-100 h-24 rounded-md relative overflow-hidden flex items-end">
                                                    <div className="w-full bg-indigo-500 transition-all duration-1000" style={{ height: `${(rev / (insightsAggregates.maxMonth || 1)) * 100}%` }} title={formatCurrency(rev)} />
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            {/* CC Linker */}
                            <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 space-y-6 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><BoxIcon className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Creator Connections Linker</h3>
                                        <p className="text-sm text-slate-500">Unify your Creator reports with Sales data.</p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Cross-references every Creator Connection record against your entire Onsite/Offsite database to identify where the base commission originated.
                                </p>
                                
                                <button 
                                    onClick={handleScanForMatches} 
                                    disabled={isScanningMatches || metrics.length === 0} 
                                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isScanningMatches ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Scanning Metrics...
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-5 h-5" />
                                            Scan for Matches
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Video Linker */}
                            <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 space-y-6 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-red-50 rounded-2xl text-red-600"><VideoIcon className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Amazon Video Linker</h3>
                                        <p className="text-sm text-slate-500">Match ASINs and Titles to video metadata.</p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Imports video reports to associate Video Titles, Durations, and Upload Dates with <strong className="text-slate-800">Onsite sales records ONLY</strong>. Matches by ASIN or normalized title.
                                </p>
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-8 bg-slate-50 group hover:border-red-400 transition-colors">
                                    <CloudArrowUpIcon className="w-12 h-12 text-slate-300 group-hover:text-red-400 mb-4 transition-colors" />
                                    <input type="file" ref={videoInputRef} accept=".csv" onChange={handleVideoImport} className="hidden" />
                                    <button onClick={() => videoInputRef.current?.click()} disabled={isScanningVideos} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-black flex items-center gap-2 shadow-lg">
                                        {isScanningVideos ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Scanning...
                                            </>
                                        ) : (
                                            <>
                                                <SearchCircleIcon className="w-5 h-5" />
                                                Select Video CSV
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* UPLOAD TAB */}
                {activeTab === 'upload' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20 items-start">
                        {previewMetrics.length > 0 ? (
                            <div className="bg-white p-6 rounded-[2rem] border-2 border-orange-500 shadow-xl space-y-6 animate-slide-up">
                                <h3 className="text-2xl font-black text-slate-800">Verify Import</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase">Report Year</label><select value={uploadYear} onChange={e => setUploadYear(e.target.value)} className="w-full p-2 border rounded-lg font-bold">{availableReportYears.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase">Traffic Type</label><select value={uploadType} onChange={e => setUploadType(e.target.value as any)} className="w-full p-2 border rounded-lg font-bold"><option value="onsite">Onsite</option><option value="offsite">Offsite</option><option value="creator_connections">Creator Connections</option></select></div>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => setPreviewMetrics([])} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl">Cancel</button>
                                    <button onClick={confirmImport} className="flex-[2] py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg">Confirm & Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-[2rem] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="p-6 bg-orange-50 rounded-full text-orange-500"><CloudArrowUpIcon className="w-12 h-12" /></div>
                                <h3 className="text-2xl font-black text-slate-800">Import Earnings</h3>
                                <input type="file" ref={fileInputRef} accept=".csv,.tsv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-10 py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 shadow-xl">{isUploading ? 'Analyzing...' : 'Choose File'}</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* CC MATCH CONFIRMATION MODAL */}
            {isMatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2"><ShieldCheckIcon className="w-6 h-6 text-indigo-600" /> CC Link Review</h3>
                                <p className="text-sm text-slate-500">We found <strong>{matchingMatches.length}</strong> possible matches. Showing a sample of up to 100.</p>
                            </div>
                            <button onClick={() => setIsMatchModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
                            {matchingMatches.slice(0, 100).map((match, idx) => (
                                <div key={match.creatorMetric.id} className="p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm flex items-center gap-6">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">{idx + 1}</div>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Creator Connection Record</p>
                                            <p className="text-sm font-bold text-slate-800 truncate" title={match.creatorMetric.title}>{match.creatorMetric.title}</p>
                                            <div className="flex gap-4 text-[10px] font-mono text-slate-500">
                                                <span>Date: {match.creatorMetric.date}</span>
                                                <span>ASIN: {match.creatorMetric.asin}</span>
                                                <span className="font-bold text-indigo-600">Rev: {formatCurrency(match.creatorMetric.revenue)}</span>
                                            </div>
                                        </div>
                                        <div className="border-l border-slate-200 pl-8 space-y-1">
                                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Matched Base Sales Record</p>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${match.matchedSalesMetric.reportType === 'onsite' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{match.matchedSalesMetric.reportType}</span>
                                                <span className="text-slate-400">&rarr;</span>
                                                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm">Creator {match.matchedSalesMetric.reportType}</span>
                                            </div>
                                            <div className="flex gap-4 text-[10px] font-mono text-slate-500">
                                                <span>Tracking: {match.matchedSalesMetric.trackingId}</span>
                                                <span className="font-bold text-emerald-600">Base Rev: {formatCurrency(match.matchedSalesMetric.revenue)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {matchingMatches.length > 100 && (
                                <div className="text-center py-8">
                                    <p className="text-slate-400 text-sm font-medium italic">...and {matchingMatches.length - 100} more matches ready to merge.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
                            <button onClick={() => setIsMatchModalOpen(false)} className="px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Discard Results</button>
                            <button 
                                onClick={handleConfirmCCMatches} 
                                className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                Merge All {matchingMatches.length} CC Matches
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIDEO SCAN PROGRESS OVERLAY */}
            {isScanningVideos && videoScanProgress && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-6">
                        <div className="w-16 h-16 border-4 border-red-100 border-t-red-600 rounded-full animate-spin" />
                        <div>
                            <h3 className="text-xl font-black text-slate-800">Scanning for Matches</h3>
                            <p className="text-sm text-slate-500 mt-1">Cross-referencing video titles and ASINs against onsite sales records.</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-red-600 transition-all duration-200" 
                                style={{ width: `${(videoScanProgress.current / videoScanProgress.total) * 100}%` }}
                            />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress: {videoScanProgress.current} / {videoScanProgress.total}</p>
                    </div>
                </div>
            )}

            {/* VIDEO MATCH CONFIRMATION MODAL */}
            {isVideoMatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2"><VideoIcon className="w-6 h-6 text-red-600" /> Video Metadata Review (Onsite Only)</h3>
                                <p className="text-sm text-slate-500">We found <strong>{videoMatches.length}</strong> matching <strong className="text-slate-700 underline">onsite</strong> records. Reviewing top 100 sample.</p>
                            </div>
                            <button onClick={() => setIsVideoMatchModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
                            {videoMatches.slice(0, 100).map((match, idx) => (
                                <div key={match.salesMetric.id + '-' + idx} className="p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm flex items-center gap-6">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">{idx + 1}</div>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Video Source Info</p>
                                            <p className="text-sm font-bold text-slate-800 truncate" title={match.videoData.videoTitle}>{match.videoData.videoTitle}</p>
                                            <div className="flex gap-4 text-[10px] font-mono text-slate-500">
                                                {match.videoData.uploadDate && <span>Uploaded: {match.videoData.uploadDate}</span>}
                                                {match.videoData.duration && <span>Duration: {match.videoData.duration}</span>}
                                                {match.videoData.asins && <span>Targeting: {match.videoData.asins.join(', ')}</span>}
                                            </div>
                                        </div>
                                        <div className="border-l border-slate-200 pl-8 space-y-1">
                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Matched Onsite Sale</p>
                                            <div className="flex items-center gap-3">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-700">ONSITE</span>
                                                <p className="text-xs font-bold text-slate-700 truncate" title={match.salesMetric.title}>{match.salesMetric.title}</p>
                                            </div>
                                            <div className="flex gap-4 text-[10px] font-mono text-slate-500">
                                                <span>Date: {match.salesMetric.date}</span>
                                                <span>ASIN: {match.salesMetric.asin}</span>
                                                <span className="font-bold text-indigo-600">Earnings: {formatCurrency(match.salesMetric.revenue)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
                            <button onClick={() => setIsVideoMatchModalOpen(false)} className="px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Discard Scan</button>
                            <button 
                                onClick={handleMergeVideos} 
                                className="px-10 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-xl shadow-red-100 transition-all flex items-center gap-2"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                Merge Metadata into {videoMatches.length} Records
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MERGE PROGRESS OVERLAY */}
            {mergeProgress && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-6">
                        <div className="relative w-20 h-20">
                             <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
                             <div 
                                className="absolute inset-0 border-4 border-indigo-600 rounded-full transition-all duration-300"
                                style={{ 
                                    clipPath: `inset(0 0 0 0)`,
                                    strokeDasharray: '251.2', // 2 * PI * r (approx 40 radius)
                                    strokeDashoffset: `${251.2 - (251.2 * (mergeProgress.current / mergeProgress.total))}`
                                }}
                             />
                             <div className="absolute inset-0 flex items-center justify-center font-black text-indigo-600">
                                {Math.round((mergeProgress.current / mergeProgress.total) * 100)}%
                             </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">Updating Database</h3>
                            <p className="text-sm text-slate-500 mt-1">Linking metadata for {mergeProgress.total} onsite items...</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-600 transition-all duration-300" 
                                style={{ width: `${(mergeProgress.current / mergeProgress.total) * 100}%` }}
                            />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processed: {mergeProgress.current} / {mergeProgress.total}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmazonIntegration;