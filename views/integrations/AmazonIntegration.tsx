import React, { useState, useMemo, useEffect } from 'react';
import type { AmazonMetric, AmazonReportType, AmazonVideo, AmazonCCType } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, DeleteIcon, CheckCircleIcon, SparklesIcon, TrendingUpIcon, CalendarIcon, WrenchIcon, VideoIcon, ShieldCheckIcon, CloseIcon } from '../../components/Icons';
import { parseAmazonReport, parseAmazonVideos } from '../../services/csvParserService';
import FileUpload from '../../components/FileUpload';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    videos: AmazonVideo[];
    onAddVideos: (videos: AmazonVideo[]) => void;
    onDeleteVideos: (ids: string[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, videos, onAddVideos, onDeleteVideos }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'tools' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<AmazonMetric[]>([]);
    const [uploadYear, setUploadYear] = useState<string>('');
    const [uploadType, setUploadType] = useState<AmazonReportType>('onsite');

    const summary = useMemo(() => {
        return metrics.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            clicks: acc.clicks + curr.clicks,
            ordered: acc.ordered + curr.orderedItems
        }), { revenue: 0, clicks: 0, ordered: 0 });
    }, [metrics]);

    const processReportFiles = async (files: File[]) => {
        setIsUploading(true);
        try {
            const results = await parseAmazonReport(files[0], (msg) => console.log(msg));
            setPreviewMetrics(results);
        } catch (e) {
            alert("Parsing failed.");
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = () => {
        const withMeta = previewMetrics.map(m => ({ ...m, reportYear: uploadYear || undefined, reportType: uploadType }));
        onAddMetrics(withMeta);
        setPreviewMetrics([]);
        setActiveTab('dashboard');
    };

    return (
        <div className="space-y-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BoxIcon className="w-8 h-8 text-orange-500" /> Amazon Influencer</h1>
                    <p className="text-slate-500">Track clicks and onsite performance.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    {['dashboard', 'data', 'tools', 'upload'].map((t: any) => (
                        <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${activeTab === t ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{t}</button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 -mx-4 px-4 pt-4">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p><p className="text-3xl font-black text-orange-600 mt-2">{formatCurrency(summary.revenue)}</p></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><p className="text-xs font-bold text-slate-400 uppercase">Total Clicks</p><p className="text-3xl font-black text-slate-800 mt-2">{summary.clicks.toLocaleString()}</p></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><p className="text-xs font-bold text-slate-400 uppercase">Conv Rate</p><p className="text-3xl font-black text-slate-800 mt-2">{(summary.clicks > 0 ? (summary.ordered / summary.clicks) * 100 : 0).toFixed(1)}%</p></div>
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {previewMetrics.length > 0 ? (
                            <div className="bg-white p-8 rounded-3xl border-2 border-orange-500 shadow-2xl space-y-6 animate-slide-up">
                                <h3 className="text-2xl font-black text-slate-800">Verify Import</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Year</label><input type="text" value={uploadYear} onChange={e => setUploadYear(e.target.value)} placeholder="2024" className="w-full p-2 border rounded-xl font-bold" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Source</label><select value={uploadType} onChange={e => setUploadType(e.target.value as any)} className="w-full p-2 border rounded-xl font-bold"><option value="onsite">Onsite</option><option value="offsite">Offsite</option><option value="creator_connections">CC</option></select></div>
                                </div>
                                <div className="flex gap-4"><button onClick={() => setPreviewMetrics([])} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">Cancel</button><button onClick={confirmImport} className="flex-[2] py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg">Confirm {previewMetrics.length} Records</button></div>
                            </div>
                        ) : (
                            <FileUpload onFileUpload={processReportFiles} disabled={isUploading} label="Click or drag files to import" acceptedFileTypes=".csv" />
                        )}
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-[10px] font-black uppercase text-slate-400">Date</th><th className="px-6 py-3 text-left text-[10px] font-black uppercase text-slate-400">Product</th><th className="px-6 py-3 text-right text-[10px] font-black uppercase text-slate-400">Clicks</th><th className="px-6 py-3 text-right text-[10px] font-black uppercase text-slate-400">Revenue</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Fixed property access: using 'saleDate' instead of 'date' and 'productTitle' instead of 'title' as per AmazonMetric interface */}
                                {metrics.slice(0, 50).map(m => <tr key={m.id}><td className="px-6 py-3 text-xs font-mono text-slate-500">{m.saleDate}</td><td className="px-6 py-3 text-sm font-bold text-slate-700 truncate max-w-md">{m.productTitle}</td><td className="px-6 py-3 text-right text-xs text-slate-500">{m.clicks}</td><td className="px-6 py-3 text-right text-sm font-black text-green-600">{formatCurrency(m.revenue)}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmazonIntegration;