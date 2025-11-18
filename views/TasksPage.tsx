
import React, { useState, useMemo } from 'react';
import type { Template, Task, ScheduledEvent, TaskItem, TaskPriority } from '../types';
import { AddIcon, DeleteIcon, EditIcon, CheckCircleIcon, CalendarIcon, RepeatIcon, ChecklistIcon } from '../components/Icons';
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
}

// --- Sub-Component: Template Editor (Legacy) ---
const TemplateEditor: React.FC<{
    selectedTemplate: Template | null;
    onSave: (template: Template) => void;
    onCancel: () => void;
}> = ({ selectedTemplate, onSave, onCancel }) => {
    const [name, setName] = useState(selectedTemplate?.name || '');
    const [instructions, setInstructions] = useState(selectedTemplate?.instructions || '');
    const [tasks, setTasks] = useState<Task[]>(selectedTemplate?.tasks || []);
    const [newTaskText, setNewTaskText] = useState('');

    const handleAddTask = () => {
        if (newTaskText.trim()) {
            setTasks([...tasks, { id: crypto.randomUUID(), text: newTaskText.trim() }]);
            setNewTaskText('');
        }
    };

    const handleRemoveTask = (taskId: string) => {
        setTasks(tasks.filter(task => task.id !== taskId));
    };
    
    const handleSave = () => {
        if (!name.trim()) {
            alert('Template name is required.');
            return;
        }
        onSave({
            id: selectedTemplate?.id || crypto.randomUUID(),
            name: name.trim(),
            instructions: instructions.trim(),
            tasks
        });
    };
    
    return (
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xl font-bold text-slate-700">{selectedTemplate ? 'Edit Template' : 'Create New Template'}</h2>
            <div>
                <label className="block text-sm font-medium text-slate-700">Template Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Monthly Bill Payments" required />
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-700">Instructions (Optional)</label>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Add details or notes here." rows={3}></textarea>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Tasks</h3>
                <ul className="space-y-2 mb-2">
                    {tasks.map(task => (
                        <li key={task.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-md">
                            <span className="flex-grow text-sm">{task.text}</span>
                            <button onClick={() => handleRemoveTask(task.id)} className="text-red-500 hover:text-red-700"><DeleteIcon className="w-4 h-4" /></button>
                        </li>
                    ))}
                </ul>
                <div className="flex gap-2">
                    <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTask())} placeholder="Add a new task" className="flex-grow" />
                    <button onClick={handleAddTask} className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><AddIcon className="w-5 h-5"/></button>
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button onClick={onCancel} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Template</button>
            </div>
         </div>
    );
};

