import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { JoinedMetric, YouTubeMetric, AmazonVideo, AmazonMetric, YouTubeChannel } from '../../types';
import { BoxIcon, YoutubeIcon, CloudArrowUpIcon, BarChartIcon, TableIcon, SparklesIcon, ChevronRightIcon, ChevronDownIcon, CheckCircleIcon, PlayIcon, InfoIcon, ShieldCheckIcon, AddIcon, DeleteIcon, TrashIcon, VideoIcon, SearchCircleIcon, RepeatIcon, CloseIcon, ExclamationTriangleIcon, ArrowRightIcon, TrendingUpIcon, DollarSign, CheckBadgeIcon, DatabaseIcon } from '../../components/Icons';
import { parseAmazonStorefrontVideos, parseVideoAsinMapping } from '../../services/csvParserService';
import { generateUUID } from '../../utils';
import ConfirmationModal from '../../components/ConfirmationModal';
import { api } from '../../services/apiService';

interface Props {
    metrics: JoinedMetric[];
    onSaveMetrics: (metrics: JoinedMetric[]) => void;
    youtubeMetrics?: YouTubeMetric[];
    amazonMetrics?: AmazonMetric[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const VideoProductJoiner: React.FC<Props> = ({ metrics, onSaveMetrics, youtubeMetrics = [], amazonMetrics = [] }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'insights' | 'importer'>('dashboard');
    const [importStep, setImportStep] = useState<number>(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [verificationData, setVerificationData] = useState<any>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Staging state for importer verification
    const [stagedData, setStagedData] = useState<any[] | null>(null);

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [mergeAsins, setMergeAsins] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Channels for recognition
    const [channels, setChannels] = useState<YouTubeChannel[]>([]);
    useEffect(() => {
        api.loadAll().then(data => {
            if (data.youtubeChannels) setChannels(data.youtubeChannels);
        });
    }, []);

    // Notification helper
    const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000);
    };

    // Joined Data Logic
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
                    ex.creatorConnectionsRevenue += m.creatorConnectionsRevenue;
                    ex.videoEstimatedRevenue += m.videoEstimatedRevenue;
                    ex.clicks += m.clicks;
                    ex.orderedItems += m.orderedItems;
                }
            });
            base = Array.from(map.values());
        }

        return base.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [metrics, searchTerm, mergeAsins]);

    const summary = useMemo(() => {
        return displayMetrics.reduce((acc, m) => ({
            revenue: acc.revenue + m.totalRevenue,
            views: acc.views + m.views,
            clicks: acc.clicks + m.clicks,
            items: acc.items + m.orderedItems
        }), { revenue: 0, views: 0, clicks: 0, items: 0 });
    }, [displayMetrics]);

    // Step 1: Fetch Existing Signals (YT + Amazon)
    const handleFetchSignals = () => {
        if (youtubeMetrics.length === 0 && amazonMetrics.length === 0) {
            notify("No integration metrics found to fetch.", "error");
            return;
        }
        setIsProcessing(true);

        const signals: any[] = [];

        // 1. Process YouTube AdSense Signals
        const ytGroups = new Map<string, YouTubeMetric>();
        youtubeMetrics.forEach(m => {
            if (!ytGroups.has(m.videoId)) {
                ytGroups.set(m.videoId, { ...m });
            } else {
                const ex = ytGroups.get(m.videoId)!;
                ex.views += m.views;
                ex.watchTimeHours += m.watchTimeHours;
                ex.subscribersGained += m.subscribersGained;
                ex.estimatedRevenue += m.estimatedRevenue;
            }
        });
        
        Array.from(ytGroups.values()).forEach(yt => {
            signals.push({ ...yt, sourceType: 'youtube' });
        });

        // 2. Process Amazon Earnings Signals
        const amzGroups = new Map<string, AmazonMetric>();
        amazonMetrics.forEach(m => {
            const key = `${m.asin}_${m.reportType}_${m.creatorConnectionsType || ''}`;
            if (!amzGroups.has(key)) {
                amzGroups.set(key, { ...m });
            } else {
                const ex = amzGroups.get(key)!;
                ex.revenue += m.revenue;
                ex.clicks += m.clicks;
                ex.orderedItems += m.orderedItems;
            }
        });

        Array.from(amzGroups.values()).forEach(amz => {
            signals.push({ ...amz, sourceType: 'amazon' });
        });

        setStagedData(signals);
        setIsProcessing(false);
    };

    // Importer Logic
    const handleStepUpload = async (files: File[]) => {
        if (files.length === 0) return;
        setIsProcessing(true);
        try {
            if (importStep === 2) {
                const amzVideos: AmazonVideo[] = [];
                for (const f of files) {
                    const parsed = await parseAmazonStorefrontVideos(f, (msg) => console.log(msg));
                    amzVideos.push(...parsed);
                }
                setStagedData(amzVideos);
            }
            else if (importStep === 3) {
                const mappings: any[] = [];
                for (const f of files) {
                    const parsed = await parseVideoAsinMapping(f, (msg) => console.log(msg));
                    mappings.push(...parsed);
                }
                setStagedData(mappings);
            }
        } catch (err: any) {
            console.error(err);
            notify(err.message || "Error processing file.", "error");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCommitStaged = () => {
        if (!stagedData) return;
        
        if (importStep === 1) {
            const allSignals = stagedData as any[];
            const existingMap = new Map(metrics.map(m => [m.id, m]));
            
            // 1. Process YouTube
            allSignals.filter(s => s.sourceType === 'youtube').forEach(yt => {
                if (existingMap.has(yt.videoId)) {
                    const ex = existingMap.get(yt.videoId)!;
                    ex.views = yt.views;
                    const otherRev = ex.totalRevenue - ex.videoEstimatedRevenue;
                    ex.videoEstimatedRevenue = yt.estimatedRevenue;
                    ex.totalRevenue = yt.estimatedRevenue + otherRev;
                    ex.publishDate = yt.publishDate;
                    ex.duration = yt.duration;
                } else {
                    existingMap.set(yt.videoId, {
                        id: yt.videoId, videoId: yt.videoId, asin: '', mainTitle: yt.videoTitle, subTitle: yt.videoTitle,
                        views: yt.views, watchTimeHours: yt.watchTimeHours, subsGained: yt.subscribersGained,
                        videoEstimatedRevenue: yt.estimatedRevenue, amazonOnsiteRevenue: 0, amazonOffsiteRevenue: 0,
                        creatorConnectionsRevenue: 0, totalRevenue: yt.estimatedRevenue, clicks: yt.impressions,
                        orderedItems: 0, shippedItems: 0, publishDate: yt.publishDate, duration: yt.duration
                    });
                }
            });

            // 2. Process Amazon (Seed Orphans)
            allSignals.filter(s => s.sourceType === 'amazon').forEach(amz => {
                const existing = metrics.find(m => m.asin === amz.asin);
                if (!existing) {
                    // Create unlinked product record
                    const id = `amz_${amz.asin}_${generateUUID().substring(0,4)}`;
                    existingMap.set(id, {
                        id, asin: amz.asin, mainTitle: amz.productTitle, subTitle: amz.productTitle,
                        views: 0, watchTimeHours: 0, subsGained: 0, videoEstimatedRevenue: 0,
                        amazonOnsiteRevenue: amz.reportType === 'onsite' ? amz.revenue : 0,
                        amazonOffsiteRevenue: amz.reportType === 'offsite' ? amz.revenue : 0,
                        creatorConnectionsRevenue: amz.reportType === 'creator_connections' ? amz.revenue : 0,
                        totalRevenue: amz.revenue, clicks: amz.clicks,
                        orderedItems: amz.orderedItems, shippedItems: amz.shippedItems
                    });
                } else {
                    // Update existing unlinked revenue
                    const ex = existing;
                    if (amz.reportType === 'onsite') ex.amazonOnsiteRevenue = amz.revenue;
                    else if (amz.reportType === 'offsite') ex.amazonOffsiteRevenue = amz.revenue;
                    else if (amz.reportType === 'creator_connections') ex.creatorConnectionsRevenue = amz.revenue;
                    ex.totalRevenue = ex.videoEstimatedRevenue + ex.amazonOnsiteRevenue + ex.amazonOffsiteRevenue + ex.creatorConnectionsRevenue;
                }
            });

            onSaveMetrics(Array.from(existingMap.values()));
            notify(`Ingested ${allSignals.length} signal records.`);
            setImportStep(2);
        } else if (importStep === 2) {
            const amzVideos = stagedData as AmazonVideo[];
            const matches: any[] = [];
            const candidates: any[] = [];
            
            amzVideos.forEach(av => {
                const normAmz = normalizeStr(av.videoTitle);
                // REQUIREMENT: Must match Duration AND Date
                const match = metrics.find(m => 
                    (m.duration === av.duration && m.publishDate === av.uploadDate) ||
                    (normalizeStr(m.subTitle) === normAmz)
                );
                
                if (match) {
                    matches.push({ videoId: match.videoId, amzTitle: av.videoTitle });
                    // Store Amazon metadata on the record but keep YouTube title if it already exists
                    match.duration = av.duration;
                    // If subTitle is currently just product title or placeholder, use Amazon title, but prefer YouTube title
                    // For now we assume if it has a videoId, the current subTitle IS the YouTube title
                } else {
                    // Potential candidates for user review: Duration + Date match is very strong, so highlight it
                    const durDateMatch = metrics.find(m => m.duration === av.duration && m.publishDate === av.uploadDate && !m.asin);
                    if (durDateMatch) candidates.push({ yt: durDateMatch, amz: av });
                }
            });

            if (candidates.length > 0) {
                setVerificationData({ candidates, matches });
            } else {
                onSaveMetrics([...metrics]);
                notify(`Synchronized ${matches.length} video metadata records.`);
                setImportStep(3);
            }
        } else if (importStep === 3) {
            const mappings = stagedData as Partial<AmazonVideo>[];
            const updatedMetrics = [...metrics];
            let count = 0;
            mappings.forEach(map => {
                // Find either by YouTube Title (main) or Amazon Title (sub)
                const target = updatedMetrics.find(m => 
                    normalizeStr(m.subTitle) === normalizeStr(map.videoTitle!) || 
                    normalizeStr(m.mainTitle) === normalizeStr(map.videoTitle!)
                );
                if (target && map.asins && map.asins.length > 0) {
                    target.asin = map.asins[0];
                    target.asins = map.asins;
                    
                    // Final aggregation: Link the orphan Amazon revenue from Step 1 to this Video
                    const orphans = updatedMetrics.filter(m => !m.videoId && (m.asin === target.asin || target.asins?.includes(m.asin)));
                    orphans.forEach(o => {
                        target.amazonOnsiteRevenue += o.amazonOnsiteRevenue;
                        target.amazonOffsiteRevenue += o.amazonOffsiteRevenue;
                        target.creatorConnectionsRevenue += o.creatorConnectionsRevenue;
                        target.totalRevenue = target.videoEstimatedRevenue + target.amazonOnsiteRevenue + target.amazonOffsiteRevenue + target.creatorConnectionsRevenue;
                        target.clicks += o.clicks;
                        target.orderedItems += o.orderedItems;
                    });
                    
                    // Remove orphans since they are now aggregated
                    orphans.forEach(o => {
                        const idx = updatedMetrics.findIndex(m => m.id === o.id);
                        if (idx > -1) updatedMetrics.splice(idx, 1);
                    });

                    count++;
                }
            });
            onSaveMetrics(updatedMetrics);
            notify(`Finalized ${count} content-to-product links.`);
            setActiveTab('dashboard');
        }
        setStagedData(null);
    };

    const handleClearAll = async () => {
        try {
            await api.resetDatabase(['joinedMetrics']);
            onSaveMetrics([]);
            notify("Database wiped successfully", "info");
        } catch (e) {
            notify("Wipe operation failed", "error");
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <header className="flex justify-between items-center px-1">
                <div className="flex items-center gap-4">
                    <VideoIcon className="w-10 h-10 text-indigo-600" />
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Video Product Joiner</h1>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Multi-Platform ROI Logic</p>
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
                    {activeTab === 'dashboard' && metrics.length > 0 && (
                        <button onClick={() => setShowClearConfirm(true)} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Wipe Registry">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 min-h-0 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 flex flex-col h-full animate-fade-in">
                        <div className="grid grid-cols-4 gap-6">
                            <div className="bg-slate-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden group">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 relative z-10">Total Aggregate Yield</p>
                                <p className="text-4xl font-black relative z-10">{formatCurrency(summary.revenue)}</p>
                                <TrendingUpIcon className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 text-white group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Views</p>
                                <p className="text-3xl font-black text-slate-800">{formatNumber(summary.views)}</p>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Click Reach</p>
                                <p className="text-3xl font-black text-slate-800">{formatNumber(summary.clicks)}</p>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conversion Efficiency</p>
                                <p className="text-3xl font-black text-emerald-600">{summary.clicks > 0 ? ((summary.items / summary.clicks) * 100).toFixed(1) : 0}%</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center px-6">
                                <div className="relative w-96 group">
                                    <input 
                                        type="text" 
                                        placeholder="Search products or IDs..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm focus:ring-0 focus:border-indigo-500 outline-none font-bold transition-all"
                                    />
                                    <SearchCircleIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer px-5 py-2.5 bg-white rounded-xl border-2 border-slate-100 transition-all hover:border-indigo-200 group">
                                    <input type="checkbox" checked={mergeAsins} onChange={() => setMergeAsins(!mergeAsins)} className="rounded text-indigo-600 h-4 w-4" />
                                    <span className="text-[10px] font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-widest">Pivot by ASIN</span>
                                </label>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Performance Asset</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">YouTube Signals</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">AdSense</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amazon Rev</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Net Yield</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {displayMetrics.map(m => (
                                            <tr key={m.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="px-8 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800">{m.subTitle || m.mainTitle}</span>
                                                        <div className="flex items-center gap-3 mt-1.5">
                                                            <span className="text-[8px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shadow-sm">{m.videoId || 'ORPHAN'}</span>
                                                            {m.mainTitle !== m.subTitle && m.mainTitle && (
                                                                <span className="text-[10px] text-slate-400 font-medium italic">{m.mainTitle}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4 text-right text-sm font-bold text-slate-600 font-mono">
                                                    <div className="flex flex-col items-end">
                                                        <span>{formatNumber(m.views)} <span className="text-[9px] text-slate-400 uppercase">Views</span></span>
                                                        <span className="text-[9px] text-slate-400 font-medium">{formatNumber(m.subsGained)} Subs</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4 text-right text-sm font-bold text-slate-500 font-mono">{formatCurrency(m.videoEstimatedRevenue)}</td>
                                                <td className="px-8 py-4 text-right text-sm font-bold text-slate-500 font-mono">{formatCurrency(m.amazonOnsiteRevenue + m.amazonOffsiteRevenue + m.creatorConnectionsRevenue)}</td>
                                                <td className="px-8 py-4 text-right text-base font-black text-indigo-600 font-mono">{formatCurrency(m.totalRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'importer' && (
                    <div className="max-w-4xl mx-auto w-full space-y-6 py-6 overflow-y-auto custom-scrollbar h-full animate-fade-in">
                        <div className="text-center space-y-2 mb-8">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Performance Pipeline</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Construct a high-fidelity model from multi-platform reports.</p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { step: 1, title: 'Platform Ingestion', desc: 'Fetch existing signals from YouTube and Amazon integrations.' },
                                { step: 2, title: 'Storefront Synchronization', desc: 'Match video records using Duration and Upload Date.' },
                                { step: 3, title: 'Identity Mapping', desc: 'Upload ASIN Mapping to associate content with SKUs.' }
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
                                                <button onClick={() => setStagedData(null)} className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-rose-50 hover:text-rose-600 transition-all">Clear Staging</button>
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
                                                        <p className="text-sm text-slate-500 text-center max-w-sm">Synchronize the joiner with your existing platform metrics to create the logical base.</p>
                                                        <button 
                                                            onClick={handleFetchSignals}
                                                            className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
                                                        >
                                                            <DatabaseIcon className="w-5 h-5" /> Fetch Platform Signals
                                                        </button>
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
                                                <input type="file" ref={fileInputRef} multiple className="hidden" onChange={(e) => handleStepUpload(Array.from(e.target.files || []))} />
                                            </div>
                                        )}

                                        {isCurrent && hasData && (
                                            <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white space-y-4 animate-slide-up relative overflow-hidden shadow-2xl">
                                                <div className="flex justify-between items-center relative z-10">
                                                    <div>
                                                        <h4 className="text-sm font-black tracking-tight text-indigo-400">Logic Verification Staging</h4>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stagedData!.length} Logical Records Extracted</p>
                                                    </div>
                                                    <button onClick={handleCommitStaged} className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all active:scale-95 text-[10px] uppercase tracking-widest">
                                                        Commit & Advance <ArrowRightIcon className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                                
                                                <div className="max-h-52 overflow-y-auto border border-white/5 rounded-xl bg-black/20 custom-scrollbar relative z-10">
                                                    <table className="min-w-full text-[9px] border-separate border-spacing-0">
                                                        <thead className="sticky top-0 bg-slate-800 text-slate-400 font-black uppercase tracking-widest">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left">Descriptor</th>
                                                                <th className="px-3 py-2 text-right">Value</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5 font-mono">
                                                            {stagedData!.slice(0, 100).map((row, i) => (
                                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                                    <td className="px-3 py-1.5">{row.videoTitle || row.productTitle || row.ccTitle || row.title || 'Unknown'}</td>
                                                                    <td className="px-3 py-1.5 text-right text-indigo-400 font-bold">
                                                                        {row.revenue || row.estimatedRevenue ? formatCurrency(row.revenue || row.estimatedRevenue) : (row.duration || row.asins?.join(', ') || '-')}
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

                        <div className="pt-6 flex flex-col items-center gap-3">
                            <button 
                                onClick={() => setShowResetConfirm(true)}
                                className="px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 font-black rounded-xl text-[9px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 group"
                            >
                                <RepeatIcon className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" /> Reset Importer
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Verification Modals */}
            <ConfirmationModal 
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={() => { setImportStep(1); setStagedData(null); setShowResetConfirm(false); notify("Logic pipeline reset", "info"); }}
                title="Reset logic pipeline?"
                message="Your current staging progress for this batch will be lost. Existing metrics in your database remain untouched."
                confirmLabel="Reset Sequence"
                variant="warning"
            />

            <ConfirmationModal 
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearAll}
                title="Wipe Multi-Platform Registry?"
                message="This will permanently delete all joined metrics, product associations, and content ROI records. This cannot be undone."
                confirmLabel="Execute Wipe"
                variant="danger"
            />

            {/* DURATION & DATE COLLISION MODAL */}
            {verificationData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><SparklesIcon className="w-6 h-6" /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Ambiguous Metadata Match</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{verificationData.candidates.length} Duration & Date Collisions Detected</p>
                                </div>
                            </div>
                            <button onClick={() => setVerificationData(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-slate-50/20">
                            {verificationData.candidates.map((c: any, idx: number) => (
                                <div key={idx} className="bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6 items-center relative overflow-hidden">
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">YouTube Metadata (Source of Truth)</p>
                                        <p className="text-xs font-black text-slate-800">{c.yt.subTitle || c.yt.mainTitle}</p>
                                        <div className="flex gap-3 text-[9px] font-bold text-slate-400 uppercase">
                                            <span>Dur: {c.yt.duration}</span>
                                            <span>Published: {c.yt.publishDate}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Amazon Candidate Information</p>
                                        <p className="text-xs font-black text-slate-800">{c.amz.videoTitle}</p>
                                        <div className="flex gap-3 text-[9px] font-bold text-slate-400 uppercase">
                                            <span>Dur: {c.amz.duration}</span>
                                            <span>Uploaded: {c.amz.uploadDate}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex justify-center gap-3 pt-3 border-t border-slate-50">
                                        <button onClick={() => { 
                                            const next = [...verificationData.candidates]; 
                                            next.splice(idx, 1); 
                                            setVerificationData({ ...verificationData, candidates: next }); 
                                            if (next.length === 0) { setVerificationData(null); setImportStep(3); } 
                                        }} className="px-5 py-1.5 bg-slate-100 text-slate-500 font-black rounded-lg text-[9px] uppercase hover:bg-slate-200 transition-all">Deny Match</button>
                                        <button onClick={() => { 
                                            const target = metrics.find(m => m.videoId === c.yt.videoId); 
                                            if (target) {
                                                // Keep the YouTube title as subTitle, use Amazon's as reference for mapping
                                                target.id = c.yt.videoId; 
                                                // Use YouTube's metadata as anchor
                                            }
                                            const next = [...verificationData.candidates]; 
                                            next.splice(idx, 1); 
                                            setVerificationData({ ...verificationData, candidates: next }); 
                                            if (next.length === 0) { 
                                                onSaveMetrics([...metrics]);
                                                setVerificationData(null); 
                                                setImportStep(3); 
                                            } 
                                        }} className="px-8 py-1.5 bg-indigo-600 text-white font-black rounded-lg text-[9px] uppercase shadow-md transition-all">Confirm Match</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-white border-t flex justify-end">
                            <button onClick={() => { setVerificationData(null); setImportStep(3); }} className="px-8 py-2.5 bg-slate-900 text-white font-black rounded-xl text-xs uppercase shadow-lg transition-all active:scale-95">Skip All</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PROCESSING OVERLAY */}
            {isProcessing && (
                <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm z-[250] flex items-center justify-center">
                    <div className="bg-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 animate-slide-up text-center">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Synthesizing Batch</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Parsing Signal Hierarchy...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST SYSTEM */}
            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] animate-slide-up">
                    <div className={`px-5 py-2.5 rounded-2xl shadow-2xl border flex items-center gap-3 ${toast.type === 'success' ? 'bg-slate-900 text-white border-white/10' : toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' : 'bg-white text-slate-800 border-slate-200 shadow-lg'}`}>
                        <div className={`${toast.type === 'success' ? 'bg-indigo-500' : toast.type === 'error' ? 'bg-white/20' : 'bg-indigo-50'} rounded-full p-1`}>
                            {toast.type === 'success' ? <CheckCircleIcon className="w-3.5 h-3.5 text-white" /> : toast.type === 'error' ? <ExclamationTriangleIcon className="w-3.5 h-3.5" /> : <InfoIcon className="w-3.5 h-3.5 text-indigo-600" />}
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