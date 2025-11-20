
import React, { useState, useMemo } from 'react';
import type { Category, Transaction } from '../types';
import { DeleteIcon, EditIcon, AddIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface CategoriesPageProps {
    categories: Category[];
    onSaveCategory: (category: Category) => void;
    onDeleteCategory: (categoryId: string) => void;
    transactions: Transaction[];
}

const CategoryEditor: React.FC<{
    selectedCategory: Category | null;
    categories: Category[];
    onSave: (category: Category) => void;
    onCancel: () => void;
}> = ({ selectedCategory, categories, onSave, onCancel }) => {
    const [name, setName] = useState(selectedCategory?.name || '');
    const [parentId, setParentId] = useState(selectedCategory?.parentId || '');

    const potentialParents = useMemo(() => 
        categories.filter(c => !c.parentId && c.id !== selectedCategory?.id), 
    [categories, selectedCategory]);

    const handleSave = () => {
        if (!name.trim()) {
            alert('Category name cannot be empty.');
            return;
        }
        onSave({
            id: selectedCategory?.id || generateUUID(),
            name: name.trim(),
            parentId: parentId || undefined,
        });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xl font-bold text-slate-700">{selectedCategory ? 'Edit Category' : 'Create New Category'}</h2>
            <div>
                <label className="block text-sm font-medium text-slate-700">Category Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Utilities, Subscriptions" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Parent Category (Optional)</label>
                <select value={parentId} onChange={e => setParentId(e.target.value)}>
                    <option value="">-- No Parent --</option>
                    {potentialParents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button onClick={onCancel} className="px-4 py-2 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Category</button>
            </div>
        </div>
    );
};

const CategoriesPage: React.FC<CategoriesPageProps> = ({ categories, onSaveCategory, onDeleteCategory, transactions }) => {
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    const usedCategoryIds = useMemo(() => new Set(transactions.map(t => t.categoryId)), [transactions]);

    const organizedCategories = useMemo(() => {
        const parents = categories.filter(c => !c.parentId).sort((a,b) => a.name.localeCompare(b.name));
        return parents.map(parent => ({
            ...parent,
            children: categories.filter(c => c.parentId === parent.id).sort((a,b) => a.name.localeCompare(b.name)),
        }));
    }, [categories]);

    const handleSelectCategory = (category: Category) => {
        setSelectedCategory(category);
        setIsCreating(false);
    };

    const handleAddNew = () => {
        setSelectedCategory(null);
        setIsCreating(true);
    };

    const handleSave = (category: Category) => {
        onSaveCategory(category);
        setSelectedCategory(category);
        setIsCreating(false);
    };
    
    const handleCancel = () => {
        setSelectedCategory(null);
        setIsCreating(false);
    };
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Categories</h1>
                <p className="text-slate-500 mt-1">Organize your transactions into meaningful categories.</p>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-700">Your Categories</h2>
                        <button onClick={handleAddNew} className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700" title="Add new category">
                            <AddIcon className="w-5 h-5"/>
                        </button>
                    </div>
                     {organizedCategories.length > 0 ? (
                        <ul className="space-y-2">
                            {organizedCategories.map(parent => (
                                <li key={parent.id} className="bg-slate-50 rounded-lg">
                                    <div className={`flex items-center justify-between p-3 rounded-t-lg border-b border-slate-200 cursor-pointer ${selectedCategory?.id === parent.id ? 'bg-indigo-100' : 'hover:bg-slate-100'}`} onClick={() => handleSelectCategory(parent)}>
                                        <span className="font-semibold">{parent.name}</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleSelectCategory(parent); }} className="text-slate-500 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteCategory(parent.id); }} disabled={usedCategoryIds.has(parent.id)} className="text-slate-500 hover:text-red-500 disabled:text-slate-300 disabled:cursor-not-allowed"><DeleteIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                    {parent.children.length > 0 && (
                                        <ul className="p-2 space-y-1">
                                            {parent.children.map(child => (
                                                 <li key={child.id} className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer ${selectedCategory?.id === child.id ? 'bg-indigo-100' : 'hover:bg-slate-100'}`} onClick={() => handleSelectCategory(child)}>
                                                    <span className="text-sm pl-4">- {child.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); handleSelectCategory(child); }} className="text-slate-500 hover:text-indigo-600"><EditIcon className="w-4 h-4"/></button>
                                                        <button onClick={(e) => { e.stopPropagation(); onDeleteCategory(child.id); }} disabled={usedCategoryIds.has(child.id)} className="text-slate-500 hover:text-red-500 disabled:text-slate-300 disabled:cursor-not-allowed"><DeleteIcon className="w-4 h-4"/></button>
                                                    </div>
                                                 </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-center text-slate-500 py-8">No categories yet. Click '+' to create one!</p>
                    )}
                </div>
                 <div className="md:col-span-2">
                    {(selectedCategory || isCreating) ? (
                        <CategoryEditor selectedCategory={selectedCategory} categories={categories} onSave={handleSave} onCancel={handleCancel} />
                    ) : (
                        <div className="text-center bg-white p-12 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-600">Select a category to edit, or create a new one.</h3>
                             <p className="text-sm text-slate-500 mt-2">You can create parent categories (e.g., Utilities) and child categories (e.g., Gas, Electricity) for better organization.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoriesPage;
