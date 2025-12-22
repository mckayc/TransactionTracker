import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, User, Tag, SavedReport } from '../types';
import TransactionTable from '../components/TransactionTable';
import TransactionModal from './TransactionModal';
import RuleModal from '../components/RuleModal';
import { AddIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, RobotIcon, ShieldCheckIcon } from '../components/Icons';
import { api } from '../services/apiService';
import MultiSelect from '../components/MultiSelect';

interface AllTransactionsProps {
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  payees: Payee[];
  users: User[];
  onSaveReport: (report: SavedReport) => void;
}

const AllTransactions: React.FC<AllTransactionsProps> = ({ accounts, categories, tags, transactionTypes, payees, users, onSaveReport }) => {
  // --- Server-Side Data State ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- Query Params State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortKey, setSortKey] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  // Date Cursor (Legacy format preserved)
  const [dateCursor, setDateCursor] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d;
  });
  
  const dateRange = useMemo(() => {
    const firstDay = new Date(dateCursor.getFullYear(), dateCursor.getMonth(), 1);
    const lastDay = new Date(dateCursor.getFullYear(), dateCursor.getMonth() + 1, 0);
    return { start: firstDay.toISOString().split('T')[0], end: lastDay.toISOString().split('T')[0] };
  }, [dateCursor]);

  // Fetch logic
  const fetchPage = useCallback(async () => {
    setIsLoading(true);
    try {
        const { data, total } = await api.getTransactions({
            limit,
            offset: (currentPage - 1) * limit,
            search: searchTerm,
            startDate: dateRange.start,
            endDate: dateRange.end,
            sort: sortKey,
            order: sortOrder,
            categoryIds: Array.from(selectedCategories),
            typeIds: Array.from(selectedTypes),
            accountIds: Array.from(selectedAccounts)
        });
        setTransactions(data);
        setTotalCount(total);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, [limit, currentPage, searchTerm, dateRange, sortKey, sortOrder, selectedCategories, selectedTypes, selectedAccounts]);

  useEffect(() => {
    const timer = setTimeout(fetchPage, 300); // Debounce search/filter changes
    return () => clearTimeout(timer);
  }, [fetchPage]);

  // Handlers
  const handleUpdateTransaction = async (updated: Transaction) => {
      await api.saveTransactions([updated]);
      fetchPage();
  };

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
      await api.saveTransactions([{ ...newTx, id: crypto.randomUUID() }]);
      fetchPage();
  };

  const handleDeleteTransaction = async (id: string) => {
      if(confirm("Delete this transaction?")) {
          await api.deleteTransactions([id]);
          fetchPage();
      }
  };

  const navigateMonth = (dir: 'next' | 'prev') => {
      const d = new Date(dateCursor);
      d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
      setDateCursor(d);
      setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-3">
        <input 
            type="text" 
            placeholder="Search millions of rows..." 
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full md:w-64"
        />
        <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden border">
            <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-200"><ChevronLeftIcon className="w-4 h-4"/></button>
            <span className="px-4 text-sm font-bold min-w-[140px] text-center">{dateCursor.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-200"><ChevronRightIcon className="w-4 h-4"/></button>
        </div>
        
        <div className="flex-grow flex gap-2">
            <MultiSelect label="Categories" options={categories} selectedIds={selectedCategories} onChange={setSelectedCategories} className="w-40" />
            <MultiSelect label="Accounts" options={accounts} selectedIds={selectedAccounts} onChange={setSelectedAccounts} className="w-40" />
        </div>

        <button onClick={() => setTransactions([])} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700">
            <AddIcon className="w-4 h-4 inline mr-2" /> Add
        </button>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
        {isLoading && <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center font-bold text-indigo-600">Querying SQLite...</div>}
        
        <div className="flex-1 overflow-auto">
            <TransactionTable 
                transactions={transactions} 
                accounts={accounts} 
                categories={categories} 
                tags={tags} 
                transactionTypes={transactionTypes} 
                payees={payees} 
                users={users} 
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
            />
        </div>

        {/* Server-Side Pagination Controls */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
            <div className="text-sm text-slate-500">
                Found <strong>{totalCount.toLocaleString()}</strong> transactions total. 
                Showing {Math.min(totalCount, (currentPage - 1) * limit + 1)} to {Math.min(totalCount, currentPage * limit)}.
            </div>
            <div className="flex items-center gap-2">
                <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded border bg-white disabled:opacity-30"
                >
                    <ChevronLeftIcon className="w-5 h-5"/>
                </button>
                <span className="text-sm font-bold">Page {currentPage}</span>
                <button 
                    disabled={currentPage * limit >= totalCount} 
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 rounded border bg-white disabled:opacity-30"
                >
                    <ChevronRightIcon className="w-5 h-5"/>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AllTransactions;