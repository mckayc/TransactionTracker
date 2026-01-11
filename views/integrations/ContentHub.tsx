import React, { useState, useMemo, useRef } from 'react';
import type { AmazonMetric, YouTubeMetric, ContentLink, AmazonVideo } from '../../types';
// Added missing WorkflowIcon and VideoIcon imports
import { ChartPieIcon, YoutubeIcon, BoxIcon, TrendingUpIcon, LightBulbIcon, SearchCircleIcon, SparklesIcon, CheckCircleIcon, ExternalLinkIcon, SortIcon, InfoIcon, ShieldCheckIcon, CloudArrowUpIcon, CloseIcon, TableIcon, PlayIcon, LinkIcon, WorkflowIcon, VideoIcon } from '../../components/Icons';
import { generateUUID } from '../../utils';
import { simplifyProductNames } from '../../services/geminiService';
import { parseAmazonVideoMetadata, parseAmazonProductMapping } from '../../services/csvParserService';

interface ContentHubProps {
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
    contentLinks: ContentLink[];
    onUpdateLinks: (links: ContentLink[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const normalizeTitle = (title: string) => 
    (title || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ContentHub: React.FC<ContentHubProps> = ({ amazonMetrics, youtubeMetrics, contentLinks, onUpdateLinks }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [activeTab, setActiveTab] = useState<'roi' | 'linker' | 'discovery'>('roi');

    // Linker Tool State
    const [metaFile, setMetaFile] = useState<File | null>(null);
    const [mapFile, setMapFile] = useState<File | null>(null);
    const [scanProgress, setScanProgress] = useState<string>('');
    const [stagedLinks, setStagedLinks] = useState<ContentLink[]>([]);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isSimplifying, setIsSimplifying] = useState(false);

    // 1. Unified Content Entity Mapping
    const unifiedEntities = useMemo(() => {
        // Group YouTube data by Video ID
        const ytVideos = new Map<string, { id: string, title: string, revenue: number, views: number, date: string }>();
        youtubeMetrics.forEach(m => {
            if (!ytVideos.has(m.videoId)) {
                ytVideos.set(m.videoId, { id: m.videoId, title: m.videoTitle, revenue: 0, views: 0, date: m.publishDate });
            }
            const ex = ytVideos.get(m.videoId)!;
            ex.revenue += m.estimatedRevenue;
            ex.views += m.views;
        });

        // Group Amazon Metrics for lookup
        const amByAsin = new Map<string, AmazonMetric[]>();
        amazonMetrics.forEach(m => {
            if (!amByAsin.has(m.asin)) amByAsin.set(m.asin, []);
            amByAsin.get(m.asin)!.push(m);
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
                link.amazonAsins.forEach(asin => {
                    const metrics = amByAsin.get(asin) || [];
                    metrics.forEach(processMetric);
                });
            } else {
                // Try to find Amazon metrics that have this exact video title associated (Onsite metrics often include videoTitle)
                const normYt = normalizeTitle(yt.title);
                amazonMetrics.forEach(m => {
                    const normAmVideo = normalizeTitle(m.videoTitle || '');
                    if (normAmVideo && normAmVideo === normYt) {
                        processMetric(m);
                    }
                });
            }

            const total = yt.revenue + amAffRev + amInfRev + ccOnRev + ccOffRev;

            return {
                id: yt.id,
                title: link?.simplifiedName || yt.title,
                originalTitle: yt.title,
                date: link?.videoCreationDate || yt.date,
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

    // HANDLERS
    const handleRunLinker = async () => {
        if (!metaFile || !mapFile) return;
        setIsScanning(true);
        setScanProgress('Parsing Metadata...');
        
        try {
            const meta = await parseAmazonVideoMetadata(metaFile, msg => setScanProgress(msg));
            const maps = await parseAmazonProductMapping(mapFile, msg => setScanProgress(msg));
            
            setScanProgress('Cross-referencing logic...');
            
            // Step 1: Map Title -> Metadata
            const titleMetaMap = new Map<string, { date: string, duration: string }>();
            meta.forEach(m => {
                if (m.videoTitle) {
                    titleMetaMap.set(normalizeTitle(m.videoTitle), { 
                        date: m.uploadDate || '', 
                        duration: m.duration || '' 
                    });
                }
            });

            // Step 2: Map Title -> ASINs
            const titleAsinMap = new Map<string, Set<string>>();
            maps.forEach(m => {
                if (m.videoTitle && m.asins) {
                    const norm = normalizeTitle(m.videoTitle);
                    if (!titleAsinMap.has(norm)) titleAsinMap.set(norm, new Set());
                    m.asins.forEach(asin => titleAsinMap.get(norm)!.add(asin));
                }
            });

            // Step 3: Match against YouTube metrics
            const newLinks: ContentLink[] = [];
            const ytTitles = new Map<string, string>();
            youtubeMetrics.forEach(m => ytTitles.set(normalizeTitle(m.videoTitle), m.videoId));

            const allTitles = Array.from(new Set([...titleMetaMap.keys(), ...titleAsinMap.keys()]));
            
            allTitles.forEach(normTitle => {
                const ytId = ytTitles.get(normTitle);
                if (ytId) {
                    const metaData = titleMetaMap.get(normTitle);
                    const asins = titleAsinMap.get(normTitle);
                    
                    newLinks.push({
                        id: generateUUID(),
                        youtubeVideoId: ytId,
                        amazonAsins: asins ? Array.from(asins) : [],
                        title: ytId ? youtubeMetrics.find(y => y.videoId === ytId)?.videoTitle || normTitle : normTitle,
                        manuallyLinked: false,
                        videoCreationDate: metaData?.date,
                        videoDuration: metaData?.duration
                    });
                }
            });

            setStagedLinks(newLinks);
            setIsVerifying(true);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Analysis failed.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleFinalizeImport = () => {
        const nextLinks = [...contentLinks];
        stagedLinks.forEach(staged => {
            const idx = nextLinks.findIndex(l => l.youtubeVideoId === staged.youtubeVideoId);
            if (idx > -1) nextLinks[idx] = staged;
            else nextLinks.push(staged);
        });
        onUpdateLinks(nextLinks);
        setIsVerifying(false);
        setStagedLinks([]);
        setActiveTab('roi');
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
                    <button onClick={() => setActiveTab('linker')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'linker' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Neutral Linker</button>
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
                                    placeholder="Filter by title..." 
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
                                        <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Creation Date</th>
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
                                                            {e.isLinked && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1"><ShieldCheckIcon className="w-2 b-2" /> Verified Link</span>}
                                                            <span className="text-[8px] font-mono text-slate-300 uppercase truncate max-w-[100px]">{e.id}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-xs font-mono text-slate-500 whitespace-nowrap">{e.date || '--'}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-red-600 font-mono">{formatCurrency(e.ytRev)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-green-600 font-mono">{formatCurrency(e.amAffRev)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-blue-600 font-mono">{formatCurrency(e.amInfRev)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-purple-600 font-mono">{formatCurrency(e.ccOnRev + e.ccOffRev)}</td>
                                            <td className="px-6 py-4 text-right bg-indigo-50/20">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-indigo-900 font-mono">{formatCurrency(e.total)}</span>
                                                    <div className="w-24 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden flex shadow-inner">
                                                        <div className="h-full bg-red-500" style={{ width: `${(e.ytRev / (e.total || 1)) * 100}%` }} />
                                                        <div className="h-full bg-green-500" style={{ width: `${(e.amAffRev / (e.total || 1)) * 100}%` }} />
                                                        <div className="h-full bg-blue-500" style={{ width: `${(e.amInfRev / (e.total || 1)) * 100}%` }} />
                                                        <div className="h-full bg-purple-500" style={{ width: `${((e.ccOnRev + e.ccOffRev) / (e.total || 1)) * 100}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : isVerifying ? (
                    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                        <div className="p-8 border-b bg-indigo-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Verification Console</h3>
                                <p className="text-sm text-slate-500">Previewing <strong>{stagedLinks.length}</strong> identified cross-platform content matches.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsVerifying(false)} className="px-6 py-2 text-xs font-black uppercase text-slate-500 hover:bg-white rounded-xl transition-all">Cancel</button>
                                <button onClick={handleFinalizeImport} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 uppercase text-xs">
                                    <CheckCircleIcon className="w-5 h-5" /> Commit Platform Logic
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                            <div className="space-y-4 max-w-5xl mx-auto">
                                {stagedLinks.map((link, idx) => (
                                    <div key={idx} className="bg-white p-5 rounded-2xl border-2 border-slate-100 flex items-center gap-8 shadow-sm transition-all hover:border-indigo-200 group">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-xs font-black text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">{idx + 1}</div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Content Identity</p>
                                                <p className="text-md font-black text-slate-800">{link.title}</p>
                                                <div className="flex gap-4 mt-1 text-[10px] font-bold text-slate-400 uppercase">
                                                    <span>{link.videoCreationDate || '--'}</span>
                                                    <span>{link.videoDuration || '--'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Associated ASINs</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {link.amazonAsins.map(asin => (
                                                        <span key={asin} className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-mono text-slate-600 border border-slate-200">{asin}</span>
                                                    ))}
                                                    {link.amazonAsins.length === 0 && <span className="text-xs text-slate-300 italic">No products found</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-slate-50/30">
                        <div className="max-w-4xl mx-auto space-y-10 pb-20">
                            <div className="text-center space-y-4">
                                <div className="p-4 bg-indigo-600 text-white rounded-3xl inline-block shadow-xl shadow-indigo-200">
                                    <WorkflowIcon className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-800">Neutral platform alignment</h2>
                                <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">Cross-reference video metadata with product mappings to unlock unified ROI reporting.</p>
                            </div>

                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><VideoIcon className="w-4 h-4" /></div>
                                            1. Video Metadata
                                        </h3>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">Upload the export containing Video Titles, Creation Dates, and Durations.</p>
                                        <div 
                                            onClick={() => document.getElementById('meta-upload')?.click()}
                                            className={`border-2 border-dashed rounded-[1.5rem] p-8 text-center cursor-pointer transition-all ${metaFile ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-200 hover:border-indigo-400'}`}
                                        >
                                            <CloudArrowUpIcon className={`w-8 h-8 mx-auto mb-2 ${metaFile ? 'text-emerald-500' : 'text-slate-300'}`} />
                                            <p className="text-xs font-bold text-slate-700">{metaFile ? metaFile.name : 'Select Metadata CSV'}</p>
                                            <input id="meta-upload" type="file" className="hidden" accept=".csv" onChange={e => setMetaFile(e.target.files?.[0] || null)} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><BoxIcon className="w-4 h-4" /></div>
                                            2. Product Mapping
                                        </h3>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">Upload the export containing Video Titles and associated Product ASINs.</p>
                                        <div 
                                            onClick={() => document.getElementById('map-upload')?.click()}
                                            className={`border-2 border-dashed rounded-[1.5rem] p-8 text-center cursor-pointer transition-all ${mapFile ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-200 hover:border-indigo-400'}`}
                                        >
                                            <CloudArrowUpIcon className={`w-8 h-8 mx-auto mb-2 ${mapFile ? 'text-emerald-500' : 'text-slate-300'}`} />
                                            <p className="text-xs font-bold text-slate-700">{mapFile ? mapFile.name : 'Select Product Map CSV'}</p>
                                            <input id="map-upload" type="file" className="hidden" accept=".csv" onChange={e => setMapFile(e.target.files?.[0] || null)} />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t flex flex-col items-center gap-6">
                                    {isScanning ? (
                                        <div className="flex flex-col items-center gap-4 text-center">
                                            <div className="w-16 h-1 w-48 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-600 animate-progress-indeterminate w-1/3" />
                                            </div>
                                            <p className="text-sm font-black text-indigo-600 uppercase tracking-widest animate-pulse">{scanProgress}</p>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={handleRunLinker}
                                            disabled={!metaFile || !mapFile}
                                            className="px-16 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-30 disabled:shadow-none flex items-center gap-3 uppercase text-sm active:scale-95"
                                        >
                                            <PlayIcon className="w-5 h-5" /> Execute Logic Merge
                                        </button>
                                    )}
                                    <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <InfoIcon className="w-5 h-5 text-amber-500 shrink-0" />
                                        <p className="text-xs text-amber-800 leading-relaxed">The system will match YouTube metrics to Amazon metrics using a title-normalized deterministic logic. Products without video matches will be preserved as standalone entries.</p>
                                    </div>
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