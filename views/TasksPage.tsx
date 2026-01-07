import React, { useState, useMemo } from 'react';
import type { Template, Task, ScheduledEvent, TaskItem, TaskPriority, Category } from '../types';
import { AddIcon, DeleteIcon, EditIcon, CheckCircleIcon, CalendarIcon, RepeatIcon, ChecklistIcon, BoxIcon, SearchCircleIcon, TagIcon, ChevronRightIcon, ChevronDownIcon, TrashIcon, CloseIcon } from '../components/Icons';
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
                    <p className="text-sm text-slate-500">Manage institutional tasks and compliance checklists.</p>
                </div>
                <button onClick={() => { setIsCreating(true); setSelectedTaskId(null); }} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                    <AddIcon className="w-5 h-5" /> New Task
                </button>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: WORKSPACES & FILTERS */}
                <div className="w-64 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 flex-shrink-0 min-h-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">State Registry</p>
                    <div className="space-y-1 mb-8">
                        {['active', 'completed', 'all'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s as any)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between mb-4 px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspaces</p>
                        <span className="text-[10px] font-bold text-slate-300">BY CATEGORY</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                        <button onClick={() => setSelectedCategoryId('all')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Global Context</button>
                        {categories.filter(c => !c.parentId).map(c => (
                            <button key={c.id} onClick={() => setSelectedCategoryId(c.id)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all group flex items-center justify-between ${selectedCategoryId === c.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <span className="truncate">{c.name}</span>
                                <span className="text-[9px] font-black opacity-0 group-hover:opacity-40 transition-opacity">{tasks.filter(t => t.categoryId === c.id).length}</span>
                            </button>
                        ))}
                        <button onClick={() => setSelectedCategoryId('none')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === 'none' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Unallocated</button>
                    </div>
                </div>

                {/* MIDDLE: STACK LIST */}
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
                                <p className="text-[11px] font-black uppercase tracking-tighter">Queue empty</p>
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
                                                {t.subtasks && t.subtasks.length > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <ChecklistIcon className="w-3 h-3" /> 
                                                        <span className={t.subtasks.every(s => s.isCompleted) ? 'text-emerald-500' : ''}>
                                                            {t.subtasks.filter(s => s.isCompleted).length}/{t.subtasks.length}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm ${t.priority === 'high' ? 'bg-red-500 text-white' : t.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>{t.priority}</span>
                                    </div>
                                    
                                    {/* Completion Meter */}
                                    {t.subtasks && t.subtasks.length > 0 && (
                                        <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/10 w-full">
                                            <div 
                                                className="h-full bg-indigo-500 transition-all duration-700" 
                                                style={{ width: `${(t.subtasks.filter(s => s.isCompleted).length / t.subtasks.length) * 100}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: CONSOLE */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 relative">
                    {selectedTaskId && activeTask ? (
                        <div className="flex flex-col h-full animate-fade-in bg-white">
                            <div className="p-6 border-b bg-slate-50 flex justify-between items-center z-10">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => onToggleTask(activeTask.id)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${activeTask.isCompleted ? 'bg-green-500 border-green-500 text-white shadow-green-100 rotate-12 scale-110' : 'bg-white border-slate-300 hover:border-indigo-500 text-transparent'}`}>
                                        <CheckCircleIcon className="w-6 h-6" />
                                    </button>
                                    <div>
                                        <h3 className={`text-2xl font-black text-slate-800 tracking-tight ${activeTask.isCompleted ? 'line-through text-slate-300' : ''}`}>{activeTask.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${activeTask.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{activeTask.priority} PRIORITY</span>
                                            <div className="h-3 w-px bg-slate-200" />
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activeTask.isCompleted ? 'Historical Action' : 'Pending Deployment'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsCreating(true)} className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-200 hover:bg-white transition-all shadow-sm"><EditIcon className="w-5 h-5"/></button>
                                    <button onClick={() => { if(confirm("Discard this operation?")) { onDeleteTask(activeTask.id); setSelectedTaskId(null); } }} className="p-2.5 text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 hover:bg-white transition-all shadow-sm"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                {activeTask.description && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block ml-1">Core Mission</label>
                                        <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 italic">"{activeTask.description}"</p>
                                    </div>
                                )}
                                
                                {activeTask.subtasks && activeTask.subtasks.length > 0 && (
                                    <div className="space-y-5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Execution Roadmap</label>
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase transition-colors ${activeTask.subtasks.every(s => s.isCompleted) ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-500'}`}>
                                                {Math.round((activeTask.subtasks.filter(s => s.isCompleted).length / activeTask.subtasks.length) * 100)}% SUCCESS RATE
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {activeTask.subtasks.map(s => (
                                                <div key={s.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group ${s.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 shadow-sm hover:border-indigo-100'}`}>
                                                    <button 
                                                        onClick={() => {
                                                            const updated = {
                                                                ...activeTask,
                                                                subtasks: activeTask.subtasks?.map(st => st.id === s.id ? { ...st, isCompleted: !st.isCompleted } : st)
                                                            };
                                                            onSaveTask(updated);
                                                        }}
                                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${s.isCompleted ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 group-hover:border-indigo-300'}`}
                                                    >
                                                        {s.isCompleted && <CheckCircleIcon className="w-4 h-4" />}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`text-sm font-bold block ${s.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{s.text}</span>
                                                        {s.notes && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{s.notes}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {activeTask.notes && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Forensic Analysis</label>
                                        <div className="text-xs text-slate-500 leading-relaxed font-mono p-6 bg-slate-900 text-indigo-100 rounded-3xl shadow-inner border border-slate-800 whitespace-pre-wrap">{activeTask.notes}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : isCreating ? (
                         <div className="p-8 h-full bg-white relative">
                             <div className="absolute top-4 right-4 z-20">
                                 <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-100 rounded-full"><CloseIcon className="w-6 h-6 text-slate-300" /></button>
                             </div>
                            <TaskModal isOpen={isCreating} onClose={() => setIsCreating(false)} onSave={(t) => { onSaveTask(t); setIsCreating(false); setSelectedTaskId(t.id); }} task={activeTask || null} />
                         </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <ChecklistIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Strategic Command</h3>
                            <p className="text-slate-400 text-sm mt-4 font-medium max-w-sm leading-relaxed">Select an operational task from your stack to manage dependencies, execute compliance checklists, or audit completion metadata.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TasksPage;