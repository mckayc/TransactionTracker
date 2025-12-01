
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, Category, TransactionType, SavedReport, ReportConfig, DateRangePreset, Account, User } from '../types';
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeSlashIcon, SortIcon } from './Icons';
import { formatDate } from '../dateUtils';
import MultiSelect from './MultiSelect';

interface ReportColumnProps {
    id: string;
    transactions: Transaction[];
    categories: Category[];
    transactionTypes: TransactionType[];
    accounts: Account[];
    users: User[];
    savedReports: SavedReport[];
    onSaveReport: (config: ReportConfig) => void;
    onDeleteReport: (reportId: string) => void;
    initialConfig?: ReportConfig;
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

interface AggregatedCategory {
    id: string;
    name: string;
    amount: number;
    subcategories: AggregatedCategory[];
}

const ReportColumn: React.FC<ReportColumnProps> = ({ id, transactions, categories, transactionTypes, accounts, users, savedReports, onSaveReport, onDeleteReport, initialConfig }) => {
    
    // --- State ---
    const [config, setConfig] = useState<ReportConfig>(initialConfig || {
        id: crypto.randomUUID(),
        name: 'New Report',
        datePreset: 'thisMonth',
        filters: {},
        hiddenCategoryIds: []
    });

    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
    const [showFilters, setShowFilters] = useState(false);
    const [reportNameInput, setReportNameInput] = useState('');

    // --- Data Processing ---
    
    const dateRange = useMemo(() => getDateRangeFromPreset(config.datePreset, config.customStartDate, config.customEndDate), [config.datePreset, config.customStartDate, config.customEndDate]);

    const activeData = useMemo(() => {
        // 1. Filter Transactions
        const filtered = transactions.filter(tx => {
            // Skip Parent transactions (containers)
            if (tx.isParent) return false;

            const txDate = new Date(tx.date);
            if (txDate < dateRange.start || txDate > dateRange.end) return false;

            if (config.filters.accountIds && config.filters.accountIds.length > 0 && !config.filters.accountIds.includes(tx.accountId || '')) return false;
            if (config.filters.userIds && config.filters.userIds.length > 0 && !config.filters.userIds.includes(tx.userId || '')) return false;
            
            // Only include Expenses by default or if selected
            const type = transactionTypes.find(t => t.id === tx.typeId);
            if (!type || type.balanceEffect !== 'expense') return false; 

            return true;
        });

        // 2. Aggregate by Category Hierarchy
        const categoryMap = new Map<string, AggregatedCategory>();
        
        // Initialize all categories (even empty ones if needed, but here we just process what we have)
        // We need a map of ID -> Name first
        const catNameMap = new Map(categories.map(c => [c.id, c]));

        filtered.forEach(tx => {
            const catId = tx.categoryId;
            const category = catNameMap.get(catId);
            if (!category) return;

            // Check if this category OR its parent is hidden
            if (config.hiddenCategoryIds?.includes(catId)) return;
            if (category.parentId && config.hiddenCategoryIds?.includes(category.parentId)) return;

            // Aggregate
            if (!categoryMap.has(catId)) {
                categoryMap.set(catId, { id: catId, name: category.name, amount: 0, subcategories: [] });
            }
            categoryMap.get(catId)!.amount += tx.amount;
        });

        // Build Tree
        const rootCategories: AggregatedCategory[] = [];
        const parentMap = new Map<string, AggregatedCategory>();

        // First pass: identify parents and root nodes
        categories.forEach(c => {
            if (!c.parentId) {
                // It's a root category. Does it have data? 
                // Or do any of its children have data? 
                // We'll reconstruct the tree from the flat map of transaction data.
            }
        });

        // Simpler approach: Iterate the map of categories with data, and place them.
        const processedMap = new Map<string, AggregatedCategory>();

        // Sort keys to ensure we process parents? No, just loop and link.
        for (const [catId, agg] of categoryMap.entries()) {
            const catDef = catNameMap.get(catId);
            if (catDef?.parentId) {
                // It's a child. Find or create parent agg.
                let parentAgg = processedMap.get(catDef.parentId);
                if (!parentAgg) {
                    const parentDef = catNameMap.get(catDef.parentId);
                    parentAgg = { 
                        id: catDef.parentId, 
                        name: parentDef?.name || 'Unknown Parent', 
                        amount: 0, // Will sum up children
                        subcategories: [] 
                    };
                    processedMap.set(catDef.parentId, parentAgg);
                }
                parentAgg.subcategories.push(agg);
                parentAgg.amount += agg.amount;
            } else {
                // It's a parent (or orphan).
                let existing = processedMap.get(catId);
                if (!existing) {
                    processedMap.set(catId, agg);
                } else {
                    existing.amount += agg.amount; // Add direct transactions to existing agg (from children logic)
                }
            }
        }

        // Extract roots
        for (const [id, agg] of processedMap.entries()) {
            const def = catNameMap.get(id);
            if (!def?.parentId) {
                rootCategories.push(agg);
            }
        }

        // Sort
        const sortFn = (a: AggregatedCategory, b: AggregatedCategory) => {
            if (sortBy === 'amount') return b.amount - a.amount;
            return a.name.localeCompare(b.name);
        };

        rootCategories.sort(sortFn);
        rootCategories.forEach(root => root.subcategories.sort(sortFn));

        const totalAmount = rootCategories.reduce((sum, cat) => sum + cat.amount, 0);

        return { rootCategories, totalAmount };

    }, [transactions, config, dateRange, categories, transactionTypes, sortBy]);

    // --- Handlers ---

    const toggleVisibility = (id: string) => {
        setConfig(prev => {
            const hidden = new Set(prev.hiddenCategoryIds || []);
            if (hidden.has(id)) hidden.delete(id);
            else hidden.add(id);
            return { ...prev, hiddenCategoryIds: Array.from(hidden) };
        });
    };

    const toggleCollapse = (id: string) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSave = () => {
        const name = prompt("Enter a name for this report configuration:", config.name || "New Report");
        if (name) {
            onSaveReport({ ...config, name, id: crypto.randomUUID() });
        }
    };

    const handleLoad = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const reportId = e.target.value;
        const report = savedReports.find(r => r.id === reportId);
        if (report) {
            setConfig({ ...report.config, id: report.id, name: report.name }); // Keep ID separate if needed, or clone
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

    // Prepare Chart Data
    const chartData = activeData.rootCategories.slice(0, 8).map((cat, i) => ({
        name: cat.name,
        value: cat.amount,
        color: COLORS[i % COLORS.length]
    }));
    
    // Add "Other" if needed
    const otherAmount = activeData.rootCategories.slice(8).reduce((sum, cat) => sum + cat.amount, 0);
    if (otherAmount > 0) {
        chartData.push({ name: 'Other', value: otherAmount, color: '#cbd5e1' });
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden min-w-[320px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-800 text-lg truncate" title={config.name}>{config.name}</h3>
                    <div className="flex gap-1">
                        <select 
                            className="text-xs p-1 border rounded bg-white max-w-[100px]" 
                            onChange={handleLoad}
                            value=""
                        >
                            <option value="" disabled>Load...</option>
                            {savedReports.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button onClick={handleSave} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">Save</button>
                    </div>
                </div>
                
                <div className="flex flex-col gap-2">
                    <select 
                        value={config.datePreset} 
                        onChange={(e) => setConfig({ ...config, datePreset: e.target.value as DateRangePreset })}
                        className="text-sm p-1.5 border rounded w-full font-medium text-slate-700"
                    >
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="last3Months">Last 90 Days</option>
                        <option value="thisYear">This Year</option>
                        <option value="lastYear">Last Year</option>
                        <option value="sameMonthLastYear">Same Month Last Year</option>
                        <option value="sameMonth2YearsAgo">Same Month 2 Years Ago</option>
                        <option value="custom">Custom Range</option>
                    </select>
                    
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium text-left flex items-center gap-1"
                    >
                        <SortIcon className="w-3 h-3" /> 
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>

                    {showFilters && (
                        <div className="space-y-2 pt-2 animate-slide-down">
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
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="text-center mb-4">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{dateRange.label}</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(activeData.totalAmount)}</p>
                </div>

                <DonutChart data={chartData} />

                {/* Sort Bar */}
                <div className="flex justify-end gap-2 mb-2 text-xs text-slate-500">
                    <button onClick={() => setSortBy('amount')} className={sortBy === 'amount' ? 'text-indigo-600 font-bold' : 'hover:text-slate-700'}>Amount</button>
                    <span>|</span>
                    <button onClick={() => setSortBy('name')} className={sortBy === 'name' ? 'text-indigo-600 font-bold' : 'hover:text-slate-700'}>Name</button>
                </div>

                {/* List */}
                <div className="space-y-1">
                    {activeData.rootCategories.map(cat => {
                        const percent = (cat.amount / activeData.totalAmount) * 100;
                        const isCollapsed = collapsedCategories.has(cat.id);
                        
                        return (
                            <div key={cat.id} className="text-sm">
                                {/* Parent Row */}
                                <div className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded group">
                                    {cat.subcategories.length > 0 ? (
                                        <button onClick={() => toggleCollapse(cat.id)} className="text-slate-400 hover:text-indigo-600">
                                            {isCollapsed ? <ChevronRightIcon className="w-4 h-4"/> : <ChevronDownIcon className="w-4 h-4"/>}
                                        </button>
                                    ) : <div className="w-4" />}
                                    
                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-medium text-slate-700 truncate">{cat.name}</span>
                                            <span className="font-mono font-bold text-slate-900">{formatCurrency(cat.amount)}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => toggleVisibility(cat.id)}
                                        className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Hide from report"
                                    >
                                        <EyeIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Children Rows */}
                                {!isCollapsed && cat.subcategories.length > 0 && (
                                    <div className="pl-8 space-y-1 border-l-2 border-slate-100 ml-4 my-1">
                                        {cat.subcategories.map(sub => (
                                            <div key={sub.id} className="flex justify-between items-center text-xs p-1 hover:bg-slate-50 rounded group">
                                                <span className="text-slate-600 truncate">{sub.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-slate-700">{formatCurrency(sub.amount)}</span>
                                                    <button 
                                                        onClick={() => toggleVisibility(sub.id)}
                                                        className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <EyeIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {config.hiddenCategoryIds && config.hiddenCategoryIds.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-dashed border-slate-300">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hidden Categories</p>
                        <div className="flex flex-wrap gap-2">
                            {config.hiddenCategoryIds.map(id => {
                                const cat = categories.find(c => c.id === id);
                                return (
                                    <button 
                                        key={id} 
                                        onClick={() => toggleVisibility(id)}
                                        className="flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs hover:bg-slate-200 hover:text-slate-700"
                                    >
                                        <EyeSlashIcon className="w-3 h-3" />
                                        <span className="truncate max-w-[100px]">{cat?.name || 'Unknown'}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportColumn;
