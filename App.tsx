
import React, { useState, useCallback, useEffect } from 'react';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Payee, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import AllTransactions from './views/AllTransactions';
import CalendarPage from './views/CalendarPage';
import AccountsPage from './views/AccountsPage';
import Reports from './views/Reports';
import SettingsPage from './views/SettingsPage';
import TasksPage from './views/TasksPage';
import RulesPage from './views/RulesPage';
import PayeesPage from './views/PayeesPage';
import CategoriesPage from './views/CategoriesPage';
import UsersPage from './views/UsersPage';
import BusinessHub from './views/BusinessHub';
import Chatbot from './components/Chatbot';
import Loader from './components/Loader';
import { MenuIcon, CloseIcon } from './components/Icons';
import { calculateNextDate, formatDate } from './dateUtils';
import { generateUUID } from './utils';
import { api } from './services/apiService';

type View = 'dashboard' | 'transactions' | 'calendar' | 'accounts' | 'reports' | 'settings' | 'tasks' | 'rules' | 'payees' | 'categories' | 'users' | 'hub';

const DEFAULT_CATEGORIES: Category[] = [
    "Groceries", "Dining", "Shopping", "Travel", "Entertainment", "Utilities", "Health", "Services", "Transportation", "Income", "Other"
].map(name => ({ id: `default-${name.toLowerCase().replace(' ', '-')}`, name, parentId: undefined }));


