import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { JoinedMetric, YouTubeMetric, AmazonVideo, AmazonMetric, YouTubeChannel } from '../../types';
import { BoxIcon, YoutubeIcon, CloudArrowUpIcon, BarChartIcon, TableIcon, SparklesIcon, ChevronRightIcon, ChevronDownIcon, CheckCircleIcon, PlayIcon, InfoIcon, ShieldCheckIcon, AddIcon, DeleteIcon, TrashIcon, VideoIcon, SearchCircleIcon, RepeatIcon, CloseIcon, ExclamationTriangleIcon, ArrowRightIcon, TrendingUpIcon, DollarSign, CheckBadgeIcon, DatabaseIcon, ListIcon, CalendarIcon, SortIcon, ChevronLeftIcon, LinkIcon, WorkflowIcon } from '../../components/Icons';
import { parseAmazonStorefrontVideos, parseVideoAsinMapping, parseYouTubeDetailedReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';
import ConfirmationModal from '../../components/ConfirmationModal';
import { api } from '../../services/apiService';
import { calculateDateRange, formatDate, parseISOLocal } from '../../dateUtils';

interface Props {
    metrics: JoinedMetric[];
    onSaveMetrics: (metrics: JoinedMetric[]) => void;
    youtubeMetrics?: YouTubeMetric[];
    amazonMetrics?: AmazonMetric[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

// Helper to convert time string (H:M:S or M:S) to seconds
const timeToSeconds = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return parts[0];
};

const ProgressBar: React.FC<{ current: number; total: number; label: string }> = ({ current, total, label }) => {
    const pct = Math.min(Math.round((current / total) * 100), 100);
    return (
        <div className="w-full space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                <span>{label}</span>
                <span>{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-indigo-600 transition-all duration-300 ease-out" 
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-center text-[9px] text-slate-300 font-bold uppercase">{current} of {total} processed</p>
        </div>
    );
};

const VideoProductJoiner: React.FC<Props> = ({ metrics, onSaveMetrics, youtubeMetrics = [], amazonMetrics = [] }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'insights' | 'importer'>('dashboard');
    const [importStep, setImportStep] = useState<number>(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState<{ current: number; total: number; label: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Staging state
    const [stagedData, setStagedData] = useState<any[] | null>(null);
    const [proposedMatches, setProposedMatches] = useState<any[]>([]); // For verification steps

    // Global Search & Pivot
    const [searchTerm, setSearchTerm] = useState('');
    const [mergeAsins, setMergeAsins] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Sorting & Pagination State
    const [sortKey, setSortKey] = useState<keyof JoinedMetric>('totalRevenue');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    // Filters
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['youtube', 'onsite', 'offsite', 'creator_onsite', 'creator_offsite']));
    const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set(['all']));

    // Selection/Edit state
    const [selectedAsset, setSelectedAsset] = useState<JoinedMetric | null>(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [syncTargetAsset, setSyncTargetAsset] = useState<JoinedMetric | null>(null);

    const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000);
    };

    const handleSort = (key: keyof JoinedMetric) => {
        if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const handleClearAll = () => {
        onSaveMetrics([]);
        setShowClearConfirm(false);
        notify("Registry wiped successfully", "info");
    };

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        metrics.forEach(m => {
            if (m.publishDate) {
                const year = m.publishDate.substring(0, 4);
                if (year.length === 4) years.add(year);
            }
        });
        return Array.from(years).sort().reverse();
    }, [metrics]);

    // Advanced Data Filtering Engine
    const displayMetrics = useMemo(() => {
        let base = [...metrics];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            base = base.filter(m => 
                m.mainTitle.toLowerCase().includes(q) || 
                m.subTitle.toLowerCase().includes(q) || 
                m.asin.toLowerCase().includes(q) || 
                m.videoId?.toLowerCase().includes(q)
            );
        }

        if (selectedTypes.size < 5) {
            base = base.filter(m => {
                if (selectedTypes.has('youtube') && m.videoEstimatedRevenue > 0) return true;
                if (selectedTypes.has('onsite') && m.amazonOnsiteRevenue > 0) return true;
                if (selectedTypes.has('offsite') && m.amazonOffsiteRevenue > 0) return true;
                if (selectedTypes.has('creator_onsite') && m.creatorConnectionsOnsiteRevenue > 0) return true;
                if (selectedTypes.has('creator_offsite') && m.creatorConnectionsOffsiteRevenue > 0) return true;
                return false;
            });
        }

        if (!selectedYears.has('all')) {
            base = base.filter(m => m.publishDate && selectedYears.has(m.publishDate.substring(0, 4)));
        }

        if (mergeAsins) {
            const map = new Map<string, JoinedMetric>();
            base.forEach(m => {
                if (!map.has(m.asin)) {
                    map.set(m.asin, { ...m });
                } else {
                    const ex = map.get(m.asin)!;
                    ex.views += m.views;
                    ex.totalRevenue += m.totalRevenue;
                    ex.amazonOnsiteRevenue += m.amazonOnsiteRevenue;
                    ex.amazonOffsiteRevenue += m.amazonOffsiteRevenue;
                    ex.creatorConnectionsOnsiteRevenue += m.creatorConnectionsOnsiteRevenue;
                    ex.creatorConnectionsOffsiteRevenue += m.creatorConnectionsOffsiteRevenue;
                    ex.videoEstimatedRevenue += m.videoEstimatedRevenue;
                    ex.clicks += m.clicks;
                    ex.orderedItems += m.orderedItems;
                }
            });
            base = Array.from(map.values());
        }

        base.sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            const nA = (valA as number) || 0;
            const nB = (valB as number) || 0;
            return sortDir === 'asc' ? nA - nB : nB - nA;
        });

        return base;
    }, [metrics, searchTerm, mergeAsins, sortKey, sortDir, selectedTypes, selectedYears]);

    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = useMemo(() => displayMetrics.slice(startIndex, startIndex + rowsPerPage), [displayMetrics, startIndex, rowsPerPage]);
    const totalPages = Math.ceil(displayMetrics.length / rowsPerPage);

    const summary = useMemo(() => {
        return displayMetrics.reduce((acc, m) => ({
            revenue: acc.revenue + m.totalRevenue,
            views: acc.views + m.views,
            clicks: acc.clicks + m.clicks,
            items: acc.items + m.orderedItems
        }), { revenue: 0, views: 0, clicks: 0, items: 0 });
    }, [displayMetrics]);

    const handleFetchSignals = async () => {
        if (youtubeMetrics.length === 0 && amazonMetrics.length === 0) {
            notify("No integration metrics found to fetch.", "error");
            return;
        }
        setIsProcessing(true);
        setProcessProgress({ current: 0, total: youtubeMetrics.length + amazonMetrics.length, label: 'Reading platform signals...' });

        const signals: any[] = [];
        const ytGroups = new Map<string, YouTubeMetric>();
        
        const BATCH_SIZE = 100;
        for (let i = 0; i < youtubeMetrics.length; i += BATCH_SIZE) {
            const batch = youtubeMetrics.slice(i, i + BATCH_SIZE);
            batch.forEach(m => {
                if (!ytGroups.has(m.videoId)) ytGroups.set(m.videoId, { ...m });
                else {
                    const ex = ytGroups.get(m.videoId)!;
                    ex.views += m.views;
                    ex.watchTimeHours += m.watchTimeHours;
                    ex.subscribersGained += m.subscribersGained;
                    ex.estimatedRevenue += m.estimatedRevenue;
                }
            });
            setProcessProgress(prev => ({ ...prev!, current: i + batch.length }));
            await new Promise(r => setTimeout(r, 0));
        }
        Array.from(ytGroups.values()).forEach(yt => signals.push({ ...yt, sourceType: 'youtube' }));

        const amzGroups = new Map<string, AmazonMetric>();
        for (let i = 0; i < amazonMetrics.length; i += BATCH_SIZE) {
            const batch = amazonMetrics.slice(i, i + BATCH_SIZE);
            batch.forEach(m => {
                const key = `${m.asin}_${m.reportType}_${m.creatorConnectionsType || ''}`;
                if (!amzGroups.has(key)) amzGroups.set(key, { ...m });
                else {
                    const ex = amzGroups.get(key)!;
                    ex.revenue += m.revenue;
                    ex.clicks += m.clicks;
                    ex.orderedItems += m.orderedItems;
                }
            });
            setProcessProgress(prev => ({ ...prev!, current: youtubeMetrics.length + i + batch.length }));
            await new Promise(r => setTimeout(r, 0));
        }
        Array.from(amzGroups.values()).forEach(amz => signals.push({ ...amz, sourceType: 'amazon' }));

        setStagedData(signals);
        setIsProcessing(false);
        setProcessProgress(null);
    };

    const handleStepUpload = async (files: File[]) => {
        if (files.length === 0) return;
        setIsProcessing(true);
        try {
            if (importStep === 1) {
                // Enriching YouTube Metadata with a separate report upload
                const extraYt: YouTubeMetric[] = [];
                for (const f of files) {
                    const parsed = await parseYouTubeDetailedReport(f, (msg) => console.log(msg));
                    extraYt.push(...parsed);
                }
                
                if (extraYt.length > 0) {
                    // Check if we are currently staging signals. If so, merge metadata into them.
                    const isStagingSignals = Array.isArray(stagedData) && stagedData.length > 0 && stagedData[0].sourceType;
                    
                    if (isStagingSignals) {
                        const ytLookup = new Map(extraYt.map(m => [m.videoId, m]));
                        const enrichedSignals = stagedData!.map(s => {
                            if (s.sourceType === 'youtube' && ytLookup.has(s.videoId)) {
                                const meta = ytLookup.get(s.videoId)!;
                                return { ...s, duration: meta.duration, publishDate: meta.publishDate };
                            }
                            return s;
                        });
                        setStagedData(enrichedSignals);
                        notify(`Enriched ${extraYt.length} staged YouTube signals with metadata.`);
                    } else {
                        // Standard workflow: verify metadata and update existing registry
                        const proposals = extraYt.map(m => ({
                            videoId: m.videoId,
                            title: m.videoTitle,
                            duration: m.duration,
                            publishDate: m.publishDate,
                            selected: true
                        }));
                        setProposedMatches(proposals);
                        setStagedData(extraYt);
                        notify(`Loaded ${extraYt.length} YouTube metadata records for verification.`);
                    }
                }
            } else if (importStep === 2) {
                const amzVideos: AmazonVideo[] = [];
                for (const f of files) {
                    const parsed = await parseAmazonStorefrontVideos(f, (msg) => console.log(msg));
                    amzVideos.push(...parsed);
                }
                setStagedData(amzVideos);
                
                // --- PROPOSE MATCHES ---
                const proposals: any[] = [];
                const ytOnly = metrics.filter(m => m.videoId && !m.asin);
                
                amzVideos.forEach(av => {
                    const avSecs = timeToSeconds(av.duration);
                    const avDate = av.uploadDate ? new Date(av.uploadDate).getTime() : null;
                    
                    ytOnly.forEach(yt => {
                        const ytSecs = timeToSeconds(yt.duration);
                        const ytDate = yt.publishDate ? new Date(yt.publishDate).getTime() : null;
                        
                        let score = 0;
                        if (normalizeStr(yt.subTitle) === normalizeStr(av.videoTitle)) score += 60;
                        if (avSecs !== null && ytSecs !== null && Math.abs(avSecs - ytSecs) <= 2) score += 30;
                        if (avDate !== null && ytDate !== null && Math.abs(avDate - ytDate) <= 86400000 * 2) score += 10;
                        
                        if (score >= 40) {
                            proposals.push({ yt, av, score, selected: score >= 90 });
                        }
                    });
                });
                setProposedMatches(proposals);

            } else if (importStep === 3) {
                const mappings: any[] = [];
                for (const f of files) {
                    const parsed = await parseVideoAsinMapping(f, (msg) => console.log(msg));
                    mappings.push(...parsed);
                }
                setStagedData(mappings);
            }
        } catch (err: any) {
            notify(err.message || "Error processing file.", "error");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCommitStaged = async () => {
        if (!stagedData) return;
        setIsProcessing(true);
        
        if (importStep === 1) {
            // Check if we are committing supplemental metadata to existing registry
            const isSupplementalMeta = proposedMatches.length > 0 && Array.isArray(stagedData) && stagedData[0]?.sourceType === undefined;
            
            if (isSupplementalMeta) {
                const selectedMeta = proposedMatches.filter(p => p.selected);
                const updatedMetrics = [...metrics];
                selectedMeta.forEach(meta => {
                    const target = updatedMetrics.find(m => m.videoId === meta.videoId);
                    if (target) {
                        target.duration = meta.duration;
                        target.publishDate = meta.publishDate;
                    }
                });
                onSaveMetrics(updatedMetrics);
                notify(`Enriched ${selectedMeta.length} YouTube records.`);
                setProposedMatches([]);
                setStagedData(null);
                setIsProcessing(false);
                return;
            }

            const allSignals = stagedData as any[];
            const existingMap = new Map(metrics.map(m => [m.id, m]));
            
            const asinToTitle = new Map<string, string>();
            allSignals.forEach(s => {
                if (s.sourceType === 'amazon' && s.reportType !== 'creator_connections' && s.productTitle) {
                    const currentBest = asinToTitle.get(s.asin);
                    if (!currentBest || s.productTitle.length < currentBest.length) {
                        asinToTitle.set(s.asin, s.productTitle);
                    }
                }
            });

            setProcessProgress({ current: 0, total: allSignals.length, label: 'Consolidating logic...' });

            for (let i = 0; i < allSignals.length; i++) {
                const s = allSignals[i];
                if (s.sourceType === 'youtube') {
                    if (existingMap.has(s.videoId)) {
                        const ex = existingMap.get(s.videoId)!;
                        ex.views = s.views;
                        const otherRev = ex.totalRevenue - ex.videoEstimatedRevenue;
                        ex.videoEstimatedRevenue = s.estimatedRevenue;
                        ex.totalRevenue = s.estimatedRevenue + otherRev;
                        ex.publishDate = s.publishDate;
                        ex.duration = s.duration;
                    } else {
                        existingMap.set(s.videoId, {
                            id: s.videoId, videoId: s.videoId, asin: '', mainTitle: s.videoTitle, subTitle: s.videoTitle,
                            views: s.views, watchTimeHours: s.watchTimeHours, subsGained: s.subscribersGained,
                            videoEstimatedRevenue: s.estimatedRevenue, amazonOnsiteRevenue: 0, amazonOffsiteRevenue: 0,
                            creatorConnectionsOnsiteRevenue: 0, creatorConnectionsOffsiteRevenue: 0, totalRevenue: s.estimatedRevenue, clicks: s.impressions,
                            orderedItems: 0, shippedItems: 0, publishDate: s.publishDate, duration: s.duration
                        });
                    }
                } else {
                    const amz = s;
                    const existing = Array.from(existingMap.values()).find(m => m.asin === amz.asin);
                    
                    if (!existing) {
                        const id = `amz_${amz.asin}`;
                        const displayTitle = asinToTitle.get(amz.asin) || amz.productTitle;
                        existingMap.set(id, {
                            id, asin: amz.asin, mainTitle: displayTitle, subTitle: displayTitle,
                            views: 0, watchTimeHours: 0, subsGained: 0, videoEstimatedRevenue: 0,
                            amazonOnsiteRevenue: amz.reportType === 'onsite' ? amz.revenue : 0,
                            amazonOffsiteRevenue: amz.reportType === 'offsite' ? amz.revenue : 0,
                            creatorConnectionsOnsiteRevenue: (amz.reportType === 'creator_connections' && amz.creatorConnectionsType === 'onsite') ? amz.revenue : 0,
                            creatorConnectionsOffsiteRevenue: (amz.reportType === 'creator_connections' && amz.creatorConnectionsType === 'offsite') ? amz.revenue : 0,
                            totalRevenue: amz.revenue, clicks: amz.clicks,
                            orderedItems: amz.orderedItems, shippedItems: amz.shippedItems,
                            publishDate: amz.saleDate
                        });
                    } else {
                        if (amz.reportType === 'onsite') existing.amazonOnsiteRevenue = amz.revenue;
                        else if (amz.reportType === 'offsite') existing.amazonOffsiteRevenue = amz.revenue;
                        else if (amz.reportType === 'creator_connections') {
                            if (amz.creatorConnectionsType === 'onsite') existing.creatorConnectionsOnsiteRevenue = amz.revenue;
                            else existing.creatorConnectionsOffsiteRevenue = amz.revenue;
                            
                            if (asinToTitle.has(amz.asin)) {
                                const newBest = asinToTitle.get(amz.asin)!;
                                if (newBest.length < existing.mainTitle.length) {
                                    existing.mainTitle = newBest;
                                }
                            }
                        }
                        existing.totalRevenue = existing.videoEstimatedRevenue + existing.amazonOnsiteRevenue + existing.amazonOffsiteRevenue + existing.creatorConnectionsOnsiteRevenue + existing.creatorConnectionsOffsiteRevenue;
                        existing.clicks += amz.clicks;
                        existing.orderedItems += amz.orderedItems;
                    }
                }
                if (i % 50 === 0) {
                    setProcessProgress(prev => ({ ...prev!, current: i }));
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            onSaveMetrics(Array.from(existingMap.values()));
            notify(`Merged ${allSignals.length} platform signals.`);
            setImportStep(2);
        } else if (importStep === 2) {
            const amzVideos = stagedData as AmazonVideo[];
            const updatedMetrics = [...metrics];
            setProcessProgress({ current: 0, total: amzVideos.length, label: 'Cross-referencing video fingerprints...' });
            
            // Apply selected proposals
            const selectedLinks = proposedMatches.filter(p => p.selected);
            selectedLinks.forEach(link => {
                const m = updatedMetrics.find(um => um.id === link.yt.id);
                if (m) {
                    m.duration = link.av.duration;
                    m.subTitle = link.av.videoTitle;
                }
            });

            // Fallback: Automatic score matching for non-conflicted items
            for (let i = 0; i < amzVideos.length; i++) {
                const av = amzVideos[i];
                // Only if not already handled by a proposal
                if (selectedLinks.some(l => l.av.videoTitle === av.videoTitle)) continue;

                const match = updatedMetrics.find(m => {
                    let score = 0;
                    if (normalizeStr(m.subTitle) === normalizeStr(av.videoTitle)) score += 50;
                    if (m.duration === av.duration) score += 30;
                    if (m.publishDate === av.uploadDate) score += 20;
                    return score >= 50;
                });
                
                if (match) {
                    match.duration = av.duration;
                    match.subTitle = match.subTitle || av.videoTitle; 
                }
                if (i % 50 === 0) {
                    setProcessProgress(prev => ({ ...prev!, current: i }));
                    await new Promise(r => setTimeout(r, 0));
                }
            }
            onSaveMetrics(updatedMetrics);
            notify(`Synced video metadata.`);
            setProposedMatches([]);
            setImportStep(3);
        } else if (importStep === 3) {
            const mappings = stagedData as Partial<AmazonVideo>[];
            const updatedMetrics = [...metrics];
            setProcessProgress({ current: 0, total: mappings.length, label: 'Finalizing ASIN linkages...' });
            
            for (let i = 0; i < mappings.length; i++) {
                const map = mappings[i];
                const target = updatedMetrics.find(m => 
                    normalizeStr(m.subTitle) === normalizeStr(map.videoTitle!) || 
                    normalizeStr(m.mainTitle) === normalizeStr(map.videoTitle!)
                );
                if (target && map.asins && map.asins.length > 0) {
                    target.asin = map.asins[0];
                    target.asins = map.asins;
                    const orphans = updatedMetrics.filter(m => m.id !== target.id && !m.videoId && (m.asin === target.asin || target.asins?.includes(m.asin)));
                    orphans.forEach(o => {
                        target.amazonOnsiteRevenue += o.amazonOnsiteRevenue;
                        target.amazonOffsiteRevenue += o.amazonOffsiteRevenue;
                        target.creatorConnectionsOnsiteRevenue += o.creatorConnectionsOnsiteRevenue;
                        target.creatorConnectionsOffsiteRevenue += o.creatorConnectionsOffsiteRevenue;
                        target.totalRevenue = target.videoEstimatedRevenue + target.amazonOnsiteRevenue + target.amazonOffsiteRevenue + target.creatorConnectionsOnsiteRevenue + target.creatorConnectionsOffsiteRevenue;
                        target.clicks += o.clicks;
                        target.orderedItems += o.orderedItems;
                    });
                    orphans.forEach(o => {
                        const idx = updatedMetrics.findIndex(m => m.id === o.id);
                        if (idx > -1) updatedMetrics.splice(idx, 1);
                    });
                }
                if (i % 20 === 0) {
                    setProcessProgress(prev => ({ ...prev!, current: i }));
                    await new Promise(r => setTimeout(r, 0));
                }
            }
            onSaveMetrics(updatedMetrics);
            notify(`Unified Content Registry.`);
            setActiveTab('dashboard');
        }
        setStagedData(null);
        setIsProcessing(false);
        setProcessProgress(null);
    };

    const toggleTypeFilter = (type: string) => {
        const next = new Set(selectedTypes);
        if (next.has(type)) next.delete(type); else next.add(type);
        setSelectedTypes(next);
        setCurrentPage(1);
    };

    const toggleYearFilter = (year: string) => {
        const next = new Set(selectedYears);
        if (year === 'all') setSelectedYears(new Set(['all']));
        else {
            next.delete('all');
            if (next.has(year)) {
                next.delete(year);
                if (next.size === 0) next.add('all');
            } else next.add(year);
            setSelectedYears(next);
        }
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <header className="flex justify-between items-center px-1">
                <div className="flex items-center gap-4">
                    <VideoIcon className="w-10 h-10 text-indigo-600" />
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Video Product Joiner</h1>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Unified Yield Analytics</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200">
                        {['dashboard', 'data', 'insights', 'importer'].map(tab => (
                            <button 
                                key={tab} 
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    {metrics.length > 0 && (
                        <button onClick={() => setShowClearConfirm(true)} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Wipe Registry">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 min-h-0 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 flex flex-col h-full animate-fade-in">
                        <div className="grid grid-cols-4 gap-6 flex-shrink-0">
                            <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden group">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 relative z-10">Aggregate Portfolio Yield</p>
                                <p className="text-3xl font-black relative z-10">{formatCurrency(summary.revenue)}</p>
                                <TrendingUpIcon className="absolute -right-6 -bottom-6 w-24 h-24 opacity-10 text-white group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfolio Reach</p>
                                <p className="text-2xl font-black text-slate-800">{formatNumber(summary.views)} <span className="text-[10px] text-slate-400">VIEWS</span></p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Shopper Clicks</p>
                                <p className="text-2xl font-black text-slate-800">{formatNumber(summary.clicks)}</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sale Conversion</p>
                                <p className="text-2xl font-black text-emerald-600">{summary.clicks > 0 ? ((summary.items / summary.clicks) * 100).toFixed(1) : 0}%</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-slate-50/50 flex flex-wrap justify-between items-center px-6 gap-4">
                                <div className="relative w-80 group">
                                    <input 
                                        type="text" 
                                        placeholder="Filter Content Portfolio..." 
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-xs focus:ring-0 focus:border-indigo-500 outline-none font-bold transition-all shadow-sm"
                                    />
                                    <SearchCircleIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-white rounded-xl border-2 border-slate-100 hover:border-indigo-200">
                                        <input type="checkbox" checked={mergeAsins} onChange={() => { setMergeAsins(!mergeAsins); setCurrentPage(1); }} className="rounded text-indigo-600 h-4 w-4" />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pivot by ASIN</span>
                                    </label>
                                    <div className="h-4 w-px bg-slate-200" />
                                    <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="p-2 border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-500 bg-white outline-none">
                                        {[100, 200, 500, 1000].map(r => <option key={r} value={r}>{r} rows</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('mainTitle')}>
                                                <div className="flex items-center gap-2">Asset Performance Identifier <SortIcon className="w-3 h-3"/></div>
                                            </th>
                                            <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('views')}>
                                                <div className="flex items-center justify-end gap-2">Reach <SortIcon className="w-3 h-3"/></div>
                                            </th>
                                            <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('totalRevenue')}>
                                                <div className="flex items-center justify-end gap-2">Combined Yield <SortIcon className="w-3 h-3"/></div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {paginatedMetrics.map(m => {
                                            const isSynced = m.videoId && m.asin;
                                            return (
                                                <tr key={m.id} className="hover:bg-indigo-50/30 transition-colors group cursor-pointer" onClick={() => setSelectedAsset(m)}>
                                                    <td className="px-6 py-3 max-w-[400px]">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-800 truncate">{m.mainTitle}</span>
                                                            <div className="flex items-center gap-2 mt-1 overflow-hidden">
                                                                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border whitespace-nowrap transition-colors ${m.videoId ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{m.videoId || 'NO_VID'}</span>
                                                                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border whitespace-nowrap transition-colors ${m.asin ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{m.asin || 'NO_ASIN'}</span>
                                                                <span className="text-[9px] text-slate-300 font-medium italic truncate">{m.subTitle !== m.mainTitle ? m.subTitle : ''}</span>
                                                                {isSynced && <div className="text-indigo-400" title="Source Synced"><CheckCircleIcon className="w-3 h-3" /></div>}
                                                            </div>
                                                            <div className="flex gap-1.5 mt-2">
                                                                {m.videoEstimatedRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="YouTube Income" />}
                                                                {m.amazonOnsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Amazon Onsite Income" />}
                                                                {(m.creatorConnectionsOnsiteRevenue > 0 || m.creatorConnectionsOffsiteRevenue > 0) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Creator Connections" />}
                                                                {m.amazonOffsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Amazon Offsite" />}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <p className="text-xs font-bold text-slate-600 font-mono">{formatNumber(m.views)}</p>
                                                        <p className="text-[8px] text-slate-400 font-black uppercase">{formatNumber(m.clicks)} CLICKS</p>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <p className="text-sm font-black text-indigo-600 font-mono">{formatCurrency(m.totalRevenue)}</p>
                                                        {m.totalRevenue > 0 && <p className="text-[7px] font-black text-slate-300 uppercase">ROI ACTIVE</p>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="p-3 bg-slate-50 border-t flex justify-between items-center px-8">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{displayMetrics.length} Active Records</p>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] text-slate-500 font-black">PAGE {currentPage} / {totalPages || 1}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4"/></button>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronRightIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4 h-full flex flex-col animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aggregate ROI</p>
                                <p className="text-2xl font-black text-emerald-600">{formatCurrency(summary.revenue)}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aggregate Reach</p>
                                <p className="text-2xl font-black text-slate-800">{formatNumber(summary.views)}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filtered Records</p>
                                <p className="text-2xl font-black text-indigo-600">{displayMetrics.length}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Year Filter</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleYearFilter('all')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${selectedYears.has('all') ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}>ALL</button>
                                        {availableYears.map(y => (
                                            <button key={y} onClick={() => toggleYearFilter(y)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${selectedYears.has(y) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}>{y}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type Filter</span>
                                    <div className="flex gap-1">
                                        {[
                                            { id: 'youtube', label: 'YouTube' },
                                            { id: 'onsite', label: 'Onsite' },
                                            { id: 'offsite', label: 'Offsite' },
                                            { id: 'creator_onsite', label: 'CC On' },
                                            { id: 'creator_offsite', label: 'CC Off' }
                                        ].map(t => (
                                            <label key={t.id} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase cursor-pointer transition-all border-2 flex items-center gap-2 ${selectedTypes.has(t.id) ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-transparent text-slate-400 hover:bg-slate-100'}`}>
                                                <input type="checkbox" className="hidden" checked={selectedTypes.has(t.id)} onChange={() => toggleTypeFilter(t.id)} />
                                                {selectedTypes.has(t.id) && <CheckCircleIcon className="w-2.5 h-2.5" />}
                                                {t.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Limit</span>
                                <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-white border-2 border-slate-100 rounded-xl text-xs px-2 py-1 font-bold outline-none">
                                    {[100, 500, 1000].map(v => <option key={v} value={v}>{v} records</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm flex-1 overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1 custom-scrollbar">
                                <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Asset Timeline</th>
                                            <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Video / Product Identity</th>
                                            <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">ROI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {paginatedMetrics.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedAsset(m)}>
                                                <td className="px-8 py-2"><span className="text-[8px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{m.publishDate || '---'}</span></td>
                                                <td className="px-8 py-2"><div className="flex flex-col"><span className="text-xs font-black text-slate-800">{m.mainTitle}</span><p className="text-[8px] text-slate-300 font-bold uppercase truncate mt-0.5">{m.subTitle}</p></div></td>
                                                <td className="px-8 py-2 text-right"><span className="text-sm font-black text-emerald-600 font-mono">{formatCurrency(m.totalRevenue)}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-3 bg-slate-50 border-t flex justify-between items-center px-8">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Records {startIndex + 1}-{Math.min(startIndex + rowsPerPage, displayMetrics.length)} of {displayMetrics.length}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-white border rounded-lg disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4"/></button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-white border rounded-lg disabled:opacity-30"><ChevronRightIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'insights' && (
                    <div className="space-y-8 flex flex-col h-full animate-fade-in pb-20 overflow-y-auto custom-scrollbar pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><TrendingUpIcon className="w-6 h-6" /></div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Durability Index</h3>
                                    </div>
                                    <InfoBubble title="Evergreen Performance" content="Ranking assets older than 1 year to determine long-term ROI consistency." />
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {displayMetrics.filter(m => m.publishDate && new Date(m.publishDate) < new Date(new Date().setFullYear(new Date().getFullYear() - 1))).slice(0, 5).map(m => (
                                        <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-indigo-300 transition-all" onClick={() => setSelectedAsset(m)}>
                                            <div className="min-w-0 flex-1 pr-4">
                                                <p className="text-[11px] font-black text-slate-800 truncate">{m.mainTitle}</p>
                                                <p className="text-[9px] text-slate-400 font-black uppercase mt-1">LIFETIME ROI: {formatCurrency(m.totalRevenue)}</p>
                                            </div>
                                            <div className="text-right"><span className="text-[10px] font-black text-indigo-600 bg-white px-3 py-1 rounded-full shadow-sm border border-indigo-50">STABLE</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6 relative overflow-hidden">
                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-white/10 rounded-2xl text-white"><ShieldCheckIcon className="w-6 h-6" /></div>
                                        <h3 className="text-xl font-black uppercase tracking-tighter">Yield Concentration</h3>
                                    </div>
                                    <InfoBubble title="Pareto Audit" content="Measuring how concentrated your revenue is among your top performing content assets." />
                                </div>
                                <div className="relative z-10 space-y-6">
                                    {(() => {
                                        const sorted = [...metrics].sort((a,b) => b.totalRevenue - a.totalRevenue);
                                        const top10Total = sorted.slice(0, 10).reduce((s, m) => s + m.totalRevenue, 0);
                                        const allTotal = sorted.reduce((s, m) => s + m.totalRevenue, 0) || 1;
                                        const pct = (top10Total / allTotal) * 100;
                                        return (
                                            <div className="text-center py-6">
                                                <p className="text-6xl font-black text-indigo-400">{pct.toFixed(0)}%</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Yield driven by top 10 assets</p>
                                                <div className="mt-8 grid grid-cols-2 gap-4">
                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5"><p className="text-[9px] font-black text-slate-500 uppercase mb-1">Avg Asset Yield</p><p className="text-lg font-bold">{formatCurrency(allTotal / metrics.length)}</p></div>
                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5"><p className="text-[9px] font-black text-slate-500 uppercase mb-1">Portfolio Size</p><p className="text-lg font-bold">{metrics.length} Assets</p></div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-[0.03] text-white" />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'importer' && (
                    <div className="max-w-6xl mx-auto w-full space-y-6 py-6 overflow-y-auto custom-scrollbar h-full animate-fade-in pr-2">
                        <div className="text-center space-y-2 mb-8">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Performance Pipeline</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Construct a high-fidelity model from multi-platform reports.</p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { step: 1, title: 'Multi-Stream Ingestion', desc: 'Fetch signals from YouTube and Amazon. Enrich YouTube with durations for Step 2.' },
                                { step: 2, title: 'Video Storefront Sync', desc: 'Verify Proposed matches using Duration/Date fingerprints.' },
                                { step: 3, title: 'Identity Consolidation', desc: 'Apply ASIN mappings to associate content IDs with product SKUs.' }
                            ].map(s => {
                                const isCurrent = importStep === s.step;
                                const isPassed = importStep > s.step;
                                const hasData = isCurrent && stagedData !== null;
                                
                                return (
                                    <div key={s.step} className={`p-6 rounded-3xl border-2 transition-all flex flex-col gap-4 group ${isCurrent ? 'bg-white border-indigo-600 shadow-xl' : isPassed ? 'bg-indigo-50 border-indigo-100 opacity-60' : 'bg-slate-50 border-slate-100 opacity-40 grayscale'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-lg transition-all ${isCurrent ? 'bg-indigo-600 text-white shadow-lg' : isPassed ? 'bg-green-500 text-white shadow-sm' : 'bg-white text-slate-300 border border-slate-100 shadow-inner'}`}>
                                                {isPassed ? <CheckCircleIcon className="w-6 h-6" /> : s.step}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className={`text-lg font-black uppercase tracking-tight ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>{s.title}</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.desc}</p>
                                            </div>
                                            {isCurrent && hasData && (
                                                <button onClick={() => { setStagedData(null); setProposedMatches([]); }} className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-rose-50 hover:text-rose-600 transition-all">Clear Staging</button>
                                            )}
                                        </div>
                                        
                                        {isCurrent && !hasData && (
                                            <div className="animate-fade-in px-2 pb-2">
                                                {s.step === 1 ? (
                                                    <div className="flex flex-col items-center gap-4 p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                                        <div className="flex gap-4">
                                                            <YoutubeIcon className="w-10 h-10 text-red-600 opacity-40" />
                                                            <BoxIcon className="w-10 h-10 text-orange-500 opacity-40" />
                                                        </div>
                                                        <p className="text-sm text-slate-500 text-center max-w-sm">Bring in your integration metrics to build the initial relational database.</p>
                                                        <div className="flex flex-wrap justify-center gap-3">
                                                            <button 
                                                                onClick={handleFetchSignals}
                                                                className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
                                                            >
                                                                <DatabaseIcon className="w-5 h-5" /> Fetch System Signals
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                                        onDragLeave={() => setIsDragging(false)}
                                                        onDrop={e => { e.preventDefault(); setIsDragging(false); handleStepUpload(Array.from(e.dataTransfer.files)); }}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`border-4 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group/drop ${isDragging ? 'border-indigo-600 bg-indigo-50 scale-[1.01]' : 'border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-white'}`}
                                                    >
                                                        <div className={`p-4 bg-white rounded-full shadow-sm transition-all ${isDragging ? 'bg-indigo-600 text-white scale-110' : 'text-slate-300 group-hover/drop:bg-indigo-600 group-hover/drop:text-white'}`}>
                                                            <CloudArrowUpIcon className="w-8 h-8 transition-colors" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="font-black text-slate-800">Select File for Step {s.step}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">XLSX or CSV Format Required</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {isCurrent && hasData && (
                                            <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white space-y-4 animate-slide-up relative overflow-hidden shadow-2xl">
                                                <div className="flex justify-between items-center relative z-10">
                                                    <div>
                                                        <h4 className="text-sm font-black tracking-tight text-indigo-400">Logic Verification Workspace</h4>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stagedData!.length} Extracted Records</p>
                                                    </div>
                                                    <button onClick={handleCommitStaged} className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all active:scale-95 text-[10px] uppercase tracking-widest">
                                                        Synthesize & Advance <ArrowRightIcon className="w-4 h-4"/>
                                                    </button>
                                                </div>

                                                {s.step === 1 && (
                                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <YoutubeIcon className="w-5 h-5 text-red-500" />
                                                            <p className="text-xs font-medium text-slate-300">Missing durations? Upload your YouTube Detailed Video Report here to enrich Step 2 matching.</p>
                                                        </div>
                                                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[9px] font-black uppercase">Enrich YT Meta</button>
                                                    </div>
                                                )}

                                                {s.step === 1 && proposedMatches.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <SparklesIcon className="w-4 h-4 text-indigo-400" />
                                                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verification Engine</h5>
                                                            </div>
                                                            <button 
                                                                onClick={() => {
                                                                    const allSelected = proposedMatches.every(p => p.selected);
                                                                    setProposedMatches(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                                                                }}
                                                                className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:underline"
                                                            >
                                                                {proposedMatches.every(p => p.selected) ? 'Deselect All' : 'Select All'}
                                                            </button>
                                                        </div>
                                                        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                                            {proposedMatches.map((p, idx) => (
                                                                <div key={idx} className={`p-3 rounded-xl border-2 transition-all flex items-center gap-4 ${p.selected ? 'bg-indigo-600/20 border-indigo-500' : 'bg-white/5 border-white/5 opacity-60 hover:opacity-100'}`}>
                                                                    <button 
                                                                        onClick={() => setProposedMatches(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item))}
                                                                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${p.selected ? 'bg-indigo-50 text-white' : 'bg-white/10 text-transparent border border-white/20'}`}
                                                                    >
                                                                        <CheckCircleIcon className="w-3 h-3" />
                                                                    </button>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[10px] font-bold truncate">{p.title}</p>
                                                                        <div className="flex gap-3 mt-1">
                                                                            <span className="text-[8px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-1 rounded">{p.duration || '00:00'}</span>
                                                                            <span className="text-[8px] font-black text-slate-500 uppercase">{p.publishDate}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {s.step === 2 && proposedMatches.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <SparklesIcon className="w-4 h-4 text-amber-400" />
                                                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confidence Match Engine</h5>
                                                            </div>
                                                            <button 
                                                                onClick={() => {
                                                                    const allSelected = proposedMatches.every(p => p.selected);
                                                                    setProposedMatches(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                                                                }}
                                                                className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:underline"
                                                            >
                                                                {proposedMatches.every(p => p.selected) ? 'Deselect All' : 'Select All'}
                                                            </button>
                                                        </div>
                                                        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                                            {proposedMatches.map((p, idx) => (
                                                                <div key={idx} className={`p-3 rounded-xl border-2 transition-all flex items-center gap-4 ${p.selected ? 'bg-indigo-600/20 border-indigo-500' : 'bg-white/5 border-white/5 opacity-60 hover:opacity-100'}`}>
                                                                    <button 
                                                                        onClick={() => setProposedMatches(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item))}
                                                                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${p.selected ? 'bg-indigo-50 text-white' : 'bg-white/10 text-transparent border border-white/20'}`}
                                                                    >
                                                                        <CheckCircleIcon className="w-3 h-3" />
                                                                    </button>
                                                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                                                        <div className="min-w-0">
                                                                            <p className="text-[8px] font-black text-red-500 uppercase">YouTube Source</p>
                                                                            <p className="text-[10px] font-bold truncate">{p.yt.subTitle}</p>
                                                                            <p className="text-[9px] text-slate-500">{p.yt.duration} • {p.yt.publishDate}</p>
                                                                        </div>
                                                                        <div className="min-w-0 border-l border-white/10 pl-4">
                                                                            <p className="text-[8px] font-black text-orange-500 uppercase">Amazon Storefront</p>
                                                                            <p className="text-[10px] font-bold truncate">{p.av.videoTitle}</p>
                                                                            <p className="text-[9px] text-slate-500">{p.av.duration} • {p.av.uploadDate}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right flex flex-col items-end">
                                                                        <span className={`text-[9px] font-black px-1.5 rounded ${p.score > 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.score}% MATCH</span>
                                                                        {p.yt.subTitle === p.av.videoTitle ? <span className="text-[7px] text-slate-500 uppercase mt-1">Exact Title</span> : <span className="text-[7px] text-indigo-400 uppercase mt-1">Fingerprint Match</span>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className="max-h-52 overflow-y-auto border border-white/5 rounded-xl bg-black/20 custom-scrollbar relative z-10">
                                                    <table className="min-w-full text-[9px] border-separate border-spacing-0">
                                                        <thead className="sticky top-0 bg-slate-800 text-slate-400 font-black uppercase tracking-widest">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left">Identity</th>
                                                                <th className="px-3 py-2 text-right">Value/ID</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5 font-mono">
                                                            {stagedData!.slice(0, 100).map((row, i) => (
                                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                                    <td className="px-3 py-1.5 truncate max-w-[200px]">{row.videoTitle || row.productTitle || row.ccTitle || row.title || 'Unknown'}</td>
                                                                    <td className="px-3 py-1.5 text-right text-indigo-400 font-bold">
                                                                        {row.revenue || row.estimatedRevenue ? formatCurrency(row.revenue || row.estimatedRevenue) : (row.duration || row.asin || row.videoId || '-')}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <input type="file" ref={fileInputRef} multiple className="hidden" onChange={(e) => handleStepUpload(Array.from(e.target.files || []))} />
                    </div>
                )}
            </div>

            {/* ASSET DETAIL MODAL - FIXED UI */}
            {selectedAsset && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        {/* Header with better spacing */}
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-white rounded-3xl shadow-sm text-indigo-600"><BarChartIcon className="w-8 h-8" /></div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{selectedAsset.mainTitle}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Institutional Yield Audit</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedAsset(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors shrink-0 ml-4"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>

                        {/* Content Area with Flex Grow and correct scroll */}
                        <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-900 text-white rounded-3xl relative overflow-hidden shadow-lg">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1 relative z-10">Lifetime Value</p>
                                    <p className="text-3xl font-black relative z-10">{formatCurrency(selectedAsset.totalRevenue)}</p>
                                    <DollarSign className="absolute -right-4 -bottom-4 w-20 h-20 text-white opacity-5" />
                                </div>
                                <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Portfolio Reach</p>
                                    <p className="text-3xl font-black text-slate-800">{formatNumber(selectedAsset.views)} <span className="text-[10px] text-slate-400">VIEWS</span></p>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Channel Yield Analysis</h4>
                                <div className="space-y-2">
                                    {[
                                        { label: 'YouTube AdSense', val: selectedAsset.videoEstimatedRevenue, icon: <YoutubeIcon className="w-3.5 h-3.5 text-red-600"/> },
                                        { label: 'Amazon Onsite', val: selectedAsset.amazonOnsiteRevenue, icon: <BoxIcon className="w-3.5 h-3.5 text-blue-600"/> },
                                        { label: 'Amazon Offsite', val: selectedAsset.amazonOffsiteRevenue, icon: <BoxIcon className="w-3.5 h-3.5 text-green-600"/> },
                                        { label: 'Creator Connections (Onsite)', val: selectedAsset.creatorConnectionsOnsiteRevenue, icon: <SparklesIcon className="w-3.5 h-3.5 text-indigo-600"/> },
                                        { label: 'Creator Connections (Offsite)', val: selectedAsset.creatorConnectionsOffsiteRevenue, icon: <SparklesIcon className="w-3.5 h-3.5 text-violet-600"/> }
                                    ].map(item => (
                                        <div key={item.label} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm hover:border-indigo-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                {item.icon}
                                                <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                            </div>
                                            <span className="text-sm font-black font-mono text-slate-900">{formatCurrency(item.val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Performance Logic</p>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-slate-700">{formatNumber(selectedAsset.clicks)} Clicks</p>
                                        <p className="text-sm font-bold text-slate-700">{formatNumber(selectedAsset.orderedItems)} Sales</p>
                                        <p className="text-sm font-black text-emerald-600">{selectedAsset.clicks > 0 ? ((selectedAsset.orderedItems / selectedAsset.clicks) * 100).toFixed(1) : 0}% Conv.</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Institutional Links</p>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-slate-600 truncate">Video ID: <span className="font-bold">{selectedAsset.videoId || 'N/A'}</span></p>
                                        <p className="text-xs font-medium text-slate-600">Product ASIN: <span className="font-bold">{selectedAsset.asin || 'N/A'}</span></p>
                                        <p className="text-xs font-medium text-slate-600">Creation Date: <span className="font-bold text-indigo-600">{selectedAsset.publishDate || '--'}</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer - Fixed UI */}
                        <div className="p-6 bg-slate-50 border-t shrink-0 flex flex-col gap-3">
                            <button 
                                onClick={() => { setSyncTargetAsset(selectedAsset); setIsSyncModalOpen(true); }}
                                className="w-full py-3 bg-indigo-50 text-indigo-600 font-black rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest border border-indigo-100"
                            >
                                <LinkIcon className="w-4 h-4" /> Remap Connection Identity
                            </button>
                            <button onClick={() => setSelectedAsset(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Dismiss Inspector</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SYNC MODAL */}
            {isSyncModalOpen && syncTargetAsset && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[210] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800">Identify Connections</h3>
                            <button onClick={() => setIsSyncModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">Manually link this asset to an identifier if the automatic pipeline failed.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Amazon SKU (ASIN)</label>
                                <input 
                                    type="text" 
                                    value={syncTargetAsset.asin} 
                                    onChange={e => setSyncTargetAsset({ ...syncTargetAsset, asin: e.target.value })}
                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black focus:border-orange-500 outline-none shadow-inner"
                                    placeholder="e.g. B0CM987654"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">YouTube Video ID</label>
                                <input 
                                    type="text" 
                                    value={syncTargetAsset.videoId || ''} 
                                    onChange={e => setSyncTargetAsset({ ...syncTargetAsset, videoId: e.target.value })}
                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black focus:border-red-500 outline-none shadow-inner"
                                    placeholder="e.g. jH11mx9tF9o"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setIsSyncModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500">Discard</button>
                            <button 
                                onClick={() => {
                                    const next = metrics.map(m => m.id === syncTargetAsset.id ? syncTargetAsset : m);
                                    onSaveMetrics(next);
                                    setIsSyncModalOpen(false);
                                    notify("Asset linkages updated successfully");
                                }} 
                                className="flex-2 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 w-full"
                            >
                                Commit Linkages
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PROCESSING OVERLAY */}
            {isProcessing && (
                <div className="fixed inset-0 bg-indigo-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-8 animate-slide-up text-center max-w-md w-full">
                        <div className="relative w-24 h-24">
                            <div className="absolute inset-0 border-8 border-indigo-100 rounded-full" />
                            <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <RepeatIcon className="w-10 h-10 text-indigo-600" />
                            </div>
                        </div>
                        {processProgress ? (
                            <ProgressBar current={processProgress.current} total={processProgress.total} label={processProgress.label} />
                        ) : (
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Synthesizing Logic</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Merging multi-platform signal streams...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmationModal 
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearAll}
                title="Wipe Joiner Registry?"
                message="This will permanently delete all content ROI records. You will need to rerun the ingestion pipeline to restore data."
                confirmLabel="Execute Purge"
                variant="danger"
            />

            {/* TOAST SYSTEM */}
            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] animate-slide-up">
                    <div className={`px-5 py-2.5 rounded-2xl shadow-2xl border flex items-center gap-3 ${toast.type === 'success' ? 'bg-slate-900 text-white border-white/10' : toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' : 'bg-white text-slate-800 border-slate-200 shadow-lg'}`}>
                        <div className={`${toast.type === 'success' ? 'bg-indigo-500' : toast.type === 'error' ? 'bg-white/20' : 'bg-indigo-50'} rounded-full p-1`}>
                            {toast.type === 'success' ? <CheckCircleIcon className="w-3.5 h-3.5 text-white" /> : toast.type === 'error' ? <ExclamationTriangleIcon className="w-3.5 h-3.5 text-white" /> : <InfoIcon className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
                        <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-full ml-1"><CloseIcon className="w-3.5 h-3.5 opacity-50" /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoProductJoiner;

/**
 * Sub-Component for Insights visualization
 */
const InfoBubble: React.FC<{ title: string; content: string }> = ({ title, content }) => (
    <div className="relative group/info inline-block align-middle ml-1">
        <InfoIcon className="w-4 h-4 text-slate-300 cursor-help hover:text-indigo-500 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-800 text-white rounded-lg shadow-xl opacity-0 translate-y-1 pointer-events-none group-hover/info:opacity-100 group-hover/info:translate-y-0 transition-all z-[60] text-[10px] leading-relaxed">
            <p className="font-bold border-b border-white/10 pb-1 mb-1 uppercase tracking-wider">{title}</p>
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);