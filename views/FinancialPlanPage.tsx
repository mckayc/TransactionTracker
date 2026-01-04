import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { FinancialGoal, FinancialPlan, Transaction, Category, ChatMessage } from '../types';
import { LightBulbIcon, SparklesIcon, CheckCircleIcon, AddIcon, DeleteIcon, EditIcon, CurrencyDollarIcon, CloseIcon, TrendingUpIcon, CalendarIcon, RobotIcon, ExclamationTriangleIcon, RepeatIcon, SendIcon, ChatBubbleIcon, InfoIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { hasApiKey, generateFinancialStrategy, streamFinancialCoaching } from '../services/geminiService';

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

    const priorityColors = {
        low: 'bg-blue-100 text-blue-700',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-red-100 text-red-700'
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">{goal.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-indigo-500 uppercase font-black tracking-widest">{goal.type.replace('_', ' ')}</span>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${priorityColors[goal.priority]}`}>Priority: {goal.priority}</span>
                    </div>
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
            
            <div className="absolute -bottom-2 -right-2 opacity-[0.03] pointer-events-none transition-transform group-hover:scale-110">
                <CurrencyDollarIcon className="w-24 h-24 text-indigo-900" />
            </div>
        </div>
    );
};

const FinancialPlanPage: React.FC<FinancialPlanPageProps> = ({ transactions, goals, onSaveGoals, plan, onSavePlan, categories }) => {
    const [activeTab, setActiveTab] = useState<'strategy' | 'coach' | 'goals'>('strategy');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

    // Goal Form State
    const [goalTitle, setGoalTitle] = useState('');
    const [goalTarget, setGoalTarget] = useState(0);
    const [goalCurrent, setGoalCurrent] = useState(0);
    const [goalType, setGoalType] = useState<FinancialGoal['type']>('emergency_fund');
    const [goalPriority, setGoalPriority] = useState<FinancialGoal['priority']>('medium');
    const [goalDate, setGoalDate] = useState('');

    // Coaching Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isCoaching, setIsCoaching] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const apiKeyAvailable = hasApiKey();

    useEffect(() => {
        if (activeTab === 'coach' && chatMessages.length === 0) {
            setChatMessages([{
                id: generateUUID(),
                role: 'ai',
                content: "Hello! I'm your AI Financial Coach. I've looked at your current data and goals. Would you like to start a health checkup or discuss a specific strategy?",
                timestamp: new Date().toISOString()
            }]);
        }
    }, [activeTab]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isCoaching) return;

        const userMsg: ChatMessage = {
            id: generateUUID(),
            role: 'user',
            content: chatInput,
            timestamp: new Date().toISOString()
        };

        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsCoaching(true);

        try {
            const aiMsgId = generateUUID();
            setChatMessages(prev => [...prev, { id: aiMsgId, role: 'ai', content: '', timestamp: new Date().toISOString() }]);
            
            const stream = await streamFinancialCoaching([...chatMessages, userMsg], { transactions, goals });
            let fullContent = '';
            
            for await (const chunk of stream) {
                fullContent += chunk.text || '';
                setChatMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: fullContent } : m));
            }
        } catch (e) {
            setChatMessages(prev => [...prev, { id: generateUUID(), role: 'ai', content: "I encountered an error. Please try again.", timestamp: new Date().toISOString(), isError: true }]);
        } finally {
            setIsCoaching(false);
        }
    };

    const handleOpenGoalModal = (g?: FinancialGoal) => {
        if (g) {
            setEditingGoal(g);
            setGoalTitle(g.title);
            setGoalTarget(g.targetAmount);
            setGoalCurrent(g.currentAmount);
            setGoalType(g.type);
            setGoalPriority(g.priority || 'medium');
            setGoalDate(g.targetDate || '');
        } else {
            setEditingGoal(null);
            setGoalTitle('');
            setGoalTarget(0);
            setGoalCurrent(0);
            setGoalType('emergency_fund');
            setGoalPriority('medium');
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
            priority: goalPriority,
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
            onSavePlan({
                id: generateUUID(),
                createdAt: new Date().toISOString(),
                strategy: results.strategy || "Strategy generation complete.",
                suggestedBudgets: results.suggestedBudgets || [],
                healthScore: results.healthScore,
                insights: results.insights
            });
        } catch (e) {
            console.error(e);
            alert("AI generation failed.");
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
                        Financial Command Center
                    </h1>
                    <p className="text-slate-500 mt-1">Autonomous planning guided by Gemini 3 Pro.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button onClick={() => setActiveTab('strategy')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'strategy' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Strategy</button>
                        <button onClick={() => setActiveTab('coach')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'coach' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Coach</button>
                        <button onClick={() => setActiveTab('goals')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'goals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Goals</button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
                {activeTab === 'strategy' && (
                    <div className="h-full overflow-y-auto custom-scrollbar space-y-10 pr-2">
                        {/* Health Score Overview */}
                        {plan && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Health Score</p>
                                    <div className="relative w-24 h-24 flex items-center justify-center">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                                            <circle cx="48" cy="48" r="40" stroke={plan.healthScore && plan.healthScore > 70 ? "#10b981" : "#f59e0b"} strokeWidth="8" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - (plan.healthScore || 0) / 100)} strokeLinecap="round" fill="none" />
                                        </svg>
                                        <span className="absolute text-2xl font-black text-slate-800">{plan.healthScore || '--'}</span>
                                    </div>
                                </div>
                                <div className="md:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <SparklesIcon className="w-4 h-4 text-indigo-500" />
                                        Priority Insights
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {plan.insights?.map((insight, i) => (
                                            <div key={i} className="flex gap-3 items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="mt-1"><InfoIcon className="w-4 h-4 text-indigo-400" /></div>
                                                <p className="text-xs font-medium text-slate-700 leading-relaxed">{insight}</p>
                                            </div>
                                        )) || <p className="text-sm text-slate-400 italic">No recent insights generated.</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Strategy Content */}
                        <section className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-300">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.08] pointer-events-none">
                                <SparklesIcon className="w-64 h-64 text-indigo-400" />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/20 rounded-lg backdrop-blur-sm border border-indigo-400/20">
                                            <RobotIcon className="w-8 h-8 text-indigo-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">Wealth Strategy Roadmap</h2>
                                            <p className="text-indigo-300 text-sm font-medium">Synthesized Intelligence</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleGenerateStrategy}
                                        disabled={isGenerating || !apiKeyAvailable || goals.length === 0}
                                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-40"
                                    >
                                        {isGenerating ? <RepeatIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                        {plan ? 'Refresh Analysis' : 'Build Strategy'}
                                    </button>
                                </div>
                                
                                {!plan ? (
                                    <div className="py-12 text-center">
                                        <p className="text-slate-400 text-lg mb-4 italic">No plan active. Define your goals and click 'Build Strategy' to begin.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="prose prose-invert max-w-none">
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
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'coach' && (
                    <div className="h-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden animate-fade-in">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-2 rounded-lg"><ChatBubbleIcon className="w-5 h-5 text-indigo-600" /></div>
                                <div>
                                    <h2 className="font-bold text-slate-800">Financial Coaching Session</h2>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Active Consultation</p>
                                </div>
                            </div>
                            <button onClick={() => setChatMessages([])} className="text-[10px] font-black text-red-500 hover:underline uppercase">Reset Session</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'}`}>
                                        <div className="prose prose-sm max-w-none text-inherit" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                    </div>
                                </div>
                            ))}
                            {isCoaching && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none border border-slate-200">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 border-t bg-slate-50">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={chatInput} 
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type your response or question..."
                                    className="flex-1 p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-medium"
                                    disabled={isCoaching}
                                />
                                <button 
                                    onClick={handleSendMessage}
                                    disabled={isCoaching || !chatInput.trim()}
                                    className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-md"
                                >
                                    <SendIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'goals' && (
                    <div className="h-full overflow-y-auto custom-scrollbar space-y-6 animate-fade-in pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <button 
                                onClick={() => handleOpenGoalModal()}
                                className="h-full min-h-[180px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                            >
                                <AddIcon className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="font-bold">New Goal</span>
                            </button>
                            {goals.map(goal => (
                                <GoalCard key={goal.id} goal={goal} onEdit={handleOpenGoalModal} onDelete={handleDeleteGoal} />
                            ))}
                        </div>
                    </div>
                )}
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
                                    <input type="number" value={goalTarget} onChange={e => setGoalTarget(parseFloat(e.target.value))} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-mono font-bold" required />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Current</label>
                                    <input type="number" value={goalCurrent} onChange={e => setGoalCurrent(parseFloat(e.target.value))} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-mono font-bold" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Objective</label>
                                    <select value={goalType} onChange={e => setGoalType(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-700 bg-white">
                                        <option value="emergency_fund">Emergency Fund</option>
                                        <option value="debt_payoff">Debt Payoff</option>
                                        <option value="retirement">Retirement</option>
                                        <option value="house">Real Estate</option>
                                        <option value="vacation">Leisure/Travel</option>
                                        <option value="investment">Wealth Building</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Priority</label>
                                    <select value={goalPriority} onChange={e => setGoalPriority(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-700 bg-white">
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Target Date</label>
                                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-700" />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-2xl transition-colors border-2 border-transparent">Cancel</button>
                                <button type="submit" className="flex-[2] px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg transition-all">Save Goal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialPlanPage;