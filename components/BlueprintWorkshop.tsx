import React, { useState, useMemo } from 'react';
import type { BlueprintTemplate, BlueprintExample, ReconciliationRule, Category, Payee, Merchant, Location, User, TransactionType, Account } from '../types';
/* Added SaveIcon to the import list */
import { CloseIcon, SparklesIcon, AddIcon, DeleteIcon, TableIcon, RobotIcon, InfoIcon, CheckCircleIcon, SaveIcon } from './Icons';
import { generateUUID } from '../utils';

interface BlueprintWorkshopProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (template: BlueprintTemplate) => void;
    rawLines: string[];
    categories: Category[];
    payees: Payee[];
    merchants: Merchant[];
    locations: Location[];
    users: User[];
    types: TransactionType[];
}

const BlueprintWorkshop: React.FC<BlueprintWorkshopProps> = ({ 
    isOpen, onClose, onSave, rawLines, categories, payees, merchants, locations, users, types 
}) => {
    const [name, setName] = useState('');
    const [examples, setExamples] = useState<BlueprintExample[]>([]);
    const [activeLine, setActiveLine] = useState<string | null>(null);

    // Temp Example Form
    const [eCatId, setECatId] = useState('');
    const [ePayId, setEPayId] = useState('');

    if (!isOpen) return null;

    const handleAddExample = () => {
        if (!activeLine) return;
        const newExample: BlueprintExample = {
            rawLine: activeLine,
            suggestedRule: {
                name: `Example: ${activeLine.substring(0, 20)}`,
                setCategoryId: eCatId || undefined,
                setPayeeId: ePayId || undefined
            }
        };
        setExamples([...examples, newExample]);
        setActiveLine(null);
        setECatId('');
        setEPayId('');
    };

    const handleSave = () => {
        if (!name.trim() || examples.length === 0) {
            alert("Name and at least one example are required.");
            return;
        }
        onSave({
            id: generateUUID(),
            name: name.trim(),
            examples
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-8 h-8" />
                        <div>
                            <h3 className="text-xl font-black">Smart Template Workshop</h3>
                            <p className="text-xs text-indigo-200 uppercase font-bold tracking-widest">Blueprint Design Phase</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6"/></button>
                </div>

                <div className="flex-1 flex min-h-0">
                    {/* LEFT: RAW LINES */}
                    <div className="w-1/2 border-r border-slate-100 flex flex-col bg-slate-50">
                        <div className="p-4 border-b bg-white">
                            <h4 className="text-xs font-black text-slate-400 uppercase mb-2">Raw File Content (First 20 Lines)</h4>
                            <p className="text-[10px] text-slate-500 leading-tight">Click a line to create a training rule for the AI.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {rawLines.slice(0, 20).map((line, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setActiveLine(line)}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all font-mono text-[10px] ${activeLine === line ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:border-slate-200'}`}
                                >
                                    {line}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: BUILDER & EXAMPLES */}
                    <div className="w-1/2 flex flex-col bg-white overflow-y-auto custom-scrollbar">
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Template Identity</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chase Visa Platinum Blueprint" className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800" />
                            </div>

                            {activeLine ? (
                                <div className="p-6 bg-indigo-50 border-2 border-indigo-100 rounded-2xl animate-fade-in space-y-4">
                                    <h5 className="font-bold text-indigo-900 text-sm flex items-center gap-2"><AddIcon className="w-4 h-4"/> Create Blueprint Rule</h5>
                                    <div className="bg-white p-3 rounded-xl border border-indigo-100 font-mono text-[10px] text-slate-500">{activeLine}</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Map to Category</label>
                                            <select value={eCatId} onChange={e => setECatId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold">
                                                <option value="">-- Select --</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Map to Payee</label>
                                            <select value={ePayId} onChange={e => setEPayId(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold">
                                                <option value="">-- Select --</option>
                                                {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setActiveLine(null)} className="flex-1 py-2 text-xs font-bold text-slate-500">Cancel</button>
                                        <button onClick={handleAddExample} className="flex-[2] py-2 bg-indigo-600 text-white font-black rounded-lg text-xs">Confirm Example</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                                    <RobotIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-medium">Select a line from the left to start teaching the AI.</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                    <span>Blueprint Examples ({examples.length})</span>
                                    {examples.length >= 3 && <span className="text-emerald-500 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Strong Blueprint</span>}
                                </h4>
                                {examples.map((ex, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center group">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-mono text-slate-400 truncate">{ex.rawLine}</p>
                                            <p className="text-[10px] font-bold text-indigo-700 mt-1">
                                                {categories.find(c => c.id === ex.suggestedRule.setCategoryId)?.name || 'No Cat'} &rarr; {payees.find(p => p.id === ex.suggestedRule.setPayeeId)?.name || 'No Payee'}
                                            </p>
                                        </div>
                                        <button onClick={() => setExamples(examples.filter((_, i) => i !== idx))} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><DeleteIcon className="w-4 h-4"/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-400">
                        <InfoIcon className="w-4 h-4" />
                        <span className="text-[10px] font-medium uppercase">3+ Examples recommended for high accuracy.</span>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={examples.length === 0 || !name.trim()}
                        className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 disabled:opacity-30 flex items-center gap-2"
                    >
                        <SaveIcon className="w-5 h-5" /> Finish & Create Template
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlueprintWorkshop;
