
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, Template, ScheduledEvent, TaskCompletions, TransactionType, Account, Category, Counterparty, User, TaskItem, Tag } from '../types';
import ScheduleEventModal from '../components/ScheduleEventModal';
import TransactionModal from './TransactionModal';
import TaskModal from './TaskModal';
import { CheckCircleIcon, ChecklistIcon, ChevronLeftIcon, ChevronRightIcon, AddIcon, CalendarIcon, CloseIcon, TableIcon, TasksIcon, TrendingUpIcon } from '../components/Icons';
import { formatDate, parseISOLocal } from '../dateUtils';
import { SummaryWidget } from '../components/FinancialStats';

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

const MetricBreakdownModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    transactions: Transaction[];
    counterparties: Counterparty[];
    total: number;
    colorClass: string;
}> = ({ isOpen, onClose, title, transactions, counterparties, total, colorClass }) => {
    if (!isOpen) return null;
    const counterpartyMap = new Map(counterparties.map(cp => [cp.id, cp.name]));
    const breakdown = useMemo(() => {
        const groups = new Map<string, number>();
        transactions.forEach(tx => {
            const label = tx.counterpartyId ? (counterpartyMap.get(tx.counterpartyId) || 'Unknown Entity') : (tx.description || 'Unspecified');
            groups.set(label, (groups.get(label) || 0) + Math.abs(tx.amount));
        });
        return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [transactions, counterpartyMap]);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800">{title} Breakdown</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Top 10 Contributors</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                </div>
                <div className="p-6 space-y-2 overflow-y-auto custom-scrollbar max-h-[60vh]">
                    {breakdown.map(([label, amount], idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[10px] font-black text-slate-400 w-4">{idx + 1}</span>
                                <span className="text-sm font-bold text-slate-700 truncate">{label}</span>
                            </div>
                            <div className="text-right ml-4">
                                <span className={`text-sm font-black font-mono ${colorClass}`}>${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <p className="text-[8px] font-black text-slate-300 uppercase">{total > 0 ? ((amount / total) * 100).toFixed(0) : 0}%</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white border rounded-xl font-black text-xs uppercase shadow-sm">Close</button>
                </div>
            </div>
        </div>
    );
};

const CalendarPage: React.FC<CalendarPageProps> = ({ transactions, templates, scheduledEvents, tasks, taskCompletions, onAddEvent, onToggleTaskCompletion, onToggleTask, onSaveTask, transactionTypes, onUpdateTransaction, onAddTransaction, accounts, categories, tags, counterparties, users, initialTaskId }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set(users.map(u => u.id)));
  const [breakdownMetric, setBreakdownMetric] = useState<'incoming' | 'outgoing' | 'investments' | 'donations' | null>(null);
  const hasOpenedInitialTask = useRef(false);

  useEffect(() => { if (users.length > 0 && selectedUserIds.size === 0) setSelectedUserIds(new Set(users.map(u => u.id))); }, [users.length]);
  useEffect(() => { if (initialTaskId && tasks.length > 0 && !hasOpenedInitialTask.current) { const task = tasks.find(t => t.id === initialTaskId); if (task) { setEditingTask(task); setIsTaskModalOpen(true); hasOpenedInitialTask.current = true; } } }, [initialTaskId, tasks]);

  const toggleUserSelection = (userId: string) => { const n = new Set(selectedUserIds); if (n.has(userId)) n.delete(userId); else n.add(userId); setSelectedUserIds(n); };
  
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);

  const days = useMemo(() => {
      const d = new Date(currentDate);
      if (viewMode === 'month') {
          d.setDate(1); const startDay = d.getDay(); const calendarDays: Date[] = [];
          const prevMonth = new Date(d); prevMonth.setDate(prevMonth.getDate() - startDay);
          for (let i = 0; i < 42; i++) { calendarDays.push(new Date(prevMonth)); prevMonth.setDate(prevMonth.getDate() + 1); }
          return calendarDays;
      } else if (viewMode === 'week') {
          const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay());
          const weekDays: Date[] = [];
          for (let i = 0; i < 7; i++) { weekDays.push(new Date(weekStart)); weekStart.setDate(weekStart.getDate() + 1); }
          return weekDays;
      }
      return [new Date(currentDate)];
  }, [currentDate, viewMode]);

  const { itemsByDay, monthlySummary } = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[], events: ScheduledEvent[], tasks: TaskItem[], income: number, expenses: number, investments: number, donations: number }>();
    let mIncome = 0, mExpenses = 0, mInvestments = 0, mDonations = 0;
    const currentMonth = currentDate.getMonth(), currentYear = currentDate.getFullYear();
    
    transactions.forEach(tx => {
        if (tx.userId && !selectedUserIds.has(tx.userId)) return;
        if (!map.has(tx.date)) map.set(tx.date, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0 });
        const entry = map.get(tx.date)!; entry.transactions.push(tx);
        const type = transactionTypeMap.get(tx.typeId);
        if (type) {
            if (tx.typeId === 'type_investment') entry.investments += tx.amount;
            else if (tx.typeId === 'type_donation') entry.donations += tx.amount;
            else if (type.balanceEffect === 'incoming') entry.income += tx.amount;
            else if (type.balanceEffect === 'outgoing') entry.expenses += tx.amount;
        }
        const parsedDate = parseISOLocal(tx.date);
        if (parsedDate.getMonth() === currentMonth && parsedDate.getFullYear() === currentYear && !tx.isParent) {
             if (tx.typeId === 'type_investment') mInvestments += tx.amount;
             else if (tx.typeId === 'type_donation') mDonations += tx.amount;
             else if (type?.balanceEffect === 'incoming') mIncome += tx.amount;
             else if (type?.balanceEffect === 'outgoing') mExpenses += tx.amount;
        }
    });

    // Projection Logic for Recurring Tasks
    tasks.forEach(task => {
        if (!task.dueDate) return;
        
        const taskStart = parseISOLocal(task.dueDate);
        const taskStartYear = taskStart.getFullYear();
        const taskStartMonth = taskStart.getMonth();
        const taskStartDay = taskStart.getDate();

        // 1. Direct Due Date (Always show the primary instance)
        const dKey = task.dueDate;
        if (!map.has(dKey)) map.set(dKey, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0 });
        const dayEntry = map.get(dKey)!;
        if (!dayEntry.tasks.find(t => t.id === task.id)) dayEntry.tasks.push(task);

        // 2. Project Recurring Instances into the visible "days" array
        if (task.recurrence) {
            const { frequency } = task.recurrence;
            
            days.forEach(date => {
                const dateKey = formatDate(date);
                if (dateKey === dKey) return; // Already added
                if (date < taskStart) return; // Don't project before start
                if (task.recurrence?.endDate && date > parseISOLocal(task.recurrence.endDate)) return; // Don't project after end

                let matches = false;
                if (frequency === 'daily') {
                    matches = true;
                } else if (frequency === 'weekly') {
                    const daysToMatch = task.recurrence?.byWeekDays || [taskStart.getDay()];
                    matches = daysToMatch.includes(date.getDay());
                } else if (frequency === 'monthly') {
                    // Match the day of the month
                    // Note: Handle months with fewer days (e.g. if task is 31st, show on 30th/28th for shorter months?)
                    // For now, standard day match is safer.
                    matches = date.getDate() === taskStartDay;
                } else if (frequency === 'yearly') {
                    matches = date.getDate() === taskStartDay && date.getMonth() === taskStartMonth;
                }

                if (matches) {
                    if (!map.has(dateKey)) map.set(dateKey, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0 });
                    const projEntry = map.get(dateKey)!;
                    if (!projEntry.tasks.find(t => t.id === task.id)) projEntry.tasks.push(task);
                }
            });
        }
    });

    return { itemsByDay: map, monthlySummary: { income: mIncome, expenses: mExpenses, investments: mInvestments, donations: mDonations } };
  }, [transactions, tasks, currentDate, selectedUserIds, transactionTypeMap, days]);

  const navigate = (direction: 'prev' | 'next') => {
      setCurrentDate(prev => {
          const next = new Date(prev);
          if (viewMode === 'month') next.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1), 1);
          else if (viewMode === 'week') next.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
          else next.setDate(prev.getDate() + (direction === 'next' ? 1 : -1));
          return next;
      });
  };

  const getItemStyle = (tx: Transaction) => {
      const type = transactionTypeMap.get(tx.typeId);
      if (type?.color) return `${type.color} bg-white border-l-4 shadow-sm border-current hover:bg-slate-50`;
      const effect = type?.balanceEffect || 'outgoing';
      return effect === 'incoming' ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500 hover:bg-emerald-100' : 'bg-rose-50 text-rose-800 border-l-4 border-rose-500 hover:bg-rose-100';
  };

  const activeSummary = useMemo(() => {
      if (selectedDate) return itemsByDay.get(formatDate(selectedDate)) || { income: 0, expenses: 0, investments: 0, donations: 0, transactions: [], tasks: [] };
      return { ...monthlySummary, transactions: [], tasks: [] };
  }, [selectedDate, monthlySummary, itemsByDay]);

  const summaryContextLabel = selectedDate ? `${formatDate(selectedDate)}` : 'Full Month';

  const breakdownTransactions = useMemo(() => {
      if (!breakdownMetric) return [];
      let pool: Transaction[] = [];
      if (selectedDate) pool = itemsByDay.get(formatDate(selectedDate))?.transactions || [];
      else {
          const curMonth = currentDate.getMonth(), curYear = currentDate.getFullYear();
          pool = transactions.filter(tx => { const d = parseISOLocal(tx.date); return d.getMonth() === curMonth && d.getFullYear() === curYear && !tx.isParent; });
      }
      return pool.filter(tx => {
          const type = transactionTypeMap.get(tx.typeId);
          if (breakdownMetric === 'incoming') return type?.balanceEffect === 'incoming' && tx.typeId !== 'type_investment';
          if (breakdownMetric === 'outgoing') return type?.balanceEffect === 'outgoing' && tx.typeId !== 'type_investment';
          return tx.typeId === (breakdownMetric === 'investments' ? 'type_investment' : 'type_donation');
      });
  }, [breakdownMetric, selectedDate, itemsByDay, transactions, currentDate, transactionTypeMap]);

  return (
      <div className="space-y-4 h-full flex flex-col overflow-hidden">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 flex-shrink-0">
              <div><h1 className="text-3xl font-black text-slate-800 tracking-tight">Calendar</h1><p className="text-slate-500 text-sm font-medium">Schedule and track performance by date.</p></div>
              <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                      {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                          <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all uppercase tracking-widest ${viewMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{mode}</button>
                      ))}
                  </div>
                  <button onClick={() => setIsScheduleModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 font-black shadow-sm transition-all text-[10px] uppercase tracking-widest"><TasksIcon className="w-4 h-4 text-indigo-500"/> Schedule</button>
                  <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black shadow-lg transition-all text-[10px] uppercase tracking-widest"><AddIcon className="w-4 h-4"/> Add Entry</button>
              </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
              <SummaryWidget title="Incoming" value={activeSummary.income} helpText={summaryContextLabel} colorClass="text-emerald-600" isFocus={!!selectedDate} onClick={() => setBreakdownMetric('incoming')} />
              <SummaryWidget title="Outgoing" value={activeSummary.expenses} helpText={summaryContextLabel} colorClass="text-rose-600" isFocus={!!selectedDate} onClick={() => setBreakdownMetric('outgoing')} />
              <SummaryWidget title="Investments" value={activeSummary.investments} helpText={summaryContextLabel} colorClass="text-purple-600" isFocus={!!selectedDate} onClick={() => setBreakdownMetric('investments')} />
              <SummaryWidget title="Donations" value={activeSummary.donations} helpText={summaryContextLabel} colorClass="text-pink-600" isFocus={!!selectedDate} onClick={() => setBreakdownMetric('donations')} />
          </div>

          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
              <div className={`bg-white rounded-[2.5rem] shadow-md border border-slate-200 flex flex-col min-h-0 overflow-hidden transition-all duration-500 ${selectedDate ? 'lg:w-[65%]' : 'w-full'}`}>
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                          <button onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(now); }} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-black uppercase hover:bg-slate-100 shadow-sm transition-all active:scale-95">Today</button>
                          <div className="flex items-center bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
                              <button onClick={() => navigate('prev')} className="p-2 hover:bg-slate-100 border-r text-slate-600"><ChevronLeftIcon className="w-4 h-4" /></button>
                              <button onClick={() => navigate('next')} className="p-2 hover:bg-slate-100 text-slate-600"><ChevronRightIcon className="w-4 h-4" /></button>
                          </div>
                          <h2 className="text-xl font-black text-slate-800 ml-4">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                      </div>
                      <div className="flex -space-x-2">
                            {users.map(u => (
                                <button key={u.id} onClick={() => toggleUserSelection(u.id)} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] bg-slate-800 text-white font-black transition-all ${selectedUserIds.has(u.id) ? 'opacity-100 ring-2 ring-indigo-500 z-10' : 'opacity-40 grayscale'}`} title={u.name}>{u.name.charAt(0)}</button>
                            ))}
                      </div>
                  </div>

                  <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] min-h-0 bg-slate-200 gap-px">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ( <div key={day} className="p-2 text-center text-[10px] font-black text-slate-400 uppercase bg-slate-50 border-b">{day}</div> ))}
                      <div className="col-span-7 grid grid-cols-7 grid-rows-6 flex-1 min-h-0 bg-slate-200 gap-px overflow-y-auto custom-scrollbar">
                        {days.map((date, i) => {
                            const dKey = formatDate(date); const data = itemsByDay.get(dKey); const isCurr = date.getMonth() === currentDate.getMonth(); const isToday = dKey === formatDate(new Date()); const isSel = selectedDate && formatDate(selectedDate) === dKey;
                            return (
                                <div key={i} className={`min-h-[100px] p-1.5 flex flex-col gap-1 overflow-hidden transition-all relative cursor-pointer ${isCurr ? 'bg-white' : 'bg-slate-50/50 text-slate-400'} ${isSel ? 'bg-indigo-50/50 ring-2 ring-inset ring-indigo-500' : 'hover:bg-slate-50'}`} onClick={() => setSelectedDate(date)}>
                                    <span className={`text-xs font-black ${isToday ? 'text-indigo-600 bg-indigo-50 px-1.5 rounded-full' : 'text-slate-400'}`}>{date.getDate()}</span>
                                    <div className="flex-1 space-y-0.5 mt-0.5 overflow-hidden">
                                        {data?.tasks.slice(0, 1).map(task => ( <div key={task.id} className={`text-[8px] px-1 py-0.5 rounded border-l-2 truncate font-black uppercase ${task.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-700 border-amber-400'}`}>T: {task.title}</div> ))}
                                        {data?.transactions.slice(0, 2).map(tx => ( <div key={tx.id} className={`text-[8px] px-1 py-0.5 rounded truncate font-black uppercase shadow-sm ${getItemStyle(tx)}`}>${Math.round(Math.abs(tx.amount))} {tx.description}</div> ))}
                                    </div>
                                </div>
                            );
                        })}
                      </div>
                  </div>
              </div>

              {selectedDate && (
                  <div className="w-full lg:w-[35%] bg-white rounded-[2rem] shadow-xl border border-slate-200 flex flex-col min-h-0 animate-slide-in-right overflow-hidden">
                      <div className="p-5 border-b bg-indigo-600 text-white flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="bg-white/20 p-2 rounded-xl"><CalendarIcon className="w-6 h-6" /></div>
                              <div><h3 className="font-black text-lg">{selectedDate.toLocaleString('default', { weekday: 'long' })}</h3><p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">{formatDate(selectedDate)}</p></div>
                          </div>
                          <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-white/20 rounded-full"><CloseIcon className="w-6 h-6" /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                          <section>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><ChecklistIcon className="w-4 h-4 text-indigo-500" /> Operational Queue</h4>
                              <div className="space-y-2">
                                  {activeSummary.tasks.map(task => (
                                      <div key={task.id} onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }} className={`p-4 rounded-2xl border-2 cursor-pointer flex gap-3 ${task.isCompleted ? 'bg-slate-50 opacity-60' : 'bg-white border-amber-50 shadow-sm hover:border-amber-400'}`}>
                                          <div className={`mt-0.5 p-1 rounded-full ${task.isCompleted ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}><CheckCircleIcon className="w-4 h-4" /></div>
                                          <div className="flex-1"><p className={`font-black text-xs ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p></div>
                                      </div>
                                  ))}
                                  {activeSummary.tasks.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No tasks scheduled.</p>}
                              </div>
                          </section>
                          <section>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><TableIcon className="w-4 h-4 text-indigo-500" /> Registry Entries</h4>
                              <div className="space-y-2">
                                  {activeSummary.transactions.map(tx => (
                                      <div key={tx.id} onClick={() => { setEditingTransaction(tx); setIsModalOpen(true); }} className={`p-4 rounded-2xl border-2 cursor-pointer ${getItemStyle(tx)} bg-white relative group`}>
                                          <div className="flex justify-between items-start">
                                              <div className="min-w-0 flex-1"><h5 className="font-black text-xs text-slate-800 truncate pr-2">{tx.description}</h5><p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{categoryMap.get(tx.categoryId) || 'Other'} • {accountMap.get(tx.accountId || '') || 'N/A'}</p></div>
                                              <p className="font-black text-xs font-mono">${Math.round(Math.abs(tx.amount))}</p>
                                          </div>
                                      </div>
                                  ))}
                                  {activeSummary.transactions.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No records found.</p>}
                              </div>
                          </section>
                      </div>
                  </div>
              )}
          </div>

          <ScheduleEventModal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} onSave={onAddEvent} templates={templates} initialDate={selectedDate || currentDate} />
          <TransactionModal isOpen={isModalOpen} transaction={editingTransaction} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} onSave={(formData) => { if (editingTransaction) onUpdateTransaction({ ...formData, id: editingTransaction.id }); else onAddTransaction({ ...formData, id: crypto.randomUUID() } as Transaction); setIsModalOpen(false); }} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users} />
          <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={(t) => { if(onSaveTask) onSaveTask(t); setIsTaskModalOpen(false); }} task={editingTask} initialMode="view" />
          <MetricBreakdownModal isOpen={!!breakdownMetric} onClose={() => setBreakdownMetric(null)} title={breakdownMetric || ''} transactions={breakdownTransactions} counterparties={counterparties} total={breakdownMetric === 'incoming' ? activeSummary.income : activeSummary.expenses} colorClass={breakdownMetric === 'incoming' ? 'text-emerald-600' : 'text-rose-600'} />
      </div>
  );
};

export default CalendarPage;
