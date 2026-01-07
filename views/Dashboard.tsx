import React, { useState, useMemo } from 'react';
import type { Transaction, SavedReport, TaskItem, FinancialGoal, SystemSettings, DashboardWidget } from '../types';
import { AddIcon, SettingsIcon, CloseIcon, ChartPieIcon, ChecklistIcon, LightBulbIcon, TrendingUpIcon } from '../components/Icons';
import ReportColumn from '../components/ReportColumn';
import { generateUUID } from '../utils';

interface DashboardProps {
    transactions: Transaction[];
    savedReports: SavedReport[];
    tasks: TaskItem[];
    goals: FinancialGoal[];
    systemSettings: SystemSettings;
    onUpdateSystemSettings: (s: SystemSettings) => void;
}

const WidgetSlot: React.FC<{
    widget: DashboardWidget;
    onRemove: () => void;
    onConfigure: () => void;
    savedReports: SavedReport[];
    transactions: Transaction[];
    tasks: TaskItem[];
    goals: FinancialGoal[];
}> = ({ widget, onRemove, onConfigure, savedReports, transactions, tasks, goals }) => {
    
    const renderContent = () => {
        if (widget.type === 'report' && widget.config) {
            const report = savedReports.find(r => r.id === widget.config);
            if (!report) return <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center"><p className="text-sm">Report not found.</p></div>;
            
            return (
                <div className="h-[400px]">
                   {/* Simplified Report View for Dashboard */}
                   <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 truncate">{report.name}</h4>
                   </div>
                   <div className="p-4 flex flex-col items-center justify-center h-[340px]">
                        <ChartPieIcon className="w-12 h-12 text-indigo-100 mb-2" />
                        <p className="text-xs text-slate-400">Preview of report data goes here.</p>
                   </div>
                </div>
            );
        }

        if (widget.type === 'tasks') {
            const active = tasks.filter(t => !t.isCompleted).slice(0, 5);
            return (
                <div className="p-6 space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><ChecklistIcon className="w-5 h-5 text-indigo-500" /> Pending Tasks</h4>
                    <div className="space-y-2">
                        {active.map(t => (
                            <div key={t.id} className="text-sm p-2 bg-slate-50 rounded border border-slate-100 flex justify-between items-center">
                                <span className="truncate flex-1">{t.title}</span>
                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ml-2 ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{t.priority}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-[200px] text-slate-400 p-8 text-center">
                <SettingsIcon className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">Empty Slot</p>
                <button onClick={onConfigure} className="mt-3 text-xs font-bold text-indigo-600 uppercase hover:underline">Configure</button>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group relative">
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={onConfigure} className="p-1.5 bg-white/80 backdrop-blur border rounded-lg text-slate-500 hover:text-indigo-600 shadow-sm"><SettingsIcon className="w-3.5 h-3.5"/></button>
                <button onClick={onRemove} className="p-1.5 bg-white/80 backdrop-blur border rounded-lg text-slate-500 hover:text-red-600 shadow-sm"><CloseIcon className="w-3.5 h-3.5"/></button>
            </div>
            {renderContent()}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, savedReports, tasks, goals, systemSettings, onUpdateSystemSettings }) => {
    const [isConfiguring, setIsConfiguring] = useState<string | null>(null);

    const widgets = systemSettings.dashboardWidgets || [];

    const addWidget = () => {
        const newWidget: DashboardWidget = { id: generateUUID(), type: 'metric' };
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
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Personal Command</h1>
                    <p className="text-sm text-slate-500">Your financial universe at a glance.</p>
                </div>
                <button onClick={addWidget} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">
                    <AddIcon className="w-5 h-5" /> Add Module
                </button>
            </div>

            {widgets.length === 0 ? (
                <div className="bg-white p-20 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUpIcon className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Your Dashboard is Blank</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Add modules to track your spending, goals, or upcoming tasks.</p>
                    <button onClick={addWidget} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl">Build My View</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        />
                    ))}
                </div>
            )}

            {isConfiguring && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 flex flex-col gap-6 animate-slide-up">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Configure Module</h3>
                            <button onClick={() => setIsConfiguring(null)} className="p-1 hover:bg-slate-100 rounded-full"><CloseIcon className="w-6 h-6"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Select Module Type</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => configureWidget(isConfiguring, 'tasks')} className="p-4 border-2 rounded-2xl hover:border-indigo-600 text-left transition-all group">
                                    <ChecklistIcon className="w-6 h-6 text-indigo-500 mb-2" />
                                    <p className="font-bold">Pending Tasks</p>
                                    <p className="text-[10px] text-slate-400">Next 5 actions</p>
                                </button>
                                <button onClick={() => configureWidget(isConfiguring, 'calendar')} className="p-4 border-2 rounded-2xl hover:border-indigo-600 text-left transition-all">
                                    <TrendingUpIcon className="w-6 h-6 text-emerald-500 mb-2" />
                                    <p className="font-bold">Net Worth</p>
                                    <p className="text-[10px] text-slate-400">Balance across accounts</p>
                                </button>
                            </div>

                            {savedReports.length > 0 && (
                                <div className="space-y-3 pt-4 border-t">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Embed Saved Report</label>
                                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                                        {savedReports.map(r => (
                                            <button 
                                                key={r.id} 
                                                onClick={() => configureWidget(isConfiguring, 'report', r.id)}
                                                className="p-3 bg-slate-50 border rounded-xl hover:border-indigo-500 text-left font-bold text-sm text-slate-700"
                                            >
                                                {r.name}
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