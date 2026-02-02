import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { BusinessNote, BusinessProfile } from '../types';
import { CheckCircleIcon, SparklesIcon, SendIcon, AddIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, CloseIcon, ListIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ChecklistIcon, LightBulbIcon, ChevronRightIcon, ChevronDownIcon, ShieldCheckIcon, BoxIcon, InfoIcon, RobotIcon, CopyIcon, FileTextIcon, SaveIcon, DatabaseIcon } from '../components/Icons';
import { generateUUID, copyToClipboard } from '../utils';

interface JournalPageProps {
    notes: BusinessNote[];
    onUpdateNotes: (notes: BusinessNote[]) => void;
    profile: BusinessProfile;
}

type BlockType = 'paragraph' | 'todo' | 'bullet' | 'number' | 'h1';

interface ContentBlock {
    id: string;
    type: BlockType;
    text: string;
    checked: boolean;
    indent: number;
}

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-slide-up">
            <div className="bg-slate-900/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3">
                <div className="bg-indigo-500 rounded-full p-1">
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold tracking-tight">{message}</span>
            </div>
        </div>
    );
};

const parseMarkdownToBlocks = (markdown: string): ContentBlock[] => {
    if (!markdown || markdown.trim() === '') {
        return [{ id: generateUUID(), type: 'paragraph', text: '', checked: false, indent: 0 }];
    }
    return markdown.split('\n').map(line => {
        const indentMatch = line.match(/^(\s*)/);
        const indentCount = indentMatch ? indentMatch[0].length : 0;
        const indent = Math.floor(indentCount / 2);
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) return { id: generateUUID(), type: 'h1', text: trimmed.replace('# ', ''), checked: false, indent };
        if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
            return { id: generateUUID(), type: 'todo', text: trimmed.replace(/- \[[ xX]\]\s*/, ''), checked: trimmed.toLowerCase().includes('- [x]'), indent };
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return { id: generateUUID(), type: 'bullet', text: trimmed.replace(/^[-*]\s+/, ''), checked: false, indent };
        const numMatch = trimmed.match(/^\d+\.\s+(.*)/);
        if (numMatch) return { id: generateUUID(), type: 'number', text: numMatch[1], checked: false, indent };
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
    initialContent: string;
    onChange: (content: string) => void;
    onCopyFiltered: (text: string) => void;
}> = ({ initialContent, onChange, onCopyFiltered }) => {
    // Local state for blocks to ensure fast typing
    const [blocks, setBlocks] = useState<ContentBlock[]>(() => parseMarkdownToBlocks(initialContent));
    const [focusedId, setFocusedId] = useState<string | null>(null);

    // Sync back to parent debounced
    useEffect(() => {
        const timer = setTimeout(() => {
            const markdown = serializeBlocksToMarkdown(blocks);
            if (markdown !== initialContent) {
                onChange(markdown);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [blocks]);

    const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const addBlock = (afterId: string, type: BlockType = 'paragraph', indent: number = 0) => {
        const index = blocks.findIndex(b => b.id === afterId);
        const newBlock = { id: generateUUID(), type, text: '', checked: false, indent };
        const next = [...blocks];
        next.splice(index + 1, 0, newBlock);
        setBlocks(next);
        setTimeout(() => document.getElementById(`block-${newBlock.id}`)?.focus(), 10);
    };

    const deleteBlock = (id: string) => {
        if (blocks.length <= 1) {
            updateBlock(id, { type: 'paragraph', text: '', checked: false, indent: 0 });
            return;
        }
        const index = blocks.findIndex(b => b.id === id);
        const prevBlock = blocks[index - 1];
        const next = blocks.filter(b => b.id !== id);
        setBlocks(next);
        if (prevBlock) setTimeout(() => document.getElementById(`block-${prevBlock.id}`)?.focus(), 10);
    };

    const moveBlock = (id: string, direction: 'up' | 'down') => {
        const index = blocks.findIndex(b => b.id === id);
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === blocks.length - 1) return;

        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        const newBlocks = [...blocks];
        [newBlocks[index], newBlocks[nextIndex]] = [newBlocks[nextIndex], newBlocks[index]];
        setBlocks(newBlocks);
        setTimeout(() => document.getElementById(`block-${id}`)?.focus(), 10);
    };

    const handleKeyDown = (e: React.KeyboardEvent, b: ContentBlock) => {
        const index = blocks.findIndex(item => item.id === b.id);
        
        if (e.key === 'Enter') {
            e.preventDefault();
            // If pressing enter on an empty list item, turn it back into a paragraph (double enter to exit list)
            if (b.text === '' && b.type !== 'paragraph') {
                updateBlock(b.id, { type: 'paragraph' });
            } else {
                addBlock(b.id, b.type, b.indent);
            }
        } else if (e.key === 'Backspace' && b.text === '') {
            e.preventDefault();
            if (b.type !== 'paragraph') {
                updateBlock(b.id, { type: 'paragraph' });
            } else {
                deleteBlock(b.id);
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newIndent = e.shiftKey ? Math.max(0, b.indent - 1) : Math.min(5, b.indent + 1);
            updateBlock(b.id, { indent: newIndent });
        } else if (e.key === 'ArrowUp') {
            if (index > 0) {
                e.preventDefault();
                document.getElementById(`block-${blocks[index - 1].id}`)?.focus();
            }
        } else if (e.key === 'ArrowDown') {
            if (index < blocks.length - 1) {
                e.preventDefault();
                document.getElementById(`block-${blocks[index + 1].id}`)?.focus();
            }
        }
    };

    const sortCheckedToBottom = () => {
        const incomplete = blocks.filter(b => b.type !== 'todo' || !b.checked);
        const complete = blocks.filter(b => b.type === 'todo' && b.checked);
        setBlocks([...incomplete, ...complete]);
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-inner">
            <div className="flex items-center justify-between p-1.5 bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <div className="flex items-center gap-1">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                        <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'paragraph' })} className="p-1.5 hover:bg-indigo-50 rounded-md text-slate-500 hover:text-indigo-600 transition-all font-black text-[9px] px-2" title="Text">TXT</button>
                        <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'todo' })} className="p-1.5 hover:bg-indigo-50 rounded-md text-slate-500 hover:text-indigo-600 transition-all" title="Checkbox"><ChecklistIcon className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'bullet' })} className="p-1.5 hover:bg-indigo-50 rounded-md text-slate-500 hover:text-indigo-600 transition-all" title="Bullet"><ListIcon className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'h1' })} className="p-1.5 hover:bg-indigo-50 rounded-md text-slate-500 hover:text-indigo-600 transition-all font-black text-[10px] px-2" title="Header">H1</button>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button type="button" onClick={sortCheckedToBottom} className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        <ArrowDownIcon className="w-3 h-3" /> Sink Done
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-0.5" />
                    <button type="button" onClick={() => onCopyFiltered(serializeBlocksToMarkdown(blocks.filter(b => !b.checked)))} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md">
                        <RobotIcon className="w-3 h-3" /> Copy for AI
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar bg-slate-50/5">
                {blocks.map((b) => (
                    <div 
                        key={b.id} 
                        className={`group flex items-start gap-1.5 py-0.5 relative rounded-lg transition-colors ${focusedId === b.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/60'}`}
                        style={{ paddingLeft: `${b.indent * 16}px` }}
                    >
                        <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                             <button onClick={() => moveBlock(b.id, 'up')} className="p-0.5 text-slate-300 hover:text-indigo-500" title="Move Up"><ArrowUpIcon className="w-3 h-3"/></button>
                             <button onClick={() => moveBlock(b.id, 'down')} className="p-0.5 text-slate-300 hover:text-indigo-500" title="Move Down"><ArrowDownIcon className="w-3 h-3"/></button>
                        </div>

                        <div className="flex-shrink-0 mt-1.5 w-4 flex justify-center">
                            {b.type === 'todo' ? (
                                <button 
                                    type="button"
                                    onClick={() => updateBlock(b.id, { checked: !b.checked })}
                                    className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${b.checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 hover:border-indigo-400 shadow-sm'}`}
                                >
                                    {b.checked && <CheckCircleIcon className="w-2.5 h-2.5" />}
                                </button>
                            ) : b.type === 'bullet' ? (
                                <div className="w-1 h-1 rounded-full bg-slate-300 mt-2" />
                            ) : b.type === 'h1' ? (
                                <span className="text-[8px] font-black text-indigo-400 mt-1.5 uppercase">H1</span>
                            ) : b.type === 'number' ? (
                                <span className="text-[9px] font-black text-slate-300 mt-1.5">1.</span>
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
                                // Simple auto-formatting on space
                                if (b.type === 'paragraph' && text.length === 2) {
                                    if (text === '- ') { type = 'bullet'; text = ''; }
                                    else if (text === '# ') { type = 'h1'; text = ''; }
                                    else if (text === '1.') { type = 'number'; text = ''; }
                                } else if (b.type === 'paragraph' && text.length === 3) {
                                    if (text === '[] ') { type = 'todo'; text = ''; }
                                }
                                updateBlock(b.id, { text, type });
                            }}
                            onKeyDown={(e) => handleKeyDown(e, b)}
                            placeholder={b.type === 'paragraph' ? 'Type text or "/" for commands' : ''}
                            rows={1}
                            className={`flex-1 bg-transparent border-none focus:ring-0 p-0 leading-relaxed resize-none overflow-hidden min-h-[1.4em] transition-all duration-200 ${b.type === 'h1' ? 'text-base font-black text-slate-800' : 'text-sm font-medium'} ${b.checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                            }}
                        />
                        <button type="button" onClick={() => deleteBlock(b.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-200 hover:text-rose-500 rounded-md transition-all self-start mt-0.5"><TrashIcon className="w-3.5 h-3.5"/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const JournalPage: React.FC<JournalPageProps> = ({ notes, onUpdateNotes, profile }) => {
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // BUFFERED LOCAL STATE to prevent typing lag
    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localType, setLocalType] = useState<'bug' | 'note' | 'idea' | 'task'>('note');
    const [localIsCompleted, setLocalIsCompleted] = useState(false);

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

    // Initialize local state when selecting a new note
    useEffect(() => {
        if (activeNote) {
            setLocalTitle(activeNote.title);
            setLocalContent(activeNote.content);
            setLocalType(activeNote.type);
            setLocalIsCompleted(activeNote.isCompleted);
        }
    }, [selectedNoteId]);

    // DEBOUNCED GLOBAL SYNC
    useEffect(() => {
        if (!selectedNoteId) return;
        const timer = setTimeout(() => {
            const current = notes.find(n => n.id === selectedNoteId);
            if (!current) return;
            
            // Only update if something actually changed
            if (current.title !== localTitle || current.content !== localContent || current.type !== localType || current.isCompleted !== localIsCompleted) {
                onUpdateNotes(notes.map(n => n.id === selectedNoteId ? { 
                    ...n, 
                    title: localTitle, 
                    content: localContent, 
                    type: localType, 
                    isCompleted: localIsCompleted,
                    updatedAt: new Date().toISOString() 
                } : n));
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [localTitle, localContent, localType, localIsCompleted, selectedNoteId]);

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

    const handleCopyForAI = async (text: string) => {
        const success = await copyToClipboard(text);
        if (success) {
            setToastMessage("Context Copied (Excludes Completed Tasks)");
        } else {
            alert("Copy failed. Please manually select the text.");
        }
    };

    return (
        <div className="h-full flex flex-col gap-3 relative">
            {/* COMPACT HEADER */}
            <div className="flex justify-between items-center px-1 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
                        <NotesIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">Chronicle</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Operational History & Logic Vault</p>
                    </div>
                </div>
                <button onClick={handleCreateNote} className="px-5 py-2 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 text-[10px] uppercase tracking-widest">
                    <AddIcon className="w-3.5 h-3.5" /> Start New Entry
                </button>
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-3xl border border-slate-200 shadow-sm flex overflow-hidden">
                {/* UNIFIED SIDEBAR (FILTER + LIST) */}
                <div className="w-72 border-r border-slate-100 flex flex-col min-h-0 flex-shrink-0 bg-slate-50/30">
                    <div className="p-3 border-b bg-white space-y-3">
                        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                            {[
                                { id: null, icon: <FileTextIcon className="w-3 h-3" />, label: 'All' },
                                { id: 'note', icon: <NotesIcon className="w-3 h-3 text-blue-500" />, label: 'Log' },
                                { id: 'bug', icon: <BugIcon className="w-3 h-3 text-red-500" />, label: 'Bug' },
                                { id: 'idea', icon: <LightBulbIcon className="w-3 h-3 text-amber-500" />, label: 'Idea' },
                                { id: 'task', icon: <ChecklistIcon className="w-3 h-3 text-green-500" />, label: 'Act' }
                            ].map(type => (
                                <button 
                                    key={type.label} 
                                    onClick={() => setSelectedTypeFilter(type.id)} 
                                    title={type.label}
                                    className={`flex-1 flex flex-col items-center gap-1.5 p-1.5 rounded-lg transition-all ${selectedTypeFilter === type.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {type.icon}
                                    <span className="text-[8px] font-black uppercase">{type.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="Filter memory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-500 outline-none font-bold" />
                            <SearchCircleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                        {filteredNotes.length === 0 ? (
                            <div className="p-8 text-center text-slate-300 italic flex flex-col items-center">
                                <FileTextIcon className="w-6 h-6 mb-2 opacity-5" />
                                <p className="text-[9px] font-black uppercase">Archive empty</p>
                            </div>
                        ) : filteredNotes.map(n => (
                            <div key={n.id} onClick={() => setSelectedNoteId(n.id)} className={`p-3 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-1 ${selectedNoteId === n.id ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 shadow-sm'}`}>
                                <div className="flex justify-between items-start">
                                    <h4 className={`text-[11px] font-black truncate pr-2 ${n.isCompleted ? 'text-slate-300 line-through' : 'text-slate-800'}`}>{n.title || 'Untitled Entry'}</h4>
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${n.type === 'bug' ? 'bg-red-500' : n.type === 'idea' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                </div>
                                <div className="flex justify-between items-center mt-0.5">
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{new Date(n.updatedAt).toLocaleDateString()}</p>
                                    {n.isCompleted && <span className="text-[7px] font-black uppercase text-green-600 bg-green-50 px-1 rounded">Solved</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CONSOLE (EDITOR) */}
                <div className="flex-1 flex flex-col min-h-0 bg-white relative">
                    {selectedNoteId && activeNote ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-4 border-b flex justify-between items-center z-10 shadow-sm bg-white">
                                <div className="flex-1 min-w-0 mr-4">
                                    <input 
                                        type="text" 
                                        value={localTitle} 
                                        onChange={e => setLocalTitle(e.target.value)} 
                                        className="text-xl font-black text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-slate-300" 
                                        placeholder="Entry Title" 
                                    />
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <select value={localType} onChange={e => setLocalType(e.target.value as any)} className="text-[8px] font-black uppercase bg-slate-100 border-none rounded-md py-0.5 px-1.5 focus:ring-0 cursor-pointer text-slate-600">
                                            <option value="note">Journal</option>
                                            <option value="bug">Issue/Bug</option>
                                            <option value="idea">Proposal</option>
                                            <option value="task">Action</option>
                                        </select>
                                        <div className="h-2 w-px bg-slate-200" />
                                        <button 
                                            onClick={() => setLocalIsCompleted(!localIsCompleted)} 
                                            className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm transition-all flex items-center gap-1.5 ${localIsCompleted ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                                        >
                                            {localIsCompleted ? <CheckCircleIcon className="w-2.5 h-2.5" /> : null}
                                            {localIsCompleted ? 'Resolved' : 'Mark Resolved'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => { if(confirm("Discard this record?")) { onUpdateNotes(notes.filter(n => n.id !== selectedNoteId)); setSelectedNoteId(null); } }} className="p-2 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all" title="Delete Entry"><TrashIcon className="w-4 h-4"/></button>
                                    <button onClick={() => setSelectedNoteId(null)} className="p-2 text-slate-300 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"><CloseIcon className="w-6 h-6" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden p-3 bg-slate-50/10">
                                <BlockEditor key={selectedNoteId} initialContent={activeNote.content} onChange={(newContent) => setLocalContent(newContent)} onCopyFiltered={handleCopyForAI} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-6 animate-bounce-subtle">
                                <DatabaseIcon className="w-8 h-8 text-indigo-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Institutional Memory</h3>
                            <p className="text-slate-400 text-[10px] mt-2 max-w-xs font-bold uppercase tracking-widest leading-relaxed">Choose an entry to begin logic documentation or start a new proposition for the system ledger.</p>
                            <button onClick={handleCreateNote} className="mt-6 px-8 py-2.5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">Launch New Record</button>
                        </div>
                    )}
                </div>
            </div>

            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
        </div>
    );
};

export default JournalPage;