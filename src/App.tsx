


import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Payee, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, YouTubeMetric } from './types';
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
import TagsPage from './views/TagsPage';
import UsersPage from './views/UsersPage';
import BusinessHub from './views/BusinessHub';
import DocumentsPage from './views/DocumentsPage';
import IntegrationsPage from './views/IntegrationsPage';
import AmazonIntegration from './views/integrations/AmazonIntegration';
import YouTubeIntegration from './views/integrations/YouTubeIntegration';
import Chatbot from './components/Chatbot';
import Loader from './components/Loader';
import { MenuIcon, CloseIcon } from './components/Icons';
import { calculateNextDate, formatDate } from './dateUtils';
import { generateUUID } from './utils';
import { api } from './services/apiService';
import { saveFile, deleteFile } from './services/storageService';

type View = 'dashboard' | 'transactions' | 'calendar' | 'accounts' | 'reports' | 'settings' | 'tasks' | 'rules' | 'payees' | 'categories' | 'tags' | 'users' | 'hub' | 'documents' | 'integrations' | 'integration-amazon' | 'integration-youtube';

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
    // Investments
    { id: 'default-investment-contribution', name: 'Investment Contribution', balanceEffect: 'investment', isDefault: true },
    { id: 'default-investment-purchase', name: 'Asset Purchase', balanceEffect: 'investment', isDefault: true },
    // Donations
    { id: 'default-donation-charity', name: 'Charitable Donation', balanceEffect: 'donation', isDefault: true },
    { id: 'default-donation-gift', name: 'Gift', balanceEffect: 'donation', isDefault: true },
    // A fallback 'Other' for each type
    { id: 'default-expense-other', name: 'Other Expense', balanceEffect: 'expense', isDefault: true },
    { id: 'default-income-other', name: 'Other Income', balanceEffect: 'income', isDefault: true },
    { id: 'default-transfer-other', name: 'Other Transfer', balanceEffect: 'transfer', isDefault: true },
    { id: 'default-investment-other', name: 'Other Investment', balanceEffect: 'investment', isDefault: true },
    { id: 'default-donation-other', name: 'Other Donation', balanceEffect: 'donation', isDefault: true },
];


