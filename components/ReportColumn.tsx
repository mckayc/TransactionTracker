

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, Category, TransactionType, ReportConfig, DateRangePreset, Account, User, BalanceEffect, Tag, Payee, ReportGroupBy, CustomDateRange, DateRangeUnit, SavedReport, AmazonMetric, YouTubeMetric } from '../types';
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeSlashIcon, SortIcon, EditIcon, TableIcon, CloseIcon, SettingsIcon, SaveIcon, InfoIcon, ExclamationTriangleIcon } from './Icons';
import { formatDate } from '../dateUtils';
import TransactionTable from './TransactionTable';
import ReportConfigModal from './ReportConfigModal';

interface ReportColumnProps {
    config: ReportConfig;
    transactions: Transaction[];
    categories: Category[];
    transactionTypes: TransactionType[];
    accounts: Account[];
    users: User[];
    tags: Tag[];
    payees: Payee[];
    onSaveReport: (config: ReportConfig) => void;
    onUpdateReport: (config: ReportConfig) => void;
    savedDateRanges: CustomDateRange[];
    onSaveDateRange: (range: CustomDateRange) => void;
    onDeleteDateRange: (id: string) => void;
    savedReports?: SavedReport[];
    amazonMetrics?: AmazonMetric[];
    youtubeMetrics?: YouTubeMetric[];
}

const COLORS = ['#4f46e5', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1'];

// Helper to generate lighter shades of a hex color
const lightenColor = (color: string, percent: number) => {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const B = ((num >> 8) & 0x00FF) + amt;
    const G = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

export const applyOffset = (date: Date, value: number, unit: DateRangeUnit) => {
    const d = new Date(date);
    switch (unit) {
        case 'day':
            d.setDate(d.getDate() - value);
            break;
        case 'week':
            d.setDate(d.getDate() - (value * 7));
            break;
        case 'month':
            d.setMonth(d.getMonth() - value);
            break;
        case 'quarter':
            d.setMonth(d.getMonth() - (value * 3));
            break;
        case 'year':
            d.setFullYear(d.getFullYear() - value);
            break;
    }
    return d;
};

export const calculateDateRange = (preset: DateRangePreset, customStart: string | undefined, customEnd: string | undefined, savedRanges: CustomDateRange[]): { start: Date, end: Date, label: string } => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let label = '';

    const resetTime = (d: Date, endOfDay = false) => {
        if (endOfDay) d.setHours(23, 59, 59, 999);
        else d.setHours(0, 0, 0, 0);
        return d;
    };

    const customRange = savedRanges.find(r => r.id === preset);

    if (customRange) {
        label = customRange.name;
        const val = customRange.value;
        const unit = customRange.unit;
        
        if (customRange.type === 'fixed_period') {
            let anchor = new Date(now);
            
            if (customRange.offsets && customRange.offsets.length > 0) {
                customRange.offsets.forEach(offset => {
                    anchor = applyOffset(anchor, offset.value, offset.unit);
                });
            } else {
                anchor = applyOffset(anchor, val, unit);
            }

            if (unit === 'day') {
                start = new Date(anchor);
                end = new Date(anchor);
            } else if (unit === 'week') {
                const day = anchor.getDay();
                start = new Date(anchor);
                start.setDate(anchor.getDate() - day);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
            } else if (unit === 'month') {
                start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
                end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
            } else if (unit === 'quarter') {
                const q = Math.floor(anchor.getMonth() / 3);
                start = new Date(anchor.getFullYear(), q * 3, 1);
                end = new Date(anchor.getFullYear(), q * 3 + 3, 0);
            } else if (unit === 'year') {
                start = new Date(anchor.getFullYear(), 0, 1);
                end = new Date(anchor.getFullYear(), 11, 31);
            }

        } else {
            end = new Date(); 
            start = new Date();
            start = applyOffset(start, val, unit);
        }
    } else {
        switch (preset) {
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                break;
            case 'thisYear':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                label = now.getFullYear().toString();
                break;
            case 'lastYear':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31);
                label = (now.getFullYear() - 1).toString();
                break;
            case 'allTime':
                start = new Date(0); 
                end = new Date();
                label = 'All Time';
                break;
            case 'custom':
                start = customStart ? new Date(customStart) : new Date();
                end = customEnd ? new Date(customEnd) : new Date();
                label = `${formatDate(start)} - ${formatDate(end)}`;
                break;
            case 'last3Months':
                end = new Date();
                start = new Date();
                start.setDate(now.getDate() - 90);
                label = 'Last 90 Days';
                break;
            case 'last6Months':
                end = new Date();
                start = new Date();
                start.setMonth(now.getMonth() - 6);
                label = 'Last 6 Months';
                break;
            case 'last12Months':
                end = new Date();
                start = new Date();
                start.setFullYear(now.getFullYear() - 1);
                label = 'Last 12 Months';
                break;
            default:
                if (preset === 'specificMonth' && customStart) {
                     const parts = customStart.split('-');
                    if (parts.length === 2) {
                        const year = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        start = new Date(year, month, 1);
                        end = new Date(year, month + 1, 0);
                        label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                    }
                } else if (preset === 'relativeMonth' && customStart) {
                    const offset = parseInt(customStart, 10);
                    start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
                    end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
                    label = `${offset} Months Ago`;
                } else {
                    label = 'Custom Range';
                }
                break;
        }
    }

    return { start: resetTime(start), end: resetTime(end, true), label };
};

