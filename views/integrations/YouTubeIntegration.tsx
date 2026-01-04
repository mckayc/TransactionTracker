
import React, { useState, useMemo, useRef } from 'react';
import type { YouTubeMetric, YouTubeChannel } from '../../types';
import { CloudArrowUpIcon, YoutubeIcon, CheckCircleIcon, SparklesIcon, CalendarIcon, ChevronDownIcon, CloseIcon } from '../../components/Icons';
import { parseYouTubeReport } from '../../services/csvParserService';
import { generateUUID } from '../../utils';

interface YouTubeIntegrationProps {
    metrics: YouTubeMetric[];
    onAddMetrics: (metrics: YouTubeMetric[]) => void;
    onDeleteMetrics: (ids: string[]) => void;
    channels: YouTubeChannel[];
    onSaveChannel: (channel: YouTubeChannel) => void;
    onDeleteChannel: (channelId: string) => void;
}

const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({ metrics, onAddMetrics, onDeleteMetrics, channels, onSaveChannel, onDeleteChannel }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'upload'>('dashboard');
    const [isUploading, setIsUploading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<YouTubeMetric[]>([]);
    const [detectedYear, setDetectedYear] = useState<string>('');
    const [manualYear, setManualYear] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const yearMatch = file.name.match(/\b(20[12]\d)\b/);
            const foundYear = yearMatch ? yearMatch[1] : '';
            setDetectedYear(foundYear);
            setManualYear(foundYear);
            const parsed = await parseYouTubeReport(file, (msg) => console.log(msg));
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

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <YoutubeIcon className="w-8 h-8 text-red-600" /> YouTube Analytics
                </h1>
                <div className="flex bg-white rounded-lg p-1 border">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'dashboard' ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'upload' ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}>Upload</button>
                </div>
            </div>

            {activeTab === 'upload' && (
                <div className="space-y-6">
                    {previewMetrics.length > 0 ? (
                        <div className="bg-white p-6 rounded-2xl border-2 border-red-50 shadow-sm animate-fade-in">
                            <div className="flex justify-between items-start mb-6">
                                <div><h2 className="text-lg font-bold text-slate-800">Review YouTube Data</h2></div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Set Data Year</label>
                                    <select value={manualYear} onChange={(e) => setManualYear(e.target.value)} className="w-full text-sm font-bold border rounded-lg">
                                        <option value="">Select Year...</option>
                                        {Array.from({length: 10}, (_, i) => (new Date().getFullYear() - i).toString()).map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setPreviewMetrics([])} className="flex-1 py-3 border rounded-xl font-bold text-slate-600">Cancel</button>
                                <button onClick={confirmImport} className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg">Confirm & Import</button>
                            </div>
                        </div>
                    ) : (
                        <div onClick={() => fileInputRef.current?.click()} className="bg-slate-50 border-2 border-dashed rounded-[2rem] p-12 text-center cursor-pointer hover:border-red-400 transition-all">
                            <CloudArrowUpIcon className="w-12 h-12 text-slate-300 mx-auto" />
                            <h3 className="text-xl font-bold text-slate-700 mt-4">Drop YouTube export CSV</h3>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default YouTubeIntegration;