const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<TaskCompletions>({});
  const [reconciliationRules, setReconciliationRules] = useState<ReconciliationRule[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({ info: {}, tax: {}, completedSteps: [] });
  const [businessDocuments, setBusinessDocuments] = useState<BusinessDocument[]>([]);
  const [documentFolders, setDocumentFolders] = useState<DocumentFolder[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [savedDateRanges, setSavedDateRanges] = useState<CustomDateRange[]>([]);
  const [amazonMetrics, setAmazonMetrics] = useState<AmazonMetric[]>([]);
  const [youtubeMetrics, setYoutubeMetrics] = useState<YouTubeMetric[]>([]);
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [initialTaskId, setInitialTaskId] = useState<string | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Load data from API on initial render
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await api.loadAll();

      const safeLoad = <T,>(key: string, fallback: T): T => {
          return (data[key] as T) || fallback;
      };

      // Handle System Settings & API Key Sync
      let loadedSettings = safeLoad<SystemSettings>('systemSettings', {});
      if (!loadedSettings.apiKey) {
          const localKey = localStorage.getItem('user_api_key');
          if (localKey) {
              loadedSettings = { ...loadedSettings, apiKey: localKey };
          }
      }
      
      if (loadedSettings.apiKey) {
          localStorage.setItem('user_api_key', loadedSettings.apiKey);
      } else {
          localStorage.removeItem('user_api_key');
      }
      
      setSystemSettings(loadedSettings);

      const loadedUsers = safeLoad<User[]>('users', []);
      let finalUsers: User[] = (Array.isArray(loadedUsers) && loadedUsers.length > 0)
          ? loadedUsers
          : [{ id: 'default-user', name: 'Primary User', isDefault: true }];
      setUsers(finalUsers);
      
      const defaultUserId = finalUsers.find(u => u.isDefault)?.id || finalUsers[0]?.id;

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

      const loadedCategories = safeLoad<Category[] | string[]>('categories', []);
      if (Array.isArray(loadedCategories) && loadedCategories.length > 0) {
          if (typeof loadedCategories[0] === 'string') {
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
      setTags(safeLoad<Tag[]>('tags', []));
      setTemplates(safeLoad<Template[]>('templates', []));
      setScheduledEvents(safeLoad<ScheduledEvent[]>('scheduledEvents', []));
      setTasks(safeLoad<TaskItem[]>('tasks', []));
      setTaskCompletions(safeLoad<TaskCompletions>('taskCompletions', {}));
      setReconciliationRules(safeLoad<ReconciliationRule[]>('reconciliationRules', []));
      setPayees(safeLoad<Payee[]>('payees', []));
      setBusinessProfile(safeLoad<BusinessProfile>('businessProfile', { info: {}, tax: {}, completedSteps: [] }));
      setBusinessDocuments(safeLoad<BusinessDocument[]>('businessDocuments', []));
      setDocumentFolders(safeLoad<DocumentFolder[]>('documentFolders', []));
      setSavedReports(safeLoad<SavedReport[]>('savedReports', []));
      setChatSessions(safeLoad<ChatSession[]>('chatSessions', []));
      setSavedDateRanges(safeLoad<CustomDateRange[]>('savedDateRanges', []));
      setAmazonMetrics(safeLoad<AmazonMetric[]>('amazonMetrics', []));
      setYoutubeMetrics(safeLoad<YouTubeMetric[]>('youtubeMetrics', []));

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
      
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const taskId = params.get('taskId');
      
      if (viewParam && ['dashboard', 'transactions', 'calendar', 'accounts', 'reports', 'settings', 'tasks', 'rules', 'payees', 'categories', 'tags', 'users', 'hub', 'documents', 'integrations', 'integration-amazon', 'integration-youtube'].includes(viewParam)) {
          setCurrentView(viewParam as View);
      } else if (taskId) {
          setCurrentView('calendar');
      }
      
      if (taskId) {
          setInitialTaskId(taskId);
      }

      setIsLoading(false);
    };
    loadData();
  }, []);

  // AUTOMATED BACKUP LOGIC (Abbreviated)
  useEffect(() => {
      // ... existing backup logic ...
  }, [isLoading, systemSettings.backupConfig, transactions, accounts, categories, tags]); 

  // Save effects
  useEffect(() => { if (!isLoading) api.save('systemSettings', systemSettings); }, [systemSettings, isLoading]);
  useEffect(() => { if (!isLoading) setTimeout(() => api.save('transactions', transactions), 1000); }, [transactions, isLoading]);
  useEffect(() => { if (!isLoading) setTimeout(() => api.save('accounts', accounts), 500); }, [accounts, isLoading]);
  useEffect(() => { if (!isLoading) setTimeout(() => api.save('categories', categories), 500); }, [categories, isLoading]);
  useEffect(() => { if (!isLoading) setTimeout(() => api.save('amazonMetrics', amazonMetrics), 500); }, [amazonMetrics, isLoading]);
  useEffect(() => { if (!isLoading) setTimeout(() => api.save('youtubeMetrics', youtubeMetrics), 500); }, [youtubeMetrics, isLoading]);


  // Handlers
  const handleTransactionsAdded = (newTransactions: Transaction[], newCategories: Category[]) => {
    if (newCategories.length > 0) {
      setCategories(prev => [...prev, ...newCategories]);
    }
    setTransactions(prev => [...prev, ...newTransactions]);
  };

  const handleUpdateTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
  };

  const handleAddTransaction = (newTransaction: Transaction) => {
    setTransactions(prev => [...prev, newTransaction]);
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setTransactions(prev => prev.filter(t => t.id !== transactionId));
  };

  const handleDeleteTransactions = (transactionIds: string[]) => {
    const idSet = new Set(transactionIds);
    setTransactions(prev => prev.filter(t => !idSet.has(t.id)));
  };

  const handleSaveRule = (rule: ReconciliationRule) => {
    setReconciliationRules(prev => {
        const exists = prev.find(r => r.id === rule.id);
        if (exists) return prev.map(r => r.id === rule.id ? rule : r);
        return [...prev, rule];
    });
  };

  const handleDeleteRule = (ruleId: string) => {
      setReconciliationRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleSaveCategory = (category: Category) => {
    setCategories(prev => {
        const exists = prev.find(c => c.id === category.id);
        if (exists) return prev.map(c => c.id === category.id ? category : c);
        return [...prev, category];
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
      setCategories(prev => prev.filter(c => c.id !== categoryId));
  };

  const handleSavePayee = (payee: Payee) => {
    setPayees(prev => {
        const exists = prev.find(p => p.id === payee.id);
        if (exists) return prev.map(p => p.id === payee.id ? payee : p);
        return [...prev, payee];
    });
  };

  const handleDeletePayee = (payeeId: string) => {
      setPayees(prev => prev.filter(p => p.id !== payeeId));
  };

  const handleSaveTag = (tag: Tag) => {
      setTags(prev => {
          const exists = prev.find(t => t.id === tag.id);
          if (exists) return prev.map(t => t.id === tag.id ? tag : t);
          return [...prev, tag];
      });
  };

  const handleDeleteTag = (tagId: string) => {
      setTags(prev => prev.filter(t => t.id !== tagId));
  };

  const handleAddTransactionType = (type: TransactionType) => {
      setTransactionTypes(prev => [...prev, type]);
  };

  const handleRemoveTransactionType = (typeId: string) => {
      setTransactionTypes(prev => prev.filter(t => t.id !== typeId));
  };

  const handleAddSavedReport = (report: SavedReport) => {
      setSavedReports(prev => {
          // If report exists (by ID), update it. Else add.
          const exists = prev.findIndex(r => r.id === report.id);
          if (exists >= 0) {
              const updated = [...prev];
              updated[exists] = report;
              return updated;
          }
          return [...prev, report];
      });
  };

  const handleAddEvent = (event: ScheduledEvent) => {
      setScheduledEvents(prev => [...prev, event]);
  };

  const handleSaveTask = (task: TaskItem) => {
      setTasks(prev => {
          const exists = prev.find(t => t.id === task.id);
          if (exists) return prev.map(t => t.id === task.id ? task : t);
          return [...prev, task];
      });
  };

  const handleDeleteTask = (taskId: string) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleToggleTask = (taskId: string) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const handleToggleTaskCompletion = (date: string, eventId: string, taskId: string) => {
      // This seems to be for scheduled event instances, but logic is handled in `taskCompletions`
      setTaskCompletions(prev => {
          const dateCompletions = prev[date] || {};
          const eventCompletions = dateCompletions[eventId] || [];
          const newEventCompletions = eventCompletions.includes(taskId) 
              ? eventCompletions.filter(id => id !== taskId)
              : [...eventCompletions, taskId];
          
          return {
              ...prev,
              [date]: {
                  ...dateCompletions,
                  [eventId]: newEventCompletions
              }
          };
      });
  };

  const handleAddAccount = (account: Account) => {
      setAccounts(prev => [...prev, account]);
  };

  const handleUpdateAccount = (account: Account) => {
      setAccounts(prev => prev.map(a => a.id === account.id ? account : a));
  };

  const handleRemoveAccount = (accountId: string) => {
      setAccounts(prev => prev.filter(a => a.id !== accountId));
  };

  const handleAddAccountType = (type: AccountType) => {
      setAccountTypes(prev => [...prev, type]);
  };

  const handleRemoveAccountType = (typeId: string) => {
      setAccountTypes(prev => prev.filter(t => t.id !== typeId));
  };

  const handleSaveUser = (user: User) => {
      setUsers(prev => {
          const exists = prev.find(u => u.id === user.id);
          if (exists) return prev.map(u => u.id === user.id ? user : u);
          return [...prev, user];
      });
  };

  const handleDeleteUser = (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleUpdateTransactions = (updatedTransactions: Transaction[]) => {
      // Batch update
      setTransactions(prev => {
          const updatesMap = new Map(updatedTransactions.map(t => [t.id, t]));
          return prev.map(t => updatesMap.has(t.id) ? updatesMap.get(t.id)! : t);
      });
  };

  const handleSaveTemplate = (template: Template) => {
      setTemplates(prev => {
          const exists = prev.find(t => t.id === template.id);
          if (exists) return prev.map(t => t.id === template.id ? template : t);
          return [...prev, template];
      });
  };

  const handleRemoveTemplate = (templateId: string) => {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const handleAddDocument = (doc: BusinessDocument) => {
      setBusinessDocuments(prev => [...prev, doc]);
  };

  const handleRemoveDocument = (docId: string) => {
      setBusinessDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleCreateFolder = (folder: DocumentFolder) => {
      setDocumentFolders(prev => [...prev, folder]);
  };

  const handleDeleteFolder = (folderId: string) => {
      setDocumentFolders(prev => prev.filter(f => f.id !== folderId));
  };

  const handleAddAmazonMetrics = (newMetrics: AmazonMetric[]) => {
      if(newMetrics.length > 0) {
          setAmazonMetrics(prev => [...prev, ...newMetrics].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
  };

  const handleDeleteAmazonMetrics = (ids: string[]) => {
      const idsSet = new Set(ids);
      setAmazonMetrics(prev => prev.filter(m => !idsSet.has(m.id)));
  };

  const handleUpdateAmazonMetric = (updated: AmazonMetric) => {
      setAmazonMetrics(prev => prev.map(m => m.id === updated.id ? updated : m));
  }

  const handleAddYouTubeMetrics = (newMetrics: YouTubeMetric[]) => {
      if(newMetrics.length > 0) {
          setYoutubeMetrics(prev => [...prev, ...newMetrics].sort((a,b) => b.revenue - a.revenue));
      }
  }

  const handleDeleteYouTubeMetrics = (ids: string[]) => {
      const idsSet = new Set(ids);
      setYoutubeMetrics(prev => prev.filter(m => !idsSet.has(m.id)));
  }

  if (isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-100">
              <Loader message="Loading your data..." />
          </div>
      );
  }

  // View Routing
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onTransactionsAdded={handleTransactionsAdded} transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} rules={reconciliationRules} payees={payees} users={users} onAddDocument={handleAddDocument} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      case 'transactions':
        return <AllTransactions transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onDeleteTransactions={handleDeleteTransactions} onSaveRule={handleSaveRule} onSaveCategory={handleSaveCategory} onSavePayee={handleSavePayee} onSaveTag={handleSaveTag} onAddTransactionType={handleAddTransactionType} onSaveReport={handleAddSavedReport} />;
      // ... other cases ...
      case 'calendar':
        return <CalendarPage transactions={transactions} templates={templates} scheduledEvents={scheduledEvents} taskCompletions={taskCompletions} tasks={tasks} onAddEvent={handleAddEvent} onToggleTaskCompletion={handleToggleTaskCompletion} onToggleTask={handleToggleTask} transactionTypes={transactionTypes} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} accounts={accounts} categories={categories} tags={tags} payees={payees} users={users} initialTaskId={initialTaskId} />;
      case 'reports':
        return <Reports transactions={transactions} amazonMetrics={amazonMetrics} transactionTypes={transactionTypes} categories={categories} payees={payees} users={users} tags={tags} accounts={accounts} savedReports={savedReports} setSavedReports={setSavedReports} savedDateRanges={savedDateRanges} setSavedDateRanges={setSavedDateRanges} />;
      case 'accounts':
        return <AccountsPage accounts={accounts} onAddAccount={handleAddAccount} onUpdateAccount={handleUpdateAccount} onRemoveAccount={handleRemoveAccount} accountTypes={accountTypes} onAddAccountType={handleAddAccountType} onRemoveAccountType={handleRemoveAccountType} />;
      case 'users':
        return <UsersPage users={users} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} />;
      case 'payees':
        return <PayeesPage payees={payees} onSavePayee={handleSavePayee} onDeletePayee={handleDeletePayee} transactions={transactions}/>;
      case 'categories':
        return <CategoriesPage categories={categories} onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} transactions={transactions}/>;
      case 'tags':
        return <TagsPage tags={tags} onSaveTag={handleSaveTag} onDeleteTag={handleDeleteTag} />;
      case 'rules':
        return <RulesPage rules={reconciliationRules} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} accounts={accounts} transactionTypes={transactionTypes} categories={categories} tags={tags} payees={payees} transactions={transactions} onUpdateTransactions={handleUpdateTransactions} onSaveCategory={handleSaveCategory} onSavePayee={handleSavePayee} onSaveTag={handleSaveTag} onAddTransactionType={handleAddTransactionType} />;
      case 'settings':
        return <SettingsPage transactionTypes={transactionTypes} onAddTransactionType={handleAddTransactionType} onRemoveTransactionType={handleRemoveTransactionType} transactions={transactions} systemSettings={systemSettings} onUpdateSystemSettings={setSystemSettings} onAddDocument={handleAddDocument} accounts={accounts} categories={categories} tags={tags} payees={payees} rules={reconciliationRules} templates={templates} scheduledEvents={scheduledEvents} users={users} businessProfile={businessProfile} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      case 'tasks':
        return <TasksPage tasks={tasks} onSaveTask={handleSaveTask} onDeleteTask={handleDeleteTask} onToggleTask={handleToggleTask} templates={templates} onSaveTemplate={handleSaveTemplate} onRemoveTemplate={handleRemoveTemplate} scheduledEvents={scheduledEvents} />;
      case 'hub':
        return <BusinessHub profile={businessProfile} onUpdateProfile={setBusinessProfile} chatSessions={chatSessions} onUpdateChatSessions={setChatSessions} transactions={transactions} accounts={accounts} categories={categories} />;
      case 'documents':
        return <DocumentsPage documents={businessDocuments} folders={documentFolders} onAddDocument={handleAddDocument} onRemoveDocument={handleRemoveDocument} onCreateFolder={handleCreateFolder} onDeleteFolder={handleDeleteFolder} />;
      case 'integrations':
        return <IntegrationsPage onNavigate={setCurrentView} />;
      case 'integration-amazon':
        return <AmazonIntegration 
            metrics={amazonMetrics} 
            onAddMetrics={handleAddAmazonMetrics} 
            onDeleteMetrics={handleDeleteAmazonMetrics}
            onUpdateMetric={handleUpdateAmazonMetric}
        />;
      case 'integration-youtube':
        return <YouTubeIntegration 
            metrics={youtubeMetrics}
            onAddMetrics={handleAddYouTubeMetrics}
            onDeleteMetrics={handleDeleteYouTubeMetrics}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* ... header ... */}
      <header className="md:hidden bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-3">
                <span className="text-2xl filter drop-shadow-sm">💰</span>
                <h1 className="text-base font-bold text-slate-800 uppercase tracking-wide">Transaction Tracker</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
        </div>
      </header>
      
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar currentView={currentView} onNavigate={setCurrentView} transactions={transactions} onChatToggle={() => setIsChatOpen(!isChatOpen)} isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
        </div>
        
        <div className={`md:hidden fixed inset-0 z-30 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar currentView={currentView} onNavigate={(view) => { setCurrentView(view); setIsSidebarOpen(false); }} transactions={transactions} onChatToggle={() => { setIsChatOpen(!isChatOpen); setIsSidebarOpen(false); }} />
        </div>
        {isSidebarOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-20" onClick={() => setIsSidebarOpen(false)}></div>}

        <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
          <div className="container mx-auto p-4 md:p-8 h-screen flex flex-col">
            {renderView()}
          </div>
        </main>
      </div>
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} contextData={{ transactions, accounts, templates, scheduledEvents, tasks, businessProfile, businessDocuments }} />
    </div>
  );
};

export default App;
