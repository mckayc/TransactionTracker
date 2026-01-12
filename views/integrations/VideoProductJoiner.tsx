import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { JoinedMetric, YouTubeMetric, AmazonVideo, AmazonMetric, YouTubeChannel } from '../../types';
import { BoxIcon, YoutubeIcon, CloudArrowUpIcon, BarChartIcon, TableIcon, SparklesIcon, ChevronRightIcon, ChevronDownIcon, CheckCircleIcon, PlayIcon, InfoIcon, ShieldCheckIcon, AddIcon, DeleteIcon, TrashIcon, VideoIcon, SearchCircleIcon, RepeatIcon, CloseIcon, ExclamationTriangleIcon, ArrowRightIcon, TrendingUpIcon, DollarSign, CheckBadgeIcon } from '../../components/Icons';
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
                const allYt: YouTubeMetric[] = [];
                for (const f of files) {
                    const parsed = await parseYouTubeDetailedReport(f, (msg) => console.log(msg));
                    const channelName = detectChannelFromFileName(f.name);
                    allYt.push(...parsed.map(p => ({ ...p, channelId: channelName })));
                }
                setStagedData(allYt);
            } 
            else if (importStep === 2) {
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
            else if (importStep === 4) {
                const sales: AmazonMetric[] = [];
                for (const f of files) {
                    const parsed = await parseAmazonEarningsReport(f, (msg) => console.log(msg));
                    sales.push(...parsed);
                }
                setStagedData(sales);
            }
            else if (importStep === 5) {
                const ccData: AmazonMetric[] = [];
                for (const f of files) {
                    const parsed = await parseCreatorConnectionsReport(f, (msg) => console.log(msg));
                    ccData.push(...parsed);
                }
                setStagedData(ccData);
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
            const ytData = stagedData as YouTubeMetric[];
            const newMetrics: JoinedMetric[] = ytData.map(yt => ({
                id: yt.videoId, videoId: yt.videoId, asin: '', mainTitle: yt.videoTitle, subTitle: yt.videoTitle,
                views: yt.views, watchTimeHours: yt.watchTimeHours, subsGained: yt.subscribersGained,
                videoEstimatedRevenue: yt.estimatedRevenue, amazonOnsiteRevenue: 0, amazonOffsiteRevenue: 0,
                creatorConnectionsRevenue: 0, totalRevenue: yt.estimatedRevenue, clicks: yt.impressions,
                orderedItems: 0, shippedItems: 0, publishDate: yt.publishDate, duration: yt.duration
            }));
            const existingMap = new Map(metrics.map(m => [m.id, m]));
            newMetrics.forEach(n => {
                if (existingMap.has(n.id)) {
                    const ex = existingMap.get(n.id)!;
                    ex.views = n.views;
                    ex.totalRevenue = n.totalRevenue + (ex.totalRevenue - ex.videoEstimatedRevenue);
                    ex.videoEstimatedRevenue = n.videoEstimatedRevenue;
                } else existingMap.set(n.id, n);
            });
            onSaveMetrics(Array.from(existingMap.values()));
            notify(`Committed ${newMetrics.length} YouTube records.`);
            setImportStep(2);
        } else if (importStep === 2) {
            const amzVideos = stagedData as AmazonVideo[];
            const matches: any[] = [];
            const candidates: any[] = [];
            amzVideos.forEach(av => {
                const normAmz = normalizeStr(av.videoTitle);
                const match = metrics.find(m => normalizeStr(m.mainTitle) === normAmz || (m.duration === av.duration && normalizeStr(m.mainTitle).includes(normAmz.substring(0, 10))));
                if (match) matches.push({ videoId: match.videoId, amzTitle: av.videoTitle });
                else {
                    const durMatch = metrics.find(m => m.duration === av.duration);
                    if (durMatch) candidates.push({ yt: durMatch, amz: av });
                }
            });
            if (candidates.length > 0) setVerificationData({ candidates, matches });
            else {
                notify(`Matched ${matches.length} videos.`);
                setImportStep(3);
            }
        } else if (importStep === 3) {
            const mappings = stagedData as Partial<AmazonVideo>[];
            const updatedMetrics = [...metrics];
            let count = 0;
            mappings.forEach(map => {
                const target = updatedMetrics.find(m => normalizeStr(m.mainTitle) === normalizeStr(map.videoTitle!));
                if (target && map.asins && map.asins.length > 0) {
                    target.asin = map.asins[0];
                    target.asins = map.asins;
                    count++;
                }
            });
            onSaveMetrics(updatedMetrics);
            notify(`Linked ${count} ASINs.`);
            setImportStep(4);
        } else if (importStep === 4) {
            const sales = stagedData as AmazonMetric[];
            const updatedMetrics = [...metrics];
            const newOrphans: JoinedMetric[] = [];
            sales.forEach(s => {
                const target = updatedMetrics.find(m => m.asin === s.asin || m.asins?.includes(s.asin));
                if (target) {
                    if (s.reportType === 'onsite') target.amazonOnsiteRevenue += s.revenue;
                    else target.amazonOffsiteRevenue += s.revenue;
                    target.totalRevenue += s.revenue;
                    target.orderedItems += s.orderedItems;
                    target.mainTitle = s.productTitle || target.mainTitle;
                } else {
                    const existingOrphan = newOrphans.find(o => o.asin === s.asin);
                    if (existingOrphan) existingOrphan.totalRevenue += s.revenue;
                    else newOrphans.push({
                        id: s.asin, asin: s.asin, mainTitle: s.productTitle, subTitle: s.productTitle,
                        views: 0, watchTimeHours: 0, subsGained: 0, videoEstimatedRevenue: 0,
                        amazonOnsiteRevenue: s.reportType === 'onsite' ? s.revenue : 0,
                        amazonOffsiteRevenue: s.reportType === 'offsite' ? s.revenue : 0,
                        creatorConnectionsRevenue: 0, totalRevenue: s.revenue, clicks: s.clicks,
                        orderedItems: s.orderedItems, shippedItems: s.shippedItems
                    });
                }
            });
            onSaveMetrics([...updatedMetrics, ...newOrphans]);
            notify("Sales data merged.");
            setImportStep(5);
        } else if (importStep === 5) {
            const ccData = stagedData as AmazonMetric[];
            const updatedMetrics = [...metrics];
            ccData.forEach(cc => {
                const target = updatedMetrics.find(m => m.asin === cc.asin || m.asins?.includes(cc.asin));
                if (target) {
                    target.creatorConnectionsRevenue += cc.revenue;
                    target.totalRevenue += cc.revenue;
                }
            });
            onSaveMetrics(updatedMetrics);
            notify("Creator Connections integrated.");
            setActiveTab('dashboard');
        }
        setStagedData(null);
    };

    const handleClearAll = async () => {
        try {
            await api.resetDatabase(['joinedMetrics']);
            onSaveMetrics([]);
            notify("Data wiped successfully", "info");
        } catch (e) {
            notify("Wipe failed", "error");
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

            <div className="flex-1 min-h-0 bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 flex flex-col h-full animate-fade-in">
                        <div className="grid grid-cols-4 gap-6">
                            <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden group">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 relative z-10">Total Aggregate Yield</p>
                                <p className="text-4xl font-black relative z-10">{formatCurrency(summary.revenue)}</p>
                                <TrendingUpIcon className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 text-white group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Views</p>
                                <p className="text-3xl font-black text-slate-800">{formatNumber(summary.views)}</p>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Click Reach</p>
                                <p className="text-3xl font-black text-slate-800">{formatNumber(summary.clicks)}</p>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conversion Efficiency</p>
                                <p className="text-3xl font-black text-emerald-600">{summary.clicks > 0 ? ((summary.items / summary.clicks) * 100).toFixed(1) : 0}%</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm flex-1 flex flex-col overflow-hidden">
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
                                                        <span className="text-sm font-black text-slate-800">{m.mainTitle}</span>
                                                        <div className="flex items-center gap-3 mt-1.5">
                                                            <span className="text-[8px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shadow-sm">{m.videoId || 'ORPHAN'}</span>
                                                            {m.subTitle !== m.mainTitle && (
                                                                <span className="text-[10px] text-slate-400 font-medium italic">{m.subTitle}</span>
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
                    <div className="max-w-5xl mx-auto w-full space-y-10 py-10 overflow-y-auto custom-scrollbar h-full animate-fade-in">
                        <div className="text-center space-y-4 max-w-2xl mx-auto">
                            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Performance Pipeline</h2>
                            <p className="text-sm text-slate-400 leading-relaxed font-bold">Construct a high-fidelity earnings model by layering multi-platform reports.</p>
                        </div>

                        <div className="space-y-6 relative">
                            {[
                                { step: 1, title: 'YouTube Catalyst', desc: 'Identify Video IDs and core AdSense earnings.', icon: <YoutubeIcon className="w-5 h-5"/>, color: 'red' },
                                { step: 2, title: 'Amazon Visual Verification', desc: 'Match video signals between YouTube and Amazon Storefront.', icon: <VideoIcon className="w-5 h-5"/>, color: 'indigo' },
                                { step: 3, title: 'Identity Registry', desc: 'Associate SKU (ASIN) identifiers with performance content.', icon: <BoxIcon className="w-5 h-5"/>, color: 'amber' },
                                { step: 4, title: 'Commission Audit', desc: 'Ingest Amazon Fee-Earnings reports (Onsite/Offsite).', icon: <DollarSign className="w-5 h-5"/>, color: 'emerald' },
                                { step: 5, title: 'Creator Premium', desc: 'Finalize model with Creator Connections campaign yields.', icon: <CheckBadgeIcon className="w-5 h-5"/>, color: 'violet' }
                            ].map(s => {
                                const isCurrent = importStep === s.step;
                                const isPassed = importStep > s.step;
                                const hasData = isCurrent && stagedData !== null;
                                
                                return (
                                    <div key={s.step} className={`p-8 rounded-[3rem] border-2 transition-all flex flex-col gap-6 group ${isCurrent ? 'bg-white border-indigo-600 shadow-2xl scale-[1.01]' : isPassed ? 'bg-indigo-50 border-indigo-100 opacity-60' : 'bg-slate-50 border-slate-100 opacity-40 grayscale'}`}>
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-[1.5rem] flex-shrink-0 flex items-center justify-center font-black text-xl transition-all ${isCurrent ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : isPassed ? 'bg-green-500 text-white shadow-green-100' : 'bg-white text-slate-300 border-2 border-slate-100 shadow-inner'}`}>
                                                {isPassed ? <CheckCircleIcon className="w-8 h-8" /> : s.step}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className={`text-xl font-black uppercase tracking-tight ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>{s.title}</h3>
                                                <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-widest">{s.desc}</p>
                                            </div>
                                            {isCurrent && (
                                                <div className="flex gap-3">
                                                    {hasData && (
                                                        <button onClick={() => setStagedData(null)} className="px-5 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase hover:bg-rose-50 hover:text-rose-600 transition-all">Clear Staging</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {isCurrent && !hasData && (
                                            <div className="mt-2 animate-fade-in">
                                                <div 
                                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                                    onDragLeave={() => setIsDragging(false)}
                                                    onDrop={e => { e.preventDefault(); setIsDragging(false); handleStepUpload(Array.from(e.dataTransfer.files)); }}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className={`border-4 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group/drop ${isDragging ? 'border-indigo-600 bg-indigo-50 scale-[1.02]' : 'border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-white'}`}
                                                >
                                                    <div className={`p-5 bg-white rounded-full shadow-lg transition-all ${isDragging ? 'bg-indigo-600 text-white scale-125' : 'text-slate-300 group-hover/drop:bg-indigo-600 group-hover/drop:text-white'}`}>
                                                        <CloudArrowUpIcon className="w-10 h-10 transition-colors" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="font-black text-lg text-slate-800">Identify Statement(s)</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Multi-file Batch Parsing Supported</p>
                                                    </div>
                                                </div>
                                                <input type="file" ref={fileInputRef} multiple className="hidden" onChange={(e) => handleStepUpload(Array.from(e.target.files || []))} />
                                            </div>
                                        )}

                                        {isCurrent && hasData && (
                                            <div className="bg-slate-900 rounded-[2rem] p-8 text-white space-y-6 animate-slide-up relative overflow-hidden shadow-2xl">
                                                <div className="flex justify-between items-center relative z-10">
                                                    <div>
                                                        <h4 className="text-lg font-black tracking-tight text-indigo-400">Logic Verification Staging</h4>
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{stagedData!.length} Logical Records Extracted</p>
                                                    </div>
                                                    <button onClick={handleCommitStaged} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl flex items-center gap-3 transition-all active:scale-95 text-xs uppercase tracking-widest">
                                                        Commit & Advance <ArrowRightIcon className="w-5 h-5"/>
                                                    </button>
                                                </div>
                                                
                                                <div className="max-h-60 overflow-y-auto border border-white/5 rounded-2xl bg-black/20 custom-scrollbar relative z-10">
                                                    <table className="min-w-full text-[10px] border-separate border-spacing-0">
                                                        <thead className="sticky top-0 bg-slate-800 text-slate-400 font-black uppercase tracking-widest">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left">Descriptor</th>
                                                                <th className="px-4 py-3 text-right">Value/Identifier</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5 font-mono">
                                                            {stagedData!.slice(0, 50).map((row, i) => (
                                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                                    <td className="px-4 py-2">{row.videoTitle || row.productTitle || row.ccTitle || 'Unknown'}</td>
                                                                    <td className="px-4 py-2 text-right text-indigo-400 font-bold">{formatCurrency(row.revenue || row.estimatedRevenue || 0)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <SparklesIcon className="absolute -right-12 -top-12 w-48 h-48 opacity-[0.03] text-indigo-500" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-10 flex flex-col items-center gap-4">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Administrative Actions</p>
                            <button 
                                onClick={() => setShowResetConfirm(true)}
                                className="px-8 py-3 bg-white border-2 border-slate-100 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-3 group"
                            >
                                <RepeatIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" /> Reset Importer State
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Verification Modals */}
            <ConfirmationModal 
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={() => { setImportStep(1); setStagedData(null); setShowResetConfirm(false); notify("logic pipeline reset", "info"); }}
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

            {/* DURATION COLLISION MODAL */}
            {verificationData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><SparklesIcon className="w-6 h-6" /></div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800">Ambiguous Duration Match</h3>
                                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">{verificationData.candidates.length} Collisions Detected</p>
                                </div>
                            </div>
                            <button onClick={() => setVerificationData(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar bg-slate-50/20">
                            {verificationData.candidates.map((c: any, idx: number) => (
                                <div key={idx} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-10 items-center relative overflow-hidden">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">YouTube Source</p>
                                        <p className="text-sm font-black text-slate-800">{c.yt.mainTitle}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Duration: {c.yt.duration}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Amazon Candidate</p>
                                        <p className="text-sm font-black text-slate-800">{c.amz.videoTitle}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Duration: {c.amz.duration}</p>
                                    </div>
                                    <div className="col-span-2 flex justify-center gap-4 pt-4 border-t border-slate-50">
                                        <button onClick={() => { const next = [...verificationData.candidates]; next.splice(idx, 1); setVerificationData({ ...verificationData, candidates: next }); if (next.length === 0) { setVerificationData(null); setImportStep(3); } }} className="px-6 py-2 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase hover:bg-slate-200 transition-all">Deny Match</button>
                                        <button onClick={() => { const target = metrics.find(m => m.videoId === c.yt.videoId); if (target) target.subTitle = c.amz.videoTitle; const next = [...verificationData.candidates]; next.splice(idx, 1); setVerificationData({ ...verificationData, candidates: next }); if (next.length === 0) { setVerificationData(null); setImportStep(3); } }} className="px-10 py-2 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg shadow-indigo-100 transition-all">Confirm Match</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t bg-white flex justify-end">
                            <button onClick={() => { setVerificationData(null); setImportStep(3); }} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase shadow-xl transition-all active:scale-95">Skip Remaining</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PROCESSING OVERLAY */}
            {isProcessing && (
                <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm z-[250] flex items-center justify-center">
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 animate-slide-up text-center">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Synthesizing Batch</h3>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Parsing Signal Hierarchy...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST SYSTEM */}
            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] animate-slide-up">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${toast.type === 'success' ? 'bg-slate-900 text-white border-white/10' : toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' : 'bg-white text-slate-800 border-slate-200 shadow-lg'}`}>
                        <div className={`${toast.type === 'success' ? 'bg-indigo-500' : toast.type === 'error' ? 'bg-white/20' : 'bg-indigo-50'} rounded-full p-1`}>
                            {toast.type === 'success' ? <CheckCircleIcon className="w-4 h-4 text-white" /> : toast.type === 'error' ? <ExclamationTriangleIcon className="w-4 h-4" /> : <InfoIcon className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest">{toast.message}</p>
                        <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-full ml-2"><CloseIcon className="w-4 h-4 opacity-50" /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoProductJoiner;