
import React, { useState, useMemo, useEffect } from 'react';
import type { Payee, Transaction, User } from '../types';
import { DeleteIcon, EditIcon, AddIcon, ChevronRightIcon, ChevronDownIcon, NotesIcon, UserGroupIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface PayeesPageProps {
    payees: Payee[];
    onSavePayee: (payee: Payee) => void;
    onDeletePayee: (payeeId: string) => void;
    transactions: Transaction[];
    users: User[];
}

const PayeeEditor: React.FC<{
    selectedPayee: Payee | null;
    payees: Payee[];
    users: User[];
    onSave: (payee: Payee) => void;
    onCancel: () => void;
}> = ({ selectedPayee, payees, users, onSave, onCancel }) => {
    const defaultUser = useMemo(() => users.find(u => u.isDefault) || users[0], [users]);
    const [name, setName] = useState(selectedPayee?.name || '');
    const [parentId, setParentId] = useState(selectedPayee?.parentId || '');
    const [notes, setNotes] = useState(selectedPayee?.notes || '');
    const [userId, setUserId] = useState(selectedPayee?.userId || defaultUser?.id || '');

    // Sync state when selection changes
    useEffect(() => {
        setName(selectedPayee?.name || '');
        setParentId(selectedPayee?.parentId || '');
        setNotes(selectedPayee?.notes || '');
        setUserId(selectedPayee?.userId || defaultUser?.id || '');
    }, [selectedPayee, defaultUser]);

    // Prevent circular dependency: Cannot select self or any descendant as parent
    const validParents = useMemo(() => {
        if (!selectedPayee) return payees.sort((a, b) => a.name.localeCompare(b.name));

        const descendants = new Set<string>();
        const stack = [selectedPayee.id];
        
        while (stack.length > 0) {
            const currentId = stack.pop()!;
            descendants.add(currentId);
            const children = payees.filter(p => p.parentId === currentId);
            children.forEach(c => stack.push(c.id));
        }

        return payees
            .filter(p => !descendants.has(p.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [payees, selectedPayee]);

    const handleSave = () => {
        if (!name.trim()) {
            alert('Name cannot be empty.');
            return;
        }
        onSave({
            id: selectedPayee?.id || generateUUID(),
            name: name.trim(),
            parentId: parentId || undefined,
            notes: notes.trim() || undefined,
            userId: userId || undefined
        });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 sticky top-6">
            <h2 className="text-xl font-bold text-slate-700">{selectedPayee ? 'Edit Income Source' : 'Create New Income Source'}</h2>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source Name</label>
                <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g., Amazon, Google AdSense" 
                    className="w-full p-2 border rounded-md"
                    required 
                />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Parent Source (Optional)</label>
                    <select 
                        value={parentId} 
                        onChange={e => setParentId(e.target.value)}
                        className="w-full p-2 border rounded-md"
                    >
                        <option value="">-- No Parent (Top Level) --</option>
                        {validParents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Associated User</label>
                    <select 
                        value={userId} 
                        onChange={e => setUserId(e.target.value)}
                        className="w-full p-2 border rounded-md"
                    >
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.isDefault ? ' (Default)' : ''}</option>)}
                    </select>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="Add account details, contact info, or reference numbers..." 
                    className="w-full p-2 border rounded-md min-h-[100px]"
                />
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button onClick={onCancel} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Source</button>
            </div>
        </div>
    );
};

// Recursive Tree Node Component
const PayeeNode: React.FC<{
    payee: Payee;
    allPayees: Payee[];
    users: User[];
    level: number;
    selectedId: string | undefined;
    usedIds: Set<string>;
    onSelect: (payee: Payee) => void;
    onDelete: (id: string) => void;
}> = ({ payee, allPayees, users, level, selectedId, usedIds, onSelect, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    const children = useMemo(() => 
        allPayees.filter(p => p.parentId === payee.id).sort((a, b) => a.name.localeCompare(b.name)),
    [allPayees, payee.id]);

    const associatedUser = useMemo(() => 
        users.find(u => u.id === payee.userId) || users.find(u => u.isDefault) || users[0],
    [users, payee.userId]);

    const hasChildren = children.length > 0;
    const isSelected = selectedId === payee.id;

    return (
        <div className="select-none">
            <div 
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border border-transparent group ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}
                style={{ marginLeft: `${level * 16}px` }}
                onClick={(e) => { e.stopPropagation(); onSelect(payee); }}
            >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className={`p-1 rounded hover:bg-slate-200 text-slate-400 ${hasChildren ? 'visible' : 'invisible'}`}
                    >
                        {isExpanded ? <ChevronDownIcon className="w-3 h-3"/> : <ChevronRightIcon className="w-3 h-3"/>}
                    </button>
                    <span className={`text-sm truncate ${isSelected ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                        {payee.name}
                    </span>
                    {associatedUser && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                            <UserGroupIcon className="w-2.5 h-2.5" />
                            {associatedUser.name.charAt(0)}
                        </span>
                    )}
                    {payee.notes && <span title={payee.notes} className="flex-shrink-0"><NotesIcon className="w-3 h-3 text-slate-300" /></span>}
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onSelect(payee); }} 
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100"
                    >
                        <EditIcon className="w-4 h-4"/>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(payee.id); }} 
                        disabled={usedIds.has(payee.id)} 
                        className="text-slate-400 hover:text-red-500 disabled:text-slate-200 disabled:cursor-not-allowed p-1 rounded hover:bg-slate-100"
                        title={usedIds.has(payee.id) ? "Used in transactions" : "Delete"}
                    >
                        <DeleteIcon className="w-4 h-4"/>
                    </button>
                </div>
            </div>
            
            {isExpanded && children.map(child => (
                <PayeeNode 
                    key={child.id}
                    payee={child}
                    allPayees={allPayees}
                    users={users}
                    level={level + 1}
                    selectedId={selectedId}
                    usedIds={usedIds}
                    onSelect={onSelect}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

const PayeesPage: React.FC<PayeesPageProps> = ({ payees, onSavePayee, onDeletePayee, transactions, users }) => {
    const [selectedPayee, setSelectedPayee] = useState<Payee | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    const usedPayeeIds = useMemo(() => {
        const ids = new Set<string>();
        transactions.forEach(t => {
            if (t.payeeId) ids.add(t.payeeId);
        });
        return ids;
    }, [transactions]);

    // Get only root payees to start the recursive rendering
    const rootPayees = useMemo(() => 
        payees.filter(p => !p.parentId).sort((a, b) => a.name.localeCompare(b.name)), 
    [payees]);

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
        // Don't auto-close, allow user to keep editing or see changes
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
                <h1 className="text-3xl font-bold text-slate-800">Income Sources</h1>
                <p className="text-slate-500 mt-1">Manage the origin points of your revenue. Associate them with users for better reporting.</p>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-700">All Sources</h2>
                        <button onClick={handleAddNew} className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors shadow-sm" title="Add new income source">
                            <AddIcon className="w-5 h-5"/>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar group">
                        {rootPayees.length > 0 ? (
                            rootPayees.map(root => (
                                <PayeeNode 
                                    key={root.id}
                                    payee={root}
                                    allPayees={payees}
                                    users={users}
                                    level={0}
                                    selectedId={selectedPayee?.id}
                                    usedIds={usedPayeeIds}
                                    onSelect={handleSelectPayee}
                                    onDelete={onDeletePayee}
                                />
                            ))
                        ) : (
                             <div className="text-center py-12 text-slate-400">
                                <p>No sources yet.</p>
                                <p className="text-xs mt-1">Click + to add one.</p>
                             </div>
                        )}
                    </div>
                </div>
                
                 <div className="md:col-span-2">
                    {(selectedPayee || isCreating) ? (
                        <PayeeEditor selectedPayee={selectedPayee} payees={payees} users={users} onSave={handleSave} onCancel={handleCancel} />
                    ) : (
                        <div className="text-center bg-white p-12 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-600">Select an income source to edit, or create a new one.</h3>
                             <p className="text-sm text-slate-500 mt-2">You can organize sources into hierarchies and assign them to specific team members or business owners.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayeesPage;
