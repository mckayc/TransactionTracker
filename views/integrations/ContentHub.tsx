
import React, { useState, useMemo } from 'react';
import type { AmazonMetric, YouTubeMetric, ContentLink } from '../../types';
import { ChartPieIcon, YoutubeIcon, BoxIcon, TrendingUpIcon, LightBulbIcon, SearchCircleIcon, SparklesIcon, CheckCircleIcon, ExternalLinkIcon, SortIcon, InfoIcon, ShieldCheckIcon } from '../../components/Icons';
import { generateUUID } from '../../utils';

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

    // 1. Group YouTube data by Video ID
    const youtubeByVideo = useMemo(() => {
        const map = new Map<string, { id: string, title: string, revenue: number, views: number, date: string }>();
        youtubeMetrics.forEach(m => {
            if (!map.has(m.videoId)) {
                map.set(m.videoId, { id: m.videoId, title: m.videoTitle, revenue: 0, views: 0, date: m.publishDate });
            }
            const ex = map.get(m.videoId)!;
            ex.revenue += m.estimatedRevenue;
            ex.views += m.views;
        });
        return Array.from(map.values());
    }, [youtubeMetrics]);

    // 2. Group Amazon data by unique Product/Video identifiers
    const amazonByContent = useMemo(() => {
        const map = new Map<string, { 
            title: string, 
            onsiteRevenue: number, 
            offsiteRevenue: number, 
            asins: string[],
            isLinked?: boolean
        }>();

        amazonMetrics.forEach(m => {
            // Priority: Video Title > CC Title > Product Title
            const contentKey = m.videoTitle || m.ccTitle || m.productTitle || 'Unknown';
            if (!map.has(contentKey)) {
                map.set(contentKey, { title: contentKey, onsiteRevenue: 0, offsiteRevenue: 0, asins: [] });
            }
            const ex = map.get(contentKey)!;
            if (m.reportType === 'onsite') ex.onsiteRevenue += m.revenue;
            else ex.offsiteRevenue += m.revenue;
            
            if (!ex.asins.includes(m.asin)) ex.asins.push(m.asin);
        });
        return Array.from(map.values());
    }, [amazonMetrics]);

    // 3. The Matcher Tool
    const handleAutoLink = async () => {
        setIsScanning(true);
        await new Promise(r => setTimeout(r, 1000)); // Simulate work

        const newLinks: ContentLink[] = [...contentLinks];
        const existingYtIds = new Set(newLinks.map(l => l.youtubeVideoId));

        youtubeByVideo.forEach(yt => {
            if (existingYtIds.has(yt.id)) return;

            const normalizedYt = normalizeTitle(yt.title);
            
            // Try to find an Amazon content block that matches
            const match = amazonByContent.find(am => {
                const normalizedAm = normalizeTitle(am.title);
                return normalizedAm.includes(normalizedYt) || normalizedYt.includes(normalizedAm);
            });

            if (match) {
                newLinks.push({
                    id: generateUUID(),
                    youtubeVideoId: yt.id,
                    amazonAsins: match.asins,
                    title: yt.title,
                    manuallyLinked: false
                });
            }
        });

        onUpdateLinks(newLinks);
        setIsScanning(false);
        alert(`Linked ${newLinks.length - contentLinks.length} new videos!`);
    };

    // 4. Combine Everything for the ROI View
    const roiData = useMemo(() => {
        const results = youtubeByVideo.map(yt => {
            const link = contentLinks.find(l => l.youtubeVideoId === yt.id);
            
            // Find Amazon Metrics for this link
            let amOnsite = 0;
            let amOffsite = 0;

            if (link) {
                // Find by title or ASIN
                amazonByContent.forEach(am => {
                    const matchesTitle = normalizeTitle(am.title) === normalizeTitle(link.title);
                    const matchesAsin = link.amazonAsins.some(asin => am.asins.includes(asin));
                    if (matchesTitle || matchesAsin) {
                        amOnsite += am.onsiteRevenue;
                        amOffsite += am.offsiteRevenue;
                    }
                });
            } else {
                // If not explicitly linked, try a soft title match
                const softMatch = amazonByContent.find(am => normalizeTitle(am.title) === normalizeTitle(yt.title));
                if (softMatch) {
                    amOnsite = softMatch.onsiteRevenue;
                    amOffsite = softMatch.offsiteRevenue;
                }
            }

            return {
                ...yt,
                amOnsite,
                amOffsite,
                totalRoi: yt.revenue + amOnsite + amOffsite,
                isLinked: !!link
            };
        });

        results.sort((a, b) => b.totalRoi - a.totalRoi);
        return results;
    }, [youtubeByVideo, amazonByContent, contentLinks]);

    const globalTotals = useMemo(() => {
        return roiData.reduce((acc, curr) => ({
            adsense: acc.adsense + curr.revenue,
            onsite: acc.onsite + curr.amOnsite,
            offsite: acc.offsite + curr.amOffsite,
            total: acc.total + curr.totalRoi
        }), { adsense: 0, onsite: 0, offsite: 0, total: 0 });
    }, [roiData]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ChartPieIcon className="w-8 h-8 text-indigo-600" /> Content ROI Hub
                    </h1>
                    <p className="text-slate-500">Cross-platform performance tracking.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleAutoLink} 
                        disabled={isScanning}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                        {isScanning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                        Auto-Link Platforms
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Combined ROI</p>
                    <p className="text-2xl font-black text-indigo-700 mt-1">{formatCurrency(globalTotals.total)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">YouTube AdSense</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(globalTotals.adsense)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">YouTube Traffic (Offsite)</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(globalTotals.offsite)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amazon Platform (Onsite)</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(globalTotals.onsite)}</p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Video Performance Attribution</h3>
                    <div className="text-xs text-slate-400 italic">Matched by title similarity and manual links</div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Video Title</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">YouTube (Ad)</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">YouTube (Comm)</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amazon (Onsite)</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-indigo-50">Total ROI</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {roiData.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 max-w-md">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-slate-300">#{i + 1}</span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-700 truncate" title={row.title}>{row.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] text-slate-400 font-mono">ID: {row.id}</span>
                                                    {row.isLinked && <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-1 rounded flex items-center gap-1"><ShieldCheckIcon className="w-2 h-2" /> Linked</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-red-600 font-mono">{formatCurrency(row.revenue)}</td>
                                    <td className="px-6 py-4 text-right text-sm text-green-600 font-mono">{formatCurrency(row.amOffsite)}</td>
                                    <td className="px-6 py-4 text-right text-sm text-blue-600 font-mono">{formatCurrency(row.amOnsite)}</td>
                                    <td className="px-6 py-4 text-right text-sm font-black text-indigo-900 bg-indigo-50/30 font-mono">{formatCurrency(row.totalRoi)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2"><TrendingUpIcon className="w-6 h-6 text-indigo-400" /> Strategic Insight</h3>
                        <p className="text-indigo-200 mt-2 max-w-xl">
                            By linking platforms, we can see that YouTube represents 
                            <strong className="text-white mx-1">{((globalTotals.adsense + globalTotals.offsite) / globalTotals.total * 100).toFixed(0)}%</strong> 
                            of your business value, while Amazon Onsite generates 
                            <strong className="text-white mx-1">{(globalTotals.onsite / globalTotals.total * 100).toFixed(0)}%</strong> 
                            of the revenue without external promotion.
                        </p>
                    </div>
                    <div className="flex-shrink-0 text-center">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Top Platform</p>
                        <p className="text-2xl font-black">{globalTotals.adsense + globalTotals.offsite > globalTotals.onsite ? 'YouTube' : 'Amazon'}</p>
                    </div>
                </div>
                <SparklesIcon className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 pointer-events-none" />
            </div>
        </div>
    );
};

export default ContentHub;
