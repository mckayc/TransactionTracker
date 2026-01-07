import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { BusinessNote, Transaction, Account, Category, BusinessProfile, BusinessInfo, TaxInfo } from '../types';
import { CheckCircleIcon, SparklesIcon, SendIcon, AddIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, CloseIcon, ListIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ChecklistIcon, LightBulbIcon, ChevronRightIcon, ChevronDownIcon, ShieldCheckIcon, UsersIcon, BoxIcon, InfoIcon, RobotIcon, CopyIcon, FileTextIcon } from '../components/Icons';
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

type BlockType = 'paragraph' | 'todo' | 'bullet' | 'number' | 'h1';

interface ContentBlock {
    id: string;
    type: BlockType;
    text: string;
    checked: boolean;
    indent: number;
}

// --- Custom Notification Component ---
const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
            <div className="bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3">
                <div className="bg-indigo-500 rounded-full p-1">
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold tracking-tight">{message}</span>
            </div>
        </div>
    );
};

// --- Clipboard Utility ---
const copyToClipboard = (text: string, onDone: (msg: string) => void) => {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => onDone("Copied to clipboard"))
            .catch(() => fallbackCopy(text, onDone));
    } else {
        fallbackCopy(text, onDone);
    }
};

const fallbackCopy = (text: string, onDone: (msg: string) => void) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) onDone("Copied to clipboard (fallback)");
        else console.error('Copy failed');
    } catch (err) {
        console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
};

// --- Markdown Logic ---

const parseMarkdownToBlocks = (markdown: string): ContentBlock[] => {
    if (!markdown || markdown.trim() === '') {
        return [{ id: generateUUID(), type: 'paragraph', text: '', checked: false, indent: 0 }];
    }
    
    return markdown.split('\n').map(line => {
        const indentMatch = line.match(/^(\s*)/);
        const indentCount = indentMatch ? indentMatch[0].length : 0;
        const indent = Math.floor(indentCount / 2);
        const trimmed = line.trim();

        if (trimmed.startsWith('# ')) {
            return { id: generateUUID(), type: 'h1', text: trimmed.replace('# ', ''), checked: false, indent };
        }
        if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
            return {
                id: generateUUID(),
                type: 'todo',
                text: trimmed.replace(/- \[[ xX]\]\s*/, ''),
                checked: trimmed.toLowerCase().includes('- [x]'),
                indent
            };
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return {
                id: generateUUID(),
                type: 'bullet',
                text: trimmed.replace(/^[-*]\s+/, ''),
                checked: false,
                indent
            };
        }
        const numMatch = trimmed.match(/^\d+\.\s+(.*)/);
        if (numMatch) {
            return {
                id: generateUUID(),
                type: 'number',
                text: numMatch[1],
                checked: false,
                indent
            };
        }
        return { id: generateUUID(), type: 'paragraph', text: trimmed, checked: false, indent };
    });
};

const serializeBlocksToMarkdown = (blocks: ContentBlock[]): string => {
    return blocks.map(b => {
        const prefix = '  '.repeat(b.indent);
        let marker = '';
        if (b.type === 'h1') marker = '# ';
        else if (b.type === 'todo') marker = `- [${b.checked ? 'x' : ' '}] `;
        else if (b.type === 'bullet') marker = '- ';
        else if (b.type === 'number') marker = '1. ';
        return prefix + marker + b.text;
    }).join('\n');
};

