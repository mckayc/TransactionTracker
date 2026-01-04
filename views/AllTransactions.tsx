import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Transaction, Account, TransactionType, Payee, Category, User, Tag, SavedReport } from '../types';
import TransactionTable from '../components/TransactionTable';
import { AddIcon, SearchCircleIcon, ChevronLeftIcon, ChevronRightIcon, RepeatIcon } from '../components/Icons';
import { api } from '../services/apiService';

interface AllTransactionsProps {
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactionTypes: TransactionType[];
  payees: Payee[];
  users: User[];
  onUpdateTransaction: (transaction: Transaction) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
}

const AllTransactions: React.FC<AllTransactionsProps> = ({ accounts, categories, tags, transactionTypes, payees, users, onUpdateTransaction, onAddTransaction, onDeleteTransaction }) => {
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getTransactions({ 
        limit, 
        offset: page * limit, 
        search 
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error("Fetch error", e);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    const timer = setTimeout(fetchPage, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  const handleUpdate = async (tx: Transaction) => {
    await api.saveTransaction(tx);
    onUpdateTransaction(tx); // Update local parent state if needed
    fetchPage();
  };

  const handleDelete = async (id: string) => {
    await api.deleteTransaction(id);
    onDeleteTransaction(id);
    fetchPage();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-full max-w-md">
            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search history..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-10"
            />
          </div>
          {isLoading && <RepeatIcon className="w-5 h-5 text-indigo-600 animate-spin" />}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-500 font-medium">
            {total.toLocaleString()} records found
          </div>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            <AddIcon className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto relative">
           <TransactionTable 
            transactions={items} 
            accounts={accounts} 
            categories={categories} 
            tags={tags} 
            transactionTypes={transactionTypes} 
            payees={payees} 
            users={users}
            onUpdateTransaction={handleUpdate}
            onDeleteTransaction={handleDelete}
          />
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)}
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 0} 
              onClick={() => setPage(p => p - 1)}
              className="p-2 border rounded hover:bg-white disabled:opacity-30"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold px-4">Page {page + 1} of {totalPages || 1}</span>
            <button 
              disabled={page >= totalPages - 1} 
              onClick={() => setPage(p => p + 1)}
              className="p-2 border rounded hover:bg-white disabled:opacity-30"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllTransactions;
