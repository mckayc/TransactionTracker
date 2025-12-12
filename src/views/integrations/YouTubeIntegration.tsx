
import React, { useState, useMemo, useRef } from 'react';
import type { YouTubeMetric } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, DeleteIcon, SearchCircleIcon, ClipboardIcon, PlayIcon, CloseIcon, SortIcon, ExternalLinkIcon } from '../../components/Icons';
import { readCSVRaw, readStringAsCSV, autoMapYouTubeColumns, processYouTubeData } from '../../services/csvParserService';

interface YouTubeIntegrationProps {
    metrics: YouTubeMetric[];
    onAddMetrics: (metrics: YouTubeMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
}

// Helpers
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);
const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload' | 'paste'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [pastedText, setPastedText] = useState('');
    
    // Filtering
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter Logic
    const filteredMetrics = useMemo(() => {
        return metrics.filter(m => {
            if (searchTerm && !m.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });
    }, [metrics, searchTerm]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const data = await readCSVRaw(file);
            if (data.rows.length === 0) {
                alert("File empty.");
                return;
            }
            const mapping = autoMapYouTubeColumns(data.headers);
            if (mapping.content === -1) {
                alert("Could not find Video ID column (Content/Video ID).");
                return;
            }
            const newMetrics = processYouTubeData(data, mapping);
            
            // Deduplicate: If video ID exists, update it.
            // Actually, simplest is to let parent handle or just append for now and let user clear.
            // But let's do a smart merge here to avoid duplicates in the UI list if they re-upload.
            // We'll create a map of existing metrics by ID
            const existingMap = new Map(metrics.map(m => [m.videoId, m]));
            const finalMetrics: YouTubeMetric[] = [];
            
            // For new metrics, if ID exists, we REPLACE the old one (assuming new report has updated lifetime stats)
            // But we need to signal to parent to delete old ones or update. 
            // The prop is `onAddMetrics` which usually appends.
            // To properly update, we'll pass ALL unique to add, but we need to remove old ones first?
            // Simplified approach: Just add them. The `App.tsx` logic should handle key conflicts or we just handle it here by deleting old IDs first.
            
            // Let's identify IDs to remove first
            const newIds = new Set(newMetrics.map(m => m.videoId));
            const idsToRemove = metrics.filter(m => newIds.has(m.videoId)).map(m => m.id);
            if (idsToRemove.length > 0) {
                onDeleteMetrics(idsToRemove);
            }
            
            onAddMetrics(newMetrics);
            alert(`Imported ${newMetrics.length} videos.`);
            setActiveTab('dashboard');

        } catch (error) {
            console.error(error);
            alert("Import failed.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePasteProcess = () => {
        if (!pastedText.trim()) return;
        try {
            const data = readStringAsCSV(pastedText);
            const mapping = autoMapYouTubeColumns(data.headers);
            if (mapping.content === -1) {
                alert("Could not find 'Content' or 'Video title' headers.");
                return;
            }
            const newMetrics = processYouTubeData(data, mapping);
            
            const newIds = new Set(newMetrics.map(m => m.videoId));
            const idsToRemove = metrics.filter(m => newIds.has(m.videoId)).map(m => m.id);
            if (idsToRemove.length > 0) onDeleteMetrics(idsToRemove);

            onAddMetrics(newMetrics);
            alert(`Imported ${newMetrics.length} videos.`);
            setActiveTab('dashboard');
            setPastedText('');
        } catch (e) {
            alert("Failed to parse.");
        }
    };

    const handleClearAll = () => {
        if (confirm("Delete all YouTube data?")) {
            onDeleteMetrics(metrics.map(m => m.id));
        }
    };

    // --- Aggregations ---
    const summary = useMemo(() => {
        const res = { revenue: 0, views: 0, subs: 0, watchHours: 0, rpm: 0 };
        filteredMetrics.forEach(m => {
            res.revenue += m.revenue;
            res.views += m.views;
            res.subs += m.subscribers;
            res.watchHours += m.watchTimeHours;
        });
        if (res.views > 0) {
            res.rpm = (res.revenue / res.views) * 1000;
        }
        return res;
    }, [filteredMetrics]);

    const topVideos = useMemo(() => {
        return [...filteredMetrics].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [filteredMetrics]);

    // --- Table Sorting ---
    const [sortKey, setSortKey] = useState<keyof YouTubeMetric>('revenue');
    const [sortDesc, setSortDesc] = useState(true);

    const sortedTableData = useMemo(() => {
        return [...filteredMetrics].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortDesc ? valB - valA : valA - valB;
            }
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            return sortDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
        });
    }, [filteredMetrics, sortKey, sortDesc]);

    const handleSort = (key: keyof YouTubeMetric) => {
        if (sortKey === key) setSortDesc(!sortDesc);
        else {
            setSortKey(key);
            setSortDesc(true);
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-red-600 bg-red-100 p-1.5 rounded-lg"><PlayIcon className="w-6 h-6" /></span>
                        YouTube Analytics
                    </h1>
                    <p className="text-slate-500">Track video performance, revenue, and engagement.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><BarChartIcon className="w-4 h-4"/> Dashboard</button>
                    <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon className="w-4 h-4"/> Data</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><CloudArrowUpIcon className="w-4 h-4"/> Upload</button>
                    <button onClick={() => setActiveTab('paste')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'paste' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><ClipboardIcon className="w-4 h-4"/> Paste</button>
                </div>
            </div>

            {activeTab !== 'upload' && activeTab !== 'paste' && (
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div className="relative flex-grow max-w-md">
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search Videos..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                    </div>
                    {metrics.length > 0 && (
                        <button onClick={handleClearAll} className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-red-100">
                            Clear Data
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4">
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-red-500">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.revenue)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Views</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.views)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">RPM (Rev/1k Views)</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.rpm)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Subscribers Gained</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">+{formatNumber(summary.subs)}</p>
                            </div>
                        </div>

                        {/* Top Videos */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-700">Top Earning Videos</h3>
                            </div>
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Video</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Views</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">CTR</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {topVideos.map((video) => (
                                        <tr key={video.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-slate-800 line-clamp-1" title={video.title}>{video.title}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{video.publishDate} • {formatDuration(video.duration)}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(video.views)}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-600">{video.ctr}%</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-green-600">{formatCurrency(video.revenue)}</td>
                                        </tr>
                                    ))}
                                    {topVideos.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No data available.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                        <div className="overflow-auto flex-1">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        {[
                                            { key: 'title', label: 'Video Title', width: '' },
                                            { key: 'publishDate', label: 'Published', width: 'w-32' },
                                            { key: 'views', label: 'Views', width: 'w-24 text-right' },
                                            { key: 'watchTimeHours', label: 'Watch (Hrs)', width: 'w-28 text-right' },
                                            { key: 'revenue', label: 'Revenue', width: 'w-32 text-right' },
                                            { key: 'id', label: '', width: 'w-16' }
                                        ].map((col) => (
                                            <th 
                                                key={col.key} 
                                                className={`px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 ${col.width}`}
                                                onClick={() => col.key !== 'id' && handleSort(col.key as keyof YouTubeMetric)}
                                            >
                                                <div className={`flex items-center gap-1 ${col.width.includes('text-right') ? 'justify-end' : ''}`}>
                                                    {col.label}
                                                    {sortKey === col.key && <SortIcon className="w-3 h-3 text-red-500" />}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {sortedTableData.map((m) => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-slate-800 line-clamp-1" title={m.title}>{m.title}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <a href={`https://youtu.be/${m.videoId}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                                                        {m.videoId} <ExternalLinkIcon className="w-3 h-3" />
                                                    </a>
                                                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded">{formatDuration(m.duration)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{m.publishDate}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(m.views)}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-600 font-mono">{formatNumber(m.watchTimeHours)}</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-green-600 font-mono">{formatCurrency(m.revenue)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => onDeleteMetrics([m.id])} className="text-slate-400 hover:text-red-500 p-1"><DeleteIcon className="w-4 h-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border-2 border-dashed border-slate-300 p-12">
                        <div className="bg-red-50 p-4 rounded-full mb-4">
                            <CloudArrowUpIcon className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Upload YouTube Report</h3>
                        <p className="text-slate-500 text-center max-w-md mb-6">
                            Export a <strong>Content</strong> report from YouTube Studio Analytics (CSV format).
                        </p>
                        <input type="file" ref={fileInputRef} accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-300 transition-colors"
                        >
                            {isUploading ? 'Parsing...' : 'Select File'}
                        </button>
                    </div>
                )}

                {activeTab === 'paste' && (
                    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-700">Paste Data</h3>
                            <p className="text-sm text-slate-500">Copy table data from YouTube Studio and paste it here.</p>
                        </div>
                        <textarea
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Content, Video Title, Publish Date..."
                            className="flex-1 p-4 resize-none focus:outline-none focus:bg-slate-50 transition-colors font-mono text-xs"
                        />
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setPastedText('')} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Clear</button>
                            <button onClick={handlePasteProcess} disabled={!pastedText.trim()} className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-slate-300">Process Data</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YouTubeIntegration;
