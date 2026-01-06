
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, RuleCondition, Tag, Merchant, Location, User } from '../types';
import { CloseIcon, SlashIcon, SparklesIcon, CheckCircleIcon, BoxIcon, MapPinIcon, UserGroupIcon, AddIcon, WrenchIcon } from './Icons';
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
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    transaction: Transaction | null;
    onSaveCategory?: (category: Category) => void;
    onSavePayee?: (payee: Payee) => void;
    onSaveTag?: (tag: Tag) => void;
    onAddTransactionType?: (type: TransactionType) => void;
    onSaveMerchant?: (m: Merchant) => void;
    onSaveLocation?: (l: Location) => void;
    onSaveUser?: (u: User) => void;
}

const RuleModal: React.FC<RuleModalProps> = ({ 
    isOpen, onClose, onSaveRule, accounts, transactionTypes, categories, tags, payees, merchants, locations, users, transaction, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, onSaveMerchant, onSaveLocation, onSaveUser
}) => {
    
    const [name, setName] = useState('');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    
    // Actions
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setMerchantId, setSetMerchantId] = useState('');
    const [setLocationId, setSetLocationId] = useState('');
    const [setUserId, setSetUserId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [customTagsText, setCustomTagsText] = useState('');
    const [skipImport, setSkipImport] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (transaction) {
                setName(`${transaction.description} Rule`);
                const newConditions: RuleCondition[] = [
                    { id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: transaction.description, nextLogic: 'AND' }
                ];
                if (transaction.accountId) {
                    newConditions.push({ id: generateUUID(), type: 'basic', field: 'accountId', operator: 'equals', value: transaction.accountId, nextLogic: 'AND' });
                }
                setConditions(newConditions);
                
                setSetCategoryId(transaction.categoryId || '');
                setSetPayeeId(transaction.payeeId || '');
                setSetMerchantId(transaction.merchantId || '');
                setSetLocationId(transaction.locationId || '');
                setSetUserId(transaction.userId || '');
                setSetTransactionTypeId(transaction.typeId || '');
                setAssignTagIds(new Set());
                setCustomTagsText('');
                setSkipImport(false);
            } else {
                setName('');
                setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                setSetCategoryId('');
                setSetPayeeId('');
                setSetMerchantId('');
                setSetLocationId('');
                setSetUserId('');
                setSetTransactionTypeId('');
                setAssignTagIds(new Set());
                setCustomTagsText('');
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

    const handleSave = (e: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!name.trim()) { alert('Rule Name is required.'); return; }
        if (conditions.length === 0) { alert('Please add at least one condition.'); return; }

        // Process custom tags
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
            id: generateUUID(),
            name: name.trim(),
            conditions,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setMerchantId: setMerchantId || undefined,
            setLocationId: setLocationId || undefined,
            setUserId: setUserId || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            assignTagIds: processedTagIds.size > 0 ? Array.from(processedTagIds) : undefined,
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
                            Rule Architect
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Define logic to automatically classify and link your ledger entries.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                        <button type="button" onClick={handleSave} className="px-5 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all">Save Rule Only</button>
                        <button type="button" onClick={handleSave} className="px-8 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2">
                            <WrenchIcon className="w-4 h-4" />
                            Save & Run on Batch
                        </button>
                    </div>
                </div>
                
                 <form onSubmit={handleSave} className="p-8 space-y-8 overflow-y-auto bg-slate-50/50">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Identity</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Friendly name for this pattern..." className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-800 text-lg" required />
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">1</div>
                            If data matches these criteria
                        </h3>
                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">2</div>
                                Then perform these enrichments
                            </h3>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-300 hover:border-red-400 transition-colors shadow-sm group">
                                <input type="checkbox" checked={skipImport} onChange={() => setSkipImport(!skipImport)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                                <span className="text-xs font-black text-red-700 uppercase flex items-center gap-1"><SlashIcon className="w-3 h-3" /> Exclude Record</span>
                            </label>
                        </div>
                        
                        {!skipImport ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Direction</label>
                                        <button type="button" onClick={() => quickAdd('type')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                    </div>
                                    <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                                        <button type="button" onClick={() => quickAdd('category')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                    </div>
                                    <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Payee</label>
                                        <button type="button" onClick={() => quickAdd('payee')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                    </div>
                                    <select value={setPayeeId} onChange={(e) => setSetPayeeId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {sortedPayeeOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Merchant</label>
                                        <button type="button" onClick={() => quickAdd('merchant')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                    </div>
                                    <select value={setMerchantId} onChange={(e) => setSetMerchantId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {merchants.sort((a,b)=>a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                                        <button type="button" onClick={() => quickAdd('location')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                    </div>
                                    <select value={setLocationId} onChange={(e) => setSetLocationId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {locations.sort((a,b)=>a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">User</label>
                                        <button type="button" onClick={() => quickAdd('user')} className="text-[10px] font-bold text-indigo-600 hover:underline">+ NEW</button>
                                    </div>
                                    <select value={setUserId} onChange={(e) => setSetUserId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {users.sort((a,b)=>a.name.localeCompare(b.name)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-3 space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Append Taxonomy Tags (Selection)</label>
                                        <div className="flex flex-wrap gap-2 p-4 border rounded-2xl bg-slate-50 shadow-inner">
                                            {tags.map(tag => (
                                                <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`px-3 py-1.5 rounded-full text-xs border-2 transition-all font-bold ${assignTagIds.has(tag.id) ? tag.color + ' border-indigo-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}>{tag.name}</button>
                                            ))}
                                            <button type="button" onClick={() => quickAdd('tag')} className="px-3 py-1.5 rounded-full text-xs border-2 border-dashed border-indigo-300 text-indigo-600 font-bold hover:bg-indigo-50">+ Add Global Tag</button>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                                        <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 ml-1">Write-in Tags</label>
                                        <input 
                                            type="text" 
                                            value={customTagsText} 
                                            onChange={e => setCustomTagsText(e.target.value)}
                                            placeholder="Tax, Personal, etc." 
                                            className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-medium"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2 font-medium italic">Separate multiple tags with commas. New tags will be created automatically using a default theme.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center bg-red-50 rounded-2xl border-2 border-red-100 border-dashed animate-pulse">
                                <SlashIcon className="w-12 h-12 text-red-200 mx-auto mb-4" />
                                <p className="text-lg font-black text-red-800 uppercase tracking-tight">Auto-Purge Active</p>
                                <p className="text-sm text-red-600 mt-1 max-w-md mx-auto font-medium">Any matching records will be discarded to prevent data noise.</p>
                            </div>
                        )}
                    </div>
                 </form>
            </div>
        </div>
    );
};

export default RuleModal;
