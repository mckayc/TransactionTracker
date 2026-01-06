
import React, { useState, useEffect, useMemo } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, RuleCondition, Tag, Merchant, Location, User, BalanceEffect, FlowDesignation } from '../types';
import { CloseIcon, SlashIcon, SparklesIcon, CheckCircleIcon, BoxIcon, MapPinIcon, UserGroupIcon, AddIcon, WrenchIcon, TrendingUpIcon, TagIcon, InfoIcon, RepeatIcon } from './Icons';
import { generateUUID } from '../utils';
import RuleBuilder from './RuleBuilder';

interface RuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveRule: (rule: ReconciliationRule, runImmediately?: boolean) => void;
    accounts: Account[];
    transactionTypes: TransactionType[];
    flowDesignations: FlowDesignation[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    transaction?: Transaction | null;
    existingRule?: ReconciliationRule | null;
}

const RuleModal: React.FC<RuleModalProps> = ({ 
    isOpen, onClose, onSaveRule, accounts, transactionTypes, flowDesignations, categories, tags, payees, merchants, locations, users, 
    transaction, existingRule
}) => {
    
    const [name, setName] = useState('');
    const [ruleCategory, setRuleCategory] = useState('description');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    
    const [setBalanceEffect, setSetBalanceEffect] = useState<BalanceEffect | ''>('');
    const [setTransactionTypeId, setSetTransactionTypeId] = useState('');
    const [setFlowDesignationId, setSetFlowDesignationId] = useState('');
    const [setCategoryId, setSetCategoryId] = useState('');
    const [setPayeeId, setSetPayeeId] = useState('');
    const [setMerchantId, setSetMerchantId] = useState('');
    const [setLocationId, setSetLocationId] = useState('');
    const [setUserId, setSetUserId] = useState('');
    const [assignTagIds, setAssignTagIds] = useState<Set<string>>(new Set());
    const [skipImport, setSkipImport] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (existingRule) {
                setName(existingRule.name);
                setRuleCategory(existingRule.ruleCategory || 'description');
                setConditions(existingRule.conditions || []);
                setSetBalanceEffect(existingRule.setBalanceEffect || '');
                setSetTransactionTypeId(existingRule.setTransactionTypeId || '');
                setSetFlowDesignationId(existingRule.setFlowDesignationId || '');
                setSetCategoryId(existingRule.setCategoryId || '');
                setSetPayeeId(existingRule.setPayeeId || '');
                setSetMerchantId(existingRule.setMerchantId || '');
                setSetLocationId(existingRule.setLocationId || '');
                setSetUserId(existingRule.setUserId || '');
                setAssignTagIds(new Set(existingRule.assignTagIds || []));
                setSkipImport(!!existingRule.skipImport);
            } else if (transaction) {
                setName(`${transaction.description} Rule`);
                setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: transaction.description, nextLogic: 'AND' }]);
                setSetCategoryId(transaction.categoryId || '');
                setSetTransactionTypeId(transaction.typeId || '');
                setSetFlowDesignationId(transaction.flowDesignationId || '');
                setSetPayeeId(transaction.payeeId || '');
                setSetMerchantId(transaction.merchantId || '');
                setSetLocationId(transaction.locationId || '');
                setSetUserId(transaction.userId || '');
                setAssignTagIds(new Set());
                setSkipImport(false);
            } else {
                setName('');
                setConditions([{ id: generateUUID(), type: 'basic', field: 'description', operator: 'contains', value: '', nextLogic: 'AND' }]);
                setSetBalanceEffect('');
                setSetTransactionTypeId('');
                setSetFlowDesignationId('');
                setSetCategoryId('');
                setSetPayeeId('');
                setSetMerchantId('');
                setSetLocationId('');
                setSetUserId('');
                setAssignTagIds(new Set());
                setSkipImport(false);
            }
        }
    }, [isOpen, transaction, existingRule]);

    if (!isOpen) return null;

    const handleAction = (runImmediately: boolean = false) => {
        if (!name.trim()) return alert('Name required.');
        onSaveRule({
            id: existingRule?.id || generateUUID(),
            name: name.trim(),
            ruleCategory,
            conditions,
            setBalanceEffect: setBalanceEffect || undefined,
            setTransactionTypeId: setTransactionTypeId || undefined,
            setFlowDesignationId: setFlowDesignationId || undefined,
            setCategoryId: setCategoryId || undefined,
            setPayeeId: setPayeeId || undefined,
            setMerchantId: setMerchantId || undefined,
            setLocationId: setLocationId || undefined,
            setUserId: setUserId || undefined,
            assignTagIds: assignTagIds.size > 0 ? Array.from(assignTagIds) : undefined,
            skipImport
        }, runImmediately);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-20 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><WrenchIcon className="w-6 h-6" /></div>
                        <div><h2 className="text-2xl font-black text-slate-800">Rule Architect</h2><p className="text-sm text-slate-500">Design automation for your ledger entries.</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
                        <button onClick={() => handleAction(true)} className="px-8 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all"><SparklesIcon className="w-4 h-4" /> Save & Apply</button>
                    </div>
                </div>
                
                 <div className="p-8 space-y-8 overflow-y-auto bg-slate-50/50 flex-1 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Rule Identity</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Friendly name..." className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800" required />
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Organizational Category</label>
                            <select value={ruleCategory} onChange={e => setRuleCategory(e.target.value)} className="w-full p-3.5 border-2 border-slate-100 rounded-xl font-bold text-slate-700">
                                <option value="description">Descriptions</option>
                                <option value="payeeId">Payees</option>
                                <option value="metadata">Metadata</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase mb-6 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</div> Conditions</h3>
                        <RuleBuilder items={conditions} onChange={setConditions} accounts={accounts} />
                    </div>
                    
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px]">2</div> Results</h3>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-300 hover:border-red-400 transition-colors shadow-sm group">
                                <input type="checkbox" checked={skipImport} onChange={() => setSkipImport(!skipImport)} className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer" />
                                <span className="text-xs font-black text-red-700 uppercase flex items-center gap-1"><SlashIcon className="w-3 h-3" /> Auto-Ignore</span>
                            </label>
                        </div>
                        
                        {!skipImport && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Flow Designation</label>
                                    <select value={setFlowDesignationId} onChange={e => setSetFlowDesignationId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-indigo-700 bg-indigo-50/30">
                                        <option value="">-- No Change --</option>
                                        {flowDesignations.map(fd => <option key={fd.id} value={fd.id}>{fd.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Impact Type</label>
                                    <select value={setBalanceEffect} onChange={e => setSetBalanceEffect(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700">
                                        <option value="">-- No Change --</option>
                                        <option value="income">Income</option>
                                        <option value="expense">Expense</option>
                                        <option value="transfer">Transfer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Category</label>
                                    <select value={setCategoryId} onChange={e => setSetCategoryId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700">
                                        <option value="">-- No Change --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Payee</label>
                                    <select value={setPayeeId} onChange={e => setSetPayeeId(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700">
                                        <option value="">-- No Change --</option>
                                        {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default RuleModal;
