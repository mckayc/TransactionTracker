
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
            end = new Date();
            start = new Date();
            start.setDate(now.getDate() - 90);
            label = 'Last 90 Days';
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
    const total = data.reduce((acc, item) => acc + item.value, 0);
    let cumulativePercent = 0;

    if (total === 0) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No Data</div>;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    return (
        <div className="flex justify-center py-4">
            <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="h-40 w-40">
                {data.map((slice, i) => {
                    const startPercent = cumulativePercent;
                    const slicePercent = slice.value / total;
                    cumulativePercent += slicePercent;
                    const endPercent = cumulativePercent;

                    // Handle full circle case
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

                    return <path key={i} d={pathData} fill={slice.color} stroke="white" strokeWidth="0.02" />;
                })}
                <circle cx="0" cy="0" r="0.6" fill="white" />
            </svg>
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
    // Temp storage for calculating payee breakdown
    payeeStats?: Map<string, number>;
    type: 'group' | 'payee'; // To distinguish visual rendering
}

const ReportColumn: React.FC<ReportColumnProps> = ({ config: initialConfig, transactions, categories, transactionTypes, accounts, users, tags, payees, onSaveReport }) => {
    
    // Internal state allows modifying the report on the fly without affecting the saved version until explicit save
    const [config, setConfig] = useState<ReportConfig>(initialConfig);
    const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
    const [showFilters, setShowFilters] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);

    const dateRange = useMemo(() => getDateRangeFromPreset(config.datePreset, config.customStartDate, config.customEndDate), [config.datePreset, config.customStartDate, config.customEndDate]);

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

        // --- 2. Aggregation Logic based on GroupBy ---
        const aggregationMap = new Map<string, AggregationItem>();
        
        // Helper to get or create aggregate item
        const getAggItem = (id: string, name: string): AggregationItem => {
            if (!aggregationMap.has(id)) {
                // Check if this ID is in the hidden list (either modern hiddenIds or legacy hiddenCategoryIds)
                const isHidden = (config.hiddenIds && config.hiddenIds.includes(id)) || 
                                 (config.hiddenCategoryIds && config.hiddenCategoryIds.includes(id)) || false;
                aggregationMap.set(id, { id, name, amount: 0, children: [], isHidden, type: 'group' });
            }
            return aggregationMap.get(id)!;
        };

        const groupBy = config.groupBy || 'category';

        if (groupBy === 'category') {
            const catNameMap = new Map(categories.map(c => [c.id, c]));
            filtered.forEach(tx => {
                const catDef = catNameMap.get(tx.categoryId);
                if (!catDef) return;
                const agg = getAggItem(tx.categoryId, catDef.name);
                agg.amount += tx.amount;
                
                // Collect Payee data for drilldown
                const payeeId = tx.payeeId || 'no-payee';
                if (!agg.payeeStats) agg.payeeStats = new Map();
                agg.payeeStats.set(payeeId, (agg.payeeStats.get(payeeId) || 0) + tx.amount);
            });
        } else if (groupBy === 'payee') {
            const payeeNameMap = new Map(payees.map(p => [p.id, p]));
            filtered.forEach(tx => {
                const pId = tx.payeeId;
                if (!pId) {
                    const agg = getAggItem('no-payee', 'No Payee');
                    agg.amount += tx.amount;
                } else {
                    const pDef = payeeNameMap.get(pId);
                    const agg = getAggItem(pId, pDef?.name || 'Unknown');
                    agg.amount += tx.amount;
                }
            });
        } else if (groupBy === 'type') {
            const typeNameMap = new Map(transactionTypes.map(t => [t.id, t]));
            filtered.forEach(tx => {
                const tDef = typeNameMap.get(tx.typeId);
                const agg = getAggItem(tx.typeId, tDef?.name || 'Unknown');
                agg.amount += tx.amount;

                // Collect Payee data for drilldown
                const payeeId = tx.payeeId || 'no-payee';
                if (!agg.payeeStats) agg.payeeStats = new Map();
                agg.payeeStats.set(payeeId, (agg.payeeStats.get(payeeId) || 0) + tx.amount);
            });
        } else if (groupBy === 'tag') {
            const tagNameMap = new Map(tags.map(t => [t.id, t]));
            filtered.forEach(tx => {
                if (!tx.tagIds || tx.tagIds.length === 0) {
                    const agg = getAggItem('no-tag', 'No Tags');
                    agg.amount += tx.amount;
                } else {
                    tx.tagIds.forEach(tagId => {
                        const tagDef = tagNameMap.get(tagId);
                        const agg = getAggItem(tagId, tagDef?.name || 'Unknown');
                        agg.amount += tx.amount;
                    });
                }
            });
        }

        // --- 3. Build Hierarchy (Tree) and Payee Drilldown ---
        const rootItems: AggregationItem[] = [];
        const processedMap = new Map<string, AggregationItem>(); // To track items already placed in tree

        // Step A: Convert Payee Stats to Children (for Category and Type grouping)
        if (groupBy === 'category' || groupBy === 'type') {
            const payeeNameMap = new Map(payees.map(p => [p.id, p]));
            
            for (const agg of aggregationMap.values()) {
                if (agg.payeeStats && agg.payeeStats.size > 0) {
                    for (const [pId, amount] of agg.payeeStats.entries()) {
                        const pName = pId === 'no-payee' ? 'No Payee' : payeeNameMap.get(pId)?.name || 'Unknown Payee';
                        const payeeNode: AggregationItem = {
                            id: `payee-${pId}-in-${agg.id}`,
                            name: pName,
                            amount: amount,
                            children: [],
                            isHidden: false, // Payees inherit visibility from parent implicitly by structure
                            type: 'payee'
                        };
                        agg.children.push(payeeNode);
                    }
                }
            }
        }

        // Step B: Build Tree Structure based on Metadata Hierarchy
        if (groupBy === 'category') {
            const catNameMap = new Map(categories.map(c => [c.id, c]));
            
            for (const [id, agg] of aggregationMap.entries()) {
                const def = catNameMap.get(id);
                if (def?.parentId) {
                    // Child: find or create parent
                    const parentDef = catNameMap.get(def.parentId);
                    let parentAgg = processedMap.get(def.parentId);
                    
                    if (!parentAgg) {
                        if (aggregationMap.has(def.parentId)) {
                            parentAgg = aggregationMap.get(def.parentId)!;
                        } else {
                            const isParentHidden = (config.hiddenIds && config.hiddenIds.includes(def.parentId)) || 
                                                   (config.hiddenCategoryIds && config.hiddenCategoryIds.includes(def.parentId)) || false;
                            parentAgg = { id: def.parentId, name: parentDef?.name || 'Unknown Parent', amount: 0, children: [], isHidden: isParentHidden, type: 'group' };
                        }
                        processedMap.set(def.parentId, parentAgg);
                        if (!rootItems.find(r => r.id === def.parentId)) {
                            rootItems.push(parentAgg);
                        }
                    }
                    
                    if (!parentAgg.children.find(c => c.id === agg.id)) {
                        parentAgg.children.push(agg);
                        parentAgg.amount += agg.amount;
                    }
                    
                    processedMap.set(id, agg);
                } else {
                    if (!processedMap.has(id)) {
                        rootItems.push(agg);
                        processedMap.set(id, agg);
                    }
                }
            }
        } else if (groupBy === 'payee') {
            const payeeNameMap = new Map(payees.map(p => [p.id, p]));
            
            for (const [id, agg] of aggregationMap.entries()) {
                if (id === 'no-payee') {
                    rootItems.push(agg);
                    continue;
                }
                const def = payeeNameMap.get(id);
                if (def?.parentId) {
                    const parentDef = payeeNameMap.get(def.parentId);
                    let parentAgg = processedMap.get(def.parentId);
                    
                    if (!parentAgg) {
                        if (aggregationMap.has(def.parentId)) {
                            parentAgg = aggregationMap.get(def.parentId)!;
                        } else {
                            const isParentHidden = config.hiddenIds?.includes(def.parentId) || false;
                            parentAgg = { id: def.parentId, name: parentDef?.name || 'Unknown Parent', amount: 0, children: [], isHidden: isParentHidden, type: 'group' };
                        }
                        processedMap.set(def.parentId, parentAgg);
                        if (!rootItems.find(r => r.id === def.parentId)) {
                            rootItems.push(parentAgg);
                        }
                    }
                    if (!parentAgg.children.find(c => c.id === agg.id)) {
                        parentAgg.children.push(agg);
                        parentAgg.amount += agg.amount;
                    }
                    processedMap.set(id, agg);
                } else {
                    if (!processedMap.has(id)) {
                        rootItems.push(agg);
                        processedMap.set(id, agg);
                    }
                }
            }
        } else {
            // Flat lists (Types, Tags)
            for (const agg of aggregationMap.values()) {
                rootItems.push(agg);
            }
        }

        // --- 4. Sorting & Total Calculation (Respecting Hidden Items) ---
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
        sortRecursive(rootItems);

        // Safer Total Calculation: Iterate transactions one last time
        let totalVisibleAmount = filtered.filter(tx => {
            let idToCheck = '';
            if (groupBy === 'category') idToCheck = tx.categoryId;
            else if (groupBy === 'payee') idToCheck = tx.payeeId || 'no-payee';
            else if (groupBy === 'type') idToCheck = tx.typeId;
            else if (groupBy === 'tag') return true; 

            // Check visibility of this specific transaction's bucket
            if (config.hiddenIds?.includes(idToCheck)) return false;
            if (groupBy === 'category' && config.hiddenCategoryIds?.includes(idToCheck)) return false;
            
            // Check parent visibility
            if (groupBy === 'category') {
                const def = categories.find(c => c.id === idToCheck);
                if (def?.parentId && (config.hiddenIds?.includes(def.parentId) || config.hiddenCategoryIds?.includes(def.parentId))) return false;
            }
            if (groupBy === 'payee') {
                const def = payees.find(p => p.id === idToCheck);
                if (def?.parentId && config.hiddenIds?.includes(def.parentId)) return false;
            }

            return true;
        }).reduce((sum, tx) => sum + tx.amount, 0);

        if (groupBy === 'tag') {
            totalVisibleAmount = rootItems.filter(i => !i.isHidden).reduce((sum, i) => sum + i.amount, 0);
        }

        return { rootItems, totalVisibleAmount };

    }, [transactions, config, dateRange, categories, transactionTypes, payees, tags, sortBy]);

    // --- Handlers ---

    const toggleVisibility = (id: string) => {
        setConfig(prev => {
            const hidden = new Set(prev.hiddenIds || []);
            // Migrate legacy hiddenCategoryIds if present and we are in category mode
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

    const toggleCollapse = (id: string) => {
        setCollapsedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
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

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

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
                                className="w-full text-lg font-bold text-slate-800 bg-transparent border-b border-indigo-500 focus:outline-none"
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
                        <p className="text-xs text-slate-500 truncate mt-0.5">{dateRange.label} • {config.groupBy ? config.groupBy.charAt(0).toUpperCase() + config.groupBy.slice(1) : 'Category'}</p>
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
                                    onChange={(e) => setConfig({ ...config, datePreset: e.target.value as DateRangePreset })}
                                    className="text-xs p-1.5 border rounded w-full font-medium text-slate-700"
                                >
                                    <option value="thisMonth">This Month</option>
                                    <option value="lastMonth">Last Month</option>
                                    <option value="lastMonthPriorYear">Last Month (Prior Year)</option>
                                    <option value="thisYear">This Year</option>
                                    <option value="lastYear">Last Year</option>
                                    <option value="last3Months">Last 90 Days</option>
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
                                    <option value="payee">Payee</option>
                                    <option value="tag">Tag</option>
                                    <option value="type">Type</option>
                                </select>
                            </div>
                            
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
                    <p className="text-3xl font-bold text-slate-800 tracking-tight">{formatCurrency(activeData.totalVisibleAmount)}</p>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mt-1">Total</p>
                </div>

                <DonutChart data={chartData} />

                {/* Sort Bar */}
                <div className="flex justify-end gap-2 mb-2 text-[10px] uppercase font-bold text-slate-400">
                    <button onClick={() => setSortBy('amount')} className={sortBy === 'amount' ? 'text-indigo-600' : 'hover:text-slate-600'}>Amount</button>
                    <span>/</span>
                    <button onClick={() => setSortBy('name')} className={sortBy === 'name' ? 'text-indigo-600' : 'hover:text-slate-600'}>Name</button>
                </div>

                {/* List */}
                <div className="space-y-1 pb-4">
                    {activeData.rootItems.map(item => {
                        // Calculate percentage based on visible amount, but if hidden, show 0% on bar
                        const percent = activeData.totalVisibleAmount !== 0 && !item.isHidden 
                            ? (item.amount / activeData.totalVisibleAmount) * 100 
                            : 0;
                        const isCollapsed = collapsedItems.has(item.id);
                        
                        return (
                            <div key={item.id} className={`text-sm ${item.isHidden ? 'opacity-50 grayscale' : ''}`}>
                                {/* Parent Row */}
                                <div className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg group transition-colors">
                                    {item.children.length > 0 ? (
                                        <button onClick={() => toggleCollapse(item.id)} className="text-slate-400 hover:text-indigo-600">
                                            {isCollapsed ? <ChevronRightIcon className="w-3 h-3"/> : <ChevronDownIcon className="w-3 h-3"/>}
                                        </button>
                                    ) : <div className="w-3" />}
                                    
                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-medium text-slate-700 truncate text-xs" title={item.name}>{item.name}</span>
                                            <span className="font-mono font-bold text-slate-800 text-xs">{formatCurrency(item.amount)}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>

                                    {item.type !== 'payee' && (
                                        <button 
                                            onClick={() => toggleVisibility(item.id)}
                                            className={`text-slate-300 hover:text-slate-500 transition-opacity ${item.isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                            title={item.isHidden ? "Show in calculation" : "Hide from calculation"}
                                        >
                                            {item.isHidden ? <EyeSlashIcon className="w-3 h-3 text-slate-400" /> : <EyeIcon className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>

                                {/* Children Rows */}
                                {!isCollapsed && item.children.length > 0 && (
                                    <div className="pl-3 space-y-0.5 border-l-2 border-slate-100 ml-3.5 my-1">
                                        {item.children.map(sub => (
                                            <div key={sub.id} className={`flex justify-between items-center text-xs p-1.5 hover:bg-slate-50 rounded group ${sub.isHidden ? 'opacity-50' : ''}`}>
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    {sub.type === 'payee' && <UsersIcon className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                                                    {sub.type === 'group' && <TagIcon className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                                                    <span className={`${sub.type === 'payee' ? 'text-indigo-800' : 'text-slate-500'} truncate pl-1`}>{sub.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-slate-600">{formatCurrency(sub.amount)}</span>
                                                    {sub.type !== 'payee' && (
                                                        <button 
                                                            onClick={() => toggleVisibility(sub.id)}
                                                            className={`text-slate-300 hover:text-slate-500 transition-opacity ${sub.isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                        >
                                                            {sub.isHidden ? <EyeSlashIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ReportColumn;
