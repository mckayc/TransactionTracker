
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Counterparty, Category, User, Tag, SavedReport, DateRangePreset } from '../types';
import TransactionTable from '../components/TransactionTable';
import TransactionModal from './TransactionModal';
import BulkEditModal from '../components/BulkEditModal';
import { AddIcon, DeleteIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon, CalendarIcon, TrendingUpIcon, TagIcon, TrashIcon, InfoIcon } from '../components/Icons';
import { api } from '../services/apiService';
import { generateUUID } from '../utils';
import { calculateDateRange, formatDate, shiftDateRange } from '../dateUtils';
import { MetricPill } from '../components/FinancialStats';

const MetricBreakdownModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: { label: string; amount: number; percentage: number }[];
    colorClass: string;
    total: number;
    isLoading: boolean;
}> = ({ isOpen, onClose, title, items, colorClass, total, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800">{title} Analysis</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Top 15 Grouped Entities</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar relative">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Scanning Full Range...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-12 text-center text-slate-300 italic">No activity found.</div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={idx} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[10px] font-mono text-slate-300 w-4">{idx + 1}</span>
                                            <span className="text-slate-700 truncate" title={item.label}>{item.label}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-4">
                                            <span className={`text-sm font-black font-mono ${colorClass}`}>${item.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`} 
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-5 bg-slate-50 border-t flex flex-col items-center gap-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period Total</p>
                    <p className={`text-2xl font-black ${colorClass}`}>${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
            </div>
        </div>
    );
};

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
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [rangeSummary, setRangeSummary] = useState({ incoming: 0, outgoing: 0, neutral: 0, investments: 0 });
  const [activeMetricBreakdown, setActiveMetricBreakdown] = useState<'inflow' | 'outflow' | 'investments' | null>(null);
  const [breakdownData, setBreakdownData] = useState<{items: any[], total: number}>({ items: [], total: 0 });
  const [isBreakdownLoading, setIsBreakdownLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<DateRangePreset | string>('thisMonth');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(100);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('DESC');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditType, setBulkEditType] = useState<'categoryId' | 'date' | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { start, end, label } = useMemo(() => calculateDateRange(datePreset, customStart, customEnd, []), [datePreset, customStart, customEnd]);

  const fetchTransactions = useCallback(async () => {
      setIsLoading(true); setIsSummaryLoading(true);
      try {
          const params: any = { limit, offset: page * limit, search: searchTerm, sortKey, sortDir };
          if (datePreset !== 'allTime') { params.startDate = formatDate(start); params.endDate = formatDate(end); }
          const [txResponse, summaryResponse] = await Promise.all([api.getTransactions(params), api.getSummary(params)]);
          setTransactions(txResponse.data); setTotalCount(txResponse.total); setRangeSummary(summaryResponse as any);
      } finally { setIsLoading(false); setIsSummaryLoading(false); }
  }, [page, limit, searchTerm, sortKey, sortDir, datePreset, start, end]);

  useEffect(() => { const handler = setTimeout(fetchTransactions, 300); return () => clearTimeout(handler); }, [fetchTransactions]);

  useEffect(() => {
      const fetchBreakdown = async () => {
          if (!activeMetricBreakdown) return;
          setIsBreakdownLoading(true);
          try {
              const params: any = { type: activeMetricBreakdown, search: searchTerm };
              if (datePreset !== 'allTime') { params.startDate = formatDate(start); params.endDate = formatDate(end); }
              setBreakdownData(await api.getBreakdown(params));
          } finally { setIsBreakdownLoading(false); }
      };
      fetchBreakdown();
  }, [activeMetricBreakdown, start, end, datePreset, searchTerm]);

  const handleBulkDelete = () => { if (window.confirm(`Permanently delete ${selectedIds.size} selected transactions?`)) { onDeleteTransactions(Array.from(selectedIds)); setSelectedIds(new Set()); } };

  const handleBulkUpdate = async (field: string, value: any) => {
      const updates = transactions.filter(tx => selectedIds.has(tx.id)).map(tx => ({ ...tx, [field]: value }));
      await api.saveTransactions(updates); setSelectedIds(new Set()); fetchTransactions(); setBulkEditType(null);
  };

  const handleDateShift = (direction: 'prev' | 'next') => {
      const nextRange = shiftDateRange(start, end, direction);
      setCustomStart(formatDate(nextRange.start)); setCustomEnd(formatDate(nextRange.end)); setDatePreset('custom'); setPage(0);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap gap-3 flex-shrink-0 animate-fade-in">
          <MetricPill label="Net Cash Flow" value={rangeSummary.incoming - rangeSummary.outgoing} color={(rangeSummary.incoming - rangeSummary.outgoing) >= 0 ? 'text-indigo-600' : 'text-rose-600'} icon={<TrendingUpIcon className="w-4 h-4" />} isLoading={isSummaryLoading} />
          <MetricPill label="Total Inflow" value={rangeSummary.incoming} color="text-emerald-600" icon={<AddIcon className="w-4 h-4" />} isLoading={isSummaryLoading} onClick={() => setActiveMetricBreakdown('inflow')} />
          <MetricPill label="Total Outflow" value={rangeSummary.outgoing} color="text-rose-600" icon={<DeleteIcon className="w-4 h-4" />} isLoading={isSummaryLoading} onClick={() => setActiveMetricBreakdown('outflow')} />
          <MetricPill label="Investments" value={rangeSummary.investments} color="text-purple-600" icon={<SparklesIcon className="w-4 h-4" />} isLoading={isSummaryLoading} onClick={() => setActiveMetricBreakdown('investments')} />
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex flex-1 items-center gap-4 w-full">
            <div className="relative group flex-1 max-w-md">
                <input type="text" placeholder="Filter ledger..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }} className="w-full px-4 py-2 border rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 border-slate-200 bg-slate-50/50" />
            </div>
            
            <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-lg">
                <button onClick={() => handleDateShift('prev')} className="p-1.5 text-slate-400 hover:text-white"><ChevronLeftIcon className="w-5 h-5" /></button>
                <div className="relative flex items-center gap-2 px-3 border-x border-white/5">
                    <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <select value={datePreset} onChange={e => { setDatePreset(e.target.value); setPage(0); }} className="bg-transparent text-white font-black text-[10px] uppercase outline-none cursor-pointer">
                        <option value="allTime">All History</option>
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="last30Days">Last 30 Days</option>
                        <option value="thisYear">This Year</option>
                        <option value="lastYear">Last Year</option>
                        <option value="custom">Manual...</option>
                    </select>
                </div>
                <button onClick={() => handleDateShift('next')} className="p-1.5 text-slate-400 hover:text-white"><ChevronRightIcon className="w-5 h-5" /></button>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-900 text-white p-1 rounded-2xl shadow-xl animate-slide-up">
                    <span className="px-3 text-[10px] font-black uppercase">{selectedIds.size} Selected</span>
                    <button onClick={() => setBulkEditType('categoryId')} className="p-2 hover:bg-white/10 rounded-xl text-indigo-400"><TagIcon className="w-4 h-4"/></button>
                    <button onClick={() => setBulkEditType('date')} className="p-2 hover:bg-white/10 rounded-xl text-amber-400"><CalendarIcon className="w-4 h-4"/></button>
                    <button onClick={handleBulkDelete} className="p-2 hover:bg-white/10 rounded-xl text-rose-400"><TrashIcon className="w-4 h-4"/></button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-500 hover:text-white"><CloseIcon className="w-4 h-4"/></button>
                </div>
            )}
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap">
                <AddIcon className="w-4 h-4"/> Add Entry
            </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col relative">
          {isLoading && <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px] z-20 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>}
          <div className="flex-1 overflow-auto">
            <TransactionTable transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users} onUpdateTransaction={onUpdateTransaction} onDeleteTransaction={onDeleteTransaction} showCheckboxes={true} selectedTxIds={selectedIds} onToggleSelection={(id) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); }} onToggleSelectAll={() => { if (selectedIds.size === transactions.length) setSelectedIds(new Set()); else setSelectedIds(new Set(transactions.map(t => t.id))); }} />
          </div>

          <div className="p-3 bg-slate-50 border-t flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase">Page {page + 1} of {Math.ceil(totalCount / limit) || 1} • Registry: {totalCount}</span>
              <div className="flex items-center gap-4">
                  <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(0); }} className="text-[10px] font-black uppercase border p-1.5 rounded-xl bg-white">
                      <option value={100}>100 rows</option>
                      <option value={200}>200 rows</option>
                      <option value={500}>500 rows</option>
                  </select>
                  <div className="flex gap-2">
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 border rounded-xl bg-white disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4" /></button>
                      <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= totalCount} className="p-2 border rounded-xl bg-white disabled:opacity-30"><ChevronRightIcon className="w-4 h-4" /></button>
                  </div>
              </div>
          </div>
      </div>

      <TransactionModal isOpen={isModalOpen} transaction={null} onClose={() => setIsModalOpen(false)} onSave={(tx) => { onAddTransaction({ ...tx, id: generateUUID() } as any); setIsModalOpen(false); }} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users} onSaveCounterparty={onSaveCounterparty} onSaveCategory={onSaveCategory} />
      {bulkEditType && <BulkEditModal type={bulkEditType} isOpen={!!bulkEditType} onClose={() => setBulkEditType(null)} onConfirm={(val) => handleBulkUpdate(bulkEditType, val)} categories={categories} />}
      <MetricBreakdownModal isOpen={!!activeMetricBreakdown} onClose={() => setActiveMetricBreakdown(null)} title={activeMetricBreakdown === 'inflow' ? 'Total Inflow' : activeMetricBreakdown === 'outflow' ? 'Total Outflow' : 'Investments'} items={breakdownData.items} total={breakdownData.total} isLoading={isBreakdownLoading} colorClass={activeMetricBreakdown === 'inflow' ? 'text-emerald-600' : activeMetricBreakdown === 'outflow' ? 'text-rose-600' : 'text-purple-600'} />
    </div>
  );
};

export default AllTransactions;
