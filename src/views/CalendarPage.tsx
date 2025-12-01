import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, Template, ScheduledEvent, TaskCompletions, TransactionType, Account, Category, Payee, User, TaskItem, Tag } from '../types';
import ScheduleEventModal from '../components/ScheduleEventModal';
import TransactionModal from './TransactionModal';
import TaskModal from './TaskModal';
import { CheckCircleIcon, ChecklistIcon, RepeatIcon, LinkIcon, UsersIcon, ExternalLinkIcon, HeartIcon, ChevronLeftIcon, ChevronRightIcon, AddIcon, CalendarIcon } from '../components/Icons';
import { formatDate } from '../dateUtils';

interface CalendarPageProps {
  transactions: Transaction[];
  templates: Template[];
  scheduledEvents: ScheduledEvent[];
  tasks: TaskItem[];
  taskCompletions: TaskCompletions;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  payees: Payee[];
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

const SummaryWidget: React.FC<{title: string, value: string, helpText: string}> = ({title, value, helpText}) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{helpText}</p>
    </div>
);

const USER_COLORS = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
    'bg-pink-500', 'bg-teal-500', 'bg-cyan-500', 'bg-rose-500'
];

const CalendarPage: React.FC<CalendarPageProps> = ({ transactions, templates, scheduledEvents, tasks, taskCompletions, onAddEvent, onToggleTaskCompletion, onToggleTask, onSaveTask, transactionTypes, onUpdateTransaction, onAddTransaction, accounts, categories, tags, payees, users, initialTaskId }) => {
  const [currentDate, setCurrentDate] = useState(() => {
      const now = new Date();
      // Default to current month
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

  const getUserColorClass = (userId: string | undefined) => {
      if (!userId) return 'bg-slate-300';
      const index = users.findIndex(u => u.id === userId);
      if (index === -1) return 'bg-slate-300';
      return USER_COLORS[index % USER_COLORS.length];
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
      const updatedTransaction: Transaction = {
        ...formData,
        id: editingTransaction.id,
      };
      onUpdateTransaction(updatedTransaction);
      setEditingTransaction(null);
      setIsModalOpen(false);
    } else {
        const newTx: Transaction = {
            ...formData,
            id: crypto.randomUUID()
        };
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

  const { itemsByDay, monthlySummary } = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[], events: ScheduledEvent[], tasks: TaskItem[], income: number, expenses: number, investments: number, donations: number }>();
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    let monthlyInvestments = 0;
    let monthlyDonations = 0;
    
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Process transactions
    transactions.forEach(tx => {
        if (tx.userId && !selectedUserIds.has(tx.userId)) return;

        const date = new Date(tx.date);
        const key = formatDate(date);
        if (!map.has(key)) map.set(key, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0 });
        
        const entry = map.get(key)!;
        entry.transactions.push(tx);
        
        const type = transactionTypeMap.get(tx.typeId);
        if (type) {
            if (type.balanceEffect === 'income') entry.income += tx.amount;
            else if (type.balanceEffect === 'expense') entry.expenses += tx.amount;
            else if (type.balanceEffect === 'investment') entry.investments += tx.amount;
            else if (type.balanceEffect === 'donation') entry.donations += tx.amount;
        }

        // Add to monthly summary if within current month view
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear && !tx.isParent) {
             if (type?.balanceEffect === 'income') monthlyIncome += tx.amount;
             else if (type?.balanceEffect === 'expense') monthlyExpenses += tx.amount;
             else if (type?.balanceEffect === 'investment') monthlyInvestments += tx.amount;
             else if (type?.balanceEffect === 'donation') monthlyDonations += tx.amount;
        }
    });

    // Process tasks
    tasks.forEach(task => {
        if (!task.dueDate) return;
        const key = task.dueDate;
        if (!map.has(key)) map.set(key, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0 });
        map.get(key)!.tasks.push(task);
    });

    return { itemsByDay: map, monthlySummary: { income: monthlyIncome, expenses: monthlyExpenses, investments: monthlyInvestments, donations: monthlyDonations } };
  }, [transactions, tasks, currentDate, selectedUserIds, transactionTypeMap]);

  const days = useMemo(() => {
      const d = new Date(currentDate);
      d.setDate(1); // First day of month
      const startDay = d.getDay(); // 0-6
      
      const calendarDays: Date[] = [];
      // Previous month days padding
      const prevMonth = new Date(d);
      prevMonth.setDate(prevMonth.getDate() - startDay);
      
      for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
          calendarDays.push(new Date(prevMonth));
          prevMonth.setDate(prevMonth.getDate() + 1);
      }
      return calendarDays;
  }, [currentDate]);

  const handlePrevMonth = () => {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
      <div className="space-y-6 h-full flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
              <h1 className="text-3xl font-bold text-slate-800">Calendar</h1>
              <div className="flex items-center gap-2">
                  <button onClick={() => setIsScheduleModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium">
                      <CalendarIcon className="w-5 h-5"/> Schedule
                  </button>
                  <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                      <AddIcon className="w-5 h-5"/> Add
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
              <SummaryWidget title="Income" value={formatCurrency(monthlySummary.income)} helpText="This Month" />
              <SummaryWidget title="Expenses" value={formatCurrency(monthlySummary.expenses)} helpText="This Month" />
              <SummaryWidget title="Investments" value={formatCurrency(monthlySummary.investments)} helpText="This Month" />
              <SummaryWidget title="Donations" value={formatCurrency(monthlySummary.donations)} helpText="This Month" />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                      <h2 className="text-xl font-bold text-slate-700">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                      <div className="flex items-center rounded-md border border-slate-300 bg-white">
                          <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 border-r border-slate-300"><ChevronLeftIcon className="w-5 h-5 text-slate-600" /></button>
                          <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100"><ChevronRightIcon className="w-5 h-5 text-slate-600" /></button>
                      </div>
                  </div>
                  {/* User Filter */}
                  <div className="flex -space-x-2 overflow-hidden">
                      {users.map(u => (
                          <button 
                              key={u.id}
                              onClick={() => toggleUserSelection(u.id)}
                              className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-bold ${getUserColorClass(u.id)} ${selectedUserIds.has(u.id) ? 'opacity-100 ring-2 ring-offset-1 ring-indigo-500' : 'opacity-40 grayscale'}`}
                              title={u.name}
                          >
                              {u.name.charAt(0)}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] min-h-0">
                  {/* Weekday Headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="p-2 text-center text-xs font-semibold text-slate-500 uppercase border-b border-r border-slate-100 last:border-r-0 bg-slate-50">
                          {day}
                      </div>
                  ))}
                  
                  {/* Days Grid */}
                  {days.map((date, i) => {
                      const dateKey = formatDate(date);
                      const data = itemsByDay.get(dateKey);
                      const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                      const isToday = dateKey === formatDate(new Date());
                      
                      return (
                          <div 
                              key={i} 
                              className={`min-h-[100px] border-b border-r border-slate-100 last:border-r-0 p-1 flex flex-col gap-1 overflow-hidden transition-colors ${!isCurrentMonth ? 'bg-slate-50 text-slate-400' : 'bg-white'} ${selectedDate && formatDate(selectedDate) === dateKey ? 'ring-2 ring-indigo-500 inset-0 z-10' : ''}`}
                              onClick={() => setSelectedDate(date)}
                          >
                              <div className={`text-right text-sm font-medium p-1 ${isToday ? 'text-indigo-600 font-bold' : ''}`}>
                                  {isToday && <span className="bg-indigo-600 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs mr-1">Today</span>}
                                  {date.getDate()}
                              </div>
                              
                              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                  {/* Transactions */}
                                  {data?.transactions.map(tx => (
                                      <div 
                                          key={tx.id} 
                                          onClick={(e) => { e.stopPropagation(); handleTransactionClick(tx); }}
                                          className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 flex justify-between items-center ${getUserColorClass(tx.userId)} text-white`}
                                          title={`${tx.description}: $${tx.amount}`}
                                      >
                                          <span className="truncate">{tx.description}</span>
                                          <span className="font-mono ml-1">${Math.round(tx.amount)}</span>
                                      </div>
                                  ))}
                                  
                                  {/* Tasks */}
                                  {data?.tasks.map(task => (
                                      <div 
                                          key={task.id}
                                          onClick={(e) => { e.stopPropagation(); handleTaskClick(task); }}
                                          className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-slate-200 border border-slate-200 bg-slate-100 text-slate-700 flex items-center gap-1 ${task.isCompleted ? 'line-through opacity-50' : ''}`}
                                          title={task.title}
                                      >
                                          <ChecklistIcon className="w-3 h-3 flex-shrink-0" />
                                          <span className="truncate">{task.title}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
              </div>
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
              payees={payees}
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