const DEFAULT_TRANSACTION_TYPES: TransactionType[] = [
    // Expenses
    { id: 'default-expense-purchase', name: 'Purchase', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-bill', name: 'Bill Payment', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-fee', name: 'Fee', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-interest', name: 'Interest Charge', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-withdrawal', name: 'Withdrawal', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-tax', name: 'Tax Payment', balanceEffect: 'expense', isDefault: true },
    // Income
    { id: 'default-income-deposit', name: 'Direct Deposit', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-interest', name: 'Interest Earned', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-paycheck', name: 'Paycheck', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-refund', name: 'Refund', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-sales', name: 'Sales', balanceEffect: 'income', isDefault: true },
    // Transfers
    { id: 'default-transfer-payment', name: 'Credit Card Payment', balanceEffect: 'transfer', isDefault: true },
    { id: 'default-transfer-transfer', name: 'Transfer', balanceEffect: 'transfer', isDefault: true },
    // A fallback 'Other' for each type
    { id: 'default-expense-other', name: 'Other Expense', balanceEffect: 'expense', isDefault: true },
    { id: 'default-income-other', name: 'Other Income', balanceEffect: 'income', isDefault: true },
    { id: 'default-transfer-other', name: 'Other Transfer', balanceEffect: 'transfer', isDefault: true },
];


const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<TaskCompletions>({});
  const [reconciliationRules, setReconciliationRules] = useState<ReconciliationRule[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({ info: {}, tax: {}, completedSteps: [] });
  const [businessDocuments, setBusinessDocuments] = useState<BusinessDocument[]>([]);
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load data from API on initial render
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await api.loadAll();

      const safeLoad = <T,>(key: string, fallback: T): T => {
          return (data[key] as T) || fallback;
      };

      // Handle Users
      const loadedUsers = safeLoad<User[]>('users', []);
      let finalUsers: User[] = (Array.isArray(loadedUsers) && loadedUsers.length > 0)
          ? loadedUsers
          : [{ id: 'default-user', name: 'Primary User', isDefault: true }];
      setUsers(finalUsers);
      
      const defaultUserId = finalUsers.find(u => u.isDefault)?.id || finalUsers[0]?.id;

      // Handle Transactions
      const loadedTxs = safeLoad<Transaction[]>('transactions', []);
      if (Array.isArray(loadedTxs)) {
         if (loadedTxs.length > 0 && !loadedTxs[0].hasOwnProperty('userId')) {
            setTransactions(loadedTxs.map((tx: any) => ({ ...tx, userId: defaultUserId })));
         } else {
            setTransactions(loadedTxs);
         }
      } else {
          setTransactions([]);
      }

      // Handle Categories
      const loadedCategories = safeLoad<Category[] | string[]>('categories', []);
      if (Array.isArray(loadedCategories) && loadedCategories.length > 0) {
          if (typeof loadedCategories[0] === 'string') {
              // Migration logic for legacy array of strings
              setCategories((loadedCategories as string[]).map((name: string) => ({
                  id: `migrated-${name.toLowerCase().replace(/\s+/g, '-')}-${generateUUID().slice(0,4)}`,
                  name: name
              })));
          } else {
              setCategories(loadedCategories as Category[]);
          }
      } else {
          setCategories(DEFAULT_CATEGORIES);
      }
      
      setTransactionTypes(safeLoad<TransactionType[]>('transactionTypes', DEFAULT_TRANSACTION_TYPES));
      setTemplates(safeLoad<Template[]>('templates', []));
      setScheduledEvents(safeLoad<ScheduledEvent[]>('scheduledEvents', []));
      setTasks(safeLoad<TaskItem[]>('tasks', []));
      setTaskCompletions(safeLoad<TaskCompletions>('taskCompletions', {}));
      setReconciliationRules(safeLoad<ReconciliationRule[]>('reconciliationRules', []));
      setPayees(safeLoad<Payee[]>('payees', []));
      setBusinessProfile(safeLoad<BusinessProfile>('businessProfile', { info: {}, tax: {}, completedSteps: [] }));
      setBusinessDocuments(safeLoad<BusinessDocument[]>('businessDocuments', []));

      // Handle Account Types and Accounts
      let finalAccountTypes = safeLoad<AccountType[]>('accountTypes', []);
      if (!Array.isArray(finalAccountTypes) || finalAccountTypes.length === 0) {
          finalAccountTypes = [
            { id: 'default-bank', name: 'Bank', isDefault: true },
            { id: 'default-cc', name: 'Credit Card', isDefault: true },
          ];
      }

      let finalAccounts = safeLoad<Account[]>('accounts', []);
      if (!Array.isArray(finalAccounts) || finalAccounts.length === 0) {
          let generalAccountType = finalAccountTypes.find(t => t.name === 'General');
          if (!generalAccountType) {
              generalAccountType = { id: 'default-general', name: 'General', isDefault: true };
              finalAccountTypes.push(generalAccountType);
          }
          finalAccounts = [{
              id: 'default-account-other',
              name: 'Other',
              identifier: 'Default Account',
              accountTypeId: generalAccountType.id,
          }];
      }

      setAccountTypes(finalAccountTypes);
      setAccounts(finalAccounts);
      
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Save data to API whenever it changes
  // We assume api.save handles networking and we debounce to avoid flood
  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('transactions', transactions), 1000);
    return () => clearTimeout(handler);
  }, [transactions, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('accounts', accounts), 500);
    return () => clearTimeout(handler);
  }, [accounts, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('accountTypes', accountTypes), 500);
    return () => clearTimeout(handler);
  }, [accountTypes, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('transactionTypes', transactionTypes), 500);
    return () => clearTimeout(handler);
  }, [transactionTypes, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('categories', categories), 500);
    return () => clearTimeout(handler);
  }, [categories, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('templates', templates), 500);
    return () => clearTimeout(handler);
  }, [templates, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('scheduledEvents', scheduledEvents), 500);
    return () => clearTimeout(handler);
  }, [scheduledEvents, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('tasks', tasks), 500);
    return () => clearTimeout(handler);
  }, [tasks, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('taskCompletions', taskCompletions), 500);
    return () => clearTimeout(handler);
  }, [taskCompletions, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('reconciliationRules', reconciliationRules), 500);
    return () => clearTimeout(handler);
  }, [reconciliationRules, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('payees', payees), 500);
    return () => clearTimeout(handler);
  }, [payees, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('users', users), 500);
    return () => clearTimeout(handler);
  }, [users, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('businessProfile', businessProfile), 500);
    return () => clearTimeout(handler);
  }, [businessProfile, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('businessDocuments', businessDocuments), 500);
    return () => clearTimeout(handler);
  }, [businessDocuments, isLoading]);


  // Handlers
  const handleTransactionsAdded = (newlyAdded: Transaction[], newlyCreatedCategories: Category[]) => {
      if (newlyCreatedCategories.length > 0) setCategories(prev => [...prev, ...newlyCreatedCategories]);
      if (newlyAdded.length > 0) setTransactions(prev => [...prev, ...newlyAdded].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };
  
  const handleAddTransaction = (newTransaction: Transaction) => {
    setTransactions(prev => [...prev, newTransaction].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const handleUpdateTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTransaction.id ? updatedTransaction : tx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };
  
  const handleUpdateTransactions = (updatedTransactions: Transaction[]) => {
    const updatedTxMap = new Map(updatedTransactions.map(tx => [tx.id, tx]));
    setTransactions(prev => prev.map(tx => updatedTxMap.has(tx.id) ? updatedTxMap.get(tx.id)! : tx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
  };

  const handleDeleteTransactions = (transactionIds: string[]) => {
    const idsToDelete = new Set(transactionIds);
    setTransactions(prev => prev.filter(tx => !idsToDelete.has(tx.id)));
  };

  const handleAddAccount = (account: Account) => setAccounts(prev => [...prev, account]);
  const handleRemoveAccount = (accountId: string) => setAccounts(prev => prev.filter(c => c.id !== accountId));
  const handleAddAccountType = (type: AccountType) => setAccountTypes(prev => [...prev, type]);
  const handleRemoveAccountType = (typeId: string) => setAccountTypes(prev => prev.filter(p => p.id !== typeId));
  const handleAddTransactionType = (type: TransactionType) => setTransactionTypes(prev => [...prev, type]);
  const handleRemoveTransactionType = (typeId: string) => setTransactionTypes(prev => prev.filter(t => t.id !== typeId));

  const handleSaveTemplate = (template: Template) => {
    setTemplates(prev => {
        const index = prev.findIndex(t => t.id === template.id);
        if (index > -1) {
            const newTemplates = [...prev];
            newTemplates[index] = template;
            return newTemplates;
        }
        return [...prev, template];
    });
  };
  const handleRemoveTemplate = (templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    setScheduledEvents(prev => prev.filter(e => e.templateId !== templateId));
  };
  
  const handleAddEvent = (event: ScheduledEvent) => setScheduledEvents(prev => [...prev, event]);
  
  const handleToggleTaskCompletion = (date: string, eventId: string, taskId: string) => {
    setTaskCompletions(prev => {
        const newCompletions = JSON.parse(JSON.stringify(prev));
        const dayCompletions = newCompletions[date] || {};
        const eventCompletions = dayCompletions[eventId] || [];
        
        const taskIndex = eventCompletions.indexOf(taskId);
        if (taskIndex > -1) {
            eventCompletions.splice(taskIndex, 1);
        } else {
            eventCompletions.push(taskId);
        }

        dayCompletions[eventId] = eventCompletions;
        newCompletions[date] = dayCompletions;
        return newCompletions;
    });
  };

  // --- Updated Task Logic for Recurrence ---
  const handleSaveTask = (task: TaskItem) => {
    setTasks(prev => {
        const index = prev.findIndex(t => t.id === task.id);
        if (index > -1) {
            const newTasks = [...prev];
            newTasks[index] = task;
            return newTasks;
        }
        return [...prev, task];
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleToggleTask = (taskId: string) => {
      setTasks(prev => {
          const task = prev.find(t => t.id === taskId);
          if (!task) return prev;

          const isNowCompleted = !task.isCompleted;
          const updatedTasks = prev.map(t => t.id === taskId ? { ...t, isCompleted: isNowCompleted } : t);
          
          // Recurrence Logic:
          if (isNowCompleted && task.recurrence && task.dueDate) {
              const nextDateStr = calculateNextDate(task.dueDate, task.recurrence);
              if (!task.recurrence.endDate || nextDateStr <= task.recurrence.endDate) {
                  const nextTask: TaskItem = {
                      ...task,
                      id: generateUUID(),
                      dueDate: nextDateStr,
                      isCompleted: false,
                      createdAt: new Date().toISOString(),
                      subtasks: task.subtasks?.map(st => ({...st, isCompleted: false})),
                  };
                  updatedTasks.push(nextTask);
              }
          }

          return updatedTasks;
      });
  };

  const handleSaveRule = (rule: ReconciliationRule) => {
     setReconciliationRules(prev => {
        const index = prev.findIndex(r => r.id === rule.id);
        if (index > -1) {
            const newRules = [...prev];
            newRules[index] = rule;
            return newRules;
        }
        return [...prev, rule];
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    setReconciliationRules(prev => prev.filter(r => r.id !== ruleId));
  };
  
  const handleSavePayee = (payee: Payee) => {
     setPayees(prev => {
        const index = prev.findIndex(p => p.id === payee.id);
        if (index > -1) {
            const newPayees = [...prev];
            newPayees[index] = payee;
            return newPayees;
        }
        return [...prev, payee];
    });
  };
  
  const handleDeletePayee = (payeeId: string) => {
    setPayees(prev => {
        const children = prev.filter(p => p.parentId === payeeId);
        const updatedChildren = children.map(c => ({ ...c, parentId: undefined }));
        const filtered = prev.filter(p => p.id !== payeeId && p.parentId !== payeeId);
        return [...filtered, ...updatedChildren];
    });
  };

  const handleSaveCategory = (category: Category) => {
     setCategories(prev => {
        const index = prev.findIndex(c => c.id === category.id);
        if (index > -1) {
            const newCategories = [...prev];
            newCategories[index] = category;
            return newCategories;
        }
        return [...prev, category];
    });
  };
  
  const handleDeleteCategory = (categoryId: string) => {
    setCategories(prev => {
        const children = prev.filter(c => c.parentId === categoryId);
        const updatedChildren = children.map(c => ({ ...c, parentId: undefined }));
        const filtered = prev.filter(c => c.id !== categoryId && c.parentId !== categoryId);
        return [...filtered, ...updatedChildren];
    });
  };

  const handleSaveUser = (user: User) => {
    setUsers(prev => {
        const index = prev.findIndex(u => u.id === user.id);
        if (index > -1) {
            const newUsers = [...prev];
            newUsers[index] = user;
            return newUsers;
        }
        return [...prev, user];
    });
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete?.isDefault) {
        alert("Cannot delete the default user.");
        return;
    }
    const defaultUser = users.find(u => u.isDefault) || users[0];
    if (!defaultUser) {
        alert("Cannot delete user as no default user is available.");
        return;
    }
    setTransactions(prev => prev.map(tx => tx.userId === userId ? { ...tx, userId: defaultUser.id } : tx));
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleAddDocument = (doc: BusinessDocument) => setBusinessDocuments(prev => [...prev, doc]);
  const handleRemoveDocument = (docId: string) => setBusinessDocuments(prev => prev.filter(d => d.id !== docId));

  if (isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-100">
              <Loader message="Loading your data..." />
          </div>
      );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onTransactionsAdded={handleTransactionsAdded} transactions={transactions} accounts={accounts} categories={categories} transactionTypes={transactionTypes} rules={reconciliationRules} payees={payees} users={users} />;
      case 'transactions':
        return <AllTransactions transactions={transactions} accounts={accounts} categories={categories} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onDeleteTransactions={handleDeleteTransactions} onSaveRule={handleSaveRule} />;
      case 'calendar':
        return <CalendarPage transactions={transactions} templates={templates} scheduledEvents={scheduledEvents} taskCompletions={taskCompletions} tasks={tasks} onAddEvent={handleAddEvent} onToggleTaskCompletion={handleToggleTaskCompletion} onToggleTask={handleToggleTask} transactionTypes={transactionTypes} onUpdateTransaction={handleUpdateTransaction} accounts={accounts} categories={categories} payees={payees} users={users} />;
      case 'reports':
        return <Reports transactions={transactions} transactionTypes={transactionTypes} categories={categories} payees={payees} users={users} />;
      case 'accounts':
        return <AccountsPage accounts={accounts} onAddAccount={handleAddAccount} onRemoveAccount={handleRemoveAccount} accountTypes={accountTypes} onAddAccountType={handleAddAccountType} onRemoveAccountType={handleRemoveAccountType} />;
      case 'users':
        return <UsersPage users={users} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} />;
      case 'payees':
        return <PayeesPage payees={payees} onSavePayee={handleSavePayee} onDeletePayee={handleDeletePayee} transactions={transactions}/>;
      case 'categories':
        return <CategoriesPage categories={categories} onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} transactions={transactions}/>;
      case 'rules':
        return <RulesPage rules={reconciliationRules} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} accounts={accounts} transactionTypes={transactionTypes} categories={categories} payees={payees} transactions={transactions} onUpdateTransactions={handleUpdateTransactions} />;
      case 'settings':
        return <SettingsPage transactionTypes={transactionTypes} onAddTransactionType={handleAddTransactionType} onRemoveTransactionType={handleRemoveTransactionType} transactions={transactions} />;
      case 'tasks':
        return <TasksPage tasks={tasks} onSaveTask={handleSaveTask} onDeleteTask={handleDeleteTask} onToggleTask={handleToggleTask} templates={templates} onSaveTemplate={handleSaveTemplate} onRemoveTemplate={handleRemoveTemplate} scheduledEvents={scheduledEvents} />;
      case 'hub':
        return <BusinessHub profile={businessProfile} onUpdateProfile={setBusinessProfile} documents={businessDocuments} onAddDocument={handleAddDocument} onRemoveDocument={handleRemoveDocument} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="md:hidden bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-3">
                <svg className="h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.75A.75.75 0 013 4.5h.75m0 0A.75.75 0 014.5 6v.75m0 0v-.75A.75.75 0 014.5 4.5h.75m0 0A.75.75 0 016 6v.75m0 0v-.75A.75.75 0 016 4.5h.75m0 0A.75.75 0 017.5 6v.75m0 0v-.75A.75.75 0 017.5 4.5h.75m0 0A.75.75 0 019 6v.75m0 0v-.75A.75.75 0 019 4.5h.75m0 0a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75h.75m0 0a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75H15M21.75 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h1 className="text-xl font-bold text-slate-800">FinParser</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
        </div>
      </header>
      
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar currentView={currentView} onNavigate={setCurrentView} transactions={transactions} />
        </div>
        
        <div className={`md:hidden fixed inset-0 z-30 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar currentView={currentView} onNavigate={(view) => { setCurrentView(view); setIsSidebarOpen(false); }} transactions={transactions} />
        </div>
        {isSidebarOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-20" onClick={() => setIsSidebarOpen(false)}></div>}

        <main className="flex-1 md:pl-64">
          <div className="container mx-auto p-4 md:p-8">
            {renderView()}
          </div>
        </main>
      </div>
      <Chatbot contextData={{ transactions, accounts, templates, scheduledEvents, tasks, businessProfile, businessDocuments }} />
    </div>
  );
};

export default App;
