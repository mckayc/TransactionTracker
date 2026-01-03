import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, RuleCondition, Tag } from '../types';
import { CloseIcon, SlashIcon } from './Icons';
import { generateUUID } from '../utils';
import RuleBuilder from './RuleBuilder';

interface RuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveRule: (rule: ReconciliationRule) => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    transaction: Transaction | null;
    onSaveCategory?: (category: Category) => void;
    onSavePayee?: (payee: Payee) => void;
    onSaveTag?: (tag: Tag) => void;
    onAddTransactionType?: (type: TransactionType) => void;
}

const RuleModal: React.FC<RuleModalProps> = ({ isOpen, onClose, onSaveRule, accounts, transactionTypes, categories, tags, payees, transaction, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType }) => {
    
    const [name, setName] = useState('');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    
    // Actions
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setDescription, setSetDescription] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (transaction) {
                setName(`${transaction.description} Rule`);
                const newConditions: RuleCondition[] = [
                    { id: generateUUID(), field: 'description', operator: 'contains', value: transaction.description, nextLogic: 'AND' }
                ];
                if (transaction.accountId) {
                    newConditions.push({ id: generateUUID(), field: 'accountId', operator: 'equals', value: transaction.accountId, nextLogic: 'AND' });
                }
                setConditions(newConditions);
                
                setSetCategoryId(transaction.categoryId || '');
                setSetPayeeId(transaction.payeeId || '');
                setSetTransactionTypeId(transaction.typeId || '');
                setAssignTagIds(new Set());
                setSkipImport(false);
            } else {
                setName('');
                setConditions([{ id: generateUUID(), field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                setSetCategoryId('');
                setSetPayeeId('');
                setSetTransactionTypeId('');
                setSetDescription('');
                setAssignTagIds(new Set());
                setSkipImport(false);
            }
        }
    }, [isOpen, transaction]);
    
    const getSortedOptions = (items: any[], parentId?: string, depth = 0): { id: string, name: string }[] => {
        return items
            .filter(i => i.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .flatMap(item => [
                { id: item.id, name: `${'\u00A0'.repeat(depth * 3)}${depth > 0 ? '⌞ ' : ''}${item.name}` },
                ...getSortedOptions(items, item.id, depth + 1)
            ]);
    };

    const sortedPayeeOptions = useMemo(() => getSortedOptions(payees), [payees]);
    const sortedCategoryOptions = useMemo(() => getSortedOptions(categories), [categories]);

    if (!isOpen) return null;

    const handleCreateCategory = () => {
        const categoryNameInput = prompt("Enter new Category name:");
        if (categoryNameInput && categoryNameInput.trim() && typeof onSaveCategory === 'function') {
            const newCat = { id: generateUUID(), name: categoryNameInput.trim() };
            onSaveCategory(newCat);
            setSetCategoryId(newCat.id);
        }
    };

    const handleCreatePayee = () => {
        const sourceName = prompt("Enter new Income Source name:");
        if (sourceName && sourceName.trim() && typeof onSavePayee === 'function') {
            const newPayee = { id: generateUUID(), name: sourceName.trim() };
            onSavePayee(newPayee);
            setSetPayeeId(newPayee.id);
        }
    };

    const handleCreateType = () => {
        const typeName = prompt("Enter new Transaction Type name:");
        if (typeName && typeName.trim() && typeof onAddTransactionType === 'function') {
            const newType = { id: generateUUID(), name: typeName.trim(), balanceEffect: 'expense' as const, isDefault: false };
            onAddTransactionType(newType);
            setSetTransactionTypeId(newType.id);
        }
    };

    const handleCreateTag = () => {
        const tagName = prompt("Enter new Tag name:");
        if (tagName && tagName.trim() && typeof onSaveTag === 'function') {
            const newTag = { 
                id: generateUUID(), 
                name: tagName.trim(), 
                color: 'bg-slate-100 text-slate-800' // Default color
            };
            onSaveTag(newTag);
            setAssignTagIds(prev => new Set(prev).add(newTag.id));
        }
    };

    const toggleTag = (tagId: string) => {
        setAssignTagIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tagId)) {
                newSet.delete(tagId);
            } else {
                newSet.add(tagId);
            }
            return newSet;
        });
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Rule Name is required.');
            return;
        }
        
        if (conditions.length === 0) {
            alert('Please add at least one condition.');
            return;
        }

        onSaveRule({
            id: generateUUID(),
            name: name.trim(),
            conditions,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            setDescription: setDescription || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport
        });
        onClose();
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-20">
                    <h2 className="text-xl font-bold text-slate-800">Create Automation Rule</h2>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
                            Create Rule
                        </button>
                    </div>
                </div>
                
                 <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Monthly Netflix Subscription" className="w-full p-2 border rounded-md" required />
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h3 className="font-semibold text-slate-800 mb-3">If transactions match...</h3>
                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-slate-800">Then apply these changes:</h3>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300 hover:border-red-400 transition-colors shadow-sm group">
                                <input 
                                    type="checkbox" 
                                    checked={skipImport} 
                                    onChange={() => setSkipImport(!skipImport)} 
                                    className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" 
                                />
                                <span className="text-xs font-black text-red-700 uppercase flex items-center gap-1">
                                    <SlashIcon className="w-3 h-3" /> Exclude from Import
                                </span>
                            </label>
                        </div>
                        
                        {!skipImport ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Set Category</label>
                                    <div className="flex gap-1">
                                        <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-2 border rounded-md">
                                            <option value="">-- Don't Change --</option>
                                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                        {onSaveCategory && <button type="button" onClick={handleCreateCategory} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Set Income Source</label>
                                    <div className="flex gap-1">
                                        <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-2 border rounded-md">
                                            <option value="">-- Don't Change --</option>
                                            {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        {onSavePayee && <button type="button" onClick={handleCreatePayee} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Set Transaction Type</label>
                                    <div className="flex gap-1">
                                        <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2 border rounded-md">
                                            <option value="">-- Don't Change --</option>
                                            {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </select>
                                        {onAddTransactionType && <button type="button" onClick={handleCreateType} className="px-3 bg-indigo-100 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-200 font-bold">+</button>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Set Description</label>
                                    <input type="text" value={setDescription} onChange={(e) => setSetDescription(e.target.value)} placeholder="e.g., Clean Name" className="w-full p-2 border rounded-md" />
                                </div>
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Assign Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-2 py-1 rounded-full text-xs border transition-colors ${assignTagIds.has(tag.id) ? tag.color + ' ring-1 ring-offset-1 ring-slate-400' : 'bg-white text-slate-600 border-slate-300'}`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                        {onSaveTag && (
                                            <button
                                                type="button"
                                                onClick={handleCreateTag}
                                                className="px-2 py-1 rounded-full text-xs border border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 bg-white transition-colors"
                                                title="Create new tag"
                                            >
                                                + New
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 text-center bg-red-50 rounded-xl border border-red-100 border-dashed">
                                <p className="text-sm font-bold text-red-800">This transaction will be filtered out automatically.</p>
                                <p className="text-xs text-red-600 mt-1">Matched rows will not be added to your permanent transaction history.</p>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleModal;