
import React, { useState, useMemo } from 'react';
import type { AmazonMetric } from '../types';
import { SortIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon } from './Icons';

interface AmazonTableProps {
    metrics: AmazonMetric[];
    onUpdateMetric: (metric: AmazonMetric) => void;
    onDeleteMetric: (id: string) => void;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onToggleSelectAll: () => void;
    onBulkSelection?: (ids: string[], selected: boolean) => void;
}

type SortKey = keyof AmazonMetric | '';
type SortDirection = 'asc' | 'desc';

// Helper for currency
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

const AmazonTable: React.FC<AmazonTableProps> = ({ 
    metrics, 
    onUpdateMetric,
    onDeleteMetric,
    selectedIds,
    onToggleSelection,
    onToggleSelectAll,
    onBulkSelection
}) => {
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);

    const sortedMetrics = useMemo(() => {
        if (!sortKey) return metrics;
        const sorted = [...metrics].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return aVal.localeCompare(bVal);
            }
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return aVal - bVal;
            }
            return 0;
        });
        return sortDirection === 'asc' ? sorted : sorted.reverse();
    }, [metrics, sortKey, sortDirection]);

    const totalPages = Math.ceil(sortedMetrics.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const currentItems = sortedMetrics.slice(startIndex, startIndex + rowsPerPage);

    const requestSort = (key: SortKey) => {
        setSortDirection(prev => (sortKey === key && prev === 'desc' ? 'asc' : 'desc'));
        setSortKey(key);
    };

    const getSortIndicator = (key: SortKey) => {
        if (sortKey !== key) return <SortIcon className="w-4 h-4 text-slate-300 invisible group-hover:visible" />;
        return sortDirection === 'desc' ? ' ▼' : ' ▲';
    };

    const handleSelectionChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        e.stopPropagation();
        const willSelect = e.target.checked;
        const isShiftKey = (e.nativeEvent as any).shiftKey;

        if (isShiftKey && lastClickedId && onBulkSelection) {
            const start = sortedMetrics.findIndex(m => m.id === lastClickedId);
            const end = sortedMetrics.findIndex(m => m.id === id);
            if (start !== -1 && end !== -1) {
                const rangeIds = sortedMetrics.slice(Math.min(start, end), Math.max(start, end) + 1).map(m => m.id);
                onBulkSelection(rangeIds, willSelect);
                setLastClickedId(id);
                return;
            }
        }
        onToggleSelection(id);
        setLastClickedId(id);
    };

    if (metrics.length === 0) {
        return <p className="text-center text-slate-500 py-8">No records found.</p>;
    }

    const renderHeader = (label: string, key: SortKey, className = "") => (
        <th scope="col" className={`px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 cursor-pointer group ${className}`} onClick={() => requestSort(key)}>
            <div className="flex items-center gap-1">
                {label}
                <span className="text-indigo-600">{getSortIndicator(key)}</span>
            </div>
        </th>
    );

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="flex-grow w-full overflow-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th scope="col" className="w-10 px-3 py-3 bg-slate-50 border-b border-slate-200">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={currentItems.length > 0 && currentItems.every(m => selectedIds.has(m.id))}
                                    onChange={onToggleSelectAll}
                                />
                            </th>
                            {renderHeader('Date', 'date', 'w-32')}
                            {renderHeader('Type', 'reportType', 'w-32')}
                            {renderHeader('ASIN / Title', 'title')}
                            {renderHeader('Clicks', 'clicks', 'text-right w-24')}
                            {renderHeader('Ordered', 'orderedItems', 'text-right w-24')}
                            {renderHeader('Shipped', 'shippedItems', 'text-right w-24')}
                            {renderHeader('Revenue', 'revenue', 'text-right w-32')}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {currentItems.map((m) => {
                            const isSelected = selectedIds.has(m.id);
                            return (
                                <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}>
                                    <td className="px-3 py-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={isSelected}
                                            onChange={(e) => handleSelectionChange(e, m.id)}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">{m.date}</td>
                                    <td className="px-3 py-2 text-sm">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                            m.reportType === 'onsite' ? 'bg-blue-100 text-blue-700' : 
                                            m.reportType === 'offsite' ? 'bg-green-100 text-green-700' : 
                                            'bg-purple-100 text-purple-700'
                                        }`}>
                                            {m.reportType.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm text-slate-800">
                                        <div className="line-clamp-1 font-medium" title={m.title}>{m.title}</div>
                                        <div className="flex gap-2 text-xs text-slate-400 font-mono mt-0.5 items-center">
                                            <a 
                                                href={`https://www.amazon.com/dp/${m.asin}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-indigo-600 hover:underline flex items-center gap-0.5 hover:text-indigo-800"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {m.asin} <ExternalLinkIcon className="w-3 h-3" />
                                            </a>
                                            {m.campaignTitle && <span className="text-purple-600 bg-purple-50 px-1 rounded">{m.campaignTitle}</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm text-slate-600">{formatNumber(m.clicks)}</td>
                                    <td className="px-3 py-2 text-right text-sm text-slate-600">{formatNumber(m.orderedItems)}</td>
                                    <td className="px-3 py-2 text-right text-sm text-slate-600">{formatNumber(m.shippedItems)}</td>
                                    <td className="px-3 py-2 text-right text-sm font-bold text-green-600">{formatCurrency(m.revenue)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="border-t border-slate-200 p-3 bg-slate-50 flex justify-between items-center sticky bottom-0 z-20">
                    <div className="text-xs text-slate-500">
                        Page {currentPage} of {totalPages} ({sortedMetrics.length} items)
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-50">
                            <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
                        </button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-50">
                            <ChevronRightIcon className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmazonTable;
