
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, Category, TransactionType, ReportConfig, DateRangePreset, Account, User, BalanceEffect, Tag, Payee, ReportGroupBy, CustomDateRange, DateRangeUnit } from '../types';
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeSlashIcon, SortIcon, EditIcon, TableIcon, CloseIcon, SettingsIcon, DownloadIcon } from './Icons';
import { formatDate } from '../dateUtils';
import MultiSelect from './MultiSelect';
import TransactionTable from './TransactionTable';
import ReportConfigModal from './ReportConfigModal';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
    savedDateRanges: CustomDateRange[];
    onSaveDateRange: (range: CustomDateRange) => void;
    onDeleteDateRange: (id: string) => void;
}

const COLORS = ['#4f46e5', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1'];

// Helper to generate consistent color from string
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

const applyOffset = (date: Date, value: number, unit: DateRangeUnit) => {
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

const calculateDateRange = (preset: DateRangePreset, customStart: string | undefined, customEnd: string | undefined, savedRanges: CustomDateRange[]): { start: Date, end: Date, label: string } => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let label = '';

    const resetTime = (d: Date, endOfDay = false) => {
        if (endOfDay) d.setHours(23, 59, 59, 999);
        else d.setHours(0, 0, 0, 0);
        return d;
    };

    // Check if preset matches a saved custom range ID
    const customRange = savedRanges.find(r => r.id === preset);

    if (customRange) {
        label = customRange.name;
        const val = customRange.value;
        const unit = customRange.unit;
        
        if (customRange.type === 'fixed_period') {
            // Fixed Period: Define an anchor date based on offsets, then window around it based on unit
            let anchor = new Date(now);
            
            if (customRange.offsets && customRange.offsets.length > 0) {
                // New multi-offset logic
                customRange.offsets.forEach(offset => {
                    anchor = applyOffset(anchor, offset.value, offset.unit);
                });
            } else {
                // Legacy single offset logic
                anchor = applyOffset(anchor, val, unit);
            }

            // Determine Start/End based on the Window Unit (customRange.unit)
            if (unit === 'day') {
                start = new Date(anchor);
                end = new Date(anchor);
            } else if (unit === 'week') {
                // Standardize on Week starting Sunday
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
            // Rolling Window ("Last 3 months")
            end = new Date(); // Ends today
            start = new Date();
            
            start = applyOffset(start, val, unit);
        }
    } else {
        // Fallback to legacy presets or standard ones not yet migrated
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
            case 'custom':
                start = customStart ? new Date(customStart) : new Date();
                end = customEnd ? new Date(customEnd) : new Date();
                label = `${formatDate(start)} - ${formatDate(end)}`;
                break;
            // Legacy handling for old presets if they exist in DB
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
                // Specific month fallback (YYYY-MM)
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

// Replaced chartData prop with items directly to support child inspection
const DonutChart: React.FC<{ items: AggregationItem[], forwardedRef?: React.Ref<HTMLDivElement> }> = ({ items, forwardedRef }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    
    // Process items for chart: filter visible, take top 8, aggregate others
    const totalVisible = items.reduce((acc, item) => acc + (item.visibleAmount || 0), 0);
    
    // Sort logic is handled by parent, but ensure we filter zero amounts
    const chartData = useMemo(() => {
        const visibleItems = items.filter(i => (i.visibleAmount || 0) > 0);
        
        // Take top 8
        const topItems = visibleItems.slice(0, 8).map((item, i) => ({
            ...item,
            color: COLORS[i % COLORS.length]
        }));
        
        // Sum the rest as 'Other'
        const otherAmount = visibleItems.slice(8).reduce((sum, item) => sum + (item.visibleAmount || 0), 0);
        
        if (otherAmount > 0) {
            topItems.push({
                id: 'other',
                name: 'Other',
                visibleAmount: otherAmount,
                amount: otherAmount,
                children: [],
                isHidden: false,
                type: 'group',
                color: '#cbd5e1'
            });
        }
        return topItems;
    }, [items]);

    if (totalVisible <= 0.001) return <div ref={forwardedRef} className="h-48 flex items-center justify-center text-slate-400 text-sm">No Data</div>;

    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    // Safe access to hovered item
    const hoveredItem = (hoveredIndex !== null && chartData[hoveredIndex]) ? chartData[hoveredIndex] : null;
    
    // Determine children to show in center
    const breakdown = useMemo(() => {
        if (!hoveredItem || !hoveredItem.children || hoveredItem.children.length === 0) return [];
        // Sort children by visibleAmount descending
        return [...hoveredItem.children]
            .filter(c => (c.visibleAmount || 0) > 0)
            .sort((a,b) => (b.visibleAmount || 0) - (a.visibleAmount || 0))
            .slice(0, 3);
    }, [hoveredItem]);

    return (
        <div ref={forwardedRef} className="flex justify-center py-6 relative bg-white">
            {/* ViewBox enlarged to prevent cutoff on scale transform */}
            <svg viewBox="-1.25 -1.25 2.5 2.5" className="h-48 w-48" style={{ transform: 'rotate(-90deg)' }}>
                {chartData.map((slice, i) => {
                    const startPercent = cumulativePercent;
                    const slicePercent = slice.visibleAmount / totalVisible;
                    
                    // Safety check for invalid math
                    if (!Number.isFinite(slicePercent) || slicePercent < 0) return null;

                    cumulativePercent += slicePercent;
                    const endPercent = cumulativePercent;

                    if (slicePercent > 0.999) {
                        return <circle key={i} cx="0" cy="0" r="1" fill={slice.color} />;
                    }

                    const [startX, startY] = getCoordinatesForPercent(startPercent);
                    const [endX, endY] = getCoordinatesForPercent(endPercent);
                    const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

                    const pathData = [
                        `M ${startX} ${startY}`,
                        `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                        `L 0 0`,
                    ].join(' ');

                    const isHovered = hoveredIndex === i;
                    const isDimmed = hoveredIndex !== null && !isHovered;

                    return (
                        <path 
                            key={i} 
                            d={pathData} 
                            fill={slice.color} 
                            stroke="white" 
                            strokeWidth="0.02"
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            className="transition-all duration-300 ease-out cursor-pointer origin-center"
                            style={{ 
                                opacity: isDimmed ? 0.5 : 1,
                                transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                            }}
                        />
                    );
                })}
                <circle cx="0" cy="0" r="0.65" fill="white" pointerEvents="none" />
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                <div className="text-center animate-fade-in px-2 w-32">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 truncate mx-auto">
                        {hoveredItem ? hoveredItem.name : 'Total'}
                    </p>
                    <p className="text-xl font-bold text-slate-800 tracking-tight leading-none mb-1">
                        {hoveredItem 
                            ? formatCurrency(hoveredItem.visibleAmount)
                            : formatCurrency(totalVisible)
                        }
                    </p>
                    
                    {/* Hover Breakdown Logic */}
                    {hoveredItem && breakdown.length > 0 ? (
                        <div className="mt-1 border-t border-slate-100 pt-1">
                            {breakdown.map((child, idx) => (
                                <div key={idx} className="flex justify-between text-[9px] w-full gap-2">
                                    <span className="truncate text-slate-500 max-w-[60px]">{child.name}</span>
                                    <span className="font-medium text-slate-700">{formatCurrency(child.visibleAmount)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        hoveredItem && (
                            <p className="text-xs text-indigo-600 font-semibold bg-indigo-50 inline-block px-1.5 rounded-full">
                                {((hoveredItem.visibleAmount / totalVisible) * 100).toFixed(1)}%
                            </p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

interface AggregationItem {
    id: string;
    name: string;
    // raw sum of everything (hidden or not)
    amount: number;
    // dynamic sum of visible children + self (if visible)
    visibleAmount: number;
    children: AggregationItem[];
    isHidden: boolean;
    type: 'group' | 'payee'; 
    transactions?: Transaction[]; 
    color?: string; // added for chart data compatibility
}

// --- Recursive Row Component ---
const ReportRow: React.FC<{ 
    item: AggregationItem; 
    totalVisibleAmount: number; 
    onToggleVisibility: (id: string) => void;
    onInspect: (item: AggregationItem) => void;
    level?: number;
}> = ({ item, totalVisibleAmount, onToggleVisibility, onInspect, level = 0 }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    
    // Percent of total visible
    let percent = 0;
    if (totalVisibleAmount > 0 && item.visibleAmount > 0) {
        percent = (item.visibleAmount / totalVisibleAmount) * 100;
    }
    // Safety clamp
    if (!Number.isFinite(percent)) percent = 0;

    const color = item.type === 'payee' ? stringToColor(item.name) : '#6366f1'; 
    const isZeroAndHidden = item.visibleAmount === 0 && item.isHidden;

    return (
        <div className={`text-sm ${item.isHidden ? 'opacity-60' : ''}`}>
            {/* Row Content */}
            <div className={`flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg group transition-colors ${level > 0 ? 'ml-3 border-l-2 border-slate-100 pl-2' : ''}`}>
                {item.children.length > 0 ? (
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-slate-400 hover:text-indigo-600 flex-shrink-0">
                        {isCollapsed ? <ChevronRightIcon className="w-3 h-3"/> : <ChevronDownIcon className="w-3 h-3"/>}
                    </button>
                ) : <div className="w-3 flex-shrink-0" />}
                
                <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {item.type === 'payee' && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></div>}
                            <span className={`font-medium truncate text-xs ${item.type === 'payee' ? 'text-slate-600' : 'text-slate-800'}`} title={item.name}>{item.name}</span>
                        </div>
                        {/* Only show amount if visible > 0 */}
                        <span className={`font-mono font-bold text-xs flex-shrink-0 ${isZeroAndHidden ? 'invisible' : 'text-slate-800'}`}>
                            {formatCurrency(item.visibleAmount)}
                        </span>
                    </div>
                    {/* Bar only if item is visible (or has visible children) */}
                    {(level === 0 || percent > 5) && !isZeroAndHidden && (
                        <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }}></div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onInspect(item); }}
                        className="text-slate-300 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                        title="View Transactions"
                    >
                        <TableIcon className="w-3 h-3" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(item.id); }}
                        className={`text-slate-300 hover:text-slate-500 p-1 rounded hover:bg-slate-100 ${item.isHidden ? 'opacity-100 text-slate-500' : ''}`}
                        title={item.isHidden ? "Show in calculation" : "Hide from calculation"}
                    >
                        {item.isHidden ? <EyeSlashIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                    </button>
                </div>
            </div>

            {/* Recursive Children */}
            {!isCollapsed && item.children.length > 0 && (
                <div>
                    {item.children.map(sub => (
                        <ReportRow 
                            key={sub.id} 
                            item={sub} 
                            totalVisibleAmount={totalVisibleAmount} 
                            onToggleVisibility={onToggleVisibility} 
                            onInspect={onInspect}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};


const ReportColumn: React.FC<ReportColumnProps> = ({ config: initialConfig, transactions, categories, transactionTypes, accounts, users, tags, payees, onSaveReport, savedDateRanges, onSaveDateRange, onDeleteDateRange }) => {
    
    const [config, setConfig] = useState<ReportConfig>(initialConfig);
    const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
    const [showFilters, setShowFilters] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    
    // Modal State
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    
    // Inspection State
    const [inspectingItems, setInspectingItems] = useState<Transaction[] | null>(null);
    const [inspectingTitle, setInspectingTitle] = useState('');

    // Export Menu
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    
    // Reference to chart for PDF capture
    const chartContainerRef = useRef<HTMLDivElement>(null);

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const dateRange = useMemo(() => 
        calculateDateRange(config.datePreset, config.customStartDate, config.customEndDate, savedDateRanges), 
    [config.datePreset, config.customStartDate, config.customEndDate, savedDateRanges]);

    // Helper to extract keys for a transaction based on dimension
    const getKeys = (tx: Transaction, dimension: ReportGroupBy): { id: string, name: string, type: 'group' | 'payee' }[] => {
        switch (dimension) {
            case 'category':
                const cat = categories.find(c => c.id === tx.categoryId);
                return [{ id: tx.categoryId, name: cat?.name || 'Uncategorized', type: 'group' }];
            case 'account':
                const acc = accounts.find(a => a.id === tx.accountId);
                return [{ id: tx.accountId || 'no-account', name: acc?.name || 'Unknown Account', type: 'group' }];
            case 'payee':
                const payee = payees.find(p => p.id === tx.payeeId);
                return [{ id: tx.payeeId || 'no-payee', name: payee?.name || 'No Payee', type: 'payee' }];
            case 'type':
                const type = transactionTypes.find(t => t.id === tx.typeId);
                return [{ id: tx.typeId, name: type?.name || 'Unknown Type', type: 'group' }];
            case 'tag':
                if (!tx.tagIds || tx.tagIds.length === 0) {
                    return [{ id: 'no-tag', name: 'No Tags', type: 'group' }];
                }
                return tx.tagIds.map(tId => {
                    const tag = tags.find(t => t.id === tId);
                    return { id: tId, name: tag?.name || 'Unknown Tag', type: 'group' };
                });
            default:
                return [{ id: 'unknown', name: 'Unknown', type: 'group' }];
        }
    };

    const activeData = useMemo(() => {
        const allowedEffects = new Set(config.filters.balanceEffects || ['expense']); 
        
        // --- 1. Filter Transactions ---
        const filtered = transactions.filter(tx => {
            if (tx.isParent) return false;

            const txDate = new Date(tx.date);
            if (txDate < dateRange.start || txDate > dateRange.end) return false;

            if (config.filters.accountIds && config.filters.accountIds.length > 0 && !config.filters.accountIds.includes(tx.accountId || '')) return false;
            if (config.filters.userIds && config.filters.userIds.length > 0 && !config.filters.userIds.includes(tx.userId || '')) return false;
            if (config.filters.categoryIds && config.filters.categoryIds.length > 0 && !config.filters.categoryIds.includes(tx.categoryId)) return false;
            if (config.filters.typeIds && config.filters.typeIds.length > 0 && !config.filters.typeIds.includes(tx.typeId)) return false;
            
            if (config.filters.tagIds && config.filters.tagIds.length > 0) {
                if (!tx.tagIds || !tx.tagIds.some(tId => config.filters.tagIds!.includes(tId))) return false;
            }

            if (config.filters.payeeIds && config.filters.payeeIds.length > 0) {
                if (!config.filters.payeeIds.includes(tx.payeeId || '')) return false;
            }
            
            // Special Logic: If grouping by Payee, exclude transactions without a Payee to avoid "No Payee" noise
            if (config.groupBy === 'payee' && !tx.payeeId) return false;
            
            const type = transactionTypes.find(t => t.id === tx.typeId);
            if (!type || !allowedEffects.has(type.balanceEffect)) return false; 

            return true;
        });

        // --- 2. Generic Grouping Engine ---
        const buildGroups = (txs: Transaction[], dimension: ReportGroupBy): AggregationItem[] => {
            const map = new Map<string, AggregationItem>();
            
            txs.forEach(tx => {
                const keys = getKeys(tx, dimension);
                keys.forEach(({id, name, type}) => {
                    if (!map.has(id)) {
                        // Check visibility based on ID blacklist
                        // Migration: combine hiddenIds and hiddenCategoryIds with safe fallbacks
                        const allHidden = new Set([...(config.hiddenIds || []), ...(config.hiddenCategoryIds || [])]);
                        const isHidden = allHidden.has(id);
                        map.set(id, { id, name, amount: 0, visibleAmount: 0, children: [], isHidden, type, transactions: [] });
                    }
                    const item = map.get(id)!;
                    item.amount += tx.amount; // Total sum of EVERYTHING (for structure)
                    item.transactions?.push(tx);
                });
            });
            return Array.from(map.values());
        };

        const primaryGroupBy = config.groupBy || 'category';
        const primaryItems = buildGroups(filtered, primaryGroupBy);

        // --- 3. Sub-Grouping or Hierarchy Building ---
        
        // Case A: Explicit Sub-Grouping (User selected "Then Group By")
        if (config.subGroupBy) {
            primaryItems.forEach(item => {
                if (item.transactions && item.transactions.length > 0) {
                    item.children = buildGroups(item.transactions, config.subGroupBy!);
                }
            });
        } 
        // Case B: No Sub-Grouping, use default Hierarchies (Category Tree, Payee Tree)
        else {
            if (primaryGroupBy === 'category') {
                // Reconstruct Category Tree
                const treeMap = new Map<string, AggregationItem>();
                const roots: AggregationItem[] = [];
                const catNameMap = new Map(categories.map(c => [c.id, c]));
                const allHidden = new Set([...(config.hiddenIds || []), ...(config.hiddenCategoryIds || [])]);

                primaryItems.forEach(item => treeMap.set(item.id, item));

                primaryItems.forEach(item => {
                    const def = catNameMap.get(item.id);
                    if (def?.parentId) {
                        let parent = treeMap.get(def.parentId);
                        if (!parent) {
                            const parentDef = catNameMap.get(def.parentId);
                            const isHidden = allHidden.has(def.parentId);
                            parent = { 
                                id: def.parentId, 
                                name: parentDef?.name || 'Unknown Parent', 
                                amount: 0,
                                visibleAmount: 0, 
                                children: [], 
                                isHidden, 
                                type: 'group', 
                                transactions: [] 
                            };
                            treeMap.set(def.parentId, parent);
                            roots.push(parent); 
                        }
                        
                        if (!parent.children.find(c => c.id === item.id)) {
                            parent.children.push(item);
                            parent.amount += item.amount;
                            if (item.transactions) {
                                parent.transactions = (parent.transactions || []).concat(item.transactions);
                            }
                        }
                        const rootIdx = roots.findIndex(r => r.id === item.id);
                        if (rootIdx > -1) roots.splice(rootIdx, 1);
                    } else {
                        if (!roots.find(r => r.id === item.id)) roots.push(item);
                    }
                });
                primaryItems.splice(0, primaryItems.length, ...roots);
            } else if (primaryGroupBy === 'payee') {
                // Reconstruct Payee Tree
                const treeMap = new Map<string, AggregationItem>();
                const roots: AggregationItem[] = [];
                const payeeNameMap = new Map(payees.map(p => [p.id, p]));
                const allHidden = new Set([...(config.hiddenIds || []), ...(config.hiddenCategoryIds || [])]);

                primaryItems.forEach(item => treeMap.set(item.id, item));

                primaryItems.forEach(item => {
                    if (item.id === 'no-payee') {
                        if (!roots.find(r => r.id === item.id)) roots.push(item);
                        return;
                    }
                    const def = payeeNameMap.get(item.id);
                    if (def?.parentId) {
                        let parent = treeMap.get(def.parentId);
                        if (!parent) {
                            const parentDef = payeeNameMap.get(def.parentId);
                            const isHidden = allHidden.has(def.parentId);
                            parent = {
                                id: def.parentId,
                                name: parentDef?.name || 'Unknown Parent',
                                amount: 0,
                                visibleAmount: 0,
                                children: [],
                                isHidden,
                                type: 'payee',
                                transactions: []
                            };
                            treeMap.set(def.parentId, parent);
                            roots.push(parent);
                        }
                        if (!parent.children.find(c => c.id === item.id)) {
                            parent.children.push(item);
                            parent.amount += item.amount;
                            if (item.transactions) {
                                parent.transactions = (parent.transactions || []).concat(item.transactions);
                            }
                        }
                        const rootIdx = roots.findIndex(r => r.id === item.id);
                        if (rootIdx > -1) roots.splice(rootIdx, 1);
                    } else {
                        if (!roots.find(r => r.id === item.id)) roots.push(item);
                    }
                });
                primaryItems.splice(0, primaryItems.length, ...roots);
            }
        }

        // --- 4. Recursive Visibility Calculation ---
        // Calculate visibleAmount bottom-up. 
        
        const calculateVisibility = (node: AggregationItem): number => {
            const childrenTotal = node.children.reduce((sum, c) => sum + c.amount, 0);
            const directAmount = node.amount - childrenTotal;
            
            // Calculate visible sum of children
            const childrenVisibleSum = node.children.reduce((sum, c) => sum + calculateVisibility(c), 0);
            
            // Calculate own visible amount
            // If the node itself is hidden, its direct transactions are hidden.
            const ownVisible = node.isHidden ? 0 : directAmount;
            
            // Total Visible for this node = Own Visible + Visible Children
            // The constraint "parent shows total of only visible children" is satisfied here.
            node.visibleAmount = ownVisible + childrenVisibleSum;
            
            return node.visibleAmount;
        };

        primaryItems.forEach(root => calculateVisibility(root));

        // --- 5. Sorting ---
        const sortFn = (a: AggregationItem, b: AggregationItem) => {
            // Sort by total amount (including hidden) to maintain stable order when toggling visibility
            if (sortBy === 'amount') return b.amount - a.amount;
            return a.name.localeCompare(b.name);
        };

        const sortRecursive = (items: AggregationItem[]) => {
            items.sort(sortFn);
            items.forEach(i => {
                if (i.children.length > 0) sortRecursive(i.children);
            });
        };
        sortRecursive(primaryItems);

        const totalVisibleAmount = primaryItems.reduce((sum, i) => sum + (i.visibleAmount || 0), 0);

        return { rootItems: primaryItems, totalVisibleAmount };

    }, [transactions, config, dateRange, categories, transactionTypes, payees, tags, accounts, sortBy]);

    // --- Handlers ---

    // Helper to get all descendant IDs for bulk toggling
    const getAllDescendants = (id: string): string[] => {
        const results: string[] = [];
        const findChildren = (parentId: string, items: any[]) => {
            const children = items.filter(i => i.parentId === parentId);
            children.forEach(c => {
                results.push(c.id);
                findChildren(c.id, items);
            });
        };
        // We only support this for Category and Payee groupings
        if (config.groupBy === 'category') findChildren(id, categories);
        else if (config.groupBy === 'payee') findChildren(id, payees);
        
        return results;
    };

    const toggleVisibility = (id: string) => {
        setConfig(prev => {
            const hidden = new Set(prev.hiddenIds || []);
            // Migrate legacy
            if (prev.groupBy === 'category' || !prev.groupBy) {
                prev.hiddenCategoryIds?.forEach(hid => hidden.add(hid));
            }

            const isCurrentlyHidden = hidden.has(id);
            const descendants = getAllDescendants(id);
            const idsToToggle = [id, ...descendants];

            if (isCurrentlyHidden) {
                // Show: Remove all from hidden
                idsToToggle.forEach(i => hidden.delete(i));
            } else {
                // Hide: Add all to hidden
                idsToToggle.forEach(i => hidden.add(i));
            }
            
            return { 
                ...prev, 
                hiddenIds: Array.from(hidden),
                hiddenCategoryIds: [] 
            };
        });
    };

    const handleInspect = (item: AggregationItem) => {
        if (item.transactions && item.transactions.length > 0) {
            setInspectingItems(item.transactions);
            setInspectingTitle(`${item.name} Transactions`);
        } else {
            alert("No transactions directly linked to this item.");
        }
    };

    const handleSave = () => {
        onSaveReport(config);
    };

    const handleConfigUpdate = (newConfig: ReportConfig) => {
        setConfig(newConfig);
        setIsConfigModalOpen(false);
    };

    const toggleEffect = (effect: BalanceEffect) => {
        setConfig(prev => {
            const current = new Set<BalanceEffect>(prev.filters.balanceEffects || (['expense'] as BalanceEffect[]));
            if (current.has(effect)) current.delete(effect);
            else current.add(effect);
            return { ...prev, filters: { ...prev.filters, balanceEffects: Array.from(current) } };
        });
    };

    // --- Data Export Utilities ---
    const getExportRows = () => {
        const rows: { name: string, amount: number, depth: number, rawName: string }[] = [];
        
        const traverse = (item: AggregationItem, depth: number) => {
            rows.push({
                name: "  ".repeat(depth) + item.name,
                amount: item.visibleAmount || 0,
                depth,
                rawName: item.name
            });
            // Sort by visible amount desc
            const sortedChildren = [...item.children].sort((a,b) => (b.visibleAmount || 0) - (a.visibleAmount || 0));
            sortedChildren.forEach(child => traverse(child, depth + 1));
        };

        // Sort roots
        const sortedRoots = [...activeData.rootItems].sort((a,b) => (b.visibleAmount || 0) - (a.visibleAmount || 0));
        sortedRoots.forEach(item => traverse(item, 0));
        return rows;
    };

    const handleExportPDF = async () => {
        setIsExportMenuOpen(false);
        const doc = new jsPDF();
        const rows = getExportRows();
        
        // Capture Chart
        let chartImgData: string | null = null;
        if (chartContainerRef.current) {
            try {
                // Ensure white background for the capture
                const chartCanvas = await html2canvas(chartContainerRef.current, {
                    backgroundColor: '#ffffff',
                    scale: 2
                } as any); // Cast to any to avoid TS error about backgroundColor
                chartImgData = chartCanvas.toDataURL('image/png');
            } catch (e) {
                console.warn("Failed to capture chart for PDF", e);
            }
        }

        // Header
        doc.setFontSize(18);
        doc.text(config.name, 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26);
        doc.text(`Period: ${dateRange.label}`, 14, 31);
        doc.text(`Total: ${formatCurrency(activeData.totalVisibleAmount)}`, 14, 36);
        
        let y = 45;
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 14;
        
        // Inject Chart if available
        if (chartImgData) {
            // Keep aspect ratio roughly square-ish, center it
            const chartSize = 80; 
            const x = (pageWidth - chartSize) / 2;
            doc.addImage(chartImgData, 'PNG', x, y, chartSize, chartSize);
            y += chartSize + 10;
        }

        doc.setTextColor(0);
        
        // Table Header
        if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 4, pageWidth - (margin * 2), 6, 'F');
        doc.setFont("helvetica", "bold");
        doc.text("Category / Item", margin + 2, y);
        doc.text("Amount", pageWidth - margin - 2, y, { align: 'right' });
        y += 8;
        doc.setFont("helvetica", "normal");

        rows.forEach(row => {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
            }
            
            const x = margin + (row.depth * 4);
            
            // Bold top level items
            if (row.depth === 0) doc.setFont("helvetica", "bold");
            else doc.setFont("helvetica", "normal");
            
            doc.text(row.rawName, x, y);
            
            // Align Amount
            if (row.depth === 0) doc.setFont("helvetica", "bold");
            else doc.setFont("helvetica", "normal");
            
            doc.text(formatCurrency(row.amount), pageWidth - margin, y, { align: 'right' });
            
            // Add spacing after top-level groups
            if (row.depth === 0 && y < pageHeight - 20) {
                 y += 2;
            }
            
            y += 6;
        });
        
        doc.save(`${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`);
    };

    const handleExportCSV = () => {
        const rows = getExportRows();
        const csvRows = [["Name", "Level", "Amount"]];
        
        rows.forEach(row => {
            csvRows.push([
                `"${row.rawName.replace(/"/g, '""')}"`,
                row.depth.toString(),
                row.amount.toFixed(2)
            ]);
        });
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + csvRows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_data.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportMenuOpen(false);
    };

    const handleExportPNG = async () => {
        if (!reportRef.current) return;
        setIsExportMenuOpen(false);
        try {
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: '#ffffff',
                scale: 2
            } as any);
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
            link.href = imgData;
            link.click();
        } catch (e) {
            console.error(e);
            alert("Export failed");
        }
    };

    return (
        <div ref={reportRef} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden min-w-[320px] relative">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-grow min-w-0 pr-2">
                        {isEditingName ? (
                            <input 
                                type="text" 
                                value={config.name} 
                                onChange={e => setConfig({...config, name: e.target.value})} 
                                onBlur={() => setIsEditingName(false)}
                                autoFocus
                                className="w-full text-lg font-bold text-slate-800 bg-transparent border-b border-indigo-50 focus:outline-none"
                            />
                        ) : (
                            <h3 
                                className="font-bold text-slate-800 text-lg truncate cursor-pointer hover:text-indigo-600 flex items-center gap-2" 
                                onClick={() => setIsEditingName(true)}
                                title="Click to rename"
                            >
                                {config.name} <EditIcon className="w-3 h-3 text-slate-400 opacity-50" />
                            </h3>
                        )}
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                            {dateRange.label} • {config.groupBy ? config.groupBy.charAt(0).toUpperCase() + config.groupBy.slice(1) : 'Category'}
                            {config.subGroupBy ? ` → ${config.subGroupBy.charAt(0).toUpperCase() + config.subGroupBy.slice(1)}` : ''}
                        </p>
                    </div>
                    <div className="flex gap-1 items-center relative">
                        <div className="relative" ref={exportMenuRef}>
                            <button 
                                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200 transition-colors"
                                title="Export Report"
                            >
                                <DownloadIcon className="w-4 h-4" />
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden">
                                    <button 
                                        onClick={handleExportPNG}
                                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                                    >
                                        Download Image (PNG)
                                    </button>
                                    <button 
                                        onClick={handleExportPDF}
                                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100"
                                    >
                                        Download Report (PDF)
                                    </button>
                                    <button 
                                        onClick={handleExportCSV}
                                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100"
                                    >
                                        Download Data (CSV)
                                    </button>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => setIsConfigModalOpen(true)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Configure Report Settings"
                        >
                            <SettingsIcon className="w-4 h-4" />
                        </button>
                        <button onClick={handleSave} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-700 font-medium ml-1">Save</button>
                    </div>
                </div>
                
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-1">
                            {(['income', 'expense', 'investment'] as BalanceEffect[]).map(eff => (
                                <button
                                    key={eff}
                                    onClick={() => toggleEffect(eff)}
                                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border transition-colors ${config.filters.balanceEffects?.includes(eff) ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-400 border-slate-200 opacity-60'}`}
                                >
                                    {eff.slice(0,3)}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                        >
                            <SortIcon className="w-3 h-3" /> Filters
                        </button>
                    </div>

                    {showFilters && (
                        <div className="space-y-2 pt-2 animate-slide-down border-t border-slate-200 mt-2">
                            {/* Shortened filter list for inline use */}
                            <div className="grid grid-cols-2 gap-2">
                                <select 
                                    value={config.datePreset} 
                                    onChange={(e) => {
                                        const newVal = e.target.value as DateRangePreset;
                                        setConfig(prev => ({
                                            ...prev, 
                                            datePreset: newVal,
                                            customStartDate: (newVal === 'specificMonth' && !prev.customStartDate) ? new Date().toISOString().slice(0, 7) : prev.customStartDate
                                        }));
                                    }}
                                    className="text-xs p-1.5 border rounded w-full font-medium text-slate-700"
                                >
                                    <option value="thisMonth">This Month</option>
                                    <option value="lastMonth">Last Month</option>
                                    <option value="thisYear">This Year</option>
                                    <option value="lastYear">Last Year</option>
                                    {savedDateRanges.length > 0 && (
                                        <optgroup label="My Custom Ranges">
                                            {savedDateRanges.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <select 
                                    value={config.groupBy || 'category'} 
                                    onChange={(e) => setConfig({ ...config, groupBy: e.target.value as ReportGroupBy })}
                                    className="text-xs p-1.5 border rounded w-full font-medium text-slate-700"
                                >
                                    <option value="category">Category</option>
                                    <option value="account">Account</option>
                                    <option value="payee">Payee</option>
                                    <option value="type">Type</option>
                                    <option value="tag">Tag</option>
                                </select>
                            </div>
                            
                            <MultiSelect 
                                label="Categories" 
                                options={categories} 
                                selectedIds={new Set(config.filters.categoryIds)} 
                                onChange={(ids) => setConfig({...config, filters: { ...config.filters, categoryIds: Array.from(ids) }})}
                                className="text-xs"
                            />
                            
                            <button 
                                onClick={() => setIsConfigModalOpen(true)}
                                className="w-full text-center text-xs text-indigo-600 hover:underline pt-1"
                            >
                                Advanced Filters & Settings...
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="text-center mb-6">
                    {/* Pass the full items hierarchy to DonutChart */}
                    <DonutChart items={activeData.rootItems} forwardedRef={chartContainerRef} />
                </div>

                {/* Sort Bar */}
                <div className="flex justify-end gap-2 mb-2 text-[10px] uppercase font-bold text-slate-400">
                    <button onClick={() => setSortBy('amount')} className={sortBy === 'amount' ? 'text-indigo-600' : 'hover:text-slate-600'}>Amount</button>
                    <span>/</span>
                    <button onClick={() => setSortBy('name')} className={sortBy === 'name' ? 'text-indigo-600' : 'hover:text-slate-600'}>Name</button>
                </div>

                {/* List using Recursive Row */}
                <div className="space-y-1 pb-4">
                    {activeData.rootItems.map(item => (
                        <ReportRow 
                            key={item.id} 
                            item={item} 
                            totalVisibleAmount={activeData.totalVisibleAmount} 
                            onToggleVisibility={toggleVisibility}
                            onInspect={handleInspect}
                        />
                    ))}
                </div>
            </div>

            {/* Inspection Modal */}
            {inspectingItems && (
                <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50" onClick={() => setInspectingItems(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">{inspectingTitle}</h3>
                            <button onClick={() => setInspectingItems(null)} className="p-1 rounded-full hover:bg-slate-200">
                                <CloseIcon className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
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
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
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
            />
        </div>
    );
};

export default ReportColumn;
