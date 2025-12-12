
import React, { useState, useEffect, useMemo } from 'react';
import type { CsvData, ColumnMapping } from '../services/csvParserService';
import type { AmazonReportType } from '../types';
import { CloseIcon, BoxIcon, CheckCircleIcon, ExclamationTriangleIcon } from './Icons';

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

    // Load/Auto-detect columns
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
                // Robust revenue detection
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

    const validateColumn = (colIndex: number, type: 'number' | 'date' | 'string'): string | null => {
        if (colIndex === -1) return null;
        
        // Check first 10 non-empty rows
        let validCount = 0;
        let invalidCount = 0;
        
        for (let i = 0; i < Math.min(csvData.rows.length, 20); i++) {
            const val = csvData.rows[i][colIndex];
            if (!val || val.trim() === '') continue;

            if (type === 'number') {
                const num = parseFloat(val.replace(/[$,%()]/g, ''));
                if (isNaN(num)) invalidCount++;
                else validCount++;
            } else if (type === 'date') {
                // Loose date check
                if (!val.match(/\d/) && !val.includes('/') && !val.includes('-')) invalidCount++;
                else validCount++;
            }
        }

        if (validCount === 0 && invalidCount > 0) return "Data doesn't look valid.";
        if (invalidCount > validCount) return "Many invalid values detected.";
        return null;
    };

    if (!isOpen) return null;

    const handleImport = () => {
        if (mapping.asin === -1) {
            alert("Please map the 'ASIN' column.");
            return;
        }
        if (mapping.revenue === -1) {
            alert("Please map the 'Revenue' column (Earnings, Fees, Commission).");
            return;
        }

        // Save mapping for future use
        const headerSignature = csvData.headers.join('|');
        localStorage.setItem(`amazon_map_${headerSignature}`, JSON.stringify(mapping));

        onComplete(mapping, source);
    };

    const fields: { key: keyof ColumnMapping, label: string, required?: boolean, type: 'number' | 'date' | 'string' }[] = [
        { key: 'date', label: 'Date', required: true, type: 'date' },
        { key: 'asin', label: 'ASIN', required: true, type: 'string' },
        { key: 'title', label: 'Product Title', type: 'string' },
        { key: 'revenue', label: 'Revenue (Fees/Commission)', required: true, type: 'number' },
        { key: 'clicks', label: 'Clicks', type: 'number' },
        { key: 'ordered', label: 'Ordered Items', type: 'number' },
        { key: 'shipped', label: 'Shipped Items', type: 'number' },
        { key: 'tracking', label: 'Tracking ID', type: 'string' },
        { key: 'campaignTitle', label: 'Campaign Title (CC)', type: 'string' },
    ];

    const previewRows = csvData.rows.slice(0, 100);

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
                            <h2 className="text-xl font-bold text-slate-800">Import Wizard: {fileName}</h2>
                            <p className="text-sm text-slate-500">Verify column mapping and source.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><CloseIcon className="w-6 h-6" /></button>
                </div>

                {/* Configuration Area */}
                <div className="p-6 border-b border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 flex-shrink-0">
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
                        <div className="overflow-x-auto w-full">
                            <table className="min-w-full divide-y divide-slate-200 table-fixed">
                                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        {csvData.headers.map((header, idx) => {
                                            // Find which field maps to this column index
                                            const mappedFieldKey = Object.keys(mapping).find(key => mapping[key as keyof ColumnMapping] === idx) as keyof ColumnMapping | undefined;
                                            
                                            // Validation Check
                                            let validationError: string | null = null;
                                            if (mappedFieldKey) {
                                                const fieldConfig = fields.find(f => f.key === mappedFieldKey);
                                                if (fieldConfig) {
                                                    validationError = validateColumn(idx, fieldConfig.type);
                                                }
                                            }

                                            return (
                                                <th key={idx} className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider min-w-[180px] w-[200px] border-b-2 ${mappedFieldKey ? 'bg-indigo-50 border-indigo-500' : 'border-slate-200'}`}>
                                                    <div className="mb-2 truncate font-bold text-slate-700" title={header}>{header}</div>
                                                    <div className="relative">
                                                        <select 
                                                            className={`w-full p-1 text-xs border rounded shadow-sm focus:ring-1 focus:ring-indigo-500 ${mappedFieldKey ? 'border-indigo-500 font-bold text-indigo-700' : 'border-slate-300'}`}
                                                            value={mappedFieldKey || -1}
                                                            onChange={(e) => {
                                                                const field = e.target.value as keyof ColumnMapping | '-1';
                                                                const newMapping = { ...mapping };
                                                                // Unset previous mapping for this column if any
                                                                Object.keys(newMapping).forEach(k => {
                                                                    if (newMapping[k as keyof ColumnMapping] === idx) {
                                                                        newMapping[k as keyof ColumnMapping] = -1;
                                                                    }
                                                                });
                                                                // Set new mapping
                                                                if (field !== '-1') newMapping[field] = idx;
                                                                setMapping(newMapping);
                                                            }}
                                                        >
                                                            <option value="-1">-- Ignore --</option>
                                                            {fields.map(f => (
                                                                <option key={f.key} value={f.key}>{f.label} {f.required ? '*' : ''}</option>
                                                            ))}
                                                        </select>
                                                        {validationError && (
                                                            <div className="absolute right-0 top-full mt-1 z-20 bg-red-100 text-red-700 text-[10px] p-1 rounded shadow-md border border-red-200 flex items-center gap-1 w-full">
                                                                <ExclamationTriangleIcon className="w-3 h-3 flex-shrink-0" />
                                                                {validationError}
                                                            </div>
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {previewRows.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-slate-50">
                                            {row.map((cell, cellIndex) => {
                                                const isMapped = Object.values(mapping).includes(cellIndex);
                                                return (
                                                    <td 
                                                        key={cellIndex} 
                                                        className={`px-4 py-2 text-xs text-slate-600 truncate block h-full border-r border-transparent ${isMapped ? 'bg-indigo-50/30' : ''}`} 
                                                        title={cell}
                                                    >
                                                        {cell}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-white rounded-b-xl flex justify-between items-center flex-shrink-0">
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
