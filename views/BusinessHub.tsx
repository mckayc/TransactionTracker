
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { BusinessNote, Transaction, Account, Category, BusinessProfile, BusinessInfo, TaxInfo } from '../types';
import { CheckCircleIcon, SendIcon, AddIcon, BugIcon, NotesIcon, SearchCircleIcon, CloseIcon, TrashIcon, ChecklistIcon, LightBulbIcon, ChevronRightIcon, ShieldCheckIcon, BoxIcon, RobotIcon, CopyIcon, FileTextIcon, SaveIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { askAiAdvisor } from '../services/geminiService';

interface BusinessHubProps {
    profile: BusinessProfile;
    onUpdateProfile: (profile: BusinessProfile) => void;
    notes: BusinessNote[];
    onUpdateNotes: (notes: BusinessNote[]) => void;
    chatSessions: any[];
    onUpdateChatSessions: (sessions: any[]) => void;
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
}

/**
 * NoteEditor: A high-performance buffered editor.
 * It maintains local state for typing and only syncs to the parent (and DB)
 * on focus loss (blur) or every 20 seconds.
 */
const NoteEditor: React.FC<{
    note: BusinessNote;
    onSave: (updates: Partial<BusinessNote>) => void;
}> = ({ note, onSave }) => {
    const [draftTitle, setDraftTitle] = useState(note.title);
    const [draftContent, setDraftContent] = useState(note.content);
    const [isDirty, setIsDirty] = useState(false);
    
    // Track references to avoid closure staleness in the heartbeat timer
    const draftRef = useRef({ title: note.title, content: note.content });
    const lastSavedRef = useRef({ title: note.title, content: note.content });

    // When the note object changes (e.g. user selects a different note in sidebar)
    // we reset the editor state entirely.
    useEffect(() => {
        setDraftTitle(note.title);
        setDraftContent(note.content);
        draftRef.current = { title: note.title, content: note.content };
        lastSavedRef.current = { title: note.title, content: note.content };
        setIsDirty(false);
    }, [note.id]);

    const pushChanges = useCallback(() => {
        const hasTitleChanged = draftRef.current.title !== lastSavedRef.current.title;
        const hasContentChanged = draftRef.current.content !== lastSavedRef.current.content;

        if (hasTitleChanged || hasContentChanged) {
            onSave({ 
                title: draftRef.current.title, 
                content: draftRef.current.content 
            });
            lastSavedRef.current = { ...draftRef.current };
            setIsDirty(false);
        }
    }, [onSave]);

    // Heartbeat: Auto-save every 20 seconds if there are changes
    useEffect(() => {
        const interval = setInterval(() => {
            if (isDirty) pushChanges();
        }, 20000);
        return () => clearInterval(interval);
    }, [isDirty, pushChanges]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDraftTitle(val);
        draftRef.current.title = val;
        setIsDirty(true);
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setDraftContent(val);
        draftRef.current.content = val;
        setIsDirty(true);
    };

    return (
        <div className="flex flex-col h-full bg-white animate-fade-in" onBlur={pushChanges}>
            <div className="p-6 border-b flex justify-between items-center bg-white z-10 shadow-sm">
                <div className="flex-1 min-w-0 mr-4">
                    <input 
                        type="text" 
                        value={draftTitle} 
                        onChange={handleTitleChange}
                        className="text-2xl font-black text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-slate-300" 
                        placeholder="Log Title" 
                    />
                    <div className="flex items-center gap-3 mt-2">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-widest ${isDirty ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-slate-300'}`} />
                            {isDirty ? 'Unsaved Changes' : 'Synced'}
                        </div>
                        <div className="h-3 w-px bg-slate-200" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Created {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={pushChanges}
                        disabled={!isDirty}
                        className={`p-2.5 rounded-xl transition-all ${isDirty ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-300'}`}
                        title="Force Sync Now"
                    >
                        <SaveIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => {
                            if (navigator.clipboard) navigator.clipboard.writeText(draftContent);
                        }} 
                        className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
                        title="Copy content"
                    >
                        <CopyIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 relative">
                <textarea
                    value={draftContent}
                    onChange={handleContentChange}
                    className="w-full h-full p-4 border-none focus:ring-0 resize-none font-medium text-slate-700 leading-relaxed bg-slate-50/30 rounded-2xl custom-scrollbar"
                    placeholder="Describe the situation, bug, or idea..."
                />
            </div>
        </div>
    );
};

const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile, notes, onUpdateNotes }) => {
    const [activeTab, setActiveTab] = useState<'identity' | 'journal'>('identity');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const updateInfo = (key: keyof BusinessInfo, value: string) => {
        onUpdateProfile({ ...profile, info: { ...profile.info, [key]: value } });
    };

    const updateTax = (key: keyof TaxInfo, value: string) => {
        onUpdateProfile({ ...profile, tax: { ...profile.tax, [key]: value } });
    };

    const filteredNotes = useMemo(() => {
        return notes
            .filter(n => {
                const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesType = !selectedTypeFilter || n.type === selectedTypeFilter;
                return matchesSearch && matchesType;
            })
            .sort((a, b) => {
                if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [notes, searchTerm, selectedTypeFilter]);

    const activeNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);

    const handleCreateNote = () => {
        const id = generateUUID();
        const newNote: BusinessNote = {
            id,
            title: 'New Entry',
            content: '',
            type: selectedTypeFilter as any || 'note',
            priority: 'medium',
            isCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        onUpdateNotes([...notes, newNote]);
        setSelectedNoteId(id);
    };

    const handleUpdateActiveNote = (updates: Partial<BusinessNote>) => {
        if (!selectedNoteId) return;
        onUpdateNotes(notes.map(n => n.id === selectedNoteId ? { 
            ...n, 
            ...updates, 
            updatedAt: new Date().toISOString() 
        } : n));
    };

    const handleAskAi = async () => {
        if (!aiQuery.trim() || isAiLoading) return;
        setIsAiLoading(true);
        try {
            const prompt = `Based on my business profile: ${JSON.stringify(profile)}, ${aiQuery}`;
            const response = await askAiAdvisor(prompt);
            setAiResponse(response);
        } catch (e) {
            setAiResponse("I encountered an error processing your query.");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Business Hub</h1>
                    <p className="text-sm text-slate-500">Identity & Institutional Memory.</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('identity')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'identity' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Identity</button>
                    <button onClick={() => setActiveTab('journal')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'journal' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Journal</button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden pb-10">
                {activeTab === 'identity' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><ShieldCheckIcon className="w-6 h-6 text-indigo-600" /> Legal Entity</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Name</label><input type="text" value={profile.info.llcName || ''} onChange={e => updateInfo('llcName', e.target.value)} className="w-full font-bold" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Structure</label><select value={profile.info.businessType || ''} onChange={e => updateInfo('businessType', e.target.value)} className="w-full font-bold"><option value="">Select...</option><option value="sole-prop">Sole Prop</option><option value="single-llc">SMLLC</option><option value="multi-llc">Multi-LLC</option><option value="s-corp">S-Corp</option></select></div>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><BoxIcon className="w-6 h-6 text-emerald-600" /> Tax Profile</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filing Status</label><select value={profile.tax.filingStatus || ''} onChange={e => updateTax('filingStatus', e.target.value)} className="w-full font-bold"><option value="">Select...</option><option value="individual">Individual</option><option value="s-corp">S-Corp</option></select></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Accountant</label><input type="text" value={profile.tax.accountantName || ''} onChange={e => updateTax('accountantName', e.target.value)} className="w-full font-bold" /></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col gap-6 relative overflow-hidden shadow-xl">
                            <div className="relative z-10 flex flex-col h-full">
                                <h3 className="font-black uppercase tracking-tight flex items-center gap-2 mb-4"><RobotIcon className="w-6 h-6 text-indigo-400" /> Advisor</h3>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 text-sm leading-relaxed text-slate-300 bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                                    {aiResponse ? <div dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>') }} /> : <p className="italic text-slate-500">Ask about tax strategy or compliance deadlines...</p>}
                                </div>
                                <div className="space-y-3">
                                    <textarea value={aiQuery} onChange={e => setAiQuery(e.target.value)} className="w-full bg-white/5 border-white/10 text-white rounded-xl text-xs p-3 focus:border-indigo-500 transition-all placeholder:text-slate-600 min-h-[100px] resize-none" placeholder="How should I handle estimated payments?" />
                                    <button onClick={handleAskAi} disabled={isAiLoading || !aiQuery.trim()} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-30">
                                        {isAiLoading ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin"></div> : <SendIcon className="w-4 h-4" />} Consult
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'journal' && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex h-full overflow-hidden">
                        <div className="w-56 border-r border-slate-100 bg-slate-50/30 flex flex-col p-4 flex-shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Taxonomy</p>
                            <div className="space-y-1">
                                {[
                                    { id: null, label: 'All Entries', icon: <FileTextIcon className="w-4 h-4" /> },
                                    { id: 'note', label: 'General Logs', icon: <NotesIcon className="w-4 h-4 text-blue-500" /> },
                                    { id: 'bug', label: 'Issue Tracker', icon: <BugIcon className="w-4 h-4 text-red-500" /> },
                                    { id: 'idea', label: 'Proposals', icon: <LightBulbIcon className="w-4 h-4 text-amber-500" /> },
                                    { id: 'task', label: 'Action Items', icon: <ChecklistIcon className="w-4 h-4 text-green-500" /> }
                                ].map(type => (
                                    <button key={type.label} onClick={() => setSelectedTypeFilter(type.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedTypeFilter === type.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                                        {type.icon}<span>{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-80 border-r border-slate-100 flex flex-col min-h-0 flex-shrink-0">
                            <div className="p-4 border-b flex justify-between items-center bg-white">
                                <h3 className="font-black text-slate-800 uppercase tracking-tighter text-sm">Chronicle</h3>
                                <button onClick={handleCreateNote} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100">
                                    <AddIcon className="w-4 h-4"/>
                                </button>
                            </div>
                            <div className="p-3 border-b bg-slate-50/50">
                                <div className="relative">
                                    <input type="text" placeholder="Filter memory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold" />
                                    <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {filteredNotes.length === 0 ? (
                                    <div className="py-12 text-center text-slate-300 italic flex flex-col items-center">
                                        <FileTextIcon className="w-8 h-8 mb-2 opacity-10" />
                                        <p className="text-[10px] font-black uppercase">No records</p>
                                    </div>
                                ) : filteredNotes.map(n => (
                                    <div key={n.id} onClick={() => setSelectedNoteId(n.id)} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col gap-1.5 ${selectedNoteId === n.id ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-sm font-black truncate pr-2 ${selectedNoteId === n.id ? 'text-indigo-900' : 'text-slate-800'}`}>{n.title || 'Untitled Entry'}</h4>
                                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'bug' ? 'bg-red-500' : n.type === 'idea' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(n.updatedAt).toLocaleDateString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col min-h-0 bg-white">
                            {selectedNoteId && activeNote ? (
                                <NoteEditor 
                                    key={selectedNoteId} 
                                    note={activeNote} 
                                    onSave={handleUpdateActiveNote} 
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/20">
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8 animate-bounce-subtle">
                                        <NotesIcon className="w-12 h-12 text-indigo-200" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Entry Vault</h3>
                                    <p className="text-slate-400 text-sm mt-4 max-w-xs font-medium">Select a log from the sidebar to inspect its content or create a new institutional record.</p>
                                    <button onClick={handleCreateNote} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">Start New Log</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessHub;
