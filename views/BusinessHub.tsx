import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo, ChatSession, ChatMessage, Transaction, Account, Category, BusinessNote } from '../types';
import { CheckCircleIcon, SparklesIcon, CurrencyDollarIcon, SendIcon, ExclamationTriangleIcon, AddIcon, DeleteIcon, ChatBubbleIcon, CloudArrowUpIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, SortIcon, ChevronDownIcon, CloseIcon, CopyIcon, TableIcon, ChevronRightIcon, LightBulbIcon, ChecklistIcon, BoxIcon, RepeatIcon, ListIcon, TypeIcon, DragHandleIcon } from '../components/Icons';
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

type BlockType = 'text' | 'todo' | 'bullet' | 'number';

interface ContentBlock {
    id: string;
    type: BlockType;
    text: string;
    checked: boolean;
    indent: number;
}

// Helper: Parse Markdown string to Blocks
const parseMarkdownToBlocks = (markdown: string): ContentBlock[] => {
    if (!markdown) return [{ id: generateUUID(), type: 'text', text: '', checked: false, indent: 0 }];
    
    return markdown.split('\n').map(line => {
        const indentMatch = line.match(/^(\s*)/);
        const indent = Math.floor((indentMatch ? indentMatch[0].length : 0) / 2);
        const trimmed = line.trim();

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
        return { id: generateUUID(), type: 'text', text: trimmed, checked: false, indent };
    });
};

// Helper: Serialize Blocks to Markdown string
const serializeBlocksToMarkdown = (blocks: ContentBlock[]): string => {
    return blocks.map(b => {
        const prefix = '  '.repeat(b.indent);
        let marker = '';
        if (b.type === 'todo') marker = `- [${b.checked ? 'x' : ' '}] `;
        else if (b.type === 'bullet') marker = '- ';
        else if (b.type === 'number') marker = '1. ';
        return prefix + marker + b.text;
    }).join('\n');
};

