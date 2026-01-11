
import React, { useState, useMemo } from 'react';
import type { Transaction, Category, Counterparty, DashboardWidget, Account, Tag, TransactionType, User } from '../types';
import { ChevronRightIcon, ChevronDownIcon, EyeIcon, EyeSlashIcon, TrendingUpIcon, BoxIcon, TableIcon, CloseIcon, ChevronLeftIcon } from './Icons';
import { parseISOLocal } from '../dateUtils';
import TransactionTable from './TransactionTable';

interface CashFlowDashboardModuleProps {
    widget: DashboardWidget;
    transactions: Transaction[];
    categories: Category[];
    counterparties: Counterparty[];
    accounts: Account[];
    tags: Tag[];
    transactionTypes: TransactionType[];
    users: User[];
    onUpdateConfig: (newConfig: DashboardWidget['config']) => void;
}

const COLORS = ['#4f46e5', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1'];

interface BreakdownNode {
    id: string;
    label: string;
    value: number; // Aggregate value (self + children)
    directValue: number; // Direct transactions only
    color: string;
    transactions: Transaction[];
    children: BreakdownNode[];
    parentId?: string;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

/**
 * Universal Pie/Donut Chart supporting multiple logic styles
 */
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
        
        // STYLE LOGIC: Radius varies based on configuration
        let radius = baseOuterRadius;
        if (style === 'magnified') {
            radius = baseOuterRadius + (percentage * 25);
        }
        if (isHovered) radius += 10;
        
        const angle = percentage * 360;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;
        cumulativeAngle += angle;

        // Convert to Radians (shifted by -90 to start at 12 o'clock)
        const rad = (deg: number) => (deg - 90) * (Math.PI / 180);
        
        // Arc points
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
            `M ${ix1} ${iy1}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix2} ${iy2}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
            'Z'
        ].join(' ');

        // Label Centroid (Center of slice)
        const midAngle = startAngle + (angle / 2);
        const labelRadius = style === 'callout' ? radius + 20 : (radius + innerRadius) / 2;
        const lx = center + labelRadius * Math.cos(rad(midAngle));
        const ly = center + labelRadius * Math.sin(rad(midAngle));

        const px = center + (radius) * Math.cos(rad(midAngle));
        const py = center + (radius) * Math.sin(rad(midAngle));

        return (
            <g key={item.label + i} className="group/slice">
                <path
                    d={d}
                    fill={item.color}
                    className="transition-all duration-300 ease-out cursor-pointer hover:opacity-100 opacity-90"
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSegmentClick(item)}
                    stroke="white"
                    strokeWidth="2"
                />
                
                {style === 'labeled' && percentage > 0.05 && (
                    <text
                        x={lx}
                        y={ly}
                        fill="white"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        className="pointer-events-none text-[8px] font-black drop-shadow-sm select-none"
                    >
                        {Math.round(percentage * 100)}%
                    </text>
                )}

                {style === 'callout' && percentage > 0.03 && (
                    <g className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-40'}`}>
                        <line 
                            x1={px} y1={py} x2={lx} y2={ly} 
                            stroke={item.color} strokeWidth="1" strokeDasharray="2,2" 
                        />
                        <circle cx={lx} cy={ly} r="3" fill={item.color} />
                    </g>
                )}
            </g>
        );
    });

    return (
        <div className="flex flex-col items-center">
            {/* Legend / Info Header (Above Chart) */}
            <div className="h-20 flex flex-col items-center justify-center text-center px-4 mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate w-full">
                    {hovered !== null ? data[hovered].label : 'Net Volume'}
                </p>
                <p className="text-3xl font-black text-slate-800 leading-none">
                    {formatCurrency(hovered !== null ? data[hovered].value : total)}
                </p>
                {hovered !== null && total > 0 && (
                    <p className="text-[11px] font-bold text-indigo-600 mt-1">
                        {((data[hovered].value / total) * 100).toFixed(1)}% weight
                    </p>
                )}
            </div>

            <div className="relative w-56 h-56 flex items-center justify-center">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                    {paths}
                </svg>
            </div>
        </div>
    );
};

const BreakdownRow: React.FC<{
    node: BreakdownNode;
    total: number;
    maxVal: number;
    hiddenIds: Set<string>;
    expandedIds: Set<string>;
    onToggleVisibility: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onInspect: (node: BreakdownNode) => void;
    depth?: number;
}> = ({ node, total, maxVal, hiddenIds, expandedIds, onToggleVisibility, onToggleExpand, onInspect, depth = 0 }) => {
    const isHidden = hiddenIds.has(node.id);
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const percentage = total > 0 ? (node.value / total) * 100 : 0;

    return (
        <div className="select-none">
            <div 
                className={`group flex items-center gap-2 p-1.5 rounded-xl transition-all cursor-pointer ${isHidden ? 'opacity-30 grayscale bg-slate-50' : 'hover:bg-slate-50'}`}
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
                onClick={() => onInspect(node)}
            >
                <div className="w-4 flex justify-center flex-shrink-0">
                    {hasChildren && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
                            className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-white"
                        >
                            <ChevronRightIcon className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                    )}
                </div>

                <div className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: node.color }} />
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[11px] font-bold truncate pr-2 ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                            {node.label}
                        </span>
                        <span className={`text-[11px] font-black font-mono ${isHidden ? 'text-slate-200' : 'text-slate-900'}`}>
                            {isHidden ? '••••••' : formatCurrency(node.value)}
                        </span>
                    </div>
                    {!isHidden && percentage > 0.5 && (
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div className="h-full transition-all duration-1000" style={{ width: `${(node.value / maxVal) * 100}%`, backgroundColor: node.color }} />
                        </div>
                    )}
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(node.id); }}
                    className={`p-1 rounded-md transition-all ${isHidden ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-white shadow-sm'}`}
                >
                    {isHidden ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                </button>
            </div>

            {isExpanded && hasChildren && (
                <div className="mt-0.5">
                    {node.children.sort((a,b) => b.value - a.value).map(child => (
                        <BreakdownRow 
                            key={child.id} 
                            node={child} 
                            total={total} 
                            maxVal={maxVal}
                            onToggleVisibility={onToggleVisibility} 
                            onInspect={onInspect} 
                            hiddenIds={hiddenIds} 
                            expandedIds={expandedIds} 
                            onToggleExpand={onToggleExpand} 
                            depth={depth + 1} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const CashFlowDashboardModule: React.FC<CashFlowDashboardModuleProps> = ({ 
    widget, transactions, categories, counterparties, accounts, tags, transactionTypes, users, onUpdateConfig 
}) => {
    const config = widget.config;
    const period = config?.period || 'month';
    const lookbackUnits = config?.lookback || 0;
    const vizType = config?.vizType || 'cards';
    const pieStyle = config?.pieStyle || 'standard';
    const dataType = config?.displayDataType || 'type';
    const excludeUnknown = config?.excludeUnknown !== false;
    const hiddenIds = useMemo(() => new Set(config?.hiddenDataIds || []), [config?.hiddenDataIds]);

    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [inspectingNode, setInspectingNode] = useState<BreakdownNode | null>(null);

    // Date Logic
    const { start, end, displayLabel } = useMemo(() => {
        const s = new Date();
        s.setHours(0,0,0,0);
        const e = new Date();
        e.setHours(23,59,59,999);

        if (period === 'month') {
            s.setDate(1); 
            s.setMonth(s.getMonth() - lookbackUnits);
            e.setTime(s.getTime());
            e.setMonth(e.getMonth() + 1, 0); 
        } else if (period === 'year') {
            s.setFullYear(s.getFullYear() - lookbackUnits, 0, 1);
            e.setFullYear(s.getFullYear() - lookbackUnits, 11, 31);
        } else if (period === 'week') {
            const day = s.getDay();
            s.setDate(s.getDate() - day - (lookbackUnits * 7));
            e.setTime(s.getTime());
            e.setDate(s.getDate() + 6);
        }
        
        let label = '';
        if (period === 'month') label = s.toLocaleString('default', { month: 'long', year: 'numeric' });
        else if (period === 'year') label = `${s.getFullYear()}`;
        else label = `${s.toLocaleDateString()} - ${e.toLocaleDateString()}`;

        return { start: s, end: e, displayLabel: label };
    }, [period, lookbackUnits]);

    const handleShiftPeriod = (direction: 'prev' | 'next') => {
        const nextLookback = direction === 'prev' ? lookbackUnits + 1 : Math.max(0, lookbackUnits - 1);
        onUpdateConfig({ ...config, lookback: nextLookback });
    };

    // Calculation Engine
    const tree = useMemo(() => {
        const nodeMap = new Map<string, BreakdownNode>();
        const typeRegistry = new Map(transactionTypes.map(t => [t.id, t]));
        
        // Parse exclusion keywords
        const keywords = (config?.excludeKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

        const getOrCreateNode = (id: string, label: string, parentId?: string): BreakdownNode => {
            if (!nodeMap.has(id)) {
                nodeMap.set(id, { id, label, value: 0, directValue: 0, color: '', transactions: [], children: [], parentId });
                if (parentId) {
                    if (dataType === 'category') {
                        const p = categories.find(c => c.id === parentId);
                        if (p) getOrCreateNode(p.id, p.name, p.parentId);
                    } else if (dataType === 'counterparty') {
                        const p = counterparties.find(c => c.id === parentId);
                        if (p) getOrCreateNode(p.id, p.name, p.parentId);
                    }
                }
            }
            return nodeMap.get(id)!;
        };

        transactions.forEach(tx => {
            const txDate = parseISOLocal(tx.date);
            if (txDate >= start && txDate <= end && !tx.isParent) {
                const txType = typeRegistry.get(tx.typeId);
                const effect = txType?.balanceEffect || 'outgoing';

                // Respect strict balance effects
                if (effect === 'incoming' && config?.showIncome === false) return;
                if (effect === 'outgoing' && config?.showExpenses === false) return;
                if (tx.typeId === 'type_investment' && config?.showInvestments === false) return;
                if (tx.typeId === 'type_donation' && config?.showDonations === false) return;

                let key = '', label = '', parentId: string | undefined = undefined;

                if (dataType === 'category') {
                    const cat = categories.find(c => c.id === tx.categoryId);
                    key = tx.categoryId;
                    label = cat?.name || 'Unallocated';
                    parentId = cat?.parentId;
                } else if (dataType === 'counterparty') {
                    const cp = counterparties.find(c => c.id === tx.counterpartyId);
                    // IMPROVED: Fallback to description so unlinked transactions still show in this dimension
                    key = tx.counterpartyId || `desc_${tx.description}`;
                    label = cp?.name || tx.description || 'Unknown Entity';
                    parentId = cp?.parentId;
                } else if (dataType === 'account') {
                    key = tx.accountId;
                    label = accounts.find(a => a.id === key)?.name || 'Unknown Account';
                } else {
                    key = tx.typeId;
                    label = txType?.name || 'Other';
                }

                // Keyword Exclusion Logic
                if (keywords.length > 0) {
                    const searchTarget = `${tx.description} ${tx.originalDescription || ''} ${label}`.toLowerCase();
                    if (keywords.some(kw => searchTarget.includes(kw))) return;
                }

                if (excludeUnknown) {
                    const isUnknown = key === 'unknown' || key === 'no-counterparty' || label === 'Unallocated' || label === 'Unknown Entity' || label === 'Unknown Account' || tx.categoryId === 'cat_other';
                    if (isUnknown) return;
                }

                const node = getOrCreateNode(key, label, parentId);
                node.directValue += tx.amount;
                node.transactions.push(tx);
            }
        });

        const allNodes = Array.from(nodeMap.values());
        allNodes.forEach(node => {
            if (node.parentId && nodeMap.has(node.parentId)) {
                const p = nodeMap.get(node.parentId)!;
                if (!p.children.find(c => c.id === node.id)) p.children.push(node);
            }
        });

        const roots = allNodes.filter(n => !n.parentId || !nodeMap.has(n.parentId));

        const calculateAggregate = (node: BreakdownNode): number => {
            let sum = node.directValue;
            node.children.forEach(c => { 
                sum += calculateAggregate(c); 
                node.transactions = [...node.transactions, ...c.transactions];
            });
            node.value = sum;
            return sum;
        };

        const sortAndColorRecursive = (node: BreakdownNode, baseColor: string) => {
            node.color = baseColor;
            node.children.sort((a, b) => b.value - a.value);
            node.children.forEach(c => sortAndColorRecursive(c, baseColor));
        };

        roots.forEach(calculateAggregate);
        
        // Final sanity check: remove roots that ended up empty due to filtering
        const activeRoots = roots.filter(r => Math.abs(r.value) > 0);
        activeRoots.sort((a, b) => b.value - a.value);
        activeRoots.forEach((root, i) => sortAndColorRecursive(root, COLORS[i % COLORS.length]));

        return activeRoots;
    }, [transactions, start, end, dataType, categories, counterparties, accounts, transactionTypes, config, excludeUnknown]);

    const visibleTree = useMemo(() => tree.filter(n => !hiddenIds.has(n.id)), [tree, hiddenIds]);
    const totalVisible = useMemo(() => visibleTree.reduce((s, n) => s + n.value, 0), [visibleTree]);
    const maxVal = useMemo(() => Math.max(...tree.map(n => n.value), 1), [tree]);

    const toggleVisibility = (id: string) => {
        const next = new Set(hiddenIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        onUpdateConfig({ ...config, hiddenDataIds: Array.from(next) });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 bg-white border-b border-slate-50">
                <button onClick={() => handleShiftPeriod('prev')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <div className="px-5 py-2 bg-slate-900 rounded-full shadow-lg">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter text-center">{displayLabel}</p>
                </div>
                <button 
                    onClick={() => handleShiftPeriod('next')} 
                    disabled={lookbackUnits === 0}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors disabled:opacity-0"
                >
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 p-6 flex flex-col min-h-0">
                <div className="flex-shrink-0 mb-6">
                    {vizType === 'cards' ? (
                        <div className="p-6 bg-slate-900 rounded-[2rem] text-white relative overflow-hidden shadow-xl">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">In-Period Context</p>
                                <p className="text-3xl font-black">{formatCurrency(totalVisible)}</p>
                            </div>
                            <TrendingUpIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-5" />
                        </div>
                    ) : (
                        <DynamicArcChart 
                            data={visibleTree.map(n => ({ label: n.label, value: n.value, color: n.color, transactions: n.transactions }))} 
                            total={totalVisible} 
                            style={pieStyle}
                            onSegmentClick={(segment) => setInspectingNode(segment as any)}
                        />
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Hierarchy Registry</p>
                    {tree.length === 0 ? (
                        <div className="py-12 text-center text-slate-300 italic text-sm">No ledger data in this epoch.</div>
                    ) : (
                        tree.map(node => (
                            <BreakdownRow 
                                key={node.id} 
                                node={node} 
                                total={totalVisible} 
                                maxVal={maxVal}
                                hiddenIds={hiddenIds} 
                                expandedIds={expandedIds}
                                onToggleVisibility={toggleVisibility}
                                onToggleExpand={(id) => setExpandedIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })}
                                onInspect={setInspectingNode}
                            />
                        ))
                    )}
                </div>
            </div>

            {inspectingNode && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-white shadow-sm" style={{ color: inspectingNode.color }}>
                                    <TableIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800">{inspectingNode.label}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{inspectingNode.transactions.length} entries totaling {formatCurrency(inspectingNode.value)}</p>
                                </div>
                            </div>
                            <button onClick={() => setInspectingNode(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            <TransactionTable 
                                transactions={inspectingNode.transactions}
                                accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users}
                                onUpdateTransaction={() => {}} onDeleteTransaction={() => {}}
                                visibleColumns={new Set(['date', 'description', 'account', 'amount'])}
                            />
                        </div>
                        <div className="p-6 border-t bg-white flex justify-end">
                            <button onClick={() => setInspectingNode(null)} className="px-8 py-3 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 uppercase text-[10px] tracking-widest">Close Inspector</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
