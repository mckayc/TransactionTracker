
import React, { useState, useMemo } from 'react';
import type { Template, Task, ScheduledEvent, TaskItem, TaskPriority, Category } from '../types';
// Added CheckBadgeIcon to imports
import { AddIcon, DeleteIcon, EditIcon, CheckCircleIcon, CalendarIcon, RepeatIcon, ChecklistIcon, BoxIcon, SearchCircleIcon, TagIcon, ChevronRightIcon, ChevronDownIcon, TrashIcon, CloseIcon, PlayIcon, InfoIcon, ShieldCheckIcon, ListIcon, CheckBadgeIcon } from '../components/Icons';
import TaskModal from './TaskModal';
import { formatDate } from '../dateUtils';

interface TasksPageProps {
    tasks: TaskItem[];
    onSaveTask: (task: TaskItem) => void;
    onDeleteTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
    templates: Template[];
    scheduledEvents: ScheduledEvent[];
    onSaveTemplate: (template: Template) => void;
    onRemoveTemplate: (templateId: string) => void;
    categories: Category[];
}

const TasksPage: React.FC<TasksPageProps> = ({ tasks, onSaveTask, onDeleteTask, onToggleTask, templates, scheduledEvents, onSaveTemplate, onRemoveTemplate, categories }) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all' | 'none'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('active');

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategoryId === 'all' || (selectedCategoryId === 'none' ? !t.categoryId : t.categoryId === selectedCategoryId);
            const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? !t.isCompleted : t.isCompleted);
            return matchesSearch && matchesCategory && matchesStatus;
        }).sort((a, b) => {
            if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            if (a.priority !== b.priority) {
                const p = { high: 3, medium: 2, low: 1 };
                return p[b.priority] - p[a.priority];
            }
            return new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime();
        });
    }, [tasks, searchTerm, selectedCategoryId, filterStatus]);

    const activeTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Operations Center</h1>
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-widest mt-1 opacity-70">Definition & Metadata Registry</p>
                </div>
                <button onClick={() => { setIsCreating(true); }} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                    <AddIcon className="w-5 h-5" /> New Task Definition
                </button>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* COLUMN 1: TAXONOMY & WORKSPACES */}
                <div className="w-64 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 flex-shrink-0 min-h-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Operational State</p>
                    <div className="space-y-1 mb-8">
                        {['active', 'completed', 'all'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s as any)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between mb-4 px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Folders</p>
                        <span className="text-[10px] font-bold text-slate-300">BY CATEGORY</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                        <button onClick={() => setSelectedCategoryId('all')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Global Scope</button>
                        {categories.filter(c => !c.parentId).map(c => (
                            <button key={c.id} onClick={() => setSelectedCategoryId(c.id)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all group flex items-center justify-between ${selectedCategoryId === c.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                                <span className="truncate">{c.name}</span>
                                <span className="text-[9px] font-black opacity-0 group-hover:opacity-40 transition-opacity">{tasks.filter(t => t.categoryId === c.id).length}</span>
                            </button>
                        ))}
                        <button onClick={() => setSelectedCategoryId('none')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === 'none' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Unallocated</button>
                    </div>
                </div>

                {/* COLUMN 2: TASK LIST */}
                <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b bg-slate-50 rounded-t-2xl">
                        <div className="relative">
                            <input type="text" placeholder="Search operations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold shadow-inner" />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-white/50">
                        {filteredTasks.length === 0 ? (
                            <div className="p-16 text-center text-slate-300 flex flex-col items-center">
                                <BoxIcon className="w-12 h-12 mb-4 opacity-5" />
                                <p className="text-[11px] font-black uppercase tracking-tighter">No definitions found</p>
                            </div>
                        ) : (
                            filteredTasks.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => { setSelectedTaskId(t.id); setIsCreating(false); }} 
                                    className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-2 relative group overflow-hidden ${selectedTaskId === t.id ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <div className="min-w-0 flex-1">
                                            <h4 className={`text-sm font-black tracking-tight truncate pr-2 ${t.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</h4>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                {t.dueDate && <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {formatDate(t.dueDate)}</span>}
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${t.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-500'}`}>{t.priority}</span>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 pt-1">
                                            {t.isCompleted ? <CheckBadgeIcon className="w-5 h-5 text-emerald-500" /> : <ChevronRightIcon className="w-4 h-4 text-slate-300" />}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* COLUMN 3: EDITOR */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 relative">
                    {isCreating ? (
                         <div className="h-full bg-white relative overflow-hidden animate-fade-in">
                            <TaskModal 
                                isOpen={isCreating} 
                                onClose={() => setIsCreating(false)} 
                                onSave={(t) => { onSaveTask(t); setIsCreating(false); setSelectedTaskId(t.id); }} 
                                task={activeTask || null} 
                                initialMode="edit"
                            />
                         </div>
                    ) : selectedTaskId && activeTask ? (
                        <div className="flex flex-col h-full animate-fade-in bg-white">
                            <div className="p-6 border-b bg-slate-50 flex justify-between items-center z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600 border border-slate-100">
                                        <ShieldCheckIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className={`text-2xl font-black text-slate-800 tracking-tight`}>{activeTask.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Operational Definition</p>
                                            <div className="h-3 w-px bg-slate-200" />
                                            {activeTask.dueDate && <span className="text-[10px] font-bold text-indigo-600 uppercase">Target: {formatDate(activeTask.dueDate)}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsCreating(true)} className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest active:scale-95">
                                        <EditIcon className="w-4 h-4"/> Edit Logic
                                    </button>
                                    <button onClick={() => { if(confirm("Permanently discard this operational definition?")) { onDeleteTask(activeTask.id); setSelectedTaskId(null); } }} className="p-3 text-slate-400 hover:text-red-600 rounded-2xl border-2 border-slate-50 hover:bg-red-50 transition-all"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                                {activeTask.description && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block ml-1">Mission Parameters</label>
                                        <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border-2 border-slate-100 italic shadow-inner">
                                            <p className="text-lg text-slate-600 leading-relaxed font-medium">"{activeTask.description}"</p>
                                        </div>
                                    </div>
                                )}
                                
                                {activeTask.subtasks && activeTask.subtasks.length > 0 && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Defined Roadmap</label>
                                            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 uppercase border border-indigo-100">
                                                {activeTask.subtasks.length} Checkpoints
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {activeTask.subtasks.map(s => (
                                                <div key={s.id} className="flex items-center gap-4 p-5 bg-white border-2 border-slate-50 rounded-3xl group shadow-sm">
                                                    <div className={`w-3 h-3 rounded-full ${s.isCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-200'}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`text-sm font-black block ${s.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{s.text}</span>
                                                        {s.notes && <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 italic">{s.notes}</p>}
                                                    </div>
                                                    {s.isCompleted && <CheckBadgeIcon className="w-5 h-5 text-emerald-500" />}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-6 bg-amber-50 rounded-[2rem] border-2 border-amber-100 flex items-start gap-4">
                                            <InfoIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-800 font-medium leading-relaxed">Checklist items are defined here as part of the operational standard. To mark them as complete, interact with the task in the <strong>Calendar</strong> view.</p>
                                        </div>
                                    </div>
                                )}
                                
                                {activeTask.notes && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block ml-1">Institutional Memory</label>
                                        <div className="text-xs text-slate-400 leading-relaxed font-mono p-8 bg-slate-900 text-indigo-100 rounded-[2.5rem] shadow-2xl border border-slate-800 whitespace-pre-wrap">{activeTask.notes}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <ListIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Strategic Command</h3>
                            <p className="text-slate-400 text-sm mt-4 font-medium max-w-sm leading-relaxed">Select an operational task from your stack to manage its logical definition, set mission parameters, or audit institutional memory.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TasksPage;
