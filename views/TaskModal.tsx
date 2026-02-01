
import React, { useState, useEffect, useRef } from 'react';
import type { TaskItem, SubTask, RecurrenceRule, TaskPriority } from '../types';
// Added missing icons to imports
import { CloseIcon, ChecklistIcon, CalendarIcon, RepeatIcon, DeleteIcon, AddIcon, LinkIcon, EditIcon, CheckBadgeIcon, CheckCircleIcon, TrashIcon, SparklesIcon, PlayIcon, ListIcon, InfoIcon, SaveIcon } from '../components/Icons';
import { formatDate, getTodayDate } from '../dateUtils';
import { generateUUID } from '../utils';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: TaskItem) => void;
    task: TaskItem | null;
    initialMode?: 'view' | 'edit';
}

const LinkRenderer: React.FC<{ text: string, url?: string, linkText?: string }> = ({ text, url, linkText }) => {
    if (url) {
        return (
            <div className="flex flex-col">
                <span>{text}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1 text-xs mt-0.5">
                    <LinkIcon className="w-3 h-3" />
                    {linkText || url}
                </a>
            </div>
        );
    }
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <span>
            {parts.map((part, i) =>
                urlRegex.test(part) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">{part}</a>
                ) : ( part )
            )}
        </span>
    );
};

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, task, initialMode = 'edit' }) => {
    const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
    
    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [dueDate, setDueDate] = useState('');
    const [subtasks, setSubtasks] = useState<SubTask[]>([]);
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrence, setRecurrence] = useState<RecurrenceRule>({ frequency: 'weekly', interval: 1 });
    const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'schedule'>('details');
    const [isCompleted, setIsCompleted] = useState(false);
    
    // Subtask Editing State
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editSubtaskData, setEditSubtaskData] = useState<SubTask | null>(null);

    // New Subtask input state
    const [newSubtaskText, setNewSubtaskText] = useState('');
    const [newSubtaskLink, setNewSubtaskLink] = useState('');
    const [newSubtaskLinkText, setNewSubtaskLinkText] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);

    const dueDateRef = useRef<HTMLInputElement>(null);
    const endDateRef = useRef<HTMLInputElement>(null);

    const showPickerSafely = (ref: React.RefObject<HTMLInputElement>) => {
        const el = ref.current;
        if (!el) return;
        try {
            if (typeof (el as any).showPicker === 'function') {
                (el as any).showPicker();
            } else {
                el.focus();
                el.click();
            }
        } catch (error) {
            el.focus();
            try { el.click(); } catch (e) {}
        }
    };

    useEffect(() => {
        if (isOpen) {
            setMode(task ? initialMode : 'edit');

            if (task) {
                setTitle(task.title);
                setDescription(task.description || '');
                setNotes(task.notes || '');
                setPriority(task.priority);
                setDueDate(task.dueDate || '');
                setSubtasks(task.subtasks || []);
                setIsRecurring(!!task.recurrence);
                setRecurrence(task.recurrence || { frequency: 'weekly', interval: 1 });
                setIsCompleted(task.isCompleted);
                setActiveTab('details');
            } else {
                setTitle('');
                setDescription('');
                setNotes('');
                setPriority('medium');
                setDueDate(getTodayDate());
                setSubtasks([]);
                setIsRecurring(false);
                setRecurrence({ frequency: 'weekly', interval: 1 });
                setIsCompleted(false);
                setActiveTab('details');
            }
            setShowLinkInput(false);
            setNewSubtaskLink('');
            setNewSubtaskLinkText('');
            setNewSubtaskText('');
            setEditingSubtaskId(null);
            setEditSubtaskData(null);
        }
    }, [isOpen, task, initialMode]);

    if (!isOpen) return null;

    const handleSave = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!title.trim()) {
            alert('Task title is required');
            return;
        }

        let finalSubtasks = [...subtasks];

        if (editingSubtaskId && editSubtaskData) {
            finalSubtasks = finalSubtasks.map(s => s.id === editingSubtaskId ? editSubtaskData : s);
        }

        if (newSubtaskText.trim()) {
            finalSubtasks.push({
                id: generateUUID(),
                text: newSubtaskText.trim(),
                isCompleted: false,
                linkUrl: newSubtaskLink.trim() || undefined,
                linkText: newSubtaskLinkText.trim() || undefined
            });
        }

        const newTask: TaskItem = {
            id: task?.id || generateUUID(),
            title: title.trim(),
            description: description.trim(),
            notes: notes.trim(),
            priority,
            dueDate: dueDate || undefined,
            isCompleted: isCompleted,
            createdAt: task?.createdAt || new Date().toISOString(),
            subtasks: finalSubtasks,
            recurrence: isRecurring ? recurrence : undefined
        };

        onSave(newTask);
        onClose();
    };

    const addSubtask = () => {
        if (newSubtaskText.trim()) {
            const newSub = { 
                id: generateUUID(), 
                text: newSubtaskText.trim(), 
                isCompleted: false,
                linkUrl: newSubtaskLink.trim() || undefined,
                linkText: newSubtaskLinkText.trim() || undefined
            };
            
            const updatedSubtasks = [...subtasks, newSub];
            setSubtasks(updatedSubtasks);
            setNewSubtaskText('');
            setNewSubtaskLink('');
            setNewSubtaskLinkText('');
            setShowLinkInput(false);

            if (mode === 'view') {
                const newTask: TaskItem = {
                    ...(task || {} as TaskItem),
                    subtasks: updatedSubtasks
                };
                onSave(newTask); 
            }
        }
    };

    const removeSubtask = (id: string) => {
        const updatedSubtasks = subtasks.filter(st => st.id !== id);
        setSubtasks(updatedSubtasks);
        if (mode === 'view') {
             const newTask: TaskItem = {
                ...(task || {} as TaskItem),
                subtasks: updatedSubtasks
            };
            onSave(newTask);
        }
    };

    const toggleSubtask = (id: string) => {
        const updatedSubtasks = subtasks.map(st => st.id === id ? { ...st, isCompleted: !st.isCompleted } : st);
        setSubtasks(updatedSubtasks);
        
        if (mode === 'view') {
            const newTask: TaskItem = {
                ...(task || {} as TaskItem),
                subtasks: updatedSubtasks
            };
            onSave(newTask);
        }
    };

    const startEditingSubtask = (st: SubTask) => {
        setEditingSubtaskId(st.id);
        setEditSubtaskData({ ...st });
    };

    const saveEditingSubtask = () => {
        if (editSubtaskData) {
            const updatedSubtasks = subtasks.map(s => s.id === editSubtaskData.id ? editSubtaskData : s);
            setSubtasks(updatedSubtasks);
            setEditingSubtaskId(null);
            setEditSubtaskData(null);
            
            if (mode === 'view') {
                onSave({
                    ...(task || {} as TaskItem),
                    subtasks: updatedSubtasks
                });
            }
        }
    };

    const cancelEditingSubtask = () => {
        setEditingSubtaskId(null);
        setEditSubtaskData(null);
    };

    const toggleWeekDay = (dayIndex: number) => {
        const currentDays = new Set(recurrence.byWeekDays || []);
        if (currentDays.has(dayIndex)) {
            currentDays.delete(dayIndex);
        } else {
            currentDays.add(dayIndex);
        }
        setRecurrence({ ...recurrence, byWeekDays: Array.from(currentDays) });
    };

    const toggleTaskCompletion = () => {
        const newStatus = !isCompleted;
        setIsCompleted(newStatus);
        if (mode === 'view') {
             const newTask: TaskItem = {
                ...(task! || {}),
                id: task?.id || generateUUID(),
                isCompleted: newStatus,
                title, 
                description, 
                notes, 
                priority, 
                dueDate: dueDate || undefined, 
                subtasks, 
                recurrence: isRecurring ? recurrence : undefined,
                createdAt: task?.createdAt || new Date().toISOString()
            };
            onSave(newTask);
        }
    };

    const priorityColors = {
        low: 'bg-blue-100 text-blue-700',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-red-100 text-red-700',
    };

    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center p-6 border-b bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm">
                            {mode === 'view' ? <PlayIcon className="w-6 h-6" /> : <EditIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 truncate pr-4 uppercase tracking-tight leading-tight">
                                {mode === 'view' ? 'Execution Console' : (task ? 'Modify Operation' : 'New Definition')}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Asset Registry Core</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {mode === 'view' && (
                            <button onClick={() => setMode('edit')} className="px-4 py-2 bg-slate-100 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                <EditIcon className="w-4 h-4" /> Parameters
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><CloseIcon className="w-6 h-6" /></button>
                    </div>
                </div>

                {mode === 'view' && (
                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/10">
                        <div className="flex items-start justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                            <div className="min-w-0 flex-1">
                                <h3 className={`text-2xl font-black text-slate-800 truncate leading-tight ${isCompleted ? 'line-through text-slate-300' : ''}`}>{title}</h3>
                                <div className="flex items-center gap-3 mt-3">
                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-inner ${priorityColors[priority]}`}>{priority}</span>
                                    {dueDate && (
                                        <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-tighter bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg">
                                            <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
                                            Target: {formatDate(dueDate)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={toggleTaskCompletion}
                                className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isCompleted ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
                            >
                                <CheckBadgeIcon className="w-5 h-5" />
                                {isCompleted ? 'Closed' : 'Sign Off'}
                            </button>
                        </div>

                        {description && (
                            <div className="p-6 bg-slate-900 rounded-[2.5rem] relative overflow-hidden group shadow-xl">
                                <p className="text-indigo-100 text-sm font-medium leading-relaxed italic relative z-10">"{description}"</p>
                                <SparklesIcon className="absolute -right-8 -top-8 w-32 h-32 opacity-10 text-indigo-400 pointer-events-none group-hover:scale-110 transition-transform" />
                            </div>
                        )}

                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ChecklistIcon className="w-4 h-4 text-indigo-600" />
                                    Operational Checklist
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                                        {subtasks.filter(s => s.isCompleted).length} / {subtasks.length} Done
                                    </span>
                                </div>
                            </div>
                            
                            <ul className="grid grid-cols-1 gap-3">
                                {subtasks.map(st => (
                                    <li key={st.id} className={`flex items-start gap-4 p-5 rounded-[2rem] border-2 transition-all group ${st.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-50 shadow-sm hover:border-indigo-100'}`}>
                                        <button 
                                            onClick={() => toggleSubtask(st.id)}
                                            className={`mt-1 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${st.isCompleted ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 group-hover:border-indigo-300'}`}
                                        >
                                            {st.isCompleted && <CheckCircleIcon className="w-4 h-4" />}
                                        </button>
                                        <div className="flex-grow min-w-0 pt-1">
                                            <span className={`text-sm font-black block leading-snug ${st.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                {st.text}
                                            </span>
                                            {st.linkUrl && (
                                                <div className="mt-2">
                                                    <LinkRenderer text="" url={st.linkUrl} linkText={st.linkText} />
                                                </div>
                                            )}
                                            {st.notes && (
                                                <p className="text-[10px] text-slate-400 mt-2 italic font-medium leading-relaxed">
                                                    {st.notes}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {subtasks.length === 0 && (
                                    <div className="py-16 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                                        <ListIcon className="w-12 h-12 text-slate-100 mb-2" />
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No sequential checkpoints defined</p>
                                    </div>
                                )}
                            </ul>
                        </div>
                    </div>
                )}

                {mode === 'edit' && (
                    <>
                        <div className="flex bg-slate-50 border-b px-6 pt-3">
                            {[
                                { id: 'details', label: 'Mission Parameters', icon: <PlayIcon className="w-3 h-3" /> },
                                { id: 'checklist', label: 'Roadmap', count: subtasks.length, icon: <ChecklistIcon className="w-3 h-3" /> },
                                { id: 'schedule', label: 'Refresh Logic', icon: <RepeatIcon className="w-3 h-3" /> }
                            ].map(tab => (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)} 
                                    className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-2xl transition-all flex items-center gap-2 border-x border-t -mb-px ${activeTab === tab.id ? 'bg-white text-indigo-700 border-slate-200 shadow-sm relative z-10' : 'text-slate-400 hover:text-slate-700 border-transparent hover:bg-slate-100/50'}`}
                                >
                                    {tab.icon} {tab.label} {tab.count !== undefined && `(${tab.count})`}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-10 bg-white custom-scrollbar">
                            {activeTab === 'details' && (
                                <div className="space-y-8 max-w-xl mx-auto">
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 font-bold text-xl shadow-inner focus:bg-slate-50 transition-all" placeholder="Task designation..." autoFocus required />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Objective Deadline</label>
                                            <div className="relative">
                                                <input ref={dueDateRef} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:bg-white" />
                                                <button type="button" onClick={() => showPickerSafely(dueDateRef)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 p-1"><CalendarIcon className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Priority</label>
                                            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:bg-white cursor-pointer">
                                                <option value="low">Low Impact</option>
                                                <option value="medium">Standard Priority</option>
                                                <option value="high">Mission Critical</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operational Brief (Short)</label>
                                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 font-medium text-sm bg-slate-50 focus:bg-white shadow-inner" placeholder="Brief summary of mission targets..." ></textarea>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forensic Notes / History</label>
                                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 font-mono text-xs bg-slate-900 text-indigo-100 shadow-2xl" placeholder="Detailed researcher notes or historical logic..." ></textarea>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'checklist' && (
                                <div className="space-y-8 max-w-xl mx-auto">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <ChecklistIcon className="w-4 h-4 text-indigo-600" />
                                            Checkpoint Registry
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400">{subtasks.length} defined items</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {subtasks.map(st => (
                                            <div key={st.id} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 group transition-all hover:border-indigo-200">
                                                {editingSubtaskId === st.id && editSubtaskData ? (
                                                    <div className="space-y-4">
                                                        <input type="text" value={editSubtaskData.text} onChange={(e) => setEditSubtaskData({...editSubtaskData, text: e.target.value})} className="w-full p-3 border-none bg-white rounded-xl shadow-inner text-sm font-bold" autoFocus />
                                                        <div className="flex gap-2 justify-end">
                                                            <button type="button" onClick={cancelEditingSubtask} className="px-5 py-2 bg-white text-slate-500 rounded-lg text-[10px] font-black uppercase border border-slate-200">Discard</button>
                                                            <button type="button" onClick={saveEditingSubtask} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-indigo-100">Commit</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0" onClick={() => startEditingSubtask(st)}>
                                                            <span className="text-sm font-bold text-slate-700 block truncate cursor-pointer hover:text-indigo-600 transition-colors">{st.text}</span>
                                                            {st.linkUrl && <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 mt-1"><LinkIcon className="w-3 h-3"/> {st.linkText || 'Linked Resource'}</span>}
                                                        </div>
                                                        <button type="button" onClick={() => removeSubtask(st.id)} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon className="w-5 h-5"/></button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-8 bg-indigo-50/30 rounded-[2.5rem] border-2 border-dashed border-indigo-100 space-y-6">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">New Operation Token</label>
                                            <div className="flex gap-3">
                                                <input type="text" value={newSubtaskText} onChange={e => setNewSubtaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())} className="flex-1 p-4 border-none bg-white rounded-2xl shadow-sm font-bold text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Identity of checkpoint..." />
                                                <button type="button" onClick={addSubtask} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95"><AddIcon className="w-6 h-6" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'schedule' && (
                                <div className="space-y-10 max-w-xl mx-auto">
                                     <div className="flex items-center gap-6 p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                                        <div className={`p-5 rounded-2xl transition-all ${isRecurring ? 'bg-indigo-600 shadow-indigo-100 shadow-lg scale-110' : 'bg-white/10 opacity-30'}`}><RepeatIcon className="w-8 h-8" /></div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-xl">Logic Persistence</h3>
                                            <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">Automatically renew this operational definition upon sign-off.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer scale-150 mr-4">
                                            <input type="checkbox" className="sr-only peer" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} />
                                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                        <SparklesIcon className="absolute -right-6 -top-6 w-32 h-32 opacity-5 pointer-events-none group-hover:scale-110 transition-transform" />
                                    </div>

                                    {isRecurring && (
                                        <div className="space-y-8 p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 animate-slide-up shadow-inner">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cycle Frequency</label>
                                                    <select value={recurrence.frequency} onChange={e => setRecurrence({ ...recurrence, frequency: e.target.value as any })} className="w-full p-4 border-none bg-white rounded-2xl shadow-sm font-bold cursor-pointer">
                                                        <option value="daily">Every Day</option>
                                                        <option value="weekly">Every Week</option>
                                                        <option value="monthly">Every Month</option>
                                                        <option value="yearly">Every Year</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Iteration Gap</label>
                                                    <input type="number" min="1" value={recurrence.interval} onChange={e => setRecurrence({ ...recurrence, interval: parseInt(e.target.value) || 1 })} className="w-full p-4 border-none bg-white rounded-2xl shadow-sm font-black text-indigo-600" />
                                                </div>
                                            </div>

                                            {recurrence.frequency === 'weekly' && (
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designated Execution Days</label>
                                                    <div className="flex gap-2">
                                                        {weekDays.map((day, index) => {
                                                            const isSelected = recurrence.byWeekDays?.includes(index);
                                                            return (
                                                                <button key={index} type="button" onClick={() => toggleWeekDay(index)} className={`w-12 h-12 rounded-2xl text-xs font-black transition-all transform active:scale-90 ${isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 border-transparent' : 'bg-white text-slate-400 hover:bg-white hover:border-indigo-200 border-2 border-slate-100 shadow-sm'}`}>{day}</button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Persistence Expiration</label>
                                                <div className="relative">
                                                    <input ref={endDateRef} type="date" value={recurrence.endDate || ''} onChange={e => setRecurrence({ ...recurrence, endDate: e.target.value })} className="w-full p-4 border-none bg-white rounded-2xl shadow-sm font-bold" />
                                                    <button type="button" onClick={() => showPickerSafely(endDateRef)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 p-1 hover:text-indigo-600"><CalendarIcon className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                        
                        <div className="p-8 border-t bg-slate-50 flex justify-between items-center shrink-0">
                             <div className="flex items-center gap-2">
                                <InfoIcon className="w-4 h-4 text-slate-300" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic committed locally</p>
                             </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={onClose} className="px-8 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-white rounded-2xl transition-all">Cancel</button>
                                <button onClick={() => handleSave()} className="px-12 py-4 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 shadow-2xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2">
                                    <SaveIcon className="w-4 h-4" /> Save Operation
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TaskModal;
