
import React, { useState, useMemo, useRef } from 'react';
import type { AmazonMetric, AmazonReportType } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, CloseIcon, DeleteIcon, SearchCircleIcon, CalendarIcon, SortIcon } from '../../components/Icons';
import { parseAmazonReport } from '../../services/csvParserService';
import AmazonTable from '../../components/AmazonTable';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    onUpdateMetric: (metric: AmazonMetric) => void;
}

// Helper for currency
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, onUpdateMetric }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    
    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedReportType, setSelectedReportType] = useState<AmazonReportType | 'all'>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Title Sync Logic (same as before)
    const enrichedMetrics = useMemo(() => {
        const titleMap = new Map<string, string>();
        metrics.forEach(m => {
            if (m.asin && m.title && !m.title.startsWith('Unknown Product') && m.reportType !== 'creator_connections') {
                const existing = titleMap.get(m.asin);
                if (!existing || m.title.length > existing.length) {
                    titleMap.set(m.asin, m.title);
                }
            }
        });
        return metrics.map(m => {
            if (titleMap.has(m.asin) && (m.title.startsWith('Unknown Product') || m.reportType === 'creator_connections')) {
                return { ...m, title: titleMap.get(m.asin)! };
            }
            return m;
        });
    }, [metrics]);

    const filteredMetrics = useMemo(() => {
        return enrichedMetrics.filter(m => {
            if (searchTerm && !m.title.toLowerCase().includes(searchTerm.toLowerCase()) && !m.asin.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (startDate && new Date(m.date) < new Date(startDate)) return false;
            if (endDate && new Date(m.date) > new Date(endDate)) return false;
            if (selectedReportType !== 'all' && m.reportType !== selectedReportType) return false;
            return true;
        });
    }, [enrichedMetrics, searchTerm, startDate, endDate, selectedReportType]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const newMetrics = await parseAmazonReport(file, (msg) => console.log(msg));
            
            // Deduplication REMOVED per user request
            
            if (newMetrics.length > 0) {
                onAddMetrics(newMetrics);
                setActiveTab('dashboard'); // Switch to dashboard to see results
                
                alert(`Successfully imported ${newMetrics.length} records.`);
            } else {
                alert("No valid records found in file. Please check the CSV format.");
            }
        } catch (error) {
            console.error(error);
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleClearAll = () => {
        if (metrics.length === 0) return;
        if (window.confirm(`Are you sure you want to delete ALL ${metrics.length} Amazon records? This cannot be undone.`)) {
            onDeleteMetrics(metrics.map(m => m.id));
            setSelectedIds(new Set());
            alert("All Amazon data cleared.");
        }
    };

    // Bulk Actions
    const handleToggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === filteredMetrics.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredMetrics.map(m => m.id)));
    };

    const handleBulkSelection = (ids: string[], selected: boolean) => {
        const newSet = new Set(selectedIds);
        ids.forEach(id => selected ? newSet.add(id) : newSet.delete(id));
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedIds.size} records?`)) {
            onDeleteMetrics(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    // --- aggregations ---
    const summary = useMemo(() => {
        const result = {
            totalRevenue: 0,
            totalClicks: 0,
            totalOrdered: 0,
            avgConversion: 0,
            byType: { onsite: 0, offsite: 0, creator_connections: 0, unknown: 0 }
        };

        // Summary uses ALL metrics, or FILTERED metrics? Usually specific to view context.
        // Let's use filteredMetrics for dashboard to allow date range analysis.
        const source = activeTab === 'dashboard' ? filteredMetrics : enrichedMetrics;

        source.forEach(m => {
            result.totalRevenue += m.revenue;
            result.totalClicks += m.clicks;
            result.totalOrdered += m.orderedItems;
            
            if (m.reportType in result.byType) {
                result.byType[m.reportType as AmazonReportType] += m.revenue;
            } else {
                result.byType.unknown += m.revenue;
            }
        });

        result.avgConversion = result.totalClicks > 0 ? (result.totalOrdered / result.totalClicks) * 100 : 0;
        return result;
    }, [filteredMetrics, enrichedMetrics, activeTab]);

    const topProducts = useMemo(() => {
        const productMap = new Map<string, { title: string, revenue: number, clicks: number, ordered: number }>();
        const source = activeTab === 'dashboard' ? filteredMetrics : enrichedMetrics;
        
        source.forEach(m => {
            if (!productMap.has(m.asin)) {
                productMap.set(m.asin, { title: m.title, revenue: 0, clicks: 0, ordered: 0 });
            }
            const prod = productMap.get(m.asin)!;
            prod.revenue += m.revenue;
            prod.clicks += m.clicks;
            prod.ordered += m.orderedItems;
        });

        return Array.from(productMap.entries())
            .map(([asin, data]) => ({ asin, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredMetrics, enrichedMetrics, activeTab]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BoxIcon className="w-8 h-8 text-orange-500" />
                        Amazon Associates
                    </h1>
                    <p className="text-slate-500">Track clicks, commissions, and top performing ASINs.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><BarChartIcon className="w-4 h-4"/> Dashboard</button>
                    <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><TableIcon className="w-4 h-4"/> Data</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}><CloudArrowUpIcon className="w-4 h-4"/> Upload</button>
                </div>
            </div>

            {/* Filter Bar (Shared for Dashboard and Data) */}
            {activeTab !== 'upload' && (
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 flex-shrink-0 items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-grow items-center">
                        <div className="relative flex-grow w-full sm:w-auto">
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search Products or ASINs..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative">
                                <select 
                                    value={selectedReportType} 
                                    onChange={(e) => setSelectedReportType(e.target.value as any)}
                                    className="pl-3 pr-8 py-2 border rounded-lg appearance-none bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                >
                                    <option value="all">All Types</option>
                                    <option value="onsite">Onsite</option>
                                    <option value="offsite">Offsite</option>
                                    <option value="creator_connections">Creator Connections</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 border-none text-sm focus:ring-0" />
                                <span className="text-slate-400">-</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1 border-none text-sm focus:ring-0" />
                            </div>

                            {(searchTerm || startDate || endDate || selectedReportType !== 'all') && (
                                <button 
                                    onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setSelectedReportType('all'); }} 
                                    className="text-xs text-red-500 hover:underline px-2 whitespace-nowrap"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {metrics.length > 0 && activeTab === 'data' && (
                        <button 
                            onClick={handleClearAll}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors whitespace-nowrap"
                        >
                            Clear All Data
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4">
                
                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.totalRevenue)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Clicks</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalClicks)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Items Ordered</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(summary.totalOrdered)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-xs font-bold text-slate-400 uppercase">Conversion Rate</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{summary.avgConversion.toFixed(2)}%</p>
                            </div>
                        </div>

                        {/* Breakdown by Type */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
                                <p className="text-xs font-bold text-slate-400 uppercase">Onsite Earnings</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(summary.byType.onsite)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
                                <p className="text-xs font-bold text-slate-400 uppercase">Offsite Earnings</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(summary.byType.offsite)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-purple-500">
                                <p className="text-xs font-bold text-slate-400 uppercase">Creator Connections</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(summary.byType.creator_connections)}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-700">Top Performing Products</h3>
                            </div>
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Clicks</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ordered</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {topProducts.map((prod) => (
                                        <tr key={prod.asin} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-slate-800 line-clamp-1" title={prod.title}>{prod.title}</div>
                                                <div className="text-xs text-slate-400 font-mono">{prod.asin}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(prod.clicks)}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(prod.ordered)}</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-green-600">{formatCurrency(prod.revenue)}</td>
                                        </tr>
                                    ))}
                                    {topProducts.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No data available for current selection.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* DATA TAB */}
                {activeTab === 'data' && (
                    <div className="flex flex-col h-full space-y-4">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden relative">
                            <AmazonTable 
                                metrics={filteredMetrics} 
                                onUpdateMetric={onUpdateMetric}
                                onDeleteMetric={(id) => onDeleteMetrics([id])}
                                selectedIds={selectedIds}
                                onToggleSelection={handleToggleSelection}
                                onToggleSelectAll={handleToggleSelectAll}
                                onBulkSelection={handleBulkSelection}
                            />
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-slide-up print:hidden">
                                <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                                    <span className="font-medium text-sm">{selectedIds.size} selected</span>
                                    <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800">
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 rounded-full transition-colors shadow-sm">
                                    <DeleteIcon className="w-4 h-4"/> Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* UPLOAD TAB */}
                {activeTab === 'upload' && (
                    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 relative">
                        <div className="bg-orange-50 p-4 rounded-full mb-4">
                            <CloudArrowUpIcon className="w-8 h-8 text-orange-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Upload Amazon Report</h3>
                        <p className="text-slate-500 text-center max-w-md mb-6">
                            Supports <strong>Standard Associates</strong> (Onsite/Offsite) and <strong>Creator Connections</strong> CSV exports.
                        </p>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            accept=".csv,.tsv" 
                            onChange={handleFileUpload} 
                            className="hidden" 
                        />
                        <div className="flex gap-4">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-slate-300 transition-colors"
                            >
                                {isUploading ? 'Parsing...' : 'Select CSV File'}
                            </button>
                            {metrics.length > 0 && (
                                <button 
                                    onClick={handleClearAll}
                                    className="px-6 py-3 text-red-600 bg-red-50 font-medium rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
                                >
                                    Clear All Data
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmazonIntegration;
