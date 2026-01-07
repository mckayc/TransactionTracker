import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo, ChatSession, ChatMessage, Transaction, Account, Category, BusinessNote } from '../types';
import { CheckCircleIcon, SparklesIcon, CurrencyDollarIcon, SendIcon, ExclamationTriangleIcon, AddIcon, DeleteIcon, ChatBubbleIcon, CloudArrowUpIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, SortIcon, ChevronDownIcon, CloseIcon, CopyIcon, TableIcon, ChevronRightIcon, LightBulbIcon, ChecklistIcon, BoxIcon, RepeatIcon, ListIcon, TypeIcon, DragHandleIcon, TrashIcon } from '../components/Icons';
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

type BlockType = 'paragraph' | 'todo' | 'bullet' | 'number' | 'h1';

interface ContentBlock {
    id: string;
    type: BlockType;
    text: string;
    checked: boolean;
    indent: number;
}

// --- Markdown Parser & Serializer ---

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

// --- WYSIWYG Editor Components ---

const BlockEditor: React.FC<{
    blocks: ContentBlock[];
    onChange: (blocks: ContentBlock[]) => void;
}> = ({ blocks, onChange }) => {
    const [focusedId, setFocusedId] = useState<string | null>(null);

    const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
        onChange(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const addBlock = (afterId: string, type: BlockType = 'paragraph', indent: number = 0) => {
        const index = blocks.findIndex(b => b.id === afterId);
        const newBlock = { id: generateUUID(), type, text: '', checked: false, indent };
        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);
        onChange(newBlocks);
        setTimeout(() => document.getElementById(`block-${newBlock.id}`)?.focus(), 10);
    };

    const deleteBlock = (id: string) => {
        if (blocks.length <= 1) {
            updateBlock(id, { type: 'paragraph', text: '', checked: false, indent: 0 });
            return;
        }
        const index = blocks.findIndex(b => b.id === id);
        const prevBlock = blocks[index - 1];
        onChange(blocks.filter(b => b.id !== id));
        if (prevBlock) setTimeout(() => document.getElementById(`block-${prevBlock.id}`)?.focus(), 10);
    };

    const handleKeyDown = (e: React.KeyboardEvent, b: ContentBlock) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // If block is empty list item, convert to paragraph. Otherwise add same type.
            if (b.text === '' && b.type !== 'paragraph') {
                updateBlock(b.id, { type: 'paragraph', indent: 0 });
            } else {
                addBlock(b.id, b.type, b.indent);
            }
        } else if (e.key === 'Backspace' && b.text === '') {
            e.preventDefault();
            if (b.type !== 'paragraph' || b.indent > 0) {
                updateBlock(b.id, { type: 'paragraph', indent: 0 });
            } else {
                deleteBlock(b.id);
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newIndent = e.shiftKey ? Math.max(0, b.indent - 1) : Math.min(5, b.indent + 1);
            updateBlock(b.id, { indent: newIndent });
        }
    };

    const setSelectionFormatting = (prefix: string, suffix: string) => {
        if (!focusedId) return;
        const textarea = document.getElementById(`block-${focusedId}`) as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const selection = text.substring(start, end);
        const after = text.substring(end);

        const newText = before + prefix + selection + suffix + after;
        updateBlock(focusedId, { text: newText });
        
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 10);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Joplin-style Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm mr-2">
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'todo' })} className="p-1.5 hover:bg-indigo-50 rounded text-slate-600 transition-all" title="Todo List"><ChecklistIcon className="w-4 h-4" /></button>
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'bullet' })} className="p-1.5 hover:bg-indigo-50 rounded text-slate-600 transition-all" title="Bullet List"><ListIcon className="w-4 h-4" /></button>
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'number' })} className="p-1.5 hover:bg-indigo-50 rounded text-slate-600 transition-all font-bold text-xs" title="Numbered List">1.</button>
                </div>
                <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                    <button type="button" onClick={() => setSelectionFormatting('**', '**')} className="px-2.5 py-1.5 hover:bg-indigo-50 rounded text-slate-600 font-black text-xs" title="Bold">B</button>
                    <button type="button" onClick={() => setSelectionFormatting('~~', '~~')} className="px-2.5 py-1.5 hover:bg-indigo-50 rounded text-slate-600 font-medium text-xs line-through" title="Strikethrough">S</button>
                </div>
                <div className="ml-auto flex items-center gap-2 pr-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Editor Mode</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
            </div>

            {/* Block Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-1 custom-scrollbar bg-white">
                {blocks.map((b, idx) => {
                    const blockNumber = blocks.slice(0, idx + 1).filter(pb => pb.type === 'number').length;
                    return (
                        <div 
                            key={b.id} 
                            className={`group flex items-start gap-3 py-1 relative rounded-lg transition-colors ${focusedId === b.id ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}
                            style={{ paddingLeft: `${b.indent * 28}px` }}
                        >
                            {/* Margin Area */}
                            <div className="flex-shrink-0 mt-1 w-6 flex justify-center items-start">
                                {b.type === 'todo' ? (
                                    <button 
                                        type="button"
                                        onClick={() => updateBlock(b.id, { checked: !b.checked })}
                                        className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                                            b.checked ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-300 hover:border-indigo-400'
                                        }`}
                                    >
                                        {b.checked && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                    </button>
                                ) : b.type === 'bullet' ? (
                                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-2 shadow-inner" />
                                ) : b.type === 'number' ? (
                                    <span className="text-xs font-black text-slate-400 mt-1.5 font-mono">{blockNumber}.</span>
                                ) : b.type === 'h1' ? (
                                    <span className="text-xs font-black text-indigo-400 mt-2">H</span>
                                ) : null}
                            </div>

                            {/* Text Area */}
                            <textarea
                                id={`block-${b.id}`}
                                value={b.text}
                                onFocus={() => setFocusedId(b.id)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    let type = b.type;
                                    let text = val;
                                    // Visual Shortcuts
                                    if (b.type === 'paragraph') {
                                        if (val === '- ') { type = 'bullet'; text = ''; }
                                        else if (val === '[] ') { type = 'todo'; text = ''; }
                                        else if (val === '1. ') { type = 'number'; text = ''; }
                                        else if (val === '# ') { type = 'h1'; text = ''; }
                                    }
                                    updateBlock(b.id, { text, type });
                                }}
                                onKeyDown={(e) => handleKeyDown(e, b)}
                                placeholder={b.type === 'paragraph' ? "Write something or type '- ' for lists..." : "Enter detail..."}
                                rows={1}
                                className={`flex-1 bg-transparent border-none focus:ring-0 p-0 leading-relaxed resize-none overflow-hidden min-h-[1.5em] transition-all duration-200 ${
                                    b.type === 'h1' ? 'text-lg font-black text-slate-800' : 'text-sm font-medium'
                                } ${b.checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = target.scrollHeight + 'px';
                                }}
                                style={{ height: 'auto' }}
                            />

                            {/* Action Area */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity flex-shrink-0">
                                <button type="button" onClick={() => deleteBlock(b.id)} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <span>Blocks: {blocks.length}</span>
                <div className="flex gap-4">
                    <span>Tab: Indent</span>
                    <span>Enter: New Block</span>
                </div>
            </div>
        </div>
    );
};

// --- Viewer Components ---

const parseInlineMarkdown = (text: string) => {
    if (!text) return null;
    let parts: (string | React.ReactNode)[] = [text];
    parts = parts.flatMap(p => {
        if (typeof p !== 'string') return p;
        const subParts = p.split(/~~(.*?)~~/g);
        return subParts.map((sp, i) => i % 2 === 1 ? <span key={i} className="line-through opacity-60 italic">{sp}</span> : sp);
    });
    parts = parts.flatMap(p => {
        if (typeof p !== 'string') return p;
        const subParts = p.split(/\*\*(.*?)\*\*/g);
        return subParts.map((sp, i) => i % 2 === 1 ? <strong key={i} className="font-black text-slate-900">{sp}</strong> : sp);
    });
    return <>{parts}</>;
};

const NoteContentRenderer: React.FC<{ 
    content: string; 
    onToggleCheckbox: (lineIndex: number) => void;
}> = ({ content, onToggleCheckbox }) => {
    const blocks = parseMarkdownToBlocks(content);
    let numberIndex = 0;

    return (
        <div className="space-y-1.5 font-sans text-sm leading-relaxed text-slate-700">
            {blocks.map((b, idx) => {
                const style = { paddingLeft: `${b.indent * 24}px` };
                if (b.type === 'number') numberIndex++; else if (b.type !== 'number' && b.type !== 'paragraph') numberIndex = 0;

                if (b.type === 'todo') {
                    return (
                        <div key={idx} style={style} className="flex items-start gap-3 py-0.5 group">
                            <button 
                                onClick={() => onToggleCheckbox(idx)}
                                className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                    b.checked ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-300 hover:border-indigo-400'
                                }`}
                            >
                                {b.checked && <CheckCircleIcon className="w-3.5 h-3.5" />}
                            </button>
                            <span className={`pt-0.5 ${b.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                                {parseInlineMarkdown(b.text)}
                            </span>
                        </div>
                    );
                }

                if (b.type === 'bullet') {
                    return (
                        <div key={idx} style={style} className="flex items-start gap-3 py-1">
                            <span className="text-slate-400 mt-2 w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                            <span className="text-slate-700 font-medium">{parseInlineMarkdown(b.text)}</span>
                        </div>
                    );
                }

                if (b.type === 'number') {
                    return (
                        <div key={idx} style={style} className="flex items-start gap-3 py-1">
                            <span className="text-xs font-black text-slate-400 mt-0.5 min-w-[1rem] font-mono">{numberIndex}.</span>
                            <span className="text-slate-700 font-medium">{parseInlineMarkdown(b.text)}</span>
                        </div>
                    );
                }

                if (b.type === 'h1') {
                    return <h1 key={idx} style={style} className="text-xl font-black text-slate-900 pt-4 pb-2">{parseInlineMarkdown(b.text)}</h1>;
                }

                return (
                    <div key={idx} style={style} className="min-h-[1.5em] text-slate-600 font-medium py-0.5">
                        {parseInlineMarkdown(b.text)}
                    </div>
                );
            })}
        </div>
    );
};

