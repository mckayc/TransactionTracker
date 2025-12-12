
import React, { useState, useEffect, useMemo } from 'react';
import type { CsvData, ColumnMapping } from '../services/csvParserService';
import type { AmazonReportType } from '../types';
import { CloseIcon, BoxIcon, CheckCircleIcon, ArrowRightIcon } from './Icons';

interface AmazonImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    csvData: CsvData;
    onComplete: (mapping: ColumnMapping, source: AmazonReportType | 'auto') => void;
    fileName: string;
}

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

    // Auto-detect columns on load
    useEffect(() => {
        if (isOpen && csvData.headers.length > 0) {
            const h = csvData.headers.map(h => h.toLowerCase().trim());
            const find = (...search: string[]) => h.findIndex(hdr => search.some(s => hdr === s || hdr.includes(s)));
            const findExact = (...search: string[]) => h.findIndex(hdr => search.includes(hdr));

            const newMapping: ColumnMapping = {
                date: findExact('date', 'date shipped'),
                asin: findExact('asin'),
                title: find('product title', 'title', 'item name'),
                clicks: find('clicks'),
                ordered: find('ordered items', 'items ordered'),
                shipped: find('shipped items', 'items shipped'),
                // Robust revenue detection
                revenue: find('ad fees', 'advertising fees', 'commission income', 'earnings', 'bounties'),
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

    if (!isOpen) return null;

    const handleMappingChange = (field: keyof ColumnMapping, indexStr: string) => {
        const index = parseInt(indexStr);
        setMapping(prev => ({ ...prev, [field]: index }));
    };

    const handleImport = () => {
        if (mapping.asin === -1) {
            alert("Please map the 'ASIN' column.");
            return;
        }
        if (mapping.revenue === -1) {
            alert("Please map the 'Revenue' column (Earnings, Fees, Commission).");
            return;
        }
        onComplete(mapping, source);
    };

    const fields: { key: keyof ColumnMapping, label: string, required?: boolean }[] = [
        { key: 'date', label: 'Date', required: true },
        { key: 'asin', label: 'ASIN', required: true },
        { key: 'title', label: 'Product Title' },
        { key: 'revenue', label: 'Revenue (Fees/Commission)', required: true },
        { key: 'clicks', label: 'Clicks' },
        { key: 'ordered', label: 'Ordered Items' },
        { key: 'shipped', label: 'Shipped Items' },
        { key: 'tracking', label: 'Tracking ID' },
        { key: 'campaignTitle', label: 'Campaign Title (CC)' },
    ];

    const previewRows = csvData.rows.slice(0, 100);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                            <BoxIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Import Wizard: {fileName}</h2>
                            <p className="text-sm text-slate-500">Verify column mapping and source.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><CloseIcon className="w-6 h-6" /></button>
                </div>

                {/* Configuration Area */}
                <div className="p-6 border-b border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Report Source</label>
                        <select 
                            value={source} 
                            onChange={(e) => setSource(e.target.value as any)}
                            className="w-full p-2 border rounded-md shadow-sm focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="auto">Auto-Detect (Based on ID/Content)</option>
                            <option value="onsite">Onsite (Storefront)</option>
                            <option value="offsite">Offsite (Links/Blogs)</option>
                            <option value="creator_connections">Creator Connections</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Force a specific source if auto-detection is incorrect.</p>
                    </div>
                    
                    <div className="flex items-end justify-end">
                         <div className="text-right text-sm text-slate-500">
                            <p>Found <strong>{csvData.rows.length}</strong> rows.</p>
                            <p>Showing first 100 below.</p>
                         </div>
                    </div>
                </div>

                {/* Mapping Table */}
                <div className="flex-1 overflow-auto bg-slate-50 p-6">
                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100">
                                    <tr>
                                        {csvData.headers.map((header, idx) => {
                                            // Find which field maps to this index (reverse lookup for UI)
                                            const mappedFieldKey = Object.keys(mapping).find(key => mapping[key as keyof ColumnMapping] === idx) as keyof ColumnMapping | undefined;
                                            
                                            return (
                                                <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[150px]">
                                                    <div className="mb-2 truncate" title={header}>{header}</div>
                                                    <select 
                                                        className={`w-full p-1 text-xs border rounded ${mappedFieldKey ? 'border-indigo-500 bg-indigo-50 font-bold text-indigo-700' : 'border-slate-300'}`}
                                                        value={mappedFieldKey || -1}
                                                        onChange={(e) => {
                                                            // If selecting a field, map it to this index
                                                            // If selecting "Ignore", we handle it by not setting state here directly but finding the key
                                                            const field = e.target.value as keyof ColumnMapping | '-1';
                                                            
                                                            // First, clear this index from any other field
                                                            const newMapping = { ...mapping };
                                                            Object.keys(newMapping).forEach(k => {
                                                                if (newMapping[k as keyof ColumnMapping] === idx) {
                                                                    newMapping[k as keyof ColumnMapping] = -1;
                                                                }
                                                            });

                                                            if (field !== '-1') {
                                                                newMapping[field] = idx;
                                                            }
                                                            setMapping(newMapping);
                                                        }}
                                                    >
                                                        <option value="-1">-- Ignore --</option>
                                                        {fields.map(f => (
                                                            <option key={f.key} value={f.key}>{f.label} {f.required ? '*' : ''}</option>
                                                        ))}
                                                    </select>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {previewRows.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-slate-50">
                                            {row.map((cell, cellIndex) => (
                                                <td key={cellIndex} className="px-4 py-2 whitespace-nowrap text-xs text-slate-600 truncate max-w-[200px]" title={cell}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-white rounded-b-xl flex justify-between items-center">
                    <div className="text-sm text-slate-500">
                        * Required fields must be mapped.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        <button 
                            onClick={handleImport} 
                            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-2"
                        >
                            <CheckCircleIcon className="w-4 h-4" />
                            Complete Import
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AmazonImportWizard;
