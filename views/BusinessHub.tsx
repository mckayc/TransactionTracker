
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
            setBatchSelection(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const toggleBatchSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setBatchSelection(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllVisible = () => {
        if (batchSelection.size === filteredNotes.length && filteredNotes.length > 0) {
            setBatchSelection(new Set());
        } else {
            setBatchSelection(new Set(filteredNotes.map(n => n.id)));
        }
    };

    /**
     * Optimized clipboard function with fallback for insecure (HTTP) contexts.
     * Essential for self-hosted apps running on IPs/Internal domains.
     */
    const copyToClipboard = async (text: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                // High-perf modern way
                await navigator.clipboard.writeText(text);
            } else {
                // Robust Fallback for HTTP environments
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (!success) throw new Error("Fallback copy failed");
            }
            setCopyStatus('success');
            setTimeout(() => setCopyStatus('idle'), 3000);
        } catch (err) {
            console.error("Clipboard Error:", err);
            setCopyStatus('error');
            setTimeout(() => setCopyStatus('idle'), 3000);
        }
    };

    const handleBulkCopy = (forAi: boolean) => {
        const selected = notes.filter(n => batchSelection.has(n.id));
        if (selected.length === 0) return;

        let text = forAi ? "Analyze the following engineering logs/notes for architectural insights or bug fixes:\n\n" : "";
        selected.forEach((n, idx) => {
            text += `[${n.type.toUpperCase()}] ${n.title}\n`;
            if (forAi) text += `Priority: ${n.priority} | Status: ${n.isCompleted ? 'Resolved' : 'Active'}\n`;
            text += `${n.content}\n\n---\n\n`;
        });

        copyToClipboard(text.trim());
    };

    const classificationStats = useMemo(() => ({
        bug: notes.filter(n => n.type === 'bug' && !n.isCompleted).length,
        note: notes.filter(n => n.type === 'note' && !n.isCompleted).length,
        idea: notes.filter(n => n.type === 'idea' && !n.isCompleted).length,
        task: notes.filter(n => n.type === 'task' && !n.isCompleted).length,
        resolved: notes.filter(n => n.isCompleted).length
    }), [notes]);

    return (
        <div className="flex gap-4 h-[700px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden relative">
            {/* SIDEBAR: CLASSIFICATIONS */}
            <div className="w-52 bg-slate-50 border-r border-slate-200 flex flex-col p-3 flex-shrink-0">
                <button onClick={() => setIsCreating(true)} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md mb-6 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 text-xs">
                    <AddIcon className="w-3.5 h-3.5" /> New Capture
                </button>
                <div className="space-y-0.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Classification</p>
                    {[
                        { id: 'bug', label: 'Bugs', icon: <BugIcon className="w-3.5 h-3.5" /> },
                        { id: 'note', label: 'Notes', icon: <NotesIcon className="w-3.5 h-3.5" /> },
                        { id: 'idea', label: 'Ideas', icon: <LightBulbIcon className="w-3.5 h-3.5" /> },
                        { id: 'task', label: 'Tasks', icon: <ChecklistIcon className="w-3.5 h-3.5" /> }
                    ].map(item => (
                        <button key={item.id} onClick={() => { setActiveClassification(item.id); setSelectedNoteId(null); setBatchSelection(new Set()); }} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${activeClassification === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'}`}>
                            <div className="flex items-center gap-2">
                                {item.icon}
                                <span>{item.label}</span>
                            </div>
                            <span className={`text-[10px] px-1.5 rounded-full ${activeClassification === item.id ? 'bg-indigo-100' : 'bg-slate-200'}`}>{(classificationStats as any)[item.id]}</span>
                        </button>
                    ))}
                    <div className="pt-3 mt-3 border-t border-slate-200">
                        <button onClick={() => { setActiveClassification('resolved'); setSelectedNoteId(null); setBatchSelection(new Set()); }} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${activeClassification === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                            <div className="flex items-center gap-2"><CheckCircleIcon className="w-3.5 h-3.5" /><span>Archive</span></div>
                            <span className="text-[10px] bg-slate-200 px-1.5 rounded-full">{classificationStats.resolved}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* LIST: MASTER VIEW */}
            <div className="w-72 border-r border-slate-200 flex flex-col min-h-0 bg-white">
                <div className="p-3 border-b border-slate-100 space-y-2">
                    <div className="relative group">
                        <SearchCircleIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input type="text" placeholder="Filter records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:ring-1 focus:ring-indigo-500 outline-none" />
                    </div>
                    {filteredNotes.length > 0 && (
                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={batchSelection.size === filteredNotes.length && filteredNotes.length > 0} onChange={handleSelectAllVisible} className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Select All</span>
                            </label>
                            {batchSelection.size > 0 && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleBulkCopy(false)} className="text-[9px] font-bold text-indigo-600 hover:underline">Copy</button>
                                    <button onClick={() => handleBulkCopy(true)} className="text-[9px] font-bold text-indigo-600 hover:underline flex items-center gap-1"><SparklesIcon className="w-2.5 h-2.5"/> AI</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredNotes.length === 0 ? (
                        <div className="p-10 text-center text-slate-300 flex flex-col items-center">
                            <BoxIcon className="w-8 h-8 mb-2 opacity-20" /><p className="text-[11px] font-bold">No records found.</p>
                        </div>
                    ) : (
                        filteredNotes.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => { setSelectedNoteId(n.id); setIsCreating(false); }} 
                                className={`group px-3 py-2.5 border-b border-slate-50 cursor-pointer transition-all flex items-start gap-3 ${selectedNoteId === n.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50'}`}
                            >
                                <div className="mt-1 flex-shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={batchSelection.has(n.id)} 
                                        onClick={(e) => toggleBatchSelection(e, n.id)} 
                                        onChange={() => {}} 
                                        className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <h4 className={`text-[11px] font-bold truncate pr-2 ${n.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{n.title}</h4>
                                        <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded flex-shrink-0 ${n.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{n.priority}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 line-clamp-1 leading-relaxed">{n.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* DETAIL: INSPECTOR VIEW */}
            <div className="flex-1 bg-white flex flex-col min-h-0 relative">
                {isCreating ? (
                    <div className="p-6 flex-1 overflow-y-auto animate-fade-in">
                        <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Drafting Record</h3>
                                <button type="button" onClick={resetForm} className="p-1 text-slate-400 hover:text-red-500"><CloseIcon className="w-5 h-5" /></button>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Title</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter title..." className="w-full p-1.5 border border-slate-200 rounded-lg font-bold text-xs" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Category</label>
                                    <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-1.5 border border-slate-200 rounded-lg font-bold text-[10px]">
                                        <option value="bug">Bug Report</option><option value="note">General Note</option><option value="idea">Product Idea</option><option value="task">Operational Task</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Priority</label>
                                    <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full p-1.5 border border-slate-200 rounded-lg font-bold text-[10px]">
                                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Context / Description</label>
                                <textarea value={content} onChange={e => setContent(e.target.value)} rows={12} placeholder="Provide details..." className="w-full p-3 border border-slate-200 rounded-lg font-medium text-[11px] leading-relaxed" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={resetForm} className="px-4 py-1.5 text-[10px] text-slate-500 font-bold uppercase hover:bg-slate-50 rounded-lg">Discard</button>
                                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-black text-[10px] shadow-lg hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-wider">Commit Record</button>
                            </div>
                        </form>
                    </div>
                ) : activeNote ? (
                    <div className="p-8 flex-1 overflow-y-auto animate-fade-in custom-scrollbar">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${activeNote.type === 'bug' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>{activeNote.type}</span>
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${activeNote.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>{activeNote.priority} priority</span>
                                </div>
                                <h3 className="text-xl font-black text-slate-800 leading-tight">{activeNote.title}</h3>
                                <div className="flex items-center gap-4 mt-3">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tight">Updated</span>
                                        <span className="text-[9px] font-bold text-slate-400">{new Date(activeNote.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="w-px h-5 bg-slate-100"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tight">Created</span>
                                        <span className="text-[9px] font-bold text-slate-400">{new Date(activeNote.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(activeNote)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg transition-all" title="Edit"><EditIcon className="w-3.5 h-3.5"/></button>
                                <button onClick={() => deleteNote(activeNote.id)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-lg transition-all" title="Delete"><DeleteIcon className="w-3.5 h-3.5"/></button>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner mb-6">
                            <p className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{activeNote.content}</p>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-4">
                                <button onClick={() => toggleComplete(activeNote.id)} className={`px-4 py-2 rounded-lg font-black uppercase text-[9px] transition-all flex items-center gap-2 tracking-widest ${activeNote.isCompleted ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                    {activeNote.isCompleted ? <RepeatIcon className="w-3.5 h-3.5"/> : <CheckCircleIcon className="w-3.5 h-3.5"/>}
                                    {activeNote.isCompleted ? 'Move to Backlog' : 'Resolve & Archive'}
                                </button>
                                {activeNote.isCompleted && (
                                    <p className="text-[9px] font-bold text-slate-400 italic">Resolved on {new Date(activeNote.resolvedAt!).toLocaleDateString()}</p>
                                )}
                            </div>
                            <button onClick={() => copyToClipboard(`Subject: ${activeNote.title}\n\nContext: ${activeNote.content}`)} className="flex items-center gap-1.5 text-indigo-600 font-bold text-[9px] uppercase hover:underline">
                                <CopyIcon className="w-3.5 h-3.5"/> Copy Details
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50/30">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg mb-4">
                             <BoxIcon className="w-6 h-6 text-indigo-100" />
                        </div>
                        <h4 className="text-base font-black text-slate-800 uppercase tracking-tighter">Select a record</h4>
                        <p className="text-slate-400 text-[11px] mt-2 font-bold max-w-[180px]">Choose an item from the list to view logs or edit details.</p>
                        <button onClick={() => setIsCreating(true)} className="mt-4 text-indigo-600 font-black uppercase tracking-widest text-[9px] border-b-2 border-indigo-100 pb-0.5 hover:border-indigo-500 transition-all">Or create new entry</button>
                    </div>
                )}
            </div>
            {copyStatus !== 'idle' && (
                <div className="fixed bottom-10 right-10 z-[200] animate-slide-in-right">
                    <div className={`px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border-2 ${copyStatus === 'success' ? 'bg-slate-900 border-emerald-500 text-white' : 'bg-red-900 border-red-500 text-white'}`}>
                        {copyStatus === 'success' ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}
                        <span className="font-bold text-xs">{copyStatus === 'success' ? 'Copied' : 'Error'}</span>
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
        
        const nextMsgs = [...activeSession.messages, userMsg];
        const updatedSess = { ...activeSession, messages: nextMsgs, updatedAt: new Date().toISOString() };
        
        const otherSessions = sessions.filter(s => s.id !== activeSession.id);
        onUpdateSessions([...otherSessions, updatedSess]);
        setInput(''); setIsLoading(true);
        try {
            const aiMsgPlaceholder: ChatMessage = { id: generateUUID(), role: 'ai', content: '', timestamp: new Date().toISOString() };
            const sessionWithAi = { ...updatedSess, messages: [...updatedSess.messages, aiMsgPlaceholder] };
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
