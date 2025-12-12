
import React, { useState, useEffect, useMemo } from 'react';
import { processAmazonData, type CsvData, type ColumnMapping } from '../services/csvParserService';
import type { AmazonReportType, AmazonMetric } from '../types';
import { CloseIcon, BoxIcon, CheckCircleIcon, CloudArrowUpIcon } from './Icons';

interface AmazonImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    csvData: CsvData;
    onComplete: (mapping: ColumnMapping, source: AmazonReportType | 'auto') => void;
    fileName: string;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const AmazonImportWizard: React.FC<AmazonImportWizardProps> = ({ isOpen, onClose, csvData, onComplete, fileName }) => {
    const [source, setSource] = useState<AmazonReportType | 'auto'>('auto');
    const [mapping, setMapping] = useState<ColumnMapping>({
        date: -1,
        asin: -1,
        title: -1,
        revenue: -1,
        clicks: -1,
        ordered: -1,
        shipped: -1,
        tracking: -1,
        category: -1,
        campaignTitle: -1
    });

    // Auto-detect columns
    useEffect(() => {
        if (isOpen && csvData.headers.length > 0) {
            // 1. Try to load saved mapping for this header signature
            const headerSignature = csvData.headers.join('|');
            const savedMap = localStorage.getItem(`amazon_map_${headerSignature}`);
            
            if (savedMap) {
                try {
                    setMapping(JSON.parse(savedMap));
                    return;
                } catch (e) {
                    console.error("Failed to parse saved mapping");
                }
            }

            // 2. Fallback to Heuristics
            const h = csvData.headers.map(h => h.toLowerCase().trim());
            const find = (...search: string[]) => h.findIndex(hdr => search.some(s => hdr === s || hdr.includes(s)));
            const findExact = (...search: string[]) => h.findIndex(hdr => search.includes(hdr));

            const newMapping: ColumnMapping = {
                date: findExact('date', 'date shipped'),
                asin: findExact('asin'),
                title: find('product title', 'title', 'item name', 'name'),
                clicks: find('clicks'),
                ordered: find('ordered items', 'items ordered'),
                shipped: find('shipped items', 'items shipped'),
                revenue: find('ad fees', 'advertising fees', 'commission income', 'earnings', 'bounties', 'amount'),
                tracking: find('tracking id'),
                category: find('category', 'product group'),
                campaignTitle: find('campaign title')
            };
            setMapping(newMapping);

            // Heuristic for Source
            if (find('campaign title') > -1) setSource('creator_connections');
            else if (fileName.toLowerCase().includes('onsite')) setSource('onsite');
            else setSource('auto');
        }
    }, [isOpen, csvData, fileName]);

    const previewMetrics = useMemo(() => {
        if (!csvData || csvData.rows.length === 0) return [];
        // Process first 150 rows
        const subset = {
            headers: csvData.headers,
            rows: csvData.rows.slice(0, 150)
        };
        return processAmazonData(subset, mapping, source);
    }, [csvData, mapping, source]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        // Save mapping for future use
        const headerSignature = csvData.headers.join('|');
        localStorage.setItem(`amazon_map_${headerSignature}`, JSON.stringify(mapping));
        onComplete(mapping, source);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                            <BoxIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Confirm Import</h2>
                            <p className="text-sm text-slate-500">Previewing the first {previewMetrics.length} records from <strong>{fileName}</strong></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><CloseIcon className="w-6 h-6" /></button>
                </div>

                {/* Configuration Area */}
                <div className="p-4 border-b border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 flex-shrink-0">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Report Source</label>
                        <select 
                            value={source} 
                            onChange={(e) => setSource(e.target.value as any)}
                            className="w-full p-2 border rounded-md shadow-sm focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="auto">Auto-Detect</option>
                            <option value="onsite">Onsite (Storefront)</option>
                            <option value="offsite">Offsite (Links/Blogs)</option>
                            <option value="creator_connections">Creator Connections</option>
                        </select>
                    </div>
                    
                    <div className="flex items-end justify-end">
                         <div className="text-right text-sm text-slate-500">
                            <p>Total Rows in File: <strong>{csvData.rows.length}</strong></p>
                         </div>
                    </div>
                </div>

                {/* Preview Table */}
                <div className="flex-1 overflow-auto bg-slate-50 p-6">
                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">ASIN</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">Title</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Category</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Clicks</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Ordered</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {previewMetrics.length > 0 ? (
                                        previewMetrics.map((m) => (
                                            <tr key={m.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{m.date}</td>
                                                <td className="px-4 py-2 text-xs">
                                                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                                        m.reportType === 'onsite' ? 'bg-blue-100 text-blue-700' : 
                                                        m.reportType === 'offsite' ? 'bg-green-100 text-green-700' : 
                                                        'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {m.reportType.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-xs text-slate-500 font-mono whitespace-nowrap">{m.asin}</td>
                                                <td className="px-4 py-2 text-xs text-slate-800 font-medium truncate max-w-[300px]" title={m.title}>{m.title}</td>
                                                <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[150px]">{m.category || '-'}</td>
                                                <td className="px-4 py-2 text-xs text-right text-slate-600">{m.clicks}</td>
                                                <td className="px-4 py-2 text-xs text-right text-slate-600">{m.orderedItems}</td>
                                                <td className="px-4 py-2 text-xs text-right font-bold text-green-600">{formatCurrency(m.revenue)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                                <p>No valid data found. Check the file format.</p>
                                                <p className="text-xs mt-1">Expected headers like "ASIN", "Date", "Earnings/Fees"</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-white rounded-b-xl flex justify-end items-center gap-3 flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={previewMetrics.length === 0}
                        className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        <CheckCircleIcon className="w-4 h-4" />
                        Confirm & Import
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AmazonImportWizard;
