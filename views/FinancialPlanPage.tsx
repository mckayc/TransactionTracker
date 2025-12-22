
import React, { useState, useMemo } from 'react';
import type { FinancialGoal, FinancialPlan, Transaction, Category } from '../types';
// Added CloseIcon to the imports
import { LightBulbIcon, SparklesIcon, CheckCircleIcon, AddIcon, DeleteIcon, EditIcon, CurrencyDollarIcon, HeartIcon, CloseIcon } from '../components/Icons';
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">{goal.title}</h3>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{goal.type.replace('_', ' ')}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(goal)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50"><EditIcon className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(goal.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-50"><DeleteIcon className="w-4 h-4" /></button>
                </div>
            </div>
            
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">{formatCurrency(goal.currentAmount)}</span>
                    <span className="text-slate-400">Target: {formatCurrency(goal.targetAmount)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{progress.toFixed(0)}% Complete</span>
                    {goal.targetDate && <span className="text-xs text-slate-400">Due: {goal.targetDate}</span>}
                </div>
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
        if (confirm("Delete this goal?")) {
            onSaveGoals(goals.filter(g => g.id !== id));
        }
    };

    const handleGenerateStrategy = async () => {
        if (!apiKeyAvailable) return;
        setIsGenerating(true);
        try {
            const results = await generateFinancialStrategy(transactions, goals, categories);
            onSavePlan({
                id: generateUUID(),
                createdAt: new Date().toISOString(),
                strategy: results.strategy,
                suggestedBudgets: results.suggestedBudgets || []
            });
        } catch (e) {
            alert("Failed to generate plan. Please check your API key.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-8 h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Financial Plan</h1>
                    <p className="text-slate-500 mt-1">Set your sights on the future with AI-guided targets and strategy.</p>
                </div>
                <button 
                    onClick={() => handleOpenGoalModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md transition-all"
                >
                    <AddIcon className="w-5 h-5"/> Add Goal
                </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-8 pr-2">
                {/* Goals Section */}
                <section>
                    <h2 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        My Financial Goals
                    </h2>
                    {goals.length === 0 ? (
                        <div className="bg-white p-12 rounded-xl border-2 border-dashed border-slate-200 text-center">
                            <CurrencyDollarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">No goals set yet</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-6">Setting clear goals is the first step toward financial freedom. Add an Emergency Fund or Savings goal to get started.</p>
                            <button onClick={() => handleOpenGoalModal()} className="px-6 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100">Create My First Goal</button>
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
                <section className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <SparklesIcon className="w-48 h-48" />
                    </div>
                    
                    <div className="relative z-10 max-w-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <SparklesIcon className="w-6 h-6 text-indigo-400" />
                            <h2 className="text-2xl font-bold">AI Financial Strategy</h2>
                        </div>
                        
                        {!plan ? (
                            <div className="space-y-4">
                                <p className="text-slate-300">
                                    I'll analyze your spending across all accounts and categories from the last 6 months to build a custom roadmap for your goals.
                                </p>
                                <button 
                                    onClick={handleGenerateStrategy}
                                    disabled={isGenerating || !apiKeyAvailable}
                                    className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGenerating ? 'Analyzing Spending Patterns...' : 'Generate My Strategy'}
                                </button>
                                {!apiKeyAvailable && <p className="text-xs text-amber-400 font-bold">AI key missing in environment.</p>}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="prose prose-invert max-w-none prose-sm sm:prose-base">
                                    <div dangerouslySetInnerHTML={{ __html: plan.strategy.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                </div>
                                
                                <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <p className="text-xs text-slate-400 italic">Generated on {new Date(plan.createdAt).toLocaleDateString()}</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => onSavePlan(null)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">Clear Plan</button>
                                        <button onClick={handleGenerateStrategy} disabled={isGenerating} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all">Refresh Analysis</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Goal Modal */}
            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsGoalModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editingGoal ? 'Edit Goal' : 'New Financial Goal'}</h3>
                            <button onClick={() => setIsGoalModalOpen(false)}><CloseIcon className="w-5 h-5 text-slate-500"/></button>
                        </div>
                        <form onSubmit={handleSaveGoal} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Goal Title</label>
                                <input type="text" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="w-full p-2 border rounded-md" placeholder="e.g. Rainy Day Fund" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Amount</label>
                                    <input type="number" value={goalTarget} onChange={e => setGoalTarget(parseFloat(e.target.value))} className="w-full p-2 border rounded-md font-mono" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Already Saved</label>
                                    <input type="number" value={goalCurrent} onChange={e => setGoalCurrent(parseFloat(e.target.value))} className="w-full p-2 border rounded-md font-mono" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                    <select value={goalType} onChange={e => setGoalType(e.target.value as any)} className="w-full p-2 border rounded-md">
                                        <option value="emergency_fund">Emergency Fund</option>
                                        <option value="debt_payoff">Debt Payoff</option>
                                        <option value="retirement">Retirement</option>
                                        <option value="savings">Other Savings</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Date</label>
                                    <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="w-full p-2 border rounded-md" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">Save Goal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialPlanPage;
