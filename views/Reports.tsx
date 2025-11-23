
import React, { useState, useMemo, useCallback } from 'react';
import type { Transaction, TransactionType, Category, Payee, BalanceEffect, User, Tag } from '../types';
import TransactionTable from '../components/TransactionTable';
import { formatDate } from '../dateUtils';
import { SortIcon, TagIcon, ChevronDownIcon, CloseIcon } from '../components/Icons';

interface ReportsProps {
  transactions: Transaction[];
  transactionTypes: TransactionType[];
  categories: Category[];
  payees: Payee[];
  users: User[];
  tags: Tag[];
}

// --- Helper Functions ---

const generateColor = (str: string, index: number): string => {
    const defaultColors = ['#4f46e5', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1'];
    if (index < defaultColors.length) {
        return defaultColors[index];
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

// --- Components ---

const KPICard: React.FC<{ title: string; value: number; prevValue: number; isInverse?: boolean }> = ({ title, value, prevValue, isInverse }) => {
    const diff = value - prevValue;
    const percent = prevValue !== 0 ? (diff / prevValue) * 100 : 0;
    
    // For Income: Positive diff is good (Green), Negative is bad (Red)
    // For Expense (Inverse): Positive diff is bad (Red), Negative is good (Green)
    const isGood = isInverse ? diff <= 0 : diff >= 0;
    const colorClass = isGood ? 'text-emerald-600' : 'text-red-600';
    const bgClass = isGood ? 'bg-emerald-50' : 'bg-red-50';
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '-';

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-medium text-slate-500">{title}</h3>
            <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(value)}</p>
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${bgClass} ${colorClass}`}>
                <span>{arrow} {Math.abs(percent).toFixed(1)}%</span>
                <span className="text-slate-400 font-normal ml-1">vs prior period</span>
            </div>
        </div>
    );
};

// Improved Cash Flow Chart (Bar Chart for comparison)
const CashFlowChart: React.FC<{ data: { label: string, income: number, expense: number }[] }> = ({ data }) => {
    const width = 600;
    const height = 300;
    const padding = 40;
    const barWidth = 12;
    const maxY = Math.max(...data.flatMap(d => [d.income, d.expense]), 100);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-h-[300px]">
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
                const y = height - padding - (tick * (height - 2 * padding));
                return (
                    <g key={i}>
                        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                        <text x={padding - 8} y={y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-slate-400">
                            {formatCurrency(tick * maxY)}
                        </text>
                    </g>
                );
            })}

            {/* Bars */}
            {data.map((d, i) => {
                const x = padding + i * ((width - 2 * padding) / Math.max(data.length, 1));
                const barSpace = (width - 2 * padding) / Math.max(data.length, 1);
                const incomeH = (d.income / maxY) * (height - 2 * padding);
                const expenseH = (d.expense / maxY) * (height - 2 * padding);
                
                return (
                    <g key={i} className="group">
                        {/* Income Bar */}
                        <rect 
                            x={x + barSpace/2 - barWidth} 
                            y={height - padding - incomeH} 
                            width={barWidth} 
                            height={incomeH} 
                            fill="#10b981" 
                            rx="2"
                            className="hover:opacity-80 transition-opacity"
                        >
                            <title>{d.label} Income: {formatCurrency(d.income)}</title>
                        </rect>
                        {/* Expense Bar */}
                        <rect 
                            x={x + barSpace/2 + 2} 
                            y={height - padding - expenseH} 
                            width={barWidth} 
                            height={expenseH} 
                            fill="#ef4444" 
                            rx="2"
                            className="hover:opacity-80 transition-opacity"
                        >
                            <title>{d.label} Expense: {formatCurrency(d.expense)}</title>
                        </rect>
                        
                        {/* X-Axis Label */}
                        <text 
                            x={x + barSpace/2} 
                            y={height - padding + 15} 
                            textAnchor="middle" 
                            className="text-[10px] fill-slate-500"
                        >
                            {d.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

const CategoryTrendChart: React.FC<{ data: { label: string, value: number }[], color: string, title: string }> = ({ data, color, title }) => {
    const width = 300;
    const height = 100;
    const padding = 10;
    const maxY = Math.max(...data.map(d => d.value), 10);
    
    const points = data.map((d, i) => {
        const x = i * (width / (data.length - 1 || 1));
        const y = height - (d.value / maxY) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{title} Trend</h4>
            <svg viewBox={`0 -10 ${width} ${height + 20}`} className="w-full h-20 overflow-visible">
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
                {data.map((d, i) => (
                    <circle 
                        key={i} 
                        cx={i * (width / (data.length - 1 || 1))} 
                        cy={height - (d.value / maxY) * height} 
                        r="3" 
                        fill={color} 
                        className="hover:r-5 transition-all cursor-pointer"
                    >
                        <title>{d.label}: {formatCurrency(d.value)}</title>
                    </circle>
                ))}
            </svg>
        </div>
    )
}

const DonutChart: React.FC<{ 
    data: { id: string, name: string, value: number, color: string }[], 
    onItemClick: (id: string, name: string) => void 
}> = ({ data, onItemClick }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    const radius = 80;
    const circumference = 2 * Math.PI * radius;

    if (total === 0) return <div className="w-48 h-48 rounded-full bg-slate-200 flex items-center justify-center"><p className="text-slate-500 text-sm">No expense data</p></div>;

    let offset = 0;
    return (
        <svg viewBox="0 0 200 200" className="w-48 h-48 transform -rotate-90">
            {data.map(item => {
                const percentage = (item.value / total) * 100;
                const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -offset;
                offset += (percentage / 100) * circumference;
                
                if (percentage < 1) return null;

                return (
                    <circle 
                        key={item.id} 
                        cx="100" 
                        cy="100" 
                        r={radius} 
                        fill="transparent" 
                        stroke={item.color} 
                        strokeWidth="30" 
                        strokeDasharray={strokeDasharray} 
                        strokeDashoffset={strokeDashoffset} 
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => onItemClick(item.id, item.name)}
                    >
                        <title>{item.name}: {formatCurrency(item.value)}</title>
                    </circle>
                );
            })}
        </svg>
    );
};

const TopSpendingBarChart: React.FC<{ 
    data: { id: string; name: string; value: number; color: string }[],
    onItemClick: (id: string, name: string) => void
}> = ({ data, onItemClick }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-3">
            {data.map(item => (
                <div key={item.id} className="grid grid-cols-4 items-center gap-2 text-sm cursor-pointer group" onClick={() => onItemClick(item.id, item.name)}>
                    <span className="col-span-1 truncate group-hover:text-indigo-600 transition-colors" title={item.name}>{item.name}</span>
                    <div className="col-span-3 flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                            <div className="h-4 rounded-full group-hover:opacity-80 transition-opacity" style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }} />
                        </div>
                        <span className="font-medium text-slate-700 w-24 text-right">{formatCurrency(item.value)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};


const Reports: React.FC<ReportsProps> = ({ transactions, transactionTypes, categories, payees, users, tags }) => {
    // State
    const [dateRange, setDateRange] = useState(() => {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { key: 'thisMonth', start, end, label: 'This Month' };
    });

    const [activeFilter, setActiveFilter] = useState<{ type: 'category' | 'payee' | 'tag' | 'user' | null, id: string | null, name: string | null }>({ type: null, id: null, name: null });

    const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
    const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p])), [payees]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
    const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

    // Date Range Handlers
    const handleSetDateRange = (preset: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'all') => {
        const now = new Date();
        let start = new Date();
        let end = new Date();
        let label = '';

        if (preset === 'all') {
            start = new Date(2000, 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
            label = 'All Time';
        } else if (preset === 'thisMonth') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            label = 'This Month';
        } else if (preset === 'lastMonth') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            label = 'Last Month';
        } else if (preset === 'thisYear') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
            label = 'This Year';
        } else if (preset === 'lastYear') {
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31);
            label = 'Last Year';
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        setDateRange({ key: preset, start, end, label });
    };

    // Calculate Previous Period Range
    const prevDateRange = useMemo(() => {
        const duration = dateRange.end.getTime() - dateRange.start.getTime();
        const prevEnd = new Date(dateRange.start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - duration);
        return { start: prevStart, end: prevEnd };
    }, [dateRange]);

    // Filter Data by Date
    const filterByDate = (data: Transaction[], start: Date, end: Date) => {
        return data.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= start && txDate <= end;
        });
    };

    const currentData = useMemo(() => filterByDate(transactions, dateRange.start, dateRange.end), [transactions, dateRange]);
    const prevData = useMemo(() => filterByDate(transactions, prevDateRange.start, prevDateRange.end), [transactions, prevDateRange]);

    // Stats Calculation
    const calculateStats = (data: Transaction[]) => {
        let income = 0;
        let expenses = 0;
        const expenseCatMap = new Map<string, number>();
        const userSpendMap = new Map<string, number>();
        const tagSpendMap = new Map<string, number>();

        data.forEach(tx => {
            const type = transactionTypeMap.get(tx.typeId);
            if (type?.balanceEffect === 'income') {
                income += tx.amount;
            } else if (type?.balanceEffect === 'expense') {
                expenses += tx.amount;
                
                // Category Breakdown
                const category = categoryMap.get(tx.categoryId);
                if (category) {
                    const parentCategory = category.parentId ? categoryMap.get(category.parentId) : category;
                    const id = parentCategory?.id || category.id;
                    expenseCatMap.set(id, (expenseCatMap.get(id) || 0) + tx.amount);
                }

                // User Breakdown
                const userId = tx.userId || 'unknown';
                userSpendMap.set(userId, (userSpendMap.get(userId) || 0) + tx.amount);

                // Tag Breakdown
                if (tx.tagIds) {
                    tx.tagIds.forEach(tagId => {
                        tagSpendMap.set(tagId, (tagSpendMap.get(tagId) || 0) + tx.amount);
                    });
                }
            }
        });
        return { income, expenses, expenseCatMap, userSpendMap, tagSpendMap };
    };

    const currentStats = useMemo(() => calculateStats(currentData), [currentData]);
    const prevStats = useMemo(() => calculateStats(prevData), [prevData]);

    // Interactive Filter Logic
    const filteredTableTransactions = useMemo(() => {
        if (!activeFilter.type || !activeFilter.id) return currentData;
        
        return currentData.filter(tx => {
            if (activeFilter.type === 'category') {
                const cat = categoryMap.get(tx.categoryId);
                // Match category or parent category
                return tx.categoryId === activeFilter.id || cat?.parentId === activeFilter.id;
            }
            if (activeFilter.type === 'payee') return tx.payeeId === activeFilter.id;
            if (activeFilter.type === 'user') return tx.userId === activeFilter.id;
            if (activeFilter.type === 'tag') return tx.tagIds?.includes(activeFilter.id!);
            return true;
        });
    }, [currentData, activeFilter, categoryMap]);

    // Trend Data Preparation
    const cashFlowData = useMemo(() => {
        const trendMap = new Map<string, { income: number; expense: number }>();
        const timeDiff = dateRange.end.getTime() - dateRange.start.getTime();
        const dayDiff = timeDiff / (1000 * 3600 * 24);
        
        // Dynamic grouping based on range
        const getLabel = (date: Date) => {
            if (dayDiff <= 60) return formatDate(date).slice(5); // MM-DD for short ranges
            return formatDate(date).slice(0, 7); // YYYY-MM for long ranges
        };

        currentData.forEach(tx => {
            const type = transactionTypeMap.get(tx.typeId);
            const label = getLabel(new Date(tx.date));
            if (!trendMap.has(label)) trendMap.set(label, { income: 0, expense: 0 });
            const trendEntry = trendMap.get(label)!;

            if (type?.balanceEffect === 'income') trendEntry.income += tx.amount;
            else if (type?.balanceEffect === 'expense') trendEntry.expense += tx.amount;
        });
        
        return Array.from(trendMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, values]) => ({ label, ...values }));
    }, [currentData, dateRange]);

    // Selected Category Trend Data
    const selectedTrendData = useMemo(() => {
        if (!activeFilter.type || !activeFilter.id) return [];
        
        const data = filteredTableTransactions;
        const trendMap = new Map<string, number>();
        
        data.forEach(tx => {
            const label = formatDate(new Date(tx.date)).slice(0, 7); // YYYY-MM
            trendMap.set(label, (trendMap.get(label) || 0) + tx.amount);
        });

        return Array.from(trendMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, value]) => ({ label, value }));
    }, [filteredTableTransactions, activeFilter]);

    // Chart Data Formatters
    const sortedExpenses = useMemo(() => {
        return Array.from(currentStats.expenseCatMap.entries())
            .map(([id, value], index) => ({ 
                id, 
                name: categoryMap.get(id)?.name || 'Unknown', 
                value, 
                color: generateColor(id, index) 
            }))
            .sort((a, b) => b.value - a.value);
    }, [currentStats.expenseCatMap, categoryMap]);

    const sortedSpendingByTag = useMemo(() => {
        return Array.from(currentStats.tagSpendMap.entries())
            .map(([id, value], index) => ({ 
                id, 
                name: tagMap.get(id)?.name || 'Unknown Tag', 
                value, 
                color: generateColor(id, index + 10) 
            }))
            .sort((a, b) => b.value - a.value);
    }, [currentStats.tagSpendMap, tagMap]);

    // Handlers
    const handleCategoryClick = (id: string, name: string) => setActiveFilter({ type: 'category', id, name });
    const handleTagClick = (id: string, name: string) => setActiveFilter({ type: 'tag', id, name });
    const clearActiveFilter = () => setActiveFilter({ type: null, id: null, name: null });

    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            {/* Header with Quick Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
                <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full">
                    {(['thisMonth', 'lastMonth', 'thisYear', 'lastYear', 'all'] as const).map(key => (
                        <button 
                            key={key}
                            onClick={() => handleSetDateRange(key)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${dateRange.key === key ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <KPICard title="Total Income" value={currentStats.income} prevValue={prevStats.income} />
                    <KPICard title="Total Expenses" value={currentStats.expenses} prevValue={prevStats.expenses} isInverse />
                    <KPICard title="Net Flow" value={currentStats.income - currentStats.expenses} prevValue={prevStats.income - prevStats.expenses} />
                </div>

                {/* Charts Row 1: Cash Flow & Category Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-slate-700">Cash Flow</h2>
                            <div className="flex gap-3 text-xs font-medium">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Income</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Expense</span>
                            </div>
                        </div>
                        <div className="flex-grow min-h-[250px]">
                            {cashFlowData.length > 0 ? <CashFlowChart data={cashFlowData} /> : <p className="text-center text-slate-400 py-20">No data available.</p>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                        <h2 className="text-lg font-bold text-slate-700 mb-4">Expense Breakdown</h2>
                        <div className="flex flex-col sm:flex-row items-center gap-8 flex-grow">
                            <DonutChart data={sortedExpenses} onItemClick={handleCategoryClick} />
                            <div className="flex-grow w-full sm:w-auto h-64 overflow-y-auto pr-2">
                                <ul className="space-y-2">
                                    {sortedExpenses.map(item => (
                                        <li 
                                            key={item.id} 
                                            onClick={() => handleCategoryClick(item.id, item.name)}
                                            className="flex items-center justify-between text-sm p-2 rounded hover:bg-slate-50 cursor-pointer group transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: item.color}}></span>
                                                <span className="group-hover:text-indigo-600 truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                            </div>
                                            <span className="font-medium">{formatCurrency(item.value)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Row 2: Top Spending & Tags */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-700 mb-4">Top Spending Categories</h2>
                        {sortedExpenses.length > 0 ? (
                            <TopSpendingBarChart data={sortedExpenses.slice(0, 5)} onItemClick={handleCategoryClick} />
                        ) : (
                            <p className="text-center text-slate-400 py-10">No expenses recorded.</p>
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <TagIcon className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-lg font-bold text-slate-700">Spending by Tag</h2>
                        </div>
                        {sortedSpendingByTag.length > 0 ? (
                            <TopSpendingBarChart data={sortedSpendingByTag.slice(0, 5)} onItemClick={handleTagClick} />
                        ) : (
                            <p className="text-center text-slate-400 py-10">No tagged transactions found.</p>
                        )}
                    </div>
                </div>

                {/* Interactive Transaction Table Section */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-slate-800">Transaction Details</h2>
                            {activeFilter.type && (
                                <div className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium animate-fade-in">
                                    <span className="capitalize">{activeFilter.type}: {activeFilter.name}</span>
                                    <button onClick={clearActiveFilter} className="hover:text-indigo-900"><CloseIcon className="w-4 h-4"/></button>
                                </div>
                            )}
                        </div>
                        {/* Mini Trend Chart in Header if filtered */}
                        {activeFilter.type && selectedTrendData.length > 1 && (
                            <div className="hidden sm:block w-48">
                                <CategoryTrendChart data={selectedTrendData} color="#6366f1" title={activeFilter.name || 'Selection'} />
                            </div>
                        )}
                    </div>
                    
                    <div className="h-96 relative">
                        <TransactionTable 
                            transactions={filteredTableTransactions}
                            accounts={[]} // Not needed for reporting view usually
                            categories={categories}
                            tags={tags}
                            transactionTypes={transactionTypes}
                            payees={payees}
                            users={users}
                            onUpdateTransaction={() => {}}
                            onDeleteTransaction={() => {}}
                            visibleColumns={new Set(['date', 'description', 'amount', 'category', 'type', 'payee', 'tags'])}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
