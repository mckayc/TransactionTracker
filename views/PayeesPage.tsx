import React, { useState, useMemo } from 'react';
import type { Payee, Transaction } from '../types';
import { DeleteIcon, EditIcon, AddIcon } from '../components/Icons';

interface PayeesPageProps {
    payees: Payee[];
    onSavePayee: (payee: Payee) => void;
    onDeletePayee: (payeeId: string) => void;
    transactions: Transaction[];
}

const PayeeEditor: React.FC<{
    selectedPayee: Payee | null;
    payees: Payee[];
    onSave: (payee: Payee) => void;
    onCancel: () => void;
}> = ({ selectedPayee, payees, onSave, onCancel }) => {
    const [name, setName] = useState(selectedPayee?.name || '');
    const [parentId, setParentId] = useState(selectedPayee?.parentId || '');

    const potentialParents = useMemo(() => 
        payees.filter(p => !p.parentId && p.id !== selectedPayee?.id), 
    [payees, selectedPayee]);

    const handleSave = () => {
        if (!name.trim()) {
            alert('Payee name cannot be empty.');
            return;
        }
        onSave({
            id: selectedPayee?.id || crypto.randomUUID(),
            name: name.trim(),
            parentId: parentId || undefined,
        });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xl font-bold text-slate-700">{selectedPayee ? 'Edit Payee' : 'Create New Payee'}</h2>
            <div>
                <label className="block text-sm font-medium text-slate-700">Payee Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Google, Amazon" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Parent Payee (Optional)</label>
                <select value={parentId} onChange={e => setParentId(e.target.value)}>
                    <option value="">-- No Parent --</option>
                    {potentialParents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button onClick={onCancel} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Payee</button>
            </div>
        </div>
    );
};

const PayeesPage: React.FC<PayeesPageProps> = ({ payees, onSavePayee, onDeletePayee, transactions }) => {
    const [selectedPayee, setSelectedPayee] = useState<Payee | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    const usedPayeeIds = useMemo(() => new Set(transactions.map(t => t.payeeId)), [transactions]);

    const organizedPayees = useMemo(() => {
        const parents = payees.filter(p => !p.parentId).sort((a,b) => a.name.localeCompare(b.name));
        return parents.map(parent => ({
            ...parent,
            children: payees.filter(p => p.parentId === parent.id).sort((a,b) => a.name.localeCompare(b.name)),
        }));
    }, [payees]);

    const handleSelectPayee = (payee: Payee) => {
        setSelectedPayee(payee);
        setIsCreating(false);
    };

    const handleAddNew = () => {
        setSelectedPayee(null);
        setIsCreating(true);
    };

    const handleSave = (payee: Payee) => {
        onSavePayee(payee);
        setSelectedPayee(payee);
        setIsCreating(false);
    };
    
    const handleCancel = () => {
        setSelectedPayee(null);
        setIsCreating(false);
    };
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Payees</h1>
                <p className="text-slate-500 mt-1">Manage the people and companies you transact with.</p>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-700">Your Payees</h2>
                        <button onClick={handleAddNew} className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700" title="Add new payee">
                            <AddIcon className="w-5 h-5"/>
                        </button>
                    </div>
                     {organizedPayees.length > 0 ? (
                        <ul className="space-y-2">
                            {organizedPayees.map(parent => (
                                <li key={parent.id} className="bg-slate-50 rounded-lg">
                                    <div className={`flex items-center justify-between p-3 rounded-t-lg border-b border-slate-200 cursor-pointer ${selectedPayee?.id === parent.id ? 'bg-indigo-100' : 'hover:bg-slate-100'}`} onClick={() => handleSelectPayee(parent)}>
                                        <span className="font-semibold">{parent.name}</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleSelectPayee(parent); }} className="text-slate-500 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                            <button onClick={(e) => { e.stopPropagation(); onDeletePayee(parent.id); }} disabled={usedPayeeIds.has(parent.id)} className="text-slate-500 hover:text-red-500 disabled:text-slate-300 disabled:cursor-not-allowed"><DeleteIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                    {parent.children.length > 0 && (
                                        <ul className="p-2 space-y-1">
                                            {parent.children.map(child => (
                                                 <li key={child.id} className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer ${selectedPayee?.id === child.id ? 'bg-indigo-100' : 'hover:bg-slate-100'}`} onClick={() => handleSelectPayee(child)}>
                                                    <span className="text-sm pl-4">- {child.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); handleSelectPayee(child); }} className="text-slate-500 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                                        <button onClick={(e) => { e.stopPropagation(); onDeletePayee(child.id); }} disabled={usedPayeeIds.has(child.id)} className="text-slate-500 hover:text-red-500 disabled:text-slate-300 disabled:cursor-not-allowed"><DeleteIcon className="w-4 h-4"/></button>
                                                    </div>
                                                 </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-center text-slate-500 py-8">No payees yet. Click '+' to create one!</p>
                    )}
                </div>
                 <div className="md:col-span-2">
                    {(selectedPayee || isCreating) ? (
                        <PayeeEditor selectedPayee={selectedPayee} payees={payees} onSave={handleSave} onCancel={handleCancel} />
                    ) : (
                        <div className="text-center bg-white p-12 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-600">Select a payee to edit, or create a new one.</h3>
                             <p className="text-sm text-slate-500 mt-2">You can create parent payees (e.g., Amazon) and child payees (e.g., Amazon Web Services) for better organization.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayeesPage;