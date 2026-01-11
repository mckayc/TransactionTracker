
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { AmazonMetric, YouTubeMetric, ContentLink, AmazonVideo } from '../../types';
// Added WorkflowIcon and TrashIcon to the imports from components/Icons
import { ChartPieIcon, YoutubeIcon, BoxIcon, TrendingUpIcon, LightBulbIcon, SearchCircleIcon, SparklesIcon, CheckCircleIcon, ExternalLinkIcon, SortIcon, InfoIcon, ShieldCheckIcon, CloudArrowUpIcon, CloseIcon, TableIcon, PlayIcon, LinkIcon, WorkflowIcon, TrashIcon } from '../../components/Icons';
import { generateUUID } from '../../utils';
import { simplifyProductNames } from '../../services/geminiService';
import { parseAmazonVideos } from '../../services/csvParserService';

interface ContentHubProps {
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
    contentLinks: ContentLink[];
    onUpdateLinks: (links: ContentLink[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

/**
 * Normalization helper - pre-compiled regex for speed
 */
const NORM_RE_1 = /[^a-z0-9]/g;
const NORM_RE_2 = /\s+/g;
const normalizeTitle = (title: string) => 
    (title || '').toLowerCase()
    .replace(NORM_RE_1, ' ')
    .replace(NORM_RE_2, ' ')
    .trim();

const ContentHub: React.FC<ContentHubProps> = ({ amazonMetrics, youtubeMetrics, contentLinks, onUpdateLinks }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [activeTab, setActiveTab] = useState<'roi' | 'linker' | 'discovery'>('roi');

    // Linker Tool State
    const [stagedAmVideos, setStagedAmVideos] = useState<AmazonVideo[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSimplifying, setIsSimplifying] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Unified Content Entity Mapping
    const unifiedEntities = useMemo(() => {
        // Group YouTube data by Video ID
        const ytVideos = new Map<string, { id: string, title: string, normTitle: string, revenue: number, views: number, date: string }>();
        youtubeMetrics.forEach(m => {
            if (!ytVideos.has(m.videoId)) {
                ytVideos.set(m.videoId, { 
                    id: m.videoId, 
                    title: m.videoTitle, 
                    normTitle: normalizeTitle(m.videoTitle),
                    revenue: 0, 
                    views: 0, 
                    date: m.publishDate 
                });
            }
            const ex = ytVideos.get(m.videoId)!;
            ex.revenue += m.estimatedRevenue;
            ex.views += m.views;
        });

        // Index Amazon Metrics by ASIN for fast linked lookup
        const amByAsin = new Map<string, AmazonMetric[]>();
        // Index Amazon Metrics by Normalized Title for fast heuristic lookup
        const amByNormTitle = new Map<string, AmazonMetric[]>();

        amazonMetrics.forEach(m => {
            if (!amByAsin.has(m.asin)) amByAsin.set(m.asin, []);
            amByAsin.get(m.asin)!.push(m);

            const titleToNorm = m.videoTitle || m.ccTitle || m.productTitle || '';
            if (titleToNorm) {
                const nt = normalizeTitle(titleToNorm);
                if (!amByNormTitle.has(nt)) amByNormTitle.set(nt, []);
                amByNormTitle.get(nt)!.push(m);
            }
        });

        // Create the composite list based on Links
        return Array.from(ytVideos.values()).map(yt => {
            const link = contentLinks.find(l => l.youtubeVideoId === yt.id);
            
            let amAffRev = 0;
            let amInfRev = 0;
            let ccOnRev = 0;
            let ccOffRev = 0;

            const processMetric = (m: AmazonMetric) => {
                if (m.reportType === 'offsite') amAffRev += m.revenue;
                else if (m.reportType === 'onsite') amInfRev += m.revenue;
                else if (m.reportType === 'creator_connections') {
                    if (m.creatorConnectionsType === 'onsite') ccOnRev += m.revenue;
                    else ccOffRev += m.revenue;
                }
            };

            if (link) {
                // $O(1)$ fast ASIN lookup
                link.amazonAsins.forEach(asin => {
                    const metrics = amByAsin.get(asin) || [];
                    metrics.forEach(processMetric);
                });
            } else {
                // Optimized Heuristic Match
                // Try $O(1)$ exact title match first
                const exactMatches = amByNormTitle.get(yt.normTitle);
                if (exactMatches) {
                    exactMatches.forEach(processMetric);
                } else {
                    // Fallback to fuzzy substring only if data size is manageable or for specific cases
                    // We only do this for the top 500 items if there is a lot of data to prevent browser hang
                    if (youtubeMetrics.length < 2000 && amazonMetrics.length < 5000) {
                        amazonMetrics.forEach(m => {
                            const titleToNorm = m.videoTitle || m.ccTitle || m.productTitle || '';
                            if (titleToNorm) {
                                const normAm = normalizeTitle(titleToNorm);
                                if (normAm && (yt.normTitle.includes(normAm) || normAm.includes(yt.normTitle))) {
                                    processMetric(m);
                                }
                            }
                        });
                    }
                }
            }

            const total = yt.revenue + amAffRev + amInfRev + ccOnRev + ccOffRev;

            return {
                id: yt.id,
                title: link?.simplifiedName || yt.title,
                originalTitle: yt.title,
                ytRev: yt.revenue,
                amAffRev,
                amInfRev,
                ccOnRev,
                ccOffRev,
                total,
                isLinked: !!link
            };
        }).sort((a, b) => b.total - a.total);
    }, [youtubeMetrics, amazonMetrics, contentLinks]);

    const globalTotals = useMemo(() => {
        return unifiedEntities.reduce((acc, curr) => ({
            yt: acc.yt + curr.ytRev,
            aff: acc.aff + curr.amAffRev,
            inf: acc.inf + curr.amInfRev,
            ccOn: acc.ccOn + curr.ccOnRev,
            ccOff: acc.ccOff + curr.ccOffRev,
            total: acc.total + curr.total
        }), { yt: 0, aff: 0, inf: 0, ccOn: 0, ccOff: 0, total: 0 });
    }, [unifiedEntities]);

    // Handlers
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const vids = await parseAmazonVideos(file, () => {});
            setStagedAmVideos(prev => [...prev, ...vids]);
        } catch (err) {
            alert("Upload failed.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleAutoLink = async () => {
        setIsScanning(true);
        const newLinks = [...contentLinks];
        const existingYtIds = new Set(newLinks.map(l => l.youtubeVideoId));

        // Pre-normalize staged videos for O(1) matching in loop
        const amVideosByNormTitle = new Map<string, AmazonVideo>();
        stagedAmVideos.forEach(v => {
            amVideosByNormTitle.set(normalizeTitle(v.videoTitle), v);
        });

        unifiedEntities.forEach(entity => {
            if (entity.isLinked) return;
            const yt = youtubeMetrics.find(m => m.videoId === entity.id);
            if (!yt) return;

            const normYt = normalizeTitle(yt.videoTitle);
            
            // Try $O(1)$ fast match first
            let match = amVideosByNormTitle.get(normYt);
            
            // Substring fallback only if necessary
            if (!match) {
                match = stagedAmVideos.find(v => {
                    const normAm = normalizeTitle(v.videoTitle);
                    return normAm.includes(normYt) || normYt.includes(normAm);
                });
            }

            if (match && match.asins) {
                newLinks.push({
                    id: generateUUID(),
                    youtubeVideoId: yt.videoId,
                    amazonAsins: match.asins,
                    title: yt.videoTitle,
                    manuallyLinked: false
                });
            }
        });

        onUpdateLinks(newLinks);
        setIsScanning(false);
        alert("Platform cross-referencing complete.");
    };

    const handleAiSimplify = async () => {
        if (contentLinks.length === 0) return;
        setIsSimplifying(true);
        try {
            const titles = contentLinks.map(l => l.title);
            const mapping = await simplifyProductNames(titles);
            const nextLinks = contentLinks.map(l => ({
                ...l,
                simplifiedName: mapping[l.title] || l.simplifiedName
            }));
            onUpdateLinks(nextLinks);
        } finally {
            setIsSimplifying(false);
        }
    };

    const filteredEntities = unifiedEntities.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.originalTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 h-full flex flex-col animate-fade-in">
            {/* Header Navigation */}
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ChartPieIcon className="w-8 h-8 text-indigo-600" /> Content ROI Hub
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Platform orchestration and monetization attribution.</p>
                </div>
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('roi')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'roi' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>ROI Registry</button>
                    <button onClick={() => setActiveTab('linker')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'linker' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Neural Linker</button>
                </div>
            </div>

            {/* Global Aggregates */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
                <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-xl shadow-indigo-900/10">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Gross Yield</p>
                    <p className="text-xl font-black">{formatCurrency(globalTotals.total)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">AdSense</p>
                    <p className="text-xl font-black text-slate-800">{formatCurrency(globalTotals.yt)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Affiliate (Off)</p>
                    <p className="text-xl font-black text-slate-800">{formatCurrency(globalTotals.aff)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Influencer (On)</p>
                    <p className="text-xl font-black text-slate-800">{formatCurrency(globalTotals.inf)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">CC Combined</p>
                    <p className="text-xl font-black text-slate-800">{formatCurrency(globalTotals.ccOn + globalTotals.ccOff)}</p>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
                {activeTab === 'roi' ? (
                    <>
                        <div className="p-5 border-b bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="relative w-full sm:w-96">
                                <input 
                                    type="text" 
                                    placeholder="Filter by simplified or original name..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleAiSimplify} 
                                    disabled={isSimplifying || contentLinks.length === 0}
                                    className="px-4 py-2 text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-2"
                                >
                                    {isSimplifying ? <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                                    AI Name Forge
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Product Entity / Video Cluster</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">YouTube (Ad)</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amazon (Off)</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amazon (On)</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">CC (Total)</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-800 uppercase tracking-widest border-b bg-indigo-50/50">Gross ROI</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {filteredEntities.map((e, idx) => (
                                        <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 max-w-md">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">#{idx+1}</div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-800 truncate" title={e.originalTitle}>{e.title}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {e.isLinked && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1"><ShieldCheckIcon className="w-2 h-2" /> Neural Link</span>}
                                                            <span className="text-[8px] font-mono text-slate-300 uppercase truncate max-w-[100px]">{e.id}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-red-600 font-mono">{formatCurrency(e.ytRev)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-green-600 font-mono">{formatCurrency(e.amAffRev)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-blue-600 font-mono">{formatCurrency(e.amInfRev)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-purple-600 font-mono">{formatCurrency(e.ccOnRev + e.ccOffRev)}</td>
                                            <td className="px-6 py-4 text-right bg-indigo-50/20">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-indigo-900 font-mono">{formatCurrency(e.total)}</span>
                                                    <div className="w-24 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden flex shadow-inner">
                                                        <div className="h-full bg-red-500" style={{ width: `${(e.ytRev / e.total) * 100}%` }} />
                                                        <div className="h-full bg-green-500" style={{ width: `${(e.amAffRev / e.total) * 100}%` }} />
                                                        <div className="h-full bg-blue-500" style={{ width: `${(e.amInfRev / e.total) * 100}%` }} />
                                                        <div className="h-full bg-purple-500" style={{ width: `${((e.ccOnRev + e.ccOffRev) / e.total) * 100}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-slate-50/30">
                        <div className="max-w-4xl mx-auto space-y-10 pb-20">
                            <div className="text-center space-y-4">
                                <div className="p-4 bg-indigo-600 text-white rounded-3xl inline-block shadow-xl shadow-indigo-200">
                                    <WorkflowIcon className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-800">Neural platform alignment</h2>
                                <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">Cross-reference video metadata with sales ASINs to unlock platform-agnostic ROI reporting.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                        <CloudArrowUpIcon className="w-6 h-6 text-indigo-500" />
                                        Video Asset Ingestion
                                    </h3>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group"
                                    >
                                        <TableIcon className="w-10 h-10 text-slate-300 group-hover:text-indigo-500 mb-4 transition-colors" />
                                        <p className="text-sm font-bold text-slate-700">Upload Amazon Video Exports</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Requires Title & ASIN mappings</p>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    </div>
                                    
                                    {stagedAmVideos.length > 0 && (
                                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-black text-indigo-400 uppercase">Staged Assets</p>
                                                <p className="text-lg font-black text-indigo-900">{stagedAmVideos.length} Video-ASIN Mappings</p>
                                            </div>
                                            <button onClick={() => setStagedAmVideos([])} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                        <SparklesIcon className="w-6 h-6 text-indigo-500" />
                                        Synthesis Engine
                                    </h3>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        The engine will compare your YouTube video titles against the uploaded Amazon asset list. 
                                        When a match is found, AdSense and Amazon revenue will be unified into single "Product" records.
                                    </p>
                                    <button 
                                        onClick={handleAutoLink}
                                        disabled={isScanning || stagedAmVideos.length === 0}
                                        className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:shadow-none"
                                    >
                                        {isScanning ? <div className="w-5 h-5 border-4 border-t-white rounded-full animate-spin" /> : <PlayIcon className="w-5 h-5" />}
                                        Run Logic Merge
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex-shrink-0">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div>
                        <h3 className="text-xl font-black flex items-center gap-3">
                            <TrendingUpIcon className="w-6 h-6 text-indigo-400" /> Attribution Matrix
                        </h3>
                        <p className="text-slate-400 mt-2 max-w-2xl text-sm font-medium leading-relaxed">
                            Your content strategy generates 
                            <strong className="text-white mx-1">{((globalTotals.yt + globalTotals.aff + globalTotals.ccOff) / (globalTotals.total || 1) * 100).toFixed(0)}%</strong> 
                            of its value from external traffic acquisition (YouTube), while platform-native search (Amazon Onsite) contributes 
                            <strong className="text-white mx-1">{((globalTotals.inf + globalTotals.ccOn) / (globalTotals.total || 1) * 100).toFixed(0)}%</strong>.
                        </p>
                    </div>
                    <div className="flex-shrink-0 text-center px-10 py-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Leading Ecosystem</p>
                        <p className="text-2xl font-black">{globalTotals.yt + globalTotals.aff + globalTotals.ccOff > globalTotals.inf + globalTotals.ccOn ? 'Social Push' : 'Market Pull'}</p>
                    </div>
                </div>
                <SparklesIcon className="absolute -right-12 -bottom-12 w-64 h-64 opacity-[0.03] text-indigo-500 pointer-events-none" />
            </div>
        </div>
    );
};

export default ContentHub;
