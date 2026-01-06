
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon, AddIcon, EditIcon, VideoIcon, SparklesIcon, TrendingUpIcon, LightBulbIcon, InfoIcon, ChartPieIcon, BoxIcon, HeartIcon, CalendarIcon, UsersIcon } from '../../components/Icons';
import { parseYouTubeReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';
import FileUpload from '../../components/FileUpload';

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

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, channels, onSaveChannel, onDeleteChannel }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'insights' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [uploadYear, setUploadYear] = useState<string>('');
    const [uploadChannelId, setUploadChannelId] = useState<string>('');

    const [editingChannel, setEditingChannel] = useState<YouTubeChannel | null>(null);
    const [newChannelName, setNewChannelName] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterChannelId, setFilterChannelId] = useState('');
    
    const [insightsSortKey, setInsightsSortKey] = useState<keyof YouTubeMetric | 'rpm'>('estimatedRevenue');
    const [insightsSortDir, setInsightsSortDir] = useState<'asc' | 'desc'>('desc');
    const [insightsLimit, setInsightsLimit] = useState<number>(50);
    const [insightsReportYear, setInsightsReportYear] = useState<string>('all');
    const [insightsCreatedYear, setInsightsCreatedYear] = useState<string>('all');

    const [dataSortKey, setDataSortKey] = useState<keyof YouTubeMetric>('publishDate');
    const [dataSortDir, setDataSortDir] = useState<'asc' | 'desc'>('desc');
    const [dataCreatedYearFilter, setDataCreatedYearFilter] = useState<string>('all');
    const [groupByVideo, setGroupByVideo] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const [selectedVelocityYear, setSelectedVelocityYear] = useState<string | null>(null);

    const [evergreenReportYear, setEvergreenReportYear] = useState<string>('');
    const [evergreenPublishedYears, setEvergreenPublishedYears] = useState<Set<string>>(new Set());

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

    useEffect(() => {
        if (availableReportYears.length > 0 && !evergreenReportYear) {
            setEvergreenReportYear(availableReportYears[0]);
        }
    }, [availableReportYears, evergreenReportYear]);

    const channelMap = useMemo(() => new Map(channels.map(c => [c.id, c.name])), [channels]);
    const currentContextChannelName = filterChannelId ? (channelMap.get(filterChannelId) || 'Unknown Channel') : 'All Channels';

    const videoAggregateMap = useMemo(() => {
        const map = new Map<string, { 
            videoId: string, 
            channelId?: string,
            title: string, 
            publishDate: string,
            creationYearViews: number,
            creationYearRevenue: number,
            lifetimeViews: number,
            lifetimeRevenue: number,
            lifetimeSubs: number
        }>();

        metrics.forEach(m => {
            if (!map.has(m.videoId)) {
                map.set(m.videoId, {
                    videoId: m.videoId,
                    channelId: m.channelId,
                    title: m.videoTitle,
                    publishDate: m.publishDate,
                    creationYearViews: 0,
                    creationYearRevenue: 0,
                    lifetimeViews: 0,
                    lifetimeRevenue: 0,
                    lifetimeSubs: 0
                });
            }
            const agg = map.get(m.videoId)!;
            const publishYear = m.publishDate.substring(0, 4);
            
            if (m.reportYear === publishYear) {
                agg.creationYearViews += m.views;
                agg.creationYearRevenue += m.estimatedRevenue;
            }
            agg.lifetimeViews += m.views;
            agg.lifetimeRevenue += m.estimatedRevenue;
            agg.lifetimeSubs += m.subscribersGained;
        });
        return map;
    }, [metrics]);

    const tableMetrics = useMemo(() => {
        let result = [...metrics];

        if (filterChannelId) {
            result = result.filter(m => m.channelId === filterChannelId);
        }
        
        if (dataCreatedYearFilter !== 'all') {
            result = result.filter(m => m.publishDate.startsWith(dataCreatedYearFilter));
        }

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
    }, [metrics, groupByVideo, dataSortKey, dataSortDir, dataCreatedYearFilter, filterChannelId]);

    const totalPages = Math.ceil(tableMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = tableMetrics.slice(startIndex, startIndex + rowsPerPage);

    useEffect(() => { setCurrentPage(1); }, [rowsPerPage, groupByVideo, dataSortKey, dataSortDir, dataCreatedYearFilter, filterChannelId]);

    const processYouTubeFiles = async (files: File[]) => {
        setIsUploading(true);
        const file = files[0];
        if (!file) return;
        try {
            const newMetrics = await parseYouTubeReport(file, (msg) => console.log(msg));
            if (newMetrics.length > 0) {
                setPreviewMetrics(newMetrics);
                
                const fileName = file.name;
                let detectedYear = '';
                let detectedChannelId = '';

                const dateRangeMatch = fileName.match(/(\d{4})-\d{2}-\d{2}_(\d{4})-\d{2}-\d{2}/);
                if (dateRangeMatch) {
                    detectedYear = dateRangeMatch[1];
                } else {
                    const yearMatch = fileName.match(/\b(20\d{2})\b/);
                    if (yearMatch) {
                        detectedYear = yearMatch[1];
                    }
                }

                const channelCleanPatterns = [
                    /Table data - ([^-]+) -/i,
                    /_\d{4}-\d{2}-\d{2}\s+(.+)\.csv/i,
                    /(\d{4}-\d{2}-\d{2}_){2}\s*(.+)\.csv/i
                ];

                let extractedName = '';
                for (const pattern of channelCleanPatterns) {
                    const match = fileName.match(pattern);
                    if (match) {
                        extractedName = match[match.length - 1].trim();
                        break;
                    }
                }

                const findChannelFuzzy = (name: string) => {
                    const stripped = name.toLowerCase().replace(/\s+/g, '');
                    return channels.find(c => c.name.toLowerCase().replace(/\s+/g, '') === stripped);
                };

                if (extractedName) {
                    const matched = findChannelFuzzy(extractedName);
                    if (matched) detectedChannelId = matched.id;
                }

                if (!detectedChannelId) {
                    const matched = channels.find(c => {
                        const strippedName = c.name.toLowerCase().replace(/\s+/g, '');
                        const strippedFileName = fileName.toLowerCase().replace(/\s+/g, '');
                        return strippedFileName.includes(strippedName);
                    });
                    if (matched) detectedChannelId = matched.id;
                }

                if (!detectedYear) {
                    const latestRecord = [...newMetrics].sort((a, b) => {
                        const dateA = new Date(a.publishDate).getTime();
                        const dateB = new Date(b.publishDate).getTime();
                        return dateB - dateA;
                    })[0];

                    if (latestRecord && latestRecord.publishDate) {
                        detectedYear = latestRecord.publishDate.substring(0, 4);
                    }
                }

                if (detectedYear) setUploadYear(detectedYear);
                if (detectedChannelId) setUploadChannelId(detectedChannelId);
                
            } else {
                alert("No valid records found in file.");
            }
        } catch (error) {
            console.error(error);
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = () => {
        if (!uploadChannelId) { alert("Please select a Channel for this data."); return; }
        if (previewMetrics.length > 0) {
            const metricsWithChannel = previewMetrics.map(m => ({ ...m, channelId: uploadChannelId, reportYear: uploadYear || undefined }));
            onAddMetrics(metricsWithChannel);
            setPreviewMetrics([]);
            setUploadYear('');
            setUploadChannelId('');
            alert(`Successfully imported ${previewMetrics.length} records.`);
            setActiveTab('dashboard');
        }
    };

    const handleSaveChannel = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newChannelName.trim()) return;
        
        onSaveChannel({
            id: editingChannel?.id || generateUUID(),
            name: newChannelName.trim()
        });
        
        setNewChannelName('');
        setEditingChannel(null);
    };

    const handleEditChannel = (channel: YouTubeChannel) => {
        setEditingChannel(channel);
        setNewChannelName(channel.name);
    };

    const handleDeleteChannel = (id: string) => {
        if (window.confirm("Permanently delete this channel? Metrics associated with this channel will remain but will no longer have a channel reference.")) {
            onDeleteChannel(id);
            if (uploadChannelId === id) setUploadChannelId('');
            if (filterChannelId === id) setFilterChannelId('');
        }
    };

    const summary = useMemo(() => {
        const result = { totalRevenue: 0, totalViews: 0, totalSubs: 0, totalWatchTime: 0, avgRPM: 0, avgCTR: 0, avgWatchPerView: 0 };
        const data = filterChannelId ? metrics.filter(m => m.channelId === filterChannelId) : metrics;
        data.forEach(m => {
            result.totalRevenue += m.estimatedRevenue;
            result.totalViews += m.views;
            result.totalSubs += m.subscribersGained;
            result.totalWatchTime += m.watchTimeHours;
        });
        if (result.totalViews > 0) {
            result.avgRPM = (result.totalRevenue / result.totalViews) * 1000;
            result.avgWatchPerView = result.totalWatchTime / result.totalViews;
        }
        const totalImpressions = data.reduce((acc, m) => acc + m.impressions, 0);
        const totalClicks = data.reduce((acc, m) => acc + (m.impressions * (m.ctr / 100)), 0);
        if (totalImpressions > 0) result.avgCTR = (totalClicks / totalImpressions) * 100;
        return result;
    }, [metrics, filterChannelId]);

    const generatedInsights = useMemo(() => {
        const data = filterChannelId ? metrics.filter(m => m.channelId === filterChannelId) : metrics;
        if (data.length === 0) return null;

        const yearlyStats = new Map<string, { 
            revChamp: YouTubeMetric, 
            viewChamp: YouTubeMetric, 
            rpmChamp: YouTubeMetric & { rpm: number } 
        }>();
        
        const videosPerYear = new Map<string, number>();
        const weekdayMap = new Map<number, { 
            revenue: number, 
            views: number, 
            count: number,
            creationYearRevenue: number,
            creationYearViews: number
        }>();
        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let evergreenRevenue = 0;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        data.forEach(m => {
            const year = m.publishDate.substring(0, 4);
            const rpm = m.views > 0 ? (m.estimatedRevenue / m.views) * 1000 : 0;
            
            const currentYearStats = yearlyStats.get(year) || { 
                revChamp: m, 
                viewChamp: m, 
                rpmChamp: { ...m, rpm } 
            };
            
            if (m.estimatedRevenue > currentYearStats.revChamp.estimatedRevenue) currentYearStats.revChamp = m;
            if (m.views > currentYearStats.viewChamp.views) currentYearStats.viewChamp = m;
            if (rpm > currentYearStats.rpmChamp.rpm) currentYearStats.rpmChamp = { ...m, rpm };

            yearlyStats.set(year, currentYearStats);
            videosPerYear.set(year, (videosPerYear.get(year) || 0) + 1);

            if (new Date(m.publishDate) < oneYearAgo) {
                evergreenRevenue += m.estimatedRevenue;
            }

            const date = new Date(m.publishDate);
            const dayIdx = date.getDay();
            const stats = weekdayMap.get(dayIdx) || { revenue: 0, views: 0, count: 0, creationYearRevenue: 0, creationYearViews: 0 };
            
            stats.revenue += m.estimatedRevenue;
            stats.views += m.views;
            stats.count += 1;
            
            if (m.reportYear === year) {
                stats.creationYearRevenue += m.estimatedRevenue;
                stats.creationYearViews += m.views;
            }

            weekdayMap.set(dayIdx, stats);
        });

        const weekdayStats = Array.from(weekdayMap.entries())
            .map(([idx, s]) => ({
                day: DAYS[idx],
                avgRev: s.revenue / s.count,
                avgViews: s.views / s.count,
                totalRev: s.revenue,
                totalViews: s.views,
                creationYearRev: s.creationYearRevenue,
                creationYearViews: s.creationYearViews,
                count: s.count,
                viralVelocity: s.views > 0 ? (s.creationYearViews / s.views) * 100 : 0
            }))
            .sort((a,b) => b.avgRev - a.avgRev);

        return {
            champions: Array.from(yearlyStats.entries()).sort((a, b) => b[0].localeCompare(a[0])),
            counts: Array.from(videosPerYear.entries()).sort((a, b) => b[0].localeCompare(a[0])),
            weekdayStats,
            evergreenRevenue,
            evergreenPercent: (evergreenRevenue / (summary.totalRevenue || 1)) * 100
        };
    }, [metrics, summary.totalRevenue, filterChannelId]);

    const evergreenCohortStats = useMemo(() => {
        if (!evergreenReportYear) return null;
        
        let cohortRev = 0;
        let cohortViews = 0;
        
        const data = filterChannelId ? metrics.filter(m => m.channelId === filterChannelId) : metrics;

        data.forEach(m => {
            const pubYear = m.publishDate.substring(0, 4);
            if (m.reportYear === evergreenReportYear && evergreenPublishedYears.has(pubYear)) {
                cohortRev += m.estimatedRevenue;
                cohortViews += m.views;
            }
        });

        const totalYearRevenue = data
            .filter(m => m.reportYear === evergreenReportYear)
            .reduce((s, m) => s + m.estimatedRevenue, 0);

        return {
            revenue: cohortRev,
            views: cohortViews,
            percentOfTotalYear: totalYearRevenue > 0 ? (cohortRev / totalYearRevenue) * 100 : 0
        };
    }, [metrics, evergreenReportYear, evergreenPublishedYears, filterChannelId]);

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
            const valA = (a as any)[insightsSortKey];
            const valB = (b as any)[insightsSortKey];
            
            const numA = typeof valA === 'number' ? valA : 0;
            const numB = typeof valB === 'number' ? valB : 0;
            
            return insightsSortDir === 'asc' ? numA - numB : numB - numA;
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
        else { setInsightsSortKey(key as any); setInsightsSortDir('desc'); }
    };

    const getSortIcon = (key: keyof YouTubeMetric | 'rpm', currentKey: string, currentDir: string) => {
        if (String(currentKey) !== String(key)) return <SortIcon className="w-3 h-3 text-slate-300 opacity-50" />;
        return currentDir === 'asc' ? <SortIcon className="w-3 h-3 text-indigo-600 transform rotate-180" /> : <SortIcon className="w-3 h-3 text-indigo-600" />;
    };

    const toggleEvergreenPublishedYear = (year: string) => {
        const newSet = new Set(evergreenPublishedYears);
        if (newSet.has(year)) newSet.delete(year); else newSet.add(year);
        setEvergreenPublishedYears(newSet);
    };

    const getChampionStats = (videoId: string) => {
        const agg = videoAggregateMap.get(videoId);
        if (!agg) return "Stats unknown";
        
        const rpm = agg.lifetimeViews > 0 ? (agg.lifetimeRevenue / agg.lifetimeViews) * 1000 : 0;
        const conv = agg.lifetimeViews > 0 ? (agg.lifetimeSubs / agg.lifetimeViews) * 100 : 0;

        return `
Revenue (Creation Yr): ${formatCurrency(agg.creationYearRevenue)}
Revenue (Lifetime): ${formatCurrency(agg.lifetimeRevenue)}
Total Views: ${formatNumber(agg.lifetimeViews)}
Total Subs Gained: ${formatNumber(agg.lifetimeSubs)}
Avg RPM: ${formatCurrency(rpm)}
Conv Rate: ${conv.toFixed(2)}%
        `.trim();
    };

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
                                            <select value={filterChannelId} onChange={(e) => setFilterChannelId(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-slate-50 text-indigo-700 font-bold min-w-[120px]">
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
                                            <select value={insightsReportYear} onChange={e => setInsightsReportYear(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]">
                                                <option value="all">Reported: All Time</option>
                                                {availableReportYears.map(y => <option key={y} value={y}>Reported: {y}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select value={insightsCreatedYear} onChange={e => setInsightsCreatedYear(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-slate-50 text-slate-700 font-bold min-w-[140px]">
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
                                                <div className="flex items-center justify-end gap-1">Views {getSortIcon('views', String(insightsSortKey), insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('watchTimeHours')}>
                                                <div className="flex items-center justify-end gap-1">Watch Time {getSortIcon('watchTimeHours', String(insightsSortKey), insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('subscribersGained')}>
                                                <div className="flex items-center justify-end gap-1">Subs {getSortIcon('subscribersGained', String(insightsSortKey), insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('rpm')}>
                                                <div className="flex items-center justify-end gap-1" title="Revenue per 1000 views">RPM {getSortIcon('rpm', String(insightsSortKey), insightsSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-red-600 transition-colors group" onClick={() => handleInsightsSort('estimatedRevenue')}>
                                                <div className="flex items-center justify-end gap-1">Revenue {getSortIcon('estimatedRevenue', String(insightsSortKey), insightsSortDir)}</div>
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
                                                <td className="px-4 py-2 text-right text-sm text-slate-600 font-mono">{formatNumber(video.subscribersGained)}</td>
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
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-500 uppercase">Context Channel:</span>
                                <select 
                                    value={filterChannelId} 
                                    onChange={(e) => setFilterChannelId(e.target.value)} 
                                    className="p-2 border rounded-lg text-sm bg-slate-50 text-indigo-700 font-bold focus:ring-red-500 min-w-[200px]"
                                >
                                    <option value="">All Channels</option>
                                    {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                </select>
                            </div>
                            <p className="text-xs text-slate-400 italic">This filter affects all data analysis cards on this page.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-xl space-y-6 overflow-hidden relative col-span-1 md:col-span-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold mb-1 flex items-center gap-2 text-lg">
                                            <HeartIcon className="w-5 h-5 text-red-500" /> Content Durability (Evergreen Analysis)
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentContextChannelName}</p>
                                    </div>
                                    <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded font-black uppercase tracking-tighter">Lifetime Analysis</span>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest block mb-1">Evergreen Revenue (1yr+ old)</span>
                                        <p className="text-3xl font-bold">{formatCurrency(generatedInsights?.evergreenRevenue || 0)}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest block mb-1">% of Lifetime Earnings</span>
                                        <p className="text-3xl font-bold">{generatedInsights?.evergreenPercent.toFixed(1)}%</p>
                                    </div>
                                </div>
                                
                                <div className="pt-6 border-t border-white/10 space-y-6">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                        <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Evergreen Cohort Analyzer</h4>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Measurement Year:</span>
                                            <select 
                                                value={evergreenReportYear} 
                                                onChange={e => setEvergreenReportYear(e.target.value)}
                                                className="bg-slate-800 border-slate-700 text-white text-sm py-1.5 px-3 rounded-lg focus:ring-red-500 focus:border-red-500 transition-all"
                                            >
                                                {availableReportYears.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-xs text-slate-400 font-medium">Select publication years to analyze their performance in {evergreenReportYear}:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {availableCreatedYears.map(y => (
                                                <button 
                                                    key={y}
                                                    onClick={() => toggleEvergreenPublishedYear(y)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all transform active:scale-95 ${evergreenPublishedYears.has(y) ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                                >
                                                    {y}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {evergreenCohortStats && (
                                        <div className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
                                            <div className="text-center sm:text-left">
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Cohort Revenue in {evergreenReportYear}</p>
                                                <p className="text-3xl font-black">{formatCurrency(evergreenCohortStats.revenue)}</p>
                                            </div>
                                            <div className="text-center sm:text-right">
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">% of Total {evergreenReportYear} Revenue</p>
                                                <p className="text-3xl font-black text-indigo-400">{evergreenCohortStats.percentOfTotalYear.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col max-h-[500px]">
                                <div className="flex justify-between items-start mb-4 flex-shrink-0">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                        <TrendingUpIcon className="w-5 h-5 text-red-500" /> Yearly Champions
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{currentContextChannelName}</span>
                                </div>
                                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                                    {generatedInsights?.champions.map(([year, stats]) => (
                                        <div key={year} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-tighter border-b border-slate-200 pb-1">{year} Performance Leaders</h4>
                                            
                                            <div className="space-y-2">
                                                <div className="flex flex-col group/info">
                                                    <div className="flex items-center justify-between text-xs cursor-help">
                                                        <div className="min-w-0 flex-1">
                                                            <span className="bg-green-100 text-green-700 px-1.5 rounded font-bold uppercase text-[9px] mr-2">Revenue</span>
                                                            <span className="text-slate-700 font-bold hover:text-red-600 transition-colors" title={getChampionStats(stats.revChamp.videoId)}>{stats.revChamp.videoTitle}</span>
                                                        </div>
                                                        <span className="font-bold text-green-600 ml-4">{formatCurrency(stats.revChamp.estimatedRevenue)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col group/info">
                                                    <div className="flex items-center justify-between text-xs cursor-help">
                                                        <div className="min-w-0 flex-1">
                                                            <span className="bg-blue-100 text-blue-700 px-1.5 rounded font-bold uppercase text-[9px] mr-2">Views</span>
                                                            <span className="text-slate-700 font-bold hover:text-red-600 transition-colors" title={getChampionStats(stats.viewChamp.videoId)}>{stats.viewChamp.videoTitle}</span>
                                                        </div>
                                                        <span className="font-bold text-blue-600 ml-4">{formatNumber(stats.viewChamp.views)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col group/info">
                                                    <div className="flex items-center justify-between text-xs cursor-help">
                                                        <div className="min-w-0 flex-1">
                                                            <span className="bg-purple-100 text-purple-700 px-1.5 rounded font-bold uppercase text-[9px] mr-2">RPM</span>
                                                            <span className="text-slate-700 font-bold hover:text-red-600 transition-colors" title={getChampionStats(stats.rpmChamp.videoId)}>{stats.rpmChamp.videoTitle}</span>
                                                        </div>
                                                        <span className="font-bold text-purple-600 ml-4">{formatCurrency(stats.rpmChamp.rpm)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                        <VideoIcon className="w-5 h-5 text-red-500" /> Content Velocity
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{currentContextChannelName}</span>
                                </div>
                                <div className="space-y-4">
                                    {generatedInsights?.counts.map(([year, count]) => {
                                        const maxCount = Math.max(...Array.from(generatedInsights.counts.map(c => c[1])));
                                        const percent = (count / maxCount) * 100;
                                        return (
                                            <div key={year} className="space-y-1">
                                                <div className="flex justify-between text-xs font-bold text-slate-600 uppercase">
                                                    <button 
                                                        onClick={() => setSelectedVelocityYear(year)}
                                                        className="text-indigo-600 hover:underline decoration-dotted transition-all"
                                                    >
                                                        {year} Batch
                                                    </button>
                                                    <span>{count} Videos Created</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-red-500 rounded-full transition-all duration-1000 cursor-pointer hover:bg-red-600" 
                                                        style={{ width: `${percent}%` }}
                                                        onClick={() => setSelectedVelocityYear(year)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                        <CalendarIcon className="w-5 h-5 text-indigo-500" /> Best Days to Publish (ROI)
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{currentContextChannelName}</span>
                                </div>
                                <p className="text-xs text-slate-500 mb-4 italic">Performance averages and lifetime splits for each day.</p>
                                <div className="space-y-3">
                                    {generatedInsights?.weekdayStats.map((s, idx) => (
                                        <div key={s.day} className={`flex flex-col p-4 rounded-xl border ${idx === 0 ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                                                        {s.day.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-800">{s.day}</p>
                                                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px] font-black uppercase shadow-sm">
                                                                {s.count} Vids
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                                                            {formatNumber(s.avgViews)} avg views 
                                                            <InfoBubble title="Avg Views" content="Average number of views generated per video published on this specific weekday across its entire recorded lifetime." />
                                                            • {formatCurrency(s.avgRev)} avg rev
                                                            <InfoBubble title="Avg Revenue" content="Average estimated revenue earned per video published on this specific weekday across its entire recorded lifetime." />
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-center gap-1.5 justify-end">
                                                        <TrendingUpIcon className={`w-3 h-3 ${s.viralVelocity > 60 ? 'text-orange-500' : 'text-green-500'}`} />
                                                        <p className={`font-black text-sm ${idx === 0 ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                            {s.viralVelocity.toFixed(0)}% <span className="text-[9px] font-bold text-slate-400">VELOCITY</span>
                                                            <InfoBubble title="Viral Velocity" content="Percentage of total views that occurred within the same calendar year the video was published. A high score suggests immediate viral impact; a low score indicates slow-burn evergreen performance." />
                                                        </p>
                                                    </div>
                                                    <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">{formatCurrency(s.totalRev)} TOTAL</p>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1 mt-1">
                                                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider">
                                                    <span className="text-slate-400">Creation Year Views: {formatNumber(s.creationYearViews)}</span>
                                                    <span className="text-indigo-500">Evergreen Growth: +{formatNumber(s.totalViews - s.creationYearViews)}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-white rounded-full overflow-hidden flex border border-slate-200/50">
                                                    <div 
                                                        className="h-full bg-slate-300 transition-all duration-1000" 
                                                        style={{ width: `${s.viralVelocity}%` }}
                                                        title={`Creation Year: ${s.viralVelocity.toFixed(1)}%`}
                                                    />
                                                    <div 
                                                        className="h-full bg-indigo-500 transition-all duration-1000" 
                                                        style={{ width: `${100 - s.viralVelocity}%` }}
                                                        title={`Evergreen: ${(100 - s.viralVelocity).toFixed(1)}%`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4 h-full flex flex-col">
                        <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700">Showing <strong>{tableMetrics.length}</strong> records</span>
                                <div className="h-4 w-px bg-slate-300 mx-2" />
                                <span className="text-sm font-medium text-slate-500">Revenue: {formatCurrency(summary.totalRevenue)}</span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Channel:</span>
                                    <select value={filterChannelId} onChange={(e) => setFilterChannelId(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold focus:ring-red-500 min-w-[120px]">
                                        <option value="">All Channels</option>
                                        {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Published:</span>
                                    <select value={dataCreatedYearFilter} onChange={(e) => setDataCreatedYearFilter(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold focus:ring-red-500 min-w-[100px]">
                                        <option value="all">All Time</option>
                                        {availableCreatedYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Show:</span>
                                    <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} className="p-1.5 border rounded-lg text-xs bg-white text-slate-700 font-bold focus:ring-red-500 min-w-[80px]">
                                        {[50, 100, 200, 500, 1000].map(v => <option key={v} value={v}>{v} rows</option>)}
                                    </select>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300 hover:border-red-300 transition-colors shadow-sm select-none">
                                    <input type="checkbox" checked={groupByVideo} onChange={() => setGroupByVideo(!groupByVideo)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-xs font-bold text-red-700 uppercase">Merge Video Totals</span>
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
                                                <div className="flex items-center gap-1">Report Year {getSortIcon('reportYear', String(dataSortKey), dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('publishDate')}>
                                                <div className="flex items-center gap-1">Published {getSortIcon('publishDate', String(dataSortKey), dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('videoTitle')}>
                                                <div className="flex items-center gap-1">Video {getSortIcon('videoTitle', String(dataSortKey), dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleDataSort('views')}>
                                                <div className="flex items-center justify-end gap-1">Views {getSortIcon('views', String(dataSortKey), dataSortDir)}</div>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleInsightsSort('estimatedRevenue')}>
                                                <div className="flex items-center justify-end gap-1">Revenue {getSortIcon('estimatedRevenue', String(insightsSortKey), insightsSortDir)}</div>
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

                {activeTab === 'upload' && (
                    <div className="h-full space-y-6 pb-20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div className="space-y-4">
                                <FileUpload 
                                    onFileUpload={processYouTubeFiles} 
                                    disabled={isUploading} 
                                    label="Click or drag files to import"
                                    multiple={false}
                                    acceptedFileTypes=".csv"
                                />

                                {previewMetrics.length > 0 && (
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-sm animate-slide-up">
                                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                            <CheckCircleIcon className="w-6 h-6 text-green-600" />
                                            <h3 className="text-lg font-bold text-slate-800">Review Import Data</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">YouTube Channel <span className="text-red-500">*</span></label>
                                                <select value={uploadChannelId} onChange={(e) => setUploadChannelId(e.target.value)} className="w-full p-2 border rounded-md text-sm bg-slate-50">
                                                    <option value="">Select Channel...</option>
                                                    {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Report Year</label>
                                                <select value={uploadYear} onChange={(e) => setUploadYear(e.target.value)} className="w-full p-2 border rounded-md text-sm bg-slate-50">
                                                    <option value="">Manual Override...</option>
                                                    {Array.from({length: 25}, (_, i) => (2010 + i).toString()).reverse().map(y => <option key={y} value={y}>{y}</option>)}
                                                </select>
                                                <p className="text-[10px] text-indigo-600 mt-1 italic">Auto-detected year: {uploadYear || 'None'}</p>
                                            </div>
                                        </div>

                                        <div className="bg-indigo-50/50 rounded-lg p-4 border border-indigo-100 grid grid-cols-3 gap-2">
                                            <div>
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Videos</p>
                                                <p className="text-lg font-black text-indigo-900">{previewMetrics.length}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Revenue</p>
                                                <p className="text-lg font-black text-green-600">{formatCurrency(previewMetrics.reduce((s, m) => s + m.estimatedRevenue, 0))}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Views</p>
                                                <p className="text-lg font-black text-indigo-900">{formatNumber(previewMetrics.reduce((s, m) => s + m.views, 0))}</p>
                                            </div>
                                        </div>

                                        <div className="max-h-40 overflow-y-auto border rounded-md bg-white">
                                            <table className="min-w-full text-left text-xs divide-y divide-slate-100">
                                                <thead className="bg-slate-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-2">Date</th>
                                                        <th className="p-2">Title</th>
                                                        <th className="p-2 text-right">Revenue</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {previewMetrics.slice(0, 50).map((m, idx) => (
                                                        <tr key={idx}>
                                                            <td className="p-2 text-slate-500 whitespace-nowrap">{m.publishDate}</td>
                                                            <td className="p-2 text-slate-700 truncate max-w-[150px]">{m.videoTitle}</td>
                                                            <td className="p-2 text-right font-bold text-slate-800">{formatCurrency(m.estimatedRevenue)}</td>
                                                        </tr>
                                                    ))}
                                                    {previewMetrics.length > 50 && (
                                                        <tr><td colSpan={3} className="p-2 text-center text-slate-400 italic">...and {previewMetrics.length - 50} more items</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setPreviewMetrics([])} className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors">
                                                Cancel
                                            </button>
                                            <button onClick={confirmImport} disabled={!uploadChannelId} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                                Confirm Import of {previewMetrics.length} Records
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <UsersIcon className="w-5 h-5 text-red-500" /> Manage Channels
                                    </h3>
                                    
                                    <form onSubmit={handleSaveChannel} className="mb-4">
                                        <div className="flex gap-2">
                                            <input type="text" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="Channel Name" className="flex-grow p-2 border rounded-md text-sm" required />
                                            <button type="submit" className="px-4 py-2 bg-slate-800 text-white font-bold rounded-md hover:bg-slate-900 transition-colors flex items-center gap-1">
                                                {editingChannel ? <CheckCircleIcon className="w-4 h-4"/> : <AddIcon className="w-4 h-4" />}
                                                {editingChannel ? 'Save' : 'Add'}
                                            </button>
                                            {editingChannel && (
                                                <button type="button" onClick={() => { setEditingChannel(null); setNewChannelName(''); }} className="p-2 text-slate-400 hover:text-red-500">
                                                    <CloseIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </form>

                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar group">
                                        {channels.length === 0 ? (
                                            <p className="text-center py-8 text-sm text-slate-400 italic">No channels added yet.</p>
                                        ) : (
                                            channels.map(channel => (
                                                <div key={channel.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 group/item">
                                                    <span className="text-sm font-bold text-slate-700">{channel.name}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <button onClick={() => handleEditChannel(channel)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-white transition-colors" title="Edit Name">
                                                            <EditIcon className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteChannel(channel.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-white transition-colors" title="Delete Channel">
                                                            <DeleteIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default YouTubeIntegration;
