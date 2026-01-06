
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User, Tag } from '../types';
import { SortIcon, NotesIcon, DeleteIcon, LinkIcon, SparklesIcon, InfoIcon, ChevronRightIcon, ChevronLeftIcon, ChevronDownIcon, SplitIcon, DatabaseIcon, CloseIcon } from './Icons';

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  payees: Payee[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onCreateRule?: (transaction: Transaction) => void;
  showCheckboxes?: boolean;
  selectedTxIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onBulkSelection?: (ids: string[], selected: boolean) => void;
  deleteConfirmationMessage?: string;
  visibleColumns?: Set<string>;
  onManageLink?: (groupId: string) => void;
  onSplit?: (transaction: Transaction) => void;
}

type SortKey = keyof Transaction | 'payeeId' | 'categoryId' | 'accountId' | 'userId' | 'typeId' | '';
type SortDirection = 'asc' | 'desc';

// Group Item interface for rendering logic
interface GroupItem {
    type: 'group';
    id: string; // The linkGroupId
    primaryTx: Transaction;
    children: Transaction[];
    totalAmount: number;
}

interface SingleItem {
    type: 'single';
    tx: Transaction;
}

type DisplayItem = GroupItem | SingleItem;

const generateGroupColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        'text-red-500', 'text-orange-500', 'text-amber-600', 'text-yellow-600', 
        'text-lime-600', 'text-green-600', 'text-emerald-600', 'text-teal-600', 
        'text-cyan-600', 'text-sky-600', 'text-blue-600', 'text-indigo-600', 
        'text-violet-600', 'text-purple-600', 'text-fuchsia-600', 'text-pink-600', 
        'text-rose-600'
    ];
    return colors[Math.abs(hash) % colors.length];
};

const RawDataDrawer: React.FC<{ tx: Transaction | null; onClose: () => void; }> = ({ tx, onClose }) => {
    if (!tx) return null;
    const metadata = tx.metadata || {};
    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-slate-900 shadow-2xl flex flex-col h-full animate-slide-in-right">
                <div className="p-6 border-b border-white/10 bg-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <DatabaseIcon className="w-5 h-5 text-indigo-400" />
                            Raw Record Inspector
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">Transaction ID: {tx.id.substring(0, 8)}...</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4 mb-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Processed Summary</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500 block text-[10px] uppercase">Final Desc</span><span className="text-white font-bold">{tx.description}</span></div>
                            <div><span className="text-slate-500 block text-[10px] uppercase">Original Desc</span><span className="text-white font-mono text-xs">{tx.originalDescription || tx.description}</span></div>
                        </div>
                    </div>
                    {Object.entries(metadata).length > 0 ? (
                        Object.entries(metadata).map(([k, v]) => (
                            <div key={k} className="bg-white/5 border border-white/5 rounded-xl p-4">
                                <p className="text-[10px] font-black text-indigo-400 uppercase mb-1 tracking-wider">{k}</p>
                                <p className="text-sm text-slate-100 font-medium break-words leading-relaxed">{String(v) || <em className="text-slate-700 italic">empty</em>}</p>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center">
                            <InfoIcon className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">No additional metadata found for this record.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-800 border-t border-white/10">
                    <p className="text-[9px] text-slate-500 font-bold uppercase text-center leading-relaxed">This metadata represents the immutable state of the record during initial ledger ingestion.</p>
                </div>
            </div>
        </div>
    );
};

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  accounts, 
  categories,
  tags,
  transactionTypes,
  payees,
  users,
  onUpdateTransaction, 
  onDeleteTransaction,
  onCreateRule,
  showCheckboxes = false,
  selectedTxIds = new Set(),
  onToggleSelection = (_id) => {},
  onToggleSelectAll = () => {},
  onBulkSelection,
  deleteConfirmationMessage = 'Are you sure you want to delete this transaction? This action cannot be undone.',
  visibleColumns = new Set(['date', 'description', 'payee', 'category', 'tags', 'account', 'type', 'amount', 'actions']),
  onManageLink,
  onSplit
}) => {