const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[]; total: number }> = ({ data, total }) => {
    let accumulatedAngle = 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const [hoveredSlice, setHoveredSlice] = useState<{ label: string; value: number; color: string } | null>(null);

    return (
        <div className="relative w-48 h-48 mx-auto group">
            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full overflow-visible">
                {data.map((slice, i) => {
                    const percentage = total > 0 ? slice.value / total : 0;
                    if (percentage === 0) return null;
                    const strokeDasharray = `${percentage * circumference} ${circumference}`;
                    const strokeDashoffset = -accumulatedAngle * circumference;
                    accumulatedAngle += percentage;
                    
                    const isHovered = hoveredSlice?.label === slice.label;

                    return (
                        <circle
                            key={i}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth={isHovered ? "18" : "14"}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transformOrigin: '50px 50px' }}
                            className={`transition-all duration-300 cursor-pointer ${isHovered ? 'opacity-100 scale-105 drop-shadow-md z-20' : 'opacity-90 hover:opacity-100 hover:scale-105'}`}
                            onMouseEnter={() => setHoveredSlice(slice)}
                            onMouseLeave={() => setHoveredSlice(null)}
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <span className="text-xs text-slate-500 font-medium uppercase mb-1 drop-shadow-sm bg-white/70 px-1 rounded">
                    {hoveredSlice ? hoveredSlice.label : 'Total'}
                </span>
                <span className={`text-lg font-bold ${hoveredSlice ? '' : 'text-slate-800'} drop-shadow-sm`} style={{ color: hoveredSlice ? hoveredSlice.color : undefined }}>
                    {formatCurrency(hoveredSlice ? hoveredSlice.value : total)}
                </span>
                {hoveredSlice && total > 0 && (
                    <span className="text-xs text-slate-400 font-medium bg-white/70 px-1 rounded">
                        {((hoveredSlice.value / total) * 100).toFixed(1)}%
                    </span>
                )}
            </div>
        </div>
    );
};

interface ItemNode {
    id: string;
    label: string;
    value: number; // Display Value (0 if hidden)
    sortValue: number; // Sort Value (includes value even if hidden)
    color: string;
    transactions: Transaction[];
    children: ItemNode[];
    parentId?: string;
    ownValue: number; // Direct value of this node
}

const ReportRow: React.FC<{ 
    item: ItemNode; 
    total: number; 
    onClick: (item: ItemNode) => void;
    isHidden: boolean;
    onToggleHidden: (e: React.MouseEvent, id: string) => void;
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    depth?: number;
}> = ({ item, total, onClick, isHidden, onToggleHidden, expandedIds, onToggleExpand, depth = 0 }) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const isExpanded = expandedIds.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
        <div className="select-none">
            <div 
                className={`relative flex items-center gap-2 p-2 pr-3 rounded-lg cursor-pointer transition-colors group ${isHidden ? 'opacity-50 grayscale bg-slate-50' : 'hover:bg-slate-50'}`}
                style={{ paddingLeft: `${(depth * 12) + 8}px` }}
                onClick={() => onClick(item)}
            >
                {/* Guideline for children */}
                {depth > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 border-l border-slate-200" style={{ left: `${(depth * 12) - 4}px` }}></div>
                )}

                <div className="flex-shrink-0 w-5 flex justify-center">
                    {hasChildren ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {isExpanded ? <ChevronDownIcon className="w-3.5 h-3.5"/> : <ChevronRightIcon className="w-3.5 h-3.5"/>}
                        </button>
                    ) : null}
                </div>
                
                <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: isHidden ? '#cbd5e1' : item.color }} 
                />
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-sm font-medium truncate ${isHidden ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                            {item.label}
                        </span>
                        <span className={`text-sm font-bold ${isHidden ? 'text-slate-300' : 'text-slate-900'}`}>
                            {isHidden ? '---' : formatCurrency(item.value)}
                        </span>
                    </div>
                    {/* Progress Bar only for top-level or significant items */}
                    {!isHidden && percentage > 2 && (
                        <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div 
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                    width: `${percentage}%`, 
                                    backgroundColor: item.color 
                                }}
                            />
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={(e) => onToggleHidden(e, item.id)}
                    className={`p-1.5 rounded transition-colors ${
                        isHidden 
                        ? 'text-slate-500 bg-slate-200 opacity-100' 
                        : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100'
                    }`}
                    title={isHidden ? "Show" : "Hide"}
                >
                    {isHidden ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                </button>
            </div>
            
            {isExpanded && item.children.length > 0 && (
                <div className="mt-0.5">
                    {item.children.sort((a,b) => b.sortValue - a.sortValue).map(child => (
                        <ReportRow
                            key={child.id}
                            item={child}
                            total={total}
                            onClick={onClick}
                            isHidden={isHidden}
                            onToggleHidden={onToggleHidden}
                            expandedIds={expandedIds}
                            onToggleExpand={onToggleExpand}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ReportColumn: React.FC<ReportColumnProps> = ({ config: initialConfig, transactions, categories, transactionTypes, accounts, users, tags, payees, onSaveReport, onUpdateReport, savedDateRanges, onSaveDateRange, onDeleteDateRange, savedReports, amazonMetrics, youtubeMetrics }) => {
    
    const [config, setConfig] = useState<ReportConfig>(initialConfig);
    const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [inspectingItems, setInspectingItems] = useState<Transaction[] | null>(null);
    const [inspectingTitle, setInspectingTitle] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    
    const reportRef = useRef<HTMLDivElement>(null);

    // Sync local state when prop changes
    useEffect(() => {
        setConfig(initialConfig);
    }, [initialConfig]);

    const dateRange = useMemo(() => 
        calculateDateRange(config.datePreset, config.customStartDate, config.customEndDate, savedDateRanges), 
    [config.datePreset, config.customStartDate, config.customEndDate, savedDateRanges]);

    const activeData = useMemo(() => {
        const { start, end } = dateRange;
        const filterEnd = new Date(end);
        filterEnd.setHours(23, 59, 59, 999);
        const startDateStr = formatDate(start);
        const endDateStr = formatDate(filterEnd);

        let filteredItems: any[] = [];
        const isAmazon = config.dataSource === 'amazon';
        const isYouTube = config.dataSource === 'youtube';

        if (isAmazon) {
            filteredItems = (amazonMetrics || []).filter(m => {
                if (m.date < startDateStr || m.date > endDateStr) return false;
                if (config.filters.amazonSources && !config.filters.amazonSources.includes(m.reportType)) return false;
                return true;
            });
        } else if (isYouTube) {
            filteredItems = (youtubeMetrics || []).filter(m => {
                // Using publishDate as the filter date
                if (m.publishDate < startDateStr || m.publishDate > endDateStr) return false;
                return true;
            });
        } else {
            // Standard Financial
            filteredItems = transactions.filter(tx => {
                if (tx.isParent) return false;
                
                const txDate = new Date(tx.date);
                if (txDate < start || txDate > filterEnd) return false;

                const type = transactionTypes.find(t => t.id === tx.typeId);
                if (!type || !config.filters.balanceEffects?.includes(type.balanceEffect)) return false;

                if (config.filters.accountIds && !config.filters.accountIds.includes(tx.accountId || '')) return false;
                if (config.filters.userIds && !config.filters.userIds.includes(tx.userId || '')) return false;
                if (config.filters.categoryIds && !config.filters.categoryIds.includes(tx.categoryId)) return false;
                if (config.filters.typeIds && !config.filters.typeIds.includes(tx.typeId)) return false;
                if (config.filters.payeeIds && !config.filters.payeeIds.includes(tx.payeeId || '')) return false;
                if (config.filters.tagIds && config.filters.tagIds.length > 0) {
                    if (!tx.tagIds || !tx.tagIds.some(tId => config.filters.tagIds!.includes(tId))) return false;
                }
                return true;
            });
        }

        const isHierarchical = config.groupBy === 'category' || config.groupBy === 'payee';
        const hiddenIds = new Set(config.hiddenIds || config.hiddenCategoryIds || []);
        
        let rootNodes: ItemNode[] = [];

        if (isHierarchical && !isAmazon && !isYouTube) {
            const nodeMap = new Map<string, ItemNode>();
            
            const getNode = (id: string, label: string, parentId?: string): ItemNode => {
                if (!nodeMap.has(id)) {
                    nodeMap.set(id, { 
                        id, 
                        label, 
                        value: 0, 
                        sortValue: 0,
                        ownValue: 0,
                        color: '', 
                        transactions: [], 
                        children: [], 
                        parentId 
                    });
                }
                return nodeMap.get(id)!;
            }

            // 1. Map transactions to nodes
            filteredItems.forEach((tx: Transaction) => {
                let key = '', label = 'Unknown', parentId: string | undefined = undefined;
                
                if (config.groupBy === 'category') {
                    key = tx.categoryId;
                    const cat = categories.find(c => c.id === key);
                    label = cat?.name || 'Uncategorized';
                    parentId = cat?.parentId;
                } else if (config.groupBy === 'payee') {
                    key = tx.payeeId || 'no-payee';
                    const p = payees.find(py => py.id === key);
                    label = p?.name || 'No Payee';
                    parentId = p?.parentId;
                }

                const node = getNode(key, label, parentId);
                node.ownValue += tx.amount; 
                node.transactions.push(tx);
            });

            // 2. Build tree structure
            const currentNodes = Array.from(nodeMap.values());
            
            currentNodes.forEach(node => {
                if (node.parentId) {
                    if (!nodeMap.has(node.parentId)) {
                        let parentLabel = 'Unknown Parent';
                        let grandParentId: string | undefined = undefined;
                        
                        if (config.groupBy === 'category') {
                            const p = categories.find(c => c.id === node.parentId);
                            if (p) { parentLabel = p.name; grandParentId = p.parentId; }
                        } else {
                            const p = payees.find(py => py.id === node.parentId);
                            if (p) { parentLabel = p.name; grandParentId = p.parentId; }
                        }
                        getNode(node.parentId, parentLabel, grandParentId);
                    }
                    
                    const parent = nodeMap.get(node.parentId)!;
                    if (!parent.children.find(c => c.id === node.id)) {
                        parent.children.push(node);
                    }
                }
            });

            // 3. Identify roots
            const roots = Array.from(nodeMap.values()).filter(n => !n.parentId || !nodeMap.has(n.parentId));

            // 4. Calculate total values recursively
            const aggregateValues = (node: ItemNode): { visible: number, total: number } => {
                let visibleSum = 0;
                let totalSum = node.ownValue;

                const isNodeHidden = hiddenIds.has(node.id);

                if (!isNodeHidden) {
                    visibleSum = node.ownValue;
                }
                
                for (const child of node.children) {
                    const childSums = aggregateValues(child);
                    if (!isNodeHidden) {
                        visibleSum += childSums.visible;
                    }
                    totalSum += childSums.total;
                    node.transactions = [...node.transactions, ...child.transactions];
                }
                
                node.value = visibleSum;
                node.sortValue = totalSum;
                return { visible: visibleSum, total: totalSum };
            };
            
            roots.forEach(aggregateValues);
            rootNodes = roots;

        } else {
            // Flat Aggregation
            const nodes = new Map<string, ItemNode>();
            
            filteredItems.forEach((item) => {
                let key = '', label = 'Unknown', val = 0;

                if (isAmazon) {
                    const m = item as AmazonMetric;
                    val = m.revenue;
                    if (config.groupBy === 'source') {
                        key = m.reportType;
                        label = m.reportType.replace('_', ' ').toUpperCase();
                    } else if (config.groupBy === 'category') {
                        key = m.category || 'Unknown';
                        label = m.category || 'Unknown Category';
                    } else if (config.groupBy === 'product') {
                        key = m.asin;
                        label = m.title || m.asin;
                    }
                } else if (isYouTube) {
                    const m = item as YouTubeMetric;
                    val = m.estimatedRevenue;
                    if (config.groupBy === 'video') {
                        key = m.videoId;
                        label = m.videoTitle || m.videoId;
                    } else {
                        // Default fallback for YouTube if groupBy is generic
                        key = m.videoId;
                        label = m.videoTitle || m.videoId;
                    }
                } else {
                    const tx = item as Transaction;
                    val = tx.amount;
                    if (config.groupBy === 'account') {
                        key = tx.accountId || 'no-account';
                        label = accounts.find(a => a.id === key)?.name || 'Unknown Account';
                    } else if (config.groupBy === 'type') {
                        key = tx.typeId;
                        label = transactionTypes.find(t => t.id === key)?.name || 'Unknown Type';
                    } else if (config.groupBy === 'tag') {
                        const txTags = tx.tagIds && tx.tagIds.length > 0 ? tx.tagIds : ['no-tag'];
                        txTags.forEach(tagId => {
                            const tagKey = tagId;
                            const tagLabel = tags.find(t => t.id === tagId)?.name || 'No Tag';
                            if (config.filters.tagIds && tagId !== 'no-tag' && !config.filters.tagIds.includes(tagId)) return;
                            
                            if (!nodes.has(tagKey)) {
                                nodes.set(tagKey, { id: tagKey, label: tagLabel, value: 0, sortValue: 0, ownValue: 0, color: '', transactions: [], children: [] });
                            }
                            const node = nodes.get(tagKey)!;
                            node.ownValue += val;
                            node.transactions.push(tx);
                        });
                        return;
                    } else if (config.groupBy === 'category') {
                        // Fallback flat category group
                        key = tx.categoryId;
                        label = categories.find(c => c.id === key)?.name || 'Unknown';
                    } else if (config.groupBy === 'payee') {
                        key = tx.payeeId || 'no-payee';
                        label = payees.find(p => p.id === key)?.name || 'No Payee';
                    }
                }

                if (!nodes.has(key)) {
                    nodes.set(key, { id: key, label, value: 0, sortValue: 0, ownValue: 0, color: '', transactions: [], children: [] });
                }
                const node = nodes.get(key)!;
                node.ownValue += val;
                if (!isAmazon && !isYouTube) node.transactions.push(item as Transaction);
            });
            
            rootNodes = Array.from(nodes.values());
            rootNodes.forEach(node => {
                node.sortValue = node.ownValue;
                node.value = hiddenIds.has(node.id) ? 0 : node.ownValue;
            });
        }

        // Sort roots first so colors align with magnitude, using sortValue (includes hidden amounts) to maintain order
        rootNodes.sort((a, b) => sortBy === 'amount' ? b.sortValue - a.sortValue : a.label.localeCompare(b.label));

        // Color Assignment with Hierarchical Shading
        rootNodes.forEach((node, i) => {
            const baseColor = COLORS[i % COLORS.length];
            node.color = baseColor;
            
            // Assign colors to children creating a lightness gradient
            const processChildren = (n: ItemNode, base: string) => {
                if(n.children && n.children.length > 0) {
                    n.children.sort((a,b) => b.sortValue - a.sortValue);
                    
                    n.children.forEach((child, idx) => {
                        const lightness = 15 + (Math.min(idx, 5) * 5); 
                        child.color = lightenColor(base, lightness);
                        processChildren(child, base); 
                    });
                }
            };
            processChildren(node, baseColor);
        });

        // Calculate Totals - only visible value
        const totalValue = rootNodes.reduce((sum, item) => sum + item.value, 0);
        // Only show slices that have visible value in the chart
        const visibleItems = rootNodes.filter(r => r.value > 0);

        return { items: rootNodes, totalValue, visibleItems };

    }, [transactions, config, dateRange, transactionTypes, categories, accounts, payees, tags, sortBy, amazonMetrics, youtubeMetrics]);

    const handleConfigUpdate = (newConfig: ReportConfig) => {
        setConfig(newConfig);
        onUpdateReport(newConfig);
        
        if (savedReports && savedReports.some(r => r.id === newConfig.id)) {
            onSaveReport(newConfig);
        }
    };

    const toggleHidden = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const currentHidden = new Set(config.hiddenIds || config.hiddenCategoryIds || []);
        if (currentHidden.has(id)) currentHidden.delete(id);
        else currentHidden.add(id);
        
        const newConfig = { 
            ...config, 
            hiddenIds: Array.from(currentHidden),
            hiddenCategoryIds: Array.from(currentHidden) 
        };
        handleConfigUpdate(newConfig);
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleInspect = (item: ItemNode) => {
        // Inspection only works for transactions for now, not amazon metrics
        if (config.dataSource === 'amazon' || config.dataSource === 'youtube') return;
        setInspectingTitle(`${item.label} Transactions`);
        setInspectingItems(item.transactions);
    };

    return (
        <div ref={reportRef} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden min-w-[320px] relative">
            
            <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-lg truncate" title={config.name}>{config.name}</h3>
                        {config.dataSource === 'amazon' && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded font-bold uppercase">Amazon</span>}
                        {config.dataSource === 'youtube' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded font-bold uppercase">YouTube</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <span className="truncate">{dateRange.label}</span>
                        {config.filters.balanceEffects?.length === 1 && !config.dataSource && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-medium capitalize">
                                {config.filters.balanceEffects[0]}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setSortBy(prev => prev === 'amount' ? 'name' : 'amount')}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-white transition-colors"
                        title={`Sort by ${sortBy === 'amount' ? 'Name' : 'Amount'}`}
                    >
                        <SortIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setIsConfigModalOpen(true)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-white transition-colors"
                        title="Edit Report"
                    >
                        <EditIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => onSaveReport(config)}
                        className="p-1.5 text-slate-400 hover:text-green-600 rounded hover:bg-white transition-colors"
                        title="Save Changes to Saved Reports List"
                    >
                        <SaveIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                 {activeData.items.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400">
                         <ExclamationTriangleIcon className="w-10 h-10 mb-2 opacity-50" />
                         <p className="text-sm">No matching data.</p>
                     </div>
                 ) : (
                     <div className="space-y-6">
                         <div className="py-2">
                             <DonutChart 
                                data={activeData.visibleItems.map(i => ({ label: i.label, value: i.value, color: i.color }))}
                                total={activeData.totalValue}
                             />
                         </div>

                         <div className="space-y-1">
                             {activeData.items.map(item => {
                                 const isHidden = (config.hiddenIds || config.hiddenCategoryIds || []).includes(item.id);
                                 return (
                                     <ReportRow 
                                        key={item.id}
                                        item={item}
                                        total={activeData.totalValue}
                                        onClick={handleInspect}
                                        isHidden={isHidden}
                                        onToggleHidden={toggleHidden}
                                        expandedIds={expandedIds}
                                        onToggleExpand={toggleExpand}
                                     />
                                 );
                             })}
                         </div>
                     </div>
                 )}
            </div>

            {inspectingItems && (
                <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50" onClick={() => setInspectingItems(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-lg text-slate-800">{inspectingTitle}</h3>
                            <button onClick={() => setInspectingItems(null)} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <TransactionTable 
                                transactions={inspectingItems}
                                accounts={accounts}
                                categories={categories}
                                tags={tags}
                                transactionTypes={transactionTypes}
                                payees={payees}
                                users={users}
                                onUpdateTransaction={() => {}} 
                                onDeleteTransaction={() => {}}
                                visibleColumns={new Set(['date', 'description', 'amount', 'account'])}
                            />
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-end">
                            <button onClick={() => setInspectingItems(null)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <ReportConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                onSave={handleConfigUpdate}
                initialConfig={config}
                accounts={accounts}
                categories={categories}
                users={users}
                transactionTypes={transactionTypes}
                tags={tags}
                payees={payees}
                savedDateRanges={savedDateRanges}
                onSaveDateRange={onSaveDateRange}
                onDeleteDateRange={onDeleteDateRange}
                transactions={transactions} 
            />
        </div>
    );
};

export default ReportColumn;