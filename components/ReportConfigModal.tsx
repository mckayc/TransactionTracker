

import React, { useState, useEffect } from 'react';
import type { ReportConfig, Account, Category, User, TransactionType, DateRangePreset, BalanceEffect, Tag, Payee, ReportGroupBy } from '../types';
import { CloseIcon, ChartPieIcon } from './Icons';
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
}

const ReportConfigModal: React.FC<ReportConfigModalProps> = ({ 
    isOpen, onClose, onSave, initialConfig, accounts, categories, users, transactionTypes, tags, payees
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
        }
    }, [isOpen, initialConfig]);

    if (!isOpen) return null;

    const handleSave = () => {
        const config: ReportConfig = {
            id: initialConfig?.id || generateUUID(),
            name: name.trim() || 'New Report',
            datePreset,
            customStartDate: datePreset === 'custom' ? customStartDate : undefined,
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ChartPieIcon className="w-6 h-6 text-indigo-600" />
                        {initialConfig ? 'Edit Report Config' : 'New Report Config'}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
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

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date Range</label>
                        <select 
                            value={datePreset} 
                            onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
                            className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="thisMonth">This Month</option>
                            <option value="lastMonth">Last Month</option>
                            <option value="lastMonthPriorYear">Last Month (Prior Year)</option>
                            <option value="last3Months">Last 90 Days</option>
                            <option value="thisYear">This Year</option>
                            <option value="lastYear">Last Year</option>
                            <option value="sameMonthLastYear">Same Month Last Year</option>
                            <option value="sameMonth2YearsAgo">Same Month 2 Years Ago</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

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
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Save Report</button>
                </div>
            </div>
        </div>
    );
};

export default ReportConfigModal;