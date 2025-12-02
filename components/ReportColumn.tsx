
import React, { useState, useMemo } from 'react';
import type { Transaction, Category, TransactionType, ReportConfig, DateRangePreset, Account, User, BalanceEffect, Tag, Payee, ReportGroupBy } from '../types';
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeSlashIcon, SortIcon, EditIcon, UsersIcon, TagIcon } from './Icons';
import { formatDate } from '../dateUtils';
import MultiSelect from './MultiSelect';

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

const getDateRangeFromPreset = (preset: DateRangePreset, customStart?: string, customEnd?: string): { start: Date, end: Date, label: string } => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let label = '';

    const resetTime = (d: Date, endOfDay = false) => {
        if (endOfDay) d.setHours(23, 59, 59, 999);
        else d.setHours(0, 0, 0, 0);
        return d;
    };

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
        case 'relativeMonth':
            const offset = parseInt(customStart || '1', 10);
            start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
            label = `${offset} Months Ago (${start.toLocaleString('default', { month: 'long' })})`;
            if (offset === 1) label = `Last Month (${start.toLocaleString('default', { month: 'long' })})`;
            break;
        case 'specificMonth':
            // Expects YYYY-MM
            if (customStart) {
                const parts = customStart.split('-');
                if (parts.length === 2) {
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1; // 0-indexed
                    start = new Date(year, month, 1);
                    end = new Date(year, month + 1, 0);
                    label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                } else {
                    label = 'Invalid Date';
                }
            } else {
                label = 'No Month Selected';
            }
            break;
        case 'sameMonthLastYear':
            start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
            end = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);
            label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
            break;
        case 'lastMonthPriorYear':
            start = new Date(now.getFullYear() - 1, now.getMonth() - 1, 1);
            end = new Date(now.getFullYear() - 1, now.getMonth(), 0);
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
        case 'last3Months':
            // Rolling 3 full months + current? Or just 90 days?
            // "Last 3 Months" usually implies relative rolling window
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
        case 'sameMonth2YearsAgo':
            start = new Date(now.getFullYear() - 2, now.getMonth(), 1);
            end = new Date(now.getFullYear() - 2, now.getMonth() + 1, 0);
            label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
            break;
        case 'custom':
            start = customStart ? new Date(customStart) : new Date();
            end = customEnd ? new Date(customEnd) : new Date();
            label = `${formatDate(start)} - ${formatDate(end)}`;
            break;
    }

    return { start: resetTime(start), end: resetTime(end, true), label };
};

const DonutChart: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const total = data.reduce((acc, item) => acc + item.value, 0);
    
    if (total === 0) return <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No Data</div>;

    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

    return (
        <div className="flex justify-center py-6 relative">
            <svg viewBox="-1.1 -1.1 2.2 2.2" className="h-48 w-48" style={{ transform: 'rotate(-90deg)' }}>
                {data.map((slice, i) => {
                    const startPercent = cumulativePercent;
                    const slicePercent = slice.value / total;
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
                <div className="text-center animate-fade-in px-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 truncate max-w-[120px] mx-auto">
                        {hoveredItem ? hoveredItem.name : 'Total'}
                    </p>
                    <p className="text-xl font-bold text-slate-800 tracking-tight">
                        {hoveredItem 
                            ? formatCurrency(hoveredItem.value)
                            : formatCurrency(total)
                        }
                    </p>
                    {hoveredItem && (
                        <p className="text-xs text-indigo-600 font-semibold bg-indigo-50 inline-block px-1.5 rounded-full mt-1">
                            {((hoveredItem.value / total) * 100).toFixed(1)}%
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

interface AggregationItem {
    id: string;
    name: string;
    amount: number;
    children: AggregationItem[];
    // For visual display only
    isHidden: boolean;
    type: 'group' | 'payee'; 
    // Temp storage for multi-pass aggregation
    transactions?: Transaction[]; 
}

// --- Recursive Row Component ---
const ReportRow: React.FC<{ 
    item: AggregationItem; 
    totalVisibleAmount: number; 
    onToggleVisibility: (id: string) => void;
    level?: number;
    parentIsHidden?: boolean;
}> = ({ item, totalVisibleAmount, onToggleVisibility, level = 0, parentIsHidden = false }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    
    // Effective hidden state (self or ancestor)
    const isEffectiveHidden = item.isHidden || parentIsHidden;

    // Percent of total visible (if hidden, effectively 0 for visualization)
    const percent = totalVisibleAmount !== 0 && !isEffectiveHidden 
        ? (item.amount / totalVisibleAmount) * 100 
        : 0;

    const color = item.type === 'payee' ? stringToColor(item.name) : '#6366f1'; 

    return (
        <div className={`text-sm ${isEffectiveHidden ? 'opacity-50 grayscale' : ''}`}>
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
                        <span className={`font-mono font-bold text-xs flex-shrink-0 ${isEffectiveHidden ? 'text-slate-400 line-through decoration-slate-400 decoration-2' : 'text-slate-800'}`}>
                            {formatCurrency(item.amount)}
                        </span>
                    </div>
                    {/* Bar only for top level or significant items */}
                    {(level === 0 || percent > 5) && !isEffectiveHidden && (
                        <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }}></div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(item.id); }}
                    className={`text-slate-300 hover:text-slate-500 transition-opacity flex-shrink-0 ${item.isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    title={item.isHidden ? "Show in calculation" : "Hide from calculation"}
                >
                    {item.isHidden ? <EyeSlashIcon className="w-3 h-3 text-slate-400" /> : <EyeIcon className="w-3 h-3" />}
                </button>
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
                            level={level + 1}
                            parentIsHidden={isEffectiveHidden}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};


const ReportColumn: React.FC<ReportColumnProps> = ({ config: initialConfig, transactions, categories, transactionTypes, accounts, users, tags, payees, onSaveReport }) => {
    
    // Internal state allows modifying the report on the fly without affecting the saved version until explicit save
    const [config, setConfig] = useState<ReportConfig>(initialConfig);
    const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
    const [showFilters, setShowFilters] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);

    const dateRange = useMemo(() => getDateRangeFromPreset(config.datePreset, config.customStartDate, config.customEndDate), [config.datePreset, config.customStartDate, config.customEndDate]);

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
                        // Check visibility
                        const isHidden = (config.hiddenIds && config.hiddenIds.includes(id)) || 
                                         (config.hiddenCategoryIds && config.hiddenCategoryIds.includes(id)) || false;
                        map.set(id, { id, name, amount: 0, children: [], isHidden, type, transactions: [] });
                    }
                    const item = map.get(id)!;
                    item.amount += tx.amount;
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
                    // Clear txs to free memory
                    delete item.transactions;
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

                // First pass: put all current items in map
                primaryItems.forEach(item => treeMap.set(item.id, item));

                // Second pass: assign parents
                primaryItems.forEach(item => {
                    const def = catNameMap.get(item.id);
                    if (def?.parentId) {
                        let parent = treeMap.get(def.parentId);
                        if (!parent) {
                            // Create virtual parent if it has transactions but wasn't in list (shouldn't happen with current logic) or if we just need a container
                            const parentDef = catNameMap.get(def.parentId);
                            const isHidden = (config.hiddenIds && config.hiddenIds.includes(def.parentId)) || false;
                            parent = { 
                                id: def.parentId, 
                                name: parentDef?.name || 'Unknown Parent', 
                                amount: 0, // Sum will be calculated from children
                                children: [], 
                                isHidden, 
                                type: 'group' 
                            };
                            treeMap.set(def.parentId, parent);
                            roots.push(parent); // Newly created parent is a root candidate
                        }
                        
                        // Check if item is already added to prevent dupes
                        if (!parent.children.find(c => c.id === item.id)) {
                            parent.children.push(item);
                            parent.amount += item.amount;
                        }
                        // Remove item from roots if it was there
                        const rootIdx = roots.findIndex(r => r.id === item.id);
                        if (rootIdx > -1) roots.splice(rootIdx, 1);
                    } else {
                        if (!roots.find(r => r.id === item.id)) roots.push(item);
                    }
                });
                
                // Replace primary list with tree roots
                primaryItems.splice(0, primaryItems.length, ...roots);
            } else if (primaryGroupBy === 'payee') {
                // Reconstruct Payee Tree (similar logic)
                const treeMap = new Map<string, AggregationItem>();
                const roots: AggregationItem[] = [];
                const payeeNameMap = new Map(payees.map(p => [p.id, p]));

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
                            const isHidden = (config.hiddenIds && config.hiddenIds.includes(def.parentId)) || false;
                            parent = {
                                id: def.parentId,
                                name: parentDef?.name || 'Unknown Parent',
                                amount: 0,
                                children: [],
                                isHidden,
                                type: 'payee'
                            };
                            treeMap.set(def.parentId, parent);
                            roots.push(parent);
                        }
                        if (!parent.children.find(c => c.id === item.id)) {
                            parent.children.push(item);
                            parent.amount += item.amount;
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

        // --- 4. Sorting & Total Calculation ---
        const sortFn = (a: AggregationItem, b: AggregationItem) => {
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

        // Safe Total Calculation: Re-sum from transactions to handle complex hiding logic correctly
        // (Iterating hierarchy is cleaner but prone to double counting if logic drifts)
        // We will sum the *visible* root items and their visible descendants?
        // Easier: Use the original filter pass, but add a visibility check function.
        
        let totalVisibleAmount = filtered.filter(tx => {
            // Check visibility against config.hiddenIds
            // This is complex because a transaction might be hidden because its Category is hidden, 
            // OR because its Account is hidden (if grouped by Account).
            
            // Simplified check: If the primary group key for this tx is hidden, exclude it.
            // If subGroup is on, if secondary key is hidden, exclude it.
            
            // Check Primary
            const pKeys = getKeys(tx, primaryGroupBy);
            // If any of the keys (for tags) are hidden, we might exclude? 
            // For standard 1-to-1 dims:
            if (pKeys.length === 1) {
                if (config.hiddenIds?.includes(pKeys[0].id)) return false;
                
                // Check parent visibility if using default hierarchy
                if (!config.subGroupBy && primaryGroupBy === 'category') {
                    const def = categories.find(c => c.id === pKeys[0].id);
                    if (def?.parentId && config.hiddenIds?.includes(def.parentId)) return false;
                }
                if (!config.subGroupBy && primaryGroupBy === 'payee') {
                    const def = payees.find(p => p.id === pKeys[0].id);
                    if (def?.parentId && config.hiddenIds?.includes(def.parentId)) return false;
                }
            }

            // Check Secondary
            if (config.subGroupBy) {
                const sKeys = getKeys(tx, config.subGroupBy);
                if (sKeys.length === 1) {
                    if (config.hiddenIds?.includes(sKeys[0].id)) return false;
                }
            }

            return true;
        }).reduce((sum, tx) => sum + tx.amount, 0);

        // Edge case: If grouping by Tag (many-to-many), total amount is inflated.
        // We should sum the amounts of the visible root items instead.
        if (primaryGroupBy === 'tag') {
            totalVisibleAmount = primaryItems.filter(i => !i.isHidden).reduce((sum, i) => sum + i.amount, 0);
        }

        return { rootItems: primaryItems, totalVisibleAmount };

    }, [transactions, config, dateRange, categories, transactionTypes, payees, tags, accounts, sortBy]);

    // --- Handlers ---

    const toggleVisibility = (id: string) => {
        setConfig(prev => {
            const hidden = new Set(prev.hiddenIds || []);
            // Migrate legacy hiddenCategoryIds if present
            if (prev.groupBy === 'category' || !prev.groupBy) {
                prev.hiddenCategoryIds?.forEach(hid => hidden.add(hid));
            }
            
            if (hidden.has(id)) hidden.delete(id);
            else hidden.add(id);
            
            return { 
                ...prev, 
                hiddenIds: Array.from(hidden),
                hiddenCategoryIds: [] // Clear legacy to avoid sync issues, use hiddenIds forward
            };
        });
    };

    const handleSave = () => {
        onSaveReport(config);
    };

    const toggleEffect = (effect: BalanceEffect) => {
        setConfig(prev => {
            const current = new Set<BalanceEffect>(prev.filters.balanceEffects || (['expense'] as BalanceEffect[]));
            if (current.has(effect)) current.delete(effect);
            else current.add(effect);
            return { ...prev, filters: { ...prev.filters, balanceEffects: Array.from(current) } };
        });
    };

    // Prepare Chart Data (Top 8 Visible)
    const chartData = activeData.rootItems
        .filter(i => !i.isHidden) // Don't show hidden in chart
        .slice(0, 8)
        .map((cat, i) => ({
            name: cat.name,
            value: cat.amount,
            color: COLORS[i % COLORS.length]
        }));
    
    // Add "Other"
    const otherAmount = activeData.rootItems
        .filter(i => !i.isHidden)
        .slice(8)
        .reduce((sum, cat) => sum + cat.amount, 0);
    
    if (otherAmount > 0) {
        chartData.push({ name: 'Other', value: otherAmount, color: '#cbd5e1' });
    }

    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden min-w-[320px]">
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
                    <button onClick={handleSave} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-700 font-medium">Save</button>
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
                            <div className="grid grid-cols-2 gap-2">
                                <select 
                                    value={config.datePreset} 
                                    onChange={(e) => {
                                        const newVal = e.target.value as DateRangePreset;
                                        setConfig(prev => ({
                                            ...prev, 
                                            datePreset: newVal,
                                            // Initialize dynamic fields if needed
                                            customStartDate: (newVal === 'relativeMonth' && !prev.customStartDate) ? '1' : 
                                                             (newVal === 'specificMonth' && !prev.customStartDate) ? new Date().toISOString().slice(0, 7) : 
                                                             prev.customStartDate
                                        }));
                                    }}
                                    className="text-xs p-1.5 border rounded w-full font-medium text-slate-700"
                                >
                                    <option value="thisMonth">This Month</option>
                                    <option value="lastMonth">Last Month</option>
                                    <option value="relativeMonth">Relative (N Months Ago)</option>
                                    <option value="specificMonth">Specific Month</option>
                                    <option value="last3Months">Last 90 Days</option>
                                    <option value="last6Months">Last 6 Months</option>
                                    <option value="last12Months">Last 12 Months</option>
                                    <option value="thisYear">This Year</option>
                                    <option value="lastYear">Last Year</option>
                                    <option value="lastMonthPriorYear">Last Month (Prior Year)</option>
                                    <option value="sameMonthLastYear">Same Month Last Year</option>
                                    <option value="sameMonth2YearsAgo">Same Month 2 Years Ago</option>
                                    <option value="custom">Custom Range</option>
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
                            
                            <div>
                                <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Sub-Group By</label>
                                <select 
                                    value={config.subGroupBy || ''} 
                                    onChange={(e) => setConfig({ ...config, subGroupBy: e.target.value as any })}
                                    className="text-xs p-1.5 border rounded w-full font-medium text-slate-700"
                                >
                                    <option value="">-- None --</option>
                                    <option value="category">Category</option>
                                    <option value="account">Account</option>
                                    <option value="payee">Payee</option>
                                    <option value="type">Transaction Type</option>
                                    <option value="tag">Tag</option>
                                </select>
                            </div>

                            {/* Dynamic Inputs */}
                            {config.datePreset === 'relativeMonth' && (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="60"
                                        className="text-xs p-1 border rounded w-16" 
                                        value={config.customStartDate || ''} 
                                        onChange={e => setConfig({...config, customStartDate: e.target.value})} 
                                    />
                                    <span className="text-[10px] text-slate-500">Months Ago</span>
                                </div>
                            )}

                            {config.datePreset === 'specificMonth' && (
                                <div>
                                    <input 
                                        type="month" 
                                        className="text-xs p-1 border rounded w-full" 
                                        value={config.customStartDate || ''} 
                                        onChange={e => setConfig({...config, customStartDate: e.target.value})} 
                                    />
                                </div>
                            )}
                            
                            {config.datePreset === 'custom' && (
                                <div className="flex gap-1">
                                    <input type="date" className="text-xs p-1 border rounded w-1/2" value={config.customStartDate || ''} onChange={e => setConfig({...config, customStartDate: e.target.value})} />
                                    <input type="date" className="text-xs p-1 border rounded w-1/2" value={config.customEndDate || ''} onChange={e => setConfig({...config, customEndDate: e.target.value})} />
                                </div>
                            )}
                            <MultiSelect 
                                label="Accounts" 
                                options={accounts} 
                                selectedIds={new Set(config.filters.accountIds)} 
                                onChange={(ids) => setConfig({...config, filters: { ...config.filters, accountIds: Array.from(ids) }})}
                                className="text-xs"
                            />
                            <MultiSelect 
                                label="Users" 
                                options={users} 
                                selectedIds={new Set(config.filters.userIds)} 
                                onChange={(ids) => setConfig({...config, filters: { ...config.filters, userIds: Array.from(ids) }})}
                                className="text-xs"
                            />
                            <MultiSelect 
                                label="Categories" 
                                options={categories} 
                                selectedIds={new Set(config.filters.categoryIds)} 
                                onChange={(ids) => setConfig({...config, filters: { ...config.filters, categoryIds: Array.from(ids) }})}
                                className="text-xs"
                            />
                            <MultiSelect 
                                label="Types" 
                                options={transactionTypes} 
                                selectedIds={new Set(config.filters.typeIds)} 
                                onChange={(ids) => setConfig({...config, filters: { ...config.filters, typeIds: Array.from(ids) }})}
                                className="text-xs"
                            />
                            <MultiSelect 
                                label="Tags" 
                                options={tags} 
                                selectedIds={new Set(config.filters.tagIds)} 
                                onChange={(ids) => setConfig({...config, filters: { ...config.filters, tagIds: Array.from(ids) }})}
                                className="text-xs"
                            />
                            <MultiSelect 
                                label="Payees" 
                                options={payees} 
                                selectedIds={new Set(config.filters.payeeIds)} 
                                onChange={(ids) => setConfig({...config, filters: { ...config.filters, payeeIds: Array.from(ids) }})}
                                className="text-xs"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="text-center mb-6">
                    <DonutChart data={chartData} />
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
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReportColumn;
