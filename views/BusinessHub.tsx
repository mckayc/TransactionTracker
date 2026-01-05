
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo, ChatSession, ChatMessage, Transaction, Account, Category, BusinessNote } from '../types';
// Fixed missing icon imports: BoxIcon and RepeatIcon
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

const JournalTab: React.FC<{ notes: BusinessNote[]; onUpdateNotes: (n: BusinessNote[]) => void }> = ({ notes, onUpdateNotes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClassification, setActiveClassification] = useState<string>('bug'); // Default to Bugs
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());
    const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<BusinessNote['type']>('bug'); // Default type to bug
    const [priority, setPriority] = useState<BusinessNote['priority']>('medium');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Grouping & Filtering
    const filteredNotes = useMemo(() => {
        return notes.filter(n => {
            const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (activeClassification === 'resolved') return n.isCompleted && matchesSearch;
            
            // Logic: if resolved, it goes to Resolved tab regardless of type
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
        onUpdateNotes(notes.map(n => n.id === id ? { 
            ...n, isCompleted: !n.isCompleted, resolvedAt: !n.isCompleted ? now : undefined, updatedAt: now 
        } : n));
    };

    const deleteNote = (id: string) => {
        if (confirm("Permanently delete this item?")) {
            onUpdateNotes(notes.filter(n => n.id !== id));
            if (selectedNoteId === id) setSelectedNoteId(null);
            const newBatch = new Set(batchSelection);
            newBatch.delete(id);
            setBatchSelection(newBatch);
        }
    };

    const toggleBatchSelection = (id: string) => {
        const newBatch = new Set(batchSelection);
        if (newBatch.has(id)) newBatch.delete(id);
        else newBatch.add(id);
        setBatchSelection(newBatch);
    };

    const selectAllInClassification = () => {
        const allInViewIds = filteredNotes.map(n => n.id);
        const areAllSelected = allInViewIds.every(id => batchSelection.has(id));
        
        const newBatch = new Set(batchSelection);
        if (areAllSelected) {
            allInViewIds.forEach(id => newBatch.delete(id));
        } else {
            allInViewIds.forEach(id => newBatch.add(id));
        }
        setBatchSelection(newBatch);
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

    const handleBulkCopy = (formatForAi: boolean) => {
        const selectedNotes = notes.filter(n => batchSelection.has(n.id));
        if (selectedNotes.length === 0) return;

        let text = "";
        if (formatForAi) {
            text = "SYSTEM ANALYSIS REQUEST: Please review the following engineering records and provide architectural feedback or bug fixes:\n\n";
            selectedNotes.forEach((n, i) => {
                text += `${i + 1}. [${n.type.toUpperCase()}] ${n.title}\n`;
                text += `   Severity/Priority: ${n.priority}\n`;
                text += `   Log Details: ${n.content}\n\n`;
            });
        } else {
            text = selectedNotes.map(n => `Title: ${n.title}\nType: ${n.type}\nStatus: ${n.isCompleted ? 'Resolved' : 'Active'}\nDetails: ${n.content}`).join('\n\n---\n\n');
        }
        copyToClipboard(text);
    };

    const classificationStats = useMemo(() => {
        return {
            bug: notes.filter(n => n.type === 'bug' && !n.isCompleted).length,
            note: notes.filter(n => n.type === 'note' && !n.isCompleted).length,
            idea: notes.filter(n => n.type === 'idea' && !n.isCompleted).length,
            task: notes.filter(n => n.type === 'task' && !n.isCompleted).length,
            resolved: notes.filter(n => n.isCompleted).length
        };
    }, [notes]);

    return (
        <div className="flex gap-6 h-[750px] bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden relative">
            
            {/* SIDEBAR: NAV & CLASSIFICATIONS */}
            <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col p-6 flex-shrink-0">
                <button 
                    onClick={() => setIsCreating(true)}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 mb-8 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95"
                >
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
                        <button 
                            key={item.id}
                            onClick={() => setActiveClassification(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeClassification === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'}`}
                        >
                            <div className="flex items-center gap-3">
                                {item.icon}
                                <span>{item.label}</span>
                            </div>
                            <span className={`text-[10px] px-1.5 rounded-full ${activeClassification === item.id ? 'bg-indigo-100' : 'bg-slate-200'}`}>{(classificationStats as any)[item.id]}</span>
                        </button>
                    ))}

                    <div className="pt-6 mt-6 border-t border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">History</p>
                        <button 
                            onClick={() => setActiveClassification('resolved')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeClassification === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-200/50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <CheckCircleIcon className="w-4 h-4" />
                                <span>Archive</span>
                            </div>
                            <span className="text-[10px] bg-slate-200 px-1.5 rounded-full">{classificationStats.resolved}</span>
                        </button>
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-200">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-inner">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter mb-2">Cloud Synced</p>
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span className="text-[10px] font-bold text-slate-500">Local Integrity OK</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* LIST: MASTER VIEW */}
            <div className="w-1/3 min-w-[320px] border-r border-slate-200 flex flex-col min-h-0 bg-white">
                <div className="p-4 border-b border-slate-100 space-y-3">
                    <div className="relative group">
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500" />
                        <input 
                            type="text" 
                            placeholder="Filter records..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-0 focus:border-indigo-500 transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-between px-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                checked={filteredNotes.length > 0 && filteredNotes.every(n => batchSelection.has(n.id))} 
                                onChange={selectAllInClassification}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-200"
                            />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select All</span>
                        </label>
                        {batchSelection.size > 0 && (
                            <button onClick={() => setBatchSelection(new Set())} className="text-[10px] font-bold text-indigo-600 hover:underline">Clear ({batchSelection.size})</button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredNotes.length === 0 ? (
                        <div className="p-12 text-center text-slate-300 flex flex-col items-center">
                            <BoxIcon className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm font-bold">No records found.</p>
                        </div>
                    ) : (
                        filteredNotes.map(n => (
                            <div 
                                key={n.id}
                                onClick={() => setSelectedNoteId(n.id)}
                                className={`group p-4 border-b border-slate-50 cursor-pointer transition-all flex items-start gap-4 ${selectedNoteId === n.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex-shrink-0 mt-1" onClick={e => { e.stopPropagation(); toggleBatchSelection(n.id); }}>
                                    <input 
                                        type="checkbox" 
                                        checked={batchSelection.has(n.id)} 
                                        onChange={() => {}} 
                                        className="w-4 h-4 rounded border-slate-200 pointer-events-none" 
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className={`text-sm font-black truncate pr-2 ${n.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{n.title}</h4>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${n.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{n.priority}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{n.content}</p>
                                    <p className="text-[9px] text-slate-400 mt-2 font-mono uppercase font-bold">{new Date(n.updatedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {batchSelection.size > 0 && (
                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center animate-slide-up">
                        <span className="text-xs font-black">{batchSelection.size} Selected</span>
                        <div className="flex gap-3">
                            <button onClick={() => handleBulkCopy(true)} className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500" title="Copy for AI"><SparklesIcon className="w-4 h-4"/></button>
                            <button onClick={() => handleBulkCopy(false)} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600" title="Copy Text"><CopyIcon className="w-4 h-4"/></button>
                        </div>
                    </div>
                )}
            </div>

            {/* DETAIL: INSPECTOR VIEW */}
            <div className="flex-1 bg-white flex flex-col min-h-0 relative">
                {isCreating ? (
                    <div className="p-10 flex-1 overflow-y-auto animate-fade-in">
                        <form onSubmit={handleSave} className="space-y-8 max-w-2xl mx-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Drafting Record</h3>
                                <button type="button" onClick={resetForm} className="p-2 text-slate-400 hover:text-red-500"><CloseIcon className="w-6 h-6" /></button>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Title</label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    placeholder="Enter descriptive subject..." 
                                    className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black text-xl focus:border-indigo-500 outline-none transition-all"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Category</label>
                                    <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700">
                                        <option value="bug">Bug Report</option>
                                        <option value="note">General Note</option>
                                        <option value="idea">Product Idea</option>
                                        <option value="task">Operational Task</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Priority</label>
                                    <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High (Critical)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Context / Description</label>
                                <textarea 
                                    value={content} 
                                    onChange={e => setContent(e.target.value)} 
                                    rows={12}
                                    placeholder="Provide detailed logs or context..."
                                    className="w-full p-6 border-2 border-slate-100 rounded-[2rem] font-medium leading-relaxed focus:bg-slate-50 transition-colors focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                                <button type="button" onClick={resetForm} className="px-8 py-3 text-slate-400 font-bold uppercase tracking-widest">Discard</button>
                                <button type="submit" className="px-12 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">Commit Record</button>
                            </div>
                        </form>
                    </div>
                ) : activeNote ? (
                    <div className="p-10 flex-1 overflow-y-auto animate-fade-in custom-scrollbar">
                        <div className="flex justify-between items-start mb-10">
                            <div className="max-w-[80%]">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${activeNote.type === 'bug' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>{activeNote.type}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${activeNote.priority === 'high' ? 'text-red-500' : 'text-slate-400'}`}>{activeNote.priority} priority</span>
                                </div>
                                <h3 className="text-4xl font-black text-slate-800 leading-tight">{activeNote.title}</h3>
                                <div className="flex items-center gap-6 mt-6">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Initial Discovery</span>
                                        <span className="text-xs font-bold text-slate-500">{new Date(activeNote.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Last Synchronized</span>
                                        <span className="text-xs font-bold text-slate-500">{new Date(activeNote.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(activeNote)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-2xl transition-all" title="Edit"><EditIcon className="w-6 h-6"/></button>
                                <button onClick={() => deleteNote(activeNote.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-2xl transition-all" title="Delete"><DeleteIcon className="w-6 h-6"/></button>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 shadow-inner mb-10">
                            <p className="text-lg text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{activeNote.content}</p>
                        </div>

                        <div className="flex justify-between items-center pt-8 border-t-2 border-slate-50">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => toggleComplete(activeNote.id)}
                                    className={`px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${activeNote.isCompleted ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                >
                                    {activeNote.isCompleted ? <RepeatIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                                    {activeNote.isCompleted ? 'Move to Backlog' : 'Resolve & Archive'}
                                </button>
                                {activeNote.isCompleted && (
                                    <p className="text-[10px] font-bold text-slate-400 italic">Resolved on {new Date(activeNote.resolvedAt!).toLocaleDateString()}</p>
                                )}
                            </div>
                            <button 
                                onClick={() => copyToClipboard(`Subject: ${activeNote.title}\n\nContext: ${activeNote.content}`)}
                                className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:underline"
                            >
                                <CopyIcon className="w-4 h-4"/> Copy Details
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 animate-bounce-subtle">
                             <BoxIcon className="w-12 h-12 text-indigo-100" />
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">System Selection Required</h4>
                        <p className="text-slate-400 max-w-sm mt-3 font-bold">Select a record from the master list to view technical documentation and status information.</p>
                        <button onClick={() => setIsCreating(true)} className="mt-10 text-indigo-600 font-black uppercase tracking-widest text-xs border-b-4 border-indigo-100 pb-1 hover:border-indigo-500 transition-all">Or create new entry</button>
                    </div>
                )}
            </div>

            {/* Copy Success Toast Overlay */}
            {copyStatus !== 'idle' && (
                <div className="fixed bottom-10 right-10 z-[200] animate-slide-in-right">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 ${copyStatus === 'success' ? 'bg-slate-900 border-emerald-500 text-white' : 'bg-red-900 border-red-500 text-white'}`}>
                        {copyStatus === 'success' ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />}
                        <span className="font-bold text-sm">{copyStatus === 'success' ? 'Copied to clipboard' : 'System error'}</span>
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
