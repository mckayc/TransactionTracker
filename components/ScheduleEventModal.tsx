
import React, { useState, useEffect } from 'react';
import type { Template, ScheduledEvent } from '../types';
import { CloseIcon } from './Icons';
import { generateUUID } from '../utils';

interface ScheduleEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: ScheduledEvent) => void;
    templates: Template[];
    initialDate: Date;
}

const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ScheduleEventModal: React.FC<ScheduleEventModalProps> = ({ isOpen, onClose, onSave, templates, initialDate }) => {
    const [templateId, setTemplateId] = useState('');
    const [startDate, setStartDate] = useState(formatDate(initialDate));
    const [recurrence, setRecurrence] = useState<'none' | 'monthly'>('none');

    useEffect(() => {
        if (isOpen) {
            setStartDate(formatDate(initialDate));
            if (templates.length > 0) {
                setTemplateId(templates[0].id);
            }
        }
    }, [isOpen, initialDate, templates]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!templateId) {
            alert("Please select a template.");
            return;
        }
        const newEvent: ScheduledEvent = {
            id: generateUUID(),
            templateId,
            startDate,
            recurrence,
        };
        onSave(newEvent);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Schedule a Task</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                </div>
                {templates.length > 0 ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Task Template</label>
                            <select value={templateId} onChange={e => setTemplateId(e.target.value)} required>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Start Date</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Recurrence</label>
                            <select value={recurrence} onChange={e => setRecurrence(e.target.value as any)}>
                                <option value="none">Does not repeat</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                            <button type="submit" className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Schedule</button>
                        </div>
                    </form>
                ) : (
                    <div>
                        <p className="text-center text-slate-600">You need to create a Task Template first.</p>
                        <p className="text-center text-sm text-slate-500 mt-1">Go to the "Task Templates" page to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScheduleEventModal;