const BlockEditor: React.FC<{
    initialBlocks: ContentBlock[];
    onChange: (blocks: ContentBlock[]) => void;
    noteId: string;
}> = ({ initialBlocks, onChange, noteId }) => {
    const [internalBlocks, setInternalBlocks] = useState<ContentBlock[]>(initialBlocks);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const lastNoteId = useRef<string>(noteId);

    useEffect(() => {
        if (noteId !== lastNoteId.current) {
            setInternalBlocks(initialBlocks);
            lastNoteId.current = noteId;
        }
    }, [noteId, initialBlocks]);

    const triggerChange = (updatedBlocks: ContentBlock[]) => {
        setInternalBlocks(updatedBlocks);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            onChange(updatedBlocks);
        }, 500);
    };

    const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
        const next = internalBlocks.map(b => b.id === id ? { ...b, ...updates } : b);
        triggerChange(next);
    };

    const addBlock = (afterId: string, type: BlockType = 'paragraph', indent: number = 0) => {
        const index = internalBlocks.findIndex(b => b.id === afterId);
        const newBlock = { id: generateUUID(), type, text: '', checked: false, indent };
        const next = [...internalBlocks];
        next.splice(index + 1, 0, newBlock);
        triggerChange(next);
        setTimeout(() => document.getElementById(`block-${newBlock.id}`)?.focus(), 10);
    };

    const deleteBlock = (id: string) => {
        if (internalBlocks.length <= 1) {
            updateBlock(id, { type: 'paragraph', text: '', checked: false, indent: 0 });
            return;
        }
        const index = internalBlocks.findIndex(b => b.id === id);
        const prevBlock = internalBlocks[index - 1];
        const next = internalBlocks.filter(b => b.id !== id);
        triggerChange(next);
        if (prevBlock) setTimeout(() => document.getElementById(`block-${prevBlock.id}`)?.focus(), 10);
    };

    const sortCheckedToBottom = () => {
        const next: ContentBlock[] = [];
        let i = 0;
        
        while (i < internalBlocks.length) {
            // Check if we are starting a contiguous checklist group
            if (internalBlocks[i].type === 'todo') {
                const todoBranches: { parent: ContentBlock; descendants: ContentBlock[] }[] = [];
                
                // Group each base todo with its children
                while (i < internalBlocks.length && internalBlocks[i].type === 'todo') {
                    const currentTodo = internalBlocks[i];
                    const descendants: ContentBlock[] = [];
                    const baseIndent = currentTodo.indent;
                    i++;
                    
                    // Collect everything more indented that follows immediately
                    while (i < internalBlocks.length && internalBlocks[i].indent > baseIndent) {
                        descendants.push(internalBlocks[i]);
                        i++;
                    }
                    todoBranches.push({ parent: currentTodo, descendants });
                }
                
                // Partition branches: Incomplete first, then complete
                const incomplete = todoBranches.filter(t => !t.parent.checked);
                const complete = todoBranches.filter(t => t.parent.checked);
                
                [...incomplete, ...complete].forEach(branch => {
                    next.push(branch.parent);
                    next.push(...branch.descendants);
                });
            } else {
                next.push(internalBlocks[i]);
                i++;
            }
        }
        triggerChange(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent, b: ContentBlock) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBlock(b.id, b.type, b.indent);
        } else if (e.key === 'Backspace' && b.text === '') {
            e.preventDefault();
            deleteBlock(b.id);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newIndent = e.shiftKey ? Math.max(0, b.indent - 1) : Math.min(5, b.indent + 1);
            updateBlock(b.id, { indent: newIndent });
        }
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-slate-50/50 border-b border-slate-100 sticky top-0 z-20">
                <div className="flex bg-white rounded-xl border border-slate-200 p-0.5 shadow-sm">
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'todo' })} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-600 transition-all" title="Checkbox"><ChecklistIcon className="w-4 h-4" /></button>
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'bullet' })} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-600 transition-all" title="Bullet"><ListIcon className="w-4 h-4" /></button>
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'h1' })} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-600 transition-all font-black text-xs px-2" title="Heading">H1</button>
                </div>
                <button 
                    type="button" 
                    onClick={sortCheckedToBottom} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                    <ArrowDownIcon className="w-3 h-3" /> Sink Checked
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-1 custom-scrollbar">
                {internalBlocks.map((b) => (
                    <div 
                        key={b.id} 
                        className={`group flex items-start gap-3 py-0.5 relative rounded-lg transition-colors ${focusedId === b.id ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}
                        style={{ paddingLeft: `${b.indent * 20}px` }}
                    >
                        <div className="flex-shrink-0 mt-1.5 w-5 flex justify-center">
                            {b.type === 'todo' ? (
                                <button 
                                    type="button"
                                    onClick={() => updateBlock(b.id, { checked: !b.checked })}
                                    className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${b.checked ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-300 hover:border-indigo-400'}`}
                                >
                                    {b.checked && <CheckCircleIcon className="w-3 h-3" />}
                                </button>
                            ) : b.type === 'bullet' ? (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                            ) : b.type === 'h1' ? (
                                <span className="text-[10px] font-black text-indigo-400 mt-1 uppercase">h1</span>
                            ) : null}
                        </div>

                        <textarea
                            id={`block-${b.id}`}
                            value={b.text}
                            onFocus={() => setFocusedId(b.id)}
                            onChange={(e) => {
                                const val = e.target.value;
                                let type = b.type;
                                let text = val;
                                if (b.type === 'paragraph') {
                                    if (val === '- ') { type = 'bullet'; text = ''; }
                                    else if (val === '[] ') { type = 'todo'; text = ''; }
                                    else if (val === '# ') { type = 'h1'; text = ''; }
                                }
                                updateBlock(b.id, { text, type });
                            }}
                            onKeyDown={(e) => handleKeyDown(e, b)}
                            placeholder="Start typing..."
                            rows={1}
                            className={`flex-1 bg-transparent border-none focus:ring-0 p-0 leading-relaxed resize-none overflow-hidden min-h-[1.4em] transition-all duration-200 ${b.type === 'h1' ? 'text-lg font-black text-slate-800' : 'text-sm font-medium'} ${b.checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                            }}
                        />

                        <button type="button" onClick={() => deleteBlock(b.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded-lg transition-all"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile, notes, onUpdateNotes }) => {
    const [activeTab, setActiveTab] = useState<'identity' | 'journal'>('identity');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    
    // AI Advisor State
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
    const blocks = useMemo(() => activeNote ? parseMarkdownToBlocks(activeNote.content) : [], [activeNote?.content]);

    const handleCreateNote = () => {
        const id = generateUUID();
        const newNote: BusinessNote = {
            id,
            title: 'New Log Entry',
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
        onUpdateNotes(notes.map(n => n.id === selectedNoteId ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
    };

    const handleCopyForAi = () => {
        if (!activeNote) return;
        
        // Filter out completed tasks from the content
        const filteredContent = activeNote.content.split('\n').filter(line => {
            const t = line.trim();
            return !(t.startsWith('- [x]') || t.startsWith('- [X]'));
        }).join('\n');

        const aiPrompt = `PROMPT FOR AI ANALYSIS:\n\nAnalyze the following log entry from my business operations journal. Identify any underlying patterns, potential efficiency gains, or technical debt risks mentioned in the text.\n\nTITLE: ${activeNote.title}\nTYPE: ${activeNote.type}\n\nCONTENT (Filtered for active tasks):\n${filteredContent}`;
        copyToClipboard(aiPrompt, (msg) => setToastMessage(msg));
    };

    const handleAskAi = async () => {
        if (!aiQuery.trim() || isAiLoading) return;
        setIsAiLoading(true);
        try {
            const prompt = `Based on my business profile: ${JSON.stringify(profile)}, ${aiQuery}`;
            const response = await askAiAdvisor(prompt);
            setAiResponse(response);
        } catch (e) {
            setAiResponse("I encountered an error processing your structural query. Check your API key.");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Business Hub</h1>
                    <p className="text-sm text-slate-500">Corporate identity, tax compliance, and institutional memory.</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('identity')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'identity' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Identity & Tax</button>
                    <button onClick={() => setActiveTab('journal')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'journal' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Operations Journal</button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden pb-10">
                {activeTab === 'identity' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                    <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Legal Entity Information</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Registered Name</label>
                                        <input type="text" value={profile.info.llcName || ''} onChange={e => updateInfo('llcName', e.target.value)} className="w-full font-bold" placeholder="e.g. My Global Ventures LLC" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Structure Type</label>
                                        <select value={profile.info.businessType || ''} onChange={e => updateInfo('businessType', e.target.value)} className="w-full font-bold">
                                            <option value="">Select structure...</option>
                                            <option value="sole-prop">Sole Proprietorship</option>
                                            <option value="single-llc">Single-Member LLC</option>
                                            <option value="multi-llc">Multi-Member LLC</option>
                                            <option value="s-corp">S-Corporation</option>
                                            <option value="c-corp">C-Corporation</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employer ID (EIN)</label>
                                        <input type="text" value={profile.info.ein || ''} onChange={e => updateInfo('ein', e.target.value)} className="w-full font-bold" placeholder="XX-XXXXXXX" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State of Formation</label>
                                        <input type="text" value={profile.info.stateOfFormation || ''} onChange={e => updateInfo('stateOfFormation', e.target.value)} className="w-full font-bold" placeholder="e.g. Wyoming" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                    <BoxIcon className="w-6 h-6 text-emerald-600" />
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Tax & Compliance Registry</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IRS Filing Status</label>
                                        <select value={profile.tax.filingStatus || ''} onChange={e => updateTax('filingStatus', e.target.value)} className="w-full font-bold">
                                            <option value="">Select status...</option>
                                            <option value="individual">Individual / Disregarded Entity</option>
                                            <option value="partnership">Partnership (1065)</option>
                                            <option value="s-corp">S-Corp (1120-S)</option>
                                            <option value="c-corp">C-Corp (1120)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fiscal Year End</label>
                                        <input type="date" value={profile.tax.taxYearEnd || ''} onChange={e => updateTax('taxYearEnd', e.target.value)} className="w-full font-bold" />
                                    </div>
                                    <div className="col-span-1 md:col-span-2 space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Accounting Professional</label>
                                        <input type="text" value={profile.tax.accountantName || ''} onChange={e => updateTax('accountantName', e.target.value)} className="w-full font-bold" placeholder="Name or Firm Contact..." />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex items-center gap-2 mb-4">
                                    <RobotIcon className="w-6 h-6 text-indigo-400" />
                                    <h3 className="font-black uppercase tracking-tight">Structure Advisor</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 text-sm leading-relaxed text-slate-300 bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                                    {aiResponse ? (
                                        <div dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>') }} />
                                    ) : (
                                        <p className="italic text-slate-500">Ask about tax strategy, entity benefits, or nexus requirements based on your saved profile.</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <textarea 
                                        value={aiQuery} 
                                        onChange={e => setAiQuery(e.target.value)}
                                        className="w-full bg-white/5 border-white/10 text-white rounded-xl text-xs p-3 focus:border-indigo-500 transition-all placeholder:text-slate-600 min-h-[100px] resize-none"
                                        placeholder="e.g. What are my estimated tax deadlines for an S-Corp?"
                                    />
                                    <button 
                                        onClick={handleAskAi}
                                        disabled={isAiLoading || !aiQuery.trim()}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-30"
                                    >
                                        {isAiLoading ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin"></div> : <SendIcon className="w-4 h-4" />}
                                        Consult AI
                                    </button>
                                </div>
                            </div>
                            <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-5 text-indigo-400 pointer-events-none" />
                        </div>
                    </div>
                )}

                {activeTab === 'journal' && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex h-full overflow-hidden">
                        <div className="w-48 border-r border-slate-100 bg-slate-50/30 flex flex-col p-4 flex-shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Taxonomy</p>
                            <div className="space-y-1">
                                {[
                                    { id: null, label: 'All Entries', icon: <FileTextIcon className="w-4 h-4" /> },
                                    { id: 'note', label: 'Logs', icon: <NotesIcon className="w-4 h-4 text-blue-500" /> },
                                    { id: 'bug', label: 'Bugs', icon: <BugIcon className="w-4 h-4 text-red-500" /> },
                                    { id: 'idea', label: 'Proposals', icon: <LightBulbIcon className="w-4 h-4 text-amber-500" /> },
                                    { id: 'task', label: 'Actions', icon: <ChecklistIcon className="w-4 h-4 text-green-500" /> }
                                ].map(type => (
                                    <button 
                                        key={type.label} 
                                        onClick={() => setSelectedTypeFilter(type.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedTypeFilter === type.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {type.icon}
                                        <span>{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-80 border-r border-slate-100 flex flex-col min-h-0 flex-shrink-0">
                            <div className="p-4 border-b flex justify-between items-center bg-white">
                                <h3 className="font-black text-slate-800 uppercase tracking-tighter text-sm">Stream</h3>
                                <button onClick={handleCreateNote} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-md transition-transform active:scale-95"><AddIcon className="w-4 h-4"/></button>
                            </div>
                            <div className="p-3 border-b">
                                <div className="relative">
                                    <input type="text" placeholder="Search memory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold" />
                                    <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {filteredNotes.length === 0 ? (
                                    <div className="p-10 text-center opacity-20"><BugIcon className="w-12 h-12 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Empty</p></div>
                                ) : (
                                    filteredNotes.map(n => (
                                        <div key={n.id} onClick={() => setSelectedNoteId(n.id)} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col gap-1.5 ${selectedNoteId === n.id ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                            <div className="flex justify-between items-start">
                                                <h4 className={`text-sm font-black truncate pr-2 ${n.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{n.title}</h4>
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'bug' ? 'bg-red-500' : n.type === 'idea' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                            </div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(n.updatedAt).toLocaleDateString()}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col min-h-0 bg-white relative">
                            {selectedNoteId && activeNote ? (
                                <div className="flex flex-col h-full animate-fade-in">
                                    <div className="p-6 border-b flex justify-between items-center z-10 shadow-sm bg-white">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <input 
                                                type="text" 
                                                value={activeNote.title} 
                                                onChange={e => handleUpdateActiveNote({ title: e.target.value })}
                                                className="text-2xl font-black text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-slate-300"
                                                placeholder="Log Title"
                                            />
                                            <div className="flex items-center gap-3 mt-2">
                                                <div className="relative">
                                                    <select 
                                                        value={activeNote.type} 
                                                        onChange={e => handleUpdateActiveNote({ type: e.target.value as any })}
                                                        className="text-[10px] font-black uppercase bg-slate-100 border-none rounded-lg py-1 pl-2 pr-6 focus:ring-0 cursor-pointer appearance-none"
                                                    >
                                                        <option value="note">Log Entry</option>
                                                        <option value="bug">Software Bug</option>
                                                        <option value="idea">Proposal</option>
                                                        <option value="task">Action Item</option>
                                                    </select>
                                                    <ChevronDownIcon className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                                </div>
                                                <button 
                                                    onClick={() => handleUpdateActiveNote({ isCompleted: !activeNote.isCompleted })}
                                                    className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg transition-all shadow-sm ${activeNote.isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-700 text-white hover:bg-slate-800'}`}
                                                >
                                                    {activeNote.isCompleted ? 'Fixed/Resolved' : 'Mark Resolved'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => copyToClipboard(activeNote.content, (msg) => setToastMessage(msg))} className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all" title="Copy Content"><CopyIcon className="w-5 h-5"/></button>
                                            <button onClick={handleCopyForAi} className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all" title="Copy for AI Prompt"><RobotIcon className="w-5 h-5"/></button>
                                            <button onClick={() => { if(confirm("Discard permanently?")) { onUpdateNotes(notes.filter(n => n.id !== selectedNoteId)); setSelectedNoteId(null); } }} className="p-2.5 text-slate-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all" title="Delete Entry"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0 bg-slate-50/20">
                                        <BlockEditor 
                                            noteId={selectedNoteId}
                                            initialBlocks={blocks} 
                                            onChange={(newBlocks) => handleUpdateActiveNote({ content: serializeBlocksToMarkdown(newBlocks) })} 
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/20">
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8 animate-bounce-subtle">
                                        <NotesIcon className="w-12 h-12 text-indigo-200" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Workbench</h3>
                                    <p className="text-slate-500 max-w-sm mt-4 font-medium leading-relaxed">Select an entry from the stream to begin documenting institutional logic or managing development debt.</p>
                                    <button onClick={handleCreateNote} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">Start New Log</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Custom Toast Notification */}
            {toastMessage && (
                <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            )}
        </div>
    );
};

export default BusinessHub;