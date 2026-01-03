
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, RuleCondition, Tag } from '../types';
import { CloseIcon, SlashIcon, SparklesIcon, CheckCircleIcon } from './Icons';
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-20 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <SparklesIcon className="w-6 h-6 text-indigo-600" />
                            Create Automation Rule
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Define logic to automatically clean up and organize your data.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="px-8 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                            Save Automation
                        </button>
                    </div>
                </div>
                
                 <form onSubmit={handleSave} className="p-8 space-y-8 overflow-y-auto bg-slate-50/50">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Friendly Label</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Monthly Netflix Subscription" className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-800 text-lg" required />
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">1</div>
                            If transactions match these conditions
                        </h3>
                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">2</div>
                                Then apply these automatic updates
                            </h3>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-300 hover:border-red-400 transition-colors shadow-sm group">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Set Category</label>
                                    <div className="flex gap-2">
                                        <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- Don't Change --</option>
                                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                        {onSaveCategory && <button type="button" onClick={handleCreateCategory} className="px-3 bg-slate-100 text-slate-600 rounded-xl border hover:bg-indigo-50 hover:text-indigo-600 font-bold transition-colors">+</button>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Set Income Source</label>
                                    <div className="flex gap-2">
                                        <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- Don't Change --</option>
                                            {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        {onSavePayee && <button type="button" onClick={handleCreatePayee} className="px-3 bg-slate-100 text-slate-600 rounded-xl border hover:bg-indigo-50 hover:text-indigo-600 font-bold transition-colors">+</button>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Set Transaction Type</label>
                                    <div className="flex gap-2">
                                        <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- Don't Change --</option>
                                            {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </select>
                                        {onAddTransactionType && <button type="button" onClick={handleCreateType} className="px-3 bg-slate-100 text-slate-600 rounded-xl border hover:bg-indigo-50 hover:text-indigo-600 font-bold transition-colors">+</button>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Override Description</label>
                                    <input type="text" value={setDescription} onChange={(e) => setSetDescription(e.target.value)} placeholder="e.g., Clean Business Name" className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Append Tags</label>
                                    <div className="flex flex-wrap gap-2 p-3 border rounded-xl bg-slate-50/50">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-3 py-1.5 rounded-full text-xs border-2 transition-all font-bold ${assignTagIds.has(tag.id) ? tag.color + ' border-indigo-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                        {onSaveTag && (
                                            <button
                                                type="button"
                                                onClick={handleCreateTag}
                                                className="px-3 py-1.5 rounded-full text-xs border-2 border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 bg-white transition-all active:scale-95"
                                                title="Create new tag"
                                            >
                                                + New Tag
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center bg-red-50 rounded-2xl border-2 border-red-100 border-dashed animate-pulse">
                                <SlashIcon className="w-12 h-12 text-red-200 mx-auto mb-4" />
                                <p className="text-lg font-black text-red-800 uppercase tracking-tight">Auto-Purge Active</p>
                                <p className="text-sm text-red-600 mt-1 max-w-md mx-auto font-medium">Any imported rows matching these criteria will be discarded immediately to prevent noise in your ledger.</p>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleModal;
