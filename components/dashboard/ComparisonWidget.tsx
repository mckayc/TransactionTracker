import React, { useMemo } from 'react';
import type { Transaction, DashboardWidget, Category, Counterparty, Account, TransactionType, Tag } from '../../types';
import { parseISOLocal } from '../../dateUtils';
import { ArrowUpIcon, ArrowDownIcon, ExclamationTriangleIcon, RepeatIcon } from '../Icons';

interface Props {
    widget: DashboardWidget;
    allWidgets: DashboardWidget[];
    transactions: Transaction[];
    categories: Category[];
    counterparties: Counterparty[];
    accounts: Account[];
    transactionTypes: TransactionType[];
    tags: Tag[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

export const ComparisonWidget: React.FC<Props> = ({ widget, allWidgets, transactions, categories, counterparties, accounts, transactionTypes, tags }) => {
    const config = widget.config;
    const baseId = config?.comparisonBaseId;
    const targetId = config?.comparisonTargetId;

    const baseWidget = useMemo(() => allWidgets.find(w => w.id === baseId), [allWidgets, baseId]);
    const targetWidget = useMemo(() => allWidgets.find(w => w.id === targetId), [allWidgets, targetId]);

    const getFilteredTransactions = (w: DashboardWidget) => {
        if (w.type !== 'cashflow' || !w.config) return [];
        const { period = 'month', lookback = 0, displayDataType = 'type', excludeUnknown = true, excludeKeywords = '', showIncome = true, showExpenses = true, showInvestments = true, showDonations = true } = w.config;
        const typeRegistry = new Map(transactionTypes.map(t => [t.id, t]));
        const categoryRegistry = new Map(categories.map(c => [c.id, c.name]));
        const counterpartyRegistry = new Map(counterparties.map(p => [p.id, p.name]));
        const accountRegistry = new Map(accounts.map(a => [a.id, a.name]));

        const now = new Date();
        const s = new Date(now); s.setHours(0,0,0,0);
        const e = new Date(now); e.setHours(23,59,59,999);

        if (period === 'month') { 
            s.setDate(1); 
            s.setMonth(s.getMonth() - lookback); 
            e.setTime(s.getTime()); 
            e.setMonth(e.getMonth() + 1, 0); 
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

        const aggregate = (txs: Transaction[]) => {
            const map = new Map<string, { label: string, total: number }>();
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
                    if (!map.has(k.id)) map.set(k.id, { label: k.label, total: 0 });
                    map.get(k.id)!.total += tx.amount;
                });
            });
            return map;
        };

        const baseMap = aggregate(baseTxs);
        const targetMap = aggregate(targetTxs);
        const allKeys = new Set([...baseMap.keys(), ...targetMap.keys()]);

        return Array.from(allKeys).map(key => {
            const bVal = baseMap.get(key)?.total || 0;
            const tVal = targetMap.get(key)?.total || 0;
            const diff = tVal - bVal;
            return { 
                id: key, 
                label: targetMap.get(key)?.label || baseMap.get(key)?.label || 'Unknown', 
                baseVal: bVal, 
                targetVal: tVal, 
                diff, 
                pct: bVal !== 0 ? (diff / Math.abs(bVal)) * 100 : (tVal !== 0 ? 100 : 0) 
            };
        }).filter(d => Math.abs(d.diff) > 0.01).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
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
                        <div key={item.id} className="space-y-1.5 p-2 hover:bg-slate-50 rounded-xl transition-all group">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-700 truncate">{item.label}</p>
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
            </div>
        </div>
    );
};