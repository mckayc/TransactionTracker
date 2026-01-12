import React, { useState, useMemo } from 'react';
import type { AmazonMetric, YouTubeMetric, ContentLink, AmazonVideo, AmazonReportType, AmazonCCType } from '../../types';
import { ChartPieIcon, YoutubeIcon, BoxIcon, TrendingUpIcon, LightBulbIcon, SearchCircleIcon, SparklesIcon, CheckCircleIcon, CloudArrowUpIcon, InfoIcon, WorkflowIcon, VideoIcon, LinkIcon, DatabaseIcon, PlusIcon, RepeatIcon, TrashIcon, ChevronDownIcon, CurrencyDollarIcon, CloseIcon } from '../../components/Icons';
import { generateUUID } from '../../utils';
import { 
    parseYouTubeDetailedReport, 
    parseAmazonStorefrontVideos, 
    parseVideoAsinMapping, 
    parseAmazonEarningsReport, 
    parseCreatorConnectionsReport 
} from '../../services/csvParserService';

interface VideoProductJoinerProps {
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
    contentLinks: ContentLink[];
    onUpdateLinks: (links: ContentLink[]) => void;
    onUpdateAmazonMetrics: (metrics: AmazonMetric[]) => void;
    onUpdateYoutubeMetrics: (metrics: YouTubeMetric[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const normalizeTitle = (title: string) => 
    (title || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDuration = (dur: string) => 
    (dur || '').replace(/^00:/, '').trim();

const StepIndicator: React.FC<{ step: number; active: number; label: string }> = ({ step, active, label }) => (
    <div className={`flex flex-col items-center gap-2 transition-all ${active >= step ? 'opacity-100' : 'opacity-30'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 ${active === step ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' : active > step ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
            {active > step ? <CheckCircleIcon className="w-4 h-4" /> : step}
        </div>
        <span className={`text-[9px] font-black uppercase tracking-tighter text-center max-w-[60px] ${active === step ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</span>
    </div>
);

const VideoProductJoiner: React.FC<VideoProductJoinerProps> = ({ amazonMetrics, youtubeMetrics, contentLinks, onUpdateLinks, onUpdateAmazonMetrics, onUpdateYoutubeMetrics }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'insights' | 'import'>('dashboard');
    const [importStep, setImportStep] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Multi-stage staging state
    const [stagedYt, setStagedYt] = useState<YouTubeMetric[]>([]);
    const [stagedAmzVideos, setStagedAmzVideos] = useState<AmazonVideo[]>([]);
    const [stagedMappings, setStagedMappings] = useState<Partial<AmazonVideo>[]>([]);
    const [stagedSales, setStagedSales] = useState<AmazonMetric[]>([]);
    const [stagedCC, setStagedCC] = useState<AmazonMetric[]>([]);

    const registryData = useMemo(() => {
        const entities: any[] = [];
        const ytAggregate = new Map<string, any>();
        
        youtubeMetrics.forEach(m => {
            if (!ytAggregate.has(m.videoId)) {
                ytAggregate.set(m.videoId, {
                    id: m.videoId,
                    videoTitle: m.videoTitle,
                    publishDate: m.publishDate,
                    views: 0,
                    revenue: 0,
                    type: 'video'
                });
            }
            const agg = ytAggregate.get(m.videoId);
            agg.views += m.views;
            agg.revenue += m.estimatedRevenue;
        });

        const consumedAmazonAsins = new Set<string>();
        
        ytAggregate.forEach((yt) => {
            const link = contentLinks.find(l => l.youtubeVideoId === yt.id);
            const asins = link ? link.amazonAsins : [];
            
            let amazonRevenue = 0;
            let productNames: string[] = [];
            
            asins.forEach(asin => {
                const sales = amazonMetrics.filter(am => am.asin === asin);
                sales.forEach(s => {
                    amazonRevenue += (s.revenue || 0) + (s.commissionIncome || 0);
                    if (s.productTitle && !productNames.includes(s.productTitle)) productNames.push(s.productTitle);
                    consumedAmazonAsins.add(asin);
                });
            });

            entities.push({
                ...yt,
                mainTitle: productNames.length > 0 ? productNames[0] : yt.videoTitle,
                subTitle: yt.videoTitle,
                amazonRev: amazonRevenue,
                totalRev: yt.revenue + amazonRevenue,
                linkedAsins: asins
            });
        });

        const orphanedAsins = new Map<string, any>();
        amazonMetrics.forEach(m => {
            if (consumedAmazonAsins.has(m.asin)) return;
            if (!orphanedAsins.has(m.asin)) {
                orphanedAsins.set(m.asin, {
                    id: m.asin,
                    videoTitle: m.productTitle,
                    publishDate: m.saleDate,
                    revenue: 0,
                    amazonRev: 0,
                    type: 'product',
                    mainTitle: m.productTitle,
                    subTitle: m.productTitle,
                    linkedAsins: [m.asin]
                });
            }
            const agg = orphanedAsins.get(m.asin);
            agg.amazonRev += (m.revenue || 0) + (m.commissionIncome || 0);
            agg.totalRev = agg.amazonRev;
        });

        entities.push(...Array.from(orphanedAsins.values()));
        return entities.sort((a, b) => b.totalRev - a.totalRev);
    }, [youtubeMetrics, amazonMetrics, contentLinks]);

    const filteredRegistry = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return registryData.filter(e => 
            e.mainTitle.toLowerCase().includes(q) || 
            e.subTitle.toLowerCase().includes(q) || 
            e.id.toLowerCase().includes(q)
        );
    }, [registryData, searchTerm]);

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>, step: number) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        try {
            switch(step) {
                case 1:
                    const yt = await parseYouTubeDetailedReport(file, () => {});
                    setStagedYt(yt);
                    break;
                case 2:
                    const amzV = await parseAmazonStorefrontVideos(file, () => {});
                    setStagedAmzVideos(amzV);
                    break;
                case 3:
                    const maps = await parseVideoAsinMapping(file, () => {});
                    setStagedMappings(maps);
                    break;
                case 4:
                    const earnings = await parseAmazonEarningsReport(file, () => {});
                    setStagedSales(earnings);
                    break;
                case 5:
                    const cc = await parseCreatorConnectionsReport(file, () => {});
                    setStagedCC(cc);
                    break;
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const finalizeStep = (step: number) => {
        switch(step) {
            case 1: onUpdateYoutubeMetrics(stagedYt); setStagedYt([]); break;
            case 4: onUpdateAmazonMetrics(stagedSales); setStagedSales([]); break;
            case 5: onUpdateAmazonMetrics(stagedCC); setStagedCC([]); break;
        }
        setImportStep(step + 1);
    };

    return (
        <div className="space-y-6 h-full flex flex-col animate-fade-in">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <WorkflowIcon className="w-8 h-8 text-indigo-600" /> Video & Product Joiner
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Correlate video consumption metrics with SKU-level commerce performance.</p>
                </div>
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('data')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'data' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Data</button>
                    <button onClick={() => setActiveTab('insights')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'insights' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Insights</button>
                    <button onClick={() => setActiveTab('import')} className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'import' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Importer</button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
                {activeTab === 'dashboard' && (
                    <>
                        <div className="p-6 border-b bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="relative w-full sm:w-96">
                                <input 
                                    type="text" 
                                    placeholder="Search by Video ID or Product Name..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                                />
                                <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Registry Volume: {filteredRegistry.length}</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Attribution Entity</th>
                                        <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Publish Date</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">AdSense</th>
                                        <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">Amazon (Joined)</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-800 uppercase tracking-widest border-b bg-indigo-50/50">Combined Yield</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {filteredRegistry.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 max-w-lg">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ${item.type === 'video' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                                                        {item.type === 'video' ? <VideoIcon className="w-4 h-4" /> : <BoxIcon className="w-4 h-4" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-800 truncate">{item.mainTitle}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-[10px] font-bold text-slate-400 truncate opacity-60 italic">{item.subTitle}</p>
                                                            <span className="text-[8px] font-mono bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">{item.id}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-xs font-mono text-slate-500">{item.publishDate || '--'}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-red-600 font-mono">{formatCurrency(item.revenue)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-green-600 font-mono">{formatCurrency(item.amazonRev)}</td>
                                            <td className="px-6 py-4 text-right bg-indigo-50/20 font-black text-indigo-900 font-mono text-sm">{formatCurrency(item.totalRev)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'import' && (
                    <div className="flex-1 flex flex-col p-10 bg-slate-50/30 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto w-full space-y-12">
                            <div className="text-center space-y-4">
                                <h2 className="text-3xl font-black text-slate-800">Neural Attribution Forge</h2>
                                <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">Follow the 5-step sequence to construct a joined map of your video and commerce data.</p>
                                
                                <div className="flex justify-center gap-8 pt-6">
                                    <StepIndicator step={1} active={importStep} label="Video Data" />
                                    <StepIndicator step={2} active={importStep} label="YT-AMZ Match" />
                                    <StepIndicator step={3} active={importStep} label="Video-ASIN" />
                                    <StepIndicator step={4} active={importStep} label="Commerce" />
                                    <StepIndicator step={5} active={importStep} label="Campaigns" />
                                </div>
                            </div>

                            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-10 relative overflow-hidden">
                                {importStep === 1 && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-red-50 text-red-600 rounded-2xl"><YoutubeIcon className="w-8 h-8" /></div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800">Step 1: Primary Video Ingestion</h3>
                                                <p className="text-sm text-slate-500">Upload YouTube Studio Video Reports.</p>
                                            </div>
                                        </div>
                                        <div 
                                            onClick={() => document.getElementById('upload-1')?.click()}
                                            className="border-4 border-dashed border-slate-100 rounded-[2rem] p-16 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
                                        >
                                            <CloudArrowUpIcon className="w-12 h-12 text-slate-200 mx-auto mb-4 group-hover:text-indigo-400 group-hover:scale-110 transition-all" />
                                            <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Select Detailed YouTube report</p>
                                            <input id="upload-1" type="file" className="hidden" accept=".csv" onChange={e => handleImportFile(e, 1)} />
                                        </div>
                                        {stagedYt.length > 0 && (
                                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                                                <p className="text-emerald-800 font-black uppercase text-xs">Staged: {stagedYt.length} Videos</p>
                                                <button onClick={() => finalizeStep(1)} className="px-8 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Verify and Sync</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {importStep === 2 && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><RepeatIcon className="w-8 h-8" /></div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800">Step 2: Cross-Platform Bridge</h3>
                                                <p className="text-sm text-slate-500">Match YouTube IDs to Amazon Storefront Videos.</p>
                                            </div>
                                        </div>
                                        <div onClick={() => document.getElementById('upload-2')?.click()} className="border-4 border-dashed border-slate-100 rounded-[2rem] p-16 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
                                            <CloudArrowUpIcon className="w-12 h-12 text-slate-200 mx-auto mb-4 group-hover:text-indigo-400" />
                                            <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Select Storefront Video Report</p>
                                            <input id="upload-2" type="file" className="hidden" accept=".csv" onChange={e => handleImportFile(e, 2)} />
                                        </div>
                                        {stagedAmzVideos.length > 0 && (
                                            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center">
                                                <p className="text-indigo-800 font-black uppercase text-xs">Staged: {stagedAmzVideos.length} Amazon Videos</p>
                                                <button onClick={() => finalizeStep(2)} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl uppercase text-[10px]">Continue</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {importStep === 3 && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><LinkIcon className="w-8 h-8" /></div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800">Step 3: SKU Linkage</h3>
                                                <p className="text-sm text-slate-500">Associate ASINs with linked Videos.</p>
                                            </div>
                                        </div>
                                        <div onClick={() => document.getElementById('upload-3')?.click()} className="border-4 border-dashed border-slate-100 rounded-[2rem] p-16 text-center cursor-pointer hover:border-indigo-400">
                                            <CloudArrowUpIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Select Product Mapping CSV</p>
                                            <input id="upload-3" type="file" className="hidden" accept=".csv" onChange={e => handleImportFile(e, 3)} />
                                        </div>
                                        {stagedMappings.length > 0 && (
                                            <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 flex justify-between items-center">
                                                <p className="text-orange-800 font-black uppercase text-xs">Staged: {stagedMappings.length} Mappings</p>
                                                <button onClick={() => finalizeStep(3)} className="px-8 py-3 bg-orange-600 text-white font-black rounded-xl uppercase text-[10px]">Continue</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {importStep === 4 && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><CurrencyDollarIcon className="w-8 h-8" /></div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800">Step 4: Commerce Inflow</h3>
                                                <p className="text-sm text-slate-500">Import Amazon Associate Earnings Reports.</p>
                                            </div>
                                        </div>
                                        <div onClick={() => document.getElementById('upload-4')?.click()} className="border-4 border-dashed border-slate-100 rounded-[2rem] p-16 text-center cursor-pointer hover:border-indigo-400">
                                            <CloudArrowUpIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Select Earnings Report</p>
                                            <input id="upload-4" type="file" className="hidden" accept=".csv" onChange={e => handleImportFile(e, 4)} />
                                        </div>
                                        {stagedSales.length > 0 && (
                                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                                                <p className="text-emerald-800 font-black uppercase text-xs">Staged: {stagedSales.length} Sales Records</p>
                                                <button onClick={() => finalizeStep(4)} className="px-8 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px]">Continue</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {importStep === 5 && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-900 text-white rounded-2xl"><BoxIcon className="w-8 h-8" /></div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800">Step 5: Attribution Pulse</h3>
                                                <p className="text-sm text-slate-500">Import Creator Connections data for final attribution.</p>
                                            </div>
                                        </div>
                                        <div onClick={() => document.getElementById('upload-5')?.click()} className="border-4 border-dashed border-slate-100 rounded-[2rem] p-16 text-center cursor-pointer hover:border-indigo-400">
                                            <CloudArrowUpIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Select CC Report</p>
                                            <input id="upload-5" type="file" className="hidden" accept=".csv" onChange={e => handleImportFile(e, 5)} />
                                        </div>
                                        {stagedCC.length > 0 && (
                                            <div className="p-6 bg-indigo-900 rounded-2xl border border-indigo-950 flex justify-between items-center">
                                                <p className="text-white font-black uppercase text-xs">Staged: {stagedCC.length} Attribution Records</p>
                                                <button onClick={() => { finalizeStep(5); setActiveTab('dashboard'); }} className="px-10 py-4 bg-white text-indigo-900 font-black rounded-xl shadow-2xl uppercase text-xs tracking-widest active:scale-95">Complete Synthesis</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200 flex items-start gap-4">
                                    <InfoIcon className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1">Operational Protocol</p>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Maintain the sequence (Steps 1 through 5) for maximum accuracy. If a video ID is missing from a product record, the system will use the ASIN as a backup identifier to ensure 100% data preservation.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {(activeTab === 'data' || activeTab === 'insights') && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                            <SparklesIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase">Registry Initializing</h3>
                            <p className="text-sm text-slate-400 max-w-sm mx-auto font-medium mt-2">Join Analytics for ASIN-merging and deep insights are being synchronized from your recent ingestion activity.</p>
                        </div>
                        <button onClick={() => setActiveTab('dashboard')} className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline">View Active Registry</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoProductJoiner;