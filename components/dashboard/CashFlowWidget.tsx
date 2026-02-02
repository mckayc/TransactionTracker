import React, { useState, useMemo } from 'react';
import type { Transaction, Category, Counterparty, DashboardWidget, Account, TransactionType, User, Tag } from '../../types';
import { ChevronRightIcon, ChevronDownIcon, EyeIcon, EyeSlashIcon, TrendingUpIcon, CloseIcon } from '../Icons';
import { parseISOLocal } from '../../dateUtils';
import TransactionTable from '../TransactionTable';

interface Props {
    widget: DashboardWidget;
    transactions: Transaction[];
    categories: Category[];
    counterparties: Counterparty[];
    accounts: Account[];
    transactionTypes: TransactionType[];
    users: User[];
    tags: Tag[];
    onUpdateConfig: (newConfig: DashboardWidget['config']) => void;
}

const COLORS = ['#4f46e5', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1'];

interface BreakdownNode {
    id: string;
    label: string;
    value: number; 
    directValue: number; 
    color: string;
    transactions: Transaction[];
    children: BreakdownNode[];
    parentId?: string;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

const DynamicArcChart: React.FC<{ 
    data: { label: string; value: number; color: string; transactions: Transaction[] }[]; 
    total: number;
    style?: 'standard' | 'magnified' | 'labeled' | 'callout';
    onSegmentClick: (node: any) => void;
}> = ({ data, total, style = 'standard', onSegmentClick }) => {
    const [hovered, setHovered] = useState<number | null>(null);
    const size = 200;
    const center = size / 2;
    const innerRadius = style === 'standard' ? 40 : 30;
    const baseOuterRadius = 65;

    let cumulativeAngle = 0;

    const paths = data.map((item, i) => {
        const percentage = total > 0 ? item.value / total : 0;
        if (percentage <= 0) return null;

        const isHovered = hovered === i;
        let radius = baseOuterRadius;
        if (style === 'magnified') radius = baseOuterRadius + (percentage * 25);
        if (isHovered) radius += 10;
        
        const angle = percentage * 360;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;
        cumulativeAngle += angle;

        const rad = (deg: number) => (deg - 90) * (Math.PI / 180);
        
        const x1 = center + radius * Math.cos(rad(startAngle));
        const y1 = center + radius * Math.sin(rad(startAngle));
        const x2 = center + radius * Math.cos(rad(endAngle));
        const y2 = center + radius * Math.sin(rad(endAngle));
        
        const ix1 = center + innerRadius * Math.cos(rad(startAngle));
        const iy1 = center + innerRadius * Math.sin(rad(startAngle));
        const ix2 = center + innerRadius * Math.cos(rad(endAngle));
        const iy2 = center + innerRadius * Math.sin(rad(endAngle));

        const largeArc = angle > 180 ? 1 : 0;

        const d = [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix2} ${iy2}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
            'Z'
        ].join(' ');

        return (
            <path
                key={i}
                d={d}
                fill={item.color}
                className="transition-all duration-300 cursor-pointer hover:opacity-100 opacity-90"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSegmentClick(item)}
            />
        );
    });

    return (
        <div className="relative w-full flex justify-center items-center h-48">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {paths}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                <span className="text-xl font-black text-slate-800">{formatCurrency(total)}</span>
            </div>
        </div>
    );
};

export const CashFlowWidget: React.FC<Props> = ({ widget, transactions, categories, counterparties, accounts, transactionTypes, users, tags, onUpdateConfig }) => {
    const [inspectingNode, setInspectingNode] = useState<BreakdownNode | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const { 
        period = 'month', 
        lookback = 0, 
        displayDataType = 'type', 
        excludeUnknown = true, 
        excludeKeywords = '', 
        showIncome = true, 
        showExpenses = true, 
        hiddenDataIds = [] 
    } = widget.config || {};
    
    const hiddenSet = new Set(hiddenDataIds);

    const activeRange = useMemo(() => {
        const now = new Date();
        let start = new Date(now); start.setHours(0,0,0,0);
        let end = new Date(now); end.setHours(23,59,59,999);

        if (period === 'month') {
            start.setDate(1);
            start.setMonth(start.getMonth() - lookback);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (period === 'year') {
            start.setFullYear(now.getFullYear() - lookback, 0, 1);
            end.setFullYear(now.getFullYear() - lookback, 11, 31);
        } else if (period === 'quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const targetQuarterIndex = currentQuarter - lookback;
            const targetDate = new Date(now.getFullYear(), targetQuarterIndex * 3, 1);
            start.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), 1);
            end = new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999);
        } else if (period === 'week') {
            const day = start.getDay();
            start.setDate(start.getDate() - day - (lookback * 7));
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'day') {
            start.setDate(start.getDate() - lookback);
            end = new Date(start);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    }, [period, lookback]);

    const chartData = useMemo(() => {
        const typeRegistry = new Map(transactionTypes.map(t => [t.id, t]));
        const filtered = transactions.filter(tx => {
            const txDate = parseISOLocal(tx.date);
            if (txDate < activeRange.start || txDate > activeRange.end || tx.isParent) return false;
            
            const type = typeRegistry.get(tx.typeId);
            const effect = type?.balanceEffect || 'outgoing';
            if (effect === 'neutral') return false;
            if (!showIncome && effect === 'incoming') return false;
            if (!showExpenses && effect === 'outgoing') return false;

            const keywords = excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (keywords.length > 0 && keywords.some(kw => `${tx.description} ${tx.originalDescription || ''}`.toLowerCase().includes(kw))) return false;

            return true;
        });

        const nodeMap = new Map<string, BreakdownNode>();

        const ensureNode = (id: string, label: string, pId?: string): BreakdownNode => {
            if (!nodeMap.has(id)) {
                nodeMap.set(id, { id, label, value: 0, directValue: 0, color: '', transactions: [], children: [], parentId: pId });
            }
            return nodeMap.get(id)!;
        };

        // Recursive function to pull in ancestors from master lists even if they have no direct transactions
        const ensureAncestry = (id: string) => {
            if (displayDataType === 'category') {
                const cat = categories.find(c => c.id === id);
                if (cat) {
                    const node = ensureNode(cat.id, cat.name, cat.parentId);
                    if (cat.parentId) ensureAncestry(cat.parentId);
                    return node;
                }
            } else if (displayDataType === 'counterparty') {
                const cp = counterparties.find(c => c.id === id);
                if (cp) {
                    const node = ensureNode(cp.id, cp.name, cp.parentId);
                    if (cp.parentId) ensureAncestry(cp.parentId);
                    return node;
                }
            }
            return null;
        };

        filtered.forEach(tx => {
            if (displayDataType === 'tag') {
                const txTags = tx.tagIds && tx.tagIds.length > 0 ? tx.tagIds : ['no-tag'];
                txTags.forEach(tagId => {
                    const tagObj = tags.find(t => t.id === tagId);
                    const label = tagObj?.name || (tagId === 'no-tag' ? 'No Label' : 'Unknown Label');
                    const node = ensureNode(tagId, label);
                    node.directValue += tx.amount;
                    node.transactions.push(tx);
                });
            } else {
                let id = '', label = '', pId: string | undefined = undefined;

                if (displayDataType === 'category') {
                    id = tx.categoryId;
                    const node = ensureAncestry(id);
                    if (node) {
                        node.directValue += tx.amount;
                        node.transactions.push(tx);
                    }
                } else if (displayDataType === 'counterparty') {
                    id = tx.counterpartyId || `desc_${tx.description}`;
                    if (tx.counterpartyId) {
                        const node = ensureAncestry(tx.counterpartyId);
                        if (node) {
                            node.directValue += tx.amount;
                            node.transactions.push(tx);
                        }
                    } else {
                        // Fallback for description-only nodes
                        const label = tx.description || 'Unknown Entity';
                        const node = ensureNode(id, label);
                        node.directValue += tx.amount;
                        node.transactions.push(tx);
                    }
                } else if (displayDataType === 'account') {
                    id = tx.accountId;
                    label = accounts.find(a => a.id === id)?.name || 'Unknown Account';
                    const node = ensureNode(id, label);
                    node.directValue += tx.amount;
                    node.transactions.push(tx);
                } else {
                    id = tx.typeId;
                    label = typeRegistry.get(id)?.name || 'Other';
                    const node = ensureNode(id, label);
                    node.directValue += tx.amount;
                    node.transactions.push(tx);
                }
            }
        });

        // Finalize hierarchy links
        if (displayDataType === 'category' || displayDataType === 'counterparty') {
            nodeMap.forEach(node => {
                if (node.parentId && nodeMap.has(node.parentId)) {
                    const parent = nodeMap.get(node.parentId)!;
                    if (!parent.children.find(c => c.id === node.id)) {
                        parent.children.push(node);
                    }
                }
            });
        }

        const finalRoots = Array.from(nodeMap.values()).filter(n => !n.parentId || !nodeMap.has(n.parentId));
        
        const aggregate = (n: BreakdownNode) => {
            let sum = n.directValue;
            n.children.forEach(c => {
                sum += aggregate(c);
                const seen = new Set(n.transactions.map(t => t.id));
                c.transactions.forEach(t => {
                    if (!seen.has(t.id)) n.transactions.push(t);
                });
            });
            n.value = sum;
            return sum;
        };

        // Filter out nodes that end up with 0 value (and no direct transactions)
        finalRoots.forEach(aggregate);
        
        const filteredRoots = finalRoots.filter(r => r.value > 0 || r.transactions.length > 0);
        filteredRoots.sort((a, b) => b.value - a.value);
        filteredRoots.forEach((r, i) => {
            r.color = COLORS[i % COLORS.length];
            const shade = (node: BreakdownNode, base: string) => {
                node.children.forEach((c) => {
                    c.color = base; 
                    shade(c, base);
                });
            };
            shade(r, r.color);
        });

        return filteredRoots;
    }, [transactions, activeRange, displayDataType, showIncome, showExpenses, excludeKeywords, excludeUnknown, categories, counterparties, accounts, transactionTypes, tags]);

    const totalValue = useMemo(() => chartData.filter(r => !hiddenSet.has(r.id)).reduce((s, r) => s + r.value, 0), [chartData, hiddenSet]);

    const handleToggleVisibility = (id: string) => {
        const next = new Set(hiddenSet);
        if (next.has(id)) next.delete(id); else next.add(id);
        onUpdateConfig({ ...widget.config, hiddenDataIds: Array.from(next) });
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedIds(next);
    };

    const renderNode = (node: BreakdownNode, depth = 0) => {
        const isHidden = hiddenSet.has(node.id);
        const isExpanded = expandedIds.has(node.id);
        const hasVisibleChildren = node.children.some(c => c.value > 0 || c.transactions.length > 0);

        return (
            <div key={node.id} className="select-none">
                <div 
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer hover:bg-slate-50 border-2 border-transparent ${isHidden ? 'opacity-40 grayscale' : ''}`}
                    style={{ marginLeft: `${depth * 16}px` }}
                    onClick={() => setInspectingNode(node)}
                >
                    <div className="w-5 flex justify-center shrink-0">
                        {hasVisibleChildren && (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }} className="p-0.5 rounded hover:bg-slate-200">
                                {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                            </button>
                        )}
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: node.color }} />
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-bold text-slate-700 truncate">{node.label}</span>
                            <span className="text-[11px] font-black text-slate-900 font-mono">{formatCurrency(node.value)}</span>
                        </div>
                        {!isHidden && totalValue > 0 && (
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-1000 ease-out" style={{ backgroundColor: node.color, width: `${(node.value / totalValue) * 100}%` }} />
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(node.id); }}
                        className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors"
                    >
                        {isHidden ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                </div>
                {isExpanded && node.children.filter(c => c.value > 0 || c.transactions.length > 0).map(c => renderNode(c, depth + 1))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                <DynamicArcChart 
                    data={chartData.filter(r => !hiddenSet.has(r.id))} 
                    total={totalValue} 
                    onSegmentClick={setInspectingNode}
                />
                
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Breakdown</p>
                    {chartData.map(r => renderNode(r))}
                    {chartData.length === 0 && (
                        <p className="text-xs text-slate-300 italic text-center py-4">No data matches these criteria.</p>
                    )}
                </div>
            </div>

            {inspectingNode && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInspectingNode(null)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100"><TrendingUpIcon className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">{inspectingNode.label} Analysis</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Transaction Drilldown</p>
                                </div>
                            </div>
                            <button onClick={() => setInspectingNode(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <TransactionTable 
                                transactions={inspectingNode.transactions}
                                accounts={accounts}
                                categories={categories}
                                tags={tags}
                                transactionTypes={transactionTypes}
                                counterparties={counterparties}
                                users={users}
                                onUpdateTransaction={() => {}}
                                onDeleteTransaction={() => {}}
                            />
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-end">
                            <button onClick={() => setInspectingNode(null)} className="px-8 py-2.5 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};