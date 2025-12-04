
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
    transactions: Transaction[];
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
                // Editing existing report - STRICTLY preserve ID to allow updating existing records
                setName(initialConfig.name);
                setDatePreset(initialConfig.datePreset);
                setCustomStartDate(initialConfig.customStartDate || '');
                setCustomEndDate(initialConfig.customEndDate || '');
                setGroupBy(initialConfig.groupBy || 'category');
                setSubGroupBy(initialConfig.subGroupBy || '');
                
                // Hydrate filters
                setSelectedAccounts(initialConfig.filters.accountIds ? new Set(initialConfig.filters.accountIds) : new Set(accounts.map(a => a.id)));
                setSelectedUsers(initialConfig.filters.userIds ? new Set(initialConfig.filters.userIds) : new Set(users.map(u => u.id)));
                setSelectedCategories(initialConfig.filters.categoryIds ? new Set(initialConfig.filters.categoryIds) : new Set(categories.map(c => c.id)));
                setSelectedTypes(initialConfig.filters.typeIds ? new Set(initialConfig.filters.typeIds) : new Set(transactionTypes.map(t => t.id)));
                setSelectedEffects(new Set(initialConfig.filters.balanceEffects || ['expense', 'income']));
                setSelectedTags(initialConfig.filters.tagIds ? new Set(initialConfig.filters.tagIds) : new Set(tags.map(t => t.id)));
                setSelectedPayees(initialConfig.filters.payeeIds ? new Set(initialConfig.filters.payeeIds) : new Set(payees.map(p => p.id)));
            } else {
                // Creating NEW report
                setName('');
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
            }
            setIsManagingRanges(false);
        }
    }, [isOpen, initialConfig, accounts, categories, users, transactionTypes, tags, payees]);

    // Live Preview Logic
    const previewData = useMemo(() => {
        if (!isOpen) return { transactions: [], total: 0, count: 0, dateLabel: '' };
        const { start, end } = calculateDateRange(datePreset, customStartDate, customEndDate, savedDateRanges);
        const filterEnd = new Date(end);
        filterEnd.setHours(23, 59, 59, 999);

        const filtered = transactions.filter(tx => {
            if (tx.isParent) return false;
            const txDate = new Date(tx.date);
            if (txDate < start || txDate > filterEnd) return false;
            const type = transactionTypes.find(t => t.id === tx.typeId);
            if (!type || !selectedEffects.has(type.balanceEffect)) return false;
            
            // Basic inclusion checks
            if (selectedAccounts.size > 0 && !selectedAccounts.has(tx.accountId || '')) return false;
            if (selectedUsers.size > 0 && !selectedUsers.has(tx.userId || '')) return false;
            if (selectedCategories.size > 0 && !selectedCategories.has(tx.categoryId)) return false;
            if (selectedTypes.size > 0 && !selectedTypes.has(tx.typeId)) return false;
            if (selectedPayees.size > 0 && selectedPayees.size < payees.length && !selectedPayees.has(tx.payeeId || '')) return false;
            if (selectedTags.size < tags.length && (!tx.tagIds || !tx.tagIds.some(tId => selectedTags.has(tId)))) return false;

            return true;
        });

        filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

        return { transactions: filtered, total, count: filtered.length, dateLabel: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}` };
    }, [isOpen, transactions, datePreset, customStartDate, customEndDate, savedDateRanges, selectedAccounts, selectedCategories, selectedTypes, selectedUsers, selectedTags, selectedPayees, selectedEffects]);

    if (!isOpen) return null;

    const handleSave = () => {
        const isAllAccounts = selectedAccounts.size === accounts.length;
        const isAllCategories = selectedCategories.size === categories.length;
        const isAllUsers = selectedUsers.size === users.length;
        const isAllTypes = selectedTypes.size === transactionTypes.length;
        const isAllTags = selectedTags.size === tags.length;
        const isAllPayees = selectedPayees.size === payees.length;

        const config: ReportConfig = {
            id: initialConfig?.id || generateUUID(), // Preserve ID if editing to allow overwriting
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

    // Range Management Handlers
    const toggleEffect = (effect: BalanceEffect) => {
        const newSet = new Set(selectedEffects);
        if (newSet.has(effect)) newSet.delete(effect); else newSet.add(effect);
        setSelectedEffects(newSet);
    };
    const handleSaveRange = () => {
        if (!rangeName.trim()) { alert("Range name is required"); return; }
        const newRange: CustomDateRange = { id: editingRangeId || generateUUID(), name: rangeName.trim(), type: rangeType, unit: rangeUnit, value: rangeValue, offsets: rangeType === 'fixed_period' ? rangeOffsets : undefined };
        onSaveDateRange(newRange);
        setEditingRangeId(null); setRangeName(''); setRangeType('rolling_window'); setRangeValue(1); setRangeUnit('month'); setRangeOffsets([]);
        if (!editingRangeId) { setDatePreset(newRange.id); setIsManagingRanges(false); }
    };
    const handleUpdateOffset = (index: number, field: keyof DateOffset, value: any) => { setRangeOffsets(prev => { const updated = [...prev]; updated[index] = { ...updated[index], [field]: value }; return updated; }); };

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
                                    <h3 className="font-bold text-slate-700">{editingRangeId ? 'Edit Range' : 'Create New Range'}</h3>
                                    <input type="text" value={rangeName} onChange={e => setRangeName(e.target.value)} placeholder="Range Name" className="w-full p-2 border rounded-md" />
                                    {/* Simplified UI for brevity in this snippet */}
                                    <div className="flex justify-end gap-2"><button onClick={handleSaveRange} className="px-4 py-1.5 bg-indigo-600 text-white rounded-md">Save</button></div>
                                </div>
                                <div className="pt-4 border-t"><button onClick={() => setIsManagingRanges(false)} className="text-sm text-indigo-600 hover:underline">Back</button></div>
                            </div>
                        ) : (
                            // Standard Config UI
                            <>
                                <div><label className="block text-sm font-bold text-slate-700 mb-1">Report Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-md" /></div>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="flex justify-between mb-1"><label className="block text-sm font-bold text-slate-700">Date Range</label><button onClick={() => setIsManagingRanges(true)} className="text-xs text-indigo-600 font-bold hover:underline"><AddIcon className="w-3 h-3"/> Custom</button></div>
                                    <select value={datePreset} onChange={e => setDatePreset(e.target.value as DateRangePreset)} className="w-full p-2 border rounded-md bg-white">
                                        <option value="thisMonth">This Month</option>
                                        <option value="lastMonth">Last Month</option>
                                        <option value="thisYear">This Year</option>
                                        <option value="lastYear">Last Year</option>
                                        <option value="allTime">All Time</option>
                                        <option value="custom">Custom Picker</option>
                                        {savedDateRanges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    {datePreset === 'custom' && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="border rounded p-1" />
                                            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="border rounded p-1" />
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-xs font-bold text-slate-500 uppercase">Group By</label><select value={groupBy} onChange={e => setGroupBy(e.target.value as ReportGroupBy)} className="w-full p-2 border rounded-md text-sm"><option value="category">Category</option><option value="payee">Payee</option><option value="account">Account</option><option value="type">Type</option><option value="tag">Tag</option></select></div>
                                </div>
                                <div className="space-y-3 pt-4 border-t border-slate-200">
                                    <label className="block text-sm font-bold text-slate-700">Filters</label>
                                    <div className="flex gap-2">{(['expense', 'income', 'investment'] as BalanceEffect[]).map(e => <button key={e} onClick={() => toggleEffect(e)} className={`px-2 py-1 text-xs rounded border uppercase font-bold ${selectedEffects.has(e) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-slate-500'}`}>{e}</button>)}</div>
                                    <MultiSelect label="Categories" options={categories} selectedIds={selectedCategories} onChange={setSelectedCategories} />
                                    <MultiSelect label="Types" options={transactionTypes} selectedIds={selectedTypes} onChange={setSelectedTypes} />
                                    <MultiSelect label="Accounts" options={accounts} selectedIds={selectedAccounts} onChange={setSelectedAccounts} />
                                    <MultiSelect label="Tags" options={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
                                    <MultiSelect label="Payees" options={payees} selectedIds={selectedPayees} onChange={setSelectedPayees} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* RIGHT PANEL: PREVIEW */}
                    <div className="w-2/3 flex flex-col bg-slate-50 p-6 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><TableIcon className="w-5 h-5 text-slate-400" /> Live Preview</h3>
                            <span className="text-sm text-slate-600 font-bold">{previewData.count} items • ${previewData.total.toLocaleString()}</span>
                        </div>
                        <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0"><tr><th className="px-3 py-2 text-left text-xs uppercase">Date</th><th className="px-3 py-2 text-left text-xs uppercase">Desc</th><th className="px-3 py-2 text-right text-xs uppercase">Amt</th></tr></thead>
                                <tbody>{previewData.transactions.slice(0, 50).map(tx => <tr key={tx.id}><td className="px-3 py-2 text-xs">{tx.date}</td><td className="px-3 py-2 text-xs truncate max-w-[200px]">{tx.description}</td><td className="px-3 py-2 text-xs text-right font-mono">${tx.amount.toFixed(2)}</td></tr>)}</tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-xl">
                    {!isManagingRanges && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Apply Configuration</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportConfigModal;
