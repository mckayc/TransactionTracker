
import React, { useState, useEffect, useRef } from 'react';
import type { TaskItem, SubTask, RecurrenceRule, TaskPriority } from '../types';
import { CloseIcon, ChecklistIcon, CalendarIcon, RepeatIcon, DeleteIcon, AddIcon } from '../components/Icons';
import { formatDate, getTodayDate } from '../dateUtils';
import { generateUUID } from '../utils';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: TaskItem) => void;
    task: TaskItem | null;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, task }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [dueDate, setDueDate] = useState('');
    const [subtasks, setSubtasks] = useState<SubTask[]>([]);
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrence, setRecurrence] = useState<RecurrenceRule>({ frequency: 'weekly', interval: 1 });
    const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'schedule'>('details');
    const [newSubtaskText, setNewSubtaskText] = useState('');

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
            console.warn('showPicker failed, using fallback focus/click:', error);
            el.focus();
            try { el.click(); } catch (e) {}
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (task) {
                setTitle(task.title);
                setDescription(task.description || '');
                setPriority(task.priority);
                setDueDate(task.dueDate || '');
                setSubtasks(task.subtasks || []);
                setIsRecurring(!!task.recurrence);
                setRecurrence(task.recurrence || { frequency: 'weekly', interval: 1 });
                // Default to checklist view for existing tasks to act as a "Complete Window"
                setActiveTab('checklist');
            } else {
                // Default state for new task
                setTitle('');
                setDescription('');
                setPriority('medium');
                setDueDate(getTodayDate());
                setSubtasks([]);
                setIsRecurring(false);
                setRecurrence({ frequency: 'weekly', interval: 1 });
                setActiveTab('details');
            }
        }
    }, [isOpen, task]);

    if (!isOpen) return null;

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            alert('Task title is required');
            return;
        }

        const newTask: TaskItem = {
            id: task?.id || generateUUID(),
            title: title.trim(),
            description: description.trim(),
            priority,
            dueDate: dueDate || undefined,
            isCompleted: task?.isCompleted || false,
            createdAt: task?.createdAt || new Date().toISOString(),
            subtasks: subtasks,
            recurrence: isRecurring ? recurrence : undefined
        };

        onSave(newTask);
        onClose();
    };

    const addSubtask = () => {
        if (newSubtaskText.trim()) {
            setSubtasks([...subtasks, { id: generateUUID(), text: newSubtaskText.trim(), isCompleted: false }]);
            setNewSubtaskText('');
        }
    };

    const removeSubtask = (id: string) => {
        setSubtasks(subtasks.filter(st => st.id !== id));
    };

    const toggleSubtask = (id: string) => {
        setSubtasks(subtasks.map(st => st.id === id ? { ...st, isCompleted: !st.isCompleted } : st));
    };

    const priorityColors = {
        low: 'bg-blue-100 text-blue-700',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-red-100 text-red-700',
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800 truncate pr-4">{task ? title : 'New Task'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>

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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Add details..." ></textarea>
                            </div>
                        </div>
                    )}

                    {/* CHECKLIST TAB (COMPLETE WINDOW MODE) */}
                    {activeTab === 'checklist' && (
                        <div className="space-y-4">
                             {/* Summary Header for Context */}
                             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${priorityColors[priority]}`}>
                                            {priority}
                                        </span>
                                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200">
                                            <button 
                                                type="button" 
                                                onClick={() => showPickerSafely(dueDateRef)} 
                                                className="text-indigo-600 hover:text-indigo-800"
                                                title="Change Due Date"
                                            >
                                                <CalendarIcon className="w-4 h-4" />
                                            </button>
                                            <input 
                                                ref={dueDateRef}
                                                type="date" 
                                                value={dueDate} 
                                                onChange={e => setDueDate(e.target.value)} 
                                                className="bg-transparent border-none focus:ring-0 text-slate-700 font-medium p-0 w-[110px] text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {description ? (
                                    <div className="bg-white p-3 rounded border border-slate-200">
                                        <p className="text-slate-700 whitespace-pre-wrap">{description}</p>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic">No description provided.</p>
                                )}
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <ChecklistIcon className="w-5 h-5 text-indigo-600" />
                                    Checklist Items
                                </h3>
                                {subtasks.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic mb-4">No checklist items yet. Add one below.</p>
                                ) : (
                                    <ul className="space-y-2 mb-4">
                                        {subtasks.map(st => (
                                            <li key={st.id} className="flex items-start gap-3 p-3 bg-white border rounded-md shadow-sm group hover:border-indigo-300 transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={st.isCompleted} 
                                                    onChange={() => toggleSubtask(st.id)} 
                                                    className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer border-slate-300" 
                                                />
                                                <span 
                                                    className={`flex-grow text-sm cursor-pointer transition-all ${st.isCompleted ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`} 
                                                    onClick={() => toggleSubtask(st.id)}
                                                >
                                                    {st.text}
                                                </span>
                                                <button type="button" onClick={() => removeSubtask(st.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                    <DeleteIcon className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newSubtaskText} 
                                        onChange={e => setNewSubtaskText(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                        className="flex-grow p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
                                        placeholder="Add a new item..." 
                                        autoFocus
                                    />
                                    <button type="button" onClick={addSubtask} className="px-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                                        <AddIcon className="w-5 h-5" />
                                    </button>
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
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Every</label>
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
            </div>
        </div>
    );
};

export default TaskModal;
