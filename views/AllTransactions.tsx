
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Transaction, Account, TransactionType, ReconciliationRule, Payee, Category, User, Tag, SavedReport } from '../types';
import TransactionTable from '../components/TransactionTable';
import TransactionModal from './TransactionModal';
import { AddIcon, DeleteIcon, CloseIcon, SearchCircleIcon, SortIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, SparklesIcon, CheckCircleIcon } from '../components/Icons';
import { api } from '../services/apiService';
import { generateUUID } from '../utils';

const AllTransactions: React.FC<{
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  payees: Payee[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onDeleteTransactions: (transactionIds: string[]) => void;
  onSaveRule: (rule: ReconciliationRule) => void;
  onSaveCategory: (category: Category) => void;
  onSavePayee: (payee: Payee) => void;
  onSaveTag: (tag: Tag) => void;
  onAddTransactionType: (type: TransactionType) => void;
  onSaveReport: (report: SavedReport) => void;
}> = ({ accounts, categories, tags, transactionTypes, payees, users, onUpdateTransaction, onAddTransaction, onDeleteTransaction, onDeleteTransactions, onSaveRule, onSaveCategory, onSavePayee, onSaveTag, onAddTransactionType, onSaveReport }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('DESC');

  const fetchTransactions = useCallback(async () => {
      setIsLoading(true);
      try {
          const response = await api.getTransactions({
              limit,
              offset: page * limit,
              search: searchTerm,
              sortKey,
              sortDir
          });
          setTransactions(response.data);
          setTotalCount(response.total);
      } finally {
          setIsLoading(false);
      }
  }, [page, limit, searchTerm, sortKey, sortDir]);

  useEffect(() => {
      const handler = setTimeout(fetchTransactions, 300);
      return () => clearTimeout(handler);
  }, [fetchTransactions]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-700">Transactions</h2>
            <div className="relative group">
                <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500" />
                <input 
                    type="text" 
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                    className="pl-10 pr-4 py-1.5 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium shadow-md hover:bg-indigo-700 transition-all">
                <AddIcon className="w-4 h-4"/> Add Entry
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col relative">
          {isLoading && <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>}
          
          <div className="flex-1 overflow-auto">
            <TransactionTable 
                transactions={transactions} 
                accounts={accounts} 
                categories={categories}
                tags={tags}
                transactionTypes={transactionTypes}
                payees={payees}
                users={users}
                onUpdateTransaction={onUpdateTransaction} 
                onDeleteTransaction={onDeleteTransaction} 
            />
          </div>

          <div className="p-3 bg-slate-50 border-t flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold uppercase">Total Records: {totalCount}</span>
              <div className="flex items-center gap-4">
                  <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(0); }} className="text-xs border p-1 rounded">
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                  </select>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 border rounded disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4" /></button>
                      <span className="text-xs font-bold">Page {page + 1}</span>
                      <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= totalCount} className="p-1 border rounded disabled:opacity-30"><ChevronRightIcon className="w-4 h-4" /></button>
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
            payees={payees}
            users={users}
        />
      )}
    </div>
  );
};

export default AllTransactions;
