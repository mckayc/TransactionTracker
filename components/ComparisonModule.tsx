
import React, { useMemo } from 'react';
import type { Transaction, DashboardWidget, Category, Counterparty, Account, TransactionType, User, Tag } from '../types';
import { parseISOLocal } from '../dateUtils';
import { ArrowUpIcon, ArrowDownIcon, ExclamationTriangleIcon, RepeatIcon } from './Icons';

interface ComparisonModuleProps {
    widget: DashboardWidget;
    allWidgets: DashboardWidget[];
    transactions: Transaction[];
    categories: Category[];
    counterparties: Counterparty[];
    accounts: Account[];
    transactionTypes: TransactionType[];
    users: User[];
    tags: Tag[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

export const ComparisonModule: React.FC<ComparisonModuleProps> = ({ widget, allWidgets, transactions, categories, counterparties, accounts, transactionTypes, users, tags }) => {
    const config = widget.config;
    const baseId = config?.comparisonBaseId;
    const targetId = config?.comparisonTargetId;

    const baseWidget = useMemo(() => allWidgets.find(w => w.id === baseId), [allWidgets, baseId]);
    const targetWidget = useMemo(() => allWidgets.find(w => w.id === targetId), [allWidgets, targetId]);

    const getFilteredTransactions = (w: DashboardWidget) => {
        if (w.type !== 'cashflow' || !w.config) return [];
        const { period = 'month', lookback = 0, displayDataType = 'type', excludeUnknown = true, excludeKeywords = '' } = w.config;
        const typeRegistry = new Map(transactionTypes.map(t => [t.id, t]));

        // Calculate Dates
        const s = new Date(); s.setHours(0,0,0,0);
        const e = new Date(); e.setHours(23,59,59,999);

        if (period === 'month') {
            s.setDate(1); s.setMonth(s.getMonth() - lookback);
            e.setTime(s.getTime()); e.setMonth(e.getMonth() + 1, 0); 
        } else if (period === 'year') {
            s.setFullYear(s.getFullYear() - lookback, 0, 1);
            e.setFullYear(s.getFullYear() - lookback, 11, 31);
        } else if (period === 'week') {
            const day = s.getDay();
            s.setDate(s.getDate() - day - (lookback * 7));
            e.setTime(s.getTime()); e.setDate(s.getDate() + 6);
        }

        const keywords = excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

        return transactions.filter(tx => {
            const txDate = parseISOLocal(tx.date);
            if (txDate < s || txDate > e || tx.isParent) return false;

            const txType = typeRegistry.get(tx.typeId);
            const effect = txType?.balanceEffect || 'outgoing';

            if (effect === 'neutral') return false;
            if (effect === 'incoming' && w.config?.showIncome === false) return false;
            if (effect === 'outgoing' && w.config?.showExpenses === false) return false;

            let label = '';
            if (displayDataType === 'category') label = categories.find(c => c.id === tx.categoryId)?.name || 'Unallocated';
            else if (displayDataType === 'counterparty') label = counterparties.find(cp => cp.id === tx.counterpartyId)?.name || tx.description || 'Unknown Entity';
            else if (displayDataType === 'account') label = accounts.find(a => a.id === tx.accountId)?.name || 'Unknown Account';
            else label = txType?.name || 'Other';

            if (keywords.length > 0) {
                const searchTarget = `${tx.description} ${tx.originalDescription || ''} ${label}`.toLowerCase();
                if (keywords.some(kw => searchTarget.includes(kw))) return false;
            }

            if (excludeUnknown) {
                const isUnknown = label === 'Unallocated' || label === 'Unknown Entity' || label === 'Unknown Account' || tx.categoryId === 'cat_other';
                if (isUnknown) return false;
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
                let key = '', label = '';
                if (dimension === 'category') { key = tx.categoryId; label = categories.find(c => c.id === key)?.name || 'Other'; }
                else if (dimension === 'counterparty') { key = tx.counterpartyId || `desc_${tx.description}`; label = counterparties.find(cp => cp.id === tx.counterpartyId)?.name || tx.description || 'Other'; }
                else if (dimension === 'account') { key = tx.accountId; label = accounts.find(a => a.id === key)?.name || 'Other'; }
                else { key = tx.typeId; label = transactionTypes.find(t => t.id === key)?.name || 'Other'; }

                if (!map.has(key)) map.set(key, { label, total: 0 });
                map.get(key)!.total += tx.amount;
            });
            return map;
        };

        const baseMap = aggregate(baseTxs);
        const targetMap = aggregate(targetTxs);

        const allKeys = new Set([...baseMap.keys(), ...targetMap.keys()]);
        const deltas = Array.from(allKeys).map(key => {
            const base = baseMap.get(key);
            const target = targetMap.get(key);
            const baseVal = base?.total || 0;
            const targetVal = target?.total || 0;
            const diff = targetVal - baseVal;
            const pct = baseVal !== 0 ? (diff / Math.abs(baseVal)) * 100 : (targetVal !== 0 ? 100 : 0);

            return {
                id: key,
                label: target?.label || base?.label || 'Unknown',
                baseVal,
                targetVal,
                diff,
                pct
            };
        });

        // Filter out zero-diff noise and sort by absolute impact
        return deltas.filter(d => Math.abs(d.diff) > 0.01).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    }, [baseWidget, targetWidget, transactions, categories, counterparties, accounts, transactionTypes]);

    if (!baseId || !targetId) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/50">
                <RepeatIcon className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuration Required</p>
                <p className="text-[10px] text-slate-400 mt-2">Select two Cash Flow modules in settings to generate deltas.</p>
            </div>
        );
    }

    if (!baseWidget || !targetWidget) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-red-50/30">
                <ExclamationTriangleIcon className="w-10 h-10 text-red-200 mb-3" />
                <p className="text-xs font-black text-red-400 uppercase tracking-widest">Logic Severed</p>
                <p className="text-[10px] text-red-400 mt-2">One of the linked base modules was removed from the system library.</p>
            </div>
        );
    }

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
                        <span className={`text-[10px] font-black px-1.5 rounded ${totalDiff > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {totalDiff > 0 ? '+' : ''}{((totalDiff / (Math.abs(totalBase) || 1)) * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Variance Breakdown</p>
                {comparisonData?.map(item => {
                    const isIncrease = item.diff > 0;
                    const maxDiff = Math.max(...comparisonData.map(d => Math.abs(d.diff)));
                    const barWidth = (Math.abs(item.diff) / maxDiff) * 100;

                    return (
                        <div key={item.id} className="space-y-1.5 p-2 hover:bg-slate-50 rounded-xl transition-all group">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-700 truncate">{item.label}</p>
                                    <p className="text-[9px] text-slate-400 font-medium">
                                        {formatCurrency(item.baseVal)} <span className="mx-1">&rarr;</span> {formatCurrency(item.targetVal)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className={`flex items-center justify-end gap-1 text-xs font-black ${isIncrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {isIncrease ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                                        {formatCurrency(Math.abs(item.diff))}
                                    </div>
                                    <p className="text-[9px] font-black text-slate-300 uppercase">{item.pct.toFixed(0)}% Variance</p>
                                </div>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                {isIncrease ? (
                                    <div className="flex-1 flex justify-end"><div className="h-full bg-rose-500 rounded-full" style={{ width: `${barWidth}%` }} /></div>
                                ) : (
                                    <div className="flex-1 flex justify-start"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${barWidth}%` }} /></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
