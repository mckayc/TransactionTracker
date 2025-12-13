

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { YouTubeMetric } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, YoutubeIcon, DeleteIcon, CheckCircleIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, SearchCircleIcon, ExternalLinkIcon } from '../../components/Icons';
import { parseYouTubeReport } from '../../services/csvParserService';

interface YouTubeIntegrationProps {
    metrics: YouTubeMetric[];
    onAddMetrics: (metrics: YouTubeMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter & Sort
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [sortKey, setSortKey] = useState<keyof YouTubeMetric>('publishDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [productSortKey, setProductSortKey] = useState<'estimatedRevenue' | 'views' | 'subscribersGained' | 'watchTimeHours'>('estimatedRevenue');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    const displayMetrics = useMemo(() => {
        let result = metrics;

        if (debouncedSearchTerm) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            result = result.filter(m => m.videoTitle.toLowerCase().includes(lowerSearch) || m.videoId.toLowerCase().includes(lowerSearch));
        }

        result.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [metrics, debouncedSearchTerm, sortKey, sortDirection]);

    const totalPages = Math.ceil(displayMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedMetrics = displayMetrics.slice(startIndex, startIndex + rowsPerPage);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const newMetrics = await parseYouTubeReport(file, (msg) => console.log(msg));
            if (newMetrics.length > 0) {
                setPreviewMetrics(newMetrics);
            } else {
                alert("No valid records found in file.");
            }
        } catch (error) {
            console.error(error);
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        if (previewMetrics.length > 0) {
            onAddMetrics(previewMetrics);
            setPreviewMetrics([]);
            alert(`Successfully imported ${previewMetrics.length} records.`);
            setActiveTab('dashboard');
        }
    };

    const summary = useMemo(() => {
        const result = {
            totalRevenue: 0,
            totalViews: 0,
            totalSubs: 0,
            totalWatchTime: 0
        };
        displayMetrics.forEach(m => {
            result.totalRevenue += m.estimatedRevenue;
            result.totalViews += m.views;
            result.totalSubs += m.subscribersGained;
            result.totalWatchTime += m.watchTimeHours;
        });
        return result;
    }, [displayMetrics]);

    const topVideos = useMemo(() => {
        return [...displayMetrics]
            .sort((a, b) => b[productSortKey] - a[productSortKey])
            .slice(0, 10);
    }, [displayMetrics, productSortKey]);

