
import React, { useState } from 'react';
import type { Tag } from '../types';
import { DeleteIcon, AddIcon, EditIcon, TagIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface TagsPageProps {
    tags: Tag[];
    onSaveTag: (tag: Tag) => void;
    onDeleteTag: (tagId: string) => void;
}

const COLORS = [
    'bg-slate-100 text-slate-800',
    'bg-red-100 text-red-800',
    'bg-orange-100 text-orange-800',
    'bg-amber-100 text-amber-800',
    'bg-green-100 text-green-800',
    'bg-emerald-100 text-emerald-800',
    'bg-teal-100 text-teal-800',
    'bg-cyan-100 text-cyan-800',
    'bg-blue-100 text-blue-800',
    'bg-indigo-100 text-indigo-800',
    'bg-violet-100 text-violet-800',
    'bg-purple-100 text-purple-800',
    'bg-fuchsia-100 text-fuchsia-800',
    'bg-pink-100 text-pink-800',
    'bg-rose-100 text-rose-800',
];

const TagsPage: React.FC<TagsPageProps> = ({ tags, onSaveTag, onDeleteTag }) => {
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [editingTagId, setEditingTagId] = useState<string | null>(null);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            const newTag: Tag = {
                id: editingTagId || generateUUID(),
                name: name.trim(),
                color: selectedColor
            };
            onSaveTag(newTag);
            resetForm();
        }
    };

    const handleEdit = (tag: Tag) => {
        setEditingTagId(tag.id);
        setName(tag.name);
        setSelectedColor(tag.color);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this tag? It will be removed from all associated transactions.')) {
            onDeleteTag(id);
            if (editingTagId === id) resetForm();
        }
    };

    const resetForm = () => {
        setEditingTagId(null);
        setName('');
        setSelectedColor(COLORS[0]);
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Tags</h1>
                <p className="text-slate-500 mt-1">Create tags to organize transactions across different categories.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-700 mb-4">{editingTagId ? 'Edit Tag' : 'Add New Tag'}</h2>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tag Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Tax Deductible, Vacation 2024"
                                className="w-full p-2 border rounded-md"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map((color, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => setSelectedColor(color)}
                                        className={`w-8 h-8 rounded-full border-2 ${color.replace('text-', 'border-')} ${selectedColor === color ? 'ring-2 ring-offset-2 ring-slate-400' : 'border-transparent'}`}
                                        aria-label="Select color"
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button type="submit" className="px-4 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700">
                                {editingTagId ? 'Save Changes' : 'Add Tag'}
                            </button>
                            {editingTagId && (
                                <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 font-semibold bg-slate-100 rounded-lg hover:bg-slate-200">
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-700 mb-4">Your Tags</h2>
                    {tags.length > 0 ? (
                        <ul className="space-y-2">
                            {tags.map(tag => (
                                <li key={tag.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className={`px-2 py-1 rounded-md text-sm font-medium ${tag.color}`}>
                                        {tag.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleEdit(tag)} className="text-slate-500 hover:text-indigo-600 p-1">
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(tag.id)} className="text-slate-500 hover:text-red-600 p-1">
                                            <DeleteIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            <TagIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                            <p>No tags yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TagsPage;
