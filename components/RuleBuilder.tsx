
import React from 'react';
import type { RuleItem, RuleCondition, RuleGroup, Account } from '../types';
import { DeleteIcon, AddIcon, FolderIcon } from './Icons';
import { generateUUID } from '../utils';

interface RuleBuilderProps {
    items: RuleItem[];
    onChange: (items: RuleItem[]) => void;
    accounts: Account[];
}

const ConditionRow: React.FC<{
    condition: RuleCondition;
    onChange: (updated: RuleCondition) => void;
    onDelete: () => void;
    accounts: Account[];
}> = ({ condition, onChange, onDelete, accounts }) => {
    const updateField = (field: keyof RuleCondition, value: any) => {
        onChange({ ...condition, [field]: value });
    };

    return (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white p-2 rounded border border-slate-200">
            <select 
                value={condition.field} 
                onChange={(e) => updateField('field', e.target.value)}
                className="w-full sm:w-1/4 p-2 text-sm border rounded-md"
            >
                <option value="description">Description</option>
                <option value="amount">Amount</option>
                <option value="accountId">Account</option>
            </select>
            
            <select 
                value={condition.operator} 
                onChange={(e) => updateField('operator', e.target.value)}
                className="w-full sm:w-1/4 p-2 text-sm border rounded-md"
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
                    onChange={(e) => updateField('value', e.target.value)}
                    className="w-full sm:flex-grow p-2 text-sm border rounded-md"
                >
                    <option value="">Select Account...</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
            ) : (
                <input 
                    type={condition.field === 'amount' ? 'number' : 'text'} 
                    step={condition.field === 'amount' ? '0.01' : undefined}
                    value={condition.value} 
                    onChange={(e) => updateField('value', condition.field === 'amount' ? e.target.value : e.target.value)}
                    placeholder="Value"
                    className="w-full sm:flex-grow p-2 text-sm border rounded-md"
                />
            )}

            <button type="button" onClick={onDelete} className="p-2 text-slate-400 hover:text-red-500" title="Remove Condition">
                <DeleteIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

const GroupRow: React.FC<{
    group: RuleGroup;
    onChange: (updated: RuleGroup) => void;
    onDelete: () => void;
    accounts: Account[];
}> = ({ group, onChange, onDelete, accounts }) => {
    
    const handleItemsChange = (newItems: RuleItem[]) => {
        onChange({ ...group, conditions: newItems });
    };

    return (
        <div className="border-l-4 border-indigo-200 pl-4 py-2 my-2 bg-indigo-50/50 rounded-r-lg">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 uppercase">Group Logic:</span>
                    <div className="flex items-center bg-white rounded-md border border-indigo-200 p-0.5">
                        <button type="button" onClick={() => onChange({ ...group, logic: 'AND' })} className={`px-2 py-0.5 text-[10px] font-bold rounded ${group.logic === 'AND' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>AND</button>
                        <button type="button" onClick={() => onChange({ ...group, logic: 'OR' })} className={`px-2 py-0.5 text-[10px] font-bold rounded ${group.logic === 'OR' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>OR</button>
                    </div>
                </div>
                <button type="button" onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500" title="Remove Group">
                    <DeleteIcon className="w-4 h-4" />
                </button>
            </div>
            <RuleBuilder items={group.conditions} onChange={handleItemsChange} accounts={accounts} />
        </div>
    );
};

const RuleBuilder: React.FC<RuleBuilderProps> = ({ items, onChange, accounts }) => {
    
    const handleUpdateItem = (index: number, updated: RuleItem) => {
        const newItems = [...items];
        newItems[index] = updated;
        onChange(newItems);
    };

    const handleDeleteItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        onChange(newItems);
    };

    const handleAddCondition = () => {
        const newCondition: RuleCondition = { id: generateUUID(), field: 'description', operator: 'contains', value: '' };
        onChange([...items, newCondition]);
    };

    const handleAddGroup = () => {
        const newGroup: RuleGroup = { 
            id: generateUUID(), 
            type: 'group', 
            logic: 'AND', 
            conditions: [{ id: generateUUID(), field: 'description', operator: 'contains', value: '' }] 
        };
        onChange([...items, newGroup]);
    };

    return (
        <div className="space-y-2 w-full">
            {items.map((item, index) => {
                if ('type' in item && item.type === 'group') {
                    return (
                        <GroupRow 
                            key={item.id} 
                            group={item as RuleGroup} 
                            onChange={(updated) => handleUpdateItem(index, updated)} 
                            onDelete={() => handleDeleteItem(index)} 
                            accounts={accounts}
                        />
                    );
                } else {
                    return (
                        <ConditionRow 
                            key={item.id} 
                            condition={item as RuleCondition} 
                            onChange={(updated) => handleUpdateItem(index, updated)} 
                            onDelete={() => handleDeleteItem(index)} 
                            accounts={accounts}
                        />
                    );
                }
            })}
            
            <div className="flex gap-2 mt-2">
                <button type="button" onClick={handleAddCondition} className="text-xs bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors">
                    <AddIcon className="w-3 h-3" /> Add Condition
                </button>
                <button type="button" onClick={handleAddGroup} className="text-xs bg-white border border-slate-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors">
                    <FolderIcon className="w-3 h-3" /> Add Group
                </button>
            </div>
        </div>
    );
};

export default RuleBuilder;