// --- Main Journal Tab ---

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
        setTitle(''); setBlocks([{ id: generateUUID(), type: 'paragraph', text: '', checked: false, indent: 0 }]); setType('bug'); setPriority('medium');
        setEditingId(null); setIsCreating(false);
    };

    const startEdit = (n: BusinessNote) => {
        setEditingId(n.id); setTitle(n.title); setBlocks(parseMarkdownToBlocks(n.content));
        setType(n.type); setPriority(n.priority); setIsCreating(true);
    };

    const toggleCheckboxInContent = (note: BusinessNote, lineIndex: number) => {
        const lineBlocks = parseMarkdownToBlocks(note.content);
        if (lineBlocks[lineIndex]) {
            lineBlocks[lineIndex].checked = !lineBlocks[lineIndex].checked;
            const updatedContent = serializeBlocksToMarkdown(lineBlocks);
            const now = new Date().toISOString();
            onUpdateNotes(notes.map(n => n.id === note.id ? { ...n, content: updatedContent, updatedAt: now } : n));
        }
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
        <div className="flex gap-4 h-[750px] bg-slate-50 border border-slate-200 rounded-2xl shadow-xl overflow-hidden relative p-1">
            {/* Classification Sidebar */}
            <div className="w-52 bg-white border border-slate-200 rounded-xl flex flex-col p-3 flex-shrink-0 shadow-sm">
                <button onClick={() => { setIsCreating(true); resetForm(); }} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-black shadow-lg shadow-indigo-100 mb-6 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 text-xs uppercase tracking-widest">
                    <AddIcon className="w-3.5 h-3.5" /> New Capture
                </button>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Classify</p>
                    {[
                        { id: 'bug', label: 'Bugs', icon: <BugIcon className="w-3.5 h-3.5" /> },
                        { id: 'note', label: 'Notes', icon: <NotesIcon className="w-3.5 h-3.5" /> },
                        { id: 'idea', label: 'Ideas', icon: <LightBulbIcon className="w-3.5 h-3.5" /> },
                        { id: 'task', label: 'Tasks', icon: <ChecklistIcon className="w-3.5 h-3.5" /> }
                    ].map(item => (
                        <button key={item.id} onClick={() => { setActiveClassification(item.id); setSelectedNoteId(null); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeClassification === item.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <div className="flex items-center gap-3">{item.icon}<span>{item.label}</span></div>
                            <span className={`text-[10px] px-1.5 rounded-full ${activeClassification === item.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{(classificationStats as any)[item.id]}</span>
                        </button>
                    ))}
                    <div className="pt-3 mt-3 border-t border-slate-100">
                        <button onClick={() => { setActiveClassification('resolved'); setSelectedNoteId(null); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeClassification === 'resolved' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <div className="flex items-center gap-3"><CheckCircleIcon className="w-3.5 h-3.5" /><span>Archive</span></div>
                            <span className={`text-[10px] px-1.5 rounded-full ${activeClassification === 'resolved' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{classificationStats.resolved}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* List Master View */}
            <div className="w-80 bg-white border border-slate-200 rounded-xl flex flex-col min-h-0 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative group">
                        <input type="text" placeholder="Search entries..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                        <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredNotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 p-8 text-center">
                            <BoxIcon className="w-12 h-12 mb-4 opacity-10" />
                            <p className="text-xs font-black uppercase tracking-widest">No entries found</p>
                        </div>
                    ) : (
                        filteredNotes.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => { setSelectedNoteId(n.id); setIsCreating(false); }} 
                                className={`group p-4 border-b border-slate-50 cursor-pointer transition-all ${selectedNoteId === n.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <h4 className={`text-xs font-black truncate pr-4 ${n.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{n.title}</h4>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0 ${n.priority === 'high' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{n.priority}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium">{n.content}</p>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-[8px] font-black text-slate-300 uppercase">{new Date(n.updatedAt).toLocaleDateString()}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); startEdit(n); }} className="p-1 text-slate-400 hover:text-indigo-600"><EditIcon className="w-3 h-3"/></button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }} className="p-1 text-slate-400 hover:text-red-600"><DeleteIcon className="w-3 h-3"/></button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Detail / Editor Canvas */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col min-h-0 shadow-sm relative overflow-hidden">
                {isCreating ? (
                    <div className="flex-1 flex flex-col min-h-0 bg-white animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingId ? 'Updating Entry' : 'New Capture'}</h3>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-1">Block Editor v2.0</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-4 border-r pr-4 border-slate-200">
                                    <select value={type} onChange={e => setType(e.target.value as any)} className="bg-white border rounded-lg p-1.5 text-[10px] font-black uppercase text-slate-700 outline-none ring-indigo-100 focus:ring-2">
                                        <option value="bug">BUG</option><option value="note">NOTE</option><option value="idea">IDEA</option><option value="task">TASK</option>
                                    </select>
                                    <select value={priority} onChange={e => setPriority(e.target.value as any)} className="bg-white border rounded-lg p-1.5 text-[10px] font-black uppercase text-slate-700 outline-none ring-indigo-100 focus:ring-2">
                                        <option value="low">LOW</option><option value="medium">MED</option><option value="high">HIGH</option>
                                    </select>
                                </div>
                                <button type="button" onClick={resetForm} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-white transition-colors"><CloseIcon className="w-6 h-6" /></button>
                            </div>
                        </div>

                        <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            <div className="max-w-3xl mx-auto space-y-8 h-full flex flex-col">
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    placeholder="Enter header title..." 
                                    className="w-full text-4xl font-black text-slate-900 border-none bg-transparent placeholder:text-slate-100 focus:ring-0 p-0" 
                                />
                                
                                <div className="flex-1">
                                    <BlockEditor blocks={blocks} onChange={setBlocks} />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 text-indigo-400" /> Auto-saving to local ledger
                            </p>
                            <div className="flex gap-3">
                                <button type="button" onClick={resetForm} className="px-6 py-2.5 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors">Abort</button>
                                <button onClick={handleSave} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest">Commit Changes</button>
                            </div>
                        </div>
                    </div>
                ) : activeNote ? (
                    <div className="flex-1 flex flex-col min-h-0 bg-white animate-fade-in">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/30">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${activeNote.type === 'bug' ? 'bg-red-500 text-white border-red-600' : 'bg-indigo-600 text-white border-indigo-700'}`}>{activeNote.type}</span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-200 text-slate-500 ${activeNote.priority === 'high' ? 'text-red-600 border-red-100 bg-red-50' : ''}`}>{activeNote.priority} priority</span>
                                    {activeNote.isCompleted && <span className="px-2 py-1 rounded bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm"><CheckCircleIcon className="w-3.5 h-3.5" /> Resolved</span>}
                                </div>
                                <h3 className="text-4xl font-black text-slate-900 leading-tight">{activeNote.title}</h3>
                                <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                    <span className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5"/> Modified {new Date(activeNote.updatedAt).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5"/> Created {new Date(activeNote.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(activeNote)} className="p-2.5 bg-white text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-xl shadow-sm transition-all hover:scale-105" title="Edit Entry"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => deleteNote(activeNote.id)} className="p-2.5 bg-white text-slate-400 hover:text-red-500 border border-slate-200 rounded-xl shadow-sm transition-all hover:scale-105" title="Delete"><DeleteIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                        
                        <div className="flex-1 p-12 overflow-y-auto custom-scrollbar bg-white">
                            <div className="max-w-3xl mx-auto min-h-[400px]">
                                <NoteContentRenderer content={activeNote.content} onToggleCheckbox={(idx) => toggleCheckboxInContent(activeNote, idx)} />
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center rounded-b-xl">
                            <button onClick={() => toggleComplete(activeNote.id)} className={`px-8 py-3 rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-3 tracking-widest shadow-lg ${activeNote.isCompleted ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'}`}>
                                {activeNote.isCompleted ? <RepeatIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                                {activeNote.isCompleted ? 'Return to Backlog' : 'Resolve Entry'}
                            </button>
                            <button onClick={() => copyToClipboard(activeNote.content)} className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all tracking-widest">
                                <CopyIcon className="w-4 h-4"/> Export Raw
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-slate-50/50">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl mb-8 group-hover:scale-110 transition-transform">
                             <NotesIcon className="w-10 h-10 text-indigo-200" />
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Document Explorer</h4>
                        <p className="text-slate-400 text-sm mt-4 font-bold max-w-xs leading-relaxed">Choose a record from the ledger or start a fresh capture session.</p>
                        <button onClick={() => setIsCreating(true)} className="mt-8 px-10 py-4 bg-white border-2 border-indigo-600 text-indigo-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-600 hover:text-white shadow-xl transition-all transform active:scale-95">Create New Record</button>
                    </div>
                )}
            </div>
            {copyStatus !== 'idle' && (
                <div className="fixed bottom-10 right-10 z-[200] px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10 animate-slide-in-right flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${copyStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-black uppercase tracking-widest">{copyStatus === 'success' ? 'Copied to Clipboard' : 'Copy Failed'}</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-4"><div className="bg-indigo-100 p-2.5 rounded-xl"><CheckCircleIcon className="w-6 h-6 text-indigo-600" /></div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Business Structure</h2></div>
                <div className="space-y-5">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Legal Business Name</label><input type="text" value={profile.info.llcName || ''} onChange={(e) => updateInfo('llcName', e.target.value)} placeholder="My Business LLC" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Industry Sector</label><input type="text" value={profile.info.industry || ''} onChange={(e) => updateInfo('industry', e.target.value)} placeholder="e.g. Software, E-commerce" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Entity Type</label><select value={profile.info.businessType || ''} onChange={(e) => updateInfo('businessType', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"><option value="">Select...</option><option value="sole-proprietor">Sole Proprietor</option><option value="llc-single">Single-Member LLC</option><option value="s-corp">S-Corp</option></select></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">State Registry</label><input type="text" value={profile.info.stateOfFormation || ''} onChange={(e) => updateInfo('stateOfFormation', e.target.value)} placeholder="DE" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-4"><div className="bg-emerald-100 p-2.5 rounded-xl"><CheckCircleIcon className="w-6 h-6 text-emerald-600" /></div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Tax Configuration</h2></div>
                <div className="space-y-5">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Filing Status</label><select value={profile.tax.filingStatus || ''} onChange={(e) => updateTax('filingStatus', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"><option value="">Select...</option><option value="sole-proprietor">Sole Proprietor (Schedule C)</option><option value="s-corp">S-Corp (1120-S)</option></select></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tax Year End</label><input type="date" value={profile.tax.taxYearEnd || ''} onChange={(e) => updateTax('taxYearEnd', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div>
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
            id: generateUUID(), title: `Strategy ${new Date().toLocaleDateString()}`,
            messages: [{ id: generateUUID(), role: 'ai', content: `Expert Guidance active for your **${profile.info.businessType || 'business'}**.`, timestamp: new Date().toISOString() }],
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

    if (!apiKeyAvailable) return <div className="p-20 text-center bg-slate-50 border-dashed border-2 border-slate-200 rounded-3xl font-black text-slate-300 uppercase tracking-widest animate-pulse">API Configuration Required for AI Guidance</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[700px] animate-fade-in">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b bg-slate-50 flex justify-between items-center font-black text-slate-800 uppercase tracking-tighter">
                    <div className="flex items-center gap-3"><SparklesIcon className="w-5 h-5 text-indigo-600"/><span>Advisor Chat {activeSession ? `— ${activeSession.title}` : ''}</span></div>
                    <button onClick={handleCreateSession} className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-[10px] hover:bg-slate-50 transition-all active:scale-95"><AddIcon className="w-4 h-4 inline mr-1.5"/>New session</button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-white">
                    {!activeSession ? <div className="h-full flex flex-col items-center justify-center text-slate-300"><BoxIcon className="w-16 h-16 opacity-5 mb-4"/><p className="text-xs font-black uppercase tracking-widest">Open a strategy session</p></div> : 
                        activeSession.messages.map(m => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-4 rounded-2xl max-w-[85%] text-sm shadow-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white font-bold rounded-br-none' : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-bl-none font-medium'}`}>
                                    <div className="prose prose-sm prose-indigo" dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                </div>
                            </div>
                        ))}
                    <div ref={messagesEndRef} />
                </div>
                {activeSession && (
                    <div className="p-6 border-t bg-slate-50 flex gap-4">
                        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="flex-1 p-3 border-2 border-white rounded-xl shadow-inner focus:border-indigo-500 outline-none font-medium text-sm transition-all" placeholder="Inquire about deductions or strategies..." />
                        <button onClick={handleSendMessage} className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"><SendIcon className="w-6 h-6"/></button>
                    </div>
                )}
            </div>
            <div className="space-y-6">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg">
                    <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight"><SparklesIcon className="w-6 h-6 text-yellow-500" /> Deduction Scout</h3>
                    <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">AI analysis of common tax breaks for the <strong className="text-indigo-600">{profile.info.industry || 'specified'}</strong> sector.</p>
                    <button onClick={async () => { setLoadingDeductions(true); try { setDeductions(await getIndustryDeductions(profile.info.industry || 'General')); } catch(e){} finally { setLoadingDeductions(false); }}} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all transform active:scale-95 disabled:opacity-50">{loadingDeductions ? 'Analyzing...' : 'Execute Audit'}</button>
                    {deductions.length > 0 && <ul className="mt-8 space-y-3">{deductions.map((d, i) => <li key={i} className="text-[11px] bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex gap-3 text-emerald-800 font-bold"><CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />{d}</li>)}</ul>}
                </div>
            </div>
        </div>
    );
};

// --- Main Business Hub ---

const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile, notes, onUpdateNotes, chatSessions, onUpdateChatSessions, transactions, accounts, categories }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'advisor' | 'journal' | 'calendar'>('guide');

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Business Hub</h1>
                    <p className="text-slate-500 mt-1 font-medium italic">Operational blueprint and AI-powered entity intelligence.</p>
                </div>
                <div className="flex bg-white rounded-2xl p-1 shadow-xl border border-slate-200">
                    {[
                        { id: 'guide', label: 'Guide' },
                        { id: 'advisor', label: 'AI Advisor' },
                        { id: 'journal', label: 'Journal & Logs' },
                        { id: 'calendar', label: 'Events' }
                    ].map((t) => (
                        <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-[500px]">
                {activeTab === 'guide' && <SetupGuideTab profile={profile} onUpdateProfile={onUpdateProfile} />}
                {activeTab === 'advisor' && <TaxAdvisorTab profile={profile} sessions={chatSessions} onUpdateSessions={onUpdateChatSessions} transactions={transactions} accounts={accounts} categories={categories} />}
                {activeTab === 'journal' && <JournalTab notes={notes} onUpdateNotes={onUpdateNotes} />}
                {activeTab === 'calendar' && (
                    <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Compliance Timeline</h2>
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-indigo-100 shadow-sm">Upcoming Deadlines</span>
                        </div>
                        <div className="space-y-6">
                            {[
                                { date: 'Jan 31', title: '1099-NEC Deadline', desc: 'Execute payments for contractors exceeding $600 threshold.' },
                                { date: 'Apr 15', title: 'Federal Tax Day', desc: 'Deadline for personal and C-Corp federal filings.' },
                                { date: 'Jun 15', title: 'Q2 Estimated Payments', desc: 'Submit quarterly withholding to IRS for second period.' },
                            ].map((d, i) => (
                                <div key={i} className="flex gap-6 p-6 hover:bg-slate-50 rounded-3xl transition-all border border-transparent hover:border-slate-100 group">
                                    <div className="text-indigo-600 font-black w-24 text-lg tabular-nums border-r border-indigo-100">{d.date}</div>
                                    <div className="flex-1">
                                        <div className="font-black text-slate-800 text-lg group-hover:text-indigo-900 transition-colors uppercase tracking-tight">{d.title}</div>
                                        <div className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">{d.desc}</div>
                                    </div>
                                    <ChevronRightIcon className="w-6 h-6 text-slate-200 group-hover:text-indigo-400 transition-colors self-center" />
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