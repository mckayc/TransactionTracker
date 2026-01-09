
import React, { useState, useMemo } from 'react';
import type { Transaction, SavedReport, TaskItem, FinancialGoal, SystemSettings, DashboardWidget, Category, AmazonMetric, YouTubeMetric } from '../types';
import { AddIcon, SettingsIcon, CloseIcon, ChartPieIcon, ChecklistIcon, LightBulbIcon, TrendingUpIcon, ChevronLeftIcon, ChevronRightIcon, BoxIcon, YoutubeIcon, DollarSign } from '../components/Icons';
import { generateUUID } from '../utils';

interface DashboardProps {
    transactions: Transaction[];
    savedReports: SavedReport[];
    tasks: TaskItem[];
    goals: FinancialGoal[];
    systemSettings: SystemSettings;
    onUpdateSystemSettings: (s: SystemSettings) => void;
    categories: Category[];
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

const CashFlowModule: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
    const [anchorDate, setAnchorDate] = useState(new Date());

    const { start, end, label } = useMemo(() => {
        const s = new Date(anchorDate);
        const e = new Date(anchorDate);
        if (period === 'week') {
            const day = s.getDay();
            s.setDate(s.getDate() - day);
            e.setDate(s.getDate() + 6);
            return { start: s, end: e, label: `Week of ${s.toLocaleDateString()}` };
        }
        if (period === 'month') {
            s.setDate(1);
            e.setMonth(s.getMonth() + 1, 0);
            return { start: s, end: e, label: s.toLocaleString('default', { month: 'long', year: 'numeric' }) };
        }
        if (period === 'quarter') {
            const q = Math.floor(s.getMonth() / 3);
            s.setMonth(q * 3, 1);
            e.setMonth(s.getMonth() + 3, 0);
            return { start: s, end: e, label: `Q${q + 1} ${s.getFullYear()}` };
        }
        s.setMonth(0, 1);
        e.setMonth(11, 31);
        return { start: s, end: e, label: s.getFullYear().toString() };
    }, [anchorDate, period]);

    const totals = useMemo(() => {
        let income = 0;
        let expenses = 0;
        transactions.forEach(tx => {
            const d = new Date(tx.date);
            if (d >= start && d <= end && !tx.isParent) {
                if (tx.typeId.includes('income')) income += tx.amount;
                else if (tx.typeId.includes('purchase') || tx.typeId.includes('tax')) expenses += tx.amount;
            }
        });
        return { income, expenses, net: income - expenses };
    }, [transactions, start, end]);

    const navigate = (dir: number) => {
        const next = new Date(anchorDate);
        if (period === 'week') next.setDate(next.getDate() + (dir * 7));
        else if (period === 'month') next.setMonth(next.getMonth() + dir);
        else if (period === 'quarter') next.setMonth(next.getMonth() + (dir * 3));
        else next.setFullYear(next.getFullYear() + dir);
        setAnchorDate(next);
    };

    return (
        <div className="p-6 space-y-6 flex flex-col h-full">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-indigo-500" /> Cash Flow</h4>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(['week', 'month', 'quarter', 'year'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={`px-2 py-1 text-[9px] font-black uppercase rounded-md transition-all ${period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{p}</button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                <button onClick={() => navigate(-1)} className="p-1 hover:bg-white rounded-lg transition-colors"><ChevronLeftIcon className="w-4 h-4 text-slate-400"/></button>
                <span className="text-xs font-black text-slate-600 uppercase tracking-tight">{label}</span>
                <button onClick={() => navigate(1)} className="p-1 hover:bg-white rounded-lg transition-colors"><ChevronRightIcon className="w-4 h-4 text-slate-400"/></button>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inflow</p>
                    <p className="text-lg font-black text-emerald-600">{formatCurrency(totals.income)}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Outflow</p>
                    <p className="text-lg font-black text-rose-600">{formatCurrency(totals.expenses)}</p>
                </div>
                <div className="col-span-2 pt-4 border-t">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Surplus</p>
                            <p className={`text-2xl font-black ${totals.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(totals.net)}</p>
                        </div>
                        <TrendingUpIcon className={`w-8 h-8 ${totals.net >= 0 ? 'text-indigo-100' : 'text-rose-100'}`} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const TopExpensesModule: React.FC<{ transactions: Transaction[], categories: Category[] }> = ({ transactions, categories }) => {
    const topCats = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const map = new Map<string, number>();
        
        transactions.forEach(tx => {
            const d = new Date(tx.date);
            if (d >= start && (tx.typeId.includes('purchase') || tx.typeId.includes('tax')) && !tx.isParent) {
                map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
            }
        });

        return Array.from(map.entries())
            .map(([id, amt]) => ({ name: categories.find(c => c.id === id)?.name || 'Other', amt }))
            .sort((a, b) => b.amt - a.amt)
            .slice(0, 5);
    }, [transactions, categories]);

    const totalExpense = topCats.reduce((s, c) => s + c.amt, 0);

    return (
        <div className="p-6 space-y-4 flex flex-col h-full">
            <h4 className="font-bold text-slate-800 flex items-center gap-2"><ChartPieIcon className="w-5 h-5 text-rose-500" /> Top Expenses <span className="text-[10px] font-black text-slate-300 uppercase ml-auto">THIS MONTH</span></h4>
            <div className="flex-1 space-y-3">
                {topCats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50 italic text-xs"><p>No expense data yet.</p></div>
                ) : (
                    topCats.map(c => (
                        <div key={c.name} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-600 truncate">{c.name}</span>
                                <span className="text-slate-800">{formatCurrency(c.amt)}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500" style={{ width: `${(c.amt / totalExpense) * 100}%` }} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const AmazonSummaryModule: React.FC<{ metrics: AmazonMetric[] }> = ({ metrics }) => {
    const stats = useMemo(() => {
        const res = { rev: 0, clicks: 0, items: 0 };
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        metrics.forEach(m => {
            if (m.saleDate >= start) {
                res.rev += m.revenue;
                res.clicks += m.clicks;
                res.items += m.orderedItems;
            }
        });
        return res;
    }, [metrics]);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full">
            <h4 className="font-bold text-slate-800 flex items-center gap-2"><BoxIcon className="w-5 h-5 text-orange-500" /> Amazon Influencer <span className="text-[10px] font-black text-slate-300 uppercase ml-auto">MTD</span></h4>
            <div className="flex-1 grid grid-cols-1 gap-4">
                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Earnings</p>
                    <p className="text-2xl font-black text-orange-700">{formatCurrency(stats.rev)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clicks</p>
                        <p className="text-lg font-black text-slate-700">{stats.clicks.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Items</p>
                        <p className="text-lg font-black text-slate-700">{stats.items.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const YouTubeSummaryModule: React.FC<{ metrics: YouTubeMetric[] }> = ({ metrics }) => {
    const stats = useMemo(() => {
        const res = { rev: 0, views: 0, subs: 0 };
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        metrics.forEach(m => {
            if (m.publishDate >= start) {
                res.rev += m.estimatedRevenue;
                res.views += m.views;
                res.subs += m.subscribersGained;
            }
        });
        return res;
    }, [metrics]);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full">
            <h4 className="font-bold text-slate-800 flex items-center gap-2"><YoutubeIcon className="w-5 h-5 text-red-600" /> YouTube Content <span className="text-[10px] font-black text-slate-300 uppercase ml-auto">MTD</span></h4>
            <div className="flex-1 grid grid-cols-1 gap-4">
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">AdSense</p>
                    <p className="text-2xl font-black text-red-700">{formatCurrency(stats.rev)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Views</p>
                        <p className="text-lg font-black text-slate-700">{stats.views.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subs</p>
                        <p className="text-lg font-black text-slate-700">{stats.subs.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WidgetSlot: React.FC<{
    widget: DashboardWidget;
    onRemove: () => void;
    onConfigure: () => void;
    savedReports: SavedReport[];
    transactions: Transaction[];
    tasks: TaskItem[];
    goals: FinancialGoal[];
    categories: Category[];
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
}> = ({ widget, onRemove, onConfigure, savedReports, transactions, tasks, goals, categories, amazonMetrics, youtubeMetrics }) => {
    
    const renderContent = () => {
        if (widget.type === 'report' && widget.config) {
            const report = savedReports.find(r => r.id === widget.config);
            if (!report) return <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center"><p className="text-sm">Report not found.</p></div>;
            
            return (
                <div className="h-[400px] flex flex-col">
                   <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 truncate text-sm uppercase tracking-tight flex items-center gap-2"><ChartPieIcon className="w-4 h-4 text-indigo-500" /> {report.name}</h4>
                   </div>
                   <div className="flex-1 p-4 flex flex-col items-center justify-center text-center">
                        <ChartPieIcon className="w-16 h-16 text-indigo-50 mb-4" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Blueprint Loaded</p>
                        <p className="text-xs text-slate-500 mt-1">Full visualization available in Strategy Canvas.</p>
                   </div>
                </div>
            );
        }

        if (widget.type === 'tasks') {
            const active = tasks.filter(t => !t.isCompleted).slice(0, 5);
            return (
                <div className="p-6 space-y-4 flex flex-col h-full min-h-[300px]">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><ChecklistIcon className="w-5 h-5 text-indigo-500" /> Pending Tasks</h4>
                    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                        {active.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50 italic text-xs"><p>All missions complete.</p></div>
                        ) : active.map(t => (
                            <div key={t.id} className="text-sm p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center hover:border-indigo-200 transition-colors">
                                <span className="truncate flex-1 font-medium">{t.title}</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ml-2 ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{t.priority}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (widget.type === 'cashflow') return <CashFlowModule transactions={transactions} />;
        if (widget.type === 'top_expenses') return <TopExpensesModule transactions={transactions} categories={categories} />;
        if (widget.type === 'amazon_summary') return <AmazonSummaryModule metrics={amazonMetrics} />;
        if (widget.type === 'youtube_summary') return <YouTubeSummaryModule metrics={youtubeMetrics} />;

        return (
            <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 p-8 text-center bg-slate-50/50">
                <SettingsIcon className="w-12 h-12 mb-3 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest">Unconfigured Module</p>
                <button onClick={onConfigure} className="mt-4 px-6 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-black text-indigo-600 uppercase hover:bg-slate-50 transition-all">Configure</button>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group relative transition-all hover:shadow-md h-full min-h-[300px]">
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button onClick={onConfigure} className="p-2 bg-white/90 backdrop-blur border border-slate-100 rounded-xl text-slate-500 hover:text-indigo-600 shadow-xl transition-all"><SettingsIcon className="w-3.5 h-3.5"/></button>
                <button onClick={onRemove} className="p-2 bg-white/90 backdrop-blur border border-slate-100 rounded-xl text-slate-500 hover:text-red-600 shadow-xl transition-all"><CloseIcon className="w-3.5 h-3.5"/></button>
            </div>
            {renderContent()}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, savedReports, tasks, goals, systemSettings, onUpdateSystemSettings, categories, amazonMetrics, youtubeMetrics }) => {
    const [isConfiguring, setIsConfiguring] = useState<string | null>(null);

    const widgets = systemSettings.dashboardWidgets || [];

    const addWidget = () => {
        const newWidget: DashboardWidget = { id: generateUUID(), type: 'cashflow' };
        onUpdateSystemSettings({ ...systemSettings, dashboardWidgets: [...widgets, newWidget] });
    };

    const removeWidget = (id: string) => {
        onUpdateSystemSettings({ ...systemSettings, dashboardWidgets: widgets.filter(w => w.id !== id) });
    };

    const configureWidget = (id: string, type: DashboardWidget['type'], config?: any) => {
        onUpdateSystemSettings({
            ...systemSettings,
            dashboardWidgets: widgets.map(w => w.id === id ? { ...w, type, config } : w)
        });
        setIsConfiguring(null);
    };

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">Executive Dashboard</h1>
                    <p className="text-slate-500 mt-1 font-medium">Global mission control for your financial ecosystem.</p>
                </div>
                <button onClick={addWidget} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                    <AddIcon className="w-5 h-5" /> Add Module
                </button>
            </div>

            {widgets.length === 0 ? (
                <div className="bg-white p-24 rounded-[3rem] border-4 border-dashed border-slate-100 text-center space-y-6">
                    <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUpIcon className="w-12 h-12 text-indigo-200" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">Your Command Center is Empty</h3>
                        <p className="text-slate-400 max-w-sm mx-auto mt-2 font-medium">Construct a customized view by adding telemetry modules for cash flow, task completion, and platform earnings.</p>
                    </div>
                    <button onClick={addWidget} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Launch Designer</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {widgets.map(w => (
                        <WidgetSlot 
                            key={w.id} 
                            widget={w} 
                            onRemove={() => removeWidget(w.id)} 
                            onConfigure={() => setIsConfiguring(w.id)}
                            savedReports={savedReports}
                            transactions={transactions}
                            tasks={tasks}
                            goals={goals}
                            categories={categories}
                            amazonMetrics={amazonMetrics}
                            youtubeMetrics={youtubeMetrics}
                        />
                    ))}
                </div>
            )}

            {isConfiguring && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setIsConfiguring(null)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-8 flex flex-col gap-8 animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Module Forge</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Telemetry Configuration</p>
                            </div>
                            <button onClick={() => setIsConfiguring(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        
                        <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Universal Modules</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button onClick={() => configureWidget(isConfiguring, 'cashflow')} className="p-5 border-2 border-slate-100 rounded-3xl hover:border-indigo-600 text-left transition-all group bg-slate-50 hover:bg-white shadow-sm">
                                        <div className="p-2 bg-indigo-100 rounded-xl w-max mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><DollarSign className="w-6 h-6" /></div>
                                        <p className="font-black text-slate-800">Cash Flow</p>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Interactive income/expense tracker with period navigation.</p>
                                    </button>
                                    <button onClick={() => configureWidget(isConfiguring, 'top_expenses')} className="p-5 border-2 border-slate-100 rounded-3xl hover:border-indigo-600 text-left transition-all group bg-slate-50 hover:bg-white shadow-sm">
                                        <div className="p-2 bg-rose-100 rounded-xl w-max mb-3 group-hover:bg-rose-600 group-hover:text-white transition-colors"><ChartPieIcon className="w-6 h-6" /></div>
                                        <p className="font-black text-slate-800">Top Expenses</p>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Categorical breakdown of highest spending for the current month.</p>
                                    </button>
                                    <button onClick={() => configureWidget(isConfiguring, 'tasks')} className="p-5 border-2 border-slate-100 rounded-3xl hover:border-indigo-600 text-left transition-all group bg-slate-50 hover:bg-white shadow-sm">
                                        <div className="p-2 bg-indigo-100 rounded-xl w-max mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><ChecklistIcon className="w-6 h-6" /></div>
                                        <p className="font-black text-slate-800">Action Queue</p>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">List of top 5 pending tasks and operational checklists.</p>
                                    </button>
                                    <button onClick={() => configureWidget(isConfiguring, 'calendar')} className="p-5 border-2 border-slate-100 rounded-3xl hover:border-indigo-600 text-left transition-all group bg-slate-50 hover:bg-white shadow-sm">
                                        <div className="p-2 bg-emerald-100 rounded-xl w-max mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><TrendingUpIcon className="w-6 h-6" /></div>
                                        <p className="font-black text-slate-800">Wealth Gauge</p>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Aggregated asset tracker and progress towards defined goals.</p>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 pt-6 border-t">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Platform Integration Insights</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button onClick={() => configureWidget(isConfiguring, 'amazon_summary')} className="p-5 border-2 border-slate-100 rounded-3xl hover:border-orange-500 text-left transition-all group bg-slate-50 hover:bg-white shadow-sm">
                                        <div className="p-2 bg-orange-100 text-orange-600 rounded-xl w-max mb-3 group-hover:bg-orange-600 group-hover:text-white transition-colors"><BoxIcon className="w-6 h-6" /></div>
                                        <p className="font-black text-slate-800">Amazon Associates</p>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Month-to-date earnings, clicks, and conversion summaries.</p>
                                    </button>
                                    <button onClick={() => configureWidget(isConfiguring, 'youtube_summary')} className="p-5 border-2 border-slate-100 rounded-3xl hover:border-red-600 text-left transition-all group bg-slate-50 hover:bg-white shadow-sm">
                                        <div className="p-2 bg-red-100 text-red-600 rounded-xl w-max mb-3 group-hover:bg-red-600 group-hover:text-white transition-colors"><YoutubeIcon className="w-6 h-6" /></div>
                                        <p className="font-black text-slate-800">YouTube Creator</p>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">MTD AdSense revenue, views, and audience growth metrics.</p>
                                    </button>
                                </div>
                            </div>

                            {savedReports.length > 0 && (
                                <div className="space-y-3 pt-6 border-t">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Embed Strategic Reports</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {savedReports.map(r => (
                                            <button 
                                                key={r.id} 
                                                onClick={() => configureWidget(isConfiguring, 'report', r.id)}
                                                className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-500 text-left flex items-center justify-between group transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-indigo-50 transition-colors"><ChartPieIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" /></div>
                                                    <span className="font-bold text-sm text-slate-700 group-hover:text-indigo-900">{r.name}</span>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
