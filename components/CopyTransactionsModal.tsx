
import React, { useState, useMemo } from 'react';
import type { Transaction, Category, Counterparty, Account, TransactionType, Tag } from '../types';
import { CloseIcon, CopyIcon, CheckCircleIcon, TableIcon, ListIcon } from './Icons';

interface CopyTransactionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTransactions: Transaction[];
    categories: Category[];
    counterparties: Counterparty[];
    accounts: Account[];
    transactionTypes: TransactionType[];
    tags: Tag[];
    onSuccess: (count: number) => void;
}

interface ColumnOption {
    id: string;
    label: string;
    getValue: (tx: Transaction) => string;
}

const CopyTransactionsModal: React.FC<CopyTransactionsModalProps> = ({ 
    isOpen, onClose, selectedTransactions, categories, counterparties, accounts, transactionTypes, tags, onSuccess 
}) => {
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    const counterpartyMap = useMemo(() => new Map(counterparties.map(p => [p.id, p.name])), [counterparties]);
    const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
    const typeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t.name])), [transactionTypes]);
    const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t.name])), [tags]);

    const COLUMN_OPTIONS: ColumnOption[] = [
        { id: 'date', label: 'Date', getValue: (tx) => tx.date },
        { id: 'description', label: 'Description', getValue: (tx) => tx.description },
        { id: 'original_description', label: 'Original Description', getValue: (tx) => tx.originalDescription || tx.description },
        { id: 'entity', label: 'Entity/Payee', getValue: (tx) => counterpartyMap.get(tx.counterpartyId || '') || '' },
        { id: 'category', label: 'Category', getValue: (tx) => categoryMap.get(tx.categoryId) || '' },
        { id: 'account', label: 'Account', getValue: (tx) => accountMap.get(tx.accountId) || '' },
        { id: 'type', label: 'Transaction Type', getValue: (tx) => typeMap.get(tx.typeId) || '' },
        { id: 'amount', label: 'Amount', getValue: (tx) => tx.amount.toFixed(2) },
        { id: 'tags', label: 'Tags', getValue: (tx) => (tx.tagIds || []).map(id => tagMap.get(id)).filter(Boolean).join(', ') },
        { id: 'notes', label: 'Notes', getValue: (tx) => tx.notes || '' },
    ];

    const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set(['date', 'entity', 'category', 'amount']));

    if (!isOpen) return null;

    const toggleColumn = (id: string) => {
        const next = new Set(selectedCols);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedCols(next);
    };

    const handleCopy = async () => {
        const activeCols = COLUMN_OPTIONS.filter(opt => selectedCols.has(opt.id));
        
        // Generate TSV Header
        const header = activeCols.map(c => c.label).join('\t');
        
        // Generate TSV Rows
        const rows = selectedTransactions.map(tx => 
            activeCols.map(col => {
                const val = col.getValue(tx);
                // Basic cleanup for spreadsheet compatibility (removing existing tabs or newlines within cells)
                return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
            }).join('\t')
        );

        const clipboardText = [header, ...rows].join('\n');

        try {
            await navigator.clipboard.writeText(clipboardText);
            onSuccess(selectedTransactions.length);
            onClose();
        } catch (err) {
            alert("Clipboard access failed. Check browser permissions.");
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                            <CopyIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Smart Copy</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Exporting {selectedTransactions.length} records to clipboard</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                </div>

                <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <ListIcon className="w-3 h-3" /> Select Columns to Include
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {COLUMN_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => toggleColumn(opt.id)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${selectedCols.has(opt.id) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                >
                                    <span className={`text-xs font-bold ${selectedCols.has(opt.id) ? 'text-indigo-900' : 'text-slate-500'}`}>{opt.label}</span>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${selectedCols.has(opt.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 group-hover:border-slate-300'}`}>
                                        {selectedCols.has(opt.id) && <CheckCircleIcon className="w-3 h-3" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <TableIcon className="w-3.5 h-3.5 text-indigo-400" /> Clipboard Preview
                        </h4>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner max-h-32 overflow-hidden relative">
                            <pre className="text-[9px] font-mono text-slate-500 whitespace-pre leading-relaxed">
                                {COLUMN_OPTIONS.filter(opt => selectedCols.has(opt.id)).map(c => c.label).join('\t')}{'\n'}
                                {selectedTransactions.slice(0, 2).map(tx => 
                                    COLUMN_OPTIONS.filter(opt => selectedCols.has(opt.id)).map(col => col.getValue(tx)).join('\t')
                                ).join('\n')}
                                {selectedTransactions.length > 2 && '\n...'}
                            </pre>
                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white pointer-events-none" />
                        </div>
                        <p className="text-[9px] text-slate-400 italic">Data is formatted as tab-separated values, perfect for pasting into Excel or Google Sheets.</p>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-8 py-3 text-xs font-black uppercase text-slate-500 hover:bg-white rounded-xl transition-all">Cancel</button>
                    <button 
                        onClick={handleCopy}
                        disabled={selectedCols.size === 0}
                        className="px-12 py-3 bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30"
                    >
                        <CopyIcon className="w-4 h-4" /> Copy to Clipboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CopyTransactionsModal;