    const handleHeaderClick = (key: keyof YouTubeMetric) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc'); 
        }
    };

    const getSortIcon = (key: keyof YouTubeMetric) => {
        if (sortKey !== key) return <SortIcon className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortDirection === 'asc' ? <SortIcon className="w-4 h-4 text-red-600 transform rotate-180" /> : <SortIcon className="w-4 h-4 text-red-600" />;
    };

    const handleToggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Permanently delete ${selectedIds.size} records?`)) {
            onDeleteMetrics(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <YoutubeIcon className="w-8 h-8 text-red-600" />
                        YouTube Analytics
                    </h1>
                    <p className="text-slate-500">Track video performance, revenue, and audience growth.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><BarChartIcon className="w-4 h-4"/> Dashboard</button>
                    <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon className="w-4 h-4"/> Data</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}><CloudArrowUpIcon className="w-4 h-4"/> Upload</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4 relative">
                
                {activeTab !== 'upload' && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4 flex-shrink-0 mb-6">
                        <div className="relative flex-grow w-full md:w-auto">
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search Video Title..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                        <button onClick={() => setSearchTerm('')} className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap px-2">Clear</button>
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalRevenue)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Views</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalViews)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Subscribers</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalSubs)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Watch Time (Hrs)</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalWatchTime)}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h3 className="font-bold text-slate-700">Top Performing Videos</h3>
                                <div className="flex gap-2">
                                    {['estimatedRevenue', 'views', 'subscribersGained', 'watchTimeHours'].map(key => (
                                        <button 
                                            key={key}
                                            onClick={() => setProductSortKey(key as any)}
                                            className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors ${productSortKey === key ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            {key.replace('estimatedRevenue', 'Revenue').replace('subscribersGained', 'Subs').replace('watchTimeHours', 'Watch Time')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Video</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Views</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Subs</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {topVideos.map((video) => (
                                            <tr key={video.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-medium text-slate-800 line-clamp-1" title={video.videoTitle}>{video.videoTitle}</div>
                                                    <span className="text-xs text-slate-400">{video.publishDate}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(video.views)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(video.subscribersGained)}</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-green-600">{formatCurrency(video.estimatedRevenue)}</td>
                                            </tr>
                                        ))}
                                        {topVideos.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">No data available.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden relative">
                        <div className="overflow-auto flex-grow">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 w-10 bg-slate-50">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.size === displayMetrics.length && displayMetrics.length > 0}
                                                onChange={() => {
                                                    if (selectedIds.size === displayMetrics.length) setSelectedIds(new Set());
                                                    else setSelectedIds(new Set(displayMetrics.map(m => m.id)));
                                                }}
                                                className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('publishDate')}>
                                            <div className="flex items-center gap-1">Published {getSortIcon('publishDate')}</div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('videoTitle')}>
                                            <div className="flex items-center gap-1">Video {getSortIcon('videoTitle')}</div>
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('views')}>
                                            <div className="flex items-center justify-end gap-1">Views {getSortIcon('views')}</div>
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleHeaderClick('estimatedRevenue')}>
                                            <div className="flex items-center justify-end gap-1">Revenue {getSortIcon('estimatedRevenue')}</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {paginatedMetrics.map((m) => (
                                        <tr key={m.id} className={selectedIds.has(m.id) ? "bg-red-50" : "hover:bg-slate-50 transition-colors"}>
                                            <td className="px-4 py-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.has(m.id)} 
                                                    onChange={() => handleToggleSelection(m.id)}
                                                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.publishDate}</td>
                                            <td className="px-4 py-2 text-sm text-slate-800">
                                                <div className="line-clamp-1 max-w-md" title={m.videoTitle}>{m.videoTitle}</div>
                                            </td>
                                            <td className="px-4 py-2 text-right text-sm text-slate-600">{formatNumber(m.views)}</td>
                                            <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.estimatedRevenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="border-t border-slate-200 p-3 bg-slate-50 flex justify-between items-center gap-3 sticky bottom-0 z-20">
                                <div className="text-sm text-slate-600">{startIndex + 1}-{Math.min(startIndex + rowsPerPage, displayMetrics.length)} of {displayMetrics.length}</div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronLeftIcon className="w-5 h-5 text-slate-600" /></button>
                                    <span className="text-sm font-medium text-slate-700">Page {currentPage}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronRightIcon className="w-5 h-5 text-slate-600" /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="h-full">
                        {previewMetrics.length > 0 ? (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start justify-between">
                                    <div className="flex gap-3">
                                        <div className="p-2 bg-red-100 rounded-full text-red-600"><CheckCircleIcon className="w-6 h-6" /></div>
                                        <div>
                                            <h3 className="font-bold text-red-900 text-lg">Ready to Import</h3>
                                            <p className="text-red-700 text-sm">Found <strong>{previewMetrics.length}</strong> records.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                    <div className="flex-1 overflow-auto">
                                        <table className="min-w-full divide-y divide-slate-200">
                                            <thead className="bg-white sticky top-0 shadow-sm">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Publish Date</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {previewMetrics.slice(0, 50).map(m => (
                                                    <tr key={m.id}>
                                                        <td className="px-4 py-2 text-xs text-slate-600">{m.publishDate}</td>
                                                        <td className="px-4 py-2 text-xs text-slate-800 truncate max-w-xs">{m.videoTitle}</td>
                                                        <td className="px-4 py-2 text-xs text-right font-medium text-green-600">{formatCurrency(m.estimatedRevenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button onClick={() => setPreviewMetrics([])} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                                    <button onClick={confirmImport} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-sm">Confirm Import</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border-2 border-dashed border-slate-300 p-12">
                                <div className="bg-red-50 p-4 rounded-full mb-4"><CloudArrowUpIcon className="w-8 h-8 text-red-500" /></div>
                                <h3 className="text-xl font-bold text-slate-700 mb-2">Upload YouTube Report</h3>
                                <p className="text-slate-500 text-center max-w-md mb-6">Supports CSV/TSV exports from YouTube Analytics.</p>
                                <input type="file" ref={fileInputRef} accept=".csv,.tsv" onChange={handleFileUpload} className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-300 transition-colors">
                                    {isUploading ? 'Parsing...' : 'Select CSV File'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedIds.size > 0 && activeTab === 'data' && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-slide-up">
                    <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                        <span className="font-medium text-sm">{selectedIds.size} selected</span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"><CloseIcon className="w-4 h-4" /></button>
                    </div>
                    <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 rounded-full transition-colors shadow-sm"><DeleteIcon className="w-4 h-4"/> Delete Selected</button>
                </div>
            )}
        </div>
    );
};

export default YouTubeIntegration;