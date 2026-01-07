
import React, { useState, useEffect, useMemo } from 'react';
import type { ReportConfig, Account, Category, User, TransactionType, DateRangePreset, BalanceEffect, Tag, Counterparty, ReportGroupBy, CustomDateRange, DateRangeUnit, DateRangeType, Transaction, AmazonReportType, AmazonMetric } from '../types';
import { CloseIcon, ChartPieIcon, CalendarIcon, AddIcon, DeleteIcon, EditIcon, TableIcon, ExclamationTriangleIcon, SaveIcon, BoxIcon, YoutubeIcon } from './Icons';
import MultiSelect from './MultiSelect';
import { generateUUID } from '../utils';
import { calculateDateRange } from '../dateUtils';

interface ReportConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: ReportConfig) => void;
    initialConfig?: ReportConfig;
    accounts: Account[];
    categories: Category[];
    users: User[];
    transactionTypes: TransactionType[];
    tags: Tag[];
    payees: Counterparty[];
    savedDateRanges: CustomDateRange[];
    onSaveDateRange: (range: CustomDateRange) => void;
    onDeleteDateRange: (id: string) => void;
    transactions: Transaction[];
    amazonMetrics?: AmazonMetric[];
}

const ReportConfigModal: React.FC<ReportConfigModalProps> = ({ 
    isOpen, onClose, onSave, initialConfig, accounts, categories, users, transactionTypes, tags, payees, savedDateRanges, onSaveDateRange, onDeleteDateRange, transactions, amazonMetrics
}) => {
    const [name, setName] = useState('');
    const [dataSource, setDataSource] = useState<'financial' | 'amazon' | 'youtube'>('financial');
    const [datePreset, setDatePreset] = useState<DateRangePreset | string>('thisMonth');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [groupBy, setGroupBy] = useState<ReportGroupBy>('category');
    const [subGroupBy, setSubGroupBy] = useState<ReportGroupBy | ''>('');
    
    // Filters
    const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
    const [selectedEffects, setSelectedEffects] = useState<Set<BalanceEffect>>(new Set(['expense', 'income']));
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [selectedPayees, setSelectedPayees] = useState<Set<string>>(new Set());
    
    // Amazon Filters
    const [selectedAmazonSources, setSelectedAmazonSources] = useState<Set<AmazonReportType>>(new Set(['onsite', 'offsite', 'creator_connections']));

    // Date Range Manager State
    const [isManagingRanges, setIsManagingRanges] = useState(false);
    const [rangeName, setRangeName] = useState('');
    const [rangeType, setRangeType] = useState<DateRangeType>('rolling_window');
    const [rangeValue, setRangeValue] = useState(1);
    const [rangeUnit, setRangeUnit] = useState<DateRangeUnit>('month');
    const [editingRangeId, setEditingRangeId] = useState<string | null>(null);

    // Initialization
    useEffect(() => {
        if (isOpen) {
            if (initialConfig) {
                // Editing existing report
                setName(initialConfig.name);
                setDataSource(initialConfig.dataSource || 'financial');
                setDatePreset(initialConfig.datePreset);
                setCustomStartDate(initialConfig.customStartDate || '');
                setCustomEndDate(initialConfig.customEndDate || '');
                setGroupBy(initialConfig.groupBy || (initialConfig.dataSource === 'amazon' ? 'source' : (initialConfig.dataSource === 'youtube' ? 'video' : 'category')));
                setSubGroupBy(initialConfig.subGroupBy || '');
                
                // Hydrate filters
                setSelectedAccounts(initialConfig.filters.accountIds ? new Set(initialConfig.filters.accountIds) : new Set(accounts.map(a => a.id)));
                setSelectedUsers(initialConfig.filters.userIds ? new Set(initialConfig.filters.userIds) : new Set(users.map(u => u.id)));
                setSelectedCategories(initialConfig.filters.categoryIds ? new Set(initialConfig.filters.categoryIds) : new Set(categories.map(c => c.id)));
                setSelectedTypes(initialConfig.filters.typeIds ? new Set(initialConfig.filters.typeIds) : new Set(transactionTypes.map(t => t.id)));
                setSelectedEffects(new Set(initialConfig.filters.balanceEffects || ['expense', 'income']));
                setSelectedTags(initialConfig.filters.tagIds ? new Set(initialConfig.filters.tagIds) : new Set(tags.map(t => t.id)));
                // Fixed: Use counterpartyIds instead of payeeIds to match types.ts
                setSelectedPayees(initialConfig.filters.counterpartyIds ? new Set(initialConfig.filters.counterpartyIds) : new Set(payees.map(p => p.id)));
                // Fixed: Explicit cast to AmazonReportType[] to resolve generic string set error
                setSelectedAmazonSources(initialConfig.filters.amazonSources ? new Set(initialConfig.filters.amazonSources as AmazonReportType[]) : new Set(['onsite', 'offsite', 'creator_connections'] as AmazonReportType[]));
            } else {
                // Creating NEW report
                setName('');
                setDataSource('financial');
                setDatePreset('thisMonth');
                setCustomStartDate('');
                setCustomEndDate('');
                setGroupBy('category');
                setSubGroupBy('');
                
                // Default: All selected
                setSelectedAccounts(new Set(accounts.map(a => a.id)));
                setSelectedUsers(new Set(users.map(u => u.id)));
                setSelectedCategories(new Set(categories.map(c => c.id)));
                setSelectedTypes(new Set(transactionTypes.map(t => t.id)));
                setSelectedEffects(new Set(['expense', 'income']));
                setSelectedTags(new Set(tags.map(t => t.id)));
                setSelectedPayees(new Set(payees.map(p => p.id)));
                setSelectedAmazonSources(new Set(['onsite', 'offsite', 'creator_connections']));
            }
            setIsManagingRanges(false);
        }
    }, [isOpen, initialConfig, accounts, categories, users, transactionTypes, tags, payees]);

    // Live Preview Logic
    const previewData = useMemo(() => {
        if (!isOpen || dataSource !== 'financial') return { transactions: [], total: 0, count: 0, dateLabel: '' };
        
        const { start, end } = calculateDateRange(datePreset, customStartDate, customEndDate, savedDateRanges);
        const filterEnd = new Date(end);
        filterEnd.setHours(23, 59, 59, 999);

        const filtered = transactions.filter(tx => {
            if (tx.isParent) return false;
            const txDate = new Date(tx.date);
            if (txDate < start || txDate > filterEnd) return false;
            const type = transactionTypes.find(t => t.id === tx.typeId);
            if (!type || !selectedEffects.has(type.balanceEffect)) return false;
            
            if (selectedAccounts.size > 0 && !selectedAccounts.has(tx.accountId || '')) return false;
            if (selectedUsers.size > 0 && !selectedUsers.has(tx.userId || '')) return false;
            if (selectedCategories.size > 0 && !selectedCategories.has(tx.categoryId)) return false;
            if (selectedTypes.size > 0 && !selectedTypes.has(tx.typeId)) return false;
            // Fixed: Use counterpartyId instead of payeeId to match types.ts
            if (selectedPayees.size > 0 && selectedPayees.size < payees.length && !selectedPayees.has(tx.counterpartyId || '')) return false;
            if (selectedTags.size < tags.length && (!tx.tagIds || !tx.tagIds.some(tId => selectedTags.has(tId)))) return false;

            return true;
        });

        filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

        return { transactions: filtered, total, count: filtered.length, dateLabel: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}` };
    }, [isOpen, dataSource, transactions, datePreset, customStartDate, customEndDate, savedDateRanges, selectedAccounts, selectedCategories, selectedTypes, selectedUsers, selectedTags, selectedPayees, selectedEffects, transactionTypes, payees.length, tags.length]);

    if (!isOpen) return null;

    const handleSave = (asNew: boolean = false) => {
        const isAllAccounts = selectedAccounts.size === accounts.length;
        const isAllCategories = selectedCategories.size === categories.length;
        const isAllUsers = selectedUsers.size === users.length;
        const isAllTypes = selectedTypes.size === transactionTypes.length;
        const isAllTags = selectedTags.size === tags.length;
        const isAllPayees = selectedPayees.size === payees.length;

        // If saving as new, generate new ID. Else use existing or generate one if new.
        const id = asNew ? generateUUID() : (initialConfig?.id || generateUUID());

        const config: ReportConfig = {
            id: id, 
            name: name.trim() || 'New Report',
            dataSource,
            datePreset,
            customStartDate: ['custom', 'specificMonth', 'relativeMonth'].includes(datePreset as string) ? customStartDate : undefined,
            customEndDate: datePreset === 'custom' ? customEndDate : undefined,
            groupBy,
            subGroupBy: subGroupBy || undefined,
            filters: {
                accountIds: isAllAccounts ? undefined : Array.from(selectedAccounts),
                userIds: isAllUsers ? undefined : Array.from(selectedUsers),
                categoryIds: isAllCategories ? undefined : Array.from(selectedCategories),
                typeIds: isAllTypes ? undefined : Array.from(selectedTypes),
                balanceEffects: Array.from(selectedEffects),
                tagIds: isAllTags ? undefined : Array.from(selectedTags),
                // Fixed: Use counterpartyIds instead of payeeIds to match types.ts
                counterpartyIds: isAllPayees ? undefined : Array.from(selectedPayees),
                amazonSources: dataSource === 'amazon' ? Array.from(selectedAmazonSources) : undefined
            },
            hiddenCategoryIds: asNew ? [] : (initialConfig?.hiddenCategoryIds || []),
            hiddenIds: asNew ? [] : (initialConfig?.hiddenIds || [])
        };
        onSave(config);
        onClose();
    };

    // Range Management Handlers
    const toggleEffect = (effect: BalanceEffect) => {
        const newSet = new Set(selectedEffects);
        if (newSet.has(effect)) newSet.delete(effect); else newSet.add(effect);
        setSelectedEffects(newSet);
    };

    const toggleAmazonSource = (source: AmazonReportType) => {
        const newSet = new Set(selectedAmazonSources);
        if (newSet.has(source)) newSet.delete(source); else newSet.add(source);
        setSelectedAmazonSources(newSet);
    };

    const handleSaveRange = () => {
        if (!rangeName.trim()) { alert("Range name is required"); return; }
        const newRange: CustomDateRange = { 
            id: editingRangeId || generateUUID(), 
            name: rangeName.trim(), 
            type: rangeType, 
            unit: rangeUnit, 
            value: rangeValue, 
            offsets: undefined
        };
        onSaveDateRange(newRange);
        handleClearRangeForm();
    };

    const handleEditRange = (range: CustomDateRange) => {
        setEditingRangeId(range.id);
        setRangeName(range.name);
        setRangeType(range.type);
        setRangeUnit(range.unit);
        setRangeValue(range.value);
    };

    const handleClearRangeForm = () => {
        setEditingRangeId(null); 
        setRangeName(''); 
        setRangeType('rolling_window'); 
        setRangeValue(1); 
        setRangeUnit('month');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center p-4 border-b bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {isManagingRanges ? <CalendarIcon className="w-6 h-6 text-indigo-600"/> : <ChartPieIcon className="w-6 h-6 text-indigo-600" />}
                        {isManagingRanges ? 'Manage Custom Date Ranges' : (initialConfig ? 'Edit Report Config' : 'New Report Config')}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT PANEL */}
                    <div className="w-1/3 min-w-[350px] border-r border-slate-200 overflow-y-auto p-6 bg-white flex flex-col gap-6">
                        {isManagingRanges ? (
                            // Range Manager UI
                            <div className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700">{editingRangeId ? 'Edit Range' : 'Create New Range'}</h3>
                                        {editingRangeId && <button onClick={handleClearRangeForm} className="text-xs text-indigo-600 hover:underline">Cancel Edit</button>}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Range Name</label>
                                        <input type="text" value={rangeName} onChange={e => setRangeName(e.target.value)} placeholder="e.g. Last 3 Months" className="w-full p-2 border rounded-md text-sm" />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Type</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setRangeType('rolling_window')} 
                                                className={`flex-1 py-2 text-xs font-medium border rounded-md transition-colors ${rangeType === 'rolling_window' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                            >
                                                Rolling Window
                                            </button>
                                            <button 
                                                onClick={() => setRangeType('fixed_period')} 
                                                className={`flex-1 py-2 text-xs font-medium border rounded-md transition-colors ${rangeType === 'fixed_period' ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                            >
                                                Relative Period
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                                            <input type="number" min="1" value={rangeValue} onChange={e => setRangeValue(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-md text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
                                            <select value={rangeUnit} onChange={e => setRangeUnit(e.target.value as DateRangeUnit)} className="w-full p-2 border rounded-md text-sm">
                                                <option value="day">Day(s)</option>
                                                <option value="week">Week(s)</option>
                                                <option value="month">Month(s)</option>
                                                <option value="quarter">Quarter(s)</option>
                                                <option value="year">Year(s)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <button onClick={handleSaveRange} className="w-full py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors">
                                        {editingRangeId ? 'Update Range' : 'Create Range'}
                                    </button>
                                </div>

                                <div>
                                    <h4 className="font-bold text-slate-600 mb-2 text-sm uppercase">My Custom Ranges</h4>
                                    {savedDateRanges.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">No custom ranges created yet.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {savedDateRanges.map(range => (
                                                <div key={range.id} className="flex items-center justify-between p-2 bg-white border rounded-md hover:border-indigo-300 group">
                                                    <div className="cursor-pointer flex-grow" onClick={() => handleEditRange(range)}>
                                                        <span className="text-sm font-medium text-slate-700">{range.name}</span>
                                                        <span className="text-xs text-slate-400 block">
                                                            {range.type === 'rolling_window' ? 'Last' : ''} {range.value} {range.unit}(s) {range.type === 'fixed_period' ? 'ago' : ''}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => onDeleteDateRange(range.id)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100">
                                                        <DeleteIcon className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t"><button onClick={() => setIsManagingRanges(false)} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">&larr; Back to Report Config</button></div>
                            </div>
                        ) : (
                            // Standard Config UI
                            <>
                                <div><label className="block text-sm font-bold text-slate-700 mb-1">Report Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-md" /></div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Data Source</label>
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                                        <button 
                                            onClick={() => { setDataSource('financial'); setGroupBy('category'); }} 
                                            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${dataSource === 'financial' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Transactions
                                        </button>
                                        <button 
                                            onClick={() => { setDataSource('amazon'); setGroupBy('source'); }} 
                                            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${dataSource === 'amazon' ? 'bg-white shadow text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <BoxIcon className="w-3 h-3" /> Amazon
                                        </button>
                                        <button 
                                            onClick={() => { setDataSource('youtube'); setGroupBy('video'); }} 
                                            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${dataSource === 'youtube' ? 'bg-white shadow text-red-700' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <YoutubeIcon className="w-3 h-3" /> YouTube
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="flex justify-between mb-1"><label className="block text-sm font-bold text-slate-700">Date Range</label><button onClick={() => setIsManagingRanges(true)} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"><EditIcon className="w-3 h-3"/> Manage Custom</button></div>
                                    <select value={datePreset} onChange={e => setDatePreset(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                                        <option value="thisMonth">This Month</option>
                                        <option value="lastMonth">Last Month</option>
                                        <option value="thisYear">This Year</option>
                                        <option value="lastYear">Last Year</option>
                                        <option value="allTime">All Time</option>
                                        <option disabled>──────────</option>
                                        {savedDateRanges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        <option disabled>──────────</option>
                                        <option value="custom">Manual Picker...</option>
                                    </select>
                                    {datePreset === 'custom' && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="border rounded p-1" />
                                            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="border rounded p-1" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Group By</label>
                                        <select value={groupBy} onChange={e => setGroupBy(e.target.value as ReportGroupBy)} className="w-full p-2 border rounded-md text-sm">
                                            {dataSource === 'financial' ? (
                                                <>
                                                    <option value="category">Category</option>
                                                    <option value="counterparty">Counterparty</option>
                                                    <option value="account">Account</option>
                                                    <option value="type">Type</option>
                                                    <option value="tag">Tag</option>
                                                </>
                                            ) : dataSource === 'amazon' ? (
                                                <>
                                                    <option value="source">Source (On/Offsite)</option>
                                                    <option value="category">Category</option>
                                                    <option value="product">Product (ASIN)</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="video">Video</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-200">
                                    <label className="block text-sm font-bold text-slate-700">Filters</label>
                                    
                                    {dataSource === 'financial' ? (
                                        <>
                                            <div className="flex gap-2">{(['expense', 'income', 'investment'] as BalanceEffect[]).map(e => <button key={e} onClick={() => toggleEffect(e)} className={`px-2 py-1 text-xs rounded border uppercase font-bold ${selectedEffects.has(e) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-slate-500'}`}>{e}</button>)}</div>
                                            <MultiSelect label="Categories" options={categories} selectedIds={selectedCategories} onChange={setSelectedCategories} />
                                            <MultiSelect label="Types" options={transactionTypes} selectedIds={selectedTypes} onChange={setSelectedTypes} />
                                            <MultiSelect label="Accounts" options={accounts} selectedIds={selectedAccounts} onChange={setSelectedAccounts} />
                                            <MultiSelect label="Tags" options={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
                                            <MultiSelect label="Counterparties" options={payees} selectedIds={selectedPayees} onChange={setSelectedPayees} />
                                        </>
                                    ) : dataSource === 'amazon' ? (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Traffic Source</label>
                                            <div className="flex flex-wrap gap-2">
                                                {(['onsite', 'offsite', 'creator_connections'] as AmazonReportType[]).map(s => (
                                                    <button key={s} onClick={() => toggleAmazonSource(s)} className={`px-2 py-1 text-xs rounded border uppercase font-bold ${selectedAmazonSources.has(s) ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white text-slate-500'}`}>
                                                        {s.replace('_', ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No additional filters for YouTube reports.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* RIGHT PANEL: PREVIEW */}
                    <div className="w-2/3 flex flex-col bg-slate-50 p-6 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><TableIcon className="w-5 h-5 text-slate-400" /> Live Preview</h3>
                            {dataSource === 'financial' && (
                                <span className="text-sm text-slate-600 font-bold">{previewData.count} items • ${previewData.total.toLocaleString()}</span>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                            {dataSource === 'financial' ? (
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0"><tr><th className="px-3 py-2 text-left text-xs uppercase">Date</th><th className="px-3 py-2 text-left text-xs uppercase">Desc</th><th className="px-3 py-2 text-right text-xs uppercase">Amt</th></tr></thead>
                                    <tbody>{previewData.transactions.slice(0, 50).map(tx => <tr key={tx.id}><td className="px-3 py-2 text-xs">{tx.date}</td><td className="px-3 py-2 text-xs truncate max-w-[200px]">{tx.description}</td><td className="px-3 py-2 text-xs text-right font-mono">${tx.amount.toFixed(2)}</td></tr>)}</tbody>
                                </table>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400">
                                    <p className="text-sm italic">Metrics preview is available in the Reports view.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-xl">
                    {!isManagingRanges && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
                            {initialConfig ? (
                                <>
                                    <button onClick={() => handleSave(true)} className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-sm">Save as New</button>
                                    <button onClick={() => handleSave(false)} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Save</button>
                                </>
                            ) : (
                                <button onClick={() => handleSave(false)} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Create Report</button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportConfigModal;
