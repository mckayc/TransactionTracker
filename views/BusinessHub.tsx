
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo, ChatSession, ChatMessage, Transaction, Account, Category, TransactionType, Payee } from '../types';
import { CheckCircleIcon, SparklesIcon, CurrencyDollarIcon, SendIcon, ExclamationTriangleIcon, AddIcon, DeleteIcon, ChatBubbleIcon, CloudArrowUpIcon, EditIcon, HeartIcon } from '../components/Icons';
import { askAiAdvisor, getIndustryDeductions, hasApiKey, streamTaxAdvice } from '../services/geminiService';
import { generateUUID } from '../utils';
import DonationModal from '../components/DonationModal';

interface BusinessHubProps {
    profile: BusinessProfile;
    onUpdateProfile: (profile: BusinessProfile) => void;
    chatSessions: ChatSession[];
    onUpdateChatSessions: (sessions: ChatSession[]) => void;
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
    onAddTransaction: (tx: Transaction) => void;
    transactionTypes: TransactionType[];
    payees: Payee[];
}

const SetupGuideTab: React.FC<{ profile: BusinessProfile; onUpdateProfile: (p: BusinessProfile) => void }> = ({ profile, onUpdateProfile }) => {
    const updateInfo = (key: keyof BusinessInfo, value: any) => {
        onUpdateProfile({
            ...profile,
            info: { ...profile.info, [key]: value }
        });
    };

    const updateTax = (key: keyof TaxInfo, value: any) => {
        onUpdateProfile({
            ...profile,
            tax: { ...profile.tax, [key]: value }
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <CheckCircleIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Business Structure</h2>
                </div>
                
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Legal Business Name</label>
                        <input 
                            type="text" 
                            value={profile.info.llcName || ''} 
                            onChange={(e) => updateInfo('llcName', e.target.value)}
                            placeholder="My Business LLC"
                            className="w-full p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Industry / Activity</label>
                        <input 
                            type="text" 
                            value={profile.info.industry || ''} 
                            onChange={(e) => updateInfo('industry', e.target.value)}
                            placeholder="e.g. Graphic Design, Software"
                            className="w-full p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
                            <select 
                                value={profile.info.businessType || ''} 
                                onChange={(e) => updateInfo('businessType', e.target.value)}
                                className="w-full p-2 border rounded-md"
                            >
                                <option value="">Select...</option>
                                <option value="sole-proprietor">Sole Proprietor</option>
                                <option value="llc-single">Single-Member LLC</option>
                                <option value="llc-multi">Multi-Member LLC</option>
                                <option value="s-corp">S-Corp</option>
                                <option value="c-corp">C-Corp</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                            <input 
                                type="text" 
                                value={profile.info.stateOfFormation || ''} 
                                onChange={(e) => updateInfo('stateOfFormation', e.target.value)}
                                placeholder="e.g. DE"
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">EIN (Tax ID)</label>
                        <input 
                            type="text" 
                            value={profile.info.ein || ''} 
                            onChange={(e) => updateInfo('ein', e.target.value)}
                            placeholder="XX-XXXXXXX"
                            className="w-full p-2 border rounded-md"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                    <div className="bg-green-100 p-2 rounded-lg">
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Tax Settings</h2>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tax Filing Status</label>
                        <select 
                            value={profile.tax.filingStatus || ''} 
                            onChange={(e) => updateTax('filingStatus', e.target.value)}
                            className="w-full p-2 border rounded-md"
                        >
                            <option value="">Select Status...</option>
                            <option value="sole-proprietor">Sole Proprietor (Schedule C)</option>
                            <option value="partnership">Partnership (Form 1065)</option>
                            <option value="s-corp">S-Corporation (Form 1120-S)</option>
                            <option value="c-corp">C-Corporation (Form 1120)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tax Year End</label>
                        <input 
                            type="date" 
                            value={profile.tax.taxYearEnd || ''} 
                            onChange={(e) => updateTax('taxYearEnd', e.target.value)}
                            className="w-full p-2 border rounded-md"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

const TaxAdvisorTab: React.FC<{ 
    profile: BusinessProfile; 
    sessions: ChatSession[]; 
    onUpdateSessions: (s: ChatSession[]) => void;
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
}> = ({ profile, sessions, onUpdateSessions, transactions, accounts, categories }) => {
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const apiKeyAvailable = hasApiKey();
    const activeSession = selectedSessionId ? sessions.find(s => s.id === selectedSessionId) : null;

    useEffect(() => {
        if (activeSession) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeSession?.messages.length, selectedSessionId]);

    const handleCreateSession = () => {
        const newSession: ChatSession = {
            id: generateUUID(),
            title: `Consultation ${new Date().toLocaleDateString()}`,
            messages: [{
                id: generateUUID(),
                role: 'ai',
                content: `Hello! I am your AI Tax Advisor. How can I help you today?`,
                timestamp: new Date().toISOString()
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        onUpdateSessions([...sessions, newSession]);
        setSelectedSessionId(newSession.id);
    };

    const handleSendMessage = async () => {
        if (!input.trim() || !activeSession || isLoading) return;
        const userMsg: ChatMessage = { id: generateUUID(), role: 'user', content: input, timestamp: new Date().toISOString() };
        const updatedSession = { ...activeSession, messages: [...activeSession.messages, userMsg], updatedAt: new Date().toISOString() };
        const otherSessions = sessions.filter(s => s.id !== activeSession.id);
        onUpdateSessions([...otherSessions, updatedSession]);
        setInput('');
        setIsLoading(true);

        try {
            const stream = await streamTaxAdvice(updatedSession.messages, profile);
            let fullContent = '';
            const aiMsgId = generateUUID();
            const aiMsgPlaceholder: ChatMessage = { id: aiMsgId, role: 'ai', content: '', timestamp: new Date().toISOString() };
            const sessionWithAi = { ...updatedSession, messages: [...updatedSession.messages, aiMsgPlaceholder] };
            onUpdateSessions([...otherSessions, sessionWithAi]);
            for await (const chunk of stream) {
                fullContent += chunk.text;
                const msgs = [...sessionWithAi.messages];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent };
                onUpdateSessions([...otherSessions, { ...sessionWithAi, messages: msgs }]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start h-[600px]">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg"><CurrencyDollarIcon className="w-5 h-5 text-indigo-600" /></div>
                        <div><h2 className="font-bold text-slate-800">Tax Advisor</h2></div>
                    </div>
                    <button onClick={handleCreateSession} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"><AddIcon className="w-4 h-4"/> New Chat</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!activeSession ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <SparklesIcon className="w-12 h-12 text-indigo-200 mb-2" />
                            <p className="text-slate-500">Start a conversation for expert business advice.</p>
                        </div>
                    ) : (
                        activeSession.messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                                    <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
                {activeSession && (
                    <div className="p-4 border-t border-slate-100 bg-white">
                        <div className="flex gap-2">
                            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Type your question..." className="flex-grow p-2 border rounded-xl" disabled={isLoading} />
                            <button onClick={handleSendMessage} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 transition-colors shadow-sm"><SendIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                )}
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-yellow-500" /> Quick Tips</h3>
                <ul className="space-y-3 text-sm text-slate-600">
                    <li className="p-2 bg-slate-50 rounded border border-slate-100">Maintain separate accounts for business and personal expenses.</li>
                    <li className="p-2 bg-slate-50 rounded border border-slate-100">Review your Profit & Loss monthly to estimate tax set-asides.</li>
                </ul>
            </div>
        </div>
    );
}

const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile, chatSessions, onUpdateChatSessions, transactions, accounts, categories, onAddTransaction, transactionTypes, payees }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'advisor'>('guide');
    const [isDonationOpen, setIsDonationOpen] = useState(false);

    // FIX: useMemo was missing from React imports in this file.
    const income = useMemo(() => transactions.filter(t => t.typeId.includes('income')).reduce((sum, t) => sum + t.amount, 0), [transactions]);

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Business Hub</h1>
                    <p className="text-slate-500 mt-1">Entity management and tax strategy.</p>
                </div>
                <button 
                    onClick={() => setIsDonationOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-700 rounded-lg border border-pink-100 font-bold hover:bg-pink-100 transition-colors"
                >
                    <HeartIcon className="w-5 h-5" /> Calculate Donations
                </button>
            </div>

            <div className="flex border-b border-slate-200 overflow-x-auto">
                <button onClick={() => setActiveTab('guide')} className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'guide' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Setup Guide</button>
                <button onClick={() => setActiveTab('advisor')} className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'advisor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Tax Advisor</button>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'guide' && <SetupGuideTab profile={profile} onUpdateProfile={onUpdateProfile} />}
                {activeTab === 'advisor' && <TaxAdvisorTab profile={profile} sessions={chatSessions} onUpdateSessions={onUpdateChatSessions} transactions={transactions} accounts={accounts} categories={categories} />}
            </div>

            <DonationModal 
                isOpen={isDonationOpen}
                onClose={() => setIsDonationOpen(false)}
                onSave={onAddTransaction}
                totalIncome={income}
                monthName="Current Year"
                payees={payees}
                accounts={accounts}
                categories={categories}
                transactionTypes={transactionTypes}
            />
        </div>
    );
};

export default BusinessHub;
