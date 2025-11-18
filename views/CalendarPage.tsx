
import React, { useState, useMemo } from 'react';
import type { Transaction, Template, ScheduledEvent, TaskCompletions, TransactionType, Account, Category, Payee, User, TaskItem } from '../types';
import ScheduleEventModal from '../components/ScheduleEventModal';
import TransactionModal from './TransactionModal';
import { CheckCircleIcon, ChecklistIcon, RepeatIcon } from '../components/Icons';
import { formatDate } from '../dateUtils';

interface CalendarPageProps {
  transactions: Transaction[];
  templates: Template[];
  scheduledEvents: ScheduledEvent[];
  tasks: TaskItem[];
  taskCompletions: TaskCompletions;
  accounts: Account[];
  categories: Category[];
  payees: Payee[];
  users: User[];
  onAddEvent: (event: ScheduledEvent) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onToggleTaskCompletion: (date: string, eventId: string, taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  transactionTypes: TransactionType[];
}

const SummaryWidget: React.FC<{title: string, value: string, helpText: string}> = ({title, value, helpText}) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{helpText}</p>
    </div>
);

const LinkRenderer: React.FC<{ text: string }> = ({ text }) => {
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

const CalendarPage: React.FC<CalendarPageProps> = ({ transactions, templates, scheduledEvents, tasks, taskCompletions, onAddEvent, onToggleTaskCompletion, onToggleTask, transactionTypes, onUpdateTransaction, accounts, categories, payees, users }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const handleTransactionClick = (tx: Transaction) => {
    setEditingTransaction(tx);
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

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const getDayKey = (date: Date) => formatDate(date);
  
  const transactionTypeMap = useMemo(() => new Map(transactionTypes.map(t => [t.id, t])), [transactionTypes]);

  const { itemsByDay, monthlySummary } = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[], events: ScheduledEvent[], tasks: TaskItem[], income: number, expenses: number }>();
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const getDayData = (dateKey: string) => {
        if (!map.has(dateKey)) {
            map.set(dateKey, { transactions: [], events: [], tasks: [], income: 0, expenses: 0 });
        }
        return map.get(dateKey)!;
    }

    // Process Transactions
    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const type = transactionTypeMap.get(tx.typeId);

      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
         if (type?.balanceEffect === 'income') monthlyIncome += tx.amount;
         else if (type?.balanceEffect === 'expense') monthlyExpenses += tx.amount;
      }

      const dateKey = getDayKey(txDate);
      const dayData = getDayData(dateKey);
      dayData.transactions.push(tx);
       if (type?.balanceEffect === 'income') dayData.income += tx.amount;
       else if (type?.balanceEffect === 'expense') dayData.expenses += tx.amount;
    });

    // Process Recurring Events (Templates)
    scheduledEvents.forEach(event => {
        const startDate = new Date(event.startDate + 'T00:00:00');
        if (event.recurrence === 'monthly') {
            const eventDay = startDate.getDate();
            if (startDate.getFullYear() < currentYear || (startDate.getFullYear() === currentYear && startDate.getMonth() <= currentMonth)) {
                const recurrenceDate = new Date(currentYear, currentMonth, eventDay);
                getDayData(getDayKey(recurrenceDate)).events.push(event);
            }
        } else { // 'none'
            if (startDate.getFullYear() === currentYear && startDate.getMonth() === currentMonth) {
                getDayData(getDayKey(startDate)).events.push(event);
            }
        }
    });

    // Process Individual Tasks
    tasks.forEach(task => {
        if (task.dueDate) {
            const taskDate = new Date(task.dueDate + 'T00:00:00');
            const dateKey = getDayKey(taskDate);
            getDayData(dateKey).tasks.push(task);
        }
    });

    return { 
        itemsByDay: map, 
        monthlySummary: { income: monthlyIncome, expenses: monthlyExpenses }
    };
  }, [transactions, scheduledEvents, tasks, currentDate, transactionTypeMap]);
  
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
    <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Calendar</h1>
                <p className="text-slate-500 mt-1">View your schedule, tasks, and cash flow.</p>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="mt-2 sm:mt-0 px-4 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700">Schedule Checklist</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryWidget title="Month's Income" value={formatCurrency(monthlySummary.income)} helpText="Total income & refunds" />
            <SummaryWidget title="Month's Expenses" value={formatCurrency(monthlySummary.expenses)} helpText="Total spending" />
            <SummaryWidget title="Net Flow" value={formatCurrency(monthlySummary.income - monthlySummary.expenses)} helpText="Income minus expenses" />
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

                        return (
                            <div key={i} onClick={() => setSelectedDate(d)} className={`relative p-2 h-28 flex flex-col border-r border-b cursor-pointer transition-colors ${isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'} ${isSelected ? 'ring-2 ring-indigo-500 z-10' : ''}`}>
                                <span className={`font-semibold ${isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>{d.getDate()}</span>
                                <div className="mt-auto text-xs overflow-hidden">
                                    {taskCount > 0 && <p className="flex items-center gap-1 text-blue-600 truncate font-medium"><span className="w-2 h-2 rounded-full bg-blue-500"></span>{taskCount} Item(s)</p>}
                                    {dayData?.income > 0 && <p className="text-green-600 truncate font-medium">+{formatCurrency(dayData.income)}</p>}
                                    {dayData?.expenses > 0 && <p className="text-red-600 truncate font-medium">-{formatCurrency(dayData.expenses)}</p>}
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
                                    <li key={task.id} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                                         <button onClick={() => onToggleTask(task.id)} className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${task.isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-400 hover:border-indigo-500'}`}>
                                            {task.isCompleted && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                         </button>
                                         <div className="flex-grow">
                                             <p className={`text-sm font-medium ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
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
                                                    <li key={task.id} className="flex items-center">
                                                        <input type="checkbox" id={`${event.id}-${task.id}`} checked={completedTasks.includes(task.id)} onChange={() => onToggleTaskCompletion(selectedDateKey, event.id, task.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
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
                                    const category = categories.find(c => c.id === tx.categoryId);
                                    return (
                                        <li key={tx.id} onClick={() => handleTransactionClick(tx)} className="flex items-start justify-between text-sm p-2 -mx-2 rounded-lg cursor-pointer hover:bg-slate-100">
                                            <div>
                                                <p className="font-medium text-slate-800">{tx.description}</p>
                                                <p className="text-slate-500">{category?.name || 'Uncategorized'}</p>
                                            </div>
                                            <p className={`font-semibold flex-shrink-0 ml-4 ${isExpense ? 'text-red-600' : 'text-green-600'}`}>{isExpense ? `-${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}</p>
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
    {editingTransaction && (
      <TransactionModal
        isOpen={!!editingTransaction}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveTransaction}
        accounts={accounts}
        categories={categories}
        transactionTypes={transactionTypes}
        payees={payees}
        users={users}
      />
    )}
    </>
  );
};

export default React.memo(CalendarPage);
