
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { BusinessNote, BusinessProfile } from '../types';
import { CheckCircleIcon, SparklesIcon, SendIcon, AddIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, CloseIcon, ListIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ChecklistIcon, LightBulbIcon, ChevronRightIcon, ChevronDownIcon, ShieldCheckIcon, BoxIcon, InfoIcon, RobotIcon, CopyIcon, FileTextIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { askAiAdvisor } from '../services/geminiService';

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
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[250] animate-slide-up">
            <div className="bg-slate-900/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3">
                <div className="bg-indigo-500 rounded-full p-1">
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold tracking-tight">{message}</span>
            </div>
        </div>
    );
};

const copyToClipboard = (text: string, onDone: (msg: string) => void) => {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => onDone("Copied to clipboard")).catch(() => fallbackCopy(text, onDone));
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
    } catch (err) {}
    document.body.removeChild(textArea);
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
    onCopyRequest: (onDone: (m: string) => void) => void;
}> = ({ initialContent, onChange, onCopyRequest }) => {
    const [blocks, setBlocks] = useState<ContentBlock[]>(() => parseMarkdownToBlocks(initialContent));
    const [focusedId, setFocusedId] = useState<string | null>(null);

    useEffect(() => {
        const markdown = serializeBlocksToMarkdown(blocks);
        if (markdown !== initialContent) {
            onChange(markdown);
        }
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

    const sortCheckedToBottom = () => {
        const incomplete = blocks.filter(b => b.type !== 'todo' || !b.checked);
        const complete = blocks.filter(b => b.type === 'todo' && b.checked);
        setBlocks([...incomplete, ...complete]);
    };

    const handleAIPaste = () => {
        onCopyRequest((m) => {
            const text = blocks
                .filter(b => !b.checked)
                .map(b => b.text)
                .join('\n');
            copyToClipboard(text, (msg) => alert(msg));
        });
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-inner">
            <div className="flex items-center justify-between p-2 bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <div className="flex items-center gap-1.5">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                        <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'todo' })} className="p-1.5 hover:bg-indigo-50 rounded-md text-slate-500 hover:text-indigo-600 transition-all" title="Todo List"><ChecklistIcon className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'bullet' })} className="p-1.5 hover:bg-indigo-50 rounded-md text-slate-500 hover:text-indigo-600 transition-all" title="Bulleted List"><ListIcon className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'h1' })} className="p-1.5 hover:bg-indigo-50 rounded-md text-slate-500 hover:text-indigo-600 transition-all font-black text-[10px] px-2" title="Header">H1</button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={sortCheckedToBottom} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        <ArrowDownIcon className="w-3 h-3" /> Sink Completed
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar">
                {blocks.map((b) => (
                    <div 
                        key={b.id} 
                        className={`group flex items-start gap-2 py-0.5 relative rounded-lg transition-colors ${focusedId === b.id ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}
                        style={{ paddingLeft: `${b.indent * 16}px` }}
                    >
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute -left-6 top-1">
                             <button onClick={() => moveBlock(b.id, 'up')} className="p-0.5 text-slate-300 hover:text-indigo-500"><ArrowUpIcon className="w-3 h-3"/></button>
                             <button onClick={() => moveBlock(b.id, 'down')} className="p-0.5 text-slate-300 hover:text-indigo-500"><ArrowDownIcon className="w-3 h-3"/></button>
                        </div>

                        <div className="flex-shrink-0 mt-1.5 w-4 flex justify-center">
                            {b.type === 'todo' ? (
                                <button 
                                    type="button"
                                    onClick={() => updateBlock(b.id, { checked: !b.checked })}
                                    className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${b.checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 hover:border-indigo-400'}`}
                                >
                                    {b.checked && <CheckCircleIcon className="w-2.5 h-2.5" />}
                                </button>
                            ) : b.type === 'bullet' ? (
                                <div className="w-1 h-1 rounded-full bg-slate-300 mt-2" />
                            ) : b.type === 'h1' ? (
                                <span className="text-[8px] font-black text-indigo-300 mt-1.5 uppercase">H</span>
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
                            placeholder="Type '/' for commands..."
                            rows={1}
                            className={`flex-1 bg-transparent border-none focus:ring-0 p-0 leading-relaxed resize-none overflow-hidden min-h-[1.4em] transition-all duration-200 ${b.type === 'h1' ? 'text-base font-black text-slate-800' : 'text-sm font-medium'} ${b.checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                            }}
                        />
                        <button type="button" onClick={() => deleteBlock(b.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-200 hover:text-rose-500 rounded-md transition-all"><TrashIcon className="w-3.5 h-3.5"/></button>
                    </div>
                ))}
                {blocks.length === 0 && (
                    <button onClick={() => addBlock('', 'paragraph')} className="w-full py-12 text-center text-slate-300 hover:text-indigo-400 border-2 border-dashed border-slate-100 rounded-xl transition-all">
                         + Click to add content
                    </button>
                )}
            </div>
        </div>
    );
};

const JournalPage: React.FC<JournalPageProps> = ({ notes, onUpdateNotes, profile }) => {
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

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

    const handleCopyForAI = (onDone: (m: string) => void) => {
        if (!activeNote) return;
        const blocks = parseMarkdownToBlocks(activeNote.content);
        const text = blocks
            .filter(b => !b.checked)
            .map(b => b.text)
            .join('\n');
        copyToClipboard(text, (msg) => {
            setToastMessage("Content Filtered (Excluded Checked Items)");
        });
    };

    return (
        <div className="h-full flex flex-col gap-3 relative">
            <div className="flex justify-between items-center px-1 flex-shrink-0">
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Institutional Chronicle</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Logic Registry & History</p>
                </div>
                <button onClick={handleCreateNote} className="px-5 py-2 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 text-[10px] uppercase tracking-widest">
                    <AddIcon className="w-3.5 h-3.5" /> New Log
                </button>
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex overflow-hidden">
                {/* Taxonomy Filter Bar */}
                <div className="w-40 border-r border-slate-100 bg-slate-50/30 flex flex-col p-3 flex-shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Taxonomy</p>
                    <div className="space-y-1">
                        {[
                            { id: null, label: 'Global', icon: <FileTextIcon className="w-3.5 h-3.5" /> },
                            { id: 'note', label: 'Logs', icon: <NotesIcon className="w-3.5 h-3.5 text-blue-500" /> },
                            { id: 'bug', label: 'Bugs', icon: <BugIcon className="w-3.5 h-3.5 text-red-500" /> },
                            { id: 'idea', label: 'Ideas', icon: <LightBulbIcon className="w-3.5 h-3.5 text-amber-500" /> },
                            { id: 'task', label: 'Actions', icon: <ChecklistIcon className="w-3.5 h-3.5 text-green-500" /> }
                        ].map(type => (
                            <button key={type.label} onClick={() => setSelectedTypeFilter(type.id)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedTypeFilter === type.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {type.icon}
                                <span className="truncate">{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Entry Stream (Middle Column) */}
                <div className="w-64 border-r border-slate-100 flex flex-col min-h-0 flex-shrink-0">
                    <div className="p-3 border-b bg-slate-50/50">
                        <div className="relative">
                            <input type="text" placeholder="Filter logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-500 outline-none font-bold" />
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
                            <div key={n.id} onClick={() => setSelectedNoteId(n.id)} className={`p-3 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-1 ${selectedNoteId === n.id ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                <div className="flex justify-between items-start">
                                    <h4 className={`text-[11px] font-black truncate pr-2 ${n.isCompleted ? 'text-slate-300 line-through' : 'text-slate-800'}`}>{n.title || 'Untitled Entry'}</h4>
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${n.type === 'bug' ? 'bg-red-500' : n.type === 'idea' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                </div>
                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{new Date(n.updatedAt).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Console (Editor) */}
                <div className="flex-1 flex flex-col min-h-0 bg-white relative">
                    {selectedNoteId && activeNote ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-4 border-b flex justify-between items-center z-10 shadow-sm bg-white">
                                <div className="flex-1 min-w-0 mr-4">
                                    <input type="text" value={activeNote.title} onChange={e => handleUpdateActiveNote({ title: e.target.value })} className="text-xl font-black text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-slate-300" placeholder="Log Title" />
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <select value={activeNote.type} onChange={e => handleUpdateActiveNote({ type: e.target.value as any })} className="text-[8px] font-black uppercase bg-slate-100 border-none rounded-md py-0.5 px-1.5 focus:ring-0 cursor-pointer">
                                            <option value="note">Log</option>
                                            <option value="bug">Bug</option>
                                            <option value="idea">Idea</option>
                                            <option value="task">Action</option>
                                        </select>
                                        <div className="h-2 w-px bg-slate-200" />
                                        <button onClick={() => handleUpdateActiveNote({ isCompleted: !activeNote.isCompleted })} className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm transition-all ${activeNote.isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-700 text-white hover:bg-slate-800'}`}>
                                            {activeNote.isCompleted ? 'Resolved' : 'Resolve'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={() => handleCopyForAI((m) => alert(m))} 
                                        className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all flex items-center gap-1.5"
                                        title="Copy Context for AI (Excludes Completed Tasks)"
                                    >
                                        <RobotIcon className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase hidden sm:inline">AI Context</span>
                                    </button>
                                    <div className="h-4 w-px bg-slate-200 mx-1" />
                                    <button onClick={() => { if(confirm("Discard this record?")) { onUpdateNotes(notes.filter(n => n.id !== selectedNoteId)); setSelectedNoteId(null); } }} className="p-2 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all"><TrashIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden p-4 bg-slate-50/10">
                                <BlockEditor key={selectedNoteId} initialContent={activeNote.content} onChange={(newContent) => handleUpdateActiveNote({ content: newContent })} onCopyRequest={handleCopyForAI} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-6 animate-bounce-subtle">
                                <NotesIcon className="w-8 h-8 text-indigo-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Vault Selection Required</h3>
                            <p className="text-slate-400 text-[11px] mt-2 max-w-xs font-medium uppercase tracking-widest leading-relaxed">Choose an entry to begin logic documentation or start a new proposition.</p>
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
