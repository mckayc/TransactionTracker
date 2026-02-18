
import React, { useMemo, useState } from 'react';
// Added User type to imports to support TransactionTable requirements
import type { Transaction, DashboardWidget, Category, Counterparty, Account, TransactionType, Tag, User } from '../../types';
import { parseISOLocal } from '../../dateUtils';
import { ArrowUpIcon, ArrowDownIcon, ExclamationTriangleIcon, RepeatIcon, CheckCircleIcon, CloseIcon, TableIcon, InfoIcon } from '../Icons';
import TransactionTable from '../TransactionTable';

interface Props {
    widget: DashboardWidget;
    allWidgets: DashboardWidget[];
    transactions: Transaction[];
    categories: Category[];
    counterparties: Counterparty[];
    accounts: Account[];
    transactionTypes: TransactionType[];
    tags: Tag[];
    // Added users prop to Props interface
    users: User[];
}

// Added users to component destructuring to fix line 276 and 313 "Cannot find name 'users'"
export const ComparisonWidget: React.FC<Props> = ({ widget, allWidgets, transactions, categories, counterparties, accounts, transactionTypes, tags, users }) => {
    const [inspectingItem, setInspectingItem] = useState<any | null>(null);
    
    const config = widget.config;
    const baseId = config?.comparisonBaseId;
    const targetId = config?.comparisonTargetId;

    const baseWidget = useMemo(() => allWidgets.find(w => w.id === baseId), [allWidgets, baseId]);
    const targetWidget = useMemo(() => allWidgets.find(w => w.id === targetId), [allWidgets, targetId]);

    const getFilteredTransactions = (w: DashboardWidget) => {
        if (w.type !== 'cashflow' || !w.config) return [];
        const { 
            period = 'month', 
            lookback = 0, 
            excludeUnknown = true, 
            excludeKeywords = '', 
            showIncome = true, 
            showExpenses = true, 
            showInvestments = true, 
            showDonations = true,
            userIds = []
        } = w.config;
        
        const typeRegistry = new Map(transactionTypes.map(t => [t.id, t]));
        const categoryRegistry = new Map(categories.map(c => [c.id, c.name]));
        const counterpartyRegistry = new Map(counterparties.map(p => [p.id, p.name]));
        const accountRegistry = new Map(accounts.map(a => [a.id, a.name]));

        const now = new Date();
        const s = new Date(now); s.setHours(0,0,0,0);
        const e = new Date(now); e.setHours(23,59,59,999);

        if (period === 'month') { 
            const d = new Date(now);
            d.setDate(1);
            d.setMonth(d.getMonth() - lookback);
            s.setTime(d.getTime());
            e.setTime(new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime());
        }
        else if (period === 'year') { 
            const targetYear = now.getFullYear() - lookback;
            s.setFullYear(targetYear, 0, 1); 
            e.setFullYear(targetYear, 11, 31); 
        }
        else if (period === 'quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const targetQuarterIndex = currentQuarter - lookback;
            const targetDate = new Date(now.getFullYear(), targetQuarterIndex * 3, 1);
            s.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), 1);
            const endMonth = targetDate.getMonth() + 3;
            e.setFullYear(targetDate.getFullYear(), endMonth, 0);
        }
        else if (period === 'week') { 
            const day = s.getDay(); 
            s.setDate(s.getDate() - day - (lookback * 7)); 
            e.setTime(s.getTime()); 
            e.setDate(s.getDate() + 6); 
        }

        const keywords = excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        return transactions.filter(tx => {
            const txDate = parseISOLocal(tx.date);
            if (txDate < s || txDate > e || tx.isParent) return false;

            if (userIds && userIds.length > 0 && !userIds.includes(tx.userId || '')) return false;

            const txType = typeRegistry.get(tx.typeId);
            const effect = txType?.balanceEffect || 'outgoing';
            
            if (effect === 'neutral') return false;
            if (!showIncome && effect === 'incoming') return false;
            if (!showExpenses && effect === 'outgoing' && tx.typeId !== 'type_investment' && tx.typeId !== 'type_donation') return false;
            if (!showInvestments && tx.typeId === 'type_investment') return false;
            if (!showDonations && tx.typeId === 'type_donation') return false;
            
            const categoryName = categoryRegistry.get(tx.categoryId) || '';
            const counterpartyName = counterpartyRegistry.get(tx.counterpartyId || '') || '';
            const accountName = accountRegistry.get(tx.accountId || '') || '';

            if (excludeUnknown) {
                if (tx.categoryId === 'cat_other' || categoryName.toLowerCase().includes('unallocated') || categoryName.toLowerCase() === 'other') return false;
            }

            if (keywords.length > 0) {
                const fullSearchString = `${tx.description} ${tx.originalDescription || ''} ${categoryName} ${counterpartyName} ${accountName}`.toLowerCase();
                if (keywords.some(kw => fullSearchString.includes(kw))) return false;
            }

            return true;
        });
    };

    const comparisonData = useMemo(() => {
        if (!baseWidget || !targetWidget) return null;
        const baseTxs = getFilteredTransactions(baseWidget);
        const targetTxs = getFilteredTransactions(targetWidget);
        const dimension = baseWidget.config?.displayDataType || 'type';
        
        const baseHidden = new Set(baseWidget.config?.hiddenDataIds || []);
        const targetHidden = new Set(targetWidget.config?.hiddenDataIds || []);

        const aggregate = (txs: Transaction[]) => {
            const map = new Map<string, { label: string, total: number, txs: Transaction[] }>();
            txs.forEach(tx => {
                const keys: { id: string, label: string }[] = [];
                
                if (dimension === 'tag') {
                    const txTags = tx.tagIds && tx.tagIds.length > 0 ? tx.tagIds : ['no-tag'];
                    txTags.forEach(tId => {
                        keys.push({ id: tId, label: tags.find(t => t.id === tId)?.name || 'No Label' });
                    });
                } else {
                    let id = '', label = '';
                    if (dimension === 'category') { id = tx.categoryId; label = categories.find(c => c.id === id)?.name || 'Other'; }
                    else if (dimension === 'counterparty') { id = tx.counterpartyId || `desc_${tx.description}`; label = counterparties.find(cp => cp.id === tx.counterpartyId)?.name || tx.description || 'Other'; }
                    else if (dimension === 'account') { id = tx.accountId; label = accounts.find(a => a.id === id)?.name || 'Other'; }
                    else { id = tx.typeId; label = transactionTypes.find(t => t.id === id)?.name || 'Other'; }
                    keys.push({ id, label });
                }
                
                keys.forEach(k => {
                    if (!map.has(k.id)) map.set(k.id, { label: k.label, total: 0, txs: [] });
                    map.get(k.id)!.total += tx.amount;
                    map.get(k.id)!.txs.push(tx);
                });
            });
            return map;
        };

        const baseMap = aggregate(baseTxs);
        const targetMap = aggregate(targetTxs);
        const allKeys = new Set([...baseMap.keys(), ...targetMap.keys()]);

        return Array.from(allKeys).map(key => {
            const b = baseMap.get(key);
            const t = targetMap.get(key);
            const bVal = b?.total || 0;
            const tVal = t?.total || 0;
            const diff = tVal - bVal;
            return { 
                id: key, 
                label: t?.label || b?.label || 'Unknown', 
                baseVal: bVal, 
                targetVal: tVal,
                baseTransactions: b?.txs || [],
                targetTransactions: t?.txs || [],
                diff, 
                pct: bVal !== 0 ? (diff / Math.abs(bVal)) * 100 : (tVal !== 0 ? 100 : 0) 
            };
        })
        .filter(d => Math.abs(d.diff) > 0.01)
        .filter(d => !baseHidden.has(d.id) && !targetHidden.has(d.id))
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    }, [baseWidget, targetWidget, transactions, categories, counterparties, accounts, transactionTypes, tags]);

    if (!baseId || !targetId) return <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/50"><RepeatIcon className="w-12 h-12 text-slate-200 mb-3" /><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuration Required</p></div>;
    if (!baseWidget || !targetWidget) return <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-red-50/30"><ExclamationTriangleIcon className="w-10 h-10 text-red-200 mb-3" /><p className="text-xs font-black text-red-400 uppercase tracking-widest">Logic Severed</p></div>;

    const totalBase = comparisonData?.reduce((s, d) => s + d.baseVal, 0) || 0;
    const totalTarget = comparisonData?.reduce((s, d) => s + d.targetVal, 0) || 0;
    const totalDiff = totalTarget - totalBase;

    return (
        <div className="flex flex-col h-full overflow-hidden p-6 space-y-6">
            <header className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Base Period</p>
                    <p className="text-lg font-black text-slate-700">{formatCurrency(totalBase)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Compare Period</p>
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-black text-slate-700">{formatCurrency(totalTarget)}</p>
                        <span className={`text-[10px] font-black px-1.5 rounded ${totalDiff > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {totalDiff > 0 ? '+' : ''}{((totalDiff / (Math.abs(totalBase) || 1)) * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {comparisonData?.map(item => {
                    const isIncrease = item.diff > 0;
                    const maxDiff = Math.max(...comparisonData.map(d => Math.abs(d.diff)), 1);
                    const barWidth = (Math.abs(item.diff) / maxDiff) * 100;
                    return (
                        <div 
                            key={item.id} 
                            onClick={() => setInspectingItem(item)}
                            className="space-y-1.5 p-2 hover:bg-indigo-50/50 rounded-xl transition-all group cursor-pointer"
                        >
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{item.label}</p>
                                    <p className="text-[9px] text-slate-400 font-medium">{formatCurrency(item.baseVal)} &rarr; {formatCurrency(item.targetVal)}</p>
                                </div>
                                <div className="text-right">
                                    <div className={`flex items-center justify-end gap-1 text-xs font-black ${isIncrease ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {isIncrease ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                                        {formatCurrency(Math.abs(item.diff))}
                                    </div>
                                    <p className="text-[9px] font-black text-slate-300 uppercase">{item.pct.toFixed(0)}% Var</p>
                                </div>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                {isIncrease ? (
                                    <div className="flex-1 flex justify-end"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${barWidth}%` }} /></div>
                                ) : (
                                    <div className="flex-1 flex justify-start"><div className="h-full bg-rose-500 rounded-full" style={{ width: `${barWidth}%` }} /></div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {comparisonData?.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-300 italic opacity-50">
                        <CheckCircleIcon className="w-10 h-10 mb-2" />
                        <p className="text-xs">No variance detected in visible data.</p>
                    </div>
                )}
            </div>

            {/* AUDIT DRILL-DOWN MODAL */}
            {inspectingItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInspectingItem(null)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-7xl h-full flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100"><TableIcon className="w-8 h-8" /></div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Audit Drill-down: {inspectingItem.label}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Comparing contributing transactions across logical windows</p>
                                </div>
                            </div>
                            <button onClick={() => setInspectingItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-8 h-8 text-slate-400" /></button>
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden divide-x divide-slate-100">
                            {/* BASE PERIOD SIDE */}
                            <div className="flex-1 flex flex-col min-h-0 bg-white">
                                <header className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-end">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Period A (Base)</h4>
                                        <p className="text-3xl font-black text-slate-800">{formatCurrency(inspectingItem.baseVal)}</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{inspectingItem.baseTransactions.length} Records</p>
                                </header>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <TransactionTable 
                                        transactions={inspectingItem.baseTransactions}
                                        accounts={accounts}
                                        categories={categories}
                                        tags={tags}
                                        transactionTypes={transactionTypes}
                                        counterparties={counterparties}
                                        users={users}
                                        onUpdateTransaction={() => {}}
                                        onDeleteTransaction={() => {}}
                                        visibleColumns={new Set(['date', 'description', 'account', 'amount'])}
                                    />
                                    {inspectingItem.baseTransactions.length === 0 && (
                                        <div className="p-20 text-center text-slate-300 italic flex flex-col items-center">
                                            <CloseIcon className="w-12 h-12 mb-2 opacity-10" />
                                            <p className="text-xs uppercase font-black">No transactions found</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TARGET PERIOD SIDE */}
                            <div className="flex-1 flex flex-col min-h-0 bg-white">
                                <header className="p-6 bg-indigo-50/30 border-b border-slate-100 flex justify-between items-end">
                                    <div>
                                        <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-1">Period B (Compare)</h4>
                                        <p className="text-3xl font-black text-slate-800">{formatCurrency(inspectingItem.targetVal)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-black flex items-center justify-end gap-1 ${inspectingItem.diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {inspectingItem.diff > 0 ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                                            {formatCurrency(Math.abs(inspectingItem.diff))} Var
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{inspectingItem.targetTransactions.length} Records</p>
                                    </div>
                                </header>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <TransactionTable 
                                        transactions={inspectingItem.targetTransactions}
                                        accounts={accounts}
                                        categories={categories}
                                        tags={tags}
                                        transactionTypes={transactionTypes}
                                        counterparties={counterparties}
                                        users={users}
                                        onUpdateTransaction={() => {}}
                                        onDeleteTransaction={() => {}}
                                        visibleColumns={new Set(['date', 'description', 'account', 'amount'])}
                                    />
                                    {inspectingItem.targetTransactions.length === 0 && (
                                        <div className="p-20 text-center text-slate-300 italic flex flex-col items-center">
                                            <CloseIcon className="w-12 h-12 mb-2 opacity-10" />
                                            <p className="text-xs uppercase font-black">No transactions found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
                            <div className="flex items-start gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm max-w-xl">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><InfoIcon className="w-5 h-5" /></div>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                    If you see transactions here that aren't in your main dashboard modules, check if the <strong>Lookback Period</strong> or <strong>Date Filter</strong> on the source modules is configured differently. Audit drill-downs use the specific filters of the modules they link to.
                                </p>
                            </div>
                            <button 
                                onClick={() => setInspectingItem(null)} 
                                className="px-12 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                            >
                                Dismiss Audit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
