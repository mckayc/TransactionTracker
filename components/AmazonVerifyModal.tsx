
import React, { useState } from 'react';
import type { AmazonMetric } from '../types';
import { CloseIcon, CheckCircleIcon, DeleteIcon, CloudArrowUpIcon } from './Icons';

interface AmazonVerifyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (metrics: AmazonMetric[]) => void;
    initialMetrics: AmazonMetric[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const AmazonVerifyModal: React.FC<AmazonVerifyModalProps> = ({ isOpen, onClose, onConfirm, initialMetrics }) => {
    const [metrics, setMetrics] = useState(initialMetrics);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const handleDelete = (id: string) => {
        setMetrics(prev => prev.filter(m => m.id !== id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        setMetrics(prev => prev.filter(m => !selectedIds.has(m.id)));
        setSelectedIds(new Set());
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === metrics.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(metrics.map(m => m.id)));
    };

    const totalRevenue = metrics.reduce((acc, m) => acc + m.revenue, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center p-6 border-b bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <CloudArrowUpIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Verify Import</h2>
                            <p className="text-sm text-slate-500">Found {metrics.length} records. Total Revenue: <strong>{formatCurrency(totalRevenue)}</strong></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 cursor-pointer" checked={metrics.length > 0 && selectedIds.size === metrics.length} onChange={toggleSelectAll} />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ASIN / Title</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                                <th className="px-4 py-3 text-center w-16">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {metrics.map(m => (
                                <tr key={m.id} className={selectedIds.has(m.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                                    <td className="px-4 py-2 text-center">
                                        <input type="checkbox" className="rounded border-slate-300 text-indigo-600 cursor-pointer" checked={selectedIds.has(m.id)} onChange={() => toggleSelection(m.id)} />
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">{m.date}</td>
                                    <td className="px-4 py-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded font-bold ${m.reportType === 'onsite' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                            {m.reportType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-800">
                                        <div className="line-clamp-1" title={m.title}>{m.title}</div>
                                        <span className="text-xs text-slate-400 font-mono">{m.asin}</span>
                                    </td>
                                    <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.revenue)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => handleDelete(m.id)} className="text-slate-400 hover:text-red-600 p-1"><DeleteIcon className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t bg-white flex justify-between items-center rounded-b-xl">
                    <div>
                        {selectedIds.size > 0 && (
                            <button onClick={handleBulkDelete} className="text-red-600 text-sm font-bold hover:bg-red-50 px-3 py-1.5 rounded transition-colors">
                                Delete {selectedIds.size} Selected
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={() => onConfirm(metrics)} disabled={metrics.length === 0} className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                            <CheckCircleIcon className="w-4 h-4" />
                            Confirm Import ({metrics.length})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AmazonVerifyModal;
