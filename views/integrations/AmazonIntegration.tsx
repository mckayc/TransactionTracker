
import React, { useState, useMemo, useRef } from 'react';
import type { AmazonMetric } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon } from '../../components/Icons';
import { parseAmazonReport } from '../../services/csvParserService';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
}

// Helper for currency
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const newMetrics = await parseAmazonReport(file, (msg) => console.log(msg));
            if (newMetrics.length > 0) {
                onAddMetrics(newMetrics);
                alert(`Successfully imported ${newMetrics.length} records.`);
                setActiveTab('dashboard');
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

    // --- aggregations ---
    const summary = useMemo(() => {
        const totalRevenue = metrics.reduce((acc, m) => acc + m.revenue, 0);
        const totalClicks = metrics.reduce((acc, m) => acc + m.clicks, 0);
        const totalOrdered = metrics.reduce((acc, m) => acc + m.orderedItems, 0);
        const avgConversion = totalClicks > 0 ? (totalOrdered / totalClicks) * 100 : 0;

        return { totalRevenue, totalClicks, totalOrdered, avgConversion };
    }, [metrics]);

    const topProducts = useMemo(() => {
        const productMap = new Map<string, { title: string, revenue: number, clicks: number, ordered: number }>();
        
        metrics.forEach(m => {
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
    }, [metrics]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BoxIcon className="w-8 h-8 text-orange-500" />
                        Amazon Associates
                    </h1>
                    <p className="text-slate-500">Track clicks, commissions, and top performing ASINs.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button 
                        onClick={() => setActiveTab('dashboard')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BarChartIcon className="w-4 h-4"/> Dashboard
                    </button>
                    <button 
                        onClick={() => setActiveTab('data')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <TableIcon className="w-4 h-4"/> Data
                    </button>
                    <button 
                        onClick={() => setActiveTab('upload')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CloudArrowUpIcon className="w-4 h-4"/> Upload
                    </button>
                </div>
            </div>

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
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No data available.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* DATA TAB */}
                {activeTab === 'data' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ASIN / Title</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Clicks</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {metrics.slice(0, 100).map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.date}</td>
                                        <td className="px-4 py-2 text-sm text-slate-800">
                                            <div className="line-clamp-1" title={m.title}>{m.title}</div>
                                            <span className="text-xs text-slate-400 font-mono">{m.asin}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm text-slate-600">{m.clicks}</td>
                                        <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.revenue)}</td>
                                    </tr>
                                ))}
                                {metrics.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">No data imported yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* UPLOAD TAB */}
                {activeTab === 'upload' && (
                    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border-2 border-dashed border-slate-300 p-12">
                        <div className="bg-orange-50 p-4 rounded-full mb-4">
                            <CloudArrowUpIcon className="w-8 h-8 text-orange-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Upload Amazon Report</h3>
                        <p className="text-slate-500 text-center max-w-md mb-6">
                            Download the <strong>"Earnings Report"</strong> (Standard) from your Amazon Associates dashboard as a CSV file.
                        </p>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            accept=".csv" 
                            onChange={handleFileUpload} 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-slate-300 transition-colors"
                        >
                            {isUploading ? 'Parsing...' : 'Select CSV File'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmazonIntegration;
