import React, { useState, useEffect, useMemo } from 'react';
import type { BusinessNote, Transaction, Account, Category } from '../types';
import { CheckCircleIcon, SparklesIcon, SendIcon, AddIcon, DeleteIcon, EditIcon, BugIcon, NotesIcon, SearchCircleIcon, CloseIcon, ListIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ChecklistIcon, LightBulbIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface BusinessHubProps {
    profile: any;
    onUpdateProfile: (profile: any) => void;
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

// --- Markdown Serialization ---

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

    const sortCheckedToBottom = () => {
        // Find contiguous groups of checklist items and move completed ones to the bottom of the group
        const newBlocks: ContentBlock[] = [];
        let i = 0;
        while (i < blocks.length) {
            if (blocks[i].type === 'todo') {
                const group: ContentBlock[] = [];
                const baseIndent = blocks[i].indent;
                while (i < blocks.length && (blocks[i].type === 'todo' || blocks[i].indent > baseIndent)) {
                    group.push(blocks[i]);
                    i++;
                }
                const unchecked = group.filter(b => !b.checked);
                const checked = group.filter(b => b.checked);
                newBlocks.push(...unchecked, ...checked);
            } else {
                newBlocks.push(blocks[i]);
                i++;
            }
        }
        onChange(newBlocks);
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
        <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                <div className="flex bg-white rounded-xl border border-slate-200 p-0.5 shadow-sm mr-2">
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'todo' })} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-600 transition-all"><ChecklistIcon className="w-4 h-4" /></button>
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'bullet' })} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-600 transition-all"><ListIcon className="w-4 h-4" /></button>
                    <button type="button" onClick={() => focusedId && updateBlock(focusedId, { type: 'h1' })} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-600 transition-all font-black text-xs">H1</button>
                </div>
                <button type="button" onClick={sortCheckedToBottom} className="px-3 py-1.5 bg-white border rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm">Sink Completed</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-1 custom-scrollbar">
                {blocks.map((b) => (
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
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" />
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
                            placeholder="Type something..."
                            rows={1}
                            className={`flex-1 bg-transparent border-none focus:ring-0 p-0 leading-relaxed resize-none overflow-hidden min-h-[1.4em] ${b.type === 'h1' ? 'text-lg font-black text-slate-800' : 'text-sm font-medium'} ${b.checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}
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

const BusinessHub: React.FC<BusinessHubProps> = ({ notes, onUpdateNotes }) => {
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const filteredNotes = useMemo(() => {
        return notes
            .filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [notes, searchTerm]);

    const activeNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);
    const blocks = useMemo(() => activeNote ? parseMarkdownToBlocks(activeNote.content) : [], [activeNote?.content]);

    const handleCreate = () => {
        const id = generateUUID();
        const newNote: BusinessNote = {
            id,
            title: 'New Log Entry',
            content: '',
            type: 'note',
            priority: 'medium',
            isCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        onUpdateNotes([...notes, newNote]);
        setSelectedNoteId(id);
        setIsCreating(true);
    };

    const handleUpdateActive = (updates: Partial<BusinessNote>) => {
        if (!selectedNoteId) return;
        onUpdateNotes(notes.map(n => n.id === selectedNoteId ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Journal & Bugs</h1>
                    <p className="text-sm text-slate-500">Capture operational log entries and track system improvements.</p>
                </div>
                <button onClick={handleCreate} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                    <AddIcon className="w-5 h-5" /> New Entry
                </button>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b bg-slate-50 rounded-t-2xl">
                        <div className="relative">
                            <input type="text" placeholder="Search logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold" />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredNotes.length === 0 ? (
                            <div className="p-10 text-center text-slate-300">
                                <BugIcon className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                <p className="text-[10px] font-black uppercase">No entries found</p>
                            </div>
                        ) : (
                            filteredNotes.map(n => (
                                <div key={n.id} onClick={() => { setSelectedNoteId(n.id); setIsCreating(false); }} className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-2 ${selectedNoteId === n.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-start">
                                        <h4 className={`text-sm font-black truncate pr-2 ${n.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{n.title}</h4>
                                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'bug' ? 'bg-red-500' : n.type === 'idea' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(n.updatedAt).toLocaleDateString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: EDITOR */}
                <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
                    {selectedNoteId && activeNote ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-6 border-b bg-white flex justify-between items-center z-10 shadow-sm">
                                <div className="flex-1 min-w-0 mr-4">
                                    <input 
                                        type="text" 
                                        value={activeNote.title} 
                                        onChange={e => handleUpdateActive({ title: e.target.value })}
                                        className="text-2xl font-black text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full"
                                        placeholder="Entry Title"
                                    />
                                    <div className="flex items-center gap-4 mt-2">
                                        <select 
                                            value={activeNote.type} 
                                            onChange={e => handleUpdateActive({ type: e.target.value as any })}
                                            className="text-[10px] font-black uppercase bg-slate-100 border-none rounded-lg py-1 pl-2 pr-6 focus:ring-0 cursor-pointer"
                                        >
                                            <option value="note">Log Entry</option>
                                            <option value="bug">Software Bug</option>
                                            <option value="idea">Improvement Idea</option>
                                            <option value="task">Action Item</option>
                                        </select>
                                        <button 
                                            onClick={() => handleUpdateActive({ isCompleted: !activeNote.isCompleted })}
                                            className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg transition-all ${activeNote.isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                                        >
                                            {activeNote.isCompleted ? 'Resolved' : 'Active'}
                                        </button>
                                    </div>
                                </div>
                                <button onClick={() => onUpdateNotes(notes.filter(n => n.id !== selectedNoteId))} className="p-2 text-slate-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all"><TrashIcon className="w-5 h-5"/></button>
                            </div>

                            <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
                                <BlockEditor 
                                    blocks={blocks} 
                                    onChange={(newBlocks) => handleUpdateActive({ content: serializeBlocksToMarkdown(newBlocks) })} 
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <BugIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Operational Log</h3>
                            <p className="text-slate-500 max-w-sm mt-4 font-medium leading-relaxed">Capture development bugs, internal ideas, or general log entries here to keep the engine improving.</p>
                            <button onClick={handleCreate} className="mt-8 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">Create Log Entry</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BusinessHub;