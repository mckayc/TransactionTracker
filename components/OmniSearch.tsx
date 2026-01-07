
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Transaction, Category, Counterparty, View } from '../types';
import { SearchCircleIcon, CloseIcon, TableIcon, TagIcon, BoxIcon, ChevronRightIcon, SparklesIcon } from './Icons';

interface OmniSearchProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    categories: Category[];
    counterparties: Counterparty[];
    onNavigate: (view: View, params?: any) => void;
}

const OmniSearch: React.FC<OmniSearchProps> = ({ isOpen, onClose, transactions, categories, counterparties, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        
        const matches: any[] = [];

        // Pages/Views
        const views = [
            { id: 'dashboard', label: 'Dashboard', type: 'page' },
            { id: 'import', label: 'Import Ingestion', type: 'page' },
            { id: 'management', label: 'System Hub (Management)', type: 'page' },
            { id: 'rules', label: 'Rule Engine', type: 'page' },
            { id: 'tasks', label: 'Operations & Tasks', type: 'page' }
        ];
        views.filter(v => v.label.toLowerCase().includes(q)).forEach(v => matches.push({ ...v, icon: <SparklesIcon className="w-4 h-4" /> }));

        // Categories
        categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5).forEach(c => matches.push({ id: c.id, label: c.name, type: 'category', icon: <TagIcon className="w-4 h-4" /> }));

        // Counterparties
        counterparties.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5).forEach(p => matches.push({ id: p.id, label: p.name, type: 'counterparty', icon: <BoxIcon className="w-4 h-4" /> }));

        // Transactions (matching description)
        transactions.filter(t => t.description.toLowerCase().includes(q)).slice(0, 10).forEach(t => matches.push({ 
            id: t.id, 
            label: t.description, 
            sub: `${t.date} • $${t.amount.toFixed(2)}`,
            type: 'transaction', 
            icon: <TableIcon className="w-4 h-4" /> 
        }));

        return matches;
    }, [query, categories, counterparties, transactions]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => (i + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => (i - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            e.preventDefault();
            handleSelect(results[selectedIndex]);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleSelect = (result: any) => {
        if (result.type === 'page') {
            onNavigate(result.id as View);
        } else if (result.type === 'transaction') {
            onNavigate('transactions', { highlightId: result.id });
        } else {
            onNavigate('management', { entityType: result.type + 's', id: result.id });
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-start justify-center pt-24 px-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="relative border-b-2 border-slate-50">
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={query} 
                        onChange={e => setQuery(e.target.value)} 
                        onKeyDown={handleKeyDown}
                        placeholder="Search anything... (Try 'Amazon', 'Rent', or 'Import')"
                        className="w-full p-6 pl-14 text-xl font-bold bg-white border-none focus:ring-0 placeholder:text-slate-300 text-slate-800"
                    />
                    <SearchCircleIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-indigo-500" />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded uppercase">ESC to close</span>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar bg-slate-50/30">
                    {results.length === 0 && query && (
                        <div className="p-12 text-center text-slate-400">
                            <p className="text-sm font-bold italic">No matches found in your ledger.</p>
                        </div>
                    )}
                    
                    {!query && (
                        <div className="p-8 text-center">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Quick Navigation</p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'dashboard', label: 'Dashboard' },
                                    { id: 'transactions', label: 'Ledger' },
                                    { id: 'management', label: 'Identity Hub' },
                                    { id: 'settings', label: 'System Setup' }
                                ].map(p => (
                                    <button key={p.id} onClick={() => onNavigate(p.id as View)} className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all font-bold text-slate-600 text-sm">
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        {results.map((r, i) => (
                            <div 
                                key={i}
                                onClick={() => handleSelect(r)}
                                className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${selectedIndex === i ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'hover:bg-indigo-50 text-slate-700'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${selectedIndex === i ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{r.icon}</div>
                                    <div>
                                        <p className="text-sm font-black">{r.label}</p>
                                        {r.sub && <p className={`text-[10px] uppercase font-bold ${selectedIndex === i ? 'text-indigo-200' : 'text-slate-400'}`}>{r.sub}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${selectedIndex === i ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>{r.type}</span>
                                    <ChevronRightIcon className={`w-4 h-4 ${selectedIndex === i ? 'text-white' : 'text-slate-200'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="p-3 bg-slate-50 border-t flex justify-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Omni-Link V2.0</p>
                </div>
            </div>
        </div>
    );
};

export default OmniSearch;
