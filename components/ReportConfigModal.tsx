
import React, { useState, useEffect } from 'react';
import type { ReportConfig, Account, Category, User, TransactionType, DateRangePreset, BalanceEffect } from '../types';
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
}

const ReportConfigModal: React.FC<ReportConfigModalProps> = ({ 
    isOpen, onClose, onSave, initialConfig, accounts, categories, users, transactionTypes 
}) => {
    const [name, setName] = useState('');
    const [datePreset, setDatePreset] = useState<DateRangePreset>('thisMonth');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    // Filters
    const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
    const [selectedEffects, setSelectedEffects] = useState<Set<BalanceEffect>>(new Set(['expense']));

    useEffect(() => {
        if (isOpen) {
            if (initialConfig) {
                setName(initialConfig.name);
                setDatePreset(initialConfig.datePreset);
                setCustomStartDate(initialConfig.customStartDate || '');
                setCustomEndDate(initialConfig.customEndDate || '');
                setSelectedAccounts(new Set(initialConfig.filters.accountIds));
                setSelectedUsers(new Set(initialConfig.filters.userIds));
                setSelectedCategories(new Set(initialConfig.filters.categoryIds));
                setSelectedTypes(new Set(initialConfig.filters.typeIds));
                setSelectedEffects(new Set(initialConfig.filters.balanceEffects || ['expense']));
            } else {
                setName('');
                setDatePreset('thisMonth');
                setCustomStartDate('');
                setCustomEndDate('');
                setSelectedAccounts(new Set());
                setSelectedUsers(new Set());
                setSelectedCategories(new Set());
                setSelectedTypes(new Set());
                setSelectedEffects(new Set(['expense']));
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
            filters: {
                accountIds: selectedAccounts.size > 0 ? Array.from(selectedAccounts) : undefined,
                userIds: selectedUsers.size > 0 ? Array.from(selectedUsers) : undefined,
                categoryIds: selectedCategories.size > 0 ? Array.from(selectedCategories) : undefined,
                typeIds: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
                balanceEffects: Array.from(selectedEffects)
            },
            hiddenCategoryIds: initialConfig?.hiddenCategoryIds || []
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
                        {initialConfig ? 'Edit Report' : 'Create New Report'}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Report Name</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g. Monthly Expenses, Income vs Expenses"
                            className="w-full p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date Range</label>
                            <select 
                                value={datePreset} 
                                onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
                                className="w-full p-2 border rounded-md mb-2"
                            >
                                <option value="thisMonth">This Month</option>
                                <option value="lastMonth">Last Month</option>
                                <option value="thisYear">This Year</option>
                                <option value="lastYear">Last Year</option>
                                <option value="last3Months">Last 90 Days</option>
                                <option value="sameMonthLastYear">Same Month Last Year</option>
                                <option value="sameMonth2YearsAgo">Same Month 2 Years Ago</option>
                                <option value="custom">Custom Range</option>
                            </select>
                            
                            {datePreset === 'custom' && (
                                <div className="flex gap-2">
                                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full p-2 border rounded-md text-xs" />
                                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full p-2 border rounded-md text-xs" />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Show Transactions For:</label>
                            <div className="flex flex-wrap gap-2">
                                {(['income', 'expense', 'investment', 'donation', 'transfer'] as BalanceEffect[]).map(effect => (
                                    <button
                                        key={effect}
                                        onClick={() => toggleEffect(effect)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition-colors ${selectedEffects.has(effect) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                    >
                                        {effect}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase border-b pb-1">Filters</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MultiSelect label="Accounts" options={accounts} selectedIds={selectedAccounts} onChange={setSelectedAccounts} />
                            <MultiSelect label="Users" options={users} selectedIds={selectedUsers} onChange={setSelectedUsers} />
                            <MultiSelect label="Categories" options={categories} selectedIds={selectedCategories} onChange={setSelectedCategories} />
                            <MultiSelect label="Transaction Types" options={transactionTypes} selectedIds={selectedTypes} onChange={setSelectedTypes} />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
                        {initialConfig ? 'Update Report' : 'Create Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportConfigModal;
