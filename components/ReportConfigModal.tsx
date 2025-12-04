
import React, { useState, useEffect, useMemo } from 'react';
import type { ReportConfig, Account, Category, User, TransactionType, DateRangePreset, BalanceEffect, Tag, Payee, ReportGroupBy, CustomDateRange, DateRangeUnit, DateRangeType, DateOffset, Transaction } from '../types';
import { CloseIcon, ChartPieIcon, CalendarIcon, AddIcon, DeleteIcon, EditIcon, TableIcon, ExclamationTriangleIcon } from './Icons';
import MultiSelect from './MultiSelect';
import { generateUUID } from '../utils';
import { calculateDateRange } from './ReportColumn';

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
    payees: Payee[];
    savedDateRanges: CustomDateRange[];
    onSaveDateRange: (range: CustomDateRange) => void;
    onDeleteDateRange: (id: string) => void;
    transactions: Transaction[]; // New prop for live preview
}

const ReportConfigModal: React.FC<ReportConfigModalProps> = ({ 
    isOpen, onClose, onSave, initialConfig, accounts, categories, users, transactionTypes, tags, payees, savedDateRanges, onSaveDateRange, onDeleteDateRange, transactions
}) => {
    const [name, setName] = useState('');
    const [datePreset, setDatePreset] = useState<DateRangePreset>('thisMonth');
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

    // Date Range Manager State
    const [isManagingRanges, setIsManagingRanges] = useState(false);
    const [rangeName, setRangeName] = useState('');
    const [rangeType, setRangeType] = useState<DateRangeType>('rolling_window');
    const [rangeValue, setRangeValue] = useState(1);
    const [rangeUnit, setRangeUnit] = useState<DateRangeUnit>('month');
    const [rangeOffsets, setRangeOffsets] = useState<DateOffset[]>([]);
    const [editingRangeId, setEditingRangeId] = useState<string | null>(null);

    // Initialization
    useEffect(() => {
        if (isOpen) {
            if (initialConfig) {
                // Editing existing report: Load strict state
                setName(initialConfig.name);
                setDatePreset(initialConfig.datePreset);
                setCustomStartDate(initialConfig.customStartDate || '');
                setCustomEndDate(initialConfig.customEndDate || '');
                setGroupBy(initialConfig.groupBy || 'category');
                setSubGroupBy(initialConfig.subGroupBy || '');
                
                // If the config has undefined filters, it means "Include All" was saved.
                // We re-hydrate the sets with ALL IDs so the UI reflects "All Selected".
                setSelectedAccounts(initialConfig.filters.accountIds ? new Set(initialConfig.filters.accountIds) : new Set(accounts.map(a => a.id)));
                setSelectedUsers(initialConfig.filters.userIds ? new Set(initialConfig.filters.userIds) : new Set(users.map(u => u.id)));
                setSelectedCategories(initialConfig.filters.categoryIds ? new Set(initialConfig.filters.categoryIds) : new Set(categories.map(c => c.id)));
                setSelectedTypes(initialConfig.filters.typeIds ? new Set(initialConfig.filters.typeIds) : new Set(transactionTypes.map(t => t.id)));
                setSelectedEffects(new Set(initialConfig.filters.balanceEffects || ['expense', 'income']));
                setSelectedTags(initialConfig.filters.tagIds ? new Set(initialConfig.filters.tagIds) : new Set(tags.map(t => t.id)));
                setSelectedPayees(initialConfig.filters.payeeIds ? new Set(initialConfig.filters.payeeIds) : new Set(payees.map(p => p.id)));
            } else {
                // Creating NEW report: Default to "All Selected"
                setName('');
                setDatePreset('thisMonth');
                setCustomStartDate('');
                setCustomEndDate('');
                setGroupBy('category');
                setSubGroupBy('');
                
                setSelectedAccounts(new Set(accounts.map(a => a.id)));
                setSelectedUsers(new Set(users.map(u => u.id)));
                setSelectedCategories(new Set(categories.map(c => c.id)));
                setSelectedTypes(new Set(transactionTypes.map(t => t.id)));
                // Effects are special; usually people want Expenses by default, but let's do expense+income to be safe
                setSelectedEffects(new Set(['expense', 'income']));
                setSelectedTags(new Set(tags.map(t => t.id)));
                setSelectedPayees(new Set(payees.map(p => p.id)));
            }
            setIsManagingRanges(false);
        }
    }, [isOpen, initialConfig, accounts, categories, users, transactionTypes, tags, payees]);

    // Live Preview Logic
    const previewData = useMemo(() => {
        if (!isOpen) return { transactions: [], total: 0, count: 0, dateLabel: '' };

        const { start, end, label } = calculateDateRange(datePreset, customStartDate, customEndDate, savedDateRanges);
        
        // Adjust end date to include the full day
        const filterEnd = new Date(end);
        filterEnd.setHours(23, 59, 59, 999);

        const filtered = transactions.filter(tx => {
            if (tx.isParent) return false;
            
            const txDate = new Date(tx.date);
            if (txDate < start || txDate > filterEnd) return false;

            if (!selectedEffects.has('income') && !selectedEffects.has('expense') && !selectedEffects.has('transfer') && !selectedEffects.has('investment')) return false;
            
            const type = transactionTypes.find(t => t.id === tx.typeId);
            if (!type || !selectedEffects.has(type.balanceEffect)) return false;

            // Strict Filter Matching (if set is empty, nothing matches in this logic, but sets are initialized full)
            if (selectedAccounts.size > 0 && !selectedAccounts.has(tx.accountId || '')) return false;
            if (selectedUsers.size > 0 && !selectedUsers.has(tx.userId || '')) return false;
            
            // Allow category matching if set has items
            if (selectedCategories.size > 0 && !selectedCategories.has(tx.categoryId)) return false;
            
            if (selectedTypes.size > 0 && !selectedTypes.has(tx.typeId)) return false;
            
            // Tags: If transaction has tags, check if at least one is selected. If no tags on tx, include if "No Tags" logic handled? 
            // Simplified: If filter is active (not all selected), only show txs with those tags.
            // If all selected, show everything.
            if (selectedTags.size < tags.length) {
                 if (!tx.tagIds || !tx.tagIds.some(tId => selectedTags.has(tId))) return false;
            }

            if (selectedPayees.size > 0 && selectedPayees.size < payees.length) {
                if (!selectedPayees.has(tx.payeeId || '')) return false;
            }

            return true;
        });

        // Sort by Date Descending
        filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

        return { transactions: filtered, total, count: filtered.length, dateLabel: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}` };

    }, [isOpen, transactions, datePreset, customStartDate, customEndDate, savedDateRanges, selectedAccounts, selectedCategories, selectedTypes, selectedUsers, selectedTags, selectedPayees, selectedEffects]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Smart Save: If all items are selected, save as undefined (dynamic all)
        const isAllAccounts = selectedAccounts.size === accounts.length;
        const isAllCategories = selectedCategories.size === categories.length;
        const isAllUsers = selectedUsers.size === users.length;
        const isAllTypes = selectedTypes.size === transactionTypes.length;
        const isAllTags = selectedTags.size === tags.length;
        const isAllPayees = selectedPayees.size === payees.length;

        const config: ReportConfig = {
            id: initialConfig?.id || generateUUID(),
            name: name.trim() || 'New Report',
            datePreset,
            customStartDate: ['custom', 'specificMonth', 'relativeMonth'].includes(datePreset) ? customStartDate : undefined,
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
                payeeIds: isAllPayees ? undefined : Array.from(selectedPayees),
            },
            hiddenCategoryIds: initialConfig?.hiddenCategoryIds || [],
            hiddenIds: initialConfig?.hiddenIds || []
        };
        onSave(config);
        onClose();
    };

    const toggleEffect = (effect: BalanceEffect) => {
        const newSet = new Set(selectedEffects);
        if (newSet.has(effect)) newSet.delete(effect);
        else newSet.add(effect);
        setSelectedEffects(newSet);
    };

    // ... (Date Range Management Handlers unchanged) ...
    const handleSaveRange = () => {
        if (!rangeName.trim()) { alert("Range name is required"); return; }
        const newRange: CustomDateRange = {
            id: editingRangeId || generateUUID(),
            name: rangeName.trim(),
            type: rangeType,
            unit: rangeUnit,
            value: rangeValue,
            offsets: rangeType === 'fixed_period' ? rangeOffsets : undefined
        };
        onSaveDateRange(newRange);
        resetRangeForm();
        if (!editingRangeId) { setDatePreset(newRange.id); setIsManagingRanges(false); }
    };
    const resetRangeForm = () => {
        setEditingRangeId(null); setRangeName(''); setRangeType('rolling_window'); setRangeValue(1); setRangeUnit('month'); setRangeOffsets([]);
    };
    const handleEditRange = (range: CustomDateRange) => {
        setEditingRangeId(range.id); setRangeName(range.name); setRangeType(range.type); setRangeValue(range.value); setRangeUnit(range.unit);
        if (range.type === 'fixed_period') {
            setRangeOffsets(range.offsets && range.offsets.length > 0 ? range.offsets : [{ value: range.value, unit: range.unit }]);
        } else { setRangeOffsets([]); }
    };
    const handleAddOffset = () => setRangeOffsets([...rangeOffsets, { value: 1, unit: 'year' }]);
    const handleRemoveOffset = (index: number) => setRangeOffsets(prev => prev.filter((_, i) => i !== index));
    const handleUpdateOffset = (index: number, field: keyof DateOffset, value: any) => {
        setRangeOffsets(prev => { const updated = [...prev]; updated[index] = { ...updated[index], [field]: value }; return updated; });
    };
    const getRangeDescription = () => {
        if (rangeType === 'rolling_window') {
            const unitLabel = rangeValue === 1 ? rangeUnit : `${rangeUnit}s`;
            return `Show data for the last ${rangeValue} ${unitLabel}, including today.`;
        } else {
            let desc = `Show data for the specific ${rangeUnit}`;
            if (rangeOffsets.length > 0) {
                const offsets = rangeOffsets.map(o => `${o.value} ${o.unit}${o.value === 1 ? '' : 's'}`).join(' + ');
                desc += ` that happened ${offsets} ago.`;
            } else { desc += ` (No offset configured)`; }
            return desc;
        }
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
                    {/* LEFT PANEL: CONFIGURATION */}
                    <div className="w-1/3 min-w-[350px] border-r border-slate-200 overflow-y-auto p-6 bg-white flex flex-col gap-6">
                        
                        {isManagingRanges ? (
                            // ... Existing Date Range Manager UI ...
                            <div className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                                    <h3 className="font-bold text-slate-700">{editingRangeId ? 'Edit Range' : 'Create New Range'}</h3>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Range Name</label>
                                        <input type="text" value={rangeName} onChange={e => setRangeName(e.target.value)} placeholder="e.g. Trailing 6 Months" className="w-full p-2 border rounded-md" />
                                    </div>
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={() => setRangeType('rolling_window')} className={`flex-1 py-2 text-sm font-medium rounded-md border ${rangeType === 'rolling_window' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>Rolling Window</button>
                                        <button onClick={() => { setRangeType('fixed_period'); if (rangeOffsets.length === 0) setRangeOffsets([{value: 1, unit: rangeUnit}]); }} className={`flex-1 py-2 text-sm font-medium rounded-md border ${rangeType === 'fixed_period' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>Fixed Period</button>
                                    </div>
                                    {rangeType === 'rolling_window' ? (
                                        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-3 rounded-md border border-slate-200">
                                            <span className="text-sm font-medium text-slate-600">Show me the Last</span>
                                            <input type="number" min="1" max="100" value={rangeValue} onChange={e => setRangeValue(parseInt(e.target.value) || 1)} className="w-16 p-1.5 border rounded-md text-center font-bold" />
                                            <select value={rangeUnit} onChange={(e) => setRangeUnit(e.target.value as DateRangeUnit)} className="p-1.5 border rounded-md text-sm font-medium">
                                                <option value="day">{rangeValue === 1 ? 'Day' : 'Days'}</option>
                                                <option value="week">{rangeValue === 1 ? 'Week' : 'Weeks'}</option>
                                                <option value="month">{rangeValue === 1 ? 'Month' : 'Months'}</option>
                                                <option value="quarter">{rangeValue === 1 ? 'Quarter' : 'Quarters'}</option>
                                                <option value="year">{rangeValue === 1 ? 'Year' : 'Years'}</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 bg-white p-3 rounded-md border border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-slate-600">Show data for the specific</span>
                                                <select value={rangeUnit} onChange={(e) => setRangeUnit(e.target.value as DateRangeUnit)} className="p-1.5 border rounded-md text-sm font-bold text-indigo-700 bg-indigo-50">
                                                    <option value="day">Day</option>
                                                    <option value="week">Week</option>
                                                    <option value="month">Month</option>
                                                    <option value="quarter">Quarter</option>
                                                    <option value="year">Year</option>
                                                </select>
                                            </div>
                                            <div className="border-t pt-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Happening:</label>
                                                <div className="space-y-2">
                                                    {rangeOffsets.map((offset, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <input type="number" min="1" value={offset.value} onChange={e => handleUpdateOffset(idx, 'value', parseInt(e.target.value) || 1)} className="w-16 p-1.5 border rounded-md text-center font-bold" />
                                                            <select value={offset.unit} onChange={(e) => handleUpdateOffset(idx, 'unit', e.target.value as DateRangeUnit)} className="p-1.5 border rounded-md text-sm font-medium">
                                                                <option value="day">Day(s)</option>
                                                                <option value="week">Week(s)</option>
                                                                <option value="month">Month(s)</option>
                                                                <option value="quarter">Quarter(s)</option>
                                                                <option value="year">Year(s)</option>
                                                            </select>
                                                            <span className="text-sm text-slate-600">ago</span>
                                                            <button onClick={() => handleRemoveOffset(idx)} className="text-slate-400 hover:text-red-500 p-1"><DeleteIcon className="w-4 h-4" /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={handleAddOffset} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"><AddIcon className="w-3 h-3" /> Add Offset</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500 italic text-center px-4">{getRangeDescription()}</p>
                                    <div className="flex justify-end gap-2">
                                        {editingRangeId && <button onClick={resetRangeForm} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded">Cancel Edit</button>}
                                        <button onClick={handleSaveRange} className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700">{editingRangeId ? 'Update Range' : 'Save Range'}</button>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-700 mb-2">Saved Custom Ranges</h3>
                                    {savedDateRanges.length === 0 ? <p className="text-sm text-slate-500 italic">No custom ranges created yet.</p> : (
                                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                                            {savedDateRanges.map(range => (
                                                <li key={range.id} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded-md hover:border-indigo-200">
                                                    <div><span className="text-sm font-medium text-slate-700 block">{range.name}</span><span className="text-[10px] text-slate-500 capitalize">{range.type.replace('_', ' ')}</span></div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleEditRange(range)} className="p-1 text-slate-400 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                                        <button onClick={() => onDeleteDateRange(range.id)} className="p-1 text-slate-400 hover:text-red-500"><DeleteIcon className="w-4 h-4"/></button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="pt-4 border-t"><button onClick={() => setIsManagingRanges(false)} className="text-sm text-indigo-600 font-medium hover:underline">← Back to Report Config</button></div>
                            </div>
                        ) : (
                            // STANDARD CONFIG
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Report Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Monthly Expenses" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" autoFocus />
                                </div>

                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-bold text-slate-700">Date Range</label>
                                        <button onClick={() => setIsManagingRanges(true)} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"><AddIcon className="w-3 h-3"/> Manage Custom Ranges</button>
                                    </div>
                                    <select 
                                        value={datePreset} 
                                        onChange={(e) => {
                                            const newVal = e.target.value as DateRangePreset;
                                            setDatePreset(newVal);
                                            if (newVal === 'specificMonth' && !customStartDate) {
                                                const now = new Date();
                                                setCustomStartDate(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
                                            }
                                        }}
                                        className="w-full p-2 border rounded-md bg-white mb-2"
                                    >
                                        <optgroup label="Standard Ranges">
                                            <option value="thisMonth">This Month</option>
                                            <option value="lastMonth">Last Month</option>
                                            <option value="thisYear">This Year</option>
                                            <option value="lastYear">Last Year</option>
                                            <option value="allTime">All Time</option>
                                        </optgroup>
                                        <optgroup label="Custom Options">
                                            <option value="specificMonth">Specific Month</option>
                                            <option value="custom">Date Range Picker</option>
                                        </optgroup>
                                        {savedDateRanges.length > 0 && <optgroup label="My Custom Ranges">{savedDateRanges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>}
                                    </select>
                                    {datePreset === 'specificMonth' && <input type="month" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full p-2 border rounded-md" />}
                                    {datePreset === 'custom' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="text-xs uppercase">Start</label><input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full p-1 border rounded" /></div>
                                            <div><label className="text-xs uppercase">End</label><input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full p-1 border rounded" /></div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Group By (1)</label>
                                        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as ReportGroupBy)} className="w-full p-2 border rounded-md text-sm">
                                            <option value="category">Category</option>
                                            <option value="account">Account</option>
                                            <option value="payee">Payee</option>
                                            <option value="type">Type</option>
                                            <option value="tag">Tag</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Group By (2)</label>
                                        <select value={subGroupBy} onChange={(e) => setSubGroupBy(e.target.value as any)} className="w-full p-2 border rounded-md text-sm">
                                            <option value="">-- None --</option>
                                            <option value="category">Category</option>
                                            <option value="account">Account</option>
                                            <option value="payee">Payee</option>
                                            <option value="type">Type</option>
                                            <option value="tag">Tag</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-200">
                                    <label className="block text-sm font-bold text-slate-700">Filters</label>
                                    
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Balance Impact</label>
                                        <div className="flex gap-2">
                                            {(['expense', 'income', 'investment'] as BalanceEffect[]).map(effect => (
                                                <button key={effect} type="button" onClick={() => toggleEffect(effect)} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition-colors ${selectedEffects.has(effect) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}>{effect}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <MultiSelect label="Accounts" options={accounts} selectedIds={selectedAccounts} onChange={setSelectedAccounts} />
                                    <MultiSelect label="Categories" options={categories} selectedIds={selectedCategories} onChange={setSelectedCategories} />
                                    <MultiSelect label="Transaction Types" options={transactionTypes} selectedIds={selectedTypes} onChange={setSelectedTypes} />
                                    <MultiSelect label="Users" options={users} selectedIds={selectedUsers} onChange={setSelectedUsers} />
                                    <MultiSelect label="Tags" options={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
                                    <MultiSelect label="Payees" options={payees} selectedIds={selectedPayees} onChange={setSelectedPayees} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* RIGHT PANEL: LIVE PREVIEW */}
                    <div className="w-2/3 flex flex-col bg-slate-50 p-6 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <TableIcon className="w-5 h-5 text-slate-400" />
                                Live Preview
                            </h3>
                            <div className="text-right">
                                <span className="block text-xs font-bold text-slate-500 uppercase">{previewData.dateLabel}</span>
                                <span className="text-sm text-slate-600">
                                    <span className="font-bold text-slate-800">{previewData.count}</span> transactions totaling <span className="font-mono font-bold text-slate-800">${previewData.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </span>
                            </div>
                        </div>

                        {previewData.transactions.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl">
                                <ExclamationTriangleIcon className="w-10 h-10 text-slate-300 mb-2" />
                                <p className="text-slate-500 font-medium">No transactions match these filters.</p>
                                <p className="text-xs text-slate-400 mt-1">Try adjusting the date range or selecting more categories.</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {previewData.transactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{tx.date}</td>
                                                <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[200px]" title={tx.description}>{tx.description}</td>
                                                <td className="px-3 py-2 text-xs text-slate-700 font-mono text-right whitespace-nowrap">${tx.amount.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-xl">
                    {!isManagingRanges && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Save Report</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportConfigModal;
