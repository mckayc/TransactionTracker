import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Payee, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, YouTubeMetric, YouTubeChannel } from './types';
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
    { id: 'default-expense-purchase', name: 'Purchase', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-bill', name: 'Bill Payment', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-fee', name: 'Fee', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-interest', name: 'Interest Charge', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-withdrawal', name: 'Withdrawal', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-tax', name: 'Tax Payment', balanceEffect: 'expense', isDefault: true },
    { id: 'default-income-deposit', name: 'Direct Deposit', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-interest', name: 'Interest Earned', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-paycheck', name: 'Paycheck', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-refund', name: 'Refund', balanceEffect: 'income', isDefault: true },
    { id: 'default-income-sales', name: 'Sales', balanceEffect: 'income', isDefault: true },
    { id: 'default-transfer-payment', name: 'Credit Card Payment', balanceEffect: 'transfer', isDefault: true },
    { id: 'default-transfer-transfer', name: 'Transfer', balanceEffect: 'transfer', isDefault: true },
    { id: 'default-investment-contribution', name: 'Investment Contribution', balanceEffect: 'investment', isDefault: true },
    { id: 'default-investment-purchase', name: 'Asset Purchase', balanceEffect: 'investment', isDefault: true },
    { id: 'default-donation-charity', name: 'Charitable Donation', balanceEffect: 'donation', isDefault: true },
    { id: 'default-donation-gift', name: 'Gift', balanceEffect: 'donation', isDefault: true },
    { id: 'default-expense-other', name: 'Other Expense', balanceEffect: 'expense', isDefault: true },
    { id: 'default-income-other', name: 'Other Income', balanceEffect: 'income', isDefault: true },
    { id: 'default-transfer-other', name: 'Other Transfer', balanceEffect: 'transfer', isDefault: true },
    { id: 'default-investment-other', name: 'Other Investment', balanceEffect: 'investment', isDefault: true },
    { id: 'default-donation-other', name: 'Other Donation', balanceEffect: 'donation', isDefault: true },
];


const App: React.FC = () => {
  const [isStructureLoading, setIsStructureLoading] = useState(true);
  const [isHeavyDataLoading, setIsHeavyDataLoading] = useState(true);
  
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
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [initialTaskId, setInitialTaskId] = useState<string | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Progressive Loading Strategy
  useEffect(() => {
    document.body.classList.add('loaded');

    const loadCoreStructure = async () => {
      setIsStructureLoading(true);
      
      // Fetch small metadata keys in parallel
      const [
          settings, 
          loadedUsers, 
          loadedAccounts, 
          loadedAccountTypes, 
          loadedCategories, 
          loadedTags, 
          loadedPayees, 
          loadedRules, 
          loadedTypes
      ] = await Promise.all([
          api.get<SystemSettings>('systemSettings'),
          api.get<User[]>('users'),
          api.get<Account[]>('accounts'),
          api.get<AccountType[]>('accountTypes'),
          api.get<Category[]>('categories'),
          api.get<Tag[]>('tags'),
          api.get<Payee[]>('payees'),
          api.get<ReconciliationRule[]>('reconciliationRules'),
          api.get<TransactionType[]>('transactionTypes')
      ]);

      // Handle Settings
      let finalSettings = settings || {};
      if (!finalSettings.apiKey) {
          const localKey = localStorage.getItem('user_api_key');
          if (localKey) finalSettings = { ...finalSettings, apiKey: localKey };
      }
      setSystemSettings(finalSettings);

      // Handle Users
      let finalUsers: User[] = loadedUsers && loadedUsers.length > 0
          ? loadedUsers
          : [{ id: 'default-user', name: 'Primary User', isDefault: true }];
      setUsers(finalUsers);

      // Handle Categories
      setCategories(loadedCategories && loadedCategories.length > 0 ? loadedCategories as Category[] : DEFAULT_CATEGORIES);
      
      // Handle other structure
      setTransactionTypes(loadedTypes || DEFAULT_TRANSACTION_TYPES);
      setTags(loadedTags || []);
      setPayees(loadedPayees || []);
      setReconciliationRules(loadedRules || []);

      // Handle Accounts
      let finalAccountTypes = loadedAccountTypes || [{ id: 'default-bank', name: 'Bank', isDefault: true }, { id: 'default-cc', name: 'Credit Card', isDefault: true }];
      let finalAccounts = loadedAccounts || [{ id: 'default-account-other', name: 'Other', identifier: 'Default Account', accountTypeId: 'default-bank' }];
      setAccountTypes(finalAccountTypes);
      setAccounts(finalAccounts);

      setIsStructureLoading(false);

      // Now load heavy data in background
      loadHeavyData(finalUsers.find(u => u.isDefault)?.id || finalUsers[0]?.id);
    };

    const loadHeavyData = async (defaultUserId: string) => {
        setIsHeavyDataLoading(true);
        const [
            txs, 
            templates, 
            events, 
            tasks, 
            completions, 
            profile, 
            docs, 
            folders, 
            reports, 
            chats, 
            ranges, 
            amazon, 
            youtubeM, 
            youtubeC
        ] = await Promise.all([
            api.get<Transaction[]>('transactions'),
            api.get<Template[]>('templates'),
            api.get<ScheduledEvent[]>('scheduledEvents'),
            api.get<TaskItem[]>('tasks'),
            api.get<TaskCompletions>('taskCompletions'),
            api.get<BusinessProfile>('businessProfile'),
            api.get<BusinessDocument[]>('businessDocuments'),
            api.get<DocumentFolder[]>('documentFolders'),
            api.get<SavedReport[]>('savedReports'),
            api.get<ChatSession[]>('chatSessions'),
            api.get<CustomDateRange[]>('savedDateRanges'),
            api.get<AmazonMetric[]>('amazonMetrics'),
            api.get<YouTubeMetric[]>('youtubeMetrics'),
            api.get<YouTubeChannel[]>('youtubeChannels')
        ]);

        setTransactions(txs || []);
        setTemplates(templates || []);
        setScheduledEvents(events || []);
        setTasks(tasks || []);
        setTaskCompletions(completions || {});
        setBusinessProfile(profile || { info: {}, tax: {}, completedSteps: [] });
        setBusinessDocuments(docs || []);
        setDocumentFolders(folders || []);
        setSavedReports(reports || []);
        setChatSessions(chats || []);
        setSavedDateRanges(ranges || []);
        setAmazonMetrics(amazon || []);
        setYoutubeMetrics(youtubeM || []);
        setYoutubeChannels(youtubeC || []);

        setIsHeavyDataLoading(false);
    };

    loadCoreStructure();

    // Parse Deep Linking from URL
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const taskId = params.get('taskId');
    if (viewParam) setCurrentView(viewParam as View);
    if (taskId) setInitialTaskId(taskId);

  }, []);

  // AUTOMATED BACKUP LOGIC
  useEffect(() => {
      if (isHeavyDataLoading) return;
      const checkAndRunBackup = async () => {
          const config = systemSettings.backupConfig;
          if (!config || config.frequency === 'never') return;
          const now = new Date();
          const lastRun = config.lastBackupDate ? new Date(config.lastBackupDate) : new Date(0);
          const msPerDay = 24 * 60 * 60 * 1000;
          const daysSinceLast = (now.getTime() - lastRun.getTime()) / msPerDay;
          let shouldRun = (config.frequency === 'daily' && daysSinceLast >= 1) || (config.frequency === 'weekly' && daysSinceLast >= 7) || (config.frequency === 'monthly' && daysSinceLast >= 30);
          if (shouldRun) {
              try {
                  const exportData = { exportDate: new Date().toISOString(), version: '0.0.10-auto', transactions, accounts, accountTypes, categories, tags, payees, reconciliationRules, templates, scheduledEvents, users, transactionTypes, businessProfile, documentFolders, savedReports, chatSessions, savedDateRanges, amazonMetrics, youtubeMetrics, youtubeChannels };
                  const fileName = `AutoBackup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                  const file = new File([JSON.stringify(exportData, null, 2)], fileName, { type: 'application/json' });
                  let autoFolder = documentFolders.find(f => f.name === "Automated Backups" && !f.parentId);
                  let autoFolderId = autoFolder?.id;
                  if (!autoFolderId) {
                      autoFolderId = generateUUID();
                      const newFolder: DocumentFolder = { id: autoFolderId, name: "Automated Backups", parentId: undefined, createdAt: new Date().toISOString() };
                      setDocumentFolders(prev => [...prev, newFolder]);
                      await api.save('documentFolders', [...documentFolders, newFolder]); 
                  }
                  const docId = generateUUID();
                  await saveFile(docId, file);
                  const newDoc: BusinessDocument = { id: docId, name: fileName, uploadDate: new Date().toISOString().split('T')[0], size: file.size, mimeType: 'application/json', parentId: autoFolderId };
                  setBusinessDocuments(prev => [...prev, newDoc]);
                  const newConfig: BackupConfig = { ...config, lastBackupDate: new Date().toISOString() };
                  setSystemSettings(prev => ({ ...prev, backupConfig: newConfig }));
                  const backups = [...businessDocuments, newDoc].filter(d => d.parentId === autoFolderId).sort((a, b) => b.name.localeCompare(a.name));
                  if (backups.length > config.retentionCount) {
                      const toDelete = backups.slice(config.retentionCount);
                      for (const doc of toDelete) await deleteFile(doc.id);
                      const idsToDelete = new Set(toDelete.map(d => d.id));
                      setBusinessDocuments(prev => prev.filter(d => !idsToDelete.has(d.id)));
                  }
              } catch (e) { console.error("Automated backup failed:", e); }
          }
      };
      const timeout = setTimeout(checkAndRunBackup, 5000);
      return () => clearTimeout(timeout);
  }, [isHeavyDataLoading, systemSettings.backupConfig, transactions, accounts, categories, tags]); 

  // Persistence hooks
  useEffect(() => {
      if (isStructureLoading) return;
      if (systemSettings.apiKey) localStorage.setItem('user_api_key', systemSettings.apiKey);
      else localStorage.removeItem('user_api_key');
      api.save('systemSettings', systemSettings);
  }, [systemSettings, isStructureLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('transactions', transactions), 1000); return () => clearTimeout(h); }, [transactions, isHeavyDataLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('accounts', accounts), 500); return () => clearTimeout(h); }, [accounts, isStructureLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('accountTypes', accountTypes), 500); return () => clearTimeout(h); }, [accountTypes, isStructureLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('transactionTypes', transactionTypes), 500); return () => clearTimeout(h); }, [transactionTypes, isStructureLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('categories', categories), 500); return () => clearTimeout(h); }, [categories, isStructureLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('tags', tags), 500); return () => clearTimeout(h); }, [tags, isStructureLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('templates', templates), 500); return () => clearTimeout(h); }, [templates, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('scheduledEvents', scheduledEvents), 500); return () => clearTimeout(h); }, [scheduledEvents, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('tasks', tasks), 500); return () => clearTimeout(h); }, [tasks, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('taskCompletions', taskCompletions), 500); return () => clearTimeout(h); }, [taskCompletions, isHeavyDataLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('reconciliationRules', reconciliationRules), 500); return () => clearTimeout(h); }, [reconciliationRules, isStructureLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('payees', payees), 500); return () => clearTimeout(h); }, [payees, isStructureLoading]);
  useEffect(() => { if (isStructureLoading) return; const h = setTimeout(() => api.save('users', users), 500); return () => clearTimeout(h); }, [users, isStructureLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('businessProfile', businessProfile), 500); return () => clearTimeout(h); }, [businessProfile, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('businessDocuments', businessDocuments), 500); return () => clearTimeout(h); }, [businessDocuments, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('documentFolders', documentFolders), 500); return () => clearTimeout(h); }, [documentFolders, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('savedReports', savedReports), 500); return () => clearTimeout(h); }, [savedReports, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('chatSessions', chatSessions), 500); return () => clearTimeout(h); }, [chatSessions, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('savedDateRanges', savedDateRanges), 500); return () => clearTimeout(h); }, [savedDateRanges, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('amazonMetrics', amazonMetrics), 500); return () => clearTimeout(h); }, [amazonMetrics, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('youtubeMetrics', youtubeMetrics), 500); return () => clearTimeout(h); }, [youtubeMetrics, isHeavyDataLoading]);
  useEffect(() => { if (isHeavyDataLoading) return; const h = setTimeout(() => api.save('youtubeChannels', youtubeChannels), 500); return () => clearTimeout(h); }, [youtubeChannels, isHeavyDataLoading]);

  // Handlers
  const handleTransactionsAdded = (newlyAdded: Transaction[], newlyCreatedCategories: Category[]) => {
      if (newlyCreatedCategories.length > 0) setCategories(prev => [...prev, ...newlyCreatedCategories]);
      if (newlyAdded.length > 0) setTransactions(prev => [...prev, ...newlyAdded].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };
  const handleAddTransaction = (newTransaction: Transaction) => setTransactions(prev => [...prev, newTransaction].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  const handleUpdateTransaction = (updatedTransaction: Transaction) => setTransactions(prev => prev.map(tx => tx.id === updatedTransaction.id ? updatedTransaction : tx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  const handleUpdateTransactions = (updatedTransactions: Transaction[]) => { const updatedTxMap = new Map(updatedTransactions.map(tx => [tx.id, tx])); setTransactions(prev => prev.map(tx => updatedTxMap.has(tx.id) ? updatedTxMap.get(tx.id)! : tx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())); };
  const handleDeleteTransaction = (transactionId: string) => setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
  const handleDeleteTransactions = (transactionIds: string[]) => { const idsToDelete = new Set(transactionIds); setTransactions(prev => prev.filter(tx => !idsToDelete.has(tx.id))); };
  const handleAddAccount = (account: Account) => setAccounts(prev => [...prev, account]);
  const handleUpdateAccount = (updatedAccount: Account) => setAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
  const handleRemoveAccount = (accountId: string) => setAccounts(prev => prev.filter(c => c.id !== accountId));
  const handleAddAccountType = (type: AccountType) => setAccountTypes(prev => [...prev, type]);
  const handleRemoveAccountType = (typeId: string) => setAccountTypes(prev => prev.filter(p => p.id !== typeId));
  const handleAddTransactionType = (type: TransactionType) => setTransactionTypes(prev => [...prev, type]);
  const handleRemoveTransactionType = (typeId: string) => setTransactionTypes(prev => prev.filter(t => t.id !== typeId));
  const handleSaveTemplate = (template: Template) => setTemplates(prev => { const index = prev.findIndex(t => t.id === template.id); if (index > -1) { const newTemplates = [...prev]; newTemplates[index] = template; return newTemplates; } return [...prev, template]; });
  const handleRemoveTemplate = (templateId: string) => { setTemplates(prev => prev.filter(t => t.id !== templateId)); setScheduledEvents(prev => prev.filter(e => e.templateId !== templateId)); };
  const handleAddEvent = (event: ScheduledEvent) => setScheduledEvents(prev => [...prev, event]);
  const handleToggleTaskCompletion = (date: string, eventId: string, taskId: string) => { setTaskCompletions(prev => { const newCompletions = JSON.parse(JSON.stringify(prev)); const dayCompletions = newCompletions[date] || {}; const eventCompletions = dayCompletions[eventId] || []; const taskIndex = eventCompletions.indexOf(taskId); if (taskIndex > -1) eventCompletions.splice(taskIndex, 1); else eventCompletions.push(taskId); dayCompletions[eventId] = eventCompletions; newCompletions[date] = dayCompletions; return newCompletions; }); };
  const handleSaveTask = (task: TaskItem) => setTasks(prev => { const index = prev.findIndex(t => t.id === task.id); if (index > -1) { const newTasks = [...prev]; newTasks[index] = task; return newTasks; } return [...prev, task]; });
  const handleDeleteTask = (taskId: string) => setTasks(prev => prev.filter(t => t.id !== taskId));
  const handleToggleTask = (taskId: string) => { setTasks(prev => { const task = prev.find(t => t.id === taskId); if (!task) return prev; const isNowCompleted = !task.isCompleted; const updatedTasks = prev.map(t => t.id === taskId ? { ...t, isCompleted: isNowCompleted } : t); if (isNowCompleted && task.recurrence && task.dueDate) { const nextDateStr = calculateNextDate(task.dueDate, task.recurrence); if (!task.recurrence.endDate || nextDateStr <= task.recurrence.endDate) { const nextTask: TaskItem = { ...task, id: generateUUID(), dueDate: nextDateStr, isCompleted: false, createdAt: new Date().toISOString(), subtasks: task.subtasks?.map(st => ({...st, isCompleted: false})), }; updatedTasks.push(nextTask); } } return updatedTasks; }); };
  const handleSaveRule = (rule: ReconciliationRule) => setReconciliationRules(prev => { const index = prev.findIndex(r => r.id === rule.id); if (index > -1) { const newRules = [...prev]; newRules[index] = rule; return newRules; } return [...prev, rule]; });
  const handleDeleteRule = (ruleId: string) => setReconciliationRules(prev => prev.filter(r => r.id !== ruleId));
  const handleSavePayee = (payee: Payee) => setPayees(prev => { const index = prev.findIndex(p => p.id === payee.id); if (index > -1) { const newPayees = [...prev]; newPayees[index] = payee; return newPayees; } return [...prev, payee]; });
  const handleDeletePayee = (payeeId: string) => setPayees(prev => { const children = prev.filter(p => p.parentId === payeeId); const updatedChildren = children.map(c => ({ ...c, parentId: undefined })); const filtered = prev.filter(p => p.id !== payeeId && p.parentId !== payeeId); return [...filtered, ...updatedChildren]; });
  const handleSaveCategory = (category: Category) => setCategories(prev => { const index = prev.findIndex(c => c.id === category.id); if (index > -1) { const newCategories = [...prev]; newCategories[index] = category; return newCategories; } return [...prev, category]; });
  const handleDeleteCategory = (categoryId: string) => setCategories(prev => { const children = prev.filter(c => c.parentId === categoryId); const updatedChildren = children.map(c => ({ ...c, parentId: undefined })); const filtered = prev.filter(c => c.id !== categoryId && c.parentId !== categoryId); return [...filtered, ...updatedChildren]; });
  const handleSaveTag = (tag: Tag) => setTags(prev => { const index = prev.findIndex(t => t.id === tag.id); if (index > -1) { const newTags = [...prev]; newTags[index] = tag; return newTags; } return [...prev, tag]; });
  const handleDeleteTag = (tagId: string) => { setTags(prev => prev.filter(t => t.id !== tagId)); setTransactions(prev => prev.map(tx => (tx.tagIds && tx.tagIds.includes(tagId)) ? { ...tx, tagIds: tx.tagIds.filter(id => id !== tagId) } : tx)); };
  const handleSaveUser = (user: User) => setUsers(prev => { const index = prev.findIndex(u => u.id === user.id); if (index > -1) { const newUsers = [...prev]; newUsers[index] = user; return newUsers; } return [...prev, user]; });
  const handleDeleteUser = (userId: string) => { const userToDelete = users.find(u => u.id === userId); if (userToDelete?.isDefault) { alert("Cannot delete the default user."); return; } const defaultUser = users.find(u => u.isDefault) || users[0]; if (!defaultUser) { alert("Cannot delete user as no default user is available."); return; } setTransactions(prev => prev.map(tx => tx.userId === userId ? { ...tx, userId: defaultUser.id } : tx)); setUsers(prev => prev.filter(u => u.id !== userId)); };
  const handleAddDocument = (doc: BusinessDocument) => setBusinessDocuments(prev => [...prev, doc]);
  const handleRemoveDocument = (docId: string) => setBusinessDocuments(prev => prev.filter(d => d.id !== docId));
  const handleCreateFolder = (folder: DocumentFolder) => setDocumentFolders(prev => [...prev, folder]);
  const handleDeleteFolder = (folderId: string) => { setBusinessDocuments(prev => prev.map(d => d.parentId === folderId ? { ...d, parentId: undefined } : d)); setDocumentFolders(prev => prev.filter(f => f.id !== folderId)); };
  const handleAddSavedReport = (report: SavedReport) => setSavedReports(prev => [...prev, report]);
  const handleAddAmazonMetrics = (newMetrics: AmazonMetric[]) => { if(newMetrics.length > 0) setAmazonMetrics(prev => [...prev, ...newMetrics].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())); };
  const handleDeleteAmazonMetrics = (ids: string[]) => { const idSet = new Set(ids); setAmazonMetrics(prev => prev.filter(m => !idSet.has(m.id))); };
  const handleAddYouTubeMetrics = (newMetrics: YouTubeMetric[]) => { if(newMetrics.length > 0) setYoutubeMetrics(prev => [...prev, ...newMetrics].sort((a,b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())); };
  const handleDeleteYouTubeMetrics = (ids: string[]) => { const idSet = new Set(ids); setYoutubeMetrics(prev => prev.filter(m => !idSet.has(m.id))); };
  const handleSaveYouTubeChannel = (channel: YouTubeChannel) => setYoutubeChannels(prev => { const index = prev.findIndex(c => c.id === channel.id); if (index > -1) { const updated = [...prev]; updated[index] = channel; return updated; } return [...prev, channel]; });
  const handleDeleteYouTubeChannel = (channelId: string) => setYoutubeChannels(prev => prev.filter(c => c.id !== channelId));

  const renderView = () => {
    // Show a small spinner for the central content if core structure is loaded but specific data is still coming
    if (isStructureLoading) return <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200"><Loader message="Initializing secure storage..." /></div>;
    
    switch (currentView) {
      case 'dashboard': 
        if (isHeavyDataLoading) return <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200"><Loader message="Hydrating dashboard data..." /></div>;
        return <Dashboard onTransactionsAdded={handleTransactionsAdded} transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} rules={reconciliationRules} payees={payees} users={users} onAddDocument={handleAddDocument} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      
      case 'transactions': 
        if (isHeavyDataLoading) return <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200"><Loader message="Loading transaction history..." /></div>;
        return <AllTransactions transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onDeleteTransactions={handleDeleteTransactions} onSaveRule={handleSaveRule} onSaveCategory={handleSaveCategory} onSavePayee={handleSavePayee} onSaveTag={handleSaveTag} onAddTransactionType={handleAddTransactionType} onSaveReport={handleAddSavedReport} />;
      
      case 'calendar': return <CalendarPage transactions={transactions} templates={templates} scheduledEvents={scheduledEvents} taskCompletions={taskCompletions} tasks={tasks} onAddEvent={handleAddEvent} onToggleTaskCompletion={handleToggleTaskCompletion} onToggleTask={handleToggleTask} transactionTypes={transactionTypes} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} accounts={accounts} categories={categories} tags={tags} payees={payees} users={users} initialTaskId={initialTaskId} />;
      case 'reports': return <Reports transactions={transactions} transactionTypes={transactionTypes} categories={categories} payees={payees} users={users} tags={tags} accounts={accounts} savedReports={savedReports} setSavedReports={setSavedReports} savedDateRanges={savedDateRanges} setSavedDateRanges={setSavedDateRanges} amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} />;
      case 'accounts': return <AccountsPage accounts={accounts} onAddAccount={handleAddAccount} onUpdateAccount={handleUpdateAccount} onRemoveAccount={handleRemoveAccount} accountTypes={accountTypes} onAddAccountType={handleAddAccountType} onRemoveAccountType={handleRemoveAccountType} />;
      case 'users': return <UsersPage users={users} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} />;
      case 'payees': return <PayeesPage payees={payees} onSavePayee={handleSavePayee} onDeletePayee={handleDeletePayee} transactions={transactions}/>;
      case 'categories': return <CategoriesPage categories={categories} onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} transactions={transactions}/>;
      case 'tags': return <TagsPage tags={tags} onSaveTag={handleSaveTag} onDeleteTag={handleDeleteTag} />;
      case 'rules': return <RulesPage rules={reconciliationRules} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} accounts={accounts} transactionTypes={transactionTypes} categories={categories} tags={tags} payees={payees} transactions={transactions} onUpdateTransactions={handleUpdateTransactions} onSaveCategory={handleSaveCategory} onSavePayee={handleSavePayee} onSaveTag={handleSaveTag} onAddTransactionType={handleAddTransactionType} />;
      case 'settings': return <SettingsPage transactionTypes={transactionTypes} onAddTransactionType={handleAddTransactionType} onRemoveTransactionType={handleRemoveTransactionType} transactions={transactions} systemSettings={systemSettings} onUpdateSystemSettings={setSystemSettings} onAddDocument={handleAddDocument} accounts={accounts} categories={categories} tags={tags} payees={payees} rules={reconciliationRules} templates={templates} scheduledEvents={scheduledEvents} users={users} businessProfile={businessProfile} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      case 'tasks': return <TasksPage tasks={tasks} onSaveTask={handleSaveTask} onDeleteTask={handleDeleteTask} onToggleTask={handleToggleTask} templates={templates} onSaveTemplate={handleSaveTemplate} onRemoveTemplate={handleRemoveTemplate} scheduledEvents={scheduledEvents} />;
      case 'hub': return <BusinessHub profile={businessProfile} onUpdateProfile={setBusinessProfile} chatSessions={chatSessions} onUpdateChatSessions={setChatSessions} transactions={transactions} accounts={accounts} categories={categories} />;
      case 'documents': return <DocumentsPage documents={businessDocuments} folders={documentFolders} onAddDocument={handleAddDocument} onRemoveDocument={handleRemoveDocument} onCreateFolder={handleCreateFolder} onDeleteFolder={handleDeleteFolder} />;
      case 'integrations': return <IntegrationsPage onNavigate={setCurrentView} />;
      case 'integration-amazon': return <AmazonIntegration metrics={amazonMetrics} onAddMetrics={handleAddAmazonMetrics} onDeleteMetrics={handleDeleteAmazonMetrics} />;
      case 'integration-youtube': return <YouTubeIntegration metrics={youtubeMetrics} onAddMetrics={handleAddYouTubeMetrics} onDeleteMetrics={handleDeleteYouTubeMetrics} channels={youtubeChannels} onSaveChannel={handleSaveYouTubeChannel} onDeleteChannel={handleDeleteYouTubeChannel} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="md:hidden bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-3">
                <span className="text-2xl filter drop-shadow-sm">💰</span>
                <h1 className="text-base font-bold text-slate-800 uppercase tracking-wide">FinParser</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
        </div>
      </header>
      
      <div className="flex">
        <div className="hidden md:block">
          {/* Sidebar renders even if data isn't fully loaded, using structural data */}
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