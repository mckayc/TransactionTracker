
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
import { MenuIcon, CloseIcon } from './components/Icons';
import { calculateNextDate, formatDate } from './dateUtils';

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

  // Load data from localStorage on initial render
  useEffect(() => {
    const loadData = () => {
      const safeLoad = <T,>(key: string, fallback: T): T => {
          try {
              const stored = localStorage.getItem(key);
              if (stored) {
                  return JSON.parse(stored) as T;
              }
          } catch (error) {
              console.error(`Failed to load or parse '${key}' from localStorage. Clearing corrupted data.`, error);
              localStorage.removeItem(key);
          }
          return fallback;
      };

      // Handle Users first
      const parsedUsers = safeLoad<User[] | null>('users', null);
      let finalUsers: User[] = (Array.isArray(parsedUsers) && parsedUsers.length > 0)
          ? parsedUsers
          : [{ id: 'default-user', name: 'Primary User', isDefault: true }];
      setUsers(finalUsers);
      
      const defaultUserId = finalUsers.find(u => u.isDefault)?.id || finalUsers[0]?.id;

      // Handle Transactions
      const parsedTxs = safeLoad<Transaction[] | null>('transactions', null);
      if (Array.isArray(parsedTxs)) {
         if (parsedTxs.length > 0 && !parsedTxs[0].hasOwnProperty('userId')) {
            console.log("Migrating transactions to include user ID...");
            setTransactions(parsedTxs.map((tx: any) => ({ ...tx, userId: defaultUserId })));
         } else {
            setTransactions(parsedTxs);
         }
      } else {
          setTransactions([]);
      }

      // Handle Categories
      const parsedCategories = safeLoad<Category[] | string[] | null>('categories', null);
      if (Array.isArray(parsedCategories) && parsedCategories.length > 0) {
          if (typeof parsedCategories[0] === 'string') {
              setCategories((parsedCategories as string[]).map((name: string) => ({
                  id: `migrated-${name.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID().slice(0,4)}`,
                  name: name
              })));
          } else {
              setCategories(parsedCategories as Category[]);
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
      let finalAccountTypes = safeLoad<AccountType[] | null>('accountTypes', null);
      if (!Array.isArray(finalAccountTypes)) {
          finalAccountTypes = [
            { id: 'default-bank', name: 'Bank', isDefault: true },
            { id: 'default-cc', name: 'Credit Card', isDefault: true },
          ];
      }

      let finalAccounts = safeLoad<Account[] | null>('accounts', null);
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
    };
    loadData();
  }, []);

  // Save data to localStorage
  useEffect(() => {
    const handler = setTimeout(() => {
      try { localStorage.setItem('transactions', JSON.stringify(transactions)); } catch (e) { console.error(e); }
    }, 500);
    return () => clearTimeout(handler);
  }, [transactions]);
  // ... (other useEffects for saving state remain identical, omitted for brevity but assumed present)
  useEffect(() => { try { localStorage.setItem('accounts', JSON.stringify(accounts)); } catch (e) { } }, [accounts]);
  useEffect(() => { try { localStorage.setItem('accountTypes', JSON.stringify(accountTypes)); } catch (e) { } }, [accountTypes]);
  useEffect(() => { try { localStorage.setItem('transactionTypes', JSON.stringify(transactionTypes)); } catch (e) { } }, [transactionTypes]);
  useEffect(() => { try { localStorage.setItem('categories', JSON.stringify(categories)); } catch (e) { } }, [categories]);
  useEffect(() => { try { localStorage.setItem('templates', JSON.stringify(templates)); } catch (e) { } }, [templates]);
  useEffect(() => { try { localStorage.setItem('scheduledEvents', JSON.stringify(scheduledEvents)); } catch (e) { } }, [scheduledEvents]);
  useEffect(() => { try { localStorage.setItem('tasks', JSON.stringify(tasks)); } catch (e) { } }, [tasks]);
  useEffect(() => { try { localStorage.setItem('taskCompletions', JSON.stringify(taskCompletions)); } catch (e) { } }, [taskCompletions]);
  useEffect(() => { try { localStorage.setItem('reconciliationRules', JSON.stringify(reconciliationRules)); } catch (e) { } }, [reconciliationRules]);
  useEffect(() => { try { localStorage.setItem('payees', JSON.stringify(payees)); } catch (e) { } }, [payees]);
  useEffect(() => { try { localStorage.setItem('users', JSON.stringify(users)); } catch (e) { } }, [users]);
  useEffect(() => { try { localStorage.setItem('businessProfile', JSON.stringify(businessProfile)); } catch (e) { } }, [businessProfile]);
  useEffect(() => { try { localStorage.setItem('businessDocuments', JSON.stringify(businessDocuments)); } catch (e) { } }, [businessDocuments]);


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
          // If task is recurring and we just marked it completed, spawn the next one.
          if (isNowCompleted && task.recurrence && task.dueDate) {
              const nextDateStr = calculateNextDate(task.dueDate, task.recurrence);
              // Check end date
              if (!task.recurrence.endDate || nextDateStr <= task.recurrence.endDate) {
                  const nextTask: TaskItem = {
                      ...task,
                      id: crypto.randomUUID(),
                      dueDate: nextDateStr,
                      isCompleted: false,
                      createdAt: new Date().toISOString(),
                      // Reset subtasks for the new instance? Usually yes.
                      subtasks: task.subtasks?.map(st => ({...st, isCompleted: false})),
                      // The new task keeps the recurrence rule so it can spawn the next one too.
                  };
                  
                  // Optional: We could remove recurrence from the OLD task so it's just a record of the past.
                  // updatedTasks[updatedTasks.findIndex(t => t.id === taskId)].recurrence = undefined; 
                  
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
