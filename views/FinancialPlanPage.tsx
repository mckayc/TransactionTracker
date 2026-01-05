import React, { useState, useMemo } from 'react';
import type { FinancialGoal, FinancialPlan, Transaction, Category, BudgetLimit, WealthProjection } from '../types';
import { LightBulbIcon, SparklesIcon, CheckCircleIcon, AddIcon, DeleteIcon, EditIcon, CurrencyDollarIcon, HeartIcon, CloseIcon, TrendingUpIcon, CalendarIcon, RobotIcon, ExclamationTriangleIcon, RepeatIcon, BarChartIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { hasApiKey, generateFinancialStrategy } from '../services/geminiService';

interface FinancialPlanPageProps {
    transactions: Transaction[];
    goals: FinancialGoal[];
    onSaveGoals: (goals: FinancialGoal[]) => void;
    plan: FinancialPlan | null;
    onDeletePlan?: () => void;
    onSavePlan: (plan: FinancialPlan | null) => void;
    categories: Category[];
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
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${progress === 100 ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {progress.toFixed(0)}% REACHED
                    </span>
                    {goal.targetDate && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(goal.targetDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="absolute -bottom-2 -right-2 opacity-[0.03] pointer-events-none transition-transform group-hover:scale-110">
                <CurrencyDollarIcon className="w-24 h-24 text-indigo-900" />
            </div>
        </div>
    );
};

const FinancialPlanPage: React.FC<FinancialPlanPageProps> = ({ transactions, goals, onSaveGoals, plan, onSavePlan, categories }) => {
    const [activeTab, setActiveTab] = useState<'goals' | 'strategy' | 'budget'>('goals');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

    // Form State
    const [goalTitle, setGoalTitle] = useState('');
    const [goalTarget, setGoalTarget] = useState(0);
    const [goalCurrent, setGoalCurrent] = useState(0);
    const [goalType, setGoalType] = useState<FinancialGoal['type']>('emergency_fund');
    const [goalDate, setGoalDate] = useState('');

    const apiKeyAvailable = hasApiKey();

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
            const categoryMap = new Map<string, string>(categories.map(c => [c.id, c.name]));
            const last6Months = new Date();
            last6Months.setMonth(last6Months.getMonth() - 6);
            
            // Actual call to Gemini service
            const results = await generateFinancialStrategy(transactions, goals, categories);
            
            onSavePlan({
                id: generateUUID(),
                createdAt: new Date().toISOString(),
                strategy: results.strategy || "Generated Strategy placeholder",
                suggestedBudgets: results.suggestedBudgets || [],
                projections: results.projections || []
            });
            setActiveTab('strategy');
        } catch (e) {
            console.error(e);
            alert("AI strategy build failed. Check API key.");
        } finally {
            setIsGenerating(false);
        }
    };

    const budgetAnalysis = useMemo(() => {
        if (!plan || plan.suggestedBudgets.length === 0) return null;
        
        const thisMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));

        const currentActuals = transactions
            .filter(tx => tx.date.startsWith(thisMonth) && !tx.isParent && tx.typeId.includes('expense'))
            .reduce((acc, tx) => {
                acc[tx.categoryId] = (acc[tx.categoryId] || 0) + tx.amount;
                return acc;
            }, {} as Record<string, number>);

        return plan.suggestedBudgets.map(b => {
            const actual = currentActuals[b.categoryId] || 0;
            const name = categoryMap.get(b.categoryId) || 'Unknown';
            return {
                ...b,
                name,
                actual,
                percent: b.monthlyLimit > 0 ? (actual / b.monthlyLimit) * 100 : 0
            };
        });
    }, [plan, transactions, categories]);

    return (
        <div className="space-y-8 h-full flex flex-col max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <TrendingUpIcon className="w-8 h-8 text-indigo-600" />
                        Financial Plan
                    </h1>
                    <p className="text-slate-500 mt-1">Combine your data with AI to build a customized path to wealth.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleOpenGoalModal()}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold shadow-sm transition-all"
                    >
                        <AddIcon className="w-5 h-5"/> New Goal
                    </button>
                    <button 
                        onClick={handleGenerateStrategy}
                        disabled={isGenerating || !apiKeyAvailable || goals.length === 0}
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-40"
                    >
                        {isGenerating ? <RepeatIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                        {plan ? 'Refresh Strategy' : 'Build AI Strategy'}
                    </button>
                </div>
            </div>

            <div className="flex border-b border-slate-200 flex-shrink-0">
                <button onClick={() => setActiveTab('goals')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'goals' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Goals & Targets</button>
                <button onClick={() => setActiveTab('strategy')} disabled={!plan} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors disabled:opacity-30 ${activeTab === 'strategy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>AI Roadmap</button>
                <button onClick={() => setActiveTab('budget')} disabled={!plan} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors disabled:opacity-30 ${activeTab === 'budget' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Budget vs Actuals</button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-10 pr-2 custom-scrollbar pb-10">
                {activeTab === 'goals' && (
                    <section className="animate-fade-in">
                        {goals.length === 0 ? (
                            <div className="bg-white p-16 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
                                <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CurrencyDollarIcon className="w-12 h-12 text-indigo-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800">Ready to build your roadmap?</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-10 text-lg">Define your goals (Emergency Fund, Debt Payoff, Home Savings) and let AI create the strategy.</p>
                                <button onClick={() => handleOpenGoalModal()} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Define My First Goal</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {goals.map(goal => (
                                    <GoalCard key={goal.id} goal={goal} onEdit={handleOpenGoalModal} onDelete={handleDeleteGoal} />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'strategy' && plan && (
                    <section className="animate-fade-in bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl shadow-slate-200/50">
                        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                                <LightBulbIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Your AI-Driven Strategy</h2>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Snapshot as of {new Date(plan.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="prose prose-slate max-w-none prose-headings:text-indigo-900 prose-strong:text-indigo-600">
                            <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
                                {plan.strategy.split('\n').map((line, idx) => {
                                    if (line.startsWith('#')) return <h3 key={idx} className="text-2xl font-black text-indigo-800 pt-6 pb-2 border-b border-indigo-50">{line.replace(/#/g, '').trim()}</h3>;
                                    if (line.startsWith('-') || line.startsWith('*')) return <div key={idx} className="flex gap-4 pl-4 py-1"><span className="text-indigo-400 font-black">•</span><span>{line.substring(1).trim()}</span></div>;
                                    return <p key={idx} className="mb-4" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-700">$1</strong>') }} />;
                                })}
                            </div>
                        </div>

                        {plan.projections && plan.projections.length > 0 && (
                            <div className="mt-12 pt-12 border-t border-slate-100">
                                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <TrendingUpIcon className="w-6 h-6 text-emerald-500" />
                                    Wealth Projections
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {plan.projections.map((p, i) => (
                                        <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.year}</p>
                                            <p className="text-xl font-black text-slate-800 mt-1">${p.projectedNetWorth.toLocaleString()}</p>
                                            {p.milestones.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {p.milestones.map((m, j) => (
                                                        <div key={j} className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mr-1">{m}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'budget' && budgetAnalysis && (
                    <section className="animate-fade-in space-y-6">
                        <div className="bg-indigo-900 text-white p-8 rounded-[2rem] shadow-xl flex justify-between items-center overflow-hidden relative">
                            <div className="relative z-10">
                                <h2 className="text-2xl font-black mb-2">Live Month Tracking</h2>
                                <p className="text-indigo-200 max-w-sm">Comparing suggested AI limits against your current categorized actuals for this month.</p>
                            </div>
                            <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md relative z-10">
                                <BarChartIcon className="w-12 h-12 text-white" />
                            </div>
                            <SparklesIcon className="absolute -right-12 -bottom-12 w-64 h-64 text-indigo-400 opacity-10 pointer-events-none" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {budgetAnalysis.map(b => (
                                <div key={b.categoryId} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-800">{b.name}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Monthly Limit: ${b.monthlyLimit}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-black ${b.percent > 90 ? 'text-rose-600' : 'text-emerald-600'}`}>${b.actual.toFixed(0)}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">ACTUAL</p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${b.percent > 100 ? 'bg-rose-500' : b.percent > 75 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.min(b.percent, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${b.percent > 100 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {b.percent.toFixed(0)}% CONSUMED
                                        </span>
                                        {/* Fixed: AlertTriangle replaced with ExclamationTriangleIcon to match exported Icons */}
                                        {b.percent > 100 && <span className="text-[10px] font-black text-rose-600 flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3" /> OVER LIMIT</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Goal Modal */}
            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsGoalModalOpen(false)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-2xl font-black text-slate-800">{editingGoal ? 'Update Target' : 'Define Target'}</h3>
                            <button onClick={() => setIsGoalModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><CloseIcon className="w-6 h-6"/></button>
                        </div>
                        <form onSubmit={handleSaveGoal} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Friendly Label</label>
                                <input type="text" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-800" placeholder="e.g. Vacation Fund" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Target Amount</label>
                                    <input type="number" value={goalTarget} onChange={e => setGoalTarget(parseFloat(e.target.value))} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-mono font-bold" required />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Current Savings</label>
                                    <input type="number" value={goalCurrent} onChange={e => setGoalCurrent(parseFloat(e.target.value))} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-mono font-bold" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                                    <select value={goalType} onChange={e => setGoalType(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 bg-white font-bold text-slate-700">
                                        <option value="emergency_fund">Emergency Fund</option>
                                        <option value="debt_payoff">Debt Payoff</option>
                                        <option value="retirement">Retirement</option>
                                        <option value="savings">General Savings</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">By Date</label>
                                    <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 font-bold text-slate-700" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl">Cancel</button>
                                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all">Save Goal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialPlanPage;