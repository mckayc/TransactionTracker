
import React, { useState, useMemo } from 'react';
import type { FinancialGoal, FinancialPlan, Transaction, Category, TaskItem } from '../types';
import { LightBulbIcon, SparklesIcon, CheckCircleIcon, AddIcon, DeleteIcon, EditIcon, CurrencyDollarIcon, HeartIcon, CloseIcon, TrendingUpIcon, CalendarIcon, RobotIcon, ExclamationTriangleIcon, RepeatIcon, ChecklistIcon, ArrowRightIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { hasApiKey, generateFinancialStrategy } from '../services/geminiService';

interface FinancialPlanPageProps {
    transactions: Transaction[];
    goals: FinancialGoal[];
    onSaveGoals: (goals: FinancialGoal[]) => void;
    plan: FinancialPlan | null;
    onSavePlan: (plan: FinancialPlan | null) => void;
    categories: Category[];
    onSaveTask?: (task: TaskItem) => void;
}

const GoalCard: React.FC<{ goal: FinancialGoal; onEdit: (g: FinancialGoal) => void; onDelete: (id: string) => void }> = ({ goal, onEdit, onDelete }) => {
    const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">{goal.title}</h3>
                    <p className="text-[10px] text-indigo-500 uppercase font-black tracking-widest mt-0.5">{goal.type.replace('_', ' ')}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(goal)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50 transition-colors"><EditIcon className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(goal.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-50 transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                </div>
            </div>
            
            <div className="space-y-3 relative z-10">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-bold">{formatCurrency(goal.currentAmount)}</span>
                    <span className="text-slate-400 font-medium">Target: {formatCurrency(goal.targetAmount)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${progress === 100 ? 'bg-green-500' : 'bg-indigo-600'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between items-center pt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${progress === 100 ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {progress.toFixed(0)}% REACHED
                    </span>
                    {goal.targetDate && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(goal.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Background Decoration */}
            <div className="absolute -bottom-2 -right-2 opacity-[0.03] pointer-events-none transition-transform group-hover:scale-110">
                <CurrencyDollarIcon className="w-24 h-24 text-indigo-900" />
            </div>
        </div>
    );
};

const FinancialPlanPage: React.FC<FinancialPlanPageProps> = ({ transactions, goals, onSaveGoals, plan, onSavePlan, categories, onSaveTask }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

    // Goal Form State
    const [goalTitle, setGoalTitle] = useState('');
    const [goalTarget, setGoalTarget] = useState(0);
    const [goalCurrent, setGoalCurrent] = useState(0);
    const [goalType, setGoalType] = useState<FinancialGoal['type']>('emergency_fund');
    const [goalDate, setGoalDate] = useState('');

    const apiKeyAvailable = hasApiKey();
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

    const handleOpenGoalModal = (g?: FinancialGoal) => {
        if (g) {
            setEditingGoal(g);
            setGoalTitle(g.title);
            setGoalTarget(g.targetAmount);
            setGoalCurrent(g.currentAmount);
            setGoalType(g.type);
            setGoalDate(g.targetDate || '');
        } else {
            setEditingGoal(null);
            setGoalTitle('');
            setGoalTarget(0);
            setGoalCurrent(0);
            setGoalType('emergency_fund');
            setGoalDate('');
        }
        setIsGoalModalOpen(true);
    };

    const handleSaveGoal = (e: React.FormEvent) => {
        e.preventDefault();
        const newGoal: FinancialGoal = {
            id: editingGoal?.id || generateUUID(),
            title: goalTitle,
            targetAmount: goalTarget,
            currentAmount: goalCurrent,
            type: goalType,
            targetDate: goalDate || undefined
        };

        if (editingGoal) {
            onSaveGoals(goals.map(g => g.id === editingGoal.id ? newGoal : g));
        } else {
            onSaveGoals([...goals, newGoal]);
        }
        setIsGoalModalOpen(false);
    };

    const handleDeleteGoal = (id: string) => {
        if (confirm("Permanently remove this goal?")) {
            onSaveGoals(goals.filter(g => g.id !== id));
        }
    };

    const handleGenerateStrategy = async () => {
        if (!apiKeyAvailable) return;
        setIsGenerating(true);
        try {
            const results = await generateFinancialStrategy(transactions, goals, categories);
            onSavePlan(results);
        } catch (e) {
            console.error(e);
            alert("AI generation failed. Please ensure your API key is configured correctly.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddTaskFromPlan = (taskSuggestion: { title: string, description: string, priority: string }) => {
        if (!onSaveTask) return;
        
        const newTask: TaskItem = {
            id: generateUUID(),
            title: taskSuggestion.title,
            description: taskSuggestion.description,
            priority: (taskSuggestion.priority as any) || 'medium',
            isCompleted: false,
            createdAt: new Date().toISOString(),
            subtasks: []
        };
        
        onSaveTask(newTask);
        alert(`"${taskSuggestion.title}" added to your Tasks!`);
    };

    return (
        <div className="space-y-8 h-full flex flex-col max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <TrendingUpIcon className="w-8 h-8 text-indigo-600" />
                        Wealth Planner
                    </h1>
                    <p className="text-slate-500 mt-1">Combine your patterns with AI for personalized wealth guidance.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleOpenGoalModal()}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold shadow-sm transition-all"
                    >
                        <AddIcon className="w-5 h-5"/> New Goal
                    </button>
                    <button 
                        onClick={handleGenerateStrategy}
                        disabled={isGenerating || !apiKeyAvailable || goals.length === 0}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <RepeatIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                        {plan ? 'Refresh Strategy' : 'Generate Strategy'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-10 pr-2 custom-scrollbar pb-20">
                {/* Goals Section */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <CheckCircleIcon className="w-6 h-6 text-green-500" />
                            <h2 className="text-xl font-bold text-slate-700">Financial Targets</h2>
                        </div>
                    </div>
                    {goals.length === 0 ? (
                        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CurrencyDollarIcon className="w-10 h-10 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Your future starts here</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8">Define what you're working towards. Emergency funds, retirement, or that dream home.</p>
                            <button onClick={() => handleOpenGoalModal()} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all">Define My First Goal</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {goals.map(goal => (
                                <GoalCard key={goal.id} goal={goal} onEdit={handleOpenGoalModal} onDelete={handleDeleteGoal} />
                            ))}
                        </div>
                    )}
                </section>

                {!plan && !isGenerating && apiKeyAvailable && goals.length > 0 && (
                    <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-10 text-center space-y-4">
                        <RobotIcon className="w-12 h-12 text-indigo-400 mx-auto" />
                        <h3 className="text-2xl font-black text-indigo-900">Ready to Analyze?</h3>
                        <p className="text-indigo-700 max-w-md mx-auto">Your spending patterns and goals are ready. I can generate a tailored roadmap to help you hit your targets faster.</p>
                        <button onClick={handleGenerateStrategy} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all">Create My AI Roadmap</button>
                    </div>
                )}

                {isGenerating && (
                    <div className="bg-slate-900 rounded-[2.5rem] p-16 text-center text-white space-y-6">
                        <div className="relative w-20 h-20 mx-auto">
                            <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-2xl font-black">Synthesizing Your Wealth Strategy</h3>
                        <p className="text-indigo-300 max-w-sm mx-auto">Reviewing categories, calculating velocity, and prioritizing goals...</p>
                    </div>
                )}

                {plan && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in">
                        {/* Main Strategy Text */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-white rounded-[2rem] p-8 md:p-10 border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                    <LightBulbIcon className="w-48 h-48 text-indigo-900" />
                                </div>
                                
                                <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-6">
                                    <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                                        <SparklesIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-800">AI Wealth Roadmap</h2>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generated {new Date(plan.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div className="prose prose-indigo max-w-none">
                                    <div className="space-y-6 text-slate-700 leading-relaxed font-medium">
                                        {plan.strategy.split('\n').map((line, idx) => {
                                            if (line.startsWith('#')) {
                                                return <h3 key={idx} className="text-xl font-bold text-slate-900 pt-4 pb-2 border-b border-slate-100 uppercase tracking-wide">{line.replace(/#/g, '').trim()}</h3>;
                                            }
                                            if (line.startsWith('-') || line.startsWith('*')) {
                                                return <div key={idx} className="flex gap-3 pl-2"><span className="text-indigo-600 font-bold">•</span><span>{line.substring(1).trim()}</span></div>;
                                            }
                                            return <p key={idx} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-600">$1</strong>') }} />;
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar: Budgets & Tasks */}
                        <div className="space-y-8">
                            {/* Priority Tasks */}
                            {plan.priorityTasks && plan.priorityTasks.length > 0 && (
                                <section className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
                                    <div className="flex items-center gap-2 mb-6">
                                        <ChecklistIcon className="w-5 h-5 text-indigo-400" />
                                        <h3 className="font-bold uppercase tracking-widest text-xs text-indigo-300">Priority Actions</h3>
                                    </div>
                                    <div className="space-y-4">
                                        {plan.priorityTasks.map((t, i) => (
                                            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${t.priority === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20'}`}>{t.priority}</span>
                                                    <button 
                                                        onClick={() => handleAddTaskFromPlan(t as any)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 bg-white/10 rounded-md text-indigo-300 hover:text-white transition-all"
                                                        title="Add to My Tasks"
                                                    >
                                                        <AddIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <h4 className="font-bold text-sm leading-tight mb-1">{t.title}</h4>
                                                <p className="text-xs text-slate-400 leading-normal">{t.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Suggested Budgets */}
                            {plan.suggestedBudgets && plan.suggestedBudgets.length > 0 && (
                                <section className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-6">
                                        <CalendarIcon className="w-5 h-5 text-green-600" />
                                        <h3 className="font-bold uppercase tracking-widest text-xs text-slate-400">Target Budgets</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {plan.suggestedBudgets.map((b, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-slate-700 truncate">{categoryMap.get(b.categoryId) || b.categoryId}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Monthly Limit</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-slate-900">${b.monthlyLimit.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-center mt-6 italic">Suggested monthly allocations to maximize savings velocity.</p>
                                </section>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Goal Modal */}
            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setIsGoalModalOpen(false)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800">{editingGoal ? 'Edit Target' : 'New Financial Target'}</h3>
                            <button onClick={() => setIsGoalModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-5 h-5 text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleSaveGoal} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Label</label>
                                <input type="text" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-800" placeholder="e.g. Dream House Fund" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Target Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input type="number" value={goalTarget} onChange={e => setGoalTarget(parseFloat(e.target.value))} className="w-full p-3 pl-7 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-mono font-bold" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Saved So Far</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input type="number" value={goalCurrent} onChange={e => setGoalCurrent(parseFloat(e.target.value))} className="w-full p-3 pl-7 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-mono font-bold" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Objective</label>
                                    <select value={goalType} onChange={e => setGoalType(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-700 bg-white">
                                        <option value="emergency_fund">Emergency Fund</option>
                                        <option value="debt_payoff">Debt Payoff</option>
                                        <option value="retirement">Retirement</option>
                                        <option value="savings">Wealth Building</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Target Date</label>
                                    <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-700" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-2xl transition-colors border-2 border-transparent">Cancel</button>
                                <button type="submit" className="flex-[2] px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">Save Goal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialPlanPage;
