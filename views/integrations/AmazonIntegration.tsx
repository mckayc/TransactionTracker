
import React, { useState, useMemo, useRef } from 'react';
import type { AmazonMetric, AmazonReportType, AmazonCCType } from '../../types';
import { CloudArrowUpIcon, BarChartIcon, TableIcon, BoxIcon, DeleteIcon, CheckCircleIcon, CloseIcon, ChevronDownIcon, SearchCircleIcon, SparklesIcon, TrendingUpIcon, CalendarIcon, AddIcon } from '../../components/Icons';
import { parseAmazonReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';

interface AmazonIntegrationProps {
    metrics: AmazonMetric[];
    onAddMetrics: (metrics: AmazonMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const AmazonIntegration: React.FC<AmazonIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<AmazonMetric[]>([]);
    const [detectedYear, setDetectedYear] = useState<string>('');
    const [manualYear, setManualYear] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Regex for year detection (2010 to 2030)
            const yearMatch = file.name.match(/\b(20[12]\d)\b/);
            const foundYear = yearMatch ? yearMatch[1] : '';
            setDetectedYear(foundYear);
            setManualYear(foundYear);

            const parsed = await parseAmazonReport(file, (msg) => console.log(msg));
            setPreviewMetrics(parsed);
            setActiveTab('upload');
        } catch (error) {
            alert("Error parsing file.");
        } finally {
            setIsUploading(false);
        }
    };

    const confirmImport = () => {
        const finalYear = manualYear || detectedYear;
        if (!finalYear) {
            alert("Please specify a report year.");
            return;
        }
        const dataWithYear = previewMetrics.map(m => ({ ...m, reportYear: finalYear }));
        onAddMetrics(dataWithYear);
        setPreviewMetrics([]);
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
                <div className="flex bg-white rounded-lg p-1 border">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'dashboard' ? 'bg-orange-50 text-orange-700' : 'text-slate-500'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'upload' ? 'bg-orange-50 text-orange-700' : 'text-slate-500'}`}>Upload</button>
                </div>
            </div>

            {activeTab === 'upload' && (
                <div className="space-y-6">
                    {previewMetrics.length > 0 ? (
                        <div className="bg-white p-6 rounded-2xl border-2 border-orange-100 shadow-sm animate-fade-in">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Review Import Dataset</h2>
                                    <p className="text-sm text-slate-500">Parsed {previewMetrics.length} product entries.</p>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                    <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Report Target Year</label>
                                    <select 
                                        value={manualYear} 
                                        onChange={(e) => setManualYear(e.target.value)}
                                        className="bg-white border-orange-200 text-sm font-bold rounded-lg focus:ring-orange-500"
                                    >
                                        <option value="">Select Year...</option>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    {!detectedYear && <p className="text-[9px] text-red-500 mt-1">Year not detected in filename.</p>}
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-6 border-t">
                                <button onClick={() => setPreviewMetrics([])} className="flex-1 py-3 border rounded-xl font-bold text-slate-600">Cancel</button>
                                <button onClick={confirmImport} className="flex-[2] py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg">Confirm Import</button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-slate-50 border-2 border-dashed rounded-[2rem] p-12 text-center cursor-pointer hover:border-orange-400 transition-all group"
                        >
                            <CloudArrowUpIcon className="w-16 h-16 text-slate-300 mx-auto group-hover:scale-110 transition-transform" />
                            <h3 className="text-xl font-bold text-slate-700 mt-4">Drop earnings CSV here</h3>
                            <p className="text-sm text-slate-400 mt-2">I will try to detect the year from your filename automatically.</p>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-xl border shadow-sm"><h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Total Earnings</h4><p className="text-2xl font-black text-green-600">{formatCurrency(metrics.reduce((s, m) => s + m.revenue, 0))}</p></div>
                    {/* Simplified for brevity */}
                </div>
            )}
        </div>
    );
};

export default AmazonIntegration;
