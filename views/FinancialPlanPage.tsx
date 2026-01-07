import React, { useState, useMemo, useEffect } from 'react';
import type { FinancialGoal, FinancialPlan, Transaction, Category, BusinessProfile, ChatMessage } from '../types';
// Add TrashIcon to the imports
import { LightBulbIcon, SparklesIcon, CheckCircleIcon, AddIcon, DeleteIcon, EditIcon, CurrencyDollarIcon, HeartIcon, CloseIcon, TrendingUpIcon, CalendarIcon, RobotIcon, ExclamationTriangleIcon, RepeatIcon, SendIcon, ShieldCheckIcon, TrashIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { hasApiKey, generateFinancialStrategy, streamTaxAdvice } from '../services/geminiService';

interface FinancialPlanPageProps {
    transactions: Transaction[];
    goals: FinancialGoal[];
    onSaveGoals: (goals: FinancialGoal[]) => void;
    plan: FinancialPlan | null;
    onSavePlan: (plan: FinancialPlan | null) => void;
    categories: Category[];
    businessProfile?: BusinessProfile;
}

const FinancialPlanPage: React.FC<FinancialPlanPageProps> = ({ transactions, goals, onSaveGoals, plan, onSavePlan, categories, businessProfile }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [discoveryChat, setDiscoveryChat] = useState<ChatMessage[]>([]);
    const [discoveryInput, setDiscoveryInput] = useState('');
    const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);

    // Goal form state
    const [goalTitle, setGoalTitle] = useState('');
    const [goalTarget, setGoalTarget] = useState(0);
    const [goalCurrent, setGoalCurrent] = useState(0);
    const [goalType, setGoalType] = useState<FinancialGoal['type']>('retirement');
    const [goalDate, setGoalDate] = useState('');

    const apiKeyAvailable = hasApiKey();

    const handleOpenGoalModal = (goal: FinancialGoal | null = null) => {
        if (goal) {
            setEditingGoal(goal);
            setGoalTitle(goal.title);
            setGoalTarget(goal.targetAmount);
            setGoalCurrent(goal.currentAmount);
            setGoalType(goal.type);
            setGoalDate(goal.targetDate || '');
        } else {
            setEditingGoal(null);
            setGoalTitle('');
            setGoalTarget(0);
            setGoalCurrent(0);
            setGoalType('retirement');
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
        if (window.confirm("Permanently delete this goal?")) {
            onSaveGoals(goals.filter(g => g.id !== id));
        }
    };

    const handleGenerateStrategy = async () => {
        if (!apiKeyAvailable) return;
        setIsGenerating(true);
        try {
            const results = await generateFinancialStrategy(transactions, goals, categories, businessProfile || { info: {}, tax: {}, completedSteps: [] });
            onSavePlan({
                id: generateUUID(),
                createdAt: new Date().toISOString(),
                strategy: results.strategy || "Detailed roadmap generated.",
                suggestedBudgets: results.suggestedBudgets || []
            });
        } catch (e) {
            console.error(e);
            alert("Pattern analysis failed. Please check your connection.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStartDiscovery = () => {
        setIsDiscoveryOpen(true);
        if (discoveryChat.length === 0) {
            setDiscoveryChat([{
                id: generateUUID(), role: 'ai', timestamp: new Date().toISOString(),
                content: "Hello! I'm your AI Financial Architect. Let's build your multi-year roadmap. **What are your primary financial fears or biggest aspirations for the next 5 years?**"
            }]);
        }
    };

    const handleDiscoverySend = async () => {
        if (!discoveryInput.trim() || isDiscoveryLoading) return;
        const userMsg: ChatMessage = { id: generateUUID(), role: 'user', content: discoveryInput, timestamp: new Date().toISOString() };
        const newHistory = [...discoveryChat, userMsg];
        setDiscoveryChat(newHistory);
        setDiscoveryInput('');
        setIsDiscoveryLoading(true);

        try {
            const aiMsgId = generateUUID();
            const placeholder: ChatMessage = { id: aiMsgId, role: 'ai', content: '', timestamp: new Date().toISOString() };
            setDiscoveryChat([...newHistory, placeholder]);
            
            const stream = await streamTaxAdvice(newHistory, businessProfile || { info: {}, tax: {}, completedSteps: [] });
            let full = '';
            for await (const chunk of stream) {
                full += chunk.text;
                setDiscoveryChat(prev => {
                    const last = prev[prev.length - 1];
                    if (last.id === aiMsgId) return [...prev.slice(0, -1), { ...last, content: full }];
                    return prev;
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDiscoveryLoading(false);
        }
    };

    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    return (
        <div className="space-y-8 h-full flex flex-col max-w-6xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <TrendingUpIcon className="w-8 h-8 text-indigo-600" /> Strategic Wealth Plan
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">AI-guided roadmap for tax efficiency and asset growth.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleStartDiscovery} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 font-black shadow-sm transition-all active:scale-95">
                        <RobotIcon className="w-5 h-5 text-indigo-600" /> AI Strategy Session
                    </button>
                    <button onClick={() => handleOpenGoalModal()} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                        <AddIcon className="w-5 h-5 inline-block mr-1" /> New Target
                    </button>
                </div>
            </div>

            {/* Overall Progress Gauge */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-10">
                <div className="relative w-40 h-40 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * overallProgress) / 100} className="text-indigo-600 transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-800">{overallProgress.toFixed(0)}%</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate</span>
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-8 w-full">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Assets Tracked</p>
                        <p className="text-3xl font-black text-slate-800">${totalCurrent.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">Across all defined goals</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ultimate Objective</p>
                        <p className="text-3xl font-black text-indigo-600">${totalTarget.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">Remaining: ${(totalTarget - totalCurrent).toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* GOALS LIST */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5 text-green-500" /> Active Targets
                        </h2>
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-1 rounded-full">{goals.length}</span>
                    </div>
                    
                    {goals.length === 0 ? (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
                            <p className="text-slate-400 text-sm font-medium">Define your milestones to activate AI auditing.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {goals.map(g => (
                                <div key={g.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-all group cursor-pointer" onClick={() => handleOpenGoalModal(g)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-800 truncate">{g.title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${g.type === 'retirement' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>{g.type.replace('_', ' ')}</span>
                                                {g.targetDate && <span className="text-[9px] text-slate-400 font-bold uppercase"><CalendarIcon className="w-2.5 h-2.5 inline mr-1" /> {g.targetDate}</span>}
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(g.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-black text-slate-400">
                                            <span>${g.currentAmount.toLocaleString()}</span>
                                            <span>${g.targetAmount.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${Math.min((g.currentAmount / g.targetAmount) * 100, 100)}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI STRATEGY CONSOLE */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-lg">
                                        <ShieldCheckIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black tracking-tight">Institutional Roadmap</h2>
                                        <p className="text-[10px] text-indigo-400 uppercase font-black tracking-widest mt-0.5">Gemini 3 Analytical Forge</p>
                                    </div>
                                </div>
                                {plan && <button onClick={() => onSavePlan(null)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase transition-colors">Clear Analysis</button>}
                            </div>

                            {!plan ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-fade-in">
                                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center animate-pulse">
                                        <SparklesIcon className="w-10 h-10 text-indigo-400" />
                                    </div>
                                    <div className="max-w-md">
                                        <h3 className="text-lg font-bold mb-3">Strategy Inactive</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">By initiating a strategy audit, Gemini will analyze your ledger history, current goal progress, and business profile to synthesize a multi-year growth plan.</p>
                                    </div>
                                    <button 
                                        onClick={handleGenerateStrategy} 
                                        disabled={isGenerating || goals.length === 0} 
                                        className="px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-900/40 disabled:opacity-30 flex items-center gap-3 transition-all active:scale-95"
                                    >
                                        {isGenerating ? <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin"></div> : <SparklesIcon className="w-5 h-5" />} 
                                        {isGenerating ? 'Synthesizing...' : 'Generate Wealth Strategy'}
                                    </button>
                                    {goals.length === 0 && <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Requires at least 1 Active Target</p>}
                                </div>
                            ) : (
                                <div className="flex-1 space-y-8 animate-fade-in flex flex-col min-h-0">
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                                        <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-medium text-sm space-y-4">
                                            {plan.strategy.split('\n').filter(l => l.trim()).map((line, i) => (
                                                <div key={i} className="flex gap-4">
                                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                                                    <p>{line.replace(/^\*+/, '').trim()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {plan.suggestedBudgets && plan.suggestedBudgets.length > 0 && (
                                        <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-4">
                                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Recommended Operational Budgets</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {plan.suggestedBudgets.map((b, i) => {
                                                    const cat = categories.find(c => c.id === b.categoryId);
                                                    return (
                                                        <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                            <p className="text-[9px] font-bold text-slate-500 truncate uppercase">{cat?.name || 'Category'}</p>
                                                            <p className="text-lg font-black">${b.limit.toLocaleString()}<span className="text-[10px] text-slate-600 font-medium ml-1">/mo</span></p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-6 border-t border-white/10 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        <span>Last Computed: {new Date(plan.createdAt).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1.5 text-indigo-400"><CheckCircleIcon className="w-3.5 h-3.5" /> High Confidence Model</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <SparklesIcon className="absolute -right-20 -top-20 w-80 h-80 opacity-[0.03] text-indigo-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Goal Creation Modal */}
            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setIsGoalModalOpen(false)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-black text-slate-800 text-xl">{editingGoal ? 'Update Target' : 'New Wealth Target'}</h3>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Goal Registry</p>
                            </div>
                            <button onClick={() => setIsGoalModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleSaveGoal} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Objective Title</label>
                                <input type="text" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} required className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 focus:ring-0" placeholder="e.g. Early Retirement Fund" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Balance</label>
                                    <input type="number" value={goalCurrent} onChange={e => setGoalCurrent(parseFloat(e.target.value) || 0)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Amount</label>
                                    <input type="number" value={goalTarget} onChange={e => setGoalTarget(parseFloat(e.target.value) || 0)} required className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Type</label>
                                    <select value={goalType} onChange={e => setGoalType(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold">
                                        <option value="retirement">Retirement</option>
                                        <option value="emergency_fund">Emergency Fund</option>
                                        <option value="debt_free">Debt Free</option>
                                        <option value="investment">Specific Investment</option>
                                        <option value="other">General Growth</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Date</label>
                                    <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">Discard</button>
                                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl transition-all">Save Milestone</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Discovery Chat Modal */}
            {isDiscoveryOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[120] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
                            <div className="flex items-center gap-3">
                                <RobotIcon className="w-6 h-6" />
                                <div><h3 className="font-black text-lg">Financial Architect</h3><p className="text-[10px] text-indigo-200 uppercase font-bold">Guided Strategy Session</p></div>
                            </div>
                            <button onClick={() => setIsDiscoveryOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-white"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/50">
                            {discoveryChat.map(m => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`p-5 rounded-3xl max-w-[85%] text-sm shadow-sm border ${m.role === 'user' ? 'bg-indigo-600 text-white border-indigo-700 rounded-br-none' : 'bg-white text-slate-800 border-slate-100 rounded-bl-none'}`}>
                                        <div className="prose prose-sm prose-indigo leading-relaxed" dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                    </div>
                                </div>
                            ))}
                            {isDiscoveryLoading && (
                                <div className="flex justify-start">
                                    <div className="p-5 bg-white border border-slate-100 rounded-3xl rounded-bl-none shadow-sm flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                                        </div>
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Thinking...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t bg-white flex gap-3 shadow-[0_-10px_25px_rgba(0,0,0,0.02)]">
                            <input 
                                type="text" 
                                value={discoveryInput} 
                                onChange={e => setDiscoveryInput(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && handleDiscoverySend()} 
                                className="flex-1 p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium shadow-inner" 
                                placeholder="Describe your financial state or ask about tax efficiency..." 
                            />
                            <button onClick={handleDiscoverySend} disabled={!discoveryInput.trim() || isDiscoveryLoading} className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center">
                                <SendIcon className="w-6 h-6"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialPlanPage;