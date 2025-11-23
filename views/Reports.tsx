
import React, { useState, useMemo, useCallback } from 'react';
import type { Transaction, TransactionType, Category, Payee, BalanceEffect, User, Tag } from '../types';
import DateRangePicker from '../components/DateRangePicker';
import MultiSelect from '../components/MultiSelect';
import { formatDate } from '../dateUtils';

interface ReportsProps {
  transactions: Transaction[];
  transactionTypes: TransactionType[];
  categories: Category[];
  payees: Payee[];
  users: User[];
  tags: Tag[];
}

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

const KPICard: React.FC<{ title: string; value: string; }> = ({ title, value }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
);

const TrendChart: React.FC<{ data: any[] }> = ({ data }) => {
    const width = 500;
    const height = 250;
    const padding = 40;
    const maxY = Math.max(...data.flatMap(d => [d.income, d.expense]), 100);

    const pointsToPath = (points: [number, number][]) => points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p[0]},${p[1]}`).join(' ');
    
    const incomePoints: [number, number][] = data.map((d, i) => [padding + i * (width - 2 * padding) / (data.length - 1 || 1), height - padding - (d.income / maxY) * (height - 2 * padding)]);
    const expensePoints: [number, number][] = data.map((d, i) => [padding + i * (width - 2 * padding) / (data.length - 1 || 1), height - padding - (d.expense / maxY) * (height - 2 * padding)]);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Y-Axis */}
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d1d5db" />
            {[...Array(5)].map((_, i) => (
                <text key={i} x={padding - 8} y={padding + i * (height - 2 * padding) / 4} textAnchor="end" alignmentBaseline="middle" className="text-xs fill-slate-500">
                    {formatCurrency(maxY - i * (maxY / 4))}
                </text>
            ))}
            {/* X-Axis */}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d1d5db" />
             {data.map((d, i) => (data.length <= 15 || i % Math.floor(data.length / 10) === 0) && (
                <text key={i} x={padding + i * (width - 2 * padding) / (data.length - 1 || 1)} y={height - padding + 15} textAnchor="middle" className="text-xs fill-slate-500">{d.label}</text>
            ))}
            {/* Data Lines */}
            <path d={pointsToPath(incomePoints)} stroke="#10b981" fill="none" strokeWidth="2" />
            <path d={pointsToPath(expensePoints)} stroke="#ef4444" fill="none" strokeWidth="2" />
        </svg>
    );
};

const DonutChart: React.FC<{ data: { name: string, value: number, color: string }[] }> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    const radius = 80;
    const circumference = 2 * Math.PI * radius;

    if (total === 0) return <div className="w-48 h-48 rounded-full bg-slate-200 flex items-center justify-center"><p className="text-slate-500 text-sm">No expense data</p></div>;

    let offset = 0;
    return (
        <svg viewBox="0 0 200 200" className="w-48 h-48">
            {data.map(item => {
                const percentage = (item.value / total) * 100;
                const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -offset;
                offset += (percentage / 100) * circumference;
                return (
                    <circle key={item.name} cx="100" cy="100" r={radius} fill="transparent" stroke={item.color} strokeWidth="30" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} transform="rotate(-90 100 100)" />
                );
            })}
        </svg>
    );
};

const TopSpendingBarChart: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-3">
            {data.map(item => (
                <div key={item.name} className="grid grid-cols-4 items-center gap-2 text-sm">
                    <span className="col-span-1 truncate" title={item.name}>{item.name}</span>
                    <div className="col-span-3 flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-4">
                            <div className="h-4 rounded-full" style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }} />
                        </div>
                        <span className="font-medium text-slate-700 w-24 text-right">{formatCurrency(item.value)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};


const Reports: React.FC<ReportsProps> = ({ transactions, transactionTypes, categories, payees, users, tags }) => {
    const [isFilterOpen, setIsFilterOpen] = useState(true);

    const [dateRange, setDateRange] = useState(() => {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { key: 'thisMonth', start, end };
    });

    const [selectedCategories, setSelectedCategories] = useState(() => new Set<string>());
    const [selectedPayees, setSelectedPayees] = useState(() => new Set<string>());
    const [selectedUsers, setSelectedUsers] = useState(() => new Set<string>());
    const [selectedTags, setSelectedTags] = useState(() => new Set<string>());
    const [selectedBalanceEffects, setSelectedBalanceEffects] = useState<Set<BalanceEffect>>(() => new Set(['income', 'expense']));
    
    const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
    const payeeMap = useMemo(() => new Map(payees.map(p => [p.id, p])), [payees]);
    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);

    const filteredData = useMemo(() => {
        return transactions.filter(tx => {
            const txDate = new Date(tx.date);
            if (txDate < dateRange.start || txDate > dateRange.end) return false;
            
            const balanceEffect = transactionTypeMap.get(tx.typeId)?.balanceEffect;
            if (!balanceEffect || !selectedBalanceEffects.has(balanceEffect)) return false;

            if (selectedCategories.size > 0 && !selectedCategories.has(tx.categoryId)) return false;
            if (selectedPayees.size > 0 && (!tx.payeeId || !selectedPayees.has(tx.payeeId))) return false;
            if (selectedUsers.size > 0 && (!tx.userId || !selectedUsers.has(tx.userId))) return false;
            
            if (selectedTags.size > 0) {
                const txTags = tx.tagIds || [];
                if (!txTags.some(t => selectedTags.has(t))) return false;
            }

            return true;
        });
    }, [transactions, dateRange, selectedCategories, selectedPayees, selectedUsers, selectedTags, selectedBalanceEffects, transactionTypeMap]);

    const { kpis, trendData, expenseByCategory, topSpending, spendingByUser } = useMemo(() => {
        let totalIncome = 0;
        let totalExpenses = 0;
        const trendMap = new Map<string, { income: number; expense: number }>();
        const expenseMap = new Map<string, number>();
        const userSpendingMap = new Map<string, number>();

        const timeDiff = dateRange.end.getTime() - dateRange.start.getTime();
        const dayDiff = timeDiff / (1000 * 3600 * 24);
        const getLabel = (date: Date) => {
            // Use strict formatting for graph labels
            if (dayDiff <= 31) return formatDate(date).slice(5); // MM-DD
            return formatDate(date).slice(0, 7); // YYYY-MM
        };

        filteredData.forEach(tx => {
            const type = transactionTypeMap.get(tx.typeId);
            const label = getLabel(new Date(tx.date));
            if (!trendMap.has(label)) trendMap.set(label, { income: 0, expense: 0 });
            const trendEntry = trendMap.get(label)!;

            if (type?.balanceEffect === 'income') {
                totalIncome += tx.amount;
                trendEntry.income += tx.amount;
            } else if (type?.balanceEffect === 'expense') {
                totalExpenses += tx.amount;
                trendEntry.expense += tx.amount;
                
                const category = categoryMap.get(tx.categoryId);
                if (category) {
                    const parentCategory = category.parentId ? categoryMap.get(category.parentId) : category;
                    const name = parentCategory?.name || 'Uncategorized';
                    expenseMap.set(name, (expenseMap.get(name) || 0) + tx.amount);
                }
                
                const userId = tx.userId || 'unknown';
                userSpendingMap.set(userId, (userSpendingMap.get(userId) || 0) + tx.amount);
            }
        });
        
        const sortedTrend = Array.from(trendMap.entries())
            .sort(([a], [b]) => a.localeCompare(b)) // YYYY-MM sort works alphabetically
            .map(([label, values]) => ({ label, ...values }));

        const sortedExpenses = Array.from(expenseMap.entries())
            .map(([name, value], index) => ({ name, value, color: generateColor(name, index) }))
            .sort((a, b) => b.value - a.value);

        const sortedSpendingByUser = Array.from(userSpendingMap.entries())
            .map(([userId, value], index) => {
                const name = userMap.get(userId) || 'Unassigned';
                return { name, value, color: generateColor(name, index) };
            })
            .sort((a, b) => b.value - a.value);

        return {
            kpis: {
                income: totalIncome,
                expenses: totalExpenses,
                net: totalIncome - totalExpenses,
            },
            trendData: sortedTrend,
            expenseByCategory: sortedExpenses,
            topSpending: sortedExpenses.slice(0, 5),
            spendingByUser: sortedSpendingByUser
        };
    }, [filteredData, transactionTypeMap, categoryMap, dateRange, userMap]);

    const handleBalanceEffectToggle = (effect: BalanceEffect) => {
        setSelectedBalanceEffects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(effect)) {
                newSet.delete(effect);
            } else {
                newSet.add(effect);
            }
            return newSet;
        });
    };

    const flattenedCategories = useMemo(() => {
        const flattened: {id: string, name: string}[] = [];
        const parents = categories.filter(c => !c.parentId).sort((a,b) => a.name.localeCompare(b.name));
        parents.forEach(parent => {
            flattened.push({id: parent.id, name: parent.name});
            const children = categories.filter(c => c.parentId === parent.id).sort((a,b) => a.name.localeCompare(b.name));
            children.forEach(child => {
                flattened.push({id: child.id, name: `  ${child.name}`});
            });
        });
        return flattened;
    }, [categories]);

    const flattenedPayees = useMemo(() => {
        const flattened: {id: string, name: string}[] = [];
        const parents = payees.filter(p => !p.parentId).sort((a,b) => a.name.localeCompare(b.name));
        parents.forEach(parent => {
            flattened.push({id: parent.id, name: parent.name});
            const children = payees.filter(p => p.parentId === parent.id).sort((a,b) => a.name.localeCompare(b.name));
            children.forEach(child => {
                flattened.push({id: child.id, name: `  ${child.name}`});
            });
        });
        return flattened;
    }, [payees]);


    return (
        <div className="flex flex-col md:flex-row gap-6">
            {/* Filter Sidebar */}
            <aside className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all duration-300 ${isFilterOpen ? 'md:w-72' : 'md:w-16'}`}>
                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="w-full flex justify-between items-center mb-4">
                    <span className={`font-bold text-lg ${!isFilterOpen && 'hidden'}`}>Filters</span>
                    <span>{isFilterOpen ? '‹' : '›'}</span>
                </button>
                <div className={`${!isFilterOpen && 'hidden'}`}>
                    <div className="space-y-4">
                        <DateRangePicker onChange={(range) => setDateRange(range)} />
                        
                        <div>
                            <h4 className="font-semibold text-sm mb-2">Transaction Type</h4>
                            <div className="flex gap-2">
                                {(['income', 'expense', 'transfer'] as BalanceEffect[]).map(effect => (
                                    <button key={effect} onClick={() => handleBalanceEffectToggle(effect)} className={`w-full text-xs capitalize py-1.5 rounded-md transition-colors ${selectedBalanceEffects.has(effect) ? 'bg-indigo-600 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}>
                                        {effect}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <MultiSelect title="Categories" items={flattenedCategories} selectedIds={selectedCategories} onSelectionChange={setSelectedCategories} />
                        <MultiSelect title="Tags" items={tags} selectedIds={selectedTags} onSelectionChange={setSelectedTags} />
                        <MultiSelect title="Payees" items={flattenedPayees} selectedIds={selectedPayees} onSelectionChange={setSelectedPayees} />
                        <MultiSelect title="Users" items={users} selectedIds={selectedUsers} onSelectionChange={setSelectedUsers} />
                    </div>
                </div>
            </aside>
            
            {/* Main Content */}
            <main className="flex-1 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <KPICard title="Total Income" value={formatCurrency(kpis.income)} />
                    <KPICard title="Total Expenses" value={formatCurrency(kpis.expenses)} />
                    <KPICard title="Net Flow" value={formatCurrency(kpis.net)} />
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-700 mb-4">Income vs Expense Trend</h2>
                    <div className="flex justify-center items-center gap-4 text-sm mb-2">
                        <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 rounded-sm" />Income</span>
                        <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm" />Expense</span>
                    </div>
                    {trendData.length > 0 ? <TrendChart data={trendData} /> : <p className="text-center text-slate-500 py-16">No data for this period.</p>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-700 mb-4">Expense Breakdown</h2>
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <DonutChart data={expenseByCategory} />
                            <ul className="text-sm space-y-1 overflow-y-auto max-h-48 flex-grow">
                                {expenseByCategory.map(item => (
                                    <li key={item.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}} />{item.name}</div>
                                        <span className="font-medium">{formatCurrency(item.value)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-700 mb-4">Top Spending Categories</h2>
                        {topSpending.length > 0 ? <TopSpendingBarChart data={topSpending} /> : <p className="text-center text-slate-500 py-16">No spending data.</p>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-700 mb-4">Spending by User</h2>
                    {spendingByUser.length > 0 ? <TopSpendingBarChart data={spendingByUser} /> : <p className="text-center text-slate-500 py-16">No spending data for the selected users.</p>}
                </div>
            </main>
        </div>
    );
};

export default Reports;
