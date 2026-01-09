
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, SavedReport, TaskItem, FinancialGoal, SystemSettings, DashboardWidget, Category, AmazonMetric, YouTubeMetric, FinancialPlan } from '../types';
/* Added RobotIcon, BarChartIcon, and InfoIcon to imports */
import { AddIcon, SettingsIcon, CloseIcon, ChartPieIcon, ChecklistIcon, LightBulbIcon, TrendingUpIcon, ChevronLeftIcon, ChevronRightIcon, BoxIcon, YoutubeIcon, DollarSign, SparklesIcon, ShieldCheckIcon, CalendarIcon, RobotIcon, BarChartIcon, InfoIcon } from '../components/Icons';
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
    financialPlan: FinancialPlan | null;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

const GoalGaugeModule: React.FC<{ goals: FinancialGoal[], config: DashboardWidget['config'] }> = ({ goals, config }) => {
    const goal = goals.find(g => g.id === config?.goalId) || goals[0];
    if (!goal) return <div className="p-6 text-center text-slate-400 text-xs italic">No goals defined in Financial Plan.</div>;

    const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full">
            <h4 className="font-bold text-slate-800 flex items-center gap-2 truncate">
                <ShieldCheckIcon className="w-5 h-5 text-indigo-500" /> {config?.title || goal.title}
            </h4>
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * progress) / 100} className="text-indigo-600 transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-slate-800">{progress.toFixed(0)}%</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase">Target</span>
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-lg font-black text-slate-800">{formatCurrency(goal.currentAmount)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">of {formatCurrency(goal.targetAmount)}</p>
                </div>
            </div>
        </div>
    );
};

const TaxProjectionModule: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const stats = useMemo(() => {
        let income = 0;
        let deductible = 0;
        transactions.forEach(tx => {
            const d = new Date(tx.date);
            if (d.getFullYear() === currentYear && !tx.isParent) {
                if (tx.typeId.includes('income')) income += tx.amount;
                // High level heuristic for tax deductible
                else if (tx.typeId.includes('tax') || tx.categoryId.includes('business') || tx.categoryId.includes('office')) deductible += tx.amount;
            }
        });
        const taxable = Math.max(0, income - deductible);
        const estimatedTax = taxable * 0.25; // Simple 25% projection
        return { estimatedTax, taxable, income };
    }, [transactions, currentYear]);

    return (
        <div className="p-6 space-y-6 flex flex-col h-full bg-slate-50/50">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-orange-500" /> Tax Projector <span className="text-[10px] font-black text-slate-300 uppercase ml-auto">{currentYear}</span>
            </h4>
            <div className="space-y-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Liability (25%)</p>
                    <p className="text-2xl font-black text-orange-600">{formatCurrency(stats.estimatedTax)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Taxable Basis</p>
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(stats.taxable)}</p>
                    </div>
                    <div className="text-center p-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Net Income</p>
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(stats.income)}</p>
                    </div>
                </div>
            </div>
            <p className="text-[9px] text-slate-400 italic text-center">Heuristic projection based on current ledger categorizations.</p>
        </div>
    );
};

const AiInsightsModule: React.FC<{ plan: FinancialPlan | null }> = ({ plan }) => {
    return (
        <div className="p-6 space-y-4 flex flex-col h-full bg-indigo-900 text-white rounded-3xl overflow-hidden relative">
            <div className="relative z-10 flex flex-col h-full">
                <h4 className="font-bold flex items-center gap-2 mb-4">
                    <SparklesIcon className="w-5 h-5 text-indigo-300" /> AI Wealth Strategy
                </h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {plan ? (
                        <p className="text-sm text-indigo-100 leading-relaxed italic line-clamp-6">
                            "{plan.strategy.split('\n')[0] || plan.strategy}"
                        </p>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                            <RobotIcon className="w-8 h-8 text-indigo-400 opacity-50" />
                            <p className="text-xs text-indigo-300 font-medium">No strategy generated yet. Consult the Financial Architect.</p>
                        </div>
                    )}
                </div>
                {plan && (
                    <div className="pt-4 mt-auto border-t border-white/10 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-indigo-400">
                        <span>Updated {new Date(plan.createdAt).toLocaleDateString()}</span>
                        <ChevronRightIcon className="w-4 h-4" />
                    </div>
                )}
            </div>
            <SparklesIcon className="absolute -right-12 -top-12 w-48 h-48 opacity-10 text-indigo-400 pointer-events-none" />
        </div>
    );
};

const CashFlowModule: React.FC<{ transactions: Transaction[], config: DashboardWidget['config'] }> = ({ transactions, config }) => {
    const [period, setPeriod] = useState(config?.period || 'month');
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
                <h4 className="font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-indigo-500" /> {config?.title || 'Cash Flow'}</h4>
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
    financialPlan: FinancialPlan | null;
}> = ({ widget, onRemove, onConfigure, savedReports, transactions, tasks, goals, categories, amazonMetrics, youtubeMetrics, financialPlan }) => {
    
    const renderContent = () => {
        if (widget.type === 'report' && widget.config?.reportId) {
            const report = savedReports.find(r => r.id === widget.config?.reportId);
            if (!report) return <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center"><p className="text-sm">Report blueprint missing.</p></div>;
            
            return (
                <div className="h-full flex flex-col">
                   <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 truncate text-sm uppercase tracking-tight flex items-center gap-2"><ChartPieIcon className="w-4 h-4 text-indigo-500" /> {widget.config.title || report.name}</h4>
                   </div>
                   <div className="flex-1 p-4 flex flex-col items-center justify-center text-center bg-white">
                        <ChartPieIcon className="w-16 h-16 text-indigo-50 mb-4" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategy Stream Active</p>
                        <p className="text-xs text-slate-500 mt-1">Visit Strategic Hub for interactive view.</p>
                   </div>
                </div>
            );
        }

        if (widget.type === 'tasks') {
            const active = tasks.filter(t => !t.isCompleted).slice(0, 5);
            return (
                <div className="p-6 space-y-4 flex flex-col h-full min-h-[300px]">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><ChecklistIcon className="w-5 h-5 text-indigo-500" /> {widget.config?.title || 'Action Queue'}</h4>
                    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                        {active.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50 italic text-xs"><p>All systems clear.</p></div>
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

        if (widget.type === 'cashflow') return <CashFlowModule transactions={transactions} config={widget.config} />;
        if (widget.type === 'top_expenses') return <TopExpensesModule transactions={transactions} categories={categories} />;
        if (widget.type === 'amazon_summary') return <AmazonSummaryModule metrics={amazonMetrics} />;
        if (widget.type === 'youtube_summary') return <YouTubeSummaryModule metrics={youtubeMetrics} />;
        if (widget.type === 'goal_gauge') return <GoalGaugeModule goals={goals} config={widget.config} />;
        if (widget.type === 'tax_projection') return <TaxProjectionModule transactions={transactions} />;
        if (widget.type === 'ai_insights') return <AiInsightsModule plan={financialPlan} />;

        return (
            <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 p-8 text-center bg-slate-50/50">
                <SettingsIcon className="w-12 h-12 mb-3 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest">Empty Slot</p>
                <button onClick={onConfigure} className="mt-4 px-6 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-black text-indigo-600 uppercase hover:bg-slate-50 transition-all">Configure</button>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden group relative transition-all hover:shadow-md h-full min-h-[300px]">
            <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button onClick={onConfigure} title="Edit Instance" className="p-2.5 bg-white/95 backdrop-blur border border-slate-100 rounded-xl text-slate-500 hover:text-indigo-600 shadow-xl transition-all active:scale-95"><SettingsIcon className="w-4 h-4"/></button>
                <button onClick={onRemove} title="Purge Instance" className="p-2.5 bg-white/95 backdrop-blur border border-slate-100 rounded-xl text-slate-500 hover:text-red-600 shadow-xl transition-all active:scale-95"><CloseIcon className="w-4 h-4"/></button>
            </div>
            {renderContent()}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, savedReports, tasks, goals, systemSettings, onUpdateSystemSettings, categories, amazonMetrics, youtubeMetrics, financialPlan }) => {
    const [isConfiguring, setIsConfiguring] = useState<string | null>(null);
    
    // Config form state
    const [configTitle, setConfigTitle] = useState('');
    const [configGoalId, setConfigGoalId] = useState('');
    const [configReportId, setConfigReportId] = useState('');
    const [configPeriod, setConfigPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

    const widgets = systemSettings.dashboardWidgets || [];
    const activeWidget = useMemo(() => widgets.find(w => w.id === isConfiguring), [isConfiguring, widgets]);

    useEffect(() => {
        if (activeWidget) {
            setConfigTitle(activeWidget.config?.title || '');
            setConfigGoalId(activeWidget.config?.goalId || goals[0]?.id || '');
            setConfigReportId(activeWidget.config?.reportId || savedReports[0]?.id || '');
            setConfigPeriod(activeWidget.config?.period || 'month');
        }
    }, [isConfiguring, activeWidget, goals, savedReports]);

    const addWidget = () => {
        const newWidget: DashboardWidget = { id: generateUUID(), type: 'cashflow' };
        onUpdateSystemSettings({ ...systemSettings, dashboardWidgets: [...widgets, newWidget] });
        setIsConfiguring(newWidget.id);
    };

    const removeWidget = (id: string) => {
        onUpdateSystemSettings({ ...systemSettings, dashboardWidgets: widgets.filter(w => w.id !== id) });
    };

    const handleApplyConfig = (type: DashboardWidget['type']) => {
        if (!isConfiguring) return;
        const newConfig = {
            title: configTitle,
            goalId: type === 'goal_gauge' ? configGoalId : undefined,
            reportId: type === 'report' ? configReportId : undefined,
            period: type === 'cashflow' ? configPeriod : undefined
        };
        
        onUpdateSystemSettings({
            ...systemSettings,
            dashboardWidgets: widgets.map(w => w.id === isConfiguring ? { ...w, type, config: newConfig } : w)
        });
        setIsConfiguring(null);
    };

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">Executive Dashboard</h1>
                    <p className="text-slate-500 mt-1 font-medium text-lg">Integrated telemetry for your financial ecosystem.</p>
                </div>
                <button onClick={addWidget} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                    <AddIcon className="w-5 h-5" /> Deploy Module
                </button>
            </div>

            {widgets.length === 0 ? (
                <div className="bg-white p-24 rounded-[3.5rem] border-4 border-dashed border-slate-100 text-center space-y-6">
                    <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUpIcon className="w-12 h-12 text-indigo-200" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">Telemetry Engine Offline</h3>
                        <p className="text-slate-400 max-w-sm mx-auto mt-2 font-medium">Construct your specialized cockpit by forging custom metrics, goal gauges, and AI strategy snips.</p>
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
                            financialPlan={financialPlan}
                        />
                    ))}
                    <button 
                        onClick={addWidget} 
                        className="group bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-12 transition-all hover:bg-white hover:border-indigo-200 min-h-[300px]"
                    >
                        <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <AddIcon className="w-8 h-8" />
                        </div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600">Forge New Module</span>
                    </button>
                </div>
            )}

            {isConfiguring && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setIsConfiguring(null)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Module Forge</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Logic & Visual Definition</p>
                            </div>
                            <button onClick={() => setIsConfiguring(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        
                        <div className="flex flex-1 min-h-0">
                            {/* Blueprints Sidebar */}
                            <div className="w-64 bg-slate-50/50 border-r border-slate-100 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-1.5">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Available Blueprints</p>
                                {[
                                    { id: 'cashflow', label: 'Cash Flow', icon: <DollarSign className="w-4 h-4" /> },
                                    { id: 'goal_gauge', label: 'Goal Progress', icon: <ShieldCheckIcon className="w-4 h-4" /> },
                                    { id: 'tax_projection', label: 'Tax Estimator', icon: <CalendarIcon className="w-4 h-4" /> },
                                    { id: 'ai_insights', label: 'AI Strategy', icon: <SparklesIcon className="w-4 h-4" /> },
                                    { id: 'top_expenses', label: 'Expense Matrix', icon: <ChartPieIcon className="w-4 h-4" /> },
                                    { id: 'tasks', label: 'Action Queue', icon: <ChecklistIcon className="w-4 h-4" /> },
                                    { id: 'amazon_summary', label: 'Amazon Yield', icon: <BoxIcon className="w-4 h-4" /> },
                                    { id: 'youtube_summary', label: 'YouTube ROI', icon: <YoutubeIcon className="w-4 h-4" /> },
                                    { id: 'report', label: 'Report Embed', icon: <BarChartIcon className="w-4 h-4" /> }
                                ].map(bp => (
                                    <button 
                                        key={bp.id} 
                                        onClick={() => handleApplyConfig(bp.id as any)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-tight transition-all ${activeWidget?.type === bp.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`}
                                    >
                                        {bp.icon} {bp.label}
                                    </button>
                                ))}
                            </div>

                            {/* Configuration Panel */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instance Title Override</label>
                                    <input 
                                        type="text" 
                                        value={configTitle} 
                                        onChange={e => setConfigTitle(e.target.value)} 
                                        className="w-full font-bold text-lg p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all" 
                                        placeholder="Defaults to Blueprint Name"
                                    />
                                </div>

                                {activeWidget?.type === 'goal_gauge' && (
                                    <div className="space-y-3 animate-fade-in">
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Target Registry</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {goals.map(g => (
                                                <button 
                                                    key={g.id} 
                                                    onClick={() => setConfigGoalId(g.id)}
                                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${configGoalId === g.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                                                >
                                                    <p className="font-bold text-slate-800">{g.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{formatCurrency(g.targetAmount)} Target</p>
                                                </button>
                                            ))}
                                            {goals.length === 0 && <p className="p-8 text-center text-slate-400 text-sm italic">Define wealth targets in Financial Plan.</p>}
                                        </div>
                                    </div>
                                )}

                                {activeWidget?.type === 'report' && (
                                    <div className="space-y-3 animate-fade-in">
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Strategic Blueprint</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {savedReports.map(r => (
                                                <button 
                                                    key={r.id} 
                                                    onClick={() => setConfigReportId(r.id)}
                                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${configReportId === r.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                                                >
                                                    <p className="font-bold text-slate-800">{r.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{r.config.groupBy} Focus</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeWidget?.type === 'cashflow' && (
                                    <div className="space-y-3 animate-fade-in">
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Default Temporal Context</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['week', 'month', 'quarter', 'year'] as const).map(p => (
                                                <button 
                                                    key={p} 
                                                    onClick={() => setConfigPeriod(p)}
                                                    className={`p-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${configPeriod === p ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-500'}`}
                                                >
                                                    {p}ly View
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
                                    <InfoIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">Changes made in the forge are localized to this dashboard instance. Strategic blue prints (Reports) are updated globally.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t flex justify-end gap-3 bg-white">
                            <button onClick={() => setIsConfiguring(null)} className="px-6 py-3 text-sm font-black uppercase text-slate-500 hover:bg-slate-100 rounded-2xl transition-all">Discard</button>
                            <button 
                                onClick={() => handleApplyConfig(activeWidget?.type || 'cashflow')} 
                                className="px-10 py-3 bg-indigo-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                Commit to Deck
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
