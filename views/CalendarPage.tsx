
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, Template, ScheduledEvent, TaskCompletions, TransactionType, Account, Category, Payee, User, TaskItem, Tag } from '../types';
import ScheduleEventModal from '../components/ScheduleEventModal';
import TransactionModal from './TransactionModal';
import TaskModal from './TaskModal';
import DonationModal from '../components/DonationModal';
import { CheckCircleIcon, ChecklistIcon, RepeatIcon, LinkIcon, UsersIcon, ExternalLinkIcon, HeartIcon } from '../components/Icons';
import { formatDate, calculateNextDate } from '../dateUtils';

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
  onSaveTask?: (task: TaskItem) => void; // Added for updating task from modal view mode
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

const LinkRenderer: React.FC<{ text: string, url?: string, linkText?: string }> = ({ text, url, linkText }) => {
    // If explicit URL is provided in data
    if (url) {
        return (
            <div className="flex flex-col">
                <span>{text}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1 text-xs mt-0.5">
                    <LinkIcon className="w-3 h-3" />
                    {linkText || url}
                </a>
            </div>
        );
    }

    // Fallback: simple regex for text links (legacy support)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <span>
            {parts.map((part, i) =>
                urlRegex.test(part) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">{part}</a>
                ) : ( part )
            )}
        </span>
    );
};

const USER_COLORS = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
    'bg-pink-500', 'bg-teal-500', 'bg-cyan-500', 'bg-rose-500'
];

const CalendarPage: React.FC<CalendarPageProps> = ({ transactions, templates, scheduledEvents, tasks, taskCompletions, onAddEvent, onToggleTaskCompletion, onToggleTask, onSaveTask, transactionTypes, onUpdateTransaction, onAddTransaction, accounts, categories, tags, payees, users, initialTaskId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // User Filtering State
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set(users.map(u => u.id)));
  const hasOpenedInitialTask = useRef(false);

  // Ensure selection is valid if users change (e.g. load)
  useEffect(() => {
      // Only set if we haven't touched it yet or if it's empty on load
      if (users.length > 0 && selectedUserIds.size === 0) {
          setSelectedUserIds(new Set(users.map(u => u.id)));
      }
  }, [users.length]);

  // Handle deep linking to a specific task
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

  const selectAllUsers = () => setSelectedUserIds(new Set(users.map(u => u.id)));

  const getUserColorClass = (userId: string | undefined) => {
      if (!userId) return 'bg-slate-300';
      const index = users.findIndex(u => u.id === userId);
      if (index === -1) return 'bg-slate-300';
      return USER_COLORS[index % USER_COLORS.length];
  };
  
  const handleTransactionClick = (tx: Transaction) => {
    setEditingTransaction(tx);
  };

  const handleTaskClick = (task: TaskItem) => {
      setEditingTask(task);
      setIsTaskModalOpen(true);
  };

  const handleOpenTaskInNewTab = (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      const url = `${window.location.pathname}?view=calendar&taskId=${taskId}`;
      window.open(url, '_blank');
  };

  const handleSaveTransaction = (formData: Omit<Transaction, 'id'>) => {
    if (editingTransaction) {
      const updatedTransaction: Transaction = {
        ...formData,
        id: editingTransaction.id,
      };
      onUpdateTransaction(updatedTransaction);
      setEditingTransaction(null);
    }
  };

  const handleSaveTaskWrapper = (task: TaskItem) => {
      if (onSaveTask) {
          onSaveTask(task);
      }
      // If needed, update local task list logic here, but parent usually handles refresh
      setEditingTask(null);
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const getDayKey = (date: Date) => formatDate(date);
  
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);

  const { itemsByDay, monthlySummary } = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[], events: ScheduledEvent[], tasks: TaskItem[], income: number, expenses: number, investments: number, donations: number }>();
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    let monthlyInvestments = 0;
    let monthlyDonations = 0;
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Define View Range for projection (Previous month, Current, Next)
    // This allows us to see recurring tasks slightly outside the strict current month if grid overlaps
    const viewStart = new Date(currentYear, currentMonth - 1, 1);
    const viewEnd = new Date(currentYear, currentMonth + 2, 0);

    const getDayData = (dateKey: string) => {
        if (!map.has(dateKey)) {
            map.set(dateKey, { transactions: [], events: [], tasks: [], income: 0, expenses: 0, investments: 0, donations: 0 });
        }
        return map.get(dateKey)!;
    }

    // Process Transactions with User Filter
    transactions.forEach(tx => {
      // Filter logic
      let effectiveUserId = tx.userId;
      if (!effectiveUserId) {
          const defaultUser = users.find(u => u.isDefault);
          effectiveUserId = defaultUser?.id;
      }
      if (effectiveUserId && !selectedUserIds.has(effectiveUserId)) {
          return;
      }

      const txDate = new Date(tx.date);
      const type = transactionTypeMap.get(tx.typeId);

      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
         if (type?.balanceEffect === 'income') monthlyIncome += tx.amount;
         else if (type?.balanceEffect === 'expense') monthlyExpenses += tx.amount;
         else if (type?.balanceEffect === 'investment') monthlyInvestments += tx.amount;
         else if (type?.balanceEffect === 'donation') monthlyDonations += tx.amount;
      }

      const dateKey = getDayKey(txDate);
      const dayData = getDayData(dateKey);
      dayData.transactions.push(tx);
       if (type?.balanceEffect === 'income') dayData.income += tx.amount;
       else if (type?.balanceEffect === 'expense') dayData.expenses += tx.amount;
       else if (type?.balanceEffect === 'investment') dayData.investments += tx.amount;
       else if (type?.balanceEffect === 'donation') dayData.donations += tx.amount;
    });

    // Process Recurring Events (Templates)
    scheduledEvents.forEach(event => {
        const startDate = new Date(event.startDate + 'T00:00:00');
        if (event.recurrence === 'monthly') {
            // Simple projection for templates (visual only)
            const eventDay = startDate.getDate();
            if (startDate.getFullYear() < currentYear || (startDate.getFullYear() === currentYear && startDate.getMonth() <= currentMonth)) {
                // Project into current view
                const recurrenceDate = new Date(currentYear, currentMonth, eventDay);
                // Adjust for month length (don't show on 31st of Feb)
                if (recurrenceDate.getMonth() === currentMonth) {
                    getDayData(getDayKey(recurrenceDate)).events.push(event);
                }
            }
        } else { // 'none'
            if (startDate.getFullYear() === currentYear && startDate.getMonth() === currentMonth) {
                getDayData(getDayKey(startDate)).events.push(event);
            }
        }
    });

    // Process Tasks with Recurrence Projection
    tasks.forEach(task => {
        if (!task.dueDate) return;
        
        const taskDueDate = new Date(task.dueDate + 'T00:00:00');
        const taskKey = getDayKey(taskDueDate);

        // 1. Always add the original instance if it falls in relevant range or if it's the specific task
        // Actually, simpler to just add it where it belongs.
        // For performance, only add if within broader view range? No, Calendar view might scroll?
        // Let's just add it.
        getDayData(taskKey).tasks.push(task);

        // 2. Project Future Instances
        if (task.recurrence) {
            let nextDateStr = task.dueDate;
            let safetyCounter = 0;
            
            // Loop to project dates
            while (safetyCounter < 50) { // Limit iterations
                // Calculate next occurrence
                nextDateStr = calculateNextDate(nextDateStr, task.recurrence);
                const nextDate = new Date(nextDateStr + 'T00:00:00');
                
                // If projected date is beyond our view range, stop
                if (nextDate > viewEnd) break;
                
                // Check if we passed the end date of recurrence
                if (task.recurrence.endDate && nextDateStr > task.recurrence.endDate) break;

                // If within view window, add a ghost task
                if (nextDate >= viewStart) {
                    const key = getDayKey(nextDate);
                    
                    // Create a visual clone
                    // Note: We use a deterministic ID so React doesn't get confused
                    const ghostTask: TaskItem = { 
                        ...task, 
                        id: `ghost-${task.id}-${key}`, 
                        dueDate: key, 
                        isCompleted: false, // Future occurrences are open
                        subtasks: task.subtasks?.map(st => ({...st, isCompleted: false})) // Reset subtasks
                    };
                    
                    // Tag it so UI knows it's a projection
                    (ghostTask as any).isProjected = true;
                    
                    getDayData(key).tasks.push(ghostTask);
                }
                
                safetyCounter++;
            }
        }
    });

    return { 
        itemsByDay: map, 
        monthlySummary: { income: monthlyIncome, expenses: monthlyExpenses, investments: monthlyInvestments, donations: monthlyDonations }
    };
  }, [transactions, scheduledEvents, tasks, currentDate, transactionTypeMap, selectedUserIds, users]);
  
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const days: Date[] = [];
  let day = new Date(startDate);
  while (days.length < 42) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const selectedDateKey = selectedDate ? getDayKey(selectedDate) : '';
  const selectedDayItems = itemsByDay.get(selectedDateKey);
  const selectedDayTransactions = selectedDayItems?.transactions.sort((a,b) => b.amount - a.amount) || [];
  const selectedDayEvents = selectedDayItems?.events || [];
  const selectedDayTasks = selectedDayItems?.tasks || [];
  const templateMap = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

  return (
    <>
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Calendar</h1>
                <p className="text-slate-500 mt-1">View your schedule, tasks, and cash flow.</p>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setIsDonationModalOpen(true)}
                    className="px-3 py-2 text-pink-600 bg-pink-50 border border-pink-100 rounded-lg hover:bg-pink-100 transition-colors flex items-center gap-2 font-medium text-sm"
                    title="Calculate and generate donation transaction based on monthly income"
                >
                    <HeartIcon className="w-4 h-4" />
                    Calculate Donations
                </button>
                <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700">Schedule Checklist</button>
            </div>
        </div>

        {/* User Filters */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mr-2">
                <UsersIcon className="w-4 h-4" />
                <span>Filter Users:</span>
            </div>
            {users.map((u, index) => (
                <button
                    key={u.id}
                    onClick={() => toggleUserSelection(u.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border transition-all ${
                        selectedUserIds.has(u.id) 
                        ? `bg-indigo-50 text-indigo-800 border-indigo-200 font-semibold ring-1 ring-indigo-200`
                        : `bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100`
                    }`}
                >
                    <span className={`w-2 h-2 rounded-full ${USER_COLORS[index % USER_COLORS.length]}`}></span>
                    {u.name}
                </button>
            ))}
            <button onClick={selectAllUsers} className="text-xs text-indigo-600 hover:underline ml-auto font-medium">Select All</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryWidget title="Income" value={formatCurrency(monthlySummary.income)} helpText="Total income & refunds" />
            <SummaryWidget title="Expenses" value={formatCurrency(monthlySummary.expenses)} helpText="Total spending" />
            <SummaryWidget title="Investments" value={formatCurrency(monthlySummary.investments)} helpText="Assets & contributions" />
            <SummaryWidget title="Donations" value={formatCurrency(monthlySummary.donations)} helpText="Charitable giving" />
            <SummaryWidget title="Net Flow" value={formatCurrency(monthlySummary.income - monthlySummary.expenses)} helpText="Income - Expenses" />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-grow bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-slate-100">&lt;</button>
                    <h2 className="text-xl font-bold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-slate-100">&gt;</button>
                </div>
                <div className="grid grid-cols-7">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center font-semibold text-sm py-2 text-slate-600 border-b">{d}</div>)}
                    {days.map((d, i) => {
                        const dayData = itemsByDay.get(getDayKey(d));
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                        const isSelected = selectedDate?.toDateString() === d.toDateString();
                        const taskCount = (dayData?.events.length || 0) + (dayData?.tasks.length || 0);
                        const dayIncome = dayData?.income || 0;
                        const dayExpenses = dayData?.expenses || 0;
                        const dayInvestments = dayData?.investments || 0;
                        const dayDonations = dayData?.donations || 0;

                        return (
                            <div key={i} onClick={() => setSelectedDate(d)} className={`relative p-2 h-28 flex flex-col border-r border-b cursor-pointer transition-colors ${isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'} ${isSelected ? 'ring-2 ring-indigo-500 z-10' : ''}`}>
                                <span className={`font-semibold ${isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>{d.getDate()}</span>
                                <div className="mt-auto text-xs overflow-hidden">
                                    {taskCount > 0 && <p className="flex items-center gap-1 text-blue-600 truncate font-medium"><span className="w-2 h-2 rounded-full bg-blue-500"></span>{taskCount} Item(s)</p>}
                                    {dayIncome > 0 && <p className="text-green-600 truncate font-medium">+{formatCurrency(dayIncome)}</p>}
                                    {dayExpenses > 0 && <p className="text-red-600 truncate font-medium">-{formatCurrency(dayExpenses)}</p>}
                                    {dayInvestments > 0 && <p className="text-purple-600 truncate font-medium">-{formatCurrency(dayInvestments)}</p>}
                                    {dayDonations > 0 && <p className="text-blue-500 truncate font-medium">-{formatCurrency(dayDonations)}</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="lg:w-96 flex-shrink-0 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-bold text-slate-700 mb-4">{selectedDate ? formatDate(selectedDate) : 'Select a day'}</h3>
                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                    
                    {/* Individual Tasks */}
                    {selectedDayTasks.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-slate-600 mb-2 border-b pb-1">To-Do List</h4>
                            <ul className="space-y-2">
                                {selectedDayTasks.map(task => (
                                    <li key={task.id} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg transition-colors hover:bg-slate-100 group relative">
                                         <button onClick={() => onToggleTask(task.id)} className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${task.isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-400 hover:border-indigo-500'}`}>
                                            {task.isCompleted && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                         </button>
                                         <div className="flex-grow cursor-pointer" onClick={() => handleTaskClick(task)}>
                                             <p className={`text-sm font-medium ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                 {task.title}
                                                 {(task as any).isProjected && <span className="ml-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 rounded-full">Recurring</span>}
                                             </p>
                                             <div className="flex items-center gap-2 text-xs text-slate-500">
                                                {task.description && <span className="truncate max-w-[120px]">{task.description}</span>}
                                                {task.recurrence && <span className="flex items-center gap-0.5" title="Recurring"><RepeatIcon className="w-3 h-3"/></span>}
                                                {(task.subtasks?.length || 0) > 0 && (
                                                    <span className="flex items-center gap-0.5">
                                                        <ChecklistIcon className="w-3 h-3" />
                                                        {task.subtasks?.filter(s => s.isCompleted).length}/{task.subtasks?.length}
                                                    </span>
                                                )}
                                             </div>
                                         </div>
                                         {/* Open in New Tab Button */}
                                         <button 
                                            onClick={(e) => handleOpenTaskInNewTab(e, task.id)}
                                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 rounded hover:bg-white"
                                            title="Open in new tab"
                                         >
                                             <ExternalLinkIcon className="w-3 h-3" />
                                         </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Scheduled Checklists */}
                    {selectedDayEvents.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-slate-600 mb-2 border-b pb-1">Recurring Checklists</h4>
                            <div className="space-y-4">
                                {selectedDayEvents.map(event => {
                                    const template = templateMap.get(event.templateId);
                                    if (!template) return null;
                                    const completedTasks = taskCompletions[selectedDateKey]?.[event.id] || [];
                                    return (
                                        <div key={event.id}>
                                            <h5 className="font-bold text-sm">{template.name}</h5>
                                            {template.instructions && <p className="text-xs text-slate-500 mt-1 mb-2">{template.instructions}</p>}
                                            <ul className="space-y-2">
                                                {template.tasks.map(task => (
                                                    <li key={task.id} className="flex items-start">
                                                        <input type="checkbox" id={`${event.id}-${task.id}`} checked={completedTasks.includes(task.id)} onChange={() => onToggleTaskCompletion(selectedDateKey, event.id, task.id)} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                        <label htmlFor={`${event.id}-${task.id}`} className="ml-2 text-sm text-slate-800"><LinkRenderer text={task.text} /></label>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Transactions */}
                    {selectedDayTransactions.length > 0 && (
                         <div>
                            <h4 className="font-semibold text-slate-600 mb-2 border-b pb-1">Transactions</h4>
                            <ul className="space-y-4">
                                {selectedDayTransactions.map(tx => {
                                    const type = transactionTypeMap.get(tx.typeId);
                                    const isExpense = type?.balanceEffect === 'expense';
                                    const isInvestment = type?.balanceEffect === 'investment';
                                    const isDonation = type?.balanceEffect === 'donation';
                                    const category = categories.find(c => c.id === tx.categoryId);
                                    const userColorClass = getUserColorClass(tx.userId);
                                    
                                    return (
                                        <li key={tx.id} onClick={() => handleTransactionClick(tx)} className="flex items-start justify-between text-sm p-2 -mx-2 rounded-lg cursor-pointer hover:bg-slate-100 relative pl-4 overflow-hidden">
                                            {/* User Indicator */}
                                            <div className={`absolute left-0 top-1 bottom-1 w-1 rounded-r ${userColorClass}`}></div>
                                            
                                            <div>
                                                <p className="font-medium text-slate-800">{tx.description}</p>
                                                <p className="text-slate-500 text-xs">
                                                    {category?.name || 'Uncategorized'}
                                                    {tx.userId && <span className="ml-1 opacity-60">• {users.find(u => u.id === tx.userId)?.name.split(' ')[0]}</span>}
                                                </p>
                                            </div>
                                            <p className={`font-semibold flex-shrink-0 ml-4 ${isExpense ? 'text-red-600' : (isInvestment ? 'text-purple-600' : (isDonation ? 'text-blue-600' : 'text-green-600'))}`}>
                                                {(isExpense || isInvestment || isDonation) ? `-${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    {selectedDayTransactions.length === 0 && selectedDayEvents.length === 0 && selectedDayTasks.length === 0 && <p className="text-center text-slate-500 pt-8">No items on this day.</p>}
                </div>
            </div>
        </div>
    </div>
    
    <ScheduleEventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={onAddEvent} templates={templates} initialDate={selectedDate || new Date()} />
    
    <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        onSave={onAddTransaction}
        totalIncome={monthlySummary.income}
        monthName={currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        payees={payees}
        accounts={accounts}
        categories={categories}
        transactionTypes={transactionTypes}
    />

    {editingTransaction && (
      <TransactionModal
        isOpen={!!editingTransaction}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveTransaction}
        accounts={accounts}
        categories={categories}
        tags={tags}
        transactionTypes={transactionTypes}
        payees={payees}
        users={users}
      />
    )}

    {editingTask && (
        <TaskModal 
            isOpen={isTaskModalOpen} 
            onClose={() => setIsTaskModalOpen(false)} 
            onSave={handleSaveTaskWrapper} 
            task={editingTask} 
            initialMode="view"
        />
    )}
    </>
  );
};

export default CalendarPage;
