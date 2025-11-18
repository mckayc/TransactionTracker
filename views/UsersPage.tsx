import React, { useState } from 'react';
import type { User } from '../types';
import { DeleteIcon, AddIcon, EditIcon } from '../components/Icons';

interface UsersPageProps {
    users: User[];
    onSaveUser: (user: User) => void;
    onDeleteUser: (userId: string) => void;
}

const UsersPage: React.FC<UsersPageProps> = ({ users, onSaveUser, onDeleteUser }) => {
    const [newUserName, setNewUserName] = useState('');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUserName.trim()) {
            const newUser: User = {
                id: crypto.randomUUID(),
                name: newUserName.trim(),
            };
            onSaveUser(newUser);
            setNewUserName('');
        }
    };
    
    const handleStartEdit = (user: User) => {
        setEditingUserId(user.id);
        setEditingName(user.name);
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
        setEditingName('');
    };

    const handleSaveEdit = () => {
        if (!editingUserId || !editingName.trim()) {
            handleCancelEdit();
            return;
        }
        const userToSave = users.find(u => u.id === editingUserId);
        if (userToSave && userToSave.name !== editingName.trim()) {
            onSaveUser({ ...userToSave, name: editingName.trim() });
        }
        handleCancelEdit();
    };
    
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Users</h1>
                <p className="text-slate-500 mt-1">Manage users for transaction assignment and reporting.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-700 mb-4">Add New User</h2>
                    <form onSubmit={handleAddUser} className="flex gap-2">
                        <input
                            type="text"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="e.g., Jane Doe"
                            className="flex-grow"
                            required
                        />
                        <button type="submit" title="Add User" className="px-4 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700">
                            <AddIcon className="w-5 h-5" />
                        </button>
                    </form>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-700 mb-4">Your Users</h2>
                    {users.length > 0 ? (
                        <ul className="space-y-3">
                            {users.map(user => (
                                <li key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex-grow">
                                        {editingUserId === user.id ? (
                                            <input 
                                                type="text" 
                                                value={editingName} 
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onBlur={handleSaveEdit}
                                                onKeyDown={handleInputKeyDown}
                                                autoFocus
                                                className="w-full text-sm p-1 rounded-md"
                                            />
                                        ) : (
                                            <>
                                                <p className="font-medium text-slate-800">{user.name}</p>
                                                {user.isDefault && <p className="text-xs text-slate-400">Default</p>}
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleStartEdit(user)} className="text-slate-500 hover:text-indigo-600" title="Edit name">
                                            <EditIcon className="w-5 h-5"/>
                                        </button>
                                        <button
                                            onClick={() => onDeleteUser(user.id)}
                                            disabled={user.isDefault}
                                            className="text-red-500 hover:text-red-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                                            title={user.isDefault ? "Cannot delete the default user." : "Delete user"}
                                        >
                                            <DeleteIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-slate-500 py-8">No users found. This is unexpected.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UsersPage;