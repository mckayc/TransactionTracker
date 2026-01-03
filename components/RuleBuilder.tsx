
import React, { useState } from 'react';
import type { RuleCondition, Account, Category } from '../types';
import { DeleteIcon, AddIcon, DragHandleIcon, InfoIcon, TableIcon } from './Icons';
import { generateUUID } from '../utils';

interface RuleBuilderProps {
    items: RuleCondition[];
    onChange: (items: RuleCondition[]) => void;
    accounts: Account[];
    categories?: Category[];
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({ items, onChange, accounts, categories = [] }) => {
    
    // Type guard to filter out any legacy nested groups if they exist in state
    const conditions = items.filter(item => 'field' in item) as RuleCondition[];
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleUpdateCondition = (index: number, field: keyof RuleCondition, value: any) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], [field]: value };
        onChange(newConditions);
    };

    const handleDeleteCondition = (index: number) => {
        const newConditions = conditions.filter((_, i) => i !== index);
        onChange(newConditions);
    };

    const handleAddCondition = () => {
        const newCondition: RuleCondition = { 
            id: generateUUID(), 
            field: 'description', 
            operator: 'contains', 
            value: '', 
            nextLogic: 'AND' 
        };
        // Ensure the previous last item has a logic operator (default AND)
        if (conditions.length > 0) {
            const lastIndex = conditions.length - 1;
            if (!conditions[lastIndex].nextLogic) {
                handleUpdateCondition(lastIndex, 'nextLogic', 'AND');
            }
        }
        onChange([...conditions, newCondition]);
    };

    const toggleLogic = (index: number) => {
        const currentLogic = conditions[index].nextLogic || 'AND';
        handleUpdateCondition(index, 'nextLogic', currentLogic === 'AND' ? 'OR' : 'AND');
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        
        const rowElement = e.currentTarget.parentElement;
        if (rowElement) {
             try {
                e.dataTransfer.setDragImage(rowElement, 0, 0);
             } catch (err) {}
        }
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const newConditions = [...conditions];
        const [draggedItem] = newConditions.splice(draggedIndex, 1);
        newConditions.splice(targetIndex, 0, draggedItem);

        onChange(newConditions);
        setDraggedIndex(null);
    };

    return (
        <div className="space-y-0 w-full">
            {conditions.map((condition, index) => (
                <div 
                    key={condition.id} 
                    className="relative"
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                >
                    <div className={`grid grid-cols-1 xl:grid-cols-12 gap-3 items-center bg-white p-3 rounded border border-slate-200 shadow-sm z-10 relative transition-all ${draggedIndex === index ? 'opacity-50 bg-indigo-50 border-indigo-300' : ''}`}>
                        
                        <div className="xl:col-span-1 flex items-center gap-2">
                            <div 
                                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                            >
                                <DragHandleIcon className="w-5 h-5" />
                            </div>
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 flex-shrink-0">
                                {index + 1}
                            </div>
                        </div>
                        
                        <div className="xl:col-span-2">
                            <select 
                                value={condition.field} 
                                onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                                className="w-full p-2 text-sm border rounded-md bg-slate-50 focus:bg-white font-bold text-indigo-800"
                            >
                                <option value="description">Description</option>
                                <option value="categoryId">Category</option>
                                <option value="amount">Amount</option>
                                <option value="accountId">Account</option>
                                <option value="metadata">Raw Metadata Field</option>
                            </select>
                        </div>

                        <div className={`${condition.field === 'metadata' ? 'xl:col-span-3' : 'hidden'}`}>
                            <div className="flex items-center gap-2 relative">
                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <TableIcon className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <input 
                                    type="text" 
                                    value={condition.metadataKey || ''} 
                                    onChange={(e) => handleUpdateCondition(index, 'metadataKey', e.target.value)}
                                    placeholder="Column Name"
                                    className="w-full p-2 pl-8 text-sm border border-indigo-200 rounded-md bg-indigo-50/50 focus:bg-white placeholder:text-indigo-300 font-bold"
                                />
                            </div>
                        </div>

                        <div className={`${condition.field === 'metadata' ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
                            <select 
                                value={condition.operator} 
                                onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                                className="w-full p-2 text-sm border rounded-md bg-slate-50 focus:bg-white font-medium"
                            >
                                {(condition.field === 'description' || condition.field === 'metadata' || condition.field === 'categoryId') && (
                                    <>
                                        <option value="contains">Contains</option>
                                        <option value="does_not_contain">Does Not Contain</option>
                                        <option value="starts_with">Starts With</option>
                                        <option value="ends_with">Ends With</option>
                                        <option value="equals">Equals</option>
                                        {condition.field === 'metadata' && <option value="exists">Exists / Is Not Empty</option>}
                                    </>
                                )}
                                {condition.field === 'amount' && (
                                    <>
                                        <option value="equals">Equals</option>
                                        <option value="greater_than">Greater Than</option>
                                        <option value="less_than">Less Than</option>
                                    </>
                                )}
                                {condition.field === 'accountId' && (
                                    <>
                                        <option value="equals">Is (Exact Match)</option>
                                        <option value="contains">Name Contains</option>
                                        <option value="does_not_contain">Name Does Not Contain</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div className={`${condition.operator === 'exists' ? 'hidden' : condition.field === 'metadata' ? 'xl:col-span-3' : 'xl:col-span-5'}`}>
                            {condition.field === 'accountId' && condition.operator === 'equals' ? (
                                <select 
                                    value={condition.value} 
                                    onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                    className="w-full p-2 text-sm border rounded-md bg-slate-50 focus:bg-white"
                                >
                                    <option value="">Select Account...</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            ) : condition.field === 'categoryId' && condition.operator === 'equals' ? (
                                <select 
                                    value={condition.value} 
                                    onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                    className="w-full p-2 text-sm border rounded-md bg-slate-50 focus:bg-white"
                                >
                                    <option value="">Select Category...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            ) : (
                                <input 
                                    type={condition.field === 'amount' ? 'number' : 'text'} 
                                    step={condition.field === 'amount' ? '0.01' : undefined}
                                    value={condition.value} 
                                    onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                    placeholder="Value"
                                    className={`w-full p-2 text-sm border rounded-md bg-slate-50 focus:bg-white`}
                                />
                            )}
                        </div>

                        <div className="xl:col-span-1 flex justify-end">
                            <button type="button" onClick={() => handleDeleteCondition(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all flex-shrink-0" title="Remove Condition">
                                <DeleteIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {index < conditions.length - 1 && (
                        <div className="flex justify-center py-2 relative">
                            <div className="absolute top-0 bottom-0 w-px bg-slate-300 left-1/2 -translate-x-1/2 -z-0"></div>
                            <button 
                                type="button" 
                                onClick={() => toggleLogic(index)} 
                                className={`relative z-10 px-4 py-1.5 text-[10px] font-black uppercase rounded-full border shadow-sm cursor-pointer transition-all hover:scale-110 active:scale-95 ${
                                    (condition.nextLogic || 'AND') === 'AND' 
                                    ? 'bg-indigo-600 text-white border-indigo-700' 
                                    : 'bg-orange-600 text-white border-orange-700'
                                }`}
                            >
                                {condition.nextLogic || 'AND'}
                            </button>
                        </div>
                    )}
                </div>
            ))}
            
            <div className="flex justify-center mt-6 pt-4 border-t border-dashed border-slate-300">
                <button type="button" onClick={handleAddCondition} className="text-sm bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-95">
                    <AddIcon className="w-4 h-4" /> Add Condition
                </button>
            </div>
        </div>
    );
};

export default RuleBuilder;