const BlockEditor: React.FC<{
    blocks: ContentBlock[];
    onChange: (blocks: ContentBlock[]) => void;
}> = ({ blocks, onChange }) => {
    const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
        onChange(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const addBlock = (afterId: string, type: BlockType = 'text', indent: number = 0) => {
        const index = blocks.findIndex(b => b.id === afterId);
        const newBlock = { id: generateUUID(), type, text: '', checked: false, indent };
        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);
        onChange(newBlocks);
        // Focus the new block in next tick
        setTimeout(() => {
            const el = document.getElementById(`block-${newBlock.id}`);
            el?.focus();
        }, 0);
    };

    const deleteBlock = (id: string) => {
        if (blocks.length <= 1) {
            updateBlock(id, { type: 'text', text: '', checked: false, indent: 0 });
            return;
        }
        const index = blocks.findIndex(b => b.id === id);
        const prevBlock = blocks[index - 1];
        onChange(blocks.filter(b => b.id !== id));
        if (prevBlock) {
            setTimeout(() => {
                const el = document.getElementById(`block-${prevBlock.id}`);
                el?.focus();
            }, 0);
        }
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
        <div className="space-y-1 py-4">
            {blocks.map((b, idx) => (
                <div 
                    key={b.id} 
                    className="group flex items-start gap-2 py-0.5 relative"
                    style={{ paddingLeft: `${b.indent * 24}px` }}
                >
                    {/* Ghost Controls */}
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            type="button" 
                            onClick={() => deleteBlock(b.id)}
                            className="p-1 text-slate-300 hover:text-red-500 rounded"
                        >
                            <DeleteIcon className="w-3 h-3" />
                        </button>
                        <div className="text-slate-200 cursor-grab active:cursor-grabbing">
                            <DragHandleIcon className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="flex-shrink-0 mt-1 w-5 flex justify-center">
                        {b.type === 'todo' ? (
                            <button 
                                type="button"
                                onClick={() => updateBlock(b.id, { checked: !b.checked })}
                                className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                                    b.checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'
                                }`}
                            >
                                {b.checked && <CheckCircleIcon className="w-3 h-3" />}
                            </button>
                        ) : b.type === 'bullet' ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                        ) : b.type === 'number' ? (
                            <span className="text-[10px] font-black text-slate-400 mt-0.5">{idx + 1}.</span>
                        ) : (
                            <div className="w-4" />
                        )}
                    </div>

                    <textarea
                        id={`block-${b.id}`}
                        value={b.text}
                        onChange={(e) => {
                            const val = e.target.value;
                            // Basic auto-detection of types
                            let type = b.type;
                            let text = val;
                            if (b.type === 'text') {
                                if (val === '- ') { type = 'bullet'; text = ''; }
                                else if (val === '- [ ] ') { type = 'todo'; text = ''; }
                                else if (val === '1. ') { type = 'number'; text = ''; }
                            }
                            updateBlock(b.id, { text, type });
                        }}
                        onKeyDown={(e) => handleKeyDown(e, b)}
                        placeholder={b.type === 'text' ? "Type '/' for commands..." : "List item..."}
                        rows={1}
                        className={`flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed resize-none overflow-hidden min-h-[1.5em] ${
                            b.checked ? 'text-slate-400 line-through' : 'text-slate-700'
                        }`}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = target.scrollHeight + 'px';
                        }}
                    />
                </div>
            ))}
        </div>
    );
};

// Helper: Smart Content Renderer with Interactive Checkboxes (View Mode)
const NoteContentRenderer: React.FC<{ 
    content: string; 
    onToggleCheckbox: (lineIndex: number) => void;
}> = ({ content, onToggleCheckbox }) => {
    const lines = content.split('\n');

    return (
        <div className="space-y-1 font-sans text-[13px] leading-relaxed text-slate-700">
            {lines.map((line, idx) => {
                const checkboxMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)/);
                const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)/);
                const numberMatch = line.match(/^(\s*)\d+\.\s+(.*)/);

                const indentSize = (line.match(/^\s*/) || [""])[0].length;
                const style = { paddingLeft: `${indentSize * 8}px` };

                if (checkboxMatch) {
                    const isChecked = checkboxMatch[2].toLowerCase() === 'x';
                    const textContent = checkboxMatch[3];
                    return (
                        <div key={idx} style={style} className="flex items-start gap-2 py-0.5 group/line">
                            <button 
                                onClick={() => onToggleCheckbox(idx)}
                                className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                                    isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 hover:border-indigo-400'
                                }`}
                            >
                                {isChecked && <CheckCircleIcon className="w-3 h-3" />}
                            </button>
                            <span className={`${isChecked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                                {parseInlineMarkdown(textContent)}
                            </span>
                        </div>
                    );
                }

                if (bulletMatch) {
                    return (
                        <div key={idx} style={style} className="flex items-start gap-2 py-0.5">
                            <span className="text-slate-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                            <span>{parseInlineMarkdown(bulletMatch[2])}</span>
                        </div>
                    );
                }

                if (numberMatch) {
                    return (
                        <div key={idx} style={style} className="flex items-start gap-2 py-0.5">
                            <span className="text-xs font-black text-slate-400 min-w-[1.25rem]">{idx + 1}.</span>
                            <span>{parseInlineMarkdown(numberMatch[2])}</span>
                        </div>
                    );
                }

                return (
                    <div key={idx} style={style} className="min-h-[1.2em]">
                        {parseInlineMarkdown(line)}
                    </div>
                );
            })}
        </div>
    );
};

const parseInlineMarkdown = (text: string) => {
    if (!text) return null;
    let parts: (string | React.ReactNode)[] = [text];

    parts = parts.flatMap(p => {
        if (typeof p !== 'string') return p;
        const subParts = p.split(/~~(.*?)~~/g);
        return subParts.map((sp, i) => i % 2 === 1 ? <span key={i} className="line-through opacity-60">{sp}</span> : sp);
    });

    parts = parts.flatMap(p => {
        if (typeof p !== 'string') return p;
        const subParts = p.split(/\*\*(.*?)\*\*/g);
        return subParts.map((sp, i) => i % 2 === 1 ? <strong key={i} className="font-black text-slate-900">{sp}</strong> : sp);
    });

    return <>{parts}</>;
};

const JournalTab: React.FC<{ notes: BusinessNote[]; onUpdateNotes: (n: BusinessNote[]) => void }> = ({ notes, onUpdateNotes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClassification, setActiveClassification] = useState<string>('bug');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());
    const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [title, setTitle] = useState('');
    const [blocks, setBlocks] = useState<ContentBlock[]>([]);
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
        const content = serializeBlocksToMarkdown(blocks);
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
        setTitle(''); setBlocks([{ id: generateUUID(), type: 'text', text: '', checked: false, indent: 0 }]); setType('bug'); setPriority('medium');
        setEditingId(null); setIsCreating(false);
    };

    const startEdit = (n: BusinessNote) => {
        setEditingId(n.id); setTitle(n.title); setBlocks(parseMarkdownToBlocks(n.content));
        setType(n.type); setPriority(n.priority); setIsCreating(true);
    };

    const toggleCheckboxInContent = (note: BusinessNote, lineIndex: number) => {
        const lines = note.content.split('\n');
        const line = lines[lineIndex];
        let newLine = line;
        if (line.includes('- [ ]')) newLine = line.replace('- [ ]', '- [x]');
        else if (line.includes('- [x]')) newLine = line.replace('- [x]', '- [ ]');
        else if (line.includes('- [X]')) newLine = line.replace('- [X]', '- [ ]');

        lines[lineIndex] = newLine;
        const updatedContent = lines.join('\n');
        const now = new Date().toISOString();
        onUpdateNotes(notes.map(n => n.id === note.id ? { ...n, content: updatedContent, updatedAt: now } : n));
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
        <div className="flex gap-4 h-[750px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden relative">
            {/* SIDEBAR */}
            <div className="w-52 bg-slate-50 border-r border-slate-200 flex flex-col p-3 flex-shrink-0">
                <button onClick={() => { setIsCreating(true); setTitle(''); setBlocks([{ id: generateUUID(), type: 'text', text: '', checked: false, indent: 0 }]); }} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md mb-6 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 text-xs">
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
                        <button key={item.id} onClick={() => { setActiveClassification(item.id); setSelectedNoteId(null); }} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${activeClassification === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                            <div className="flex items-center gap-2">{item.icon}<span>{item.label}</span></div>
                            <span className={`text-[10px] px-1.5 rounded-full ${activeClassification === item.id ? 'bg-indigo-100' : 'bg-slate-200'}`}>{(classificationStats as any)[item.id]}</span>
                        </button>
                    ))}
                    <div className="pt-3 mt-3 border-t border-slate-200">
                        <button onClick={() => { setActiveClassification('resolved'); setSelectedNoteId(null); }} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${activeClassification === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                            <div className="flex items-center gap-2"><CheckCircleIcon className="w-3.5 h-3.5" /><span>Archive</span></div>
                            <span className="text-[10px] bg-slate-200 px-1.5 rounded-full">{classificationStats.resolved}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* LIST */}
            <div className="w-72 border-r border-slate-200 flex flex-col min-h-0 bg-white">
                <div className="p-3 border-b border-slate-100">
                    <input type="text" placeholder="Filter records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredNotes.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => { setSelectedNoteId(n.id); setIsCreating(false); }} 
                            className={`group px-3 py-2.5 border-b border-slate-50 cursor-pointer transition-all ${selectedNoteId === n.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-between mb-0.5">
                                <h4 className={`text-[11px] font-bold truncate pr-2 ${n.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{n.title}</h4>
                                <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded flex-shrink-0 ${n.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{n.priority}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1 leading-relaxed">{n.content}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* DETAIL / EDITOR */}
            <div className="flex-1 bg-white flex flex-col min-h-0 relative">
                {isCreating ? (
                    <div className="p-8 flex-1 overflow-y-auto animate-fade-in flex flex-col">
                        <form onSubmit={handleSave} className="space-y-4 max-w-3xl w-full mx-auto flex flex-col h-full">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{editingId ? 'Edit Record' : 'New Capture'}</h3>
                                <button type="button" onClick={resetForm} className="p-1 text-slate-400 hover:text-red-500"><CloseIcon className="w-5 h-5" /></button>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Title</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Entry heading..." className="w-full p-2 border border-slate-200 rounded-lg font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Type</label>
                                    <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-1.5 border border-slate-200 rounded-lg font-bold text-[10px]">
                                        <option value="bug">Bug Report</option><option value="note">General Note</option><option value="idea">Product Idea</option><option value="task">Operational Task</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Priority</label>
                                    <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full p-1.5 border border-slate-200 rounded-lg font-bold text-[10px]">
                                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 bg-slate-50/50 rounded-xl border border-slate-200 px-6 overflow-y-auto custom-scrollbar">
                                <BlockEditor blocks={blocks} onChange={setBlocks} />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={resetForm} className="px-5 py-2 text-[10px] text-slate-500 font-bold uppercase hover:bg-slate-50 rounded-lg">Discard</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] shadow-lg hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-wider">Save Changes</button>
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
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(activeNote)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg transition-all"><EditIcon className="w-3.5 h-3.5"/></button>
                                <button onClick={() => deleteNote(activeNote.id)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-lg transition-all"><DeleteIcon className="w-3.5 h-3.5"/></button>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 shadow-inner mb-6 min-h-[300px]">
                            <NoteContentRenderer content={activeNote.content} onToggleCheckbox={(idx) => toggleCheckboxInContent(activeNote, idx)} />
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                            <button onClick={() => toggleComplete(activeNote.id)} className={`px-5 py-2.5 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 tracking-widest shadow-sm ${activeNote.isCompleted ? 'bg-slate-800 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'}`}>
                                {activeNote.isCompleted ? <RepeatIcon className="w-4 h-4"/> : <CheckCircleIcon className="w-4 h-4"/>}
                                {activeNote.isCompleted ? 'Return to Backlog' : 'Mark as Resolved'}
                            </button>
                            <button onClick={() => copyToClipboard(activeNote.content)} className="text-indigo-600 font-bold text-[10px] uppercase hover:bg-indigo-50 px-3 py-2 rounded-lg">Copy Raw</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50/30">
                        <BoxIcon className="w-12 h-12 text-indigo-100 mb-4" />
                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Document Selector</h4>
                        <p className="text-slate-400 text-xs mt-2 font-bold max-w-[220px]">Choose an item to view details or start a new capture.</p>
                    </div>
                )}
            </div>
            {copyStatus !== 'idle' && (
                <div className="fixed bottom-10 right-10 z-[200] px-4 py-2 bg-slate-900 text-white rounded-xl shadow-2xl border border-white/10 animate-slide-in-right">
                    <span className="text-xs font-bold">{copyStatus === 'success' ? 'Copied to Clipboard' : 'Copy Failed'}</span>
                </div>
            )}
        </div>
    );
};

// --- Setup Guide Tab ---
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

// --- Tax Advisor Tab ---
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

// --- Main Business Hub Component ---
const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile, notes, onUpdateNotes, chatSessions, onUpdateChatSessions, transactions, accounts, categories }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'advisor' | 'journal' | 'calendar'>('guide');

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
                {activeTab === 'calendar' && (
                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-xl font-bold mb-6">Upcoming Deadlines</h2>
                        <div className="space-y-4">
                            {[
                                { date: 'Jan 31', title: '1099-NEC Deadline', desc: 'Send for payments > $600.' },
                                { date: 'Apr 15', title: 'Tax Day', desc: 'Federal income tax deadline.' },
                                { date: 'Jun 15', title: 'Q2 Estimates', desc: 'Quarterly payment due.' },
                            ].map((d, i) => (
                                <div key={i} className="flex gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border">
                                    <div className="text-indigo-600 font-bold w-16">{d.date}</div>
                                    <div><div className="font-bold text-slate-800">{d.title}</div><div className="text-sm text-slate-500">{d.desc}</div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessHub;