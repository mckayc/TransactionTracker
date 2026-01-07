import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Counterparty, Category, RuleCondition, Tag, Location, User } from '../types';
import { CloseIcon, SlashIcon, SparklesIcon, CheckCircleIcon, BoxIcon, MapPinIcon, UserGroupIcon, PlayIcon, TagIcon, AddIcon, ChevronDownIcon } from './Icons';
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
    // Fix: transaction can be a Transaction or a ReconciliationRule context depending on whether we are creating or editing
    transaction: any;
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
    // Fix: Corrected state array destructuring to avoid duplicate variable names and define missing setters
    const [setLocationId, setSetLocationId] = useState('');
    const [setUserId, setSetUserId] = useState('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (transaction) {
                // Fix: Access properties from ReconciliationRule or Transaction safely using type cast
                const ctx = transaction as any;
                setName(ctx.name || (ctx.description ? `${ctx.description} Rule` : ''));
                const newConditions: RuleCondition[] = ctx.conditions ? [...ctx.conditions] : [
                    { id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: ctx.description, nextLogic: 'AND' }
                ];
                setConditions(newConditions);
                setSetCategoryId(ctx.categoryId || ctx.setCategoryId || '');
                setSetCounterpartyId(ctx.counterpartyId || ctx.setCounterpartyId || '');
                setSetLocationId(ctx.locationId || ctx.setLocationId || '');
                setSetUserId(ctx.userId || ctx.setUserId || '');
                setSetTransactionTypeId(ctx.typeId || ctx.setTransactionTypeId || '');
                setAssignTagIds(new Set(ctx.tagIds || ctx.assignTagIds || []));
                setSkipImport(!!ctx.skipImport);
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
    
    // Recursive helper for deep hierarchies
    const getSortedOptions = (items: any[], parentId?: string, depth = 0): { id: string, name: string }[] => {
        return items
            .filter(i => i.parentId === parentId)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .flatMap(item => [
                { id: item.id, name: `${'\u00A0'.repeat(depth * 3)}${depth > 0 ? '⌞ ' : ''}${item.name}` },
                ...getSortedOptions(items, item.id, depth + 1)
            ]);
    };

    const sortedCounterpartyOptions = useMemo(() => getSortedOptions(counterparties), [counterparties]);
    const sortedCategoryOptions = useMemo(() => getSortedOptions(categories), [categories]);
    const sortedAccountOptions = useMemo(() => [...accounts].sort((a,b) => a.name.localeCompare(b.name)), [accounts]);

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
        id: transaction?.id === 'temp-context' ? generateUUID() : (transaction?.id || generateUUID()),
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
        <div className="flex flex-col h-full bg-white overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-20 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-indigo-600" />
                        Logic Canvas
                    </h2>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Refining standard operating procedures</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-black uppercase bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">Reset</button>
                    <button onClick={handleSave} className="px-5 py-2.5 text-xs font-black uppercase bg-slate-700 text-white rounded-xl shadow-md">Apply</button>
                    <button onClick={handleSaveAndRun} className="px-8 py-2.5 text-xs font-black uppercase bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2">
                        <PlayIcon className="w-4 h-4" /> Commit & Execute
                    </button>
                </div>
            </div>
            
             <form onSubmit={handleSave} className="flex-1 p-8 space-y-10 overflow-y-auto bg-slate-50/20 custom-scrollbar pb-24">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Administrative Identity</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="System designation for this logic..." className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-lg shadow-inner" required />
                </div>
                
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</div>
                        Observation Criteria
                    </h3>
                    <RuleBuilder items={conditions} onChange={setConditions} accounts={sortedAccountOptions} />
                </div>
                
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px]">2</div>
                            Ledger Resolution
                        </h3>
                        <label className="flex items-center gap-2 cursor-pointer bg-red-50 px-4 py-2 rounded-xl border border-red-100 hover:border-red-400 transition-colors shadow-sm group">
                            <input type="checkbox" checked={skipImport} onChange={() => setSkipImport(!skipImport)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                            <span className="text-[10px] font-black text-red-700 uppercase flex items-center gap-1"><SlashIcon className="w-3 h-3" /> Exclude matching records</span>
                        </label>
                    </div>
                    
                    {!skipImport ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <div className="space-y-1">
                                <label className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <span>Set Category</span>
                                    <button type="button" onClick={handleCreateNewCategory} className="text-indigo-600 hover:underline">NEW</button>
                                </label>
                                <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 shadow-inner">
                                    <option value="">-- No Change --</option>
                                    {sortedCategoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <span>Set Entity</span>
                                    <button type="button" onClick={handleCreateNewCounterparty} className="text-indigo-600 hover:underline">NEW</button>
                                </label>
                                <select value={setCounterpartyId} onChange={(e) => setSetCounterpartyId(e.target.value)} className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 shadow-inner">
                                    <option value="">-- No Change --</option>
                                    {sortedCounterpartyOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign User</label>
                                <select value={setUserId} onChange={(e) => setSetUserId(e.target.value)} className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 shadow-inner">
                                    <option value="">-- No Change --</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-1 md:col-span-3 pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Attach Institutional Tags</label>
                                    <button type="button" onClick={() => alert("Tag management is in Management Hub")} className="text-[9px] font-black text-indigo-500 uppercase hover:underline">Global Registry</button>
                                </div>
                                <div className="flex flex-wrap gap-2 p-4 border-2 border-slate-50 rounded-[2rem] bg-slate-50/50 shadow-inner">
                                    {tags.map(tag => (
                                        <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-2 transition-all ${assignTagIds.has(tag.id) ? tag.color + ' border-indigo-600 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}>{tag.name}</button>
                                    ))}
                                    {tags.length === 0 && <p className="text-xs text-slate-300 italic p-2">No tags registered in system.</p>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center bg-red-50 rounded-[2rem] border-2 border-red-100 border-dashed animate-pulse">
                            <SlashIcon className="w-12 h-12 text-red-200 mx-auto mb-4" />
                            <p className="text-lg font-black text-red-800 uppercase tracking-tight">Exclusion sequence active</p>
                            <p className="text-xs text-red-600 mt-1 max-w-md mx-auto font-medium">Matching records will be purged from the ingestion stream.</p>
                        </div>
                    )}
                </div>
             </form>
        </div>
    );
};

export default RuleModal;