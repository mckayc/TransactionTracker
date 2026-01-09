
import React, { useState } from 'react';
import type { Category } from '../types';
import { CloseIcon, SaveIcon } from './Icons';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: any) => void;
    type: 'categoryId' | 'date';
    categories: Category[];
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, onConfirm, type, categories }) => {
    const [value, setValue] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value) {
            onConfirm(value);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800">Bulk Adjust</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Mass Record Update</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400" /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {type === 'categoryId' ? (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Target Category</label>
                            <select 
                                value={value} 
                                onChange={e => setValue(e.target.value)} 
                                required
                                className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="">Select Category...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sync to Effective Date</label>
                            <input 
                                type="date" 
                                value={value} 
                                onChange={e => setValue(e.target.value)} 
                                required
                                className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-500 outline-none"
                            />
                        </div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-200 transition-colors">Abort</button>
                        <button 
                            type="submit" 
                            disabled={!value}
                            className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                            Commit Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BulkEditModal;
