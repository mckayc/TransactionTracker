
import React, { useState } from 'react';
import type { Template, Task, ScheduledEvent } from '../types';
import { AddIcon, DeleteIcon, EditIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface TemplatesPageProps {
    templates: Template[];
    scheduledEvents: ScheduledEvent[];
    onSaveTemplate: (template: Template) => void;
    onRemoveTemplate: (templateId: string) => void;
}

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
            setTasks([...tasks, { id: generateUUID(), text: newTaskText.trim() }]);
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
            id: selectedTemplate?.id || generateUUID(),
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


const TemplatesPage: React.FC<TemplatesPageProps> = ({ templates, scheduledEvents, onSaveTemplate, onRemoveTemplate }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template);
        setIsCreating(false);
    };

    const handleAddNew = () => {
        setSelectedTemplate(null);
        setIsCreating(true);
    };
    
    const handleSave = (template: Template) => {
        onSaveTemplate(template);
        setSelectedTemplate(template);
        setIsCreating(false);
    };

    const handleCancel = () => {
        setSelectedTemplate(null);
        setIsCreating(false);
    };

    const usedTemplateIds = new Set(scheduledEvents.map(e => e.templateId));

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Task Templates</h1>
                <p className="text-slate-500 mt-1">Create reusable checklists and instructions for your recurring financial tasks.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-700">Your Templates</h2>
                        <button onClick={handleAddNew} className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700"><AddIcon className="w-5 h-5"/></button>
                    </div>
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
                                        <p className="text-xs text-slate-500">{template.tasks.length} task(s)</p>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-center text-slate-500 py-8">No templates yet. Click '+' to create one!</p>
                    )}
                </div>

                <div className="md:col-span-2">
                    {(selectedTemplate || isCreating) ? (
                        <TemplateEditor selectedTemplate={selectedTemplate} onSave={handleSave} onCancel={handleCancel} />
                    ) : (
                        <div className="text-center bg-white p-12 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-600">Select a template to view or edit, or create a new one.</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplatesPage;
