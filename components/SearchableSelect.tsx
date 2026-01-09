
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDownIcon, SearchCircleIcon, CloseIcon, AddIcon } from './Icons';

interface Option {
    id: string;
    name: string;
    parentId?: string;
    level?: number;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    label?: string;
    onAddNew?: () => void;
    isHierarchical?: boolean;
    className?: string;
    compact?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
    options, value, onChange, placeholder = "Select option...", label, onAddNew, isHierarchical = false, className = "", compact = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = useMemo(() => options.find(o => o.id === value), [options, value]);

    const processedOptions = useMemo(() => {
        let result: Option[] = [];
        
        if (isHierarchical) {
            const buildTree = (parentId: string | undefined = undefined, level = 0) => {
                const levelItems = options
                    .filter(o => o.parentId === parentId)
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                levelItems.forEach(item => {
                    result.push({ ...item, level });
                    buildTree(item.id, level + 1);
                });
            };
            buildTree();

            // Handle orphans or items that might have invalid parentIds
            const handledIds = new Set(result.map(r => r.id));
            const orphans = options.filter(o => !handledIds.has(o.id));
            if (orphans.length > 0) {
                orphans.sort((a, b) => a.name.localeCompare(b.name)).forEach(o => {
                    result.push({ ...o, level: 0 });
                });
            }
        } else {
            result = [...options].sort((a, b) => a.name.localeCompare(b.name));
        }

        if (search) {
            const term = search.toLowerCase();
            return result.filter(o => o.name.toLowerCase().includes(term));
        }

        return result;
    }, [options, search, isHierarchical]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <div className="flex justify-between items-center mb-1 ml-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                    {onAddNew && (
                        <button 
                            type="button" 
                            onClick={onAddNew}
                            className="text-[9px] font-black text-indigo-500 uppercase hover:text-indigo-700 transition-colors"
                        >
                            + Add New
                        </button>
                    )}
                </div>
            )}
            
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-white border-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${compact ? 'p-1.5' : 'p-2.5'} ${isOpen ? 'border-indigo-500 shadow-lg ring-4 ring-indigo-50' : 'border-slate-100 hover:border-slate-300'}`}
            >
                <div className="flex-1 truncate">
                    {selectedOption ? (
                        <span className={`${compact ? 'text-[10px]' : 'text-sm'} font-bold text-slate-800`}>{selectedOption.name}</span>
                    ) : (
                        <span className={`${compact ? 'text-[10px]' : 'text-sm'} text-slate-400`}>{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-1.5">
                    {value && (
                        <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); onChange(''); }}
                            className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                        >
                            <CloseIcon className="w-3 h-3" />
                        </button>
                    )}
                    <ChevronDownIcon className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-80 min-w-[200px]">
                    <div className="p-3 border-b bg-slate-50 flex items-center gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-9 pr-4 py-2 bg-white border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                            />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                        {onAddNew && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsOpen(false); onAddNew(); }}
                                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex-shrink-0 flex items-center justify-center"
                                title="Create New"
                            >
                                <AddIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                        {processedOptions.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center gap-2">
                                <p className="text-slate-400 text-xs italic">No results found</p>
                                {onAddNew && (
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); onAddNew(); }}
                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                    >
                                        Create "{search}"?
                                    </button>
                                )}
                            </div>
                        ) : (
                            processedOptions.map(opt => (
                                <div 
                                    key={opt.id}
                                    onClick={(e) => { e.stopPropagation(); onChange(opt.id); setIsOpen(false); }}
                                    className={`px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all flex items-center gap-2 ${value === opt.id ? 'bg-indigo-50 text-indigo-900 shadow-inner' : 'text-slate-700 hover:bg-slate-50'}`}
                                    style={{ paddingLeft: opt.level ? `${opt.level * 16 + 12}px` : '12px' }}
                                >
                                    {isHierarchical && opt.level !== undefined && opt.level > 0 && (
                                        <span className="text-slate-300 mr-1 opacity-50">⌞</span>
                                    )}
                                    <span className="truncate">{opt.name}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
