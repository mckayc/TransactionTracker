
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Counterparty, Category, RuleCondition, Tag, Location, User } from '../types';
import { CloseIcon, SlashIcon, SparklesIcon, CheckCircleIcon, BoxIcon, MapPinIcon, UserGroupIcon, PlayIcon, TagIcon, AddIcon } from './Icons';
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
    counterparties: Counterparty[];
    locations: Location[];
    users: User[];
    transaction: Transaction | null;
    onSaveCategory?: (category: Category) => void;
    onSaveCounterparty?: (cp: Counterparty) => void;
    onSaveTag?: (tag: Tag) => void;
    onAddTransactionType?: (type: TransactionType) => void;
    onSaveAndRun?: (rule: ReconciliationRule) => void;
}

const RuleModal: React.FC<RuleModalProps> = ({ 
    isOpen, onClose, onSaveRule, accounts, transactionTypes, categories, tags, counterparties, locations, users, transaction, onSaveCategory, onSaveCounterparty, onSaveTag, onAddTransactionType, onSaveAndRun
}) => {
    
    const [name, setName] = useState('');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setCounterpartyId, setSetCounterpartyId] = useState('');
    const [setLocationId, setSetLocationId] = useState('');
    const [setUserId, setSetUserId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
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
                setSetCounterpartyId(transaction.counterpartyId || '');
                setSetLocationId(transaction.locationId || '');
                setSetUserId(transaction.userId || '');
                setSetTransactionTypeId(transaction.typeId || '');
                setAssignTagIds(new Set(transaction.tagIds || []));
                setSkipImport(false);
            } else {
                setName('');
                setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                setSetCategoryId('');
                setSetCounterpartyId('');
                setSetLocationId('');
                setSetUserId('');
                setSetTransactionTypeId('');
                setAssignTagIds(new Set());
                setSkipImport(false);
            }
        }
    }, [isOpen, transaction]);
    
    const sortedCounterpartyOptions = useMemo(() => [...counterparties].sort((a,b) => a.name.localeCompare(b.name)), [counterparties]);
    const sortedCategoryOptions = useMemo(() => [...categories].sort((a,b) => a.name.localeCompare(b.name)), [categories]);

    if (!isOpen) return null;

    const toggleTag = (tagId: string) => {
        setAssignTagIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tagId)) newSet.delete(tagId); else newSet.add(tagId);
            return newSet;
        });
    };

    const handleCreateNewCounterparty = () => {
        const n = prompt("New Counterparty Name:");
        if (n && n.trim()) {
            const cp: Counterparty = { id: generateUUID(), name: n.trim() };
            onSaveCounterparty?.(cp);
            setSetCounterpartyId(cp.id);
        }
    };

    const handleCreateNewCategory = () => {
        const n = prompt("New Category Name:");
        if (n && n.trim()) {
            const cat: Category = { id: generateUUID(), name: n.trim() };
            onSaveCategory?.(cat);
            setSetCategoryId(cat.id);
        }
    };

    const getRulePayload = (): ReconciliationRule => ({
        id: transaction?.id === 'temp-context' ? generateUUID() : (transaction?.appliedRuleId || generateUUID()),
        name: name.trim(),
        conditions,
        setCategoryId: setCategoryId || undefined,
        setCounterpartyId: setCounterpartyId || undefined,
        setLocationId: setLocationId || undefined,
        setUserId: setUserId || undefined,
        setTransactionTypeId: setTransactionTypeId || undefined,
        assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
        skipImport
    });

    const handleSave = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!name.trim()) { alert('Rule Name is required.'); return; }
        onSaveRule(getRulePayload());
    };

    const handleSaveAndRun = () => {
        if (!name.trim()) { alert('Rule Name is required.'); return; }
        if (onSaveAndRun) onSaveAndRun(getRulePayload());
        else onSaveRule(getRulePayload());
    };
    
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b bg-white z-20 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <SparklesIcon className="w-6 h-6 text-indigo-600" />
                            Logic Forge
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Design criteria for automatic normalization.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-5 py-2.5 text-sm font-black text-white bg-slate-700 rounded-xl hover:bg-slate-800 shadow-md">Save</button>
                        <button onClick={handleSaveAndRun} className="px-8 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center gap-2 transition-transform active:scale-95">
                            <PlayIcon className="w-4 h-4" /> Save and Run
                        </button>
                    </div>
                </div>
                
                 <form onSubmit={handleSave} className="flex-1 p-8 space-y-8 overflow-y-auto bg-slate-50/50 custom-scrollbar">
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
                                Execution logic (Targets)
                            </h3>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-300 hover:border-red-400 transition-colors shadow-sm group">
                                <input type="checkbox" checked={skipImport} onChange={() => setSkipImport(!skipImport)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                                <span className="text-xs font-black text-red-700 uppercase flex items-center gap-1"><SlashIcon className="w-3 h-3" /> Exclude matching data</span>
                            </label>
                        </div>
                        
                        {!skipImport ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        <span>Set Category</span>
                                        <button type="button" onClick={handleCreateNewCategory} className="text-indigo-600 hover:underline">NEW</button>
                                    </label>
                                    <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        <span>Set Counterparty</span>
                                        <button type="button" onClick={handleCreateNewCounterparty} className="text-indigo-600 hover:underline">NEW</button>
                                    </label>
                                    <select value={setCounterpartyId} onChange={(e) => setSetCounterpartyId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {sortedCounterpartyOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign User</label>
                                    <select value={setUserId} onChange={(e) => setSetUserId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Set Location</label>
                                    <select value={setLocationId} onChange={(e) => setSetLocationId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Set Tx Type</label>
                                    <select value={setTransactionTypeId} onChange={(e) => setSetTransactionTypeId(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-slate-700 focus:border-indigo-500 outline-none">
                                        <option value="">-- No Change --</option>
                                        {transactionTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-3 pt-4 border-t border-slate-100">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Attach Tags Automatically</label>
                                    <div className="flex flex-wrap gap-2 p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 shadow-inner">
                                        {tags.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-2 transition-all ${assignTagIds.has(tag.id) ? tag.color + ' border-indigo-500 shadow-md ring-2 ring-indigo-50' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>{tag.name}</button>
                                        ))}
                                        {tags.length === 0 && <p className="text-xs text-slate-400 italic">No tags configured in system.</p>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center bg-red-50 rounded-2xl border-2 border-red-100 border-dashed animate-pulse">
                                <SlashIcon className="w-12 h-12 text-red-200 mx-auto mb-4" />
                                <p className="text-lg font-black text-red-800 uppercase tracking-tight">Exclusion logic active</p>
                                <p className="text-sm text-red-600 mt-1 max-w-md mx-auto font-medium">Matching records will be discarded.</p>
                            </div>
                        )}
                    </div>
                 </form>
            </div>
        </div>
    );
};

export default RuleModal;
