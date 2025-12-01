
import React, { useState } from 'react';
import type { RuleCondition, Account } from '../types';
import { DeleteIcon, AddIcon, DragHandleIcon } from './Icons';
import { generateUUID } from '../utils';

interface RuleBuilderProps {
    items: RuleCondition[];
    onChange: (items: RuleCondition[]) => void;
    accounts: Account[];
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({ items, onChange, accounts }) => {
    
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
        
        // Use the parent row as the drag image so the user sees what they are moving
        const rowElement = e.currentTarget.parentElement;
        if (rowElement) {
             try {
                e.dataTransfer.setDragImage(rowElement, 0, 0);
             } catch (err) {
                 // Fallback to default behavior if setDragImage fails
             }
        }
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault(); // Necessary to allow dropping
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
                    {/* Condition Row */}
                    <div className={`flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white p-3 rounded border border-slate-200 shadow-sm z-10 relative transition-all ${draggedIndex === index ? 'opacity-50 bg-indigo-50 border-indigo-300' : ''}`}>
                        <div 
                            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                        >
                            <DragHandleIcon className="w-5 h-5" />
                        </div>
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-500 mr-1 flex-shrink-0">
                            {index + 1}
                        </div>
                        
                        <select 
                            value={condition.field} 
                            onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                            className="w-full sm:w-1/4 p-2 text-sm border rounded-md bg-slate-50 focus:bg-white"
                        >
                            <option value="description">Description</option>
                            <option value="amount">Amount</option>
                            <option value="accountId">Account</option>
                        </select>
                        
                        <select 
                            value={condition.operator} 
                            onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                            className="w-full sm:w-1/4 p-2 text-sm border rounded-md bg-slate-50 focus:bg-white"
                        >
                            {condition.field === 'description' && (
                                <>
                                    <option value="contains">Contains</option>
                                    <option value="does_not_contain">Does Not Contain</option>
                                    <option value="starts_with">Starts With</option>
                                    <option value="ends_with">Ends With</option>
                                    <option value="equals">Equals</option>
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
                                <option value="equals">Is</option>
                            )}
                        </select>

                        {condition.field === 'accountId' ? (
                            <select 
                                value={condition.value} 
                                onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                className="w-full sm:flex-grow p-2 text-sm border rounded-md bg-slate-50 focus:bg-white"
                            >
                                <option value="">Select Account...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        ) : (
                            <input 
                                type={condition.field === 'amount' ? 'number' : 'text'} 
                                step={condition.field === 'amount' ? '0.01' : undefined}
                                value={condition.value} 
                                onChange={(e) => handleUpdateCondition(index, 'value', condition.field === 'amount' ? e.target.value : e.target.value)}
                                placeholder="Value"
                                className="w-full sm:flex-grow p-2 text-sm border rounded-md bg-slate-50 focus:bg-white"
                            />
                        )}

                        <button type="button" onClick={() => handleDeleteCondition(index)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Remove Condition">
                            <DeleteIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Logic Connector (if not last item) */}
                    {index < conditions.length - 1 && (
                        <div className="flex justify-center py-2 relative">
                            {/* Vertical Line */}
                            <div className="absolute top-0 bottom-0 w-px bg-slate-300 left-1/2 -translate-x-1/2 -z-0"></div>
                            
                            <button 
                                type="button" 
                                onClick={() => toggleLogic(index)} 
                                className={`relative z-10 px-3 py-1 text-[10px] font-bold uppercase rounded-full border cursor-pointer transition-all hover:scale-110 ${
                                    (condition.nextLogic || 'AND') === 'AND' 
                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                                    : 'bg-orange-100 text-orange-700 border-orange-200'
                                }`}
                            >
                                {condition.nextLogic || 'AND'}
                            </button>
                        </div>
                    )}
                </div>
            ))}
            
            <div className="flex justify-center mt-4 pt-2 border-t border-dashed border-slate-300">
                <button type="button" onClick={handleAddCondition} className="text-xs bg-white border border-slate-300 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 px-4 py-2 rounded-full font-medium flex items-center gap-2 transition-all shadow-sm">
                    <AddIcon className="w-3 h-3" /> Add Condition
                </button>
            </div>
        </div>
    );
};

export default RuleBuilder;
