import React, { useState, useMemo } from 'react';
import type { Template, Task, ScheduledEvent, TaskItem, TaskPriority, Category } from '../types';
import { AddIcon, DeleteIcon, EditIcon, CheckCircleIcon, CalendarIcon, RepeatIcon, ChecklistIcon, BoxIcon, SearchCircleIcon, TagIcon, ChevronRightIcon, ChevronDownIcon } from '../components/Icons';
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
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Financial Tasks</h1>
                    <p className="text-sm text-slate-500">Operation health and deadline compliance.</p>
                </div>
                <button onClick={() => { setIsCreating(true); setSelectedTaskId(null); }} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <AddIcon className="w-5 h-5" /> New Task
                </button>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: FILTERS */}
                <div className="w-64 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 flex-shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Status</p>
                    <div className="space-y-1 mb-8">
                        {['active', 'completed', 'all'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s as any)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all ${filterStatus === s ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Workspaces</p>
                    <div className="space-y-1 overflow-y-auto custom-scrollbar">
                        <button onClick={() => setSelectedCategoryId('all')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === 'all' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>All Workspaces</button>
                        {categories.filter(c => !c.parentId).map(c => (
                            <button key={c.id} onClick={() => setSelectedCategoryId(c.id)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === c.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {c.name}
                            </button>
                        ))}
                        <button onClick={() => setSelectedCategoryId('none')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategoryId === 'none' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Uncategorized</button>
                    </div>
                </div>

                {/* MIDDLE: LIST */}
                <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b">
                        <div className="relative">
                            <input type="text" placeholder="Search tasks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border rounded-xl text-xs focus:bg-white outline-none" />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredTasks.length === 0 ? (
                            <div className="p-10 text-center text-slate-300 flex flex-col items-center">
                                <BoxIcon className="w-10 h-10 mb-2 opacity-10" />
                                <p className="text-[11px] font-bold">No tasks found.</p>
                            </div>
                        ) : (
                            filteredTasks.map(t => (
                                <div key={t.id} onClick={() => { setSelectedTaskId(t.id); setIsCreating(false); }} className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-2 ${selectedTaskId === t.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-start">
                                        <h4 className={`text-sm font-bold truncate pr-2 ${t.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</h4>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{t.priority}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                        {t.dueDate && <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {formatDate(t.dueDate)}</span>}
                                        {t.subtasks && t.subtasks.length > 0 && <span className="flex items-center gap-1"><ChecklistIcon className="w-3 h-3" /> {t.subtasks.filter(s => s.isCompleted).length}/{t.subtasks.length}</span>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: DETAIL */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 relative">
                    {selectedTaskId && activeTask ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => onToggleTask(activeTask.id)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${activeTask.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-indigo-500 text-transparent'}`}>
                                        <CheckCircleIcon className="w-5 h-5" />
                                    </button>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800">{activeTask.title}</h3>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{activeTask.priority} priority • {activeTask.isCompleted ? 'Resolved' : 'Active'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsCreating(true)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg border hover:bg-white"><EditIcon className="w-5 h-5"/></button>
                                    <button onClick={() => { onDeleteTask(activeTask.id); setSelectedTaskId(null); }} className="p-2 text-slate-400 hover:text-red-600 rounded-lg border hover:bg-white"><DeleteIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                {activeTask.description && (
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Context</label>
                                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{activeTask.description}</p>
                                    </div>
                                )}
                                
                                {activeTask.subtasks && activeTask.subtasks.length > 0 && (
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Operational Checklist</label>
                                        <div className="space-y-2">
                                            {activeTask.subtasks.map(s => (
                                                <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${s.isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                                        {s.isCompleted && <CheckCircleIcon className="w-3 h-3" />}
                                                    </div>
                                                    <span className={`text-sm font-bold ${s.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{s.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : isCreating ? (
                         <div className="p-8 h-full">
                            <TaskModal isOpen={isCreating} onClose={() => setIsCreating(false)} onSave={(t) => { onSaveTask(t); setIsCreating(false); setSelectedTaskId(t.id); }} task={activeTask || null} />
                         </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-6">
                                <ChecklistIcon className="w-10 h-10 text-indigo-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Operational Center</h3>
                            <p className="text-slate-400 text-sm mt-3 font-medium max-w-xs">Select a task to review dependencies or track progress.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TasksPage;