
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, Template, ScheduledEvent, TaskCompletions, TransactionType, Account, Category, Counterparty, User, TaskItem, Tag } from '../types';
import ScheduleEventModal from '../components/ScheduleEventModal';
import TransactionModal from './TransactionModal';
import TaskModal from './TaskModal';
import { CheckCircleIcon, ChecklistIcon, RepeatIcon, LinkIcon, UsersIcon, ExternalLinkIcon, HeartIcon, ChevronLeftIcon, ChevronRightIcon, AddIcon, CalendarIcon, CloseIcon, TableIcon, TasksIcon } from '../components/Icons';
import { formatDate, parseISOLocal } from '../dateUtils';

// Define the missing ViewMode type
type ViewMode = 'month' | 'week' | 'day';

interface CalendarPageProps {
  transactions: Transaction[];
  templates: Template[];
  scheduledEvents: ScheduledEvent[];
  tasks: TaskItem[];
  taskCompletions: TaskCompletions;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  counterparties: Counterparty[];
  users: User[];
  onAddEvent: (event: ScheduledEvent) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onToggleTaskCompletion: (date: string, eventId: string, taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onSaveTask?: (task: TaskItem) => void;
  transactionTypes: TransactionType[];
  initialTaskId?: string;
}

const SummaryWidget: React.FC<{title: string, value: string, helpText: string, colorClass?: string, isFocus?: boolean}> = ({title, value, helpText, colorClass = "text-slate-800", isFocus}) => (
    <div className={`bg-white p-3 rounded-xl shadow-sm border transition-all duration-300 ${isFocus ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}>
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
        <p className={`text-xl font-bold mt-0.5 ${colorClass}`}>{value}</p>
        <p className={`text-[9px] font-medium mt-0.5 truncate ${isFocus ? 'text-indigo-600' : 'text-slate-400'}`}>{helpText}</p>
    </div>
);

const CalendarPage: React.FC<CalendarPageProps> = ({ transactions, templates, scheduledEvents, tasks, taskCompletions, onAddEvent, onToggleTaskCompletion, onToggleTask, onSaveTask, transactionTypes, onUpdateTransaction, onAddTransaction, accounts, categories, tags, counterparties, users, initialTaskId }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set(users.map(u => u.id)));
  const hasOpenedInitialTask = useRef(false);

  useEffect(() => {
      if (users.length > 0 && selectedUserIds.size === 0) {
          setSelectedUserIds(new Set(users.map(u => u.id)));
      }
  }, [users.length]);

  useEffect(() => {
    if (initialTaskId && tasks.length > 0 && !hasOpenedInitialTask.current) {
        const task = tasks.find(t => t.id === initialTaskId);
        if (task) {
            setEditingTask(task);
            setIsTaskModalOpen(true);
            hasOpenedInitialTask.current = true;
        }
    }
  }, [initialTaskId, tasks]);

  const toggleUserSelection = (userId: string) => {
      const newSet = new Set(selectedUserIds);
      if (newSet.has(userId)) newSet.delete(userId);
      else newSet.add(userId);
      setSelectedUserIds(newSet);
  };
  
  const handleTransactionClick = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const handleTaskClick = (task: TaskItem) => {
      setEditingTask(task);
      setIsTaskModalOpen(true);
  };

  const handleSaveTransaction = (formData: Omit<Transaction, 'id'>) => {
    if (editingTransaction) {
      const updatedTransaction: Transaction = { ...formData, id: editingTransaction.id };
      onUpdateTransaction(updatedTransaction);
      setEditingTransaction(null);
      setIsModalOpen(false);
    } else {
        const newTx: Transaction = { ...formData, id: crypto.randomUUID() };
        onAddTransaction(newTx);
        setIsModalOpen(false);
    }
  };

  const handleSaveTaskWrapper = (task: TaskItem) => {
      if(onSaveTask) onSaveTask(task);
      setIsTaskModalOpen(false);
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);

  const { itemsByDay, monthlySummary } = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[], events: ScheduledEvent[], tasks: TaskItem[], income: number, expenses: number, investments: number, donations: number, taxes: number }>();
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    let monthlyInvestments = 0;
    let monthlyDonations = 0;
    let monthlyTaxes = 0;
    
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    transactions.forEach(tx => {
        if (tx.userId && !selectedUserIds.has(tx.userId)) return;

        // Use the ISO string directly to avoid timezone shifts
        const dateKey = tx.date; 
        if (!map.has(dateKey)) map.set(dateKey, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0, taxes: 0 });
        
        const entry = map.get(dateKey)!;
        entry.transactions.push(tx);
        
        const type = transactionTypeMap.get(tx.typeId);
        if (type) {
            if (type.balanceEffect === 'income') entry.income += tx.amount;
            else if (type.balanceEffect === 'expense') entry.expenses += tx.amount;
            else if (type.balanceEffect === 'investment') entry.investments += tx.amount;
            else if (type.balanceEffect === 'donation') entry.donations += tx.amount;
            else if (type.balanceEffect === 'tax') entry.taxes += tx.amount;
        }

        // Parse local for month view checks
        const parsedDate = parseISOLocal(tx.date);
        if (parsedDate.getMonth() === currentMonth && parsedDate.getFullYear() === currentYear && !tx.isParent) {
             if (type?.balanceEffect === 'income') monthlyIncome += tx.amount;
             else if (type?.balanceEffect === 'expense') monthlyExpenses += tx.amount;
             else if (type?.balanceEffect === 'investment') monthlyInvestments += tx.amount;
             else if (type?.balanceEffect === 'donation') monthlyDonations += tx.amount;
             else if (type?.balanceEffect === 'tax') monthlyTaxes += tx.amount;
        }
    });

    tasks.forEach(task => {
        if (!task.dueDate) return;
        const key = task.dueDate;
        if (!map.has(key)) map.set(key, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0, taxes: 0 });
        map.get(key)!.tasks.push(task);
    });

    return { itemsByDay: map, monthlySummary: { income: monthlyIncome, expenses: monthlyExpenses, investments: monthlyInvestments, donations: monthlyDonations, taxes: monthlyTaxes } };
  }, [transactions, tasks, currentDate, selectedUserIds, transactionTypeMap]);

  const days = useMemo(() => {
      const d = new Date(currentDate);
      if (viewMode === 'month') {
          d.setDate(1);
          const startDay = d.getDay();
          const calendarDays: Date[] = [];
          const prevMonth = new Date(d);
          prevMonth.setDate(prevMonth.getDate() - startDay);
          for (let i = 0; i < 42; i++) {
              calendarDays.push(new Date(prevMonth));
              prevMonth.setDate(prevMonth.getDate() + 1);
          }
          return calendarDays;
      } else if (viewMode === 'week') {
          const day = d.getDay();
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - day);
          const weekDays: Date[] = [];
          for (let i = 0; i < 7; i++) {
              weekDays.push(new Date(weekStart));
              weekStart.setDate(weekStart.getDate() + 1);
          }
          return weekDays;
      } else {
          return [new Date(currentDate)];
      }
  }, [currentDate, viewMode]);

  const navigate = (direction: 'prev' | 'next') => {
      setCurrentDate(prev => {
          const next = new Date(prev);
          if (viewMode === 'month') {
              next.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1), 1);
          } else if (viewMode === 'week') {
              next.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
          } else {
              next.setDate(prev.getDate() + (direction === 'next' ? 1 : -1));
          }
          return next;
      });
  };

  const handleToday = () => {
      const now = new Date();
      setCurrentDate(now);
      setSelectedDate(now);
  };

  const getItemStyle = (tx: Transaction) => {
      const type = transactionTypeMap.get(tx.typeId);
      const effect = type?.balanceEffect || 'expense';
      switch (effect) {
          case 'income': return 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500 hover:bg-emerald-100';
          case 'expense': return 'bg-rose-50 text-rose-800 border-l-4 border-rose-500 hover:bg-rose-100';
          case 'tax': return 'bg-orange-50 text-orange-800 border-l-4 border-orange-500 hover:bg-orange-100';
          case 'investment': return 'bg-purple-50 text-purple-800 border-l-4 border-purple-500 hover:bg-purple-100';
          case 'donation': return 'bg-sky-50 text-sky-800 border-l-4 border-sky-500 hover:bg-sky-100';
          default: return 'bg-slate-50 text-slate-700 border-l-4 border-slate-400 hover:bg-slate-200';
      }
  };

  const activeSummary = useMemo(() => {
      if (selectedDate) {
          const key = formatDate(selectedDate);
          return itemsByDay.get(key) || { income: 0, expenses: 0, investments: 0, donations: 0, taxes: 0, transactions: [], tasks: [] };
      }
      return { ...monthlySummary, transactions: [], tasks: [] };
  }, [selectedDate, monthlySummary, itemsByDay]);

  const summaryContextLabel = selectedDate ? `${formatDate(selectedDate)}` : 'Full Month';

  return (
      <div className="space-y-4 h-full flex flex-col overflow-hidden">
          {/* Header Bar */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 flex-shrink-0">
              <div>
                  <h1 className="text-3xl font-bold text-slate-800">Calendar</h1>
                  <p className="text-slate-500 text-sm">Schedule and track performance by date.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                  {/* View Switcher */}
                  <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                      {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                          <button 
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-widest ${viewMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                              {mode}
                          </button>
                      ))}
                  </div>

                  <div className="h-8 w-px bg-slate-200 mx-1 hidden lg:block" />

                  <button onClick={() => setIsScheduleModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium shadow-sm transition-all text-sm">
                      <TasksIcon className="w-4 h-4 text-indigo-500"/> Schedule Task
                  </button>
                  <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md transition-all text-sm">
                      <AddIcon className="w-4 h-4"/> Add Entry
                  </button>
              </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
              <SummaryWidget title="Income" value={formatCurrency(activeSummary.income)} helpText={summaryContextLabel} colorClass="text-emerald-600" isFocus={!!selectedDate} />
              <SummaryWidget title="Expenses" value={formatCurrency(activeSummary.expenses)} helpText={summaryContextLabel} colorClass="text-rose-600" isFocus={!!selectedDate} />
              <SummaryWidget title="Taxes" value={formatCurrency(activeSummary.taxes || 0)} helpText={summaryContextLabel} colorClass="text-orange-600" isFocus={!!selectedDate} />
              <SummaryWidget title="Investments" value={formatCurrency(activeSummary.investments)} helpText={summaryContextLabel} colorClass="text-purple-600" isFocus={!!selectedDate} />
              <SummaryWidget title="Donations" value={formatCurrency(activeSummary.donations)} helpText={summaryContextLabel} colorClass="text-sky-600" isFocus={!!selectedDate} />
          </div>

          {/* Main Calendar Section */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
              
              {/* Calendar Grid Container */}
              <div className={`bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col min-h-0 overflow-hidden transition-all duration-500 ease-in-out ${selectedDate ? 'lg:w-[65%]' : 'w-full'}`}>
                  {/* Calendar Navigation */}
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
                      <div className="flex items-center gap-2">
                          <button onClick={handleToday} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-xs font-bold hover:bg-slate-100 shadow-sm transition-all active:scale-95">
                              Today
                          </button>
                          <div className="h-6 w-px bg-slate-300 mx-1"></div>
                          <div className="flex items-center bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
                              <button onClick={() => navigate('prev')} className="p-2 hover:bg-slate-100 border-r border-slate-200 text-slate-600 transition-colors">
                                  <ChevronLeftIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => navigate('next')} className="p-2 hover:bg-slate-100 text-slate-600 transition-colors">
                                  <ChevronRightIcon className="w-4 h-4" />
                              </button>
                          </div>
                          <h2 className="text-xl font-black text-slate-800 ml-4 min-w-[200px]">
                              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                              {viewMode === 'week' && <span className="text-sm font-medium text-slate-400 ml-2"> (Week View)</span>}
                          </h2>
                      </div>

                      <div className="flex items-center gap-4">
                        {selectedDate && (
                            <button 
                                onClick={() => setSelectedDate(null)}
                                className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-indigo-200 transition-all"
                            >
                                <CloseIcon className="w-3 h-3" /> Reset View
                            </button>
                        )}
                        <div className="flex -space-x-2 overflow-hidden">
                            {users.map(u => (
                                <button 
                                    key={u.id}
                                    onClick={() => toggleUserSelection(u.id)}
                                    className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs bg-slate-500 text-white font-bold transition-all ${selectedUserIds.has(u.id) ? 'opacity-100 ring-2 ring-offset-1 ring-indigo-500 z-10' : 'opacity-40 grayscale hover:opacity-70'}`}
                                    title={u.name}
                                >
                                    {u.name.charAt(0)}
                                </button>
                            ))}
                        </div>
                      </div>
                  </div>

                  {/* Grid Implementation */}
                  <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] min-h-0 bg-slate-200 gap-px">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="p-2 text-center text-[10px] font-black text-slate-400 uppercase bg-slate-50 border-b border-slate-200">
                              {day}
                          </div>
                      ))}
                      
                      <div className={`col-span-7 grid grid-cols-7 ${viewMode === 'month' ? 'grid-rows-6' : 'grid-rows-1'} flex-1 min-h-0 bg-slate-200 gap-px overflow-y-auto custom-scrollbar pr-2`}>
                        {days.map((date, i) => {
                            const dateKey = formatDate(date);
                            const data = itemsByDay.get(dateKey);
                            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                            const isToday = dateKey === formatDate(new Date());
                            const isSelected = selectedDate && formatDate(selectedDate) === dateKey;
                            
                            const MAX_MONTH_ITEMS = 3;
                            const totalItems = (data?.transactions.length || 0) + (data?.tasks.length || 0);

                            return (
                                <div 
                                    key={i} 
                                    className={`min-h-[100px] p-1.5 flex flex-col gap-1.5 overflow-hidden transition-all relative group cursor-pointer hover:z-10
                                        ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/80 text-slate-400'} 
                                        ${isToday ? 'bg-indigo-50/20' : ''}
                                        ${isSelected ? 'bg-indigo-50/50 ring-2 ring-inset ring-indigo-500 shadow-inner' : 'hover:bg-slate-50'}
                                    `}
                                    onClick={() => setSelectedDate(date)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-black transition-colors ${isToday ? 'text-indigo-600 bg-indigo-100 px-1.5 rounded-full' : isSelected ? 'text-indigo-700' : 'text-slate-400'}`}>
                                                {date.getDate()}
                                            </span>
                                        </div>
                                        {data && (data.income !== 0 || data.expenses !== 0 || data.taxes !== 0) && (
                                            <div className="text-[9px] font-mono text-right leading-tight">
                                                {data.income > 0 && <p className="text-emerald-600 font-bold">+{Math.round(data.income)}</p>}
                                                {data.expenses > 0 && <p className="text-rose-600 font-bold">-{Math.round(data.expenses)}</p>}
                                                {data.taxes > 0 && <p className="text-orange-600 font-bold">T:{Math.round(data.taxes)}</p>}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 space-y-1 mt-0.5 overflow-hidden">
                                        {viewMode === 'month' ? (
                                            <>
                                                {data?.tasks.slice(0, 1).map(task => (
                                                    <div key={task.id} className={`text-[9px] px-1.5 py-0.5 rounded border-l-2 truncate font-bold ${task.isCompleted ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-amber-50 border-amber-400 text-amber-700'}`}>
                                                        T: {task.title}
                                                    </div>
                                                ))}
                                                {data?.transactions.slice(0, MAX_MONTH_ITEMS - (data?.tasks.length ? 1 : 0)).map(tx => (
                                                    <div key={tx.id} className={`text-[9px] px-1.5 py-0.5 rounded truncate font-bold shadow-sm ${getItemStyle(tx)}`}>
                                                        ${Math.round(Math.abs(tx.amount))} {tx.description}
                                                    </div>
                                                ))}
                                                {totalItems > MAX_MONTH_ITEMS && (
                                                    <div className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded text-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        +{totalItems - MAX_MONTH_ITEMS + 1} more
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="space-y-1.5 overflow-y-auto h-full custom-scrollbar pr-1">
                                                {data?.tasks.map(task => (
                                                    <div key={task.id} onClick={(e) => { e.stopPropagation(); handleTaskClick(task); }} className={`text-[10px] px-2 py-1 rounded-lg border-l-4 shadow-sm flex items-center gap-2 cursor-pointer transition-transform hover:scale-[1.02] ${task.isCompleted ? 'bg-slate-50 border-slate-300 text-slate-400' : 'bg-amber-50 border-amber-500 text-amber-900'}`}>
                                                        <ChecklistIcon className="w-3 h-3 flex-shrink-0" />
                                                        <span className="truncate font-bold">{task.title}</span>
                                                    </div>
                                                ))}
                                                {data?.transactions.map(tx => (
                                                    <div key={tx.id} onClick={(e) => { e.stopPropagation(); handleTransactionClick(tx); }} className={`text-[10px] px-2 py-1 rounded-lg flex justify-between items-center shadow-sm cursor-pointer transition-transform hover:scale-[1.02] ${getItemStyle(tx)}`}>
                                                        <span className="truncate font-bold mr-2">{tx.description}</span>
                                                        <span className="font-mono font-black">${Math.round(Math.abs(tx.amount))}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                      </div>
                  </div>
              </div>

              {/* Day Detail Sidebar (Inspector) */}
              {selectedDate && (
                  <div className="w-full lg:w-[35%] bg-white rounded-2xl shadow-xl border-2 border-indigo-100 flex flex-col min-h-0 animate-slide-in-right overflow-hidden">
                      <div className="p-5 border-b bg-indigo-600 text-white flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="bg-white/20 p-2 rounded-xl">
                                <CalendarIcon className="w-6 h-6" />
                              </div>
                              <div>
                                  <h3 className="font-black text-lg">{selectedDate.toLocaleString('default', { weekday: 'long' })}</h3>
                                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">{formatDate(selectedDate)}</p>
                              </div>
                          </div>
                          <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6" /></button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                          {/* Daily Stats Summary in Sidebar */}
                          <div className="grid grid-cols-2 gap-3">
                              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                                  <p className="text-[10px] font-black text-emerald-600 uppercase">Daily Income</p>
                                  <p className="text-xl font-black text-emerald-700">{formatCurrency(activeSummary.income)}</p>
                              </div>
                              <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
                                  <p className="text-[10px] font-black text-rose-600 uppercase">Daily Spent</p>
                                  <p className="text-xl font-black text-rose-700">{formatCurrency(activeSummary.expenses)}</p>
                              </div>
                          </div>

                          {/* Tasks Section */}
                          <section>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ChecklistIcon className="w-4 h-4 text-indigo-500" /> Tasks
                                </h4>
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{(activeSummary as any).tasks?.length || 0} items</span>
                              </div>
                              <div className="space-y-2">
                                  {(activeSummary as any).tasks?.length > 0 ? (activeSummary as any).tasks.map((task: TaskItem) => (
                                      <div 
                                        key={task.id} 
                                        onClick={() => handleTaskClick(task)}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex gap-3 ${task.isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-amber-100 hover:border-amber-400 shadow-sm'}`}
                                      >
                                          <div className={`mt-0.5 p-1 rounded-full ${task.isCompleted ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                              <CheckCircleIcon className="w-4 h-4" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className={`font-bold text-sm ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.title}</p>
                                              {task.description && <p className="text-xs text-slate-500 truncate mt-0.5">{task.description}</p>}
                                              <div className="flex gap-2 mt-2">
                                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${task.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{task.priority}</span>
                                              </div>
                                          </div>
                                      </div>
                                  )) : (
                                      <div className="text-center py-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                                          <p className="text-sm text-slate-400 font-medium italic">No tasks for this day.</p>
                                      </div>
                                  )}
                              </div>
                          </section>

                          {/* Transactions Section */}
                          <section>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <TableIcon className="w-4 h-4 text-indigo-500" /> Transactions
                                </h4>
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{(activeSummary as any).transactions?.length || 0} items</span>
                              </div>
                              <div className="space-y-2">
                                  {(activeSummary as any).transactions?.length > 0 ? (activeSummary as any).transactions.map((tx: Transaction) => (
                                      <div 
                                        key={tx.id} 
                                        onClick={() => handleTransactionClick(tx)}
                                        className={`p-4 rounded-xl border-2 hover:shadow-md transition-all cursor-pointer ${getItemStyle(tx)} bg-white relative group`}
                                      >
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="min-w-0 flex-1">
                                                  <h5 className="font-black text-slate-800 truncate pr-2" title={tx.description}>{tx.description}</h5>
                                                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                      {categoryMap.get(tx.categoryId) || 'Other'} • {accountMap.get(tx.accountId || '') || 'Unknown Account'}
                                                  </p>
                                              </div>
                                              <div className="text-right flex-shrink-0">
                                                  <p className="font-black text-sm font-mono tracking-tighter">
                                                    {transactionTypeMap.get(tx.typeId)?.balanceEffect === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                  </p>
                                              </div>
                                          </div>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                              <span className="text-[9px] font-black uppercase bg-white/50 px-2 py-0.5 rounded-full shadow-sm text-slate-600 border border-slate-200/50">
                                                  {transactionTypeMap.get(tx.typeId)?.name || 'Entry'}
                                              </span>
                                          </div>
                                      </div>
                                  )) : (
                                      <div className="text-center py-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                                          <p className="text-sm text-slate-400 font-medium italic">No financial activity recorded.</p>
                                      </div>
                                  )}
                              </div>
                          </section>
                      </div>

                      <div className="p-4 bg-slate-50 border-t flex gap-3">
                          <button 
                            onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
                            className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg text-sm transition-all"
                          >
                              New Transaction
                          </button>
                      </div>
                  </div>
              )}
          </div>

          <ScheduleEventModal 
              isOpen={isScheduleModalOpen} 
              onClose={() => setIsScheduleModalOpen(false)} 
              onSave={onAddEvent}
              templates={templates}
              initialDate={selectedDate || currentDate}
          />

          <TransactionModal
              isOpen={isModalOpen}
              transaction={editingTransaction}
              onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
              onSave={handleSaveTransaction}
              accounts={accounts}
              categories={categories}
              tags={tags}
              transactionTypes={transactionTypes}
              counterparties={counterparties}
              users={users}
          />

          <TaskModal 
              isOpen={isTaskModalOpen} 
              onClose={() => setIsTaskModalOpen(false)} 
              onSave={handleSaveTaskWrapper} 
              task={editingTask} 
              initialMode="edit"
          />
      </div>
  );
};

export default CalendarPage;
