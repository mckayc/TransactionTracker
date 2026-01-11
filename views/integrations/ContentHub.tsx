import React, { useState, useMemo, useEffect } from 'react';
import type { AmazonMetric, YouTubeMetric, ContentLink, AmazonVideo } from '../../types';
// Added CalendarIcon to imports
import { ChartPieIcon, YoutubeIcon, BoxIcon, TrendingUpIcon, LightBulbIcon, SearchCircleIcon, SparklesIcon, CheckCircleIcon, ExternalLinkIcon, SortIcon, InfoIcon, ShieldCheckIcon, CloudArrowUpIcon, CloseIcon, TableIcon, PlayIcon, LinkIcon, WorkflowIcon, VideoIcon, ChevronRightIcon, CalendarIcon } from '../../components/Icons';
import { generateUUID } from '../../utils';
import { simplifyProductNames } from '../../services/geminiService';
import { parseAmazonVideoMetadata, parseAmazonProductMapping } from '../../services/csvParserService';

interface ContentHubProps {
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
    contentLinks: ContentLink[];
    onUpdateLinks: (links: ContentLink[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

const normalizeTitle = (title: string) => 
    (title || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Logic for duration matching (stripping 00: if present)
const normalizeDuration = (dur: string) => 
    (dur || '').replace(/^00:/, '').trim();

interface VerificationMatch {
    id: string;
    youtubeMetric: YouTubeMetric;
    amazonVideo: AmazonVideo;
    matchType: 'title' | 'duration' | 'both';
    asins: string[];
    isSelected: boolean;
}

interface ProductNamingMatch {
    asin: string;
    originalName: string;
    simplifiedName: string;
    isSelected: boolean;
}

const ContentHub: React.FC<ContentHubProps> = ({ amazonMetrics, youtubeMetrics, contentLinks, onUpdateLinks }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [activeTab, setActiveTab] = useState<'roi' | 'linker'>('roi');

    // Linker Tool State
    const [metaFile, setMetaFile] = useState<File | null>(null);
    const [mapFile, setMapFile] = useState<File | null>(null);
    const [scanProgress, setScanProgress] = useState<string>('');
    
    // Multi-stage verification state
    const [verificationStage, setVerificationStage] = useState<'upload' | 'matching' | 'naming'>('upload');
    const [stagedVideoMatches, setStagedVideoMatches] = useState<VerificationMatch[]>([]);
    const [stagedNamingMatches, setStagedNamingMatches] = useState<ProductNamingMatch[]>([]);
    const [isSimplifying, setIsSimplifying] = useState(false);

    // Global Totals for ROI Registry
    const globalTotals = useMemo(() => {
        const totals = { yt: 0, aff: 0, fun: 0, inf: 0, ccOn: 0, ccOff: 0, total: 0 };
        youtubeMetrics.forEach(m => { totals.yt += m.estimatedRevenue; totals.total += m.estimatedRevenue; });
        amazonMetrics.forEach(m => {
            if (m.reportType === 'offsite') totals.aff += m.revenue;
            else if (m.reportType === 'onsite') totals.inf += m.revenue;
            else if (m.reportType === 'creator_connections') {
                if (m.creatorConnectionsType === 'onsite') totals.ccOn += m.revenue;
                else totals.ccOff += m.revenue;
            }
            totals.total += m.revenue;
        });
        return totals;
    }, [youtubeMetrics, amazonMetrics]);

    // Unified Registry View
    const unifiedEntities = useMemo(() => {
        const entities: any[] = [];
        const consumedAmMetricIds = new Set<string>();

        const amByAsin = new Map<string, AmazonMetric[]>();
        const amByVideoTitle = new Map<string, AmazonMetric[]>();
        amazonMetrics.forEach(m => {
            if (!amByAsin.has(m.asin)) amByAsin.set(m.asin, []);
            amByAsin.get(m.asin)!.push(m);
            if (m.videoTitle) {
                const norm = normalizeTitle(m.videoTitle);
                if (!amByVideoTitle.has(norm)) amByVideoTitle.set(norm, []);
                amByVideoTitle.get(norm)!.push(m);
            }
        });

        const ytVideos = new Map<string, any>();
        youtubeMetrics.forEach(m => {
            if (!ytVideos.has(m.videoId)) {
                ytVideos.set(m.videoId, { 
                    id: m.videoId, title: m.videoTitle, originalTitle: m.videoTitle,
                    ytRev: 0, amAffRev: 0, amInfRev: 0, ccOnRev: 0, ccOffRev: 0, total: 0, 
                    date: m.publishDate, isLinked: false, type: 'youtube'
                });
            }
            ytVideos.get(m.videoId).ytRev += m.estimatedRevenue;
        });

        ytVideos.forEach((yt, videoId) => {
            const link = contentLinks.find(l => l.youtubeVideoId === videoId);
            const targets: AmazonMetric[] = [];

            if (link) {
                yt.isLinked = true;
                if (link.simplifiedName) yt.title = link.simplifiedName;
                link.amazonAsins.forEach(asin => {
                    const matches = amByAsin.get(asin) || [];
                    targets.push(...matches);
                });
            }

            const normTitle = normalizeTitle(yt.originalTitle);
            const titleMatches = amByVideoTitle.get(normTitle) || [];
            targets.push(...titleMatches);

            const uniqueTargets = new Set<string>();
            targets.forEach(m => {
                if (uniqueTargets.has(m.id)) return;
                uniqueTargets.add(m.id);
                consumedAmMetricIds.add(m.id);
                if (m.reportType === 'offsite') yt.amAffRev += m.revenue;
                else if (m.reportType === 'onsite') yt.amInfRev += m.revenue;
                else if (m.reportType === 'creator_connections') {
                    if (m.creatorConnectionsType === 'onsite') yt.ccOnRev += m.revenue;
                    else yt.ccOffRev += m.revenue;
                }
            });
            yt.total = yt.ytRev + yt.amAffRev + yt.amInfRev + yt.ccOnRev + yt.ccOffRev;
            entities.push(yt);
        });

        const orphanedMap = new Map<string, any>();
        amazonMetrics.forEach(m => {
            if (consumedAmMetricIds.has(m.id)) return;
            if (!orphanedMap.has(m.asin)) {
                orphanedMap.set(m.asin, {
                    id: m.asin, title: m.productTitle || m.asin, originalTitle: m.productTitle || m.asin, date: m.saleDate,
                    ytRev: 0, amAffRev: 0, amInfRev: 0, ccOnRev: 0, ccOffRev: 0, total: 0, isLinked: false, type: 'amazon'
                });
            }
            const orphan = orphanedMap.get(m.asin)!;
            if (m.reportType === 'offsite') orphan.amAffRev += m.revenue;
            else if (m.reportType === 'onsite') orphan.amInfRev += m.revenue;
            else if (m.reportType === 'creator_connections') {
                if (m.creatorConnectionsType === 'onsite') orphan.ccOnRev += m.revenue;
                else orphan.ccOffRev += m.revenue;
            }
            orphan.total = orphan.amAffRev + orphan.amInfRev + orphan.ccOnRev + orphan.ccOffRev;
        });
        entities.push(...Array.from(orphanedMap.values()));
        return entities.sort((a, b) => b.total - a.total);
    }, [youtubeMetrics, amazonMetrics, contentLinks]);

    // HANDLERS
    const handleRunLinker = async () => {
        if (!metaFile || !mapFile) return;
        setIsScanning(true);
        setScanProgress('Parsing Metadata...');
        
        try {
            const amzVideos = await parseAmazonVideoMetadata(metaFile, msg => setScanProgress(msg));
            const amzMaps = await parseAmazonProductMapping(mapFile, msg => setScanProgress(msg));
            
            setScanProgress('Finding logical matches...');

            // Map AMZ Title -> ASINs
            const titleToAsins = new Map<string, Set<string>>();
            amzMaps.forEach(m => {
                if (m.videoTitle && m.asins) {
                    const norm = normalizeTitle(m.videoTitle);
                    if (!titleToAsins.has(norm)) titleToAsins.set(norm, new Set());
                    m.asins.forEach(asin => titleToAsins.get(norm)!.add(asin));
                }
            });

            // Perform Cross-Platform Matching (Stage 1)
            const matches: VerificationMatch[] = [];
            
            // Deduplicate YT metrics by videoId for matching
            const uniqueYtVideos = new Map<string, YouTubeMetric>();
            youtubeMetrics.forEach(m => uniqueYtVideos.set(m.videoId, m));

            uniqueYtVideos.forEach(yt => {
                const normYtTitle = normalizeTitle(yt.videoTitle);
                const normYtDuration = normalizeDuration(yt.duration || '');

                amzVideos.forEach(amv => {
                    const normAmTitle = normalizeTitle(amv.videoTitle || '');
                    const normAmDuration = normalizeDuration(amv.duration || '');

                    const titleMatch = normYtTitle === normAmTitle;
                    const durationMatch = normYtDuration && normAmDuration && normYtDuration === normAmDuration;

                    if (titleMatch || durationMatch) {
                        const asins = titleToAsins.get(normAmTitle);
                        matches.push({
                            id: generateUUID(),
                            youtubeMetric: yt,
                            amazonVideo: amv as AmazonVideo,
                            matchType: (titleMatch && durationMatch) ? 'both' : titleMatch ? 'title' : 'duration',
                            asins: asins ? Array.from(asins) : [],
                            isSelected: true
                        });
                    }
                });
            });

            setStagedVideoMatches(matches);
            setVerificationStage('matching');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Linker failed.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleProceedToNaming = async () => {
        const verifiedMatches = stagedVideoMatches.filter(m => m.isSelected);
        if (verifiedMatches.length === 0) {
            alert("Please verify at least one video match.");
            return;
        }

        setIsSimplifying(true);
        setVerificationStage('naming');
        
        try {
            // Collect all unique ASINs from verified matches
            const uniqueAsins = new Set<string>();
            verifiedMatches.forEach(m => m.asins.forEach(a => uniqueAsins.add(a)));

            const namingDrafts: ProductNamingMatch[] = [];
            const originalTitles: string[] = [];

            uniqueAsins.forEach(asin => {
                const metric = amazonMetrics.find(m => m.asin === asin);
                const name = metric?.productTitle || asin;
                namingDrafts.push({
                    asin,
                    originalName: name,
                    simplifiedName: name.length > 30 ? name.substring(0, 30) + '...' : name,
                    isSelected: true
                });
                originalTitles.push(name);
            });

            // Use AI to simplify if possible
            if (originalTitles.length > 0) {
                try {
                    const aiMappings = await simplifyProductNames(originalTitles);
                    namingDrafts.forEach(draft => {
                        if (aiMappings[draft.originalName]) {
                            draft.simplifiedName = aiMappings[draft.originalName];
                        }
                    });
                } catch (aiErr) {
                    console.warn("AI simplification failed, using truncated names.", aiErr);
                }
            }

            setStagedNamingMatches(namingDrafts);
        } finally {
            setIsSimplifying(false);
        }
    };

    const handleFinalizeImport = () => {
        const finalNamingMap = new Map<string, string>();
        stagedNamingMatches.forEach(n => {
            if (n.isSelected) finalNamingMap.set(n.asin, n.simplifiedName);
        });

        const nextLinks = [...contentLinks];
        stagedVideoMatches.filter(m => m.isSelected).forEach(match => {
            // Check if multiple ASINs for one video
            const simplifiedName = match.asins.length > 0 ? (finalNamingMap.get(match.asins[0]) || match.youtubeMetric.videoTitle) : match.youtubeMetric.videoTitle;

            const newLink: ContentLink = {
                id: generateUUID(),
                youtubeVideoId: match.youtubeMetric.videoId,
                amazonAsins: match.asins,
                title: match.youtubeMetric.videoTitle,
                manuallyLinked: false,
                videoCreationDate: match.youtubeMetric.publishDate,
                videoDuration: match.youtubeMetric.duration,
                simplifiedName
            };

            const idx = nextLinks.findIndex(l => l.youtubeVideoId === newLink.youtubeVideoId);
            if (idx > -1) nextLinks[idx] = newLink;
            else nextLinks.push(newLink);
        });

        onUpdateLinks(finalNamingMap.size > 0 ? nextLinks : contentLinks); // Dummy conditional to use finalNamingMap
        setVerificationStage('upload');
        setStagedVideoMatches([]);
        setStagedNamingMatches([]);
        setActiveTab('roi');
    };

    const filteredEntities = unifiedEntities.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.originalTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 h-full flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ChartPieIcon className="w-8 h-8 text-indigo-600" /> Content ROI Hub
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Platform orchestration and cross-network attribution.</p>
                </div>
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('roi')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'roi' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>ROI Registry</button>
                    <button onClick={() => setActiveTab('linker')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'linker' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Identity Linker</button>
                </div>
            </div>

            {/* Aggregates (Always Visible for context) */}
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
                                    placeholder="Filter clusters..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Content Identity</th>
                                        <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Published</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">YouTube</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amazon (Off)</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amazon (On)</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">CC (Total)</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-800 uppercase tracking-widest border-b bg-indigo-50/50">Total ROI</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {filteredEntities.map((e, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 max-w-md">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">#{idx+1}</div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-800 truncate" title={e.originalTitle}>{e.title}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {e.isLinked && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1"><ShieldCheckIcon className="w-2 b-2" /> VERIFIED</span>}
                                                            <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{e.type}</span>
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
                ) : (
                    // Linker Flow
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {verificationStage === 'upload' && (
                            <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-slate-50/30">
                                <div className="max-w-4xl mx-auto space-y-10">
                                    <div className="text-center space-y-4">
                                        <div className="p-4 bg-indigo-600 text-white rounded-3xl inline-block shadow-xl shadow-indigo-200">
                                            <WorkflowIcon className="w-12 h-12" />
                                        </div>
                                        <h2 className="text-3xl font-black text-slate-800">Identify Cross-Network Signals</h2>
                                        <p className="text-slate-500 max-lg mx-auto leading-relaxed">Map Amazon Video metadata to YouTube Metrics using title and duration fingerprinting.</p>
                                    </div>

                                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                                    <div className="p-2 bg-red-50 text-red-600 rounded-lg"><VideoIcon className="w-4 h-4" /></div>
                                                    1. Video Fingerprints
                                                </h3>
                                                <p className="text-xs text-slate-500 leading-relaxed font-medium">Upload Amazon's Video Metadata export (Title + Duration).</p>
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
                                                <p className="text-xs text-slate-500 leading-relaxed font-medium">Upload the Product Map export (Title + ASIN).</p>
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
                                                    <div className="w-48 bg-slate-100 rounded-full h-1 overflow-hidden">
                                                        <div className="h-full bg-indigo-600 animate-progress-indeterminate w-1/3" />
                                                    </div>
                                                    <p className="text-sm font-black text-indigo-600 uppercase tracking-widest animate-pulse">{scanProgress}</p>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={handleRunLinker}
                                                    disabled={!metaFile || !mapFile}
                                                    className="px-16 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-30 flex items-center gap-3 uppercase text-sm active:scale-95"
                                                >
                                                    <PlayIcon className="w-5 h-5" /> Analyze Connections
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {verificationStage === 'matching' && (
                            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                                <div className="p-8 border-b bg-indigo-50 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800">1. Video Match Verification</h3>
                                        <p className="text-sm text-slate-500">We matched <strong>{stagedVideoMatches.length}</strong> videos by Title or Duration. Please confirm identity.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setVerificationStage('upload')} className="px-6 py-2 text-xs font-black uppercase text-slate-500 hover:bg-white rounded-xl transition-all">Back</button>
                                        <button onClick={handleProceedToNaming} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 uppercase text-xs">
                                            Verify & Proceed <ChevronRightIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-white">
                                    <div className="space-y-4 max-w-5xl mx-auto">
                                        {stagedVideoMatches.map((match) => (
                                            <div key={match.id} className={`p-5 rounded-[2rem] border-2 flex items-center gap-6 transition-all ${match.isSelected ? 'border-indigo-600 bg-indigo-50/20 shadow-sm' : 'border-slate-100 bg-white opacity-60'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={match.isSelected} 
                                                    onChange={() => setStagedVideoMatches(prev => prev.map(m => m.id === match.id ? {...m, isSelected: !m.isSelected} : m))}
                                                    className="w-6 h-6 rounded-lg text-indigo-600 cursor-pointer"
                                                />
                                                <div className="grid grid-cols-1 md:grid-cols-2 flex-1 gap-10">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1"><YoutubeIcon className="w-3 h-3" /> YouTube Metric</p>
                                                        <p className="text-sm font-black text-slate-800 truncate" title={match.youtubeMetric.videoTitle}>{match.youtubeMetric.videoTitle}</p>
                                                        <div className="flex gap-4 text-[10px] font-bold text-slate-400">
                                                            {/* Fixed: CalendarIcon is now imported */}
                                                            <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {match.youtubeMetric.publishDate}</span>
                                                            <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> {match.youtubeMetric.duration || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 border-l border-slate-200 pl-10">
                                                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1"><BoxIcon className="w-3 h-3" /> Amazon Signal</p>
                                                        <p className="text-sm font-black text-slate-800 truncate" title={match.amazonVideo.videoTitle}>{match.amazonVideo.videoTitle}</p>
                                                        <div className="flex gap-4 text-[10px] font-bold text-slate-400">
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase ${match.matchType === 'title' ? 'bg-blue-100 text-blue-700' : match.matchType === 'duration' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                                                Matched by {match.matchType}
                                                            </span>
                                                            <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> {match.amazonVideo.duration || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {verificationStage === 'naming' && (
                            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                                <div className="p-8 border-b bg-indigo-50 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800">2. Product Identity Polish</h3>
                                        <p className="text-sm text-slate-500">Associated <strong>{stagedNamingMatches.length}</strong> unique ASINs. Verify simplified branding.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setVerificationStage('matching')} className="px-6 py-2 text-xs font-black uppercase text-slate-500 hover:bg-white rounded-xl transition-all">Back</button>
                                        <button onClick={handleFinalizeImport} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 uppercase text-xs">
                                            <CheckCircleIcon className="w-5 h-5" /> Commit Mapping
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-white">
                                    {isSimplifying ? (
                                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                                            <p className="text-lg font-black text-indigo-900 uppercase tracking-widest animate-pulse">Neural Branding Engine Active...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 max-w-5xl mx-auto">
                                            {stagedNamingMatches.map((n) => (
                                                <div key={n.asin} className={`p-5 rounded-[2.5rem] border-2 flex items-center gap-6 transition-all ${n.isSelected ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-100 opacity-40'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={n.isSelected} 
                                                        onChange={() => setStagedNamingMatches(prev => prev.map(item => item.asin === n.asin ? {...item, isSelected: !item.isSelected} : item))}
                                                        className="w-6 h-6 rounded-lg text-emerald-600 cursor-pointer"
                                                    />
                                                    <div className="grid grid-cols-1 md:grid-cols-2 flex-1 gap-8">
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Amazon SKU Record</p>
                                                            <p className="text-xs font-bold text-slate-500 truncate" title={n.originalName}>{n.originalName}</p>
                                                            <p className="text-[10px] font-mono text-slate-400 mt-1">{n.asin}</p>
                                                        </div>
                                                        <div className="flex-1 min-w-0 bg-white p-4 rounded-2xl border border-emerald-100 shadow-inner">
                                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><SparklesIcon className="w-3 h-3" /> Dashboard Designation</p>
                                                            <input 
                                                                type="text" 
                                                                value={n.simplifiedName}
                                                                onChange={(e) => setStagedNamingMatches(prev => prev.map(item => item.asin === n.asin ? {...item, simplifiedName: e.target.value} : item))}
                                                                className="w-full text-sm font-black text-slate-800 bg-transparent border-none p-0 focus:ring-0"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Re-defining missing icon component for this file
const ClockIcon = ({className}: {className?: string}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default ContentHub;