
import React, { useState, useMemo } from 'react';
import type { JoinedMetric, YouTubeMetric, AmazonMetric, ProductJoinerProject } from '../../types';
import { 
    BoxIcon, YoutubeIcon, CloudArrowUpIcon, CheckCircleIcon, SparklesIcon, 
    TrashIcon, SearchCircleIcon, CloseIcon, InfoIcon, TrendingUpIcon, 
    ListIcon, ArrowRightIcon, DatabaseIcon, LinkIcon, WorkflowIcon, CheckBadgeIcon,
    CalendarIcon, AddIcon, ChevronLeftIcon, DollarSign, BarChartIcon
} from '../../components/Icons';
import { parseYouTubeDetailedReport, parseAmazonEarningsReport, parseCreatorConnectionsReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';
import ConfirmationModal from '../../components/ConfirmationModal';

interface Props {
    projects: ProductJoinerProject[];
    onUpdateProjects: (projects: ProductJoinerProject[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

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

const ProductAsinJoiner: React.FC<Props> = ({ projects, onUpdateProjects }) => {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [view, setView] = useState<'hub' | 'upload' | 'dashboard'>('hub');
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');
    const [selectedAsset, setSelectedAsset] = useState<JoinedMetric | null>(null);
    const [inspectingAsset, setInspectingAsset] = useState<JoinedMetric | null>(null);
    
    // Staging state for creating a new project
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectStart, setNewProjectStart] = useState('');
    const [newProjectEnd, setNewProjectEnd] = useState('');

    // Staging state for uploads within a session
    const [onsiteFile, setOnsiteFile] = useState<AmazonMetric[] | null>(null);
    const [offsiteFile, setOffsiteFile] = useState<AmazonMetric[] | null>(null);
    const [ccFile, setCcFile] = useState<AmazonMetric[] | null>(null);
    const [youtubeFile, setYoutubeFile] = useState<YouTubeMetric[] | null>(null);

    const activeProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

    const handleCreateProject = () => {
        if (!newProjectName.trim()) return;
        const newProject: ProductJoinerProject = {
            id: generateUUID(),
            name: newProjectName.trim(),
            startDate: newProjectStart || undefined,
            endDate: newProjectEnd || undefined,
            metrics: [],
            createdAt: new Date().toISOString()
        };
        onUpdateProjects([...projects, newProject]);
        setSelectedProjectId(newProject.id);
        setNewProjectName('');
        setNewProjectStart('');
        setNewProjectEnd('');
        setIsCreatingProject(false);
        setView('upload');
    };

    const handleDeleteProject = (id: string) => {
        if (confirm("Permanently delete this project and its joined metrics? Individual Amazon/YouTube source metrics elsewhere remain safe.")) {
            onUpdateProjects(projects.filter(p => p.id !== id));
            if (selectedProjectId === id) setSelectedProjectId(null);
        }
    };

    const handleUpload = async (type: 'onsite' | 'offsite' | 'cc' | 'youtube', file: File) => {
        setIsProcessing(true);
        try {
            if (type === 'youtube') {
                const parsed = await parseYouTubeDetailedReport(file, () => {});
                const clean = parsed.filter(m => m.videoId && m.videoId.toLowerCase() !== 'total');
                setYoutubeFile(clean);
            } else if (type === 'cc') {
                const parsed = await parseCreatorConnectionsReport(file, () => {});
                const clean = parsed.filter(m => m.asin && m.asin.toLowerCase() !== 'total');
                setCcFile(clean);
            } else {
                const parsed = await parseAmazonEarningsReport(file, () => {});
                const clean = parsed.filter(m => m.asin && m.asin.toLowerCase() !== 'total');
                if (type === 'onsite') setOnsiteFile(clean);
                else setOffsiteFile(clean);
            }
        } catch (err) {
            alert(`Failed to parse ${type} report. Check format.`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleJoinAndCommit = async () => {
        if (!selectedProjectId) return;
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

        youtubeFile?.forEach(yt => {
            const asset = getAsset('', yt.videoTitle, yt.videoId);
            asset.views += yt.views;
            asset.videoEstimatedRevenue += yt.estimatedRevenue;
            asset.watchTimeHours += yt.watchTimeHours;
            asset.subsGained += yt.subscribersGained;
        });

        onsiteFile?.forEach(amz => {
            const asset = getAsset(amz.asin, amz.productTitle);
            asset.amazonOnsiteRevenue += amz.revenue; // amz.revenue is Ad Fees (commission)
            asset.orderedItems += amz.orderedItems;
            asset.shippedItems += amz.shippedItems;
        });

        offsiteFile?.forEach(amz => {
            const asset = getAsset(amz.asin, amz.productTitle);
            asset.amazonOffsiteRevenue += amz.revenue; // amz.revenue is Ad Fees (commission)
            asset.orderedItems += amz.orderedItems;
            asset.shippedItems += amz.shippedItems;
        });

        ccFile?.forEach(cc => {
            const asset = getAsset(cc.asin, cc.productTitle);
            if (cc.reportType === 'onsite') asset.creatorConnectionsOnsiteRevenue += cc.revenue; // amz.revenue is Commission
            else asset.creatorConnectionsOffsiteRevenue += cc.revenue;
            asset.clicks += cc.clicks;
            asset.orderedItems += cc.orderedItems;
        });

        const finalMetrics = Array.from(assetMap.values()).map(m => ({
            ...m,
            totalRevenue: m.videoEstimatedRevenue + m.amazonOnsiteRevenue + m.amazonOffsiteRevenue + m.creatorConnectionsOnsiteRevenue + m.creatorConnectionsOffsiteRevenue
        }));

        const updatedProjects = projects.map(p => 
            p.id === selectedProjectId ? { ...p, metrics: finalMetrics } : p
        );

        onUpdateProjects(updatedProjects);
        setView('dashboard');
        setIsProcessing(false);
        // Clear staging
        setOnsiteFile(null); setOffsiteFile(null); setCcFile(null); setYoutubeFile(null);
    };

    const displayMetrics = useMemo(() => {
        if (!activeProject) return [];
        let base = [...activeProject.metrics];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            base = base.filter(m => m.mainTitle.toLowerCase().includes(q) || m.asin.toLowerCase().includes(q));
        }
        return base.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [activeProject, searchTerm]);

    const potentialLinks = useMemo(() => {
        if (!linkSearch || !activeProject) return [];
        const q = linkSearch.toLowerCase();
        return activeProject.metrics.filter(m => 
            (m.mainTitle.toLowerCase().includes(q) || m.asin.toLowerCase().includes(q)) && 
            m.id !== selectedAsset?.id
        ).slice(0, 10);
    }, [linkSearch, activeProject, selectedAsset]);

    const handleExecuteLink = (target: JoinedMetric) => {
        if (!selectedAsset || !selectedProjectId) return;
        
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

        const updatedProjects = projects.map(p => {
            if (p.id === selectedProjectId) {
                const nextMetrics = p.metrics
                    .filter(m => m.id !== selectedAsset.id && m.id !== target.id)
                    .concat(merged);
                return { ...p, metrics: nextMetrics };
            }
            return p;
        });
        
        onUpdateProjects(updatedProjects);
        setIsLinking(false);
        setSelectedAsset(null);
    };

    if (view === 'hub') {
        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in py-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Joined Projects Hub</h2>
                        <p className="text-slate-500 font-medium">Manage isolated sessions for Content ROI analysis.</p>
                    </div>
                    <button onClick={() => setIsCreatingProject(true)} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                        <AddIcon className="w-5 h-5" /> New Analysis Session
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(p => {
                        const totalYield = p.metrics.reduce((s, m) => s + m.totalRevenue, 0);
                        const assetsCount = p.metrics.length;
                        return (
                            <div 
                                key={p.id}
                                className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all group border-2 hover:border-indigo-400"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <WorkflowIcon className="w-6 h-6" />
                                        </div>
                                        <button onClick={() => handleDeleteProject(p.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 mb-1">{p.name}</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <CalendarIcon className="w-3 h-3" />
                                        {p.startDate ? `${p.startDate} to ${p.endDate || 'Present'}` : `Registered ${new Date(p.createdAt).toLocaleDateString()}`}
                                    </p>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Project Yield</p>
                                        <p className="text-lg font-black text-emerald-600">{formatCurrency(totalYield)}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{assetsCount} Connected Assets</p>
                                    </div>
                                    <button 
                                        onClick={() => { setSelectedProjectId(p.id); setView(p.metrics.length > 0 ? 'dashboard' : 'upload'); }}
                                        className="px-5 py-2.5 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
                                    >
                                        Enter Workspace
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {projects.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem]">
                            <DatabaseIcon className="w-16 h-16 text-slate-200 mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-center">No projects found. Create a new session to begin synthesis.</p>
                        </div>
                    )}
                </div>

                {isCreatingProject && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">New Analysis Session</h3>
                                <button onClick={() => setIsCreatingProject(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Identifier</label>
                                    <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="e.g. Q1 2024 Yield Audit" className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold shadow-inner focus:border-indigo-500 outline-none" autoFocus />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                        <input type="date" value={newProjectStart} onChange={e => setNewProjectStart(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                        <input type="date" value={newProjectEnd} onChange={e => setNewProjectEnd(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50" />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setIsCreatingProject(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500">Cancel</button>
                                    <button onClick={handleCreateProject} className="flex-2 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 w-full">Create Project</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'upload') {
        return (
            <div className="max-w-4xl mx-auto space-y-10 py-10 animate-fade-in">
                <button onClick={() => setView('hub')} className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-widest hover:translate-x-[-4px] transition-transform">
                    <ChevronLeftIcon className="w-4 h-4" /> Hub Registry
                </button>
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                        <WorkflowIcon className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">{activeProject?.name}</h2>
                    <p className="text-slate-500 max-w-lg mx-auto font-medium">Isolated ingestion pipeline. Ingest the reports relevant only to this specific project scope.</p>
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
                        onClick={handleJoinAndCommit}
                        disabled={isProcessing || (!onsiteFile && !offsiteFile && !ccFile && !youtubeFile)}
                        className="px-16 py-5 bg-indigo-600 text-white font-black text-xl rounded-3xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-3"
                    >
                        {isProcessing ? <div className="w-6 h-6 border-4 border-t-white rounded-full animate-spin" /> : <DatabaseIcon className="w-6 h-6" />}
                        Commit Institutional Synthesis
                    </button>
                    {activeProject && activeProject.metrics.length > 0 && <button onClick={() => setView('dashboard')} className="text-sm font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Abort & View Current Dashboard</button>}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('hub')} className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg hover:bg-indigo-700 transition-colors"><ChevronLeftIcon className="w-6 h-6" /></button>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">{activeProject?.name}</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{displayMetrics.length} Active Content Assets</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="Search Assets..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-0 focus:border-indigo-500 outline-none font-bold"
                        />
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                    <button onClick={() => setView('upload')} className="px-5 py-2 bg-white border-2 border-slate-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Re-Ingest Batch</button>
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
                                    <tr key={m.id} className="hover:bg-indigo-50/20 transition-all group cursor-pointer" onClick={() => setInspectingAsset(m)}>
                                        <td className="px-8 py-3 max-w-[400px]">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{m.mainTitle}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase ${m.videoId ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400'}`}>{m.videoId || 'NO_VID'}</span>
                                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase ${m.asin ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400'}`}>{m.asin || 'NO_ASIN'}</span>
                                                    {m.views > 0 && (
                                                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-600 border-indigo-100 uppercase">
                                                            {formatCurrency(m.totalRevenue / m.views)}/V
                                                        </span>
                                                    )}
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
                                                {m.videoEstimatedRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="YouTube AdSense" />}
                                                {m.amazonOnsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Amazon Onsite" />}
                                                {m.creatorConnectionsOnsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="CC Onsite" />}
                                                {m.amazonOffsiteRevenue > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Amazon Offsite" />}
                                            </div>
                                        </td>
                                        <td className="px-8 py-3 text-center">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setSelectedAsset(m); setIsLinking(true); setLinkSearch(''); }}
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

            {inspectingAsset && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><BarChartIcon className="w-6 h-6" /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Yield Attribution</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Institutional Audit</p>
                                </div>
                            </div>
                            <button onClick={() => setInspectingAsset(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors shrink-0 ml-4"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        
                        <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 relative z-10">Total Asset Earnings</p>
                                <p className="text-4xl font-black relative z-10">{formatCurrency(inspectingAsset.totalRevenue)}</p>
                                <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-5" />
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stream Distribution</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'YouTube AdSense', val: inspectingAsset.videoEstimatedRevenue, color: 'bg-red-500', icon: <YoutubeIcon className="w-4 h-4 text-red-500" /> },
                                        { label: 'Amazon Onsite', val: inspectingAsset.amazonOnsiteRevenue, color: 'bg-blue-500', icon: <BoxIcon className="w-4 h-4 text-blue-500" /> },
                                        { label: 'Amazon Offsite', val: inspectingAsset.amazonOffsiteRevenue, color: 'bg-green-500', icon: <BoxIcon className="w-4 h-4 text-green-500" /> },
                                        { label: 'Creator Connections (On)', val: inspectingAsset.creatorConnectionsOnsiteRevenue, color: 'bg-indigo-500', icon: <SparklesIcon className="w-4 h-4 text-indigo-500" /> },
                                        { label: 'Creator Connections (Off)', val: inspectingAsset.creatorConnectionsOffsiteRevenue, color: 'bg-violet-500', icon: <SparklesIcon className="w-4 h-4 text-violet-500" /> }
                                    ].map(stream => (
                                        <div key={stream.label} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3">
                                                {stream.icon}
                                                <span className="text-xs font-bold text-slate-700">{stream.label}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900 font-mono">{formatCurrency(stream.val)}</p>
                                                {inspectingAsset.totalRevenue > 0 && <p className="text-[9px] font-black text-slate-400 uppercase">{((stream.val / inspectingAsset.totalRevenue) * 100).toFixed(0)}% SHARE</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex gap-4">
                            <button onClick={() => setInspectingAsset(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">Close Audit</button>
                        </div>
                    </div>
                </div>
            )}

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
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 animate-slide-up text-center max-sm w-full">
                        <div className="w-16 h-16 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Processing Logical Clusters</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Unifying multi-platform registry...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductAsinJoiner;
