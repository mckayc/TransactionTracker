
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from './Icons';

interface Option {
    id: string;
    name: string;
}

interface MultiSelectProps {
    label: string;
    options: Option[];
    selectedIds: Set<string>;
    onChange: (selectedIds: Set<string>) => void;
    className?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selectedIds, onChange, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        onChange(newSet);
    };

    const handleClear = () => {
        onChange(new Set());
    };

    const handleSelectAll = () => {
        const allIds = new Set(options.map(o => o.id));
        onChange(allIds);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white border rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${selectedIds.size > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-700'}`}
            >
                <span className="truncate">
                    {selectedIds.size === 0 ? label : `${label}: ${selectedIds.size} Selected`}
                </span>
                <ChevronDownIcon className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full min-w-[200px] mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
                        <span className="text-xs font-bold text-slate-500 uppercase">Select Options</span>
                        <div className="flex gap-2">
                            <button onClick={handleSelectAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">All</button>
                            <button onClick={handleClear} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Clear</button>
                        </div>
                    </div>
                    <div className="p-1">
                        {options.map(option => (
                            <label key={option.id} className="flex items-center px-2 py-2 hover:bg-slate-100 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    checked={selectedIds.has(option.id)}
                                    onChange={() => toggleSelection(option.id)}
                                />
                                <span className="ml-2 text-sm text-slate-700 truncate" title={option.name}>{option.name}</span>
                            </label>
                        ))}
                        {options.length === 0 && <p className="text-xs text-slate-400 p-2 text-center">No options available.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
