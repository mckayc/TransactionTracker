

import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Payee, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession } from './types';
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
import Chatbot from './components/Chatbot';
import Loader from './components/Loader';
import { MenuIcon, CloseIcon } from './components/Icons';
import { calculateNextDate, formatDate } from './dateUtils';
import { generateUUID } from './utils';
import { api } from './services/apiService';
import { saveFile, deleteFile } from './services/storageService';

type View = 'dashboard' | 'transactions' | 'calendar' | 'accounts' | 'reports' | 'settings' | 'tasks' | 'rules' | 'payees' | 'categories' | 'tags' | 'users' | 'hub' | 'documents';

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
      
      // Migration: If LocalStorage has a key but DB doesn't, prefer LocalStorage first time and sync to DB
      if (!loadedSettings.apiKey) {
          const localKey = localStorage.getItem('user_api_key');
          if (localKey) {
              loadedSettings = { ...loadedSettings, apiKey: localKey };
              // The update effect below will trigger the save to DB
          }
      }
      
      // Sync DB setting to LocalStorage so geminiService can find it
      if (loadedSettings.apiKey) {
          localStorage.setItem('user_api_key', loadedSettings.apiKey);
      } else {
          localStorage.removeItem('user_api_key');
      }
      
      setSystemSettings(loadedSettings);

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
      
      // Parse URL Parameters for deep linking
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const taskId = params.get('taskId');
      
      if (viewParam && ['dashboard', 'transactions', 'calendar', 'accounts', 'reports', 'settings', 'tasks', 'rules', 'payees', 'categories', 'tags', 'users', 'hub', 'documents'].includes(viewParam)) {
          setCurrentView(viewParam as View);
      } else if (taskId) {
          // If taskId is present but no view, default to calendar context
          setCurrentView('calendar');
      }
      
      if (taskId) {
          setInitialTaskId(taskId);
      }

      setIsLoading(false);
    };
    loadData();
  }, []);

  // AUTOMATED BACKUP LOGIC
  useEffect(() => {
      if (isLoading) return;
      
      const checkAndRunBackup = async () => {
          const config = systemSettings.backupConfig;
          if (!config || config.frequency === 'never') return;

          const now = new Date();
          const lastRun = config.lastBackupDate ? new Date(config.lastBackupDate) : new Date(0);
          
          let shouldRun = false;
          const msPerDay = 24 * 60 * 60 * 1000;
          const daysSinceLast = (now.getTime() - lastRun.getTime()) / msPerDay;

          if (config.frequency === 'daily' && daysSinceLast >= 1) shouldRun = true;
          if (config.frequency === 'weekly' && daysSinceLast >= 7) shouldRun = true;
          if (config.frequency === 'monthly' && daysSinceLast >= 30) shouldRun = true;

          if (shouldRun) {
              console.log("Starting automated backup...");
              try {
                  // 1. Prepare Data
                  const exportData = {
                      exportDate: new Date().toISOString(),
                      version: '0.0.10-auto',
                      transactions, accounts, accountTypes, categories, tags, payees, 
                      reconciliationRules, templates, scheduledEvents, users, 
                      transactionTypes, businessProfile, documentFolders, savedReports,
                      chatSessions
                  };
                  const jsonString = JSON.stringify(exportData, null, 2);
                  const fileName = `AutoBackup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                  const file = new File([jsonString], fileName, { type: 'application/json' });
                  
                  // 2. Ensure Folder Exists
                  let autoFolder = documentFolders.find(f => f.name === "Automated Backups" && !f.parentId);
                  let autoFolderId = autoFolder?.id;
                  
                  if (!autoFolderId) {
                      autoFolderId = generateUUID();
                      const newFolder: DocumentFolder = {
                          id: autoFolderId,
                          name: "Automated Backups",
                          parentId: undefined,
                          createdAt: new Date().toISOString()
                      };
                      setDocumentFolders(prev => [...prev, newFolder]);
                      // Note: We update local state, but also need to persist it if the API save isn't triggered immediately by the effect below
                      await api.save('documentFolders', [...documentFolders, newFolder]); 
                  }

                  // 3. Save File
                  const docId = generateUUID();
                  await saveFile(docId, file);
                  
                  const newDoc: BusinessDocument = {
                      id: docId,
                      name: fileName,
                      uploadDate: new Date().toISOString().split('T')[0],
                      size: file.size,
                      mimeType: 'application/json',
                      parentId: autoFolderId,
                  };
                  
                  setBusinessDocuments(prev => [...prev, newDoc]);
                  
                  // 4. Update Last Run Date
                  const newConfig: BackupConfig = { ...config, lastBackupDate: new Date().toISOString() };
                  setSystemSettings(prev => ({ ...prev, backupConfig: newConfig }));

                  // 5. Prune Old Backups
                  const backups = [...businessDocuments, newDoc].filter(d => d.parentId === autoFolderId);
                  // Sort newest first
                  backups.sort((a, b) => b.name.localeCompare(a.name)); // Using name (timestamped) for sorting is robust enough here
                  
                  if (backups.length > config.retentionCount) {
                      const toDelete = backups.slice(config.retentionCount);
                      for (const doc of toDelete) {
                          await deleteFile(doc.id);
                      }
                      const idsToDelete = new Set(toDelete.map(d => d.id));
                      setBusinessDocuments(prev => prev.filter(d => !idsToDelete.has(d.id)));
                  }
                  console.log("Automated backup completed successfully.");

              } catch (e) {
                  console.error("Automated backup failed:", e);
              }
          }
      };

      // Run check immediately on load/change, but debounce slightly to ensure state is settled
      const timeout = setTimeout(checkAndRunBackup, 5000);
      return () => clearTimeout(timeout);

  }, [isLoading, systemSettings.backupConfig, transactions, accounts, categories, tags]); 


  // Save data to API whenever it changes
  
  useEffect(() => {
      if (isLoading) return;
      if (systemSettings.apiKey) {
          localStorage.setItem('user_api_key', systemSettings.apiKey);
      } else {
          localStorage.removeItem('user_api_key');
      }
      api.save('systemSettings', systemSettings);
  }, [systemSettings, isLoading]);

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
    const handler = setTimeout(() => api.save('tags', tags), 500);
    return () => clearTimeout(handler);
  }, [tags, isLoading]);

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

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('documentFolders', documentFolders), 500);
    return () => clearTimeout(handler);
  }, [documentFolders, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('savedReports', savedReports), 500);
    return () => clearTimeout(handler);
  }, [savedReports, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => api.save('chatSessions', chatSessions), 500);
    return () => clearTimeout(handler);
  }, [chatSessions, isLoading]);


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
  const handleUpdateAccount = (updatedAccount: Account) => setAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
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

  const handleSaveTag = (tag: Tag) => {
    setTags(prev => {
        const index = prev.findIndex(t => t.id === tag.id);
        if (index > -1) {
            const newTags = [...prev];
            newTags[index] = tag;
            return newTags;
        }
        return [...prev, tag];
    });
  };

  const handleDeleteTag = (tagId: string) => {
      setTags(prev => prev.filter(t => t.id !== tagId));
      // Clean up transactions that used this tag
      setTransactions(prev => prev.map(tx => {
          if (tx.tagIds && tx.tagIds.includes(tagId)) {
              return { ...tx, tagIds: tx.tagIds.filter(id => id !== tagId) };
          }
          return tx;
      }));
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
  const handleCreateFolder = (folder: DocumentFolder) => setDocumentFolders(prev => [...prev, folder]);
  const handleDeleteFolder = (folderId: string) => {
      // When deleting a folder, move its contents to root (undefined parent)
      setBusinessDocuments(prev => prev.map(d => d.parentId === folderId ? { ...d, parentId: undefined } : d));
      setDocumentFolders(prev => prev.filter(f => f.id !== folderId));
  };

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
        return <Dashboard onTransactionsAdded={handleTransactionsAdded} transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} rules={reconciliationRules} payees={payees} users={users} onAddDocument={handleAddDocument} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      case 'transactions':
        return <AllTransactions transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onDeleteTransactions={handleDeleteTransactions} onSaveRule={handleSaveRule} onSaveCategory={handleSaveCategory} onSavePayee={handleSavePayee} onAddTransactionType={handleAddTransactionType} />;
      case 'calendar':
        // Modified to pass handleSaveTask to support full editing from calendar
        // Added onAddTransaction for Donation modal support
        return <CalendarPage transactions={transactions} templates={templates} scheduledEvents={scheduledEvents} taskCompletions={taskCompletions} tasks={tasks} onAddEvent={handleAddEvent} onToggleTaskCompletion={handleToggleTaskCompletion} onToggleTask={handleToggleTask} transactionTypes={transactionTypes} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} accounts={accounts} categories={categories} tags={tags} payees={payees} users={users} initialTaskId={initialTaskId} />;
      case 'reports':
        return <Reports transactions={transactions} transactionTypes={transactionTypes} categories={categories} payees={payees} users={users} tags={tags} accounts={accounts} savedReports={savedReports} setSavedReports={setSavedReports} />;
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
        return <RulesPage rules={reconciliationRules} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} accounts={accounts} transactionTypes={transactionTypes} categories={categories} tags={tags} payees={payees} transactions={transactions} onUpdateTransactions={handleUpdateTransactions} onSaveCategory={handleSaveCategory} onSavePayee={handleSavePayee} onAddTransactionType={handleAddTransactionType} />;
      case 'settings':
        return <SettingsPage transactionTypes={transactionTypes} onAddTransactionType={handleAddTransactionType} onRemoveTransactionType={handleRemoveTransactionType} transactions={transactions} systemSettings={systemSettings} onUpdateSystemSettings={setSystemSettings} onAddDocument={handleAddDocument} accounts={accounts} categories={categories} tags={tags} payees={payees} rules={reconciliationRules} templates={templates} scheduledEvents={scheduledEvents} users={users} businessProfile={businessProfile} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      case 'tasks':
        return <TasksPage tasks={tasks} onSaveTask={handleSaveTask} onDeleteTask={handleDeleteTask} onToggleTask={handleToggleTask} templates={templates} onSaveTemplate={handleSaveTemplate} onRemoveTemplate={handleRemoveTemplate} scheduledEvents={scheduledEvents} />;
      case 'hub':
        return <BusinessHub profile={businessProfile} onUpdateProfile={setBusinessProfile} chatSessions={chatSessions} onUpdateChatSessions={setChatSessions} />;
      case 'documents':
        return <DocumentsPage documents={businessDocuments} folders={documentFolders} onAddDocument={handleAddDocument} onRemoveDocument={handleRemoveDocument} onCreateFolder={handleCreateFolder} onDeleteFolder={handleDeleteFolder} />;
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.75A.75.75 0 013 4.5h.75m0 0A.75.75 0 014.5 6v.75m0 0v-.75A.75.75 0 014.5 4.5h.75m0 0A.75.75 0 016 6v.75m0 0v-.75A.75.75 0 016 4.5h.75m0 0A.75.75 0 017.5 6v.75m0 0v-.75A.75.75 0 017.5 4.5h.75m0 0A.75.75 0 019 6v.75m0 0v-.75A.75.75 0 019 4.5h.75m0 0a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75H15M21.75 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
          <Sidebar 
            currentView={currentView} 
            onNavigate={setCurrentView} 
            transactions={transactions} 
            onChatToggle={() => setIsChatOpen(!isChatOpen)}
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        </div>
        
        <div className={`md:hidden fixed inset-0 z-30 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar 
            currentView={currentView} 
            onNavigate={(view) => { setCurrentView(view); setIsSidebarOpen(false); }} 
            transactions={transactions} 
            onChatToggle={() => { setIsChatOpen(!isChatOpen); setIsSidebarOpen(false); }}
          />
        </div>
        {isSidebarOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-20" onClick={() => setIsSidebarOpen(false)}></div>}

        <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
          <div className="container mx-auto p-4 md:p-8 h-screen flex flex-col">
            {renderView()}
          </div>
        </main>
      </div>
      <Chatbot 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        contextData={{ transactions, accounts, templates, scheduledEvents, tasks, businessProfile, businessDocuments }} 
      />
    </div>
  );
};

export default App;