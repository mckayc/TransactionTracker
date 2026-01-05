
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo, ChatSession, ChatMessage, Transaction, Account, Category, BusinessNote } from '../types';
import { CheckCircleIcon, SparklesIcon, CurrencyDollarIcon, SendIcon, ExclamationTriangleIcon, AddIcon, DeleteIcon, ChatBubbleIcon, CloudArrowUpIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, SortIcon, ChevronDownIcon, CloseIcon, CopyIcon, TableIcon, ChevronRightIcon, LightBulbIcon, ChecklistIcon, BoxIcon, RepeatIcon } from '../components/Icons';
import { askAiAdvisor, getIndustryDeductions, hasApiKey, streamTaxAdvice } from '../services/geminiService';
import { generateUUID } from '../utils';

interface BusinessHubProps {
    profile: BusinessProfile;
    onUpdateProfile: (profile: BusinessProfile) => void;
    notes: BusinessNote[];
    onUpdateNotes: (notes: BusinessNote[]) => void;
    chatSessions: ChatSession[];
    onUpdateChatSessions: (sessions: ChatSession[]) => void;
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
}

// Internal Sub-component for Journaling
const JournalTab: React.FC<{ notes: BusinessNote[]; onUpdateNotes: (n: BusinessNote[]) => void }> = ({ notes, onUpdateNotes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClassification, setActiveClassification] = useState<string>('bug');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());
    const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<BusinessNote['type']>('bug');
    const [priority, setPriority] = useState<BusinessNote['priority']>('medium');
    const [editingId, setEditingId] = useState<string | null>(null);

    const filteredNotes = useMemo(() => {
        return notes.filter(n => {
            const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
            if (activeClassification === 'resolved') return n.isCompleted && matchesSearch;
            const matchesType = n.type === activeClassification && !n.isCompleted;
            return matchesSearch && matchesType;
        }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [notes, activeClassification, searchTerm]);

    const activeNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        const now = new Date().toISOString();
        if (editingId) {
            onUpdateNotes(notes.map(n => n.id === editingId ? { ...n, title, content, type, priority, updatedAt: now } : n));
        } else {
            const newNote: BusinessNote = {
                id: generateUUID(),
                title, content, type, priority,
                isCompleted: false,
                createdAt: now, updatedAt: now
            };
            onUpdateNotes([newNote, ...notes]);
            setSelectedNoteId(newNote.id);
        }
        resetForm();
    };

    const resetForm = () => {
        setTitle(''); setContent(''); setType('bug'); setPriority('medium');
        setEditingId(null); setIsCreating(false);
    };

    const startEdit = (n: BusinessNote) => {
        setEditingId(n.id); setTitle(n.title); setContent(n.content);
        setType(n.type); setPriority(n.priority); setIsCreating(true);
    };

    const toggleComplete = (id: string) => {
        const now = new Date().toISOString();
        onUpdateNotes(notes.map(n => n.id === id ? { ...n, isCompleted: !n.isCompleted, resolvedAt: !n.isCompleted ? now : undefined, updatedAt: now } : n));
    };

    const deleteNote = (id: string) => {
        if (confirm("Permanently delete this item?")) {
            onUpdateNotes(notes.filter(n => n.id !== id));
            if (selectedNoteId === id) setSelectedNoteId(null);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopyStatus('success');
            setTimeout(() => setCopyStatus('idle'), 3000);
        } catch (err) {
            setCopyStatus('error');
            setTimeout(() => setCopyStatus('idle'), 3000);
        }
    };

    const classificationStats = useMemo(() => ({
        bug: notes.filter(n => n.type === 'bug' && !n.isCompleted).length,
        note: notes.filter(n => n.type === 'note' && !n.isCompleted).length,
        idea: notes.filter(n => n.type === 'idea' && !n.isCompleted).length,
        task: notes.filter(n => n.type === 'task' && !n.isCompleted).length,
        resolved: notes.filter(n => n.isCompleted).length
    }), [notes]);

    return (
        <div className="flex gap-6 h-[750px] bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden relative">
            <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col p-6 flex-shrink-0">
                <button onClick={() => setIsCreating(true)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg mb-8 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95">
                    <AddIcon className="w-5 h-5" /> New Capture
                </button>
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Classification</p>
                    {[
                        { id: 'bug', label: 'Bugs', icon: <BugIcon className="w-4 h-4" /> },
                        { id: 'note', label: 'Notes', icon: <NotesIcon className="w-4 h-4" /> },
                        { id: 'idea', label: 'Ideas', icon: <LightBulbIcon className="w-4 h-4" /> },
                        { id: 'task', label: 'Tasks', icon: <ChecklistIcon className="w-4 h-4" /> }
                    ].map(item => (
                        <button key={item.id} onClick={() => setActiveClassification(item.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeClassification === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'}`}>
                            <div className="flex items-center gap-3">
                                {item.icon}
                                <span>{item.label}</span>
                            </div>
                            <span className={`text-[10px] px-1.5 rounded-full ${activeClassification === item.id ? 'bg-indigo-100' : 'bg-slate-200'}`}>{(classificationStats as any)[item.id]}</span>
                        </button>
                    ))}
                    <div className="pt-6 mt-6 border-t border-slate-200">
                        <button onClick={() => setActiveClassification('resolved')} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeClassification === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                            <div className="flex items-center gap-3"><CheckCircleIcon className="w-4 h-4" /><span>Archive</span></div>
                            <span className="text-[10px] bg-slate-200 px-1.5 rounded-full">{classificationStats.resolved}</span>
                        </button>
                    </div>
                </div>
            </div>
            <div className="w-1/3 min-w-[320px] border-r border-slate-200 flex flex-col min-h-0 bg-white">
                <div className="p-4 border-b border-slate-100 space-y-3">
                    <div className="relative group">
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input type="text" placeholder="Filter records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredNotes.length === 0 ? (
                        <div className="p-12 text-center text-slate-300 flex flex-col items-center">
                            <BoxIcon className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm font-bold">No records found.</p>
                        </div>
                    ) : (
                        filteredNotes.map(n => (
                            <div key={n.id} onClick={() => setSelectedNoteId(n.id)} className={`group p-4 border-b border-slate-50 cursor-pointer transition-all flex items-start gap-4 ${selectedNoteId === n.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className={`text-sm font-black truncate pr-2 ${n.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{n.title}</h4>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${n.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{n.priority}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{n.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <div className="flex-1 bg-white flex flex-col min-h-0 relative">
                {isCreating ? (
                    <div className="p-10 flex-1 overflow-y-auto animate-fade-in">
                        <form onSubmit={handleSave} className="space-y-8 max-w-2xl mx-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-2xl font-black text-slate-800 uppercase">Drafting Record</h3>
                                <button type="button" onClick={resetForm} className="p-2 text-slate-400 hover:text-red-500"><CloseIcon className="w-6 h-6" /></button>
                            </div>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full p-4 border-2 rounded-2xl font-black text-xl" required />
                            <div className="grid grid-cols-2 gap-6">
                                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-4 border-2 rounded-2xl font-bold">
                                    <option value="bug">Bug Report</option><option value="note">General Note</option><option value="idea">Product Idea</option><option value="task">Operational Task</option>
                                </select>
                                <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full p-4 border-2 rounded-2xl font-bold">
                                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High (Critical)</option>
                                </select>
                            </div>
                            <textarea value={content} onChange={e => setContent(e.target.value)} rows={12} placeholder="Context..." className="w-full p-6 border-2 rounded-[2rem] font-medium leading-relaxed" />
                            <div className="flex justify-end gap-4">
                                <button type="button" onClick={resetForm} className="px-8 py-3 text-slate-400 font-bold uppercase">Discard</button>
                                <button type="submit" className="px-12 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl">Commit Record</button>
                            </div>
                        </form>
                    </div>
                ) : activeNote ? (
                    <div className="p-10 flex-1 overflow-y-auto animate-fade-in custom-scrollbar">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h3 className="text-4xl font-black text-slate-800 leading-tight">{activeNote.title}</h3>
                                <p className="text-sm text-slate-400 mt-2">Last Synchronized: {new Date(activeNote.updatedAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(activeNote)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 border rounded-2xl"><EditIcon className="w-6 h-6"/></button>
                                <button onClick={() => deleteNote(activeNote.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 border rounded-2xl"><DeleteIcon className="w-6 h-6"/></button>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 shadow-inner mb-10">
                            <p className="text-lg text-slate-700 whitespace-pre-wrap leading-relaxed">{activeNote.content}</p>
                        </div>
                        <div className="flex justify-between items-center pt-8 border-t-2 border-slate-50">
                            <button onClick={() => toggleComplete(activeNote.id)} className={`px-10 py-4 rounded-2xl font-black uppercase transition-all flex items-center gap-3 ${activeNote.isCompleted ? 'bg-slate-800 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                                {activeNote.isCompleted ? <RepeatIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                                {activeNote.isCompleted ? 'Reopen' : 'Resolve'}
                            </button>
                            <button onClick={() => copyToClipboard(activeNote.content)} className="flex items-center gap-2 text-indigo-600 font-bold"><CopyIcon className="w-4 h-4"/> Copy Details</button>
                        </div>
                    </div>
                ) : null}
            </div>
            {copyStatus !== 'idle' && (
                <div className="fixed bottom-10 right-10 z-[200] animate-slide-in-right">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 ${copyStatus === 'success' ? 'bg-slate-900 border-emerald-500 text-white' : 'bg-red-900 border-red-500 text-white'}`}>
                        {copyStatus === 'success' ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />}
                        <span className="font-bold text-sm">{copyStatus === 'success' ? 'Copied' : 'Error'}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// Internal Sub-component for Setup Guide
const SetupGuideTab: React.FC<{ profile: BusinessProfile; onUpdateProfile: (p: BusinessProfile) => void }> = ({ profile, onUpdateProfile }) => {
    const updateInfo = (key: keyof BusinessInfo, value: any) => onUpdateProfile({ ...profile, info: { ...profile.info, [key]: value } });
    const updateTax = (key: keyof TaxInfo, value: any) => onUpdateProfile({ ...profile, tax: { ...profile.tax, [key]: value } });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-3 border-b pb-4"><div className="bg-indigo-100 p-2 rounded-lg"><CheckCircleIcon className="w-6 h-6 text-indigo-600" /></div><h2 className="text-xl font-bold text-slate-800">Business Structure</h2></div>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Legal Business Name</label><input type="text" value={profile.info.llcName || ''} onChange={(e) => updateInfo('llcName', e.target.value)} placeholder="My Business LLC" className="w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Industry</label><input type="text" value={profile.info.industry || ''} onChange={(e) => updateInfo('industry', e.target.value)} placeholder="e.g. Software" className="w-full p-2 border rounded-md" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label><select value={profile.info.businessType || ''} onChange={(e) => updateInfo('businessType', e.target.value)} className="w-full p-2 border rounded-md"><option value="">Select...</option><option value="sole-proprietor">Sole Proprietor</option><option value="llc-single">Single-Member LLC</option><option value="s-corp">S-Corp</option></select></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">State</label><input type="text" value={profile.info.stateOfFormation || ''} onChange={(e) => updateInfo('stateOfFormation', e.target.value)} placeholder="DE" className="w-full p-2 border rounded-md" /></div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-3 border-b pb-4"><div className="bg-green-100 p-2 rounded-lg"><CheckCircleIcon className="w-6 h-6 text-green-600" /></div><h2 className="text-xl font-bold text-slate-800">Tax Settings</h2></div>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Tax Filing Status</label><select value={profile.tax.filingStatus || ''} onChange={(e) => updateTax('filingStatus', e.target.value)} className="w-full p-2 border rounded-md"><option value="">Select...</option><option value="sole-proprietor">Sole Proprietor (Schedule C)</option><option value="s-corp">S-Corp (1120-S)</option></select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Tax Year End</label><input type="date" value={profile.tax.taxYearEnd || ''} onChange={(e) => updateTax('taxYearEnd', e.target.value)} className="w-full p-2 border rounded-md" /></div>
                </div>
            </div>
        </div>
    );
};

// Internal Sub-component for Tax Advisor
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
    const [deductions, setDeductions] = useState<string[]>([]);
    const [loadingDeductions, setLoadingDeductions] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const apiKeyAvailable = hasApiKey();
    const activeSession = selectedSessionId ? sessions.find(s => s.id === selectedSessionId) : null;

    useEffect(() => { if (activeSession) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages.length, selectedSessionId]);

    const handleCreateSession = () => {
        const newSession: ChatSession = {
            id: generateUUID(), title: `Consultation ${new Date().toLocaleDateString()}`,
            messages: [{ id: generateUUID(), role: 'ai', content: `Expert Tax Advice ready for **${profile.info.businessType || 'business'}**.`, timestamp: new Date().toISOString() }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
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
        setInput(''); setIsLoading(true);
        try {
            const aiMsgPlaceholder: ChatMessage = { id: generateUUID(), role: 'ai', content: '', timestamp: new Date().toISOString() };
            const sessionWithAi = { ...updatedSession, messages: [...updatedSession.messages, aiMsgPlaceholder] };
            onUpdateSessions([...otherSessions, sessionWithAi]);
            const stream = await streamTaxAdvice(sessionWithAi.messages, profile);
            let fullContent = '';
            for await (const chunk of stream) {
                fullContent += chunk.text;
                const msgs = [...sessionWithAi.messages];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent };
                onUpdateSessions([...otherSessions, { ...sessionWithAi, messages: msgs }]);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    if (!apiKeyAvailable) return <div className="p-8 text-center bg-slate-50 border-dashed border-2 rounded-xl">Missing API_KEY for Advisor.</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[700px]">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center font-bold text-slate-800">
                    <div>Tax Advisor - {activeSession?.title || 'Expert Chat'}</div>
                    <button onClick={handleCreateSession} className="px-3 py-1 bg-white border rounded shadow-sm text-sm"><AddIcon className="w-4 h-4 inline mr-1"/>New</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!activeSession ? <div className="h-full flex items-center justify-center text-slate-400">Select a chat to start</div> : 
                        activeSession.messages.map(m => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                                    <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>') }} />
                                </div>
                            </div>
                        ))}
                    <div ref={messagesEndRef} />
                </div>
                {activeSession && (
                    <div className="p-4 border-t bg-white flex gap-2">
                        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="flex-1 p-2 border rounded-xl" placeholder="Ask about deductions..." />
                        <button onClick={handleSendMessage} className="bg-indigo-600 text-white p-2 rounded-xl"><SendIcon className="w-5 h-5"/></button>
                    </div>
                )}
            </div>
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-yellow-500" /> Deduction Scout</h3>
                    <button onClick={async () => { setLoadingDeductions(true); try { setDeductions(await getIndustryDeductions(profile.info.industry || 'General')); } catch(e){} finally { setLoadingDeductions(false); }}} className="w-full py-2 bg-slate-50 border rounded-lg text-sm font-bold">{loadingDeductions ? 'Scouting...' : 'Find Deductions'}</button>
                    {deductions.length > 0 && <ul className="mt-4 space-y-2">{deductions.map((d, i) => <li key={i} className="text-xs bg-green-50 p-2 rounded border border-green-100 flex gap-2"><CheckCircleIcon className="w-4 h-4 text-green-600" />{d}</li>)}</ul>}
                </div>
            </div>
        </div>
    );
};

// Internal Sub-component for Calendar
const CalendarTab: React.FC<{ profile: BusinessProfile }> = ({ profile }) => {
    const deadlines = [
        { date: 'Jan 31', title: '1099-NEC Deadline', desc: 'Send for payments > $600.' },
        { date: 'Apr 15', title: 'Tax Day', desc: 'Federal income tax deadline.' },
        { date: 'Jun 15', title: 'Q2 Estimates', desc: 'Quarterly payment due.' },
    ];
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h2 className="text-xl font-bold mb-6">Upcoming Deadlines</h2>
            <div className="space-y-4">
                {deadlines.map((d, i) => (
                    <div key={i} className="flex gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border">
                        <div className="text-indigo-600 font-bold w-16">{d.date}</div>
                        <div><div className="font-bold text-slate-800">{d.title}</div><div className="text-sm text-slate-500">{d.desc}</div></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// MAIN BusinessHub Component
const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile, notes, onUpdateNotes, chatSessions, onUpdateChatSessions, transactions, accounts, categories }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'calendar' | 'advisor' | 'journal'>('guide');

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Business Hub</h1>
                <p className="text-slate-500 mt-1">Manage entity details, AI strategy, and engineering logs.</p>
            </div>
            <div className="flex border-b border-slate-200 overflow-x-auto">
                {['guide', 'advisor', 'journal', 'calendar'].map((t: any) => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize ${activeTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>
                        {t === 'guide' ? 'Setup Guide' : t === 'advisor' ? 'Tax Advisor' : t === 'journal' ? 'Journal & Bugs' : 'Calendar'}
                    </button>
                ))}
            </div>
            <div className="min-h-[400px]">
                {activeTab === 'guide' && <SetupGuideTab profile={profile} onUpdateProfile={onUpdateProfile} />}
                {activeTab === 'advisor' && <TaxAdvisorTab profile={profile} sessions={chatSessions} onUpdateSessions={onUpdateChatSessions} transactions={transactions} accounts={accounts} categories={categories} />}
                {activeTab === 'journal' && <JournalTab notes={notes} onUpdateNotes={onUpdateNotes} />}
                {activeTab === 'calendar' && <CalendarTab profile={profile} />}
            </div>
        </div>
    );
};

export default BusinessHub;
