
import React, { useState, useEffect, useRef } from 'react';
import type { TaskItem, SubTask, RecurrenceRule, TaskPriority } from '../types';
// Added missing icons to imports
import { CloseIcon, ChecklistIcon, CalendarIcon, RepeatIcon, DeleteIcon, AddIcon, LinkIcon, EditIcon, CheckBadgeIcon, CheckCircleIcon, TrashIcon, SparklesIcon } from '../components/Icons';
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-black text-slate-800 truncate pr-4 uppercase tracking-tight">
                        {mode === 'view' ? 'Execution Console' : (task ? 'Edit Parameters' : 'New Operational Definition')}
                    </h2>
                    <div className="flex items-center gap-2">
                        {mode === 'view' && (
                            <button onClick={() => setMode('edit')} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-xl flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all">
                                <EditIcon className="w-4 h-4" /> Parameters
                            </button>
                        )}
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><CloseIcon className="w-6 h-6" /></button>
                    </div>
                </div>

                {mode === 'view' && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <div className="flex items-start justify-between gap-4 bg-slate-50 p-5 rounded-[2rem] border border-slate-100 shadow-inner">
                            <div className="min-w-0">
                                <h3 className={`text-xl font-black text-slate-800 truncate ${isCompleted ? 'line-through text-slate-400' : ''}`}>{title}</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase shadow-sm ${priorityColors[priority]}`}>{priority}</span>
                                    {dueDate && (
                                        <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-tighter bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-sm">
                                            <CalendarIcon className="w-3 h-3 text-indigo-400" />
                                            {formatDate(dueDate)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={toggleTaskCompletion}
                                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isCompleted ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'}`}
                            >
                                <CheckBadgeIcon className="w-4 h-4" />
                                {isCompleted ? 'Closed' : 'Mark Done'}
                            </button>
                        </div>

                        {description && (
                            <div className="p-4 bg-white rounded-2xl border-2 border-slate-50 italic">
                                <p className="text-slate-600 text-sm font-medium leading-relaxed">"{description}"</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ChecklistIcon className="w-4 h-4 text-indigo-600" />
                                    Checkpoints
                                </h4>
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                    {subtasks.filter(s => s.isCompleted).length}/{subtasks.length}
                                </span>
                            </div>
                            
                            <ul className="space-y-2">
                                {subtasks.map(st => (
                                    <li key={st.id} className={`flex items-start gap-4 p-4 rounded-3xl border-2 transition-all group ${st.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-50 shadow-sm hover:border-indigo-100'}`}>
                                        <button 
                                            onClick={() => toggleSubtask(st.id)}
                                            className={`mt-0.5 w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${st.isCompleted ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 group-hover:border-indigo-300'}`}
                                        >
                                            {st.isCompleted && <CheckCircleIcon className="w-4 h-4" />}
                                        </button>
                                        <div className="flex-grow min-w-0">
                                            <span className={`text-sm font-black block ${st.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                {st.text}
                                            </span>
                                            {st.linkUrl && (
                                                <div className="mt-1">
                                                    <LinkRenderer text="" url={st.linkUrl} linkText={st.linkText} />
                                                </div>
                                            )}
                                            {st.notes && (
                                                <p className="text-[10px] text-slate-400 mt-1 italic font-medium">
                                                    {st.notes}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {subtasks.length === 0 && <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 uppercase tracking-widest font-black">No checkpoints defined</p>}
                            </ul>
                        </div>
                    </div>
                )}

                {mode === 'edit' && (
                    <>
                        <div className="flex border-b bg-slate-50 px-2 pt-2">
                            <button onClick={() => setActiveTab('details')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all ${activeTab === 'details' ? 'bg-white text-indigo-700 shadow-sm border-x border-t' : 'text-slate-400 hover:text-slate-700'}`}>Mission</button>
                            <button onClick={() => setActiveTab('checklist')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all ${activeTab === 'checklist' ? 'bg-white text-indigo-700 shadow-sm border-x border-t' : 'text-slate-400 hover:text-slate-700'}`}>Roadmap ({subtasks.length})</button>
                            <button onClick={() => setActiveTab('schedule')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all ${activeTab === 'schedule' ? 'bg-white text-indigo-700 shadow-sm border-x border-t' : 'text-slate-400 hover:text-slate-700'}`}>Logic</button>
                        </div>

                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                            
                            {activeTab === 'details' && (
                                <div className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 font-bold text-lg shadow-sm" placeholder="Task designation..." autoFocus required />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mission Deadline</label>
                                            <div className="relative">
                                                <input ref={dueDateRef} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold" />
                                                <button type="button" onClick={() => showPickerSafely(dueDateRef)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 p-1"><CalendarIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Administrative Priority</label>
                                            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold">
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Mission Parameters</label>
                                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 font-medium text-sm" placeholder="Brief summary..." ></textarea>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forensic Analysis / History</label>
                                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 font-mono text-xs" placeholder="Research or results..." ></textarea>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'checklist' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <ChecklistIcon className="w-4 h-4 text-indigo-600" />
                                            Checkpoint Registry
                                        </h3>
                                    </div>
                                    
                                    <ul className="space-y-2">
                                        {subtasks.map(st => (
                                            <li key={st.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                                                {editingSubtaskId === st.id && editSubtaskData ? (
                                                    <div className="space-y-3">
                                                        <input type="text" value={editSubtaskData.text} onChange={(e) => setEditSubtaskData({...editSubtaskData, text: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold" />
                                                        <div className="flex gap-2">
                                                            <button type="button" onClick={saveEditingSubtask} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase">Commit</button>
                                                            <button type="button" onClick={cancelEditingSubtask} className="px-4 py-2 bg-white border rounded-lg text-[9px] font-black uppercase">Discard</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0" onClick={() => startEditingSubtask(st)}>
                                                            <span className="text-sm font-black text-slate-700 block truncate cursor-pointer hover:text-indigo-600 transition-colors">{st.text}</span>
                                                            {st.linkUrl && <span className="text-[9px] text-indigo-400 flex items-center gap-1"><LinkIcon className="w-2.5 h-2.5"/> {st.linkText || st.linkUrl}</span>}
                                                        </div>
                                                        <button type="button" onClick={() => removeSubtask(st.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-200 hover:text-rose-500 rounded-md transition-all self-start mt-0.5"><TrashIcon className="w-3.5 h-3.5"/></button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="p-5 bg-indigo-50/50 rounded-3xl border-2 border-indigo-100 space-y-4 shadow-inner">
                                        <div className="flex gap-3">
                                            <input type="text" value={newSubtaskText} onChange={e => setNewSubtaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())} className="flex-1 p-3 border-none bg-white rounded-xl shadow-sm font-bold text-sm" placeholder="New checkpoint identifier..." />
                                            <button type="button" onClick={addSubtask} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"><AddIcon className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'schedule' && (
                                <div className="space-y-6">
                                     <div className="flex items-center gap-4 p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                                        <div className={`p-4 rounded-2xl transition-all ${isRecurring ? 'bg-indigo-600 shadow-indigo-100 shadow-lg scale-110' : 'bg-white/10 opacity-50'}`}><RepeatIcon className="w-6 h-6" /></div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-lg">Persistence Control</h3>
                                            <p className="text-xs text-slate-400 font-medium">Auto-renew this operation upon closure.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer scale-125 mr-4">
                                            <input type="checkbox" className="sr-only peer" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} />
                                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                        <SparklesIcon className="absolute -right-6 -top-6 w-24 h-24 opacity-5 pointer-events-none group-hover:scale-110 transition-transform" />
                                    </div>

                                    {isRecurring && (
                                        <div className="space-y-6 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 animate-slide-up">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cycle Frequency</label>
                                                    <select value={recurrence.frequency} onChange={e => setRecurrence({ ...recurrence, frequency: e.target.value as any })} className="w-full p-3 border-none bg-white rounded-xl shadow-sm font-bold">
                                                        <option value="daily">Daily</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="monthly">Monthly</option>
                                                        <option value="yearly">Yearly</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Iteration Gap</label>
                                                    <input type="number" min="1" value={recurrence.interval} onChange={e => setRecurrence({ ...recurrence, interval: parseInt(e.target.value) || 1 })} className="w-full p-3 border-none bg-white rounded-xl shadow-sm font-bold" />
                                                </div>
                                            </div>

                                            {recurrence.frequency === 'weekly' && (
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Days</label>
                                                    <div className="flex gap-2">
                                                        {weekDays.map((day, index) => {
                                                            const isSelected = recurrence.byWeekDays?.includes(index);
                                                            return (
                                                                <button key={index} type="button" onClick={() => toggleWeekDay(index)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'}`}>{day}</button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cycle Expiration</label>
                                                <div className="relative">
                                                    <input ref={endDateRef} type="date" value={recurrence.endDate || ''} onChange={e => setRecurrence({ ...recurrence, endDate: e.target.value })} className="w-full p-3 border-none bg-white rounded-xl shadow-sm font-bold" />
                                                    <button type="button" onClick={() => showPickerSafely(endDateRef)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 p-1 hover:text-indigo-600"><CalendarIcon className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </form>
                        
                        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={onClose} className="px-8 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-white rounded-xl transition-all">Discard</button>
                            <button onClick={() => handleSave()} className="px-12 py-3 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">Commit Definition</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TaskModal;
