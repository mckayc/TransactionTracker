
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { JoinedMetric, YouTubeMetric, AmazonVideo, AmazonMetric, YouTubeChannel } from '../../types';
import { BoxIcon, YoutubeIcon, CloudArrowUpIcon, BarChartIcon, TableIcon, SparklesIcon, ChevronRightIcon, ChevronDownIcon, CheckCircleIcon, PlayIcon, InfoIcon, ShieldCheckIcon, AddIcon, DeleteIcon, TrashIcon, VideoIcon, SearchCircleIcon, RepeatIcon, CloseIcon, ExclamationTriangleIcon } from '../../components/Icons';
import { parseYouTubeDetailedReport, parseAmazonStorefrontVideos, parseVideoAsinMapping, parseAmazonEarningsReport, parseCreatorConnectionsReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';
import ConfirmationModal from '../../components/ConfirmationModal';
import { api } from '../../services/apiService';

interface Props {
    metrics: JoinedMetric[];
    onSaveMetrics: (metrics: JoinedMetric[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const VideoProductJoiner: React.FC<Props> = ({ metrics, onSaveMetrics }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'insights' | 'importer'>('dashboard');
    const [importStep, setImportStep] = useState<number>(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [verificationData, setVerificationData] = useState<any>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [mergeAsins, setMergeAsins] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

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

    // YouTube filename logic
    const detectChannelFromFileName = (fileName: string): string => {
        const lowerName = fileName.toLowerCase().replace(/\s+/g, '');
        const matched = channels.find(c => {
            const strippedChannel = c.name.toLowerCase().replace(/\s+/g, '');
            return lowerName.includes(strippedChannel);
        });
        return matched ? matched.name : '';
    };

    // Importer Logic
    const handleStepUpload = async (files: File[]) => {
        if (files.length === 0) return;

        setIsProcessing(true);
        try {
            if (importStep === 1) {
                // YouTube Data
                const allYt: YouTubeMetric[] = [];
                for (const f of files) {
                    const parsed = await parseYouTubeDetailedReport(f, (msg) => console.log(msg));
                    const channelName = detectChannelFromFileName(f.name);
                    allYt.push(...parsed.map(p => ({ ...p, channelName })));
                }
                
                const newMetrics: JoinedMetric[] = allYt.map(yt => ({
                    id: yt.videoId,
                    videoId: yt.videoId,
                    asin: '', // To be matched
                    mainTitle: yt.videoTitle,
                    subTitle: yt.videoTitle,
                    views: yt.views,
                    watchTimeHours: yt.watchTimeHours,
                    subsGained: yt.subscribersGained,
                    videoEstimatedRevenue: yt.estimatedRevenue,
                    amazonOnsiteRevenue: 0,
                    amazonOffsiteRevenue: 0,
                    creatorConnectionsRevenue: 0,
                    totalRevenue: yt.estimatedRevenue,
                    clicks: yt.impressions, // Map impressions to clicks for baseline
                    orderedItems: 0,
                    shippedItems: 0,
                    publishDate: yt.publishDate,
                    duration: yt.duration
                }));
                
                const existingMap = new Map(metrics.map(m => [m.id, m]));
                newMetrics.forEach(n => {
                    if (existingMap.has(n.id)) {
                        const ex = existingMap.get(n.id)!;
                        ex.views = n.views;
                        ex.totalRevenue = n.totalRevenue + (ex.totalRevenue - ex.videoEstimatedRevenue);
                        ex.videoEstimatedRevenue = n.videoEstimatedRevenue;
                    } else {
                        existingMap.set(n.id, n);
                    }
                });
                onSaveMetrics(Array.from(existingMap.values()));
                notify(`Successfully imported ${newMetrics.length} YouTube records.`);
                setImportStep(2);
            } 
            else if (importStep === 2) {
                // Amazon Storefront Video Match
                const amzVideos: AmazonVideo[] = [];
                for (const f of files) {
                    const parsed = await parseAmazonStorefrontVideos(f, (msg) => console.log(msg));
                    amzVideos.push(...parsed);
                }

                const matches: any[] = [];
                const candidates: any[] = [];

                amzVideos.forEach(av => {
                    const normAmz = normalizeStr(av.videoTitle);
                    const match = metrics.find(m => 
                        normalizeStr(m.mainTitle) === normAmz || 
                        (m.duration === av.duration && normalizeStr(m.mainTitle).includes(normAmz.substring(0, 10)))
                    );

                    if (match) {
                        matches.push({ videoId: match.videoId, amzTitle: av.videoTitle });
                    } else {
                        const durMatch = metrics.find(m => m.duration === av.duration);
                        if (durMatch) {
                            candidates.push({ yt: durMatch, amz: av });
                        }
                    }
                });

                if (candidates.length > 0) {
                    setVerificationData({ candidates, matches });
                } else {
                    notify(`Matched ${matches.length} videos automatically.`);
                    setImportStep(3);
                }
            }
            else if (importStep === 3) {
                // ASIN Mapping
                const mappings: any[] = [];
                for (const f of files) {
                    const parsed = await parseVideoAsinMapping(f, (msg) => console.log(msg));
                    mappings.push(...parsed);
                }

                const updatedMetrics = [...metrics];
                let count = 0;
                mappings.forEach(map => {
                    const target = updatedMetrics.find(m => normalizeStr(m.mainTitle) === normalizeStr(map.videoTitle));
                    if (target && map.asins && map.asins.length > 0) {
                        target.asin = map.asins[0]; // Primary ASIN
                        target.asins = map.asins;
                        count++;
                    }
                });
                onSaveMetrics(updatedMetrics);
                notify(`Associated ${count} videos with ASINs.`);
                setImportStep(4);
            }
            else if (importStep === 4) {
                // Amazon Earnings
                const sales: AmazonMetric[] = [];
                for (const f of files) {
                    const parsed = await parseAmazonEarningsReport(f, (msg) => console.log(msg));
                    sales.push(...parsed);
                }

                const updatedMetrics = [...metrics];
                const newOrphans: JoinedMetric[] = [];

                sales.forEach(s => {
                    const target = updatedMetrics.find(m => m.asin === s.asin || m.asins?.includes(s.asin));
                    if (target) {
                        if (s.reportType === 'onsite') target.amazonOnsiteRevenue += s.revenue;
                        else target.amazonOffsiteRevenue += s.revenue;
                        target.totalRevenue += s.revenue;
                        target.clicks += s.clicks;
                        target.orderedItems += s.orderedItems;
                        target.mainTitle = s.productTitle || target.mainTitle;
                    } else {
                        const existingOrphan = newOrphans.find(o => o.asin === s.asin);
                        if (existingOrphan) {
                            existingOrphan.totalRevenue += s.revenue;
                        } else {
                            newOrphans.push({
                                id: s.asin,
                                asin: s.asin,
                                mainTitle: s.productTitle,
                                subTitle: s.productTitle,
                                views: 0,
                                watchTimeHours: 0,
                                subsGained: 0,
                                videoEstimatedRevenue: 0,
                                amazonOnsiteRevenue: s.reportType === 'onsite' ? s.revenue : 0,
                                amazonOffsiteRevenue: s.reportType === 'offsite' ? s.revenue : 0,
                                creatorConnectionsRevenue: 0,
                                totalRevenue: s.revenue,
                                clicks: s.clicks,
                                orderedItems: s.orderedItems,
                                shippedItems: s.shippedItems
                            });
                        }
                    }
                });
                onSaveMetrics([...updatedMetrics, ...newOrphans]);
                notify("Sales data merged successfully.");
                setImportStep(5);
            }
            else if (importStep === 5) {
                // Creator Connections
                const ccData: AmazonMetric[] = [];
                for (const f of files) {
                    const parsed = await parseCreatorConnectionsReport(f, (msg) => console.log(msg));
                    ccData.push(...parsed);
                }

                const updatedMetrics = [...metrics];
                ccData.forEach(cc => {
                    const target = updatedMetrics.find(m => m.asin === cc.asin || m.asins?.includes(cc.asin));
                    if (target) {
                        target.creatorConnectionsRevenue += cc.revenue;
                        target.totalRevenue += cc.revenue;
                    }
                });
                onSaveMetrics(updatedMetrics);
                notify("Creator Connections data integrated.");
                setActiveTab('dashboard');
            }
        } catch (err: any) {
            console.error(err);
            notify(err.message || "Error processing batch.", "error");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        handleStepUpload(files);
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <header className="flex justify-between items-center px-1">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <VideoIcon className="w-8 h-8 text-indigo-600" /> Video & Product Joiner
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Link multi-platform content to retail performance.</p>
                </div>
                <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200">
                    {['dashboard', 'data', 'insights', 'importer'].map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 min-h-0 bg-slate-50 rounded-[2.5rem] p-6 border border-slate-200 overflow-hidden flex flex-col">
                
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 flex flex-col h-full">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Combined Yield</p>
                                <p className="text-3xl font-black text-indigo-600">{formatCurrency(summary.revenue)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Video Volume</p>
                                <p className="text-3xl font-black text-slate-800">{formatNumber(summary.views)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Click Reach</p>
                                <p className="text-3xl font-black text-slate-800">{formatNumber(summary.clicks)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sales conversion</p>
                                <p className="text-3xl font-black text-emerald-600">{summary.clicks > 0 ? ((summary.items / summary.clicks) * 100).toFixed(1) : 0}%</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
                                <div className="relative w-96">
                                    <input 
                                        type="text" 
                                        placeholder="Search identifiers..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                    />
                                    <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 transition-all hover:bg-indigo-100">
                                    <input type="checkbox" checked={mergeAsins} onChange={() => setMergeAsins(!mergeAsins)} className="rounded text-indigo-600 h-4 w-4" />
                                    <span className="text-xs font-black text-indigo-700 uppercase">Roll up ASINs</span>
                                </label>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Performance Asset</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">YT Views</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">AdSense</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amz Rev</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Net Yield</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayMetrics.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 truncate max-w-lg">{m.mainTitle}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">{m.videoId || 'ORPHAN'}</span>
                                                            {m.subTitle !== m.mainTitle && (
                                                                <span className="text-[10px] text-indigo-400 font-medium truncate max-w-xs">{m.subTitle}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-slate-600 font-mono">{formatNumber(m.views)}</td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-slate-600 font-mono">{formatCurrency(m.videoEstimatedRevenue)}</td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-slate-600 font-mono">{formatCurrency(m.amazonOnsiteRevenue + m.amazonOffsiteRevenue + m.creatorConnectionsRevenue)}</td>
                                                <td className="px-6 py-4 text-right text-sm font-black text-indigo-600 font-mono">{formatCurrency(m.totalRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'importer' && (
                    <div className="max-w-4xl mx-auto w-full space-y-10 py-10 overflow-y-auto custom-scrollbar h-full">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Strategic Data Pipeline</h2>
                            <p className="text-sm text-slate-500 leading-relaxed font-medium">Follow the sequence to construct a unified performance model. Each step verifies your logical mappings before committing to the system registry.</p>
                        </div>

                        <div className="space-y-4 relative">
                            <div className="absolute left-6 top-8 bottom-8 w-1 bg-slate-200 -z-10 rounded-full" />
                            
                            {[
                                { step: 1, title: 'YouTube Video Signals', desc: 'Identify Video IDs and base AdSense earnings.' },
                                { step: 2, title: 'Amazon Storefront Cross-Ref', desc: 'Match YT metadata with Amazon video identifiers.' },
                                { step: 3, title: 'ASIN Resolution', desc: 'Finalize the link between Video IDs and retail SKUs.' },
                                { step: 4, title: 'Institutional Earnings', desc: 'Ingest Onsite and Offsite associate reports.' },
                                { step: 5, title: 'Creator Connections (CC)', desc: 'Aggregate specialized campaign revenue.' }
                            ].map(s => {
                                const isCurrent = importStep === s.step;
                                const isPassed = importStep > s.step;
                                return (
                                    <div key={s.step} className={`p-6 rounded-[2rem] border-2 transition-all flex items-start gap-6 group ${isCurrent ? 'bg-white border-indigo-600 shadow-xl scale-[1.02]' : isPassed ? 'bg-indigo-50 border-indigo-100 opacity-60' : 'bg-slate-50 border-slate-100 opacity-40'}`}>
                                        <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-lg transition-all ${isCurrent ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : isPassed ? 'bg-green-50 text-white shadow-green-100' : 'bg-white text-slate-300 shadow-inner'}`}>
                                            {isPassed ? <CheckCircleIcon className="w-6 h-6" /> : s.step}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className={`text-lg font-black uppercase tracking-tight ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>{s.title}</h3>
                                            <p className="text-sm text-slate-400 mt-1 font-medium">{s.desc}</p>
                                            
                                            {isCurrent && (
                                                <div className="mt-8 space-y-4 animate-fade-in">
                                                    <div 
                                                        onDragOver={handleDragOver}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={handleDrop}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`border-4 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group/drop ${isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-50 hover:border-indigo-200'}`}
                                                    >
                                                        <div className={`p-4 rounded-full shadow-sm transition-all ${isDragging ? 'bg-indigo-600 text-white scale-110' : 'bg-white text-slate-300 group-hover/drop:scale-110 group-hover/drop:bg-indigo-600 group-hover/drop:text-white'}`}>
                                                            <CloudArrowUpIcon className="w-8 h-8 transition-colors" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className={`font-black ${isDragging ? 'text-indigo-700' : 'text-slate-800'}`}>{isDragging ? 'Release to Start Logic Parse' : 'Identify Source Data'}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Multi-file Batch Upload Supported</p>
                                                        </div>
                                                    </div>
                                                    <input 
                                                        type="file" 
                                                        ref={fileInputRef} 
                                                        multiple 
                                                        className="hidden" 
                                                        onChange={(e) => handleStepUpload(Array.from(e.target.files || []))} 
                                                    />
                                                    <div className="bg-slate-900 rounded-2xl p-4 flex items-center gap-3">
                                                        <InfoIcon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                                        <p className="text-xs text-slate-400 font-medium">The system expects headers like: <strong>Content, Title, Duration, ASINs</strong> depending on the step.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {!isPassed && !isCurrent && (
                                            <div className="p-3">
                                                <ShieldCheckIcon className="w-6 h-6 text-slate-200" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {importStep > 1 && (
                            <div className="pt-10 flex justify-center">
                                <button 
                                    onClick={() => setShowResetConfirm(true)}
                                    className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-2"
                                >
                                    <RepeatIcon className="w-4 h-4" /> Reset Logic Pipeline
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* VERIFICATION MODAL FOR CANDIDATE MATCHES */}
            {verificationData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                                    <SparklesIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800">Duration Collision Verification</h3>
                                    <p className="text-sm text-slate-500">System detected {verificationData.candidates.length} cases with identical durations but different titles.</p>
                                </div>
                            </div>
                            <button onClick={() => setVerificationData(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar bg-slate-50/20">
                            {verificationData.candidates.map((c: any, idx: number) => (
                                <div key={idx} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-10 items-center relative overflow-hidden">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">YouTube Source</p>
                                        <p className="text-sm font-black text-slate-800">{c.yt.mainTitle}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Duration: {c.yt.duration}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Amazon Candidate</p>
                                        <p className="text-sm font-black text-slate-800">{c.amz.videoTitle}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Duration: {c.amz.duration}</p>
                                    </div>
                                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-100 hidden md:block" />
                                    <div className="col-span-2 flex justify-center gap-4 pt-4 border-t border-slate-50">
                                        <button 
                                            onClick={() => {
                                                const next = [...verificationData.candidates];
                                                next.splice(idx, 1);
                                                setVerificationData({ ...verificationData, candidates: next });
                                                if (next.length === 0) { setVerificationData(null); setImportStep(3); }
                                            }}
                                            className="px-6 py-2 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                        >
                                            Deny Match
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const target = metrics.find(m => m.videoId === c.yt.videoId);
                                                if (target) target.subTitle = c.amz.videoTitle;
                                                const next = [...verificationData.candidates];
                                                next.splice(idx, 1);
                                                setVerificationData({ ...verificationData, candidates: next });
                                                if (next.length === 0) { setVerificationData(null); setImportStep(3); }
                                            }}
                                            className="px-10 py-2 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                        >
                                            Confirm Match
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t bg-white flex justify-end">
                            <button 
                                onClick={() => { setVerificationData(null); setImportStep(3); }}
                                className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                            >
                                Skip Remaining & Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm z-[250] flex items-center justify-center">
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 animate-slide-up">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <div className="text-center space-y-1">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Synthesizing Batch</h3>
                            <p className="text-sm text-slate-400 font-medium">Cross-referencing identifiers and normalizing signals...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom UI Reset Confirm */}
            <ConfirmationModal 
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={() => { setImportStep(1); setShowResetConfirm(false); notify("Logic pipeline reset to Step 1", "info"); }}
                title="Reset Import Sequence?"
                message="You will lose the current staging data for this specific import session. Existing metrics in your database will not be affected."
                confirmLabel="Reset Pipeline"
                variant="warning"
            />

            {/* Custom UI Toast */}
            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] animate-slide-up">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${
                        toast.type === 'success' ? 'bg-slate-900 text-white border-white/10' :
                        toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' :
                        'bg-white text-slate-800 border-slate-200 shadow-lg'
                    }`}>
                        <div className={`${toast.type === 'success' ? 'bg-indigo-500' : toast.type === 'error' ? 'bg-white/20' : 'bg-indigo-50'} rounded-full p-1`}>
                            {toast.type === 'success' ? <CheckCircleIcon className="w-4 h-4 text-white" /> : toast.type === 'error' ? <ExclamationTriangleIcon className="w-4 h-4" /> : <InfoIcon className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <div>
                            <p className="text-sm font-bold tracking-tight">{toast.message}</p>
                        </div>
                        <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-full ml-2">
                            <CloseIcon className="w-4 h-4 opacity-50" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoProductJoiner;
