
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, RuleCondition, Tag, Merchant, Location, User, BalanceEffect } from '../types';
import { CloseIcon, SlashIcon, SparklesIcon, CheckCircleIcon, BoxIcon, MapPinIcon, UserGroupIcon, AddIcon, WrenchIcon, TrendingUpIcon, TagIcon, InfoIcon } from './Icons';
import { generateUUID } from '../utils';
import RuleBuilder from './RuleBuilder';

interface RuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveRule: (rule: ReconciliationRule, runImmediately?: boolean) => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    // Contextual: Creating from a transaction (likely from Import view)
    transaction?: Transaction | null;
    // Contextual: Editing an existing rule
    existingRule?: ReconciliationRule | null;
    // Helper callbacks for Quick Add
    onSaveCategory?: (category: Category) => void;
    onSavePayee?: (payee: Payee) => void;
    onSaveTag?: (tag: Tag) => void;
    onAddTransactionType?: (type: TransactionType) => void;
    onSaveMerchant?: (m: Merchant) => void;
    onSaveLocation?: (l: Location) => void;
    onSaveUser?: (u: User) => void;
}

const RuleModal: React.FC<RuleModalProps> = ({ 
    isOpen, onClose, onSaveRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, 
    transaction, existingRule, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, onSaveMerchant, onSaveLocation, onSaveUser
}) => {
    
    const [name, setName] = useState('');
    const [ruleCategory, setRuleCategory] = useState('description');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    
    // Actions / Enrichments
    const [setBalanceEffect, setSetBalanceEffect] = useState<BalanceEffect | ''>('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setMerchantId, setSetMerchantId] = useState('');
    const [setLocationId, setSetLocationId] = useState('');
    const [setUserId, setSetUserId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [customTagsText, setCustomTagsText] = useState('');
    const [skipImport, setSkipImport] = useState(false);

    // Initialization Logic
    useEffect(() => {
        if (isOpen) {
            if (existingRule) {
                // STATE 1: Editing existing rule
                setName(existingRule.name);
                setRuleCategory(existingRule.ruleCategory || 'description');
                setConditions(existingRule.conditions || []);
                setSetBalanceEffect(existingRule.setBalanceEffect || '');
                setSetTransactionTypeId(existingRule.setTransactionTypeId || '');
                setSetCategoryId(existingRule.setCategoryId || '');
                setSetPayeeId(existingRule.setPayeeId || '');
                setSetMerchantId(existingRule.setMerchantId || '');
                setSetLocationId(existingRule.setLocationId || '');
                setSetUserId(existingRule.setUserId || '');
                setAssignTagIds(new Set(existingRule.assignTagIds || []));
                setCustomTagsText('');
                setSkipImport(!!existingRule.skipImport);
            } else if (transaction) {
                // STATE 2: Creating from a transaction context
                setName(`${transaction.description} Rule`);
                setRuleCategory('description');
                setConditions([
                    { id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: transaction.description, nextLogic: 'AND' }
                ]);
                setSetBalanceEffect('');
                setSetTransactionTypeId(transaction.typeId || '');
                setSetCategoryId(transaction.categoryId || '');
                setSetPayeeId(transaction.payeeId || '');
                setSetMerchantId(transaction.merchantId || '');
                setSetLocationId(transaction.locationId || '');
                setSetUserId(transaction.userId || '');
                setAssignTagIds(new Set());
                setCustomTagsText('');
                setSkipImport(false);
            } else {
                // STATE 3: Creating fresh
                setName('');
                setRuleCategory('description');
                setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                setSetBalanceEffect('');
                setSetTransactionTypeId('');
                setSetCategoryId('');
                setSetPayeeId('');
                setSetMerchantId('');
                setSetLocationId('');
                setSetUserId('');
                setAssignTagIds(new Set());
                setCustomTagsText('');
                setSkipImport(false);
            }
        }
    }, [isOpen, transaction, existingRule]);
    
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

    const toggleTag = (tagId: string) => {
        setAssignTagIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tagId)) newSet.delete(tagId);
            else newSet.add(tagId);
            return newSet;
        });
    };

    const quickAdd = (type: 'category' | 'payee' | 'merchant' | 'location' | 'user' | 'tag' | 'type') => {
        const val = prompt(`Enter new ${type} name:`);
        if (!val || !val.trim()) return;
        const id = generateUUID();
        const label = val.trim();

        if (type === 'category' && onSaveCategory) { onSaveCategory({ id, name: label }); setSetCategoryId(id); }
        else if (type === 'payee' && onSavePayee) { onSavePayee({ id, name: label }); setSetPayeeId(id); }
        else if (type === 'merchant' && onSaveMerchant) { onSaveMerchant({ id, name: label }); setSetMerchantId(id); }
        else if (type === 'location' && onSaveLocation) { onSaveLocation({ id, name: label }); setSetLocationId(id); }
        else if (type === 'user' && onSaveUser) { onSaveUser({ id, name: label }); setSetUserId(id); }
        else if (type === 'type' && onAddTransactionType) { onAddTransactionType({ id, name: label, balanceEffect: 'expense' }); setSetTransactionTypeId(id); }
        else if (type === 'tag' && onSaveTag) { 
            const colors = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700'];
            onSaveTag({ id, name: label, color: colors[Math.floor(Math.random() * colors.length)] }); 
            setAssignTagIds(prev => new Set(prev).add(id));
        }
    };

    const handleAction = (runImmediately: boolean = false) => {
        if (!name.trim()) { alert('Rule Name is required.'); return; }
        if (conditions.length === 0) { alert('Please add at least one condition.'); return; }

        const processedTagIds = new Set(assignTagIds);
        if (customTagsText.trim() && onSaveTag) {
            const rawTags = customTagsText.split(',').map(t => t.trim()).filter(Boolean);
            rawTags.forEach(tagName => {
                const existing = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                if (existing) {
                    processedTagIds.add(existing.id);
                } else {
                    const id = generateUUID();
                    onSaveTag({ id, name: tagName, color: 'bg-slate-100 text-slate-600' });
                    processedTagIds.add(id);
                }
            });
        }

        onSaveRule({
            id: existingRule?.id || generateUUID(),
            name: name.trim(),
            ruleCategory,
            conditions,
            setBalanceEffect: setBalanceEffect || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setMerchantId: setMerchantId || undefined,
            setLocationId: setLocationId || undefined,
            setUserId: setUserId || undefined,
            assignTagIds: processedTagIds.size > 0 ? Array.from(processedTagIds) : undefined,
            skipImport
        }, runImmediately);
        onClose();
    };
    
    const isFromVerification = !!transaction;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Master Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-b bg-white sticky top-0 z-20 shadow-sm gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <WrenchIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                Rule Architect
                                {existingRule && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest ml-2">Revision Mode</span>}
                            </h2>
                            <p className="text-sm text-slate-500">Define logic to automatically classify and link your ledger entries.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                        <button type="button" onClick={() => handleAction(false)} className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all">Save Rule Only</button>
                        <button 
                            type="button" 
                            onClick={() => handleAction(true)} 
                            className="flex-1 sm:flex-none px-8 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                            title={isFromVerification ? "Saves the rule and immediately updates the pending verification list." : "Saves the rule and opens a dry-run preview against existing transactions."}
                        >
                            <SparklesIcon className="w-4 h-4" />
                            {isFromVerification ? 'Save & Apply to Batch' : 'Save & Run on Database'}
                        </button>
                    </div>
                </div>
                
                 <div className="p-8 space-y-10 overflow-y-auto bg-slate-50/50 flex-1 custom-scrollbar">
                    {/* Step 0: Name and Scope */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Identity / Rule Label</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Friendly name for this pattern..." className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-800 text-lg" required />
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Rule Category</label>
                            <select value={ruleCategory} onChange={e => setRuleCategory(e.target.value)} className="w-full p-3.5 border-2 border-slate-100 rounded-xl font-bold text-slate-700">
                                <option value="description">Descriptions</option>
                                <option value="payeeId">Payees</option>
                                <option value="merchantId">Merchants</option>
                                <option value="locationId">Locations</option>
                                <option value="metadata">Extraction Hints</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Step 1: Matching */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</div>
                            If data matches these criteria
                        </h3>
                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                    </div>
                    
                    {/* Step 2: Enrichments */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px]">2</div>
                                Then perform these enrichments
                            </h3>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-300 hover:border-red-400 transition-colors shadow-sm group">
                                <input type="checkbox" checked={skipImport} onChange={() => setSkipImport(!skipImport)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                                <span className="text-xs font-black text-red-700 uppercase flex items-center gap-1"><SlashIcon className="w-3 h-3" /> Auto-Ignore Record</span>
                            </label>
                        </div>
                        
                        {!skipImport ? (
                            <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Direction</label>
                                        </div>
                                        <select value={setBalanceEffect} onChange={(e) => setSetBalanceEffect(e.target.value as BalanceEffect)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none bg-slate-50">
                                            <option value="">-- No Change --</option>
                                            <option value="income">Income</option>
                                            <option value="expense">Expense</option>
                                            <option value="transfer">Transfer</option>
                                            <option value="investment">Investment</option>
                                            <option value="donation">Donation</option>
                                            <option value="tax">Tax</option>
                                            <option value="savings">Savings</option>
                                            <option value="debt">Debt</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                                            <button type="button" onClick={() => quickAdd('type')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                        </div>
                                        <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- No Change --</option>
                                            {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                                            <button type="button" onClick={() => quickAdd('category')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                        </div>
                                        <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- No Change --</option>
                                            {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Payee</label>
                                            <button type="button" onClick={() => quickAdd('payee')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                        </div>
                                        <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- No Change --</option>
                                            {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Merchant</label>
                                            <button type="button" onClick={() => quickAdd('merchant')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                        </div>
                                        <select value={setMerchantId} onChange={(e) => setSetMerchantId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- No Change --</option>
                                            {merchants.sort((a,b)=>a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                                            <button type="button" onClick={() => quickAdd('location')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                        </div>
                                        <select value={setLocationId} onChange={(e) => setSetLocationId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- No Change --</option>
                                            {locations.sort((a,b)=>a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">User</label>
                                            <button type="button" onClick={() => quickAdd('user')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                        </div>
                                        <select value={setUserId} onChange={(e) => setSetUserId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                            <option value="">-- No Change --</option>
                                            {users.sort((a,b)=>a.name.localeCompare(b.name)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Append Taxonomy Tags (Selection)</label>
                                        <div className="flex flex-wrap gap-2 p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 min-h-[100px]">
                                            {tags.map(tag => (
                                                <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`px-3 py-1.5 rounded-full text-[10px] border-2 transition-all font-black uppercase tracking-wider ${assignTagIds.has(tag.id) ? tag.color + ' border-indigo-500 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-200 opacity-60 hover:opacity-100'}`}>{tag.name}</button>
                                            ))}
                                            <button type="button" onClick={() => quickAdd('tag')} className="px-3 py-1.5 rounded-full text-[10px] border-2 border-dashed border-indigo-300 text-indigo-600 font-bold hover:bg-indigo-50 transition-colors uppercase">+ Add Global Tag</button>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-3 px-1">
                                            <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest">Write-in Custom Tags</label>
                                            <div className="flex items-center gap-1 group/help">
                                                <InfoIcon className="w-3 h-3 text-slate-300 cursor-help" />
                                                <span className="text-[8px] text-slate-400 font-bold opacity-0 group-hover/help:opacity-100 transition-opacity uppercase tracking-tighter">Comma Separated</span>
                                            </div>
                                        </div>
                                        <textarea 
                                            value={customTagsText} 
                                            onChange={e => setCustomTagsText(e.target.value)}
                                            placeholder="Tax, Personal, etc." 
                                            className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-indigo-50/20 focus:ring-0 focus:border-indigo-500 text-sm font-medium h-[100px] resize-none"
                                        />
                                        <p className="text-[9px] text-slate-400 mt-2 font-medium italic">New tags will be registered automatically using a system default theme.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-red-50 rounded-[2.5rem] border-2 border-red-100 border-dashed animate-pulse">
                                <SlashIcon className="w-16 h-16 text-red-200 mx-auto mb-4" />
                                <p className="text-xl font-black text-red-800 uppercase tracking-tight">Pattern Exclusion Active</p>
                                <p className="text-sm text-red-600 mt-2 max-w-md mx-auto font-medium">Matching entries will be suppressed and discarded during ingestion to prevent data pollution.</p>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default RuleModal;
