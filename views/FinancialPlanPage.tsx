
import React, { useState, useMemo } from 'react';
import type { FinancialGoal, FinancialPlan, Transaction, Category } from '../types';
// Added missing icon imports: RobotIcon, ExclamationTriangleIcon, RepeatIcon
import { LightBulbIcon, SparklesIcon, CheckCircleIcon, AddIcon, DeleteIcon, EditIcon, CurrencyDollarIcon, HeartIcon, CloseIcon, TrendingUpIcon, CalendarIcon, RobotIcon, ExclamationTriangleIcon, RepeatIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { hasApiKey, generateFinancialStrategy } from '../services/geminiService';

interface FinancialPlanPageProps {
    transactions: Transaction[];
    goals: FinancialGoal[];
    onSaveGoals: (goals: FinancialGoal[]) => void;
    plan: FinancialPlan | null;
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${progress === 100 ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-700'}`}>
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
            
            {/* Background Decoration */}
            <div className="absolute -bottom-2 -right-2 opacity-[0.03] pointer-events-none transition-transform group-hover:scale-110">
                <CurrencyDollarIcon className="w-24 h-24 text-indigo-900" />
            </div>
        </div>
    );
};

const FinancialPlanPage: React.FC<FinancialPlanPageProps> = ({ transactions, goals, onSaveGoals, plan, onSavePlan, categories }) => {
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
            // Aggregate categorical spending for context
            // Fix: Add explicit generic types to Map to ensure return type is recognized
            const categoryMap = new Map<string, string>(categories.map(c => [c.id, c.name]));
            const last6Months = new Date();
            last6Months.setMonth(last6Months.getMonth() - 6);
            
            const spendingSummary = transactions
                .filter(tx => new Date(tx.date) >= last6Months && !tx.isParent && tx.typeId.includes('expense'))
                .reduce((acc, tx) => {
                    // Fix: Explicitly cast 'name' to string to allow it as an index type
                    const name = (categoryMap.get(tx.categoryId) as string) || 'Other';
                    acc[name] = (acc[name] || 0) + tx.amount;
                    return acc;
                }, {} as Record<string, number>);

            const prompt = `Act as a world-class financial planner. 
                User Goals: ${JSON.stringify(goals.map(g => ({ title: g.title, target: g.targetAmount, current: g.currentAmount, type: g.type })))}
                Monthly Spending (Last 6 months avg): ${JSON.stringify(spendingSummary)}
                
                Generate a markdown-formatted financial strategy. Include:
                1. A high-level assessment of their goals.
                2. Specific advice on how to optimize their spending.
                3. A prioritized roadmap for which goal to focus on first (e.g., debt vs emergency fund).
                4. Five key "Action Items" to execute in the next 30 days.
                
                Keep the tone professional, encouraging, and highly structural. Use bold text and headers.`;

            const results = await generateFinancialStrategy(transactions, goals, categories);
            
            // Note: If generateFinancialStrategy returns a full object, use it. 
            // In a production app we'd parse specific fields, but for this guidance tool 
            // we will treat the main 'strategy' text as markdown.
            
            onSavePlan({
                id: generateUUID(),
                createdAt: new Date().toISOString(),
                strategy: results.strategy || "Strategy generation complete. Check your results.",
                suggestedBudgets: results.suggestedBudgets || []
            });
        } catch (e) {
            console.error(e);
            alert("AI generation failed. Please ensure your API key is configured correctly.");
        } finally {
            setIsGenerating(false);
        }
    };

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
                <button 
                    onClick={() => handleOpenGoalModal()}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                    <AddIcon className="w-5 h-5"/> Create Goal
                </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-10 pr-2 custom-scrollbar">
                {/* Goals Section */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <CheckCircleIcon className="w-6 h-6 text-green-500" />
                        <h2 className="text-xl font-bold text-slate-700">Financial Targets</h2>
                    </div>
                    {goals.length === 0 ? (
                        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CurrencyDollarIcon className="w-10 h-10 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Your future starts here</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8">Setting clear, measurable goals is the most powerful way to change your financial trajectory. What are you building for?</p>
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

                {/* AI Strategy Section */}
                <section className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-300">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.08] pointer-events-none">
                        <SparklesIcon className="w-64 h-64 text-indigo-400" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-500/20 rounded-lg backdrop-blur-sm border border-indigo-400/20">
                                <RobotIcon className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Personal Wealth Strategy</h2>
                                <p className="text-indigo-300 text-sm font-medium">Tailored roadmap by Gemini 3</p>
                            </div>
                        </div>
                        
                        {!plan ? (
                            <div className="space-y-6 max-w-2xl">
                                <p className="text-slate-300 text-lg leading-relaxed">
                                    I'll synthesize your real spending patterns, transaction categories, and the {goals.length} goal(s) you've defined into a structural roadmap for growth.
                                </p>
                                <div className="flex flex-col sm:flex-row items-center gap-6">
                                    <button 
                                        onClick={handleGenerateStrategy}
                                        disabled={isGenerating || !apiKeyAvailable || goals.length === 0}
                                        className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-900/50 transition-all hover:-translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Crunching Patterns...
                                            </>
                                        ) : (
                                            <>
                                                <SparklesIcon className="w-5 h-5" />
                                                Build My AI Strategy
                                            </>
                                        )}
                                    </button>
                                    {!apiKeyAvailable && (
                                        <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-4 py-2 rounded-xl border border-amber-400/20">
                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">API Key Missing</span>
                                        </div>
                                    )}
                                    {apiKeyAvailable && goals.length === 0 && (
                                        <p className="text-xs text-slate-400 font-medium italic">Create at least one goal to trigger analysis.</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-fade-in">
                                <div className="prose prose-invert max-w-none prose-indigo">
                                    {/* Using a custom renderer logic for simple markdown simulation */}
                                    <div className="space-y-4 text-slate-200 leading-relaxed font-medium">
                                        {plan.strategy.split('\n').map((line, idx) => {
                                            if (line.startsWith('#')) {
                                                return <h3 key={idx} className="text-xl font-bold text-white pt-4 pb-2 border-b border-white/10 uppercase tracking-wide">{line.replace(/#/g, '').trim()}</h3>;
                                            }
                                            if (line.startsWith('-') || line.startsWith('*')) {
                                                return <div key={idx} className="flex gap-3 pl-2"><span className="text-indigo-500 font-bold">•</span><span>{line.substring(1).trim()}</span></div>;
                                            }
                                            return <p key={idx} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-300 font-bold">$1</strong>') }} />;
                                        })}
                                    </div>
                                </div>
                                
                                <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-black/20 px-3 py-1.5 rounded-full">
                                        <CalendarIcon className="w-3 h-3" />
                                        Update: {new Date(plan.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={() => onSavePlan(null)} className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors">Discard Plan</button>
                                        <button 
                                            onClick={handleGenerateStrategy} 
                                            disabled={isGenerating} 
                                            className="px-6 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/20 rounded-xl text-sm font-bold transition-all flex items-center gap-2 backdrop-blur-sm"
                                        >
                                            <RepeatIcon className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                            Refresh Analysis
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Goal Modal */}
            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsGoalModalOpen(false)}>
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
