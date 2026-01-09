
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Counterparty, Category, User, Tag, SavedReport, DateRangePreset, BalanceEffect } from '../types';
import TransactionTable from '../components/TransactionTable';
import TransactionModal from './TransactionModal';
import BulkEditModal from '../components/BulkEditModal';
// Added TrashIcon to the imports from components/Icons
import { AddIcon, DeleteIcon, CloseIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, SparklesIcon, CheckCircleIcon, CalendarIcon, TrendingUpIcon, ListIcon, TagIcon, WrenchIcon, TrashIcon } from '../components/Icons';
import { api } from '../services/apiService';
import { generateUUID } from '../utils';
import { calculateDateRange, formatDate } from '../dateUtils';

const MetricPill: React.FC<{ label: string, value: number, color: string, icon: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
            {icon}
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className={`text-sm font-black ${color}`}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(value))}
            </p>
        </div>
    </div>
);

const AllTransactions: React.FC<{
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  counterparties: Counterparty[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onDeleteTransactions: (transactionIds: string[]) => void;
  onSaveRule: (rule: ReconciliationRule) => void;
  onSaveCategory: (category: Category) => void;
  onSaveCounterparty: (p: Counterparty) => void;
  onSaveTag: (tag: Tag) => void;
  onAddTransactionType: (type: TransactionType) => void;
  onSaveReport: (report: SavedReport) => void;
}> = ({ accounts, categories, tags, transactionTypes, counterparties, users, onUpdateTransaction, onAddTransaction, onDeleteTransaction, onDeleteTransactions, onSaveRule, onSaveCategory, onSaveCounterparty, onSaveTag, onAddTransactionType, onSaveReport }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<DateRangePreset | string>('allTime');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Pagination & Sorting State
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('DESC');

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditType, setBulkEditType] = useState<'categoryId' | 'date' | null>(null);

  const fetchTransactions = useCallback(async () => {
      setIsLoading(true);
      try {
          const { start, end } = calculateDateRange(datePreset, customStart, customEnd, []);
          const params: any = {
              limit,
              offset: page * limit,
              search: searchTerm,
              sortKey,
              sortDir
          };
          
          if (datePreset !== 'allTime') {
              params.startDate = formatDate(start);
              params.endDate = formatDate(end);
          }

          const response = await api.getTransactions(params);
          setTransactions(response.data);
          setTotalCount(response.total);
      } finally {
          setIsLoading(false);
      }
  }, [page, limit, searchTerm, sortKey, sortDir, datePreset, customStart, customEnd]);

  useEffect(() => {
      const handler = setTimeout(fetchTransactions, 300);
      return () => clearTimeout(handler);
  }, [fetchTransactions]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const metrics = useMemo(() => {
      let inflow = 0;
      let outflow = 0;
      let investments = 0;
      
      transactions.forEach(tx => {
          if (tx.isParent) return;
          const type = transactionTypes.find(t => t.id === tx.typeId);
          if (type?.balanceEffect === 'incoming') inflow += tx.amount;
          if (type?.balanceEffect === 'outgoing') outflow += tx.amount;
          if (type?.id.includes('investment')) investments += tx.amount;
      });

      return { inflow, outflow, net: inflow - outflow, investments };
  }, [transactions, transactionTypes]);

  const handleBulkDelete = () => {
      if (window.confirm(`Permanently delete ${selectedIds.size} selected transactions?`)) {
          onDeleteTransactions(Array.from(selectedIds));
          setSelectedIds(new Set());
      }
  };

  const handleBulkUpdate = async (field: string, value: any) => {
      const updates = transactions
          .filter(tx => selectedIds.has(tx.id))
          .map(tx => ({ ...tx, [field]: value }));
      
      await api.saveTransactions(updates);
      setSelectedIds(new Set());
      fetchTransactions();
      setBulkEditType(null);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Metrics Row */}
      <div className="flex flex-wrap gap-3 flex-shrink-0 animate-fade-in">
          <MetricPill label="Net Cash Flow" value={metrics.net} color={metrics.net >= 0 ? 'text-indigo-600' : 'text-rose-600'} icon={<TrendingUpIcon className="w-4 h-4" />} />
          <MetricPill label="Total Inflow" value={metrics.inflow} color="text-emerald-600" icon={<AddIcon className="w-4 h-4" />} />
          <MetricPill label="Total Outflow" value={metrics.outflow} color="text-rose-600" icon={<DeleteIcon className="w-4 h-4" />} />
          <MetricPill label="Investments" value={metrics.investments} color="text-purple-600" icon={<SparklesIcon className="w-4 h-4" />} />
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex flex-1 items-center gap-4 w-full">
            <div className="relative group flex-1 max-w-md">
                <input 
                    type="text" 
                    placeholder="Search descriptions, notes..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                    className="block w-full px-4 py-2 border rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 border-slate-200 bg-slate-50/50 group-hover:bg-white transition-all outline-none font-medium"
                />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                <CalendarIcon className="w-4 h-4 text-slate-400 ml-2" />
                <select 
                    value={datePreset} 
                    onChange={e => setDatePreset(e.target.value)}
                    className="border-none bg-transparent text-xs font-black text-slate-600 uppercase tracking-tighter focus:ring-0 cursor-pointer"
                >
                    <option value="allTime">All History</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="last30Days">Last 30 Days</option>
                    <option value="thisYear">This Year</option>
                    <option value="custom">Custom Range...</option>
                </select>
                {datePreset === 'custom' && (
                    <div className="flex items-center gap-1 pr-2 animate-fade-in">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-[10px] p-1 border-none bg-white rounded-lg focus:ring-0" />
                        <span className="text-slate-300 text-[10px]">to</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-[10px] p-1 border-none bg-white rounded-lg focus:ring-0" />
                    </div>
                )}
            </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-900 text-white p-1 rounded-2xl shadow-xl animate-slide-up">
                    <span className="px-3 text-[10px] font-black uppercase tracking-widest">{selectedIds.size} Selected</span>
                    <button onClick={() => setBulkEditType('categoryId')} className="p-2 hover:bg-white/10 rounded-xl text-indigo-400" title="Mass Change Category"><TagIcon className="w-4 h-4"/></button>
                    <button onClick={() => setBulkEditType('date')} className="p-2 hover:bg-white/10 rounded-xl text-amber-400" title="Shift Dates"><CalendarIcon className="w-4 h-4"/></button>
                    <button onClick={handleBulkDelete} className="p-2 hover:bg-white/10 rounded-xl text-rose-400" title="Purge Selection"><TrashIcon className="w-4 h-4"/></button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-500 hover:text-white"><CloseIcon className="w-4 h-4"/></button>
                </div>
            )}
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap">
                <AddIcon className="w-4 h-4"/> Add Entry
            </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col relative">
          {isLoading && <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px] z-20 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>}
          
          <div className="flex-1 overflow-auto">
            <TransactionTable 
                transactions={transactions} 
                accounts={accounts} 
                categories={categories}
                tags={tags}
                transactionTypes={transactionTypes}
                counterparties={counterparties}
                users={users}
                onUpdateTransaction={onUpdateTransaction} 
                onDeleteTransaction={onDeleteTransaction} 
                showCheckboxes={true}
                selectedTxIds={selectedIds}
                onToggleSelection={(id) => {
                    const next = new Set(selectedIds);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedIds(next);
                }}
                onToggleSelectAll={() => {
                    if (selectedIds.size === transactions.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(transactions.map(t => t.id)));
                }}
            />
          </div>

          <div className="p-3 bg-slate-50 border-t flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Page {page + 1} of {Math.ceil(totalCount / limit)}</span>
                  <div className="h-4 w-px bg-slate-200" />
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Registry: {totalCount}</span>
              </div>
              <div className="flex items-center gap-4">
                  <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(0); }} className="text-[10px] font-black uppercase tracking-tighter border border-slate-200 p-1.5 rounded-xl bg-white text-slate-700">
                      <option value={25}>25 per screen</option>
                      <option value={50}>50 per screen</option>
                      <option value={100}>100 per screen</option>
                  </select>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 border rounded-xl bg-white shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"><ChevronLeftIcon className="w-4 h-4 text-slate-600" /></button>
                      <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= totalCount} className="p-2 border rounded-xl bg-white shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"><ChevronRightIcon className="w-4 h-4 text-slate-600" /></button>
                  </div>
              </div>
          </div>
      </div>

      {isModalOpen && (
        <TransactionModal
            isOpen={isModalOpen}
            transaction={null}
            onClose={() => setIsModalOpen(false)}
            onSave={(tx) => { onAddTransaction({ ...tx, id: generateUUID() } as any); setIsModalOpen(false); }}
            accounts={accounts}
            categories={categories}
            tags={tags}
            transactionTypes={transactionTypes}
            counterparties={counterparties}
            users={users}
            onSaveCounterparty={onSaveCounterparty}
            onSaveCategory={onSaveCategory}
        />
      )}

      {bulkEditType && (
          <BulkEditModal 
            type={bulkEditType}
            isOpen={!!bulkEditType}
            onClose={() => setBulkEditType(null)}
            onConfirm={(val) => handleBulkUpdate(bulkEditType, val)}
            categories={categories}
          />
      )}
    </div>
  );
};

export default AllTransactions;
