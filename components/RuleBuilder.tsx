
import React, { useState } from 'react';
import type { RuleCondition, Account, RuleLogic } from '../types';
import { DeleteIcon, AddIcon, DragHandleIcon, InfoIcon, TableIcon, BoxIcon, MapPinIcon, ChevronRightIcon, ChevronDownIcon, ShieldCheckIcon } from './Icons';
import { generateUUID } from '../utils';

interface RuleBuilderProps {
    items: RuleCondition[];
    onChange: (items: RuleCondition[]) => void;
    accounts: Account[];
    depth?: number;
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({ items, onChange, accounts, depth = 0 }) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

    // --- Native Drag and Drop ---
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newItems = [...items];
        const draggedItem = newItems[draggedIndex];
        newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);
        
        onChange(newItems);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    return (
        <div className={`space-y-3 ${depth > 0 ? 'pl-6 border-l-2 border-indigo-200' : ''}`}>
            {items.map((condition, index) => (
                <div 
                    key={condition.id} 
                    className="relative"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                >
                    {condition.type === 'group' ? (
                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-inner group/parent">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="text-slate-300 cursor-grab active:cursor-grabbing p-1"><DragHandleIcon className="w-4 h-4" /></div>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <ShieldCheckIcon className="w-3 h-3" /> Logic Group
                                    </span>
                                </div>
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
                        <div className={`grid grid-cols-1 xl:grid-cols-12 gap-3 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-indigo-300 ${draggedIndex === index ? 'opacity-50 border-indigo-500 scale-[0.98]' : ''}`}>
                            <div className="xl:col-span-1 flex items-center gap-2">
                                <div className="text-slate-300 cursor-grab active:cursor-grabbing p-1 hover:text-indigo-500 transition-colors"><DragHandleIcon className="w-4 h-4" /></div>
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[9px] font-black text-slate-500">{index + 1}</div>
                            </div>
                            
                            <div className="xl:col-span-2">
                                <select 
                                    value={condition.field} 
                                    onChange={(e) => handleUpdateCondition(index, 'field', e.target.value as any)}
                                    className="w-full p-2 text-xs border rounded-lg bg-slate-50 font-bold text-indigo-800"
                                >
                                    <option value="description">Description</option>
                                    <option value="amount">Amount</option>
                                    <option value="accountId">Account</option>
                                    <option value="payeeId">Payee</option>
                                    <option value="merchantId">Merchant</option>
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
                                    className="w-full p-2 text-xs border border-indigo-100 rounded-lg font-bold"
                                />
                            </div>

                            <div className={`${condition.field === 'metadata' ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
                                <select 
                                    value={condition.operator} 
                                    onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value as any)}
                                    className="w-full p-2 text-xs border rounded-lg bg-slate-50 font-medium"
                                >
                                    {['description', 'metadata', 'payeeId', 'merchantId', 'locationId'].includes(condition.field!) && (
                                        <><option value="contains">Contains</option><option value="does_not_contain">Doesn't Contain</option><option value="starts_with">Starts With</option><option value="ends_with">Ends With</option><option value="equals">Equals</option><option value="regex_match">Regex Match</option></>
                                    )}
                                    {condition.field === 'amount' && (
                                        <><option value="equals">Equals</option><option value="greater_than">Greater Than</option><option value="less_than">Less Than</option></>
                                    )}
                                    {condition.field === 'accountId' && (
                                        <><option value="equals">Is Exact</option><option value="contains">Name Contains</option></>
                                    )}
                                </select>
                            </div>

                            <div className={`${condition.field === 'metadata' ? 'xl:col-span-3' : 'xl:col-span-5'}`}>
                                <input 
                                    type={condition.field === 'amount' ? 'number' : 'text'} 
                                    value={condition.value} 
                                    onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                    placeholder="Comparison value..."
                                    className="w-full p-2 text-xs border rounded-lg focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div className="xl:col-span-1 flex justify-end">
                                <button type="button" onClick={() => handleDeleteCondition(index)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-all"><DeleteIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}

                    {index < items.length - 1 && (
                        <div className="flex justify-center py-2 relative">
                            <div className="absolute top-0 bottom-0 w-px bg-slate-200 left-1/2 -translate-x-1/2 -z-0"></div>
                            <button 
                                type="button" 
                                onClick={() => toggleLogic(index)} 
                                className={`relative z-10 px-4 py-1 text-[9px] font-black uppercase rounded-full border shadow-sm transition-all hover:scale-105 ${
                                    (items[index].nextLogic || 'AND') === 'AND' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-amber-400 text-slate-900 border-amber-500'
                                }`}
                            >
                                {items[index].nextLogic || 'AND'}
                            </button>
                        </div>
                    )}
                </div>
            ))}
            
            <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => handleAddCondition('basic')} className="text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm uppercase tracking-wider">
                    <AddIcon className="w-3 h-3" /> Add Condition
                </button>
                <button type="button" onClick={() => handleAddCondition('group')} className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm uppercase tracking-wider">
                    <ShieldCheckIcon className="w-3 h-3" /> New Logic Group
                </button>
            </div>
        </div>
    );
};

export default RuleBuilder;
