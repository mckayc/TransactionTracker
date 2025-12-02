

import React, { useState, useEffect } from 'react';
import type { ReportConfig, Account, Category, User, TransactionType, DateRangePreset, BalanceEffect, Tag, Payee, ReportGroupBy, CustomDateRange, DateRangeUnit, DateRangeType } from '../types';
import { CloseIcon, ChartPieIcon, CalendarIcon, AddIcon, DeleteIcon, EditIcon } from './Icons';
import MultiSelect from './MultiSelect';
import { generateUUID } from '../utils';

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
}

const ReportConfigModal: React.FC<ReportConfigModalProps> = ({ 
    isOpen, onClose, onSave, initialConfig, accounts, categories, users, transactionTypes, tags, payees, savedDateRanges, onSaveDateRange, onDeleteDateRange
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
    const [selectedEffects, setSelectedEffects] = useState<Set<BalanceEffect>>(new Set(['expense']));
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [selectedPayees, setSelectedPayees] = useState<Set<string>>(new Set());

    // Date Range Manager State
    const [isManagingRanges, setIsManagingRanges] = useState(false);
    const [rangeName, setRangeName] = useState('');
    const [rangeType, setRangeType] = useState<DateRangeType>('rolling_window');
    const [rangeValue, setRangeValue] = useState(1);
    const [rangeUnit, setRangeUnit] = useState<DateRangeUnit>('month');
    const [editingRangeId, setEditingRangeId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialConfig) {
                setName(initialConfig.name);
                setDatePreset(initialConfig.datePreset);
                setCustomStartDate(initialConfig.customStartDate || '');
                setCustomEndDate(initialConfig.customEndDate || '');
                setGroupBy(initialConfig.groupBy || 'category');
                setSubGroupBy(initialConfig.subGroupBy || '');
                setSelectedAccounts(new Set(initialConfig.filters.accountIds));
                setSelectedUsers(new Set(initialConfig.filters.userIds));
                setSelectedCategories(new Set(initialConfig.filters.categoryIds));
                setSelectedTypes(new Set(initialConfig.filters.typeIds));
                setSelectedEffects(new Set(initialConfig.filters.balanceEffects || ['expense']));
                setSelectedTags(new Set(initialConfig.filters.tagIds));
                setSelectedPayees(new Set(initialConfig.filters.payeeIds));
            } else {
                setName('');
                setDatePreset('thisMonth');
                setCustomStartDate('');
                setCustomEndDate('');
                setGroupBy('category');
                setSubGroupBy('');
                setSelectedAccounts(new Set());
                setSelectedUsers(new Set());
                setSelectedCategories(new Set());
                setSelectedTypes(new Set());
                setSelectedEffects(new Set(['expense']));
                setSelectedTags(new Set());
                setSelectedPayees(new Set());
            }
            setIsManagingRanges(false);
        }
    }, [isOpen, initialConfig]);

    if (!isOpen) return null;

    const handleSave = () => {
        const config: ReportConfig = {
            id: initialConfig?.id || generateUUID(),
            name: name.trim() || 'New Report',
            datePreset,
            // customStartDate is used for Custom Date, Specific Month (YYYY-MM), or Relative Offset (string "N")
            customStartDate: ['custom', 'specificMonth', 'relativeMonth'].includes(datePreset) ? customStartDate : undefined,
            customEndDate: datePreset === 'custom' ? customEndDate : undefined,
            groupBy,
            subGroupBy: subGroupBy || undefined,
            filters: {
                accountIds: selectedAccounts.size > 0 ? Array.from(selectedAccounts) : undefined,
                userIds: selectedUsers.size > 0 ? Array.from(selectedUsers) : undefined,
                categoryIds: selectedCategories.size > 0 ? Array.from(selectedCategories) : undefined,
                typeIds: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
                balanceEffects: Array.from(selectedEffects),
                tagIds: selectedTags.size > 0 ? Array.from(selectedTags) : undefined,
                payeeIds: selectedPayees.size > 0 ? Array.from(selectedPayees) : undefined,
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

    const handleSaveRange = () => {
        if (!rangeName.trim()) {
            alert("Range name is required");
            return;
        }
        
        const newRange: CustomDateRange = {
            id: editingRangeId || generateUUID(),
            name: rangeName.trim(),
            type: rangeType,
            unit: rangeUnit,
            value: rangeValue
        };
        
        onSaveDateRange(newRange);
        // Reset form
        setEditingRangeId(null);
        setRangeName('');
        setRangeType('rolling_window');
        setRangeValue(1);
        setRangeUnit('month');
        // If creating new, automatically select it
        if (!editingRangeId) {
            setDatePreset(newRange.id);
            setIsManagingRanges(false);
        }
    };

    const handleEditRange = (range: CustomDateRange) => {
        setEditingRangeId(range.id);
        setRangeName(range.name);
        setRangeType(range.type);
        setRangeValue(range.value);
        setRangeUnit(range.unit);
    };

    const getRangeDescription = () => {
        const unitLabel = rangeValue === 1 ? rangeUnit : `${rangeUnit}s`;
        if (rangeType === 'rolling_window') {
            return `Show data for the last ${rangeValue} ${unitLabel}, including today.`;
        } else {
            if (rangeUnit === 'day') return `Show data for the specific day ${rangeValue} days ago.`;
            if (rangeUnit === 'month') return `Show data for the specific calendar month ${rangeValue} months ago.`;
            if (rangeUnit === 'year') return `Show data for the specific calendar year ${rangeValue} years ago.`;
            if (rangeUnit === 'quarter') return `Show data for the specific quarter ${rangeValue} quarters ago.`;
            return `Show data for the period ${rangeValue} ${unitLabel} prior to the current one.`;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {isManagingRanges ? <CalendarIcon className="w-6 h-6 text-indigo-600"/> : <ChartPieIcon className="w-6 h-6 text-indigo-600" />}
                        {isManagingRanges ? 'Manage Custom Date Ranges' : (initialConfig ? 'Edit Report Config' : 'New Report Config')}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    
                    {isManagingRanges ? (
                        <div className="space-y-6">
                            {/* Range Builder Form */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                                <h3 className="font-bold text-slate-700">{editingRangeId ? 'Edit Range' : 'Create New Range'}</h3>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Range Name</label>
                                    <input 
                                        type="text" 
                                        value={rangeName} 
                                        onChange={e => setRangeName(e.target.value)} 
                                        placeholder="e.g. Trailing 6 Months" 
                                        className="w-full p-2 border rounded-md"
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-3 rounded-md border border-slate-200">
                                    <span className="text-sm font-medium text-slate-600">Show me the</span>
                                    
                                    <select 
                                        value={rangeType} 
                                        onChange={(e) => setRangeType(e.target.value as DateRangeType)}
                                        className="p-1.5 border rounded-md text-sm bg-indigo-50 font-semibold text-indigo-700"
                                    >
                                        <option value="rolling_window">Last (Rolling)</option>
                                        <option value="fixed_period">Specific (Fixed)</option>
                                    </select>

                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="100" 
                                        value={rangeValue} 
                                        onChange={e => setRangeValue(parseInt(e.target.value) || 1)}
                                        className="w-16 p-1.5 border rounded-md text-center font-bold"
                                    />

                                    <select 
                                        value={rangeUnit} 
                                        onChange={(e) => setRangeUnit(e.target.value as DateRangeUnit)}
                                        className="p-1.5 border rounded-md text-sm font-medium"
                                    >
                                        <option value="day">{rangeValue === 1 ? 'Day' : 'Days'}</option>
                                        <option value="week">{rangeValue === 1 ? 'Week' : 'Weeks'}</option>
                                        <option value="month">{rangeValue === 1 ? 'Month' : 'Months'}</option>
                                        <option value="quarter">{rangeValue === 1 ? 'Quarter' : 'Quarters'}</option>
                                        <option value="year">{rangeValue === 1 ? 'Year' : 'Years'}</option>
                                    </select>
                                    
                                    {rangeType === 'fixed_period' && <span className="text-sm font-medium text-slate-600">ago</span>}
                                </div>
                                
                                <p className="text-xs text-slate-500 italic text-center">{getRangeDescription()}</p>

                                <div className="flex justify-end gap-2">
                                    {editingRangeId && (
                                        <button onClick={() => { setEditingRangeId(null); setRangeName(''); setRangeValue(1); }} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded">Cancel Edit</button>
                                    )}
                                    <button onClick={handleSaveRange} className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700">
                                        {editingRangeId ? 'Update Range' : 'Save Range'}
                                    </button>
                                </div>
                            </div>

                            {/* Saved Ranges List */}
                            <div>
                                <h3 className="font-bold text-slate-700 mb-2">Saved Custom Ranges</h3>
                                {savedDateRanges.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No custom ranges created yet.</p>
                                ) : (
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {savedDateRanges.map(range => (
                                            <li key={range.id} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded-md hover:border-indigo-200">
                                                <span className="text-sm font-medium text-slate-700">{range.name}</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleEditRange(range)} className="p-1 text-slate-400 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                                    <button onClick={() => onDeleteDateRange(range.id)} className="p-1 text-slate-400 hover:text-red-500"><DeleteIcon className="w-4 h-4"/></button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            
                            <div className="pt-4 border-t">
                                <button onClick={() => setIsManagingRanges(false)} className="text-sm text-indigo-600 font-medium hover:underline">← Back to Report Config</button>
                            </div>
                        </div>
                    ) : (
                        // Standard Report Config
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Report Name</label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    placeholder="e.g., Monthly Expenses" 
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Group By (Level 1)</label>
                                    <select 
                                        value={groupBy} 
                                        onChange={(e) => setGroupBy(e.target.value as ReportGroupBy)}
                                        className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        <option value="category">Category</option>
                                        <option value="account">Account</option>
                                        <option value="payee">Payee</option>
                                        <option value="type">Transaction Type</option>
                                        <option value="tag">Tag</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Then Group By (Level 2)</label>
                                    <select 
                                        value={subGroupBy} 
                                        onChange={(e) => setSubGroupBy(e.target.value as any)}
                                        className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        <option value="">-- None --</option>
                                        <option value="category">Category</option>
                                        <option value="account">Account</option>
                                        <option value="payee">Payee</option>
                                        <option value="type">Transaction Type</option>
                                        <option value="tag">Tag</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-slate-700">Date Range</label>
                                    <button 
                                        onClick={() => setIsManagingRanges(true)}
                                        className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <AddIcon className="w-3 h-3"/> Manage Custom Ranges
                                    </button>
                                </div>
                                <select 
                                    value={datePreset} 
                                    onChange={(e) => {
                                        const newVal = e.target.value as DateRangePreset;
                                        setDatePreset(newVal);
                                        // Set reasonable defaults for dynamic fields if empty
                                        if (newVal === 'specificMonth' && !customStartDate) {
                                            const now = new Date();
                                            setCustomStartDate(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
                                        }
                                    }}
                                    className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-2"
                                >
                                    <optgroup label="Standard Ranges">
                                        <option value="thisMonth">This Month</option>
                                        <option value="lastMonth">Last Month</option>
                                        <option value="thisYear">This Year</option>
                                        <option value="lastYear">Last Year</option>
                                    </optgroup>
                                    <optgroup label="Custom Options">
                                        <option value="specificMonth">Specific Month</option>
                                        <option value="custom">Date Range Picker</option>
                                    </optgroup>
                                    {savedDateRanges.length > 0 && (
                                        <optgroup label="My Custom Ranges">
                                            {savedDateRanges.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>

                                {datePreset === 'specificMonth' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Select Month</label>
                                        <input 
                                            type="month" 
                                            value={customStartDate} 
                                            onChange={e => setCustomStartDate(e.target.value)} 
                                            className="w-full p-2 border rounded-md" 
                                        />
                                    </div>
                                )}
                                
                                {datePreset === 'custom' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Start Date</label>
                                            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full p-2 border rounded-md" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">End Date</label>
                                            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full p-2 border rounded-md" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <label className="block text-sm font-bold text-slate-700">Filters</label>
                                
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Balance Impact</label>
                                    <div className="flex gap-2">
                                        {(['expense', 'income', 'investment'] as BalanceEffect[]).map(effect => (
                                            <button
                                                key={effect}
                                                type="button"
                                                onClick={() => toggleEffect(effect)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition-colors ${selectedEffects.has(effect) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                {effect}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <MultiSelect label="Accounts" options={accounts} selectedIds={selectedAccounts} onChange={setSelectedAccounts} />
                                    <MultiSelect label="Categories" options={categories} selectedIds={selectedCategories} onChange={setSelectedCategories} />
                                    <MultiSelect label="Transaction Types" options={transactionTypes} selectedIds={selectedTypes} onChange={setSelectedTypes} />
                                    <MultiSelect label="Users" options={users} selectedIds={selectedUsers} onChange={setSelectedUsers} />
                                    <MultiSelect label="Tags" options={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
                                    <MultiSelect label="Payees" options={payees} selectedIds={selectedPayees} onChange={setSelectedPayees} />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
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