import React, { useState, useMemo, useRef } from 'react';
import type { JoinedMetric, YouTubeMetric, AmazonMetric } from '../../types';
import { 
    BoxIcon, YoutubeIcon, CloudArrowUpIcon, CheckCircleIcon, SparklesIcon, 
    TrashIcon, SearchCircleIcon, CloseIcon, InfoIcon, TrendingUpIcon, 
    ListIcon, ArrowRightIcon, DatabaseIcon, LinkIcon, WorkflowIcon, CheckBadgeIcon
} from '../../components/Icons';
import { parseYouTubeDetailedReport, parseAmazonEarningsReport, parseCreatorConnectionsReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';
import ConfirmationModal from '../../components/ConfirmationModal';

interface Props {
    metrics: JoinedMetric[];
    onSaveMetrics: (metrics: JoinedMetric[]) => void;
    youtubeMetrics?: YouTubeMetric[];
    amazonMetrics?: AmazonMetric[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);
const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const InstructionBox: React.FC<{ title: string; url: string; path: string; icon: React.ReactNode }> = ({ title, url, path, icon }) => (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
        <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">{icon}</div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">{title}</h4>
        </div>
        <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Location:</p>
            <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 font-bold hover:underline break-all">{url}</a>
        </div>
        <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Instruction:</p>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{path}</p>
        </div>
    </div>
);

const ProductAsinJoiner: React.FC<Props> = ({ metrics, onSaveMetrics }) => {
    const [view, setView] = useState<'upload' | 'dashboard'>('upload');
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<JoinedMetric | null>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');

    // Internal staging state for uploads
    const [onsiteFile, setOnsiteFile] = useState<AmazonMetric[] | null>(null);
    const [offsiteFile, setOffsiteFile] = useState<AmazonMetric[] | null>(null);
    const [ccFile, setCcFile] = useState<AmazonMetric[] | null>(null);
    const [youtubeFile, setYoutubeFile] = useState<YouTubeMetric[] | null>(null);

    const handleClearAll = () => {
        onSaveMetrics([]);
        setShowClearConfirm(false);
    };

    const handleUpload = async (type: 'onsite' | 'offsite' | 'cc' | 'youtube', file: File) => {
        setIsProcessing(true);
        try {
            if (type === 'youtube') {
                const parsed = await parseYouTubeDetailedReport(file, () => {});
                setYoutubeFile(parsed);
            } else if (type === 'cc') {
                const parsed = await parseCreatorConnectionsReport(file, () => {});
                setCcFile(parsed);
            } else {
                const parsed = await parseAmazonEarningsReport(file, () => {});
                if (type === 'onsite') setOnsiteFile(parsed);
                else setOffsiteFile(parsed);
            }
        } catch (err) {
            alert(`Failed to parse ${type} report. Check format.`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleJoin = async () => {
        setIsProcessing(true);
        const assetMap = new Map<string, JoinedMetric>();

        const getAsset = (asin: string, title: string, videoId?: string): JoinedMetric => {
            const key = asin || videoId || title;
            if (!assetMap.has(key)) {
                assetMap.set(key, {
                    id: generateUUID(),
                    asin: asin || '',
                    videoId: videoId || '',
                    mainTitle: title,
                    subTitle: title,
                    views: 0, watchTimeHours: 0, subsGained: 0,
                    videoEstimatedRevenue: 0, amazonOnsiteRevenue: 0, amazonOffsiteRevenue: 0,
                    creatorConnectionsOnsiteRevenue: 0, creatorConnectionsOffsiteRevenue: 0,
                    totalRevenue: 0, clicks: 0, orderedItems: 0, shippedItems: 0
                });
            }
            return assetMap.get(key)!;
        };

        // 1. Process YouTube
        youtubeFile?.forEach(yt => {
            const asset = getAsset('', yt.videoTitle, yt.videoId);
            asset.views += yt.views;
            asset.videoEstimatedRevenue += yt.estimatedRevenue;
            asset.watchTimeHours += yt.watchTimeHours;
            asset.subsGained += yt.subscribersGained;
        });

        // 2. Process Amazon Onsite
        onsiteFile?.forEach(amz => {
            const asset = getAsset(amz.asin, amz.productTitle);
            asset.amazonOnsiteRevenue += amz.revenue;
            asset.orderedItems += amz.orderedItems;
            asset.shippedItems += amz.shippedItems;
        });

        // 3. Process Amazon Offsite
        offsiteFile?.forEach(amz => {
            const asset = getAsset(amz.asin, amz.productTitle);
            asset.amazonOffsiteRevenue += amz.revenue;
            asset.orderedItems += amz.orderedItems;
            asset.shippedItems += amz.shippedItems;
        });

        // 4. Process CC
        ccFile?.forEach(cc => {
            const asset = getAsset(cc.asin, cc.productTitle);
            // Creator connections are usually onsite commissions but can vary
            if (cc.reportType === 'onsite') asset.creatorConnectionsOnsiteRevenue += cc.revenue;
            else asset.creatorConnectionsOffsiteRevenue += cc.revenue;
            asset.clicks += cc.clicks;
            asset.orderedItems += cc.orderedItems;
        });

        // Calculate Totals
        const finalMetrics = Array.from(assetMap.values()).map(m => ({
            ...m,
            totalRevenue: m.videoEstimatedRevenue + m.amazonOnsiteRevenue + m.amazonOffsiteRevenue + m.creatorConnectionsOnsiteRevenue + m.creatorConnectionsOffsiteRevenue
        }));

        onSaveMetrics(finalMetrics);
        setView('dashboard');
        setIsProcessing(false);
    };

    const displayMetrics = useMemo(() => {
        let base = [...metrics];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            base = base.filter(m => m.mainTitle.toLowerCase().includes(q) || m.asin.toLowerCase().includes(q));
        }
        return base.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [metrics, searchTerm]);

    const potentialLinks = useMemo(() => {
        if (!linkSearch) return [];
        const q = linkSearch.toLowerCase();
        return metrics.filter(m => 
            (m.mainTitle.toLowerCase().includes(q) || m.asin.toLowerCase().includes(q)) && 
            m.id !== selectedAsset?.id
        ).slice(0, 10);
    }, [linkSearch, metrics, selectedAsset]);

    const handleExecuteLink = (target: JoinedMetric) => {
        if (!selectedAsset) return;
        
        const merged: JoinedMetric = {
            ...selectedAsset,
            asin: selectedAsset.asin || target.asin,
            videoId: selectedAsset.videoId || target.videoId,
            views: selectedAsset.views + target.views,
            videoEstimatedRevenue: selectedAsset.videoEstimatedRevenue + target.videoEstimatedRevenue,
            amazonOnsiteRevenue: selectedAsset.amazonOnsiteRevenue + target.amazonOnsiteRevenue,
            amazonOffsiteRevenue: selectedAsset.amazonOffsiteRevenue + target.amazonOffsiteRevenue,
            creatorConnectionsOnsiteRevenue: selectedAsset.creatorConnectionsOnsiteRevenue + target.creatorConnectionsOnsiteRevenue,
            creatorConnectionsOffsiteRevenue: selectedAsset.creatorConnectionsOffsiteRevenue + target.creatorConnectionsOffsiteRevenue,
            totalRevenue: selectedAsset.totalRevenue + target.totalRevenue,
            clicks: selectedAsset.clicks + target.clicks,
            orderedItems: selectedAsset.orderedItems + target.orderedItems,
        };

        const nextMetrics = metrics
            .filter(m => m.id !== selectedAsset.id && m.id !== target.id)
            .concat(merged);
        
        onSaveMetrics(nextMetrics);
        setIsLinking(false);
        setSelectedAsset(null);
    };

    if (view === 'upload') {
        return (
            <div className="max-w-4xl mx-auto space-y-10 py-10 animate-fade-in">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                        <WorkflowIcon className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Product & ASIN Joiner</h2>
                    <p className="text-slate-500 max-w-lg mx-auto font-medium">Unify your Amazon Influencer, Associate, and YouTube AdSense revenue streams into a single high-fidelity registry.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <InstructionBox 
                            title="Amazon Offsite" 
                            url="https://affiliate-program.amazon.com/p/reporting/earnings"
                            path="Select Date Range > Download Reports > CSV Earnings > Fee-Earnings"
                            icon={<BoxIcon className="w-5 h-5 text-green-600" />}
                        />
                        <div className="relative group">
                            <input type="file" className="sr-only" id="offsite-up" onChange={e => e.target.files?.[0] && handleUpload('offsite', e.target.files[0])} />
                            <label htmlFor="offsite-up" className={`w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${offsiteFile ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                                {offsiteFile ? <CheckCircleIcon className="w-8 h-8 text-emerald-600 mb-2" /> : <CloudArrowUpIcon className="w-8 h-8 text-slate-300 mb-2" />}
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{offsiteFile ? 'OFFSITE LOADED' : 'UPLOAD OFFSITE CSV'}</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <InstructionBox 
                            title="Amazon Onsite" 
                            url="https://affiliate-program.amazon.com/p/reporting/earnings"
                            path="Select Date Range > Download Reports > CSV Earnings > Fee-Earnings"
                            icon={<BoxIcon className="w-5 h-5 text-blue-600" />}
                        />
                        <div className="relative group">
                            <input type="file" className="sr-only" id="onsite-up" onChange={e => e.target.files?.[0] && handleUpload('onsite', e.target.files[0])} />
                            <label htmlFor="onsite-up" className={`w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${onsiteFile ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                                {onsiteFile ? <CheckCircleIcon className="w-8 h-8 text-emerald-600 mb-2" /> : <CloudArrowUpIcon className="w-8 h-8 text-slate-300 mb-2" />}
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{onsiteFile ? 'ONSITE LOADED' : 'UPLOAD ONSITE CSV'}</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <InstructionBox 
                            title="Creator Connections" 
                            url="https://affiliate-program.amazon.com/p/connect/home"
                            path="Reporting > See More > Select Date Range > Download Report"
                            icon={<SparklesIcon className="w-5 h-5 text-indigo-600" />}
                        />
                        <div className="relative group">
                            <input type="file" className="sr-only" id="cc-up" onChange={e => e.target.files?.[0] && handleUpload('cc', e.target.files[0])} />
                            <label htmlFor="cc-up" className={`w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${ccFile ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                                {ccFile ? <CheckCircleIcon className="w-8 h-8 text-emerald-600 mb-2" /> : <CloudArrowUpIcon className="w-8 h-8 text-slate-300 mb-2" />}
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{ccFile ? 'CC LOADED' : 'UPLOAD CC CSV'}</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <InstructionBox 
                            title="YouTube Reports" 
                            url="https://studio.youtube.com/"
                            path="Analytics > Advanced Mode > Export Current View > CSV (Table data.csv)"
                            icon={<YoutubeIcon className="w-5 h-5 text-red-600" />}
                        />
                        <div className="relative group">
                            <input type="file" className="sr-only" id="yt-up" onChange={e => e.target.files?.[0] && handleUpload('youtube', e.target.files[0])} />
                            <label htmlFor="yt-up" className={`w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${youtubeFile ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                                {youtubeFile ? <CheckCircleIcon className="w-8 h-8 text-emerald-600 mb-2" /> : <CloudArrowUpIcon className="w-8 h-8 text-slate-300 mb-2" />}
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{youtubeFile ? 'YOUTUBE LOADED' : 'UPLOAD YOUTUBE CSV'}</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-200 flex flex-col items-center gap-6">
                    <button 
                        onClick={handleJoin}
                        disabled={isProcessing || (!onsiteFile && !offsiteFile && !ccFile && !youtubeFile)}
                        className="px-16 py-5 bg-indigo-600 text-white font-black text-xl rounded-3xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none flex items-center gap-3"
                    >
                        {isProcessing ? <div className="w-6 h-6 border-4 border-t-white rounded-full animate-spin" /> : <DatabaseIcon className="w-6 h-6" />}
                        Execute Synthesis
                    </button>
                    {metrics.length > 0 && <button onClick={() => setView('dashboard')} className="text-sm font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Skip to Dashboard</button>}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><TrendingUpIcon className="w-6 h-6" /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Yield Registry</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{displayMetrics.length} Active Content Assets</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="Search Registry..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-0 focus:border-indigo-500 outline-none font-bold"
                        />
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                    <button onClick={() => setView('upload')} className="px-5 py-2 bg-white border-2 border-slate-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Update Sources</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Asset Identity</th>
                                <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Performance Reach</th>
                                <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Yield Matrix</th>
                                <th className="px-8 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">Linkage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {displayMetrics.map(m => {
                                const isLinked = m.videoId && m.asin;
                                return (
                                    <tr key={m.id} className="hover:bg-indigo-50/20 transition-all group">
                                        <td className="px-8 py-3 max-w-[400px]">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 truncate">{m.mainTitle}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase ${m.videoId ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400'}`}>{m.videoId || 'NO_VID'}</span>
                                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase ${m.asin ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400'}`}>{m.asin || 'NO_ASIN'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-3 text-right">
                                            <p className="text-xs font-bold text-slate-600 font-mono">{formatNumber(m.views)} <span className="text-[8px] text-slate-400 uppercase">Views</span></p>
                                            <p className="text-[8px] text-slate-400 font-black uppercase mt-0.5">{formatNumber(m.clicks)} Shoppers</p>
                                        </td>
                                        <td className="px-8 py-3 text-right">
                                            <p className="text-sm font-black text-indigo-600 font-mono">{formatCurrency(m.totalRevenue)}</p>
                                            <div className="flex justify-end gap-1 mt-1 opacity-40 group-hover:opacity-100">
                                                {m.videoEstimatedRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="YT" />}
                                                {m.amazonOnsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Onsite" />}
                                                {m.creatorConnectionsOnsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="CC" />}
                                                {m.amazonOffsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Offsite" />}
                                            </div>
                                        </td>
                                        <td className="px-8 py-3 text-center">
                                            <button 
                                                onClick={() => { setSelectedAsset(m); setIsLinking(true); setLinkSearch(''); }}
                                                className={`p-2 rounded-xl transition-all shadow-sm ${isLinked ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                                            >
                                                {isLinked ? <CheckBadgeIcon className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isLinking && selectedAsset && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Asset Logic Forge</h3>
                            <button onClick={() => setIsLinking(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-8">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Targeting Asset</p>
                            <h4 className="font-bold text-slate-800 leading-tight">{selectedAsset.mainTitle}</h4>
                            <div className="flex gap-2 mt-2">
                                <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">{selectedAsset.videoId || 'NO_VID'}</span>
                                <span className="text-[8px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded uppercase">{selectedAsset.asin || 'NO_ASIN'}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Search other records to link..." 
                                    value={linkSearch}
                                    onChange={e => setLinkSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none shadow-inner"
                                />
                                <SearchCircleIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            </div>

                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                {potentialLinks.map(target => (
                                    <button 
                                        key={target.id}
                                        onClick={() => handleExecuteLink(target)}
                                        className="w-full p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
                                    >
                                        <div className="min-w-0 flex-1 pr-4">
                                            <p className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-900">{target.mainTitle}</p>
                                            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter mt-0.5">{target.asin || target.videoId}</p>
                                        </div>
                                        <ArrowRightIcon className="w-4 h-4 text-slate-200 group-hover:text-indigo-500 transition-colors" />
                                    </button>
                                ))}
                                {linkSearch && potentialLinks.length === 0 && <p className="text-center py-8 text-xs text-slate-400 font-medium italic">No other candidates found for linking.</p>}
                                {!linkSearch && <p className="text-center py-8 text-xs text-slate-400 font-medium italic">Type above to find records to consolidate.</p>}
                            </div>
                        </div>

                        <div className="mt-10 flex gap-4">
                            <button onClick={() => setIsLinking(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">Abort</button>
                        </div>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center">
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 animate-slide-up text-center max-w-sm w-full">
                        <div className="w-16 h-16 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Processing Matrix</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Unifying logical clusters...</p>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal 
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearAll}
                title="Wipe Yield Registry?"
                message="This will permanently delete all joined content ROI data. Your individual source reports (Amazon/YouTube) will remain safe in their respective modules."
                confirmLabel="Execute Purge"
                variant="danger"
            />
        </div>
    );
};

export default ProductAsinJoiner;