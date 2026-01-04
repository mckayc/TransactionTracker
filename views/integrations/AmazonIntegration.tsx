import React, { useState, useMemo, useRef } from 'react';
import type { AmazonMetric, AmazonReportType, AmazonCCType, AmazonVideo } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, DeleteIcon, CheckCircleIcon, CloseIcon, ChevronDownIcon, SearchCircleIcon, SparklesIcon, TrendingUpIcon, CalendarIcon, AddIcon, VideoIcon } from '../../components/Icons';
import { parseAmazonReport, parseAmazonVideos } from '../../services/csvParserService';
import { generateUUID } from '../../utils';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    videos: AmazonVideo[];
    onAddVideos: (videos: AmazonVideo[]) => void;
    onDeleteVideos: (ids: string[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ 
    metrics, 
    onAddMetrics, 
    onDeleteMetrics,
    videos,
    onAddVideos,
    onDeleteVideos
}) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [uploadType, setUploadType] = useState<'earnings' | 'videos'>('earnings');
    const [isUploading, setIsUploading] = useState(false);
    
    // Preview States
    const [previewMetrics, setPreviewMetrics] = useState<AmazonMetric[]>([]);
    const [previewVideos, setPreviewVideos] = useState<AmazonVideo[]>([]);
    
    // Year Detection
    const [detectedYear, setDetectedYear] = useState<string>('');
    const [manualYear, setManualYear] = useState<string>('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Logic to look for years in the file name (e.g. 2024, 2023, etc.)
            const yearMatch = file.name.match(/\b(20[12]\d)\b/);
            const foundYear = yearMatch ? yearMatch[1] : '';
            setDetectedYear(foundYear);
            setManualYear(foundYear);

            if (uploadType === 'earnings') {
                const parsed = await parseAmazonReport(file, (msg) => console.log(msg));
                setPreviewMetrics(parsed);
            } else {
                const parsed = await parseAmazonVideos(file, (msg) => console.log(msg));
                setPreviewVideos(parsed);
            }
            setActiveTab('upload');
        } catch (error) {
            alert("Error parsing file: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        const finalYear = manualYear || detectedYear;
        if (!finalYear) {
            alert("Please specify a report year.");
            return;
        }

        if (uploadType === 'earnings') {
            const dataWithYear = previewMetrics.map(m => ({ ...m, reportYear: finalYear }));
            onAddMetrics(dataWithYear);
            setPreviewMetrics([]);
        } else {
            // Apply year to videos if applicable
            onAddVideos(previewVideos);
            setPreviewVideos([]);
        }
        
        setActiveTab('dashboard');
    };

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 15 }, (_, i) => (currentYear - i).toString());

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <BoxIcon className="w-8 h-8 text-orange-500" /> Amazon Influencer
                </h1>
                <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'upload' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}>Upload</button>
                </div>
            </div>

            {activeTab === 'upload' && (
                <div className="space-y-6">
                    {previewMetrics.length > 0 || previewVideos.length > 0 ? (
                        <div className="bg-white p-6 rounded-2xl border-2 border-orange-100 shadow-sm animate-fade-in max-w-2xl mx-auto">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Review Import Dataset</h2>
                                    <p className="text-sm text-slate-500">
                                        {uploadType === 'earnings' 
                                            ? `Parsed ${previewMetrics.length} product entries.` 
                                            : `Parsed ${previewVideos.length} video records.`}
                                    </p>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                    <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Report Target Year</label>
                                    <select 
                                        value={manualYear} 
                                        onChange={(e) => setManualYear(e.target.value)}
                                        className="bg-white border-orange-200 text-sm font-bold rounded-lg focus:ring-orange-500 focus:border-orange-500"
                                    >
                                        <option value="">Select Year...</option>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    {!detectedYear && <p className="text-[9px] text-red-500 mt-1 font-bold">Year not detected in filename.</p>}
                                    {detectedYear && <p className="text-[9px] text-green-600 mt-1 font-bold">Automatically detected: {detectedYear}</p>}
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-6 border-t">
                                <button onClick={() => { setPreviewMetrics([]); setPreviewVideos([]); }} className="flex-1 py-3 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                                <button onClick={confirmImport} className="flex-[2] py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 transition-all active:scale-95">Confirm Import</button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                            <div 
                                onClick={() => { setUploadType('earnings'); fileInputRef.current?.click(); }}
                                className="bg-white border-2 border-dashed border-slate-300 rounded-[2rem] p-12 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group"
                            >
                                <CloudArrowUpIcon className="w-16 h-16 text-slate-300 mx-auto group-hover:scale-110 group-hover:text-orange-400 transition-all" />
                                <h3 className="text-xl font-bold text-slate-700 mt-4">Earnings CSV</h3>
                                <p className="text-sm text-slate-400 mt-2">Commission reports from Associates central.</p>
                            </div>
                            
                            <div 
                                onClick={() => { setUploadType('videos'); fileInputRef.current?.click(); }}
                                className="bg-white border-2 border-dashed border-slate-300 rounded-[2rem] p-12 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group"
                            >
                                <VideoIcon className="w-16 h-16 text-slate-300 mx-auto group-hover:scale-110 group-hover:text-orange-400 transition-all" />
                                <h3 className="text-xl font-bold text-slate-700 mt-4">Video Logs</h3>
                                <p className="text-sm text-slate-400 mt-2">CSV of your uploaded onsite videos.</p>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'dashboard' && (
                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 rounded-xl border shadow-sm border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Total Earnings</h4>
                            <p className="text-2xl font-black text-green-600">{formatCurrency(metrics.reduce((s, m) => s + m.revenue, 0))}</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border shadow-sm border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Total Clicks</h4>
                            <p className="text-2xl font-black text-slate-800">{metrics.reduce((s, m) => s + m.clicks, 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border shadow-sm border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Video Library</h4>
                            <p className="text-2xl font-black text-indigo-600">{videos.length} clips</p>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col flex-1">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Recent Activity</h3>
                            <button onClick={() => onDeleteMetrics(metrics.map(m => m.id))} className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors">Clear Data</button>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {metrics.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12">
                                    <BarChartIcon className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm">No data available. Upload a report to begin.</p>
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Product</th>
                                            <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Clicks</th>
                                            <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {metrics.slice(0, 50).map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2 text-sm text-slate-700 truncate max-w-xs" title={m.productTitle}>{m.productTitle}</td>
                                                <td className="px-4 py-2 text-right text-sm text-slate-500">{m.clicks}</td>
                                                <td className="px-4 py-2 text-right text-sm font-bold text-emerald-600">{formatCurrency(m.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmazonIntegration;