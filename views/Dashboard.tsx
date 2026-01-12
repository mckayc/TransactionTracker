import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, SavedReport, TaskItem, FinancialGoal, SystemSettings, DashboardWidget, Category, AmazonMetric, YouTubeMetric, FinancialPlan, DashboardLayout, Counterparty, Account, Tag, TransactionType, User, JoinedMetric } from '../types';
import { AddIcon, SettingsIcon, CloseIcon, ChartPieIcon, ChecklistIcon, LightBulbIcon, TrendingUpIcon, ChevronLeftIcon, ChevronRightIcon, BoxIcon, YoutubeIcon, DollarSign, SparklesIcon, ShieldCheckIcon, CalendarIcon, RobotIcon, BarChartIcon, InfoIcon, TrashIcon, CheckCircleIcon, ChevronDownIcon, RepeatIcon, EyeIcon, EyeSlashIcon, VideoIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import ConfirmationModal from '../components/ConfirmationModal';

// New Modular Widget Imports
import { CashFlowWidget } from '../components/dashboard/CashFlowWidget';
import { ComparisonWidget } from '../components/dashboard/ComparisonWidget';
import { GoalGaugeWidget } from '../components/dashboard/GoalGaugeWidget';
import { TaxProjectionWidget } from '../components/dashboard/TaxProjectionWidget';
import { AiInsightsWidget } from '../components/dashboard/AiInsightsWidget';
import { TopExpensesWidget } from '../components/dashboard/TopExpensesWidget';
import { AmazonSummaryWidget } from '../components/dashboard/AmazonSummaryWidget';
import { YouTubeSummaryWidget } from '../components/dashboard/YouTubeSummaryWidget';
import { VideoEarningsWidget } from '../components/dashboard/VideoEarningsWidget';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

interface WidgetSlotProps {
    widget: DashboardWidget;
    allWidgets: DashboardWidget[];
    onRemove: () => void;
    onConfigure: () => void;
    onDelete: () => void;
    onUpdateConfig: (newConfig: DashboardWidget['config']) => void;
    savedReports: SavedReport[];
    transactions: Transaction[];
    tasks: TaskItem[];
    goals: FinancialGoal[];
    categories: Category[];
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
    financialPlan: FinancialPlan | null;
    counterparties: Counterparty[];
    accounts: Account[];
    tags: Tag[];
    transactionTypes: TransactionType[];
    users: User[];
    joinedMetrics: JoinedMetric[];
}

const WidgetSlot: React.FC<WidgetSlotProps> = ({ widget, allWidgets, onRemove, onConfigure, onDelete, onUpdateConfig, savedReports, transactions, tasks, goals, categories, amazonMetrics, youtubeMetrics, financialPlan, counterparties, accounts, tags, transactionTypes, users, joinedMetrics }) => {
    
    const COMPONENT_IDENTITY_MAP: Record<string, { icon: React.ReactNode, label: string }> = {
        'cashflow': { icon: <DollarSign className="w-4 h-4" />, label: 'Cash Flow' },
        'goal_gauge': { icon: <ShieldCheckIcon className="w-4 h-4" />, label: 'Goal Progress' },
        'tax_projection': { icon: <CalendarIcon className="w-4 h-4" />, label: 'Tax Estimator' },
        'ai_insights': { icon: <SparklesIcon className="w-4 h-4" />, label: 'AI Strategy' },
        'top_expenses': { icon: <ChartPieIcon className="w-4 h-4" />, label: 'Expense Matrix' },
        'tasks': { icon: <ChecklistIcon className="w-4 h-4" />, label: 'Action Queue' },
        'amazon_summary': { icon: <BoxIcon className="w-4 h-4" />, label: 'Amazon Yield' },
        'youtube_summary': { icon: <YoutubeIcon className="w-4 h-4" />, label: 'YouTube ROI' },
        'report': { icon: <BarChartIcon className="w-4 h-4" />, label: 'Report Pivot' },
        'comparison': { icon: <RepeatIcon className="w-4 h-4" />, label: 'Variance Audit' },
        'video_earnings': { icon: <VideoIcon className="w-4 h-4" />, label: 'Video Yield Matrix' }
    };

    const identity = COMPONENT_IDENTITY_MAP[widget.type] || { icon: <InfoIcon className="w-4 h-4" />, label: 'Module' };
    const isHidden = widget.config?.isHidden;

    const handleToggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateConfig({
            ...(widget.config || {}),
            isHidden: !isHidden
        });
    };

    const renderContent = () => {
        if (widget.type === 'report' && widget.config?.reportId) {
            const report = savedReports.find(r => r.id === widget.config?.reportId);
            if (!report) return <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50/50"><BarChartIcon className="w-10 h-10 mb-2 opacity-10" /><p className="text-xs uppercase font-black">Report Missing</p></div>;
            return <div className="h-full flex-1 p-8 flex flex-col items-center justify-center text-center bg-white"><ChartPieIcon className="w-12 h-12 text-indigo-50 mb-3" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Analysis</p><p className="text-xs text-slate-500 mt-2 font-medium">Synced to "{report.name}"</p></div>;
        }
        if (widget.type === 'tasks') {
            const active = tasks.filter(t => !t.isCompleted).slice(0, 5);
            return (
                <div className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                    {active.length === 0 ? (<div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50 italic text-xs"><p>All systems clear.</p></div>
                    ) : active.map(t => (
                        <div key={t.id} className="text-[11px] p-2 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                            <span className="truncate flex-1 font-medium">{t.title}</span>
                        </div>
                    ))}
                </div>
            );
        }
        if (widget.type === 'cashflow') return (
            <CashFlowWidget 
                widget={widget} 
                transactions={transactions} 
                categories={categories} 
                counterparties={counterparties} 
                accounts={accounts} 
                transactionTypes={transactionTypes} 
                users={users} 
                onUpdateConfig={onUpdateConfig} 
            />
        );
        if (widget.type === 'comparison') return (
            <ComparisonWidget 
                widget={widget} 
                allWidgets={allWidgets} 
                transactions={transactions} 
                categories={categories} 
                counterparties={counterparties} 
                accounts={accounts} 
                transactionTypes={transactionTypes} 
            />
        );
        if (widget.type === 'video_earnings') return <VideoEarningsWidget metrics={joinedMetrics} config={widget.config} />;
        if (widget.type === 'top_expenses') return <TopExpensesWidget transactions={transactions} categories={categories} />;
        if (widget.type === 'amazon_summary') return <AmazonSummaryWidget metrics={amazonMetrics} />;
        if (widget.type === 'youtube_summary') return <YouTubeSummaryWidget metrics={youtubeMetrics} />;
        if (widget.type === 'goal_gauge') return <GoalGaugeWidget goals={goals} config={widget.config} />;
        if (widget.type === 'tax_projection') return <TaxProjectionWidget transactions={transactions} />;
        if (widget.type === 'ai_insights') return <AiInsightsWidget plan={financialPlan} />;
        return null;
    };

    const spanClass = widget.colSpan === 3 ? 'md:col-span-3' : widget.colSpan === 2 ? 'md:col-span-2' : 'md:col-span-1';

    return (
        <div className={`bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden group flex flex-col h-full transition-all hover:shadow-md ${spanClass} ${isHidden ? 'min-h-[72px] h-auto' : 'min-h-[300px]'}`}>
            <header className={`p-4 flex justify-between items-center flex-shrink-0 transition-colors ${isHidden ? 'bg-slate-100' : 'bg-slate-50/50 border-b border-slate-100'}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="text-indigo-600 flex-shrink-0">{identity.icon}</div>
                    <h4 className={`text-xs font-black uppercase tracking-tight truncate ${isHidden ? 'text-slate-400' : 'text-slate-800'}`}>
                        {widget.config?.title || identity.label}
                    </h4>
                </div>
                <div className={`flex items-center gap-1.5 transition-opacity ${isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button onClick={handleToggleVisibility} title={isHidden ? "Unhide Module" : "Hide Module"} className={`p-1.5 transition-colors ${isHidden ? 'text-indigo-600 hover:text-indigo-800' : 'text-slate-400 hover:text-indigo-600'}`}>
                        {isHidden ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={onConfigure} title="Instance Settings" className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><SettingsIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={onRemove} title="Remove from Dashboard" className="p-1.5 text-slate-400 hover:text-orange-600 transition-colors"><CloseIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={onDelete} title="Purge Logical Config" className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
            </header>
            {!isHidden && (
                <div className="flex-1 min-h-0">
                    {renderContent()}
                </div>
            )}
        </div>
    );
};

// Added missing DashboardProps interface
interface DashboardProps {
    transactions: Transaction[];
    savedReports: SavedReport[];
    tasks: TaskItem[];
    goals: FinancialGoal[];
    systemSettings: SystemSettings;
    onUpdateSystemSettings: (settings: SystemSettings) => void;
    categories: Category[];
    counterparties: Counterparty[];
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
    financialPlan: FinancialPlan | null;
    accounts: Account[];
    tags: Tag[];
    transactionTypes: TransactionType[];
    users: User[];
    joinedMetrics: JoinedMetric[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, savedReports, tasks, goals, systemSettings, onUpdateSystemSettings, categories, counterparties, amazonMetrics, youtubeMetrics, financialPlan, accounts, tags, transactionTypes, users, joinedMetrics }) => {
    const [isConfiguring, setIsConfiguring] = useState<string | null>(null);
    const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
    const [newDashboardName, setNewDashboardName] = useState('');
    const [newDashboardCols, setNewDashboardCols] = useState<1 | 2 | 3 | 4>(3);
    
    const [pendingDeletion, setPendingDeletion] = useState<{ id: string, type: 'widget' | 'dashboard' } | null>(null);

    const [configTitle, setConfigTitle] = useState('');
    const [configGoalId, setConfigGoalId] = useState('');
    const [configReportId, setConfigReportId] = useState('');
    const [configComparisonBaseId, setConfigComparisonBaseId] = useState('');
    const [configComparisonTargetId, setConfigComparisonTargetId] = useState('');
    const [configPeriod, setConfigPeriod] = useState<NonNullable<DashboardWidget['config']>['period']>('month');
    const [configColSpan, setConfigColSpan] = useState<1 | 2 | 3>(1);
    const [configBlueprint, setConfigBlueprint] = useState<DashboardWidget['type']>('cashflow');
    const [expandedBlueprints, setExpandedBlueprints] = useState<Set<string>>(new Set());

    const [configVizType, setConfigVizType] = useState<'pie' | 'bar' | 'cards'>('cards');
    const [configPieStyle, setConfigPieStyle] = useState<NonNullable<DashboardWidget['config']>['pieStyle']>('standard');
    const [configLookback, setConfigLookback] = useState<number>(0);
    const [configDisplayDataType, setConfigDisplayDataType] = useState<NonNullable<DashboardWidget['config']>['displayDataType']>('type');
    const [configExcludeKeywords, setConfigExcludeKeywords] = useState<string>('');
    const [configExcludeUnknown, setConfigExcludeUnknown] = useState(true);
    const [configShowIncome, setConfigShowIncome] = useState(true);
    const [configShowExpenses, setConfigShowExpenses] = useState(true);
    const [configShowInvestments, setConfigShowInvestments] = useState(true);
    const [configShowDonations, setConfigShowDonations] = useState(true);
    
    const [configVideoCount, setConfigVideoCount] = useState(10);
    const [configPublishYear, setConfigPublishYear] = useState('all');
    const [configReportYear, setConfigReportYear] = useState('all');

    const availableYears = useMemo(() => {
        const publishYears = new Set<string>();
        const reportYears = new Set<string>();
        joinedMetrics.forEach(m => {
            if (m.publishDate) publishYears.add(m.publishDate.substring(0, 4));
            if (m.reportYear) reportYears.add(m.reportYear);
        });
        return {
            publish: Array.from(publishYears).sort().reverse(),
            report: Array.from(reportYears).sort().reverse()
        };
    }, [joinedMetrics]);

    const dashboards = useMemo(() => {
        if (!systemSettings.dashboards || systemSettings.dashboards.length === 0) {
            const defaultDash: DashboardLayout = {
                id: 'dash_default',
                name: 'Overview',
                columns: 3,
                widgets: systemSettings.dashboardWidgets || []
            };
            return [defaultDash];
        }
        return systemSettings.dashboards;
    }, [systemSettings]);

    const widgetLibrary = useMemo(() => systemSettings.widgetLibrary || [], [systemSettings]);

    const activeDashboardId = systemSettings.activeDashboardId || dashboards[0]?.id;
    const activeDashboard = useMemo(() => dashboards.find(d => d.id === activeDashboardId) || dashboards[0], [dashboards, activeDashboardId]);
    const widgets = activeDashboard?.widgets || [];

    const activeWidget = useMemo(() => {
        if (!isConfiguring) return null;
        const onDashboard = widgets.find(w => w.id === isConfiguring);
        if (onDashboard) return onDashboard;
        return widgetLibrary.find(w => w.id === isConfiguring);
    }, [isConfiguring, widgets, widgetLibrary]);

    useEffect(() => {
        if (activeWidget) {
            setConfigTitle(activeWidget.config?.title || '');
            setConfigGoalId(activeWidget.config?.goalId || goals[0]?.id || '');
            setConfigReportId(activeWidget.config?.reportId || savedReports[0]?.id || '');
            setConfigComparisonBaseId(activeWidget.config?.comparisonBaseId || '');
            setConfigComparisonTargetId(activeWidget.config?.comparisonTargetId || '');
            setConfigPeriod(activeWidget.config?.period || 'month');
            setConfigColSpan(activeWidget.colSpan || 1);
            setConfigBlueprint(activeWidget.type);
            setConfigVizType(activeWidget.config?.vizType || 'cards');
            setConfigPieStyle(activeWidget.config?.pieStyle || 'standard');
            setConfigLookback(activeWidget.config?.lookback || 0);
            setConfigDisplayDataType(activeWidget.config?.displayDataType || 'type');
            setConfigExcludeKeywords(activeWidget.config?.excludeKeywords || '');
            setConfigExcludeUnknown(activeWidget.config?.excludeUnknown !== false);
            setConfigShowIncome(activeWidget.config?.showIncome !== false);
            setConfigShowExpenses(activeWidget.config?.showExpenses !== false);
            setConfigShowInvestments(activeWidget.config?.showInvestments !== false);
            setConfigShowDonations(activeWidget.config?.showDonations !== false);
            setConfigVideoCount(activeWidget.config?.videoCount || 10);
            setConfigPublishYear(activeWidget.config?.publishYear || 'all');
            setConfigReportYear(activeWidget.config?.reportYear || 'all');
        }
    }, [isConfiguring, activeWidget, goals, savedReports]);

    const removeWidgetFromDashboard = (id: string) => {
        const updatedDashboards = dashboards.map(d => 
            d.id === activeDashboardId ? { ...d, widgets: d.widgets.filter(w => w.id !== id) } : d
        );
        onUpdateSystemSettings({ ...systemSettings, dashboards: updatedDashboards });
    };

    const deleteWidgetPermanently = (id: string) => {
        setPendingDeletion({ id, type: 'widget' });
    };

    const handleDeleteDashboard = (id: string) => {
        if (dashboards.length <= 1) return;
        setPendingDeletion({ id, type: 'dashboard' });
    };

    const confirmDeletion = () => {
        if (!pendingDeletion) return;
        const { id, type } = pendingDeletion;

        if (type === 'widget') {
            const updatedLibrary = widgetLibrary.filter(w => w.id !== id);
            const updatedDashboards = dashboards.map(d => ({
                ...d,
                widgets: d.widgets.filter(w => w.id !== id)
            }));
            onUpdateSystemSettings({ ...systemSettings, widgetLibrary: updatedLibrary, dashboards: updatedDashboards });
            if (isConfiguring === id) setIsConfiguring(null);
        } else {
            const next = dashboards.filter(d => d.id !== id);
            onUpdateSystemSettings({
                ...systemSettings,
                dashboards: next,
                activeDashboardId: next[0].id
            });
        }
        setPendingDeletion(null);
    };

    const handleApplyConfig = () => {
        if (!isConfiguring) return;
        
        const newWidget: DashboardWidget = {
            id: isConfiguring.startsWith('fresh_') ? generateUUID() : isConfiguring,
            type: configBlueprint,
            colSpan: configColSpan,
            config: {
                ...activeWidget?.config,
                title: configTitle,
                goalId: configBlueprint === 'goal_gauge' ? configGoalId : undefined,
                reportId: configBlueprint === 'report' ? configReportId : undefined,
                comparisonBaseId: configBlueprint === 'comparison' ? configComparisonBaseId : undefined,
                comparisonTargetId: configBlueprint === 'comparison' ? configComparisonTargetId : undefined,
                period: configBlueprint === 'cashflow' ? configPeriod : undefined,
                vizType: configBlueprint === 'cashflow' ? configVizType : undefined,
                pieStyle: configBlueprint === 'cashflow' ? configPieStyle : undefined,
                lookback: configBlueprint === 'cashflow' ? configLookback : undefined,
                displayDataType: configBlueprint === 'cashflow' ? configDisplayDataType : undefined,
                excludeKeywords: configBlueprint === 'cashflow' ? configExcludeKeywords : undefined,
                excludeUnknown: configBlueprint === 'cashflow' ? configExcludeUnknown : undefined,
                showIncome: configBlueprint === 'cashflow' ? configShowIncome : undefined,
                showExpenses: configBlueprint === 'cashflow' ? configShowExpenses : undefined,
                showInvestments: configBlueprint === 'cashflow' ? configShowInvestments : undefined,
                showDonations: configBlueprint === 'cashflow' ? configShowDonations : undefined,
                videoCount: configBlueprint === 'video_earnings' ? configVideoCount : undefined,
                publishYear: configBlueprint === 'video_earnings' ? configPublishYear : undefined,
                reportYear: configBlueprint === 'video_earnings' ? configReportYear : undefined,
            }
        };

        const existingInLibrary = widgetLibrary.findIndex(w => w.id === newWidget.id);
        let nextLibrary = [...widgetLibrary];
        if (existingInLibrary > -1) nextLibrary[existingInLibrary] = newWidget;
        else nextLibrary.push(newWidget);

        const alreadyInDashboard = widgets.some(w => w.id === newWidget.id);
        const nextWidgets = alreadyInDashboard 
            ? widgets.map(w => w.id === newWidget.id ? newWidget : w)
            : [...widgets, newWidget];

        const updatedDashboards = dashboards.map(d => 
            d.id === activeDashboardId ? { ...d, widgets: nextWidgets } : d
        );

        onUpdateSystemSettings({
            ...systemSettings,
            widgetLibrary: nextLibrary,
            dashboards: updatedDashboards
        });
        setIsConfiguring(null);
    };

    const handleUpdateWidgetConfig = (widgetId: string, newConfig: DashboardWidget['config']) => {
        const updatedDashboards = dashboards.map(d => {
            if (d.id === activeDashboardId) {
                return {
                    ...d,
                    widgets: d.widgets.map(w => w.id === widgetId ? { ...w, config: newConfig } : w)
                };
            }
            return d;
        });
        onUpdateSystemSettings({ ...systemSettings, dashboards: updatedDashboards });
    };

    const handleCreateDashboard = () => {
        if (!newDashboardName.trim()) return;
        const newDash: DashboardLayout = {
            id: generateUUID(),
            name: newDashboardName.trim(),
            columns: newDashboardCols,
            widgets: []
        };
        onUpdateSystemSettings({
            ...systemSettings,
            dashboards: [...dashboards, newDash],
            activeDashboardId: newDash.id
        });
        setNewDashboardName('');
        setIsCreatingDashboard(false);
    };

    const BLUEPRINT_OPTIONS = [
        { id: 'cashflow', label: 'Cash Flow', icon: <DollarSign className="w-4 h-4" /> },
        { id: 'video_earnings', label: 'Video Yield Matrix', icon: <VideoIcon className="w-4 h-4" /> },
        { id: 'comparison', label: 'Variance Audit', icon: <RepeatIcon className="w-4 h-4" /> },
        { id: 'goal_gauge', label: 'Goal Progress', icon: <ShieldCheckIcon className="w-4 h-4" /> },
        { id: 'tax_projection', label: 'Tax Estimator', icon: <CalendarIcon className="w-4 h-4" /> },
        { id: 'ai_insights', label: 'AI Strategy', icon: <SparklesIcon className="w-4 h-4" /> },
        { id: 'top_expenses', label: 'Expense Matrix', icon: <ChartPieIcon className="w-4 h-4" /> },
        { id: 'tasks', label: 'Action Queue', icon: <ChecklistIcon className="w-4 h-4" /> },
        { id: 'amazon_summary', label: 'Amazon Yield', icon: <BoxIcon className="w-4 h-4" /> },
        { id: 'youtube_summary', label: 'YouTube ROI', icon: <YoutubeIcon className="w-4 h-4" /> },
        { id: 'report', label: 'Report Pivot', icon: <BarChartIcon className="w-4 h-4" /> }
    ];

    const gridColsClass = activeDashboard?.columns === 4 ? 'md:grid-cols-4' : activeDashboard?.columns === 3 ? 'md:grid-cols-3' : activeDashboard?.columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';

    const availableCashflowWidgets = useMemo(() => {
        return widgetLibrary.filter(w => w.type === 'cashflow');
    }, [widgetLibrary]);

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
            
            <div className="flex flex-wrap items-center gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto no-scrollbar flex-shrink-0">
                {dashboards.map(d => (
                    <div key={d.id} className="flex items-center group relative">
                        <button 
                            onClick={() => onUpdateSystemSettings({ ...systemSettings, activeDashboardId: d.id })}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeDashboardId === d.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {d.name}
                        </button>
                        {dashboards.length > 1 && (
                            <button 
                                onClick={() => handleDeleteDashboard(d.id)}
                                className="absolute -top-1 -right-1 p-1 bg-white border border-slate-200 text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
                <button 
                    onClick={() => setIsCreatingDashboard(true)}
                    className="p-2.5 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-all border-2 border-dashed border-indigo-100"
                    title="Construct View"
                >
                    <AddIcon className="w-5 h-5" />
                </button>
            </div>

            <div className={`grid grid-cols-1 ${gridColsClass} gap-6 auto-rows-min`}>
                {widgets.map(w => (
                    <WidgetSlot 
                        key={w.id} 
                        widget={w} 
                        allWidgets={widgets}
                        onRemove={() => removeWidgetFromDashboard(w.id)} 
                        onConfigure={() => setIsConfiguring(w.id)}
                        onDelete={() => deleteWidgetPermanently(w.id)}
                        onUpdateConfig={(newConf) => handleUpdateWidgetConfig(w.id, newConf)}
                        savedReports={savedReports}
                        transactions={transactions}
                        tasks={tasks}
                        goals={goals}
                        categories={categories}
                        counterparties={counterparties}
                        amazonMetrics={amazonMetrics}
                        youtubeMetrics={youtubeMetrics}
                        financialPlan={financialPlan}
                        accounts={accounts}
                        tags={tags}
                        transactionTypes={transactionTypes}
                        users={users}
                        joinedMetrics={joinedMetrics}
                    />
                ))}
                
                <button 
                    onClick={() => setIsConfiguring(`fresh_${generateUUID()}`)} 
                    className="group bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-12 transition-all hover:bg-white hover:border-indigo-200 min-h-[300px]"
                >
                    <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <AddIcon className="w-8 h-8" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600">Deploy Module</span>
                </button>
            </div>

            {isCreatingDashboard && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800">Construct View</h3>
                            <button onClick={() => setIsCreatingDashboard(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">View Designation</label>
                                <input 
                                    type="text" 
                                    value={newDashboardName} 
                                    onChange={e => setNewDashboardName(e.target.value)} 
                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none mt-1" 
                                    placeholder="e.g. ROI Breakdown"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grid Density (Columns)</label>
                                <div className="grid grid-cols-4 gap-2 mt-1">
                                    {([1, 2, 3, 4] as const).map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => setNewDashboardCols(c)}
                                            className={`py-3 border-2 rounded-xl text-xs font-black transition-all ${newDashboardCols === c ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                                        >
                                            {c} Col
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setIsCreatingDashboard(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={handleCreateDashboard} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Deploy View</button>
                        </div>
                    </div>
                </div>
            )}

            {isConfiguring && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setIsConfiguring(null)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Modules</h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">System Library & Custom Blueprints</p>
                            </div>
                            <button onClick={() => setIsConfiguring(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        
                        <div className="flex flex-1 min-h-0">
                            <div className="w-72 bg-slate-50 border-r border-slate-100 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-1.5 flex-shrink-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Logical Blueprints</p>
                                {BLUEPRINT_OPTIONS.map(bp => {
                                    const isExpanded = expandedBlueprints.has(bp.id);
                                    const instances = widgetLibrary.filter(w => w.type === bp.id);
                                    
                                    return (
                                        <div key={bp.id} className="space-y-1">
                                            <div 
                                                onClick={() => {
                                                    setConfigBlueprint(bp.id as any);
                                                    setConfigTitle(bp.label);
                                                    const next = new Set(expandedBlueprints);
                                                    if(next.has(bp.id)) next.delete(bp.id); else next.add(bp.id);
                                                    setExpandedBlueprints(next);
                                                }}
                                                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-tight cursor-pointer transition-all ${configBlueprint === bp.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {bp.icon} <span>{bp.label}</span>
                                                </div>
                                                {instances.length > 0 && <div className={`text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}><ChevronDownIcon className="w-3 h-3" /></div>}
                                            </div>
                                            
                                            {isExpanded && instances.map(inst => (
                                                <div 
                                                    key={inst.id}
                                                    className={`ml-4 flex items-center justify-between group/inst p-2 pr-3 rounded-xl cursor-pointer transition-all border-2 ${isConfiguring === inst.id ? 'bg-white border-indigo-50 border-indigo-500 text-indigo-700' : 'border-transparent text-slate-400 hover:bg-white hover:text-slate-700'}`}
                                                    onClick={() => setIsConfiguring(inst.id)}
                                                >
                                                    <span className="text-[10px] font-bold uppercase truncate">{inst.config?.title || 'Untitled Config'}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover/inst:opacity-100">
                                                        <button onClick={(e) => { e.stopPropagation(); deleteWidgetPermanently(inst.id); }} className="p-1 hover:text-red-500"><TrashIcon className="w-3 h-3"/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-white">
                                <div className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Administrative Designation</label>
                                        <input 
                                            type="text" 
                                            value={configTitle} 
                                            onChange={e => setConfigTitle(e.target.value)} 
                                            className="w-full font-bold text-2xl p-4 border-b-2 border-slate-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-200" 
                                            placeholder="Instance Name..."
                                        />
                                    </div>
                                    
                                    {configBlueprint !== 'cashflow' && configBlueprint !== 'comparison' && (
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grid Footprint (Col Span)</label>
                                            <div className="flex gap-2">
                                                {[1, 2, 3].map(span => (
                                                    <button 
                                                        key={span}
                                                        onClick={() => setConfigColSpan(span as any)}
                                                        className={`flex-1 py-3 border-2 rounded-xl text-xs font-black transition-all ${configColSpan === span ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                                                    >
                                                        {span} Column{span > 1 ? 's' : ''}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {configBlueprint === 'comparison' && (
                                    <div className="space-y-10 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Base Ledger Logic (Period A)</label>
                                                <select 
                                                    value={configComparisonBaseId} 
                                                    onChange={e => setConfigComparisonBaseId(e.target.value)}
                                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none bg-white"
                                                >
                                                    <option value="">Select Module...</option>
                                                    {availableCashflowWidgets.map(w => (
                                                        <option key={w.id} value={w.id}>{w.config?.title || 'Untitled Cashflow'}</option>
                                                    ))}
                                                </select>
                                                <p className="text-[10px] text-slate-400 italic">This period acts as the denominator for variance calculations.</p>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Target Ledger Logic (Period B)</label>
                                                <select 
                                                    value={configComparisonTargetId} 
                                                    onChange={e => setConfigComparisonTargetId(e.target.value)}
                                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none bg-white"
                                                >
                                                    <option value="">Select Module...</option>
                                                    {availableCashflowWidgets.map(w => (
                                                        <option key={w.id} value={w.id}>{w.config?.title || 'Untitled Cashflow'}</option>
                                                    ))}
                                                </select>
                                                <p className="text-[10px] text-slate-400 italic">This period's performance is compared against the base.</p>
                                            </div>
                                        </div>
                                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-start gap-4">
                                            <RepeatIcon className="w-5 h-5 text-indigo-300 mt-0.5" />
                                            <p className="text-xs text-slate-400 leading-relaxed font-medium">The comparison engine automatically aligns categories and vendors across both modules. Ensure both base modules use the same "Display Dimension" for accurate results.</p>
                                        </div>
                                    </div>
                                )}

                                {configBlueprint === 'video_earnings' && (
                                    <div className="space-y-10 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Quantity</label>
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    max="50"
                                                    value={configVideoCount} 
                                                    onChange={e => setConfigVideoCount(parseInt(e.target.value) || 10)}
                                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black focus:border-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Creation/Publish Year</label>
                                                <select 
                                                    value={configPublishYear} 
                                                    onChange={e => setConfigPublishYear(e.target.value)}
                                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none bg-white"
                                                >
                                                    <option value="all">Show All Creation Years</option>
                                                    {availableYears.publish.map(y => <option key={y} value={y}>Born in {y}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Performance Report Year</label>
                                                <select 
                                                    value={configReportYear} 
                                                    onChange={e => setConfigReportYear(e.target.value)}
                                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none bg-white"
                                                >
                                                    <option value="all">Lifetime Performance</option>
                                                    {availableYears.report.map(y => <option key={y} value={y}>Earning in {y}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {configBlueprint === 'cashflow' && (
                                    <div className="space-y-10 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-6">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Visualization Interface</label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {(['cards', 'pie', 'bar'] as const).map(viz => (
                                                            <button 
                                                                key={viz}
                                                                onClick={() => setConfigVizType(viz)}
                                                                className={`p-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${configVizType === viz ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-500'}`}
                                                            >
                                                                {viz} View
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {configVizType === 'pie' && (
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chart Stylization</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {(['standard', 'magnified', 'labeled', 'callout'] as const).map(style => (
                                                                <button
                                                                    key={style}
                                                                    onClick={() => setConfigPieStyle(style)}
                                                                    className={`p-3 rounded-xl border-2 font-bold text-xs capitalize transition-all ${configPieStyle === style ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                                                                >
                                                                    {style}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observation Epoch</label>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {(['day', 'week', 'month', 'quarter', 'year', 'custom'] as const).map(p => (
                                                                <button 
                                                                    key={p} 
                                                                    onClick={() => setConfigPeriod(p)}
                                                                    className={`py-3 rounded-xl border-2 font-bold text-xs transition-all ${configPeriod === p ? 'bg-white border-indigo-50 text-indigo-700 shadow-sm' : 'bg-transparent border-slate-200 text-slate-400'}`}
                                                                >
                                                                    {p}ly
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lookback Units</label>
                                                        <div className="flex items-center gap-4">
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                value={configLookback}
                                                                onChange={e => setConfigLookback(parseInt(e.target.value) || 0)}
                                                                className="w-24 p-3 border-2 border-slate-100 rounded-xl font-bold focus:border-indigo-500 outline-none"
                                                            />
                                                            <p className="text-[10px] text-slate-400 font-medium italic">
                                                                {configLookback === 0 ? `Current ${configPeriod}` : `${configLookback} ${configPeriod}(s) ago`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Visibility Filters</label>
                                                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
                                                        <label className="flex items-center gap-2 cursor-pointer group">
                                                            <input type="checkbox" checked={configShowIncome} onChange={e => setConfigShowIncome(e.target.checked)} className="rounded text-emerald-600" />
                                                            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800">Show Inflow</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer group">
                                                            <input type="checkbox" checked={configShowExpenses} onChange={e => setConfigShowExpenses(e.target.checked)} className="rounded text-rose-600" />
                                                            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800">Show Outflow</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer group">
                                                            <input type="checkbox" checked={configShowInvestments} onChange={e => setConfigShowInvestments(e.target.checked)} className="rounded text-purple-600" />
                                                            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800">Investments</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer group">
                                                            <input type="checkbox" checked={configShowDonations} onChange={e => setConfigShowDonations(e.target.checked)} className="rounded text-pink-600" />
                                                            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800">Donations</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logic Filtering</label>
                                                    <div className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
                                                        <label className="flex items-center gap-2 cursor-pointer group">
                                                            <input type="checkbox" checked={configExcludeUnknown} onChange={e => setConfigExcludeUnknown(e.target.checked)} className="rounded text-indigo-600" />
                                                            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800">Exclude Unknown / Unallocated</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Display Dimension</label>
                                                    <select 
                                                        value={configDisplayDataType} 
                                                        onChange={e => setConfigDisplayDataType(e.target.value as any)}
                                                        className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none bg-white"
                                                    >
                                                        <option value="type">Transaction Type</option>
                                                        <option value="category">Category Hierarchy</option>
                                                        <option value="counterparty">Counterparty / Vendor</option>
                                                        <option value="account">Target Ledger Account</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exclusion Keywords (Comma Separated)</label>
                                                    <input 
                                                        type="text" 
                                                        value={configExcludeKeywords} 
                                                        onChange={e => setConfigExcludeKeywords(e.target.value)} 
                                                        placeholder="e.g. tiktok, youtube, transfer"
                                                        className="w-full p-4 border-2 border-slate-100 rounded-2xl font-medium focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {configBlueprint === 'goal_gauge' && (
                                    <div className="space-y-3 animate-fade-in">
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Registry Objective</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {goals.map(g => (
                                                <button 
                                                    key={g.id} 
                                                    onClick={() => setConfigGoalId(g.id)}
                                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${configGoalId === g.id ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-transparent hover:border-indigo-200'}`}
                                                >
                                                    <p className="font-bold text-slate-800">{g.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{formatCurrency(g.targetAmount)} Target</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {configBlueprint === 'report' && (
                                    <div className="space-y-3 animate-fade-in">
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Strategic Analytical Lens</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {savedReports.map(r => (
                                                <button 
                                                    key={r.id} 
                                                    onClick={() => setConfigReportId(r.id)}
                                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${configReportId === r.id ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-transparent hover:border-indigo-200'}`}
                                                >
                                                    <p className="font-bold text-slate-800">{r.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{r.config.groupBy} Pivot</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-start gap-4">
                                    <InfoIcon className="w-5 h-5 text-indigo-300 mt-0.5" />
                                    <p className="text-xs text-slate-400 leading-relaxed font-medium">Configurations are committed to your system library and can be deployed to any dashboard view.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white flex-shrink-0">
                            <button onClick={() => setIsConfiguring(null)} className="px-6 py-3 text-sm font-black uppercase text-slate-400 hover:bg-slate-100 rounded-2xl transition-all">Discard</button>
                            <button 
                                onClick={handleApplyConfig} 
                                className="px-10 py-4 bg-indigo-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <CheckCircleIcon className="w-4 h-4" /> Commit to Deck
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal 
                isOpen={!!pendingDeletion}
                onClose={() => setPendingDeletion(null)}
                onConfirm={confirmDeletion}
                title={pendingDeletion?.type === 'widget' ? "Purge Configuration?" : "Delete Dashboard View?"}
                message={pendingDeletion?.type === 'widget' 
                    ? "This will permanently remove this module configuration from your system library and all associated dashboards."
                    : "This will permanently delete this dashboard layout and all of its module placements."}
                confirmLabel="Execute Delete"
                variant="danger"
            />
        </div>
    );
};

export default Dashboard;