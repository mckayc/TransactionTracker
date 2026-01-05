
import React, { useState, useEffect, useRef } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo, ChatSession, ChatMessage, Transaction, Account, Category, BusinessNote } from '../types';
import { CheckCircleIcon, SparklesIcon, CurrencyDollarIcon, SendIcon, ExclamationTriangleIcon, AddIcon, DeleteIcon, ChatBubbleIcon, CloudArrowUpIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, SortIcon, ChevronDownIcon, CloseIcon, CopyIcon, TableIcon } from '../components/Icons';
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

const JournalTab: React.FC<{ notes: BusinessNote[]; onUpdateNotes: (n: BusinessNote[]) => void }> = ({ notes, onUpdateNotes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [isCreating, setIsCreating] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<BusinessNote['type']>('note');
    const [priority, setPriority] = useState<BusinessNote['priority']>('medium');
    const [editingId, setEditingId] = useState<string | null>(null);

    const filteredNotes = notes.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' ? true : n.type === filterType;
        return matchesSearch && matchesType;
    }).sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        const now = new Date().toISOString();
        if (editingId) {
            onUpdateNotes(notes.map(n => n.id === editingId ? { 
                ...n, title, content, type, priority, updatedAt: now 
            } : n));
        } else {
            const newNote: BusinessNote = {
                id: generateUUID(),
                title, content, type, priority,
                isCompleted: false,
                createdAt: now,
                updatedAt: now
            };
            onUpdateNotes([newNote, ...notes]);
        }
        resetForm();
    };

    const resetForm = () => {
        setTitle(''); setContent(''); setType('note'); setPriority('medium');
        setEditingId(null); setIsCreating(false);
    };

    const startEdit = (n: BusinessNote) => {
        setEditingId(n.id); setTitle(n.title); setContent(n.content);
        setType(n.type); setPriority(n.priority); setIsCreating(true);
    };

    const toggleComplete = (id: string) => {
        const now = new Date().toISOString();
        onUpdateNotes(notes.map(n => n.id === id ? { 
            ...n, isCompleted: !n.isCompleted, resolvedAt: !n.isCompleted ? now : undefined, updatedAt: now 
        } : n));
    };

    const deleteNote = (id: string) => {
        if (confirm("Permanently delete this item?")) {
            onUpdateNotes(notes.filter(n => n.id !== id));
            const newSelected = new Set(selectedIds);
            newSelected.delete(id);
            setSelectedIds(newSelected);
        }
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const handleBulkCopy = (formatForAi: boolean) => {
        const selectedNotes = notes.filter(n => selectedIds.has(n.id));
        if (selectedNotes.length === 0) return;

        let text = "";
        if (formatForAi) {
            text = "I have the following bugs/tasks recorded in my application that need addressing. Please provide solutions or code fixes for each:\n\n";
            selectedNotes.forEach((n, i) => {
                text += `${i + 1}. [${n.type.toUpperCase()}] ${n.title}\n`;
                text += `   Priority: ${n.priority}\n`;
                text += `   Details: ${n.content}\n\n`;
            });
            text += "Please analyze these technical requirements and provide implementation advice.";
        } else {
            text = selectedNotes.map(n => `${n.title}\n${n.content}`).join('\n\n');
        }

        navigator.clipboard.writeText(text);
        alert(`Copied ${selectedNotes.length} items to clipboard ${formatForAi ? 'formatted for AI' : ''}!`);
    };

    return (
        <div className="space-y-6 relative pb-24">
            {/* Expanded Search Area */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <SearchCircleIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search notes, bugs, or ideas by keyword..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-12 py-4 w-full bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 transition-all font-medium text-lg"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <select 
                            value={filterType} 
                            onChange={e => setFilterType(e.target.value)}
                            className="bg-white border-2 border-slate-100 rounded-2xl p-3 text-sm font-bold text-slate-700 min-w-[160px] h-[60px]"
                        >
                            <option value="all">All Items</option>
                            <option value="note">Notes Only</option>
                            <option value="bug">Bugs Only</option>
                            <option value="idea">Ideas Only</option>
                            <option value="task">Tasks Only</option>
                        </select>
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-100 transition-all h-[60px] whitespace-nowrap"
                        >
                            <AddIcon className="w-5 h-5" /> New Entry
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-between px-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Showing {filteredNotes.length} of {notes.length} entries
                    </div>
                    {selectedIds.size > 0 && (
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-indigo-600 hover:underline">
                            Deselect all ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            {isCreating && (
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl animate-slide-up">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">{editingId ? 'Edit Entry' : 'New Journal Entry'}</h3>
                            <button type="button" onClick={resetForm} className="p-2 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block">Entry Title</label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    placeholder="e.g. Bug: Mobile drawer is overlapping the footer" 
                                    className="w-full font-bold p-3 border-2 border-slate-100 rounded-xl"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block">Classification</label>
                                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-xl">
                                    <option value="note">General Note</option>
                                    <option value="bug">Bug Report</option>
                                    <option value="idea">Future Idea</option>
                                    <option value="task">Business Task</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block">Priority Level</label>
                                <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full p-3 border-2 border-slate-100 rounded-xl">
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block">Content / Technical Details</label>
                                <textarea 
                                    value={content} 
                                    onChange={e => setContent(e.target.value)} 
                                    rows={6} 
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl focus:bg-white transition-all font-mono text-sm"
                                    placeholder="Describe the bug steps or write your notes here..."
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={resetForm} className="px-6 py-2 text-sm font-bold text-slate-500">Cancel</button>
                            <button type="submit" className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100">Save Entry</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNotes.length === 0 ? (
                    <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <NotesIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Entries Found</p>
                        <p className="text-xs text-slate-400 mt-1">Refine your search or create a new entry.</p>
                    </div>
                ) : (
                    filteredNotes.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => toggleSelection(n.id)}
                            className={`p-6 rounded-3xl border-2 transition-all group flex flex-col h-full bg-white relative cursor-pointer ${
                                selectedIds.has(n.id) ? 'border-indigo-500 ring-2 ring-indigo-100' : 
                                n.isCompleted ? 'opacity-60 border-slate-100 grayscale' : 
                                n.priority === 'high' ? 'border-red-100 shadow-sm shadow-red-50' : 'border-slate-100 hover:border-indigo-200 hover:shadow-md'
                            }`}
                        >
                            {/* Selection Checkbox */}
                            <div className="absolute top-4 right-4">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.has(n.id)} 
                                    onChange={() => {}} // Handled by div click
                                    className="w-5 h-5 rounded-md text-indigo-600 border-slate-300 focus:ring-indigo-500 pointer-events-none"
                                />
                            </div>

                            <div className="flex justify-between items-start mb-4 pr-8">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${
                                        n.type === 'bug' ? 'bg-red-50 text-red-600' : 
                                        n.type === 'idea' ? 'bg-purple-50 text-purple-600' : 
                                        n.type === 'task' ? 'bg-blue-50 text-blue-600' : 
                                        'bg-slate-50 text-slate-600'
                                    }`}>
                                        {n.type === 'bug' ? <BugIcon className="w-5 h-5" /> : <NotesIcon className="w-5 h-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className={`font-bold text-slate-800 leading-tight truncate max-w-[200px] ${n.isCompleted ? 'line-through' : ''}`}>{n.title}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400">{n.type}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className={`text-[9px] font-black uppercase tracking-tighter ${
                                                n.priority === 'high' ? 'text-red-500' : 
                                                n.priority === 'medium' ? 'text-amber-500' : 
                                                'text-slate-400'
                                            }`}>{n.priority} priority</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => startEdit(n)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><EditIcon className="w-4 h-4"/></button>
                                    <button onClick={() => deleteNote(n.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><DeleteIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                            
                            <p className={`text-sm text-slate-600 flex-grow whitespace-pre-wrap mb-6 line-clamp-6 ${n.isCompleted ? 'line-through opacity-50' : ''}`}>{n.content}</p>
                            
                            <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center" onClick={e => e.stopPropagation()}>
                                <div className="text-[10px] text-slate-400 font-mono">
                                    {n.isCompleted ? `Resolved: ${new Date(n.resolvedAt!).toLocaleDateString()}` : `Created: ${new Date(n.createdAt).toLocaleDateString()}`}
                                </div>
                                <button 
                                    onClick={() => toggleComplete(n.id)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        n.isCompleted ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-700 hover:bg-green-100'
                                    }`}
                                >
                                    {n.isCompleted ? 'Reopen' : n.type === 'bug' ? 'Mark Resolved' : 'Done'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] animate-slide-up">
                    <div className="bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 border-2 border-white/10 backdrop-blur-xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Selection</span>
                            <span className="text-sm font-bold">{selectedIds.size} items active</span>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleBulkCopy(false)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all"
                            >
                                <CopyIcon className="w-4 h-4" /> Copy Raw
                            </button>
                            <button 
                                onClick={() => handleBulkCopy(true)}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-900/40"
                            >
                                <SparklesIcon className="w-4 h-4" /> Copy for AI Fix
                            </button>
                        </div>
                        <button onClick={() => setSelectedIds(new Set())} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <CloseIcon className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

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
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Formation Date</label>
                        <input 
                            type="date" 
                            value={profile.info.formationDate || ''} 
                            onChange={(e) => updateInfo('formationDate', e.target.value)}
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
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Accountant Contact</label>
                        <input 
                            type="text" 
                            value={profile.tax.accountantName || ''} 
                            onChange={(e) => updateTax('accountantName', e.target.value)}
                            placeholder="Name or Email"
                            className="w-full p-2 border rounded-md"
                        />
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                    <p className="font-semibold mb-1">Pro Tip:</p>
                    <p>Keep your EIN letter and Articles of Organization handy. You'll need them for opening bank accounts and applying for credit.</p>
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
    
    // Sort sessions by update time (most recent first)
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [deductions, setDeductions] = useState<string[]>([]);
    const [loadingDeductions, setLoadingDeductions] = useState(false);
    
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
                content: `Hello! I am your AI Tax Advisor. I see you are operating as a **${profile.info.businessType || 'business'}** in **${profile.info.stateOfFormation || 'your state'}**. How can I help you today?`,
                timestamp: new Date().toISOString()
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        onUpdateSessions([...sessions, newSession]);
        setSelectedSessionId(newSession.id);
    };

    const handleDeleteSession = (sessionId: string) => {
        if (confirm("Delete this chat history?")) {
            const updated = sessions.filter(s => s.id !== sessionId);
            onUpdateSessions(updated);
            if (selectedSessionId === sessionId) setSelectedSessionId(null);
        }
    };

    const handleRenameSession = (sessionId: string) => {
        const newName = prompt("Rename chat session:", sessions.find(s => s.id === sessionId)?.title);
        if (newName && newName.trim()) {
            const updated = sessions.map(s => s.id === sessionId ? { ...s, title: newName.trim() } : s);
            onUpdateSessions(updated);
        }
    };

    const handleSyncData = async () => {
        if (!activeSession) return;
        
        // Prepare summary data to inject
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));
        const accountMap = new Map(accounts.map(a => [a.id, a.name]));
        
        // Calculate totals
        const income = transactions.reduce((sum, tx) => sum + (tx.typeId.includes('income') ? tx.amount : 0), 0);
        const expense = transactions.reduce((sum, tx) => sum + (tx.typeId.includes('expense') ? tx.amount : 0), 0);
        
        // Recent 100 transactions for context
        const recentTxs = transactions
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 100)
            .map(tx => ({
                date: tx.date,
                desc: tx.description,
                amt: tx.amount,
                cat: categoryMap.get(tx.categoryId) || 'Unknown',
                acct: accountMap.get(tx.accountId || '') || 'Unknown'
            }));

        const dataPackage = {
            summary: {
                totalIncome: income,
                totalExpense: expense,
                netIncome: income - expense,
                accountCount: accounts.length,
                transactionCount: transactions.length
            },
            recentTransactions: recentTxs
        };

        const syncMessage = `
**System Data Sync:**
I am sharing my current financial data with you for analysis.
- Total Income: $${income.toFixed(2)}
- Total Expense: $${expense.toFixed(2)}
- Accounts: ${accounts.map(a => a.name).join(', ')}

Please use the provided JSON context of my last 100 transactions to answer my next questions.
\`\`\`json
${JSON.stringify(dataPackage).slice(0, 15000)} ... (truncated if too long)
\`\`\`
        `;

        const userMsg: ChatMessage = {
            id: generateUUID(),
            role: 'user',
            content: syncMessage,
            timestamp: new Date().toISOString()
        };

        const updatedSession = { 
            ...activeSession, 
            messages: [...activeSession.messages, userMsg],
            updatedAt: new Date().toISOString()
        };
        
        const otherSessions = sessions.filter(s => s.id !== activeSession.id);
        onUpdateSessions([...otherSessions, updatedSession]);
        
        // Trigger AI response acknowledging receipt
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
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || !activeSession || isLoading) return;

        const userMsg: ChatMessage = {
            id: generateUUID(),
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
        };

        const updatedSession = { 
            ...activeSession, 
            messages: [...activeSession.messages, userMsg],
            updatedAt: new Date().toISOString()
        };
        
        const otherSessions = sessions.filter(s => s.id !== activeSession.id);
        onUpdateSessions([...otherSessions, updatedSession]);
        
        setInput('');
        setIsLoading(true);

        try {
            const aiMsgId = generateUUID();
            const aiMsgPlaceholder: ChatMessage = {
                id: aiMsgId,
                role: 'ai',
                content: '',
                timestamp: new Date().toISOString()
            };
            
            const sessionWithAi = {
                ...updatedSession,
                messages: [...updatedSession.messages, aiMsgPlaceholder]
            };
            onUpdateSessions([...otherSessions, sessionWithAi]);

            const stream = await streamTaxAdvice(updatedSession.messages, profile);
            let fullContent = '';
            
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullContent += chunkText;
                const currentSession = sessionWithAi;
                const msgs = [...currentSession.messages];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent };
                onUpdateSessions([...otherSessions, { ...currentSession, messages: msgs }]);
            }

        } catch (error) {
            console.error("Chat error", error);
             const errorMsg: ChatMessage = {
                id: generateUUID(),
                role: 'ai',
                content: "I apologize, but I encountered an error connecting to the service. Please try again.",
                timestamp: new Date().toISOString()
            };
            onUpdateSessions([...otherSessions, { ...updatedSession, messages: [...updatedSession.messages, errorMsg] }]);
        } finally {
            setIsLoading(false);
        }
    };

    const generateDeductions = async () => {
        if (!profile.info.industry) {
            alert('Please enter an Industry in the Setup Guide tab first.');
            return;
        }
        setLoadingDeductions(true);
        try {
            const list = await getIndustryDeductions(profile.info.industry);
            setDeductions(list);
        } catch (e) {
            console.error(e);
            alert('Could not generate deductions list.');
        } finally {
            setLoadingDeductions(false);
        }
    };

    const complianceItems = [
        { task: 'File Annual Report', note: `Required in most states (like ${profile.info.stateOfFormation || 'yours'}).` },
        { task: 'Pay Estimated Taxes', note: 'Quarterly (Apr, Jun, Sep, Jan) if you owe >$1000.' },
        { task: 'Renew Business License', note: 'Check your local city/county requirements.' },
        { task: 'File Beneficial Ownership Info (BOI)', note: 'New FinCEN requirement for most LLCs.' },
    ];

    if (!apiKeyAvailable) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <ExclamationTriangleIcon className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">API Key Missing</h3>
                <p className="text-slate-500 mt-2 max-w-md">
                    The Tax Advisor and Deduction Scout features rely on AI. Please configure the <code className="bg-slate-200 px-1 rounded">API_KEY</code> environment variable to unlock these tools.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start h-[700px]">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <CurrencyDollarIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">Tax Advisor</h2>
                            <p className="text-xs text-slate-500">
                                {activeSession ? activeSession.title : 'Select a conversation'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {activeSession && (
                            <button 
                                onClick={handleSyncData}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 shadow-sm transition-colors"
                                title="Send current financial data to AI context"
                            >
                                <CloudArrowUpIcon className="w-4 h-4" /> Sync Data
                            </button>
                        )}
                        <button 
                            onClick={handleCreateSession}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 shadow-sm"
                        >
                            <AddIcon className="w-4 h-4"/> New Chat
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-64 border-r border-slate-100 bg-slate-50 flex-col overflow-y-auto hidden md:flex">
                        <div className="p-3">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">History</p>
                            {sortedSessions.length === 0 ? (
                                <p className="text-sm text-slate-400 px-2 italic">No past chats.</p>
                            ) : (
                                sortedSessions.map(session => (
                                    <div 
                                        key={session.id}
                                        onClick={() => setSelectedSessionId(session.id)}
                                        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm mb-1 ${selectedSessionId === session.id ? 'bg-white shadow-sm text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate flex-grow">
                                            <ChatBubbleIcon className="w-4 h-4 flex-shrink-0 opacity-50" />
                                            <span className="truncate">{session.title}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); handleRenameSession(session.id); }} className="p-1 text-slate-400 hover:text-indigo-600"><EditIcon className="w-3 h-3" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }} className="p-1 text-slate-400 hover:text-red-500"><DeleteIcon className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-white relative">
                        {!activeSession ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <SparklesIcon className="w-12 h-12 text-indigo-200 mb-4" />
                                <h3 className="text-lg font-bold text-slate-700">Expert Tax Guidance</h3>
                                <p className="text-slate-500 max-w-sm mt-2 mb-6">Ask about tax obligations, deductions, or quarterly plans.</p>
                                <button onClick={handleCreateSession} className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 shadow-lg transition-transform hover:-translate-y-1">Start Consultation</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {activeSession.messages.map((msg) => (
                                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                                                <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                                <p className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-slate-100 p-3 rounded-2xl rounded-bl-none">
                                                <div className="flex gap-1"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span></div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 border-t border-slate-100 bg-white">
                                    <div className="flex gap-2">
                                        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask a follow-up question..." className="flex-grow p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 focus:bg-white transition-colors" disabled={isLoading} />
                                        <button onClick={handleSendMessage} disabled={isLoading || !input.trim()} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 shadow-sm"><SendIcon className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6 lg:h-full lg:overflow-y-auto">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4"><SparklesIcon className="w-5 h-5 text-yellow-500" /><h3 className="font-bold text-slate-800">Deduction Scout</h3></div>
                    <p className="text-sm text-slate-600 mb-4"> tailored to <strong>{profile.info.industry || 'General'}</strong>.</p>
                    {deductions.length > 0 ? (
                         <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                            {deductions.map((d, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 bg-green-50 p-2 rounded-md border border-green-100"><CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /><span>{d}</span></li>
                            ))}
                        </ul>
                    ) : (
                        <button onClick={generateDeductions} disabled={loadingDeductions} className="w-full py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 mb-4 text-sm">{loadingDeductions ? 'Scouting...' : 'Find Deductions'}</button>
                    )}
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex items-center gap-2 mb-4"><CheckCircleIcon className="w-5 h-5 text-blue-500" /><h3 className="font-bold text-slate-800">Compliance Checklist</h3></div>
                    <ul className="space-y-3">
                        {complianceItems.map((item, i) => (
                            <li key={i} className="text-sm"><div className="font-medium text-slate-800">{item.task}</div><div className="text-xs text-slate-500">{item.note}</div></li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

const CalendarTab: React.FC<{ profile: BusinessProfile }> = ({ profile }) => {
    const entityType = profile.info.businessType;
    const deadlines = [
        { date: 'Jan 31', title: 'Form 1099-NEC Deadline', description: 'Send 1099s to contractors paid over $600.' },
        { date: 'Mar 15', title: 'S-Corp & Partnership Filing', description: 'Deadline for Form 1120-S and Form 1065.', type: ['s-corp', 'partnership', 'llc-multi'] },
        { date: 'Apr 15', title: 'Individual & C-Corp Filing', description: 'Deadline for Form 1040 and Form 1120.', type: ['sole-proprietor', 'c-corp', 'llc-single'] },
        { date: 'Apr 15', title: 'Q1 Estimated Tax', description: 'Payment for income earned Jan 1 - Mar 31.' },
        { date: 'Jun 15', title: 'Q2 Estimated Tax', description: 'Payment for income earned Apr 1 - May 31.' },
        { date: 'Sep 15', title: 'Q3 Estimated Tax', description: 'Payment for income earned Jun 1 - Aug 31.' },
        { date: 'Jan 15', title: 'Q4 Estimated Tax', description: 'Payment for income earned Sep 1 - Dec 31.' },
    ];
    const relevantDeadlines = deadlines.filter(d => !d.type || (entityType && d.type.includes(entityType)));
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-700 mb-4">Tax Calendar</h2>
                <div className="space-y-4">
                    {relevantDeadlines.map((event, index) => (
                        <div key={index} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                            <div className="flex-shrink-0 w-16 text-center"><span className="block text-sm font-bold text-indigo-600">{event.date}</span></div>
                            <div><h3 className="text-sm font-bold text-slate-800">{event.title}</h3><p className="text-sm text-slate-600">{event.description}</p></div>
                        </div>
                    ))}
                </div>
            </div>
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-start gap-3">
                <SparklesIcon className="w-6 h-6 text-indigo-500 flex-shrink-0 mt-1" />
                <div><h3 className="font-bold text-sm text-slate-800">Estimated Taxes?</h3><p className="text-sm text-slate-600 mt-1">IRS requires quarterly payments if you expect to owe &gt;$1,000.</p></div>
            </div>
        </div>
    );
}

const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile, notes, onUpdateNotes, chatSessions, onUpdateChatSessions, transactions, accounts, categories }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'calendar' | 'advisor' | 'journal'>('guide');

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Business Hub</h1>
                <p className="text-slate-500 mt-1">Manage your entity details, tax strategy, compliance, and developer logs.</p>
            </div>

            <div className="flex border-b border-slate-200 overflow-x-auto">
                <button onClick={() => setActiveTab('guide')} className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'guide' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Setup Guide</button>
                <button onClick={() => setActiveTab('advisor')} className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'advisor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Tax Advisor</button>
                <button onClick={() => setActiveTab('journal')} className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'journal' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Journal & Bugs</button>
                <button onClick={() => setActiveTab('calendar')} className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'calendar' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Tax Calendar</button>
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
