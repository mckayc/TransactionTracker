import React, { useState, useMemo, useEffect } from 'react';
/* Added SystemSettings to imports */
import type { FinancialGoal, FinancialPlan, Transaction, Category, BusinessProfile, ChatMessage, SystemSettings } from '../types';
import { LightBulbIcon, SparklesIcon, CheckCircleIcon, AddIcon, DeleteIcon, EditIcon, CurrencyDollarIcon, HeartIcon, CloseIcon, TrendingUpIcon, CalendarIcon, RobotIcon, ExclamationTriangleIcon, RepeatIcon, SendIcon } from '../components/Icons';
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
    /* Added systemSettings prop */
    systemSettings?: SystemSettings;
}

const FinancialPlanPage: React.FC<FinancialPlanPageProps> = ({ transactions, goals, onSaveGoals, plan, onSavePlan, categories, businessProfile, systemSettings }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [discoveryChat, setDiscoveryChat] = useState<ChatMessage[]>([]);
    const [discoveryInput, setDiscoveryInput] = useState('');
    const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);

    const [goalTitle, setGoalTitle] = useState('');
    const [goalTarget, setGoalTarget] = useState(0);
    const [goalCurrent, setGoalCurrent] = useState(0);
    const [goalType, setGoalType] = useState<FinancialGoal['type']>('emergency_fund');
    const [goalDate, setGoalDate] = useState('');

    const apiKeyAvailable = hasApiKey();

    // Fix: Added deletion logic to resolve 'onDeleteGoals' not found error
    const handleDeleteGoal = (id: string) => {
        if (window.confirm("Permanently delete this goal?")) {
            onSaveGoals(goals.filter(g => g.id !== id));
        }
    };

    const handleGenerateStrategy = async () => {
        if (!apiKeyAvailable) return;
        setIsGenerating(true);
        try {
            /* Passed systemSettings to generateFinancialStrategy */
            const results = await generateFinancialStrategy(transactions, goals, categories, businessProfile || { info: {}, tax: {}, completedSteps: [] }, systemSettings);
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
            
            /* Passed systemSettings to streamTaxAdvice */
            const stream = await streamTaxAdvice(newHistory, businessProfile || { info: {}, tax: {}, completedSteps: [] }, systemSettings);
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

    return (
        <div className="space-y-8 h-full flex flex-col max-w-6xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><TrendingUpIcon className="w-8 h-8 text-indigo-600" /> Financial Plan</h1>
                    <p className="text-slate-500 mt-1">Guided AI planning for taxes, retirement, and growth.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleStartDiscovery} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold shadow-sm">
                        <RobotIcon className="w-5 h-5 text-indigo-600" /> AI Discovery
                    </button>
                    <button onClick={() => { setEditingGoal(null); setIsGoalModalOpen(true); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg">Create Goal</button>
                </div>
            </div>

            <div className="flex-1 space-y-10">
                <section>
                    <div className="flex items-center gap-2 mb-6"><CheckCircleIcon className="w-6 h-6 text-green-500" /><h2 className="text-xl font-bold text-slate-700">Financial Targets</h2></div>
                    {goals.length === 0 ? (
                        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                            <CurrencyDollarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-800">No goals yet</h3>
                            <button onClick={() => setIsGoalModalOpen(true)} className="mt-4 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Add My First Target</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {goals.map(g => (
                                <div key={g.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg">{g.title}</h3>
                                            <p className="text-[9px] text-indigo-500 uppercase font-black tracking-widest">{g.type}</p>
                                        </div>
                                        {/* Fix: use handleDeleteGoal instead of onDeleteGoals */}
                                        <button onClick={() => handleDeleteGoal(g.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600"><DeleteIcon className="w-4 h-4"/></button>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-slate-500">
                                            <span>${g.currentAmount.toLocaleString()}</span><span>Target: ${g.targetAmount.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-600" style={{ width: `${Math.min((g.currentAmount / g.targetAmount) * 100, 100)}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6"><RobotIcon className="w-8 h-8 text-indigo-400" /><h2 className="text-2xl font-bold">Wealth Roadmap</h2></div>
                        {!plan ? (
                            <div className="space-y-6 max-w-2xl">
                                <p className="text-slate-300 text-lg">Initiate a forensic audit of your spending and goal set to generate a multi-year strategy.</p>
                                <button onClick={handleGenerateStrategy} disabled={isGenerating || goals.length === 0} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-50 shadow-xl disabled:opacity-40 flex items-center gap-3">
                                    {isGenerating ? <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin"></div> : <SparklesIcon className="w-5 h-5" />} Generate My AI Strategy
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in">
                                <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed font-medium">
                                    {plan.strategy.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
                                </div>
                                <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                                    <span className="text-xs text-slate-500">Built: {new Date(plan.createdAt).toLocaleDateString()}</span>
                                    <button onClick={() => onSavePlan(null)} className="text-xs text-slate-400 hover:text-white uppercase font-black">Refresh Strategy</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <SparklesIcon className="absolute -right-20 -top-20 w-80 h-80 opacity-[0.03] text-indigo-500 pointer-events-none" />
                </section>
            </div>

            {/* Discovery Chat Modal */}
            {isDiscoveryOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
                            <div className="flex items-center gap-3">
                                <RobotIcon className="w-6 h-6" />
                                <div><h3 className="font-black text-lg">Financial Architect</h3><p className="text-[10px] text-indigo-200 uppercase font-bold">Guided Strategy Session</p></div>
                            </div>
                            <button onClick={() => setIsDiscoveryOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/50">
                            {discoveryChat.map(m => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`p-4 rounded-2xl max-w-[85%] text-sm shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border rounded-bl-none'}`}>
                                        <div className="prose prose-sm prose-indigo" dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                    </div>
                                </div>
                            ))}
                            {isDiscoveryLoading && <div className="flex justify-start"><div className="p-4 bg-white border rounded-2xl animate-pulse text-xs text-slate-400">Architect is pondering...</div></div>}
                        </div>
                        <div className="p-6 border-t bg-white flex gap-3">
                            <input type="text" value={discoveryInput} onChange={e => setDiscoveryInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleDiscoverySend()} className="flex-1 p-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-medium" placeholder="Respond here..." />
                            <button onClick={handleDiscoverySend} className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg"><SendIcon className="w-5 h-5"/></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialPlanPage;