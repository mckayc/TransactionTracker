
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, Category, TransactionType, ReportConfig, DateRangePreset, Account, User, BalanceEffect, Tag, Payee, ReportGroupBy, CustomDateRange, DateRangeUnit } from '../types';
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeSlashIcon, SortIcon, EditIcon, TableIcon, CloseIcon, SettingsIcon, DownloadIcon, InfoIcon, ExclamationTriangleIcon } from './Icons';
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
            case 'allTime':
                start = new Date(0); // Epoch start (1970-01-01)
                end = new Date();
                label = 'All Time';
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

const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[]; total: number }> = ({ data, total }) => {
    let accumulatedAngle = 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="relative w-48 h-48 mx-auto">
            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                {data.map((slice, i) => {
                    const percentage = slice.value / total;
                    const strokeDasharray = `${percentage * circumference} ${circumference}`;
                    const strokeDashoffset = -accumulatedAngle * circumference;
                    accumulatedAngle += percentage;

                    return (
                        <circle
                            key={i}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="20"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-300 hover:opacity-80"
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-500 font-medium uppercase">Total</span>
                <span className="text-lg font-bold text-slate-800">{formatCurrency(total)}</span>
            </div>
        </div>
    );
};

const ReportRow: React.FC<{ 
    item: { label: string; value: number; color: string; id: string }; 
    total: number; 
    onClick: () => void;
    isHidden: boolean;
    onToggleHidden: (e: React.MouseEvent) => void;
}> = ({ item, total, onClick, isHidden, onToggleHidden }) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    
    return (
        <div 
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isHidden ? 'opacity-50 grayscale bg-slate-50' : 'hover:bg-slate-50'}`}
            onClick={onClick}
        >
            <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: isHidden ? '#cbd5e1' : item.color }} 
            />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-medium truncate ${isHidden ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                        {item.label}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(item.value)}
                    </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                            width: `${percentage}%`, 
                            backgroundColor: isHidden ? '#cbd5e1' : item.color 
                        }}
                    />
                </div>
            </div>
            <button 
                onClick={onToggleHidden}
                className="p-1 text-slate-300 hover:text-slate-500 transition-colors"
            >
                {isHidden ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
            </button>
        </div>
    );
};

const ReportColumn: React.FC<ReportColumnProps> = ({ config: initialConfig, transactions, categories, transactionTypes, accounts, users, tags, payees, onSaveReport, savedDateRanges, onSaveDateRange, onDeleteDateRange }) => {
    
    const [config, setConfig] = useState<ReportConfig>(initialConfig);
    const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [inspectingItems, setInspectingItems] = useState<Transaction[] | null>(null);
    const [inspectingTitle, setInspectingTitle] = useState('');
    
    const reportRef = useRef<HTMLDivElement>(null);

    // Sync local state when prop changes (for saved report loading)
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

        // Filter Transactions
        const filtered = transactions.filter(tx => {
            if (tx.isParent) return false;
            
            const txDate = new Date(tx.date);
            if (txDate < start || txDate > filterEnd) return false;

            // Type/Balance Effect Filter
            // If specific types are selected, strict match
            if (config.filters.typeIds && config.filters.typeIds.length > 0) {
                if (!config.filters.typeIds.includes(tx.typeId)) return false;
            } else {
                // Fallback to balance effects
                const type = transactionTypes.find(t => t.id === tx.typeId);
                const effect = type?.balanceEffect || 'expense';
                if (config.filters.balanceEffects && !config.filters.balanceEffects.includes(effect)) return false;
            }

            if (config.filters.accountIds && !config.filters.accountIds.includes(tx.accountId || '')) return false;
            if (config.filters.categoryIds && !config.filters.categoryIds.includes(tx.categoryId)) return false;
            if (config.filters.userIds && !config.filters.userIds.includes(tx.userId || '')) return false;
            if (config.filters.payeeIds && !config.filters.payeeIds.includes(tx.payeeId || '')) return false;
            
            if (config.filters.tagIds && config.filters.tagIds.length > 0) {
                if (!tx.tagIds || !tx.tagIds.some(tId => config.filters.tagIds!.includes(tId))) return false;
            }

            return true;
        });

        // Grouping
        const groups = new Map<string, { label: string, value: number, transactions: Transaction[], id: string }>();
        const hiddenIds = new Set(config.hiddenIds || config.hiddenCategoryIds || []);

        filtered.forEach(tx => {
            let key = '';
            let label = 'Unknown';

            if (config.groupBy === 'category') {
                key = tx.categoryId;
                label = categories.find(c => c.id === key)?.name || 'Uncategorized';
            } else if (config.groupBy === 'payee') {
                key = tx.payeeId || 'no-payee';
                label = payees.find(p => p.id === key)?.name || 'No Payee';
            } else if (config.groupBy === 'account') {
                key = tx.accountId || 'no-account';
                label = accounts.find(a => a.id === key)?.name || 'Unknown Account';
            } else if (config.groupBy === 'type') {
                key = tx.typeId;
                label = transactionTypes.find(t => t.id === key)?.name || 'Unknown Type';
            } else if (config.groupBy === 'tag') {
                // Tags are many-to-many. Split tx amount? or duplicate?
                // Standard approach: if grouping by tag, duplicate tx for each tag
                const txTags = tx.tagIds && tx.tagIds.length > 0 ? tx.tagIds : ['no-tag'];
                txTags.forEach(tagId => {
                    const tagKey = tagId;
                    const tagLabel = tags.find(t => t.id === tagId)?.name || 'No Tag';
                    if (config.filters.tagIds && tagId !== 'no-tag' && !config.filters.tagIds.includes(tagId)) return; // Skip unwanted tags

                    if (!groups.has(tagKey)) groups.set(tagKey, { label: tagLabel, value: 0, transactions: [], id: tagKey });
                    const group = groups.get(tagKey)!;
                    group.value += tx.amount;
                    group.transactions.push(tx);
                });
                return; // handled
            }

            if (!groups.has(key)) groups.set(key, { label, value: 0, transactions: [], id: key });
            const group = groups.get(key)!;
            group.value += tx.amount;
            group.transactions.push(tx);
        });

        const result = Array.from(groups.values()).map((g, i) => ({
            ...g,
            color: COLORS[i % COLORS.length] // Assign stable colors based on index/order
        }));

        // Sort
        result.sort((a, b) => sortBy === 'amount' ? b.value - a.value : a.label.localeCompare(b.label));

        // Separate visible and hidden for calculation
        const visibleItems = result.filter(r => !hiddenIds.has(r.id));
        const totalValue = visibleItems.reduce((sum, item) => sum + item.value, 0);

        return { items: result, totalValue, visibleItems };

    }, [transactions, config, dateRange, transactionTypes, categories, accounts, payees, tags, sortBy]);

    const handleConfigUpdate = (newConfig: ReportConfig) => {
        setConfig(newConfig);
        onSaveReport(newConfig);
    };

    const toggleHidden = (id: string) => {
        const currentHidden = new Set(config.hiddenIds || config.hiddenCategoryIds || []);
        if (currentHidden.has(id)) currentHidden.delete(id);
        else currentHidden.add(id);
        
        const newConfig = { 
            ...config, 
            hiddenIds: Array.from(currentHidden),
            hiddenCategoryIds: Array.from(currentHidden) // Sync legacy field
        };
        setConfig(newConfig);
        onSaveReport(newConfig);
    };

    const handleInspect = (item: typeof activeData.items[0]) => {
        setInspectingTitle(`${item.label} Transactions`);
        setInspectingItems(item.transactions);
    };

    return (
        <div ref={reportRef} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden min-w-[320px] relative">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-800 text-lg truncate" title={config.name}>{config.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <span className="truncate">{dateRange.label}</span>
                        {config.filters.balanceEffects?.length === 1 && (
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
                        title="Configure Report"
                    >
                        <SettingsIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                 {activeData.items.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400">
                         <ExclamationTriangleIcon className="w-10 h-10 mb-2 opacity-50" />
                         <p className="text-sm">No matching data.</p>
                     </div>
                 ) : (
                     <div className="space-y-6">
                         {/* Chart Section */}
                         <div className="py-2">
                             <DonutChart 
                                data={activeData.visibleItems.map(i => ({ label: i.label, value: i.value, color: i.color }))}
                                total={activeData.totalValue}
                             />
                         </div>

                         {/* List Section */}
                         <div className="space-y-1">
                             {activeData.items.map(item => {
                                 const isHidden = (config.hiddenIds || config.hiddenCategoryIds || []).includes(item.id);
                                 return (
                                     <ReportRow 
                                        key={item.id}
                                        item={item}
                                        total={activeData.totalValue}
                                        onClick={() => handleInspect(item)}
                                        isHidden={isHidden}
                                        onToggleHidden={(e) => { e.stopPropagation(); toggleHidden(item.id); }}
                                     />
                                 );
                             })}
                         </div>
                     </div>
                 )}
            </div>

            {/* Inspection Modal */}
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
                transactions={transactions} 
            />
        </div>
    );
};

export default ReportColumn;
