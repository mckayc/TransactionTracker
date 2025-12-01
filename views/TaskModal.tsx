import React, { useState, useEffect, useRef } from 'react';
import type { TaskItem, SubTask, RecurrenceRule, TaskPriority } from '../types';
import { CloseIcon, ChecklistIcon, CalendarIcon, RepeatIcon, DeleteIcon, AddIcon, LinkIcon, EditIcon, CheckBadgeIcon } from '../components/Icons';
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
            // Reset mode on open based on prop (unless creating new)
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
                // In edit mode, default to details. In view mode, default to checklist/overview.
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

        const newTask: TaskItem = {
            id: task?.id || generateUUID(),
            title: title.trim(),
            description: description.trim(),
            notes: notes.trim(),
            priority,
            dueDate: dueDate || undefined,
            isCompleted: isCompleted,
            createdAt: task?.createdAt || new Date().toISOString(),
            subtasks: subtasks,
            recurrence: isRecurring ? recurrence : undefined
        };

        onSave(newTask);
        onClose();
    };

    // Subtask Logic
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

            // If in view mode, auto-save the subtask addition
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
        
        // In View mode, save immediately on check
        if (mode === 'view') {
            const newTask: TaskItem = {
                ...(task || {} as TaskItem),
                subtasks: updatedSubtasks
            };
            onSave(newTask);
        }
    };

    // --- Subtask Editing (Edit Mode) ---
    const startEditingSubtask = (st: SubTask) => {
        setEditingSubtaskId(st.id);
        setEditSubtaskData({ ...st });
    };

    const saveEditingSubtask = () => {
        if (editSubtaskData) {
            setSubtasks(prev => prev.map(s => s.id === editSubtaskData.id ? editSubtaskData : s));
            setEditingSubtaskId(null);
            setEditSubtaskData(null);
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
             // Save immediately
             const newTask: TaskItem = {
                ...(task! || {}),
                id: task?.id || generateUUID(), // Should have ID if in view mode
                isCompleted: newStatus,
                // Ensure other fields are carried over from state in case they were edited in background
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
            onClose(); // Close on completion toggle from view mode? Usually expected.
        }
    };

    const priorityColors = {
        low: 'bg-blue-100 text-blue-700',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-red-100 text-red-700',
    };

    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800 truncate pr-4">
                        {mode === 'view' ? 'Task Details' : (task ? 'Edit Task' : 'New Task')}
                    </h2>
                    <div className="flex items-center gap-2">
                        {mode === 'view' && (
                            <button onClick={() => setMode('edit')} className="p-1.5 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 flex items-center gap-1 text-sm font-medium">
                                <EditIcon className="w-4 h-4" /> Edit
                            </button>
                        )}
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                    </div>
                </div>

                {/* VIEW MODE */}
                {mode === 'view' && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Title & Status */}
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className={`text-2xl font-bold text-slate-800 ${isCompleted ? 'line-through text-slate-400' : ''}`}>{title}</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${priorityColors[priority]}`}>{priority}</span>
                                    {dueDate && (
                                        <span className="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                            <CalendarIcon className="w-3 h-3" />
                                            {formatDate(dueDate)}
                                        </span>
                                    )}
                                    {isRecurring && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium flex items-center gap-1"><RepeatIcon className="w-3 h-3"/> Recurring</span>}
                                </div>
                            </div>
                            <button 
                                onClick={toggleTaskCompletion}
                                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${isCompleted ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                                <CheckBadgeIcon className="w-5 h-5" />
                                {isCompleted ? 'Completed' : 'Complete'}
                            </button>
                        </div>

                        {/* Description */}
                        {description && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Description</h4>
                                <p className="text-slate-700 text-sm whitespace-pre-wrap">{description}</p>
                            </div>
                        )}

                        {/* Notes - Only visible here in View Mode */}
                        {notes && (
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                <h4 className="text-xs font-bold text-yellow-700 uppercase mb-2">Notes</h4>
                                <p className="text-slate-800 text-sm whitespace-pre-wrap">{notes}</p>
                            </div>
                        )}

                        {/* Checklist */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                    <ChecklistIcon className="w-5 h-5 text-indigo-600" />
                                    Checklist
                                </h4>
                                <span className="text-xs text-slate-500">
                                    {subtasks.filter(s => s.isCompleted).length}/{subtasks.length} done
                                </span>
                            </div>
                            
                            <ul className="space-y-2">
                                {subtasks.map(st => (
                                    <li key={st.id} className="flex items-start gap-3 p-3 bg-white border rounded-md shadow-sm">
                                        <input 
                                            type="checkbox" 
                                            checked={st.isCompleted} 
                                            onChange={() => toggleSubtask(st.id)} 
                                            className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer border-slate-300" 
                                        />
                                        <div className="flex-grow">
                                            <span className={`text-sm ${st.isCompleted ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                                                {st.text}
                                            </span>
                                            {st.linkUrl && (
                                                <div className="mt-1">
                                                    <LinkRenderer text="" url={st.linkUrl} linkText={st.linkText} />
                                                </div>
                                            )}
                                            {st.notes && (
                                                <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap pl-1 border-l-2 border-slate-200">
                                                    {st.notes}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {subtasks.length === 0 && <p className="text-sm text-slate-400 italic">No subtasks.</p>}
                            </ul>
                        </div>
                    </div>
                )}

                {/* EDIT MODE */}
                {mode === 'edit' && (
                    <>
                        {/* Tabs */}
                        <div className="flex border-b bg-slate-50">
                            <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Details</button>
                            <button onClick={() => setActiveTab('checklist')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'checklist' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Checklist ({subtasks.length})</button>
                            <button onClick={() => setActiveTab('schedule')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'schedule' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Schedule</button>
                        </div>

                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
                            
                            {/* DETAILS TAB */}
                            {activeTab === 'details' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
                                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Pay Quarterly Tax" autoFocus required />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                                            <div className="relative">
                                                <input 
                                                    ref={dueDateRef}
                                                    type="date" 
                                                    value={dueDate} 
                                                    onChange={e => setDueDate(e.target.value)} 
                                                    className="w-full p-2 border rounded-md pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => showPickerSafely(dueDateRef)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1 rounded-full hover:bg-slate-100"
                                                >
                                                    <CalendarIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="w-full p-2 border rounded-md">
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Short Description</label>
                                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" placeholder="Brief summary..." ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Notes</label>
                                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" placeholder="Add longer notes, research, or details here..." ></textarea>
                                    </div>
                                </div>
                            )}

                            {/* CHECKLIST TAB */}
                            {activeTab === 'checklist' && (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                            <ChecklistIcon className="w-5 h-5 text-indigo-600" />
                                            Checklist Items
                                        </h3>
                                        {subtasks.length === 0 ? (
                                            <p className="text-sm text-slate-500 italic mb-4">No checklist items yet. Add one below.</p>
                                        ) : (
                                            <ul className="space-y-2 mb-4">
                                                {subtasks.map(st => {
                                                    if (editingSubtaskId === st.id && editSubtaskData) {
                                                        // EDIT MODE FOR SUBTASK
                                                        return (
                                                            <li key={st.id} className="p-3 bg-indigo-50 border border-indigo-200 rounded-md shadow-sm space-y-3">
                                                                <div>
                                                                    <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Item Text</label>
                                                                    <input 
                                                                        type="text" 
                                                                        value={editSubtaskData.text} 
                                                                        onChange={(e) => setEditSubtaskData({...editSubtaskData, text: e.target.value})}
                                                                        className="w-full p-2 border rounded text-sm focus:ring-indigo-500" 
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                
                                                                <div>
                                                                    <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Notes</label>
                                                                    <textarea 
                                                                        value={editSubtaskData.notes || ''} 
                                                                        onChange={(e) => setEditSubtaskData({...editSubtaskData, notes: e.target.value})}
                                                                        rows={2}
                                                                        className="w-full p-2 border rounded text-sm focus:ring-indigo-500"
                                                                        placeholder="Add details, instructions, or findings..."
                                                                    />
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Link URL</label>
                                                                        <input 
                                                                            type="text" 
                                                                            value={editSubtaskData.linkUrl || ''} 
                                                                            onChange={(e) => setEditSubtaskData({...editSubtaskData, linkUrl: e.target.value})}
                                                                            className="w-full p-2 border rounded text-xs" 
                                                                            placeholder="https://..."
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Link Text</label>
                                                                        <input 
                                                                            type="text" 
                                                                            value={editSubtaskData.linkText || ''} 
                                                                            onChange={(e) => setEditSubtaskData({...editSubtaskData, linkText: e.target.value})}
                                                                            className="w-full p-2 border rounded text-xs" 
                                                                            placeholder="Display text"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-end gap-2 pt-1">
                                                                    <button type="button" onClick={cancelEditingSubtask} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border rounded hover:bg-slate-50">Cancel</button>
                                                                    <button type="button" onClick={saveEditingSubtask} className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700">Save Item</button>
                                                                </div>
                                                            </li>
                                                        )
                                                    } else {
                                                        // DISPLAY MODE FOR SUBTASK (IN EDIT FORM)
                                                        return (
                                                            <li key={st.id} className="flex items-start gap-3 p-3 bg-white border rounded-md shadow-sm group hover:border-indigo-300 transition-colors">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={st.isCompleted} 
                                                                    onChange={() => toggleSubtask(st.id)} 
                                                                    className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer border-slate-300" 
                                                                />
                                                                <div className="flex-grow flex flex-col cursor-pointer" onClick={() => startEditingSubtask(st)}>
                                                                    <span 
                                                                        className={`text-sm font-medium text-slate-700 hover:text-indigo-600 ${st.isCompleted ? 'line-through text-slate-400' : ''}`} 
                                                                    >
                                                                        {st.text}
                                                                    </span>
                                                                    {st.linkUrl && (
                                                                        <span className="text-xs text-indigo-500 flex items-center gap-1 mt-1">
                                                                            <LinkIcon className="w-3 h-3" />
                                                                            {st.linkText || st.linkUrl}
                                                                        </span>
                                                                    )}
                                                                    {st.notes && (
                                                                        <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-2">
                                                                            {st.notes}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <button type="button" onClick={() => removeSubtask(st.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                                    <DeleteIcon className="w-4 h-4" />
                                                                </button>
                                                            </li>
                                                        )
                                                    }
                                                })}
                                            </ul>
                                        )}

                                        <div className="space-y-2 border p-2 rounded-md bg-slate-50">
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    value={newSubtaskText} 
                                                    onChange={e => setNewSubtaskText(e.target.value)} 
                                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                                    className="flex-grow p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
                                                    placeholder="New checklist item..." 
                                                    autoFocus
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowLinkInput(!showLinkInput)}
                                                    className={`p-2 rounded-md transition-colors ${showLinkInput ? 'bg-indigo-100 text-indigo-600' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}
                                                    title="Add Link"
                                                >
                                                    <LinkIcon className="w-5 h-5" />
                                                </button>
                                                <button type="button" onClick={addSubtask} className="px-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                                                    <AddIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                            {showLinkInput && (
                                                <div className="grid grid-cols-2 gap-2 animate-slide-down">
                                                    <input 
                                                        type="text"
                                                        value={newSubtaskLinkText}
                                                        onChange={e => setNewSubtaskLinkText(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                                        className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                        placeholder="Link Text (optional)"
                                                    />
                                                    <input 
                                                        type="url"
                                                        value={newSubtaskLink}
                                                        onChange={e => setNewSubtaskLink(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                                        className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                        placeholder="URL (https://...)"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SCHEDULE TAB */}
                            {activeTab === 'schedule' && (
                                <div className="space-y-6">
                                     <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <RepeatIcon className={`w-6 h-6 ${isRecurring ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <div className="flex-grow">
                                            <h3 className="font-semibold text-slate-800">Make Recurring?</h3>
                                            <p className="text-xs text-slate-500">Automatically create a new task when completed.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    {isRecurring && (
                                        <div className="space-y-4 pl-4 border-l-2 border-indigo-100">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                                                    <select 
                                                        value={recurrence.frequency} 
                                                        onChange={e => setRecurrence({ ...recurrence, frequency: e.target.value as any })}
                                                        className="w-full p-2 border rounded-md"
                                                    >
                                                        <option value="daily">Daily</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="monthly">Monthly</option>
                                                        <option value="yearly">Yearly</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Interval</label>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={recurrence.interval} 
                                                            onChange={e => setRecurrence({ ...recurrence, interval: parseInt(e.target.value) || 1 })}
                                                            className="w-full p-2 border rounded-md"
                                                        />
                                                        <span className="text-sm text-slate-500">
                                                            {recurrence.frequency === 'daily' ? 'Day(s)' : 
                                                             recurrence.frequency === 'weekly' ? 'Week(s)' : 
                                                             recurrence.frequency === 'monthly' ? 'Month(s)' : 'Year(s)'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Advanced Weekly Options */}
                                            {recurrence.frequency === 'weekly' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">On these days:</label>
                                                    <div className="flex gap-2">
                                                        {weekDays.map((day, index) => {
                                                            const isSelected = recurrence.byWeekDays?.includes(index);
                                                            return (
                                                                <button 
                                                                    key={index} 
                                                                    type="button"
                                                                    onClick={() => toggleWeekDay(index)}
                                                                    className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                                >
                                                                    {day}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Advanced Monthly Options */}
                                            {recurrence.frequency === 'monthly' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">On day:</label>
                                                    <select 
                                                        value={recurrence.byMonthDay !== undefined ? recurrence.byMonthDay : 'same'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setRecurrence({ 
                                                                ...recurrence, 
                                                                byMonthDay: val === 'same' ? undefined : parseInt(val) 
                                                            });
                                                        }}
                                                        className="w-full p-2 border rounded-md"
                                                    >
                                                        <option value="same">Same day of the month</option>
                                                        <option value="1">1st (First Day)</option>
                                                        <option value="15">15th</option>
                                                        <option value="-1">Last Day of Month</option>
                                                    </select>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">End Date (Optional)</label>
                                                <div className="relative">
                                                    <input 
                                                        ref={endDateRef}
                                                        type="date" 
                                                        value={recurrence.endDate || ''} 
                                                        onChange={e => setRecurrence({ ...recurrence, endDate: e.target.value })}
                                                        className="w-full p-2 border rounded-md pr-10"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => showPickerSafely(endDateRef)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1 rounded-full hover:bg-slate-100"
                                                    >
                                                        <CalendarIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </form>
                        
                        {/* Footer */}
                        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border rounded-lg hover:bg-slate-100">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Save Task</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TaskModal;