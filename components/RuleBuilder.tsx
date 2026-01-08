import React from 'react';
import type { RuleCondition, Account } from '../types';
import { DeleteIcon, AddIcon, DragHandleIcon, ShieldCheckIcon } from './Icons';
import { generateUUID } from '../utils';

interface RuleBuilderProps {
    items: RuleCondition[];
    onChange: (items: RuleCondition[]) => void;
    accounts: Account[];
    depth?: number;
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({ items, onChange, accounts, depth = 0 }) => {
    const handleUpdateCondition = (index: number, field: keyof RuleCondition, value: any) => {
        const newConditions = [...items];
        newConditions[index] = { ...newConditions[index], [field]: value };
        onChange(newConditions);
    };

    const handleDeleteCondition = (index: number) => {
        const newConditions = items.filter((_, i) => i !== index);
        onChange(newConditions);
    };

    const handleAddCondition = (type: 'basic' | 'group' = 'basic') => {
        const newCondition: RuleCondition = type === 'basic' ? { 
            id: generateUUID(), 
            type: 'basic',
            field: 'description', 
            operator: 'contains', 
            value: '', 
            nextLogic: 'AND' 
        } : {
            id: generateUUID(),
            type: 'group',
            conditions: [{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }],
            nextLogic: 'AND'
        };
        onChange([...items, newCondition]);
    };

    const toggleLogic = (index: number) => {
        const currentLogic = items[index].nextLogic || 'AND';
        handleUpdateCondition(index, 'nextLogic', currentLogic === 'AND' ? 'OR' : 'AND');
    };

    return (
        <div className={`space-y-4 ${depth > 0 ? 'pl-6 border-l-2 border-indigo-200' : ''}`}>
            {items.map((condition, index) => (
                <div key={condition.id} className="relative">
                    {condition.type === 'group' ? (
                        <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheckIcon className="w-3 h-3" /> Logic Cluster
                                </span>
                                <button type="button" onClick={() => handleDeleteCondition(index)} className="text-slate-300 hover:text-red-500 p-1"><DeleteIcon className="w-4 h-4" /></button>
                            </div>
                            <RuleBuilder 
                                items={condition.conditions || []} 
                                onChange={(newSub) => handleUpdateCondition(index, 'conditions', newSub)} 
                                accounts={accounts}
                                depth={depth + 1}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md">
                            <div className="xl:col-span-1 flex items-center gap-2">
                                <div className="text-slate-200"><DragHandleIcon className="w-4 h-4" /></div>
                            </div>
                            
                            <div className="xl:col-span-2">
                                <select 
                                    value={condition.field} 
                                    onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                                    className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-black text-indigo-900 transition-colors focus:border-indigo-500"
                                >
                                    <option value="description">Description</option>
                                    <option value="amount">Amount</option>
                                    <option value="accountId">Account</option>
                                    <option value="counterpartyId">Counterparty</option>
                                    <option value="locationId">Location</option>
                                    <option value="metadata">Metadata Key</option>
                                </select>
                            </div>

                            <div className={`${condition.field === 'metadata' ? 'xl:col-span-3' : 'hidden'}`}>
                                <input 
                                    type="text" 
                                    value={condition.metadataKey || ''} 
                                    onChange={(e) => handleUpdateCondition(index, 'metadataKey', e.target.value)}
                                    placeholder="Column Name"
                                    className="w-full p-2.5 text-xs border border-slate-200 rounded-xl font-bold bg-white focus:border-indigo-500"
                                />
                            </div>

                            <div className={`${condition.field === 'metadata' ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
                                <select 
                                    value={condition.operator} 
                                    onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                                    className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-medium transition-colors focus:border-indigo-500"
                                >
                                    {['description', 'metadata', 'counterpartyId', 'locationId'].includes(condition.field!) && (
                                        <><option value="contains">Contains</option><option value="does_not_contain">Doesn't Contain</option><option value="starts_with">Starts With</option><option value="ends_with">Ends With</option><option value="equals">Equals</option><option value="regex_match">Regex Match</option><option value="exists">Key Exists</option></>
                                    )}
                                    {condition.field === 'amount' && (
                                        <><option value="equals">Equals</option><option value="greater_than">Greater Than</option><option value="less_than">Less Than</option></>
                                    )}
                                    {condition.field === 'accountId' && (
                                        <><option value="equals">Is Exactly</option><option value="contains">Name Contains</option></>
                                    )}
                                </select>
                            </div>

                            <div className={`${condition.field === 'metadata' ? 'xl:col-span-3' : 'xl:col-span-5'}`}>
                                {condition.field === 'accountId' && condition.operator === 'equals' ? (
                                    <select 
                                        value={condition.value} 
                                        onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                        className="w-full p-2.5 text-xs border border-slate-200 rounded-xl font-bold bg-white transition-colors focus:border-indigo-500"
                                    >
                                        <option value="">Select Account...</option>
                                        {[...accounts].sort((a,b) => a.name.localeCompare(b.name)).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                ) : (
                                    <input 
                                        type={condition.field === 'amount' ? 'number' : 'text'} 
                                        value={condition.value} 
                                        onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                        placeholder="Comparison value..."
                                        className="w-full p-2.5 text-xs border border-slate-200 rounded-xl font-bold bg-white transition-colors focus:border-indigo-500"
                                    />
                                )}
                            </div>

                            <div className="xl:col-span-1 flex justify-end">
                                <button type="button" onClick={() => handleDeleteCondition(index)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-all hover:bg-red-50"><DeleteIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )}

                    {index < items.length - 1 && (
                        <div className="flex justify-center py-2 relative">
                            <div className="absolute top-0 bottom-0 w-0.5 bg-slate-100 left-1/2 -translate-x-1/2 -z-0"></div>
                            <button 
                                type="button" 
                                onClick={() => toggleLogic(index)} 
                                className={`relative z-10 px-6 py-1.5 text-[9px] font-black uppercase rounded-full border shadow-md transition-all hover:scale-105 ${
                                    (items[index].nextLogic || 'AND') === 'AND' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-amber-400 text-slate-900 border-amber-500'
                                }`}
                            >
                                {items[index].nextLogic || 'AND'}
                            </button>
                        </div>
                    )}
                </div>
            ))}
            
            <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => handleAddCondition('basic')} className="text-[10px] bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50 px-6 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm">
                    <AddIcon className="w-4 h-4" /> Add criteria
                </button>
                <button type="button" onClick={() => handleAddCondition('group')} className="text-[10px] bg-indigo-50 border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-100 px-6 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm">
                    <ShieldCheckIcon className="w-4 h-4" /> Nest logic
                </button>
            </div>
        </div>
    );
};

export default RuleBuilder;