// --- Sub-Component: Task Item Row ---
const TaskItemRow: React.FC<{ task: TaskItem; onToggle: () => void; onDelete: () => void; onEdit: () => void; }> = ({ task, onToggle, onDelete, onEdit }) => {
    const priorityColors = {
        low: 'bg-blue-100 text-blue-700',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-red-100 text-red-700',
    };

    const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;

    return (
        <div className={`flex items-start gap-3 p-4 bg-white border rounded-lg shadow-sm transition-all ${task.isCompleted ? 'opacity-60' : 'hover:shadow-md'}`}>
             <button onClick={onToggle} className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-indigo-500'}`}>
                {task.isCompleted && <CheckCircleIcon className="w-5 h-5 text-white" />}
             </button>
             
             <div className="flex-grow cursor-pointer" onClick={onEdit}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className={`font-medium ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.title}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>{task.priority}</span>
                    {task.recurrence && <span className="text-xs text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full"><RepeatIcon className="w-3 h-3"/> {task.recurrence.frequency}</span>}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    {task.description && <span className="truncate max-w-xs">{task.description}</span>}
                    
                    {task.dueDate && (
                        <span className={`flex items-center gap-1 ${!task.isCompleted && new Date(task.dueDate) < new Date() ? 'text-red-600 font-bold' : ''}`}>
                            <CalendarIcon className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                        </span>
                    )}

                    {totalSubtasks > 0 && (
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <ChecklistIcon className="w-3 h-3" />
                            {completedSubtasks}/{totalSubtasks}
                        </span>
                    )}
                </div>
             </div>

             <div className="flex gap-1">
                 <button onClick={onEdit} className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-slate-100">
                     <EditIcon className="w-5 h-5" />
                 </button>
                 <button onClick={onDelete} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-slate-100">
                     <DeleteIcon className="w-5 h-5" />
                 </button>
             </div>
        </div>
    );
};

const TasksPage: React.FC<TasksPageProps> = ({ tasks, onSaveTask, onDeleteTask, onToggleTask, templates, scheduledEvents, onSaveTemplate, onRemoveTemplate }) => {
    const [activeTab, setActiveTab] = useState<'mytasks' | 'templates'>('mytasks');
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

    // --- Templates State ---
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const usedTemplateIds = new Set(scheduledEvents.map(e => e.templateId));

    // --- Tasks Logic ---
    const filteredTasks = useMemo(() => {
        let result = tasks;
        if (filter === 'active') result = result.filter(t => !t.isCompleted);
        if (filter === 'completed') result = result.filter(t => t.isCompleted);
        
        return result.sort((a, b) => {
            if (sortBy === 'priority') {
                const pMap = { high: 3, medium: 2, low: 1 };
                return pMap[b.priority] - pMap[a.priority];
            } else {
                // Sort by Due Date (earliest first), then Created Date
                if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return b.createdAt.localeCompare(a.createdAt);
            }
        });
    }, [tasks, filter, sortBy]);

    // --- Task Handlers ---
    const handleAddTask = () => {
        setEditingTask(null);
        setIsTaskModalOpen(true);
    };

    const handleEditTask = (task: TaskItem) => {
        setEditingTask(task);
        setIsTaskModalOpen(true);
    };

    // --- Template Handlers ---
    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template);
        setIsCreatingTemplate(false);
    };
    const handleAddNewTemplate = () => {
        setSelectedTemplate(null);
        setIsCreatingTemplate(true);
    };
    const handleSaveTemplateWrapper = (template: Template) => {
        onSaveTemplate(template);
        setSelectedTemplate(template);
        setIsCreatingTemplate(false);
    };
    const handleCancelTemplate = () => {
        setSelectedTemplate(null);
        setIsCreatingTemplate(false);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Tasks</h1>
                    <p className="text-slate-500 mt-1">Manage your to-do list and recurring checklists.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('mytasks')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'mytasks' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>My Tasks</button>
                    <button onClick={() => setActiveTab('templates')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'templates' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Recurring Lists</button>
                </div>
            </div>

            {activeTab === 'mytasks' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                    <button onClick={handleAddTask} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                        <AddIcon className="w-8 h-8 mb-2" />
                        <span className="font-medium">Create New Task</span>
                    </button>

                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex gap-4">
                            <button onClick={() => setFilter('active')} className={`text-sm font-medium ${filter === 'active' ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-2.5 pb-2' : 'text-slate-500'}`}>Active</button>
                            <button onClick={() => setFilter('completed')} className={`text-sm font-medium ${filter === 'completed' ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-2.5 pb-2' : 'text-slate-500'}`}>Completed</button>
                            <button onClick={() => setFilter('all')} className={`text-sm font-medium ${filter === 'all' ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-2.5 pb-2' : 'text-slate-500'}`}>All</button>
                        </div>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="text-xs border-none bg-transparent text-slate-500 font-medium focus:ring-0 cursor-pointer">
                            <option value="date">Sort by Due Date</option>
                            <option value="priority">Sort by Priority</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        {filteredTasks.length > 0 ? (
                            filteredTasks.map(task => (
                                <TaskItemRow key={task.id} task={task} onToggle={() => onToggleTask(task.id)} onDelete={() => onDeleteTask(task.id)} onEdit={() => handleEditTask(task)} />
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-slate-400">No tasks found.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'templates' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-700">Checklist Templates</h2>
                            <button onClick={handleAddNewTemplate} className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700"><AddIcon className="w-5 h-5"/></button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Create reusable lists for recurring events (like "Monthly Closing"). Schedule these in the Calendar.</p>
                        {templates.length > 0 ? (
                             <ul className="space-y-2">
                                {templates.map(template => {
                                    const isUsed = usedTemplateIds.has(template.id);
                                    return (
                                        <li key={template.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTemplate?.id === template.id ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-slate-50'}`} onClick={() => handleSelectTemplate(template)}>
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold">{template.name}</span>
                                                <div className="flex items-center gap-2">
                                                     <button onClick={(e) => { e.stopPropagation(); handleSelectTemplate(template); }} className="text-slate-500 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); onRemoveTemplate(template.id); }} disabled={isUsed} className="text-slate-500 hover:text-red-500 disabled:text-slate-300 disabled:cursor-not-allowed" title={isUsed ? "Cannot delete a template that is scheduled." : "Delete template"}><DeleteIcon className="w-4 h-4"/></button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500">{template.tasks.length} items</p>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-center text-slate-500 py-8">No templates yet.</p>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        {(selectedTemplate || isCreatingTemplate) ? (
                            <TemplateEditor selectedTemplate={selectedTemplate} onSave={handleSaveTemplateWrapper} onCancel={handleCancelTemplate} />
                        ) : (
                            <div className="text-center bg-white p-12 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-600">Select a template to edit, or create a new one.</h3>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <TaskModal 
                isOpen={isTaskModalOpen} 
                onClose={() => setIsTaskModalOpen(false)} 
                onSave={onSaveTask} 
                task={editingTask} 
            />
        </div>
    );
};

export default React.memo(TasksPage);
