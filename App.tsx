
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import FinancialPlan from './views/FinancialPlan';
import DocumentsPage from './views/DocumentsPage';
import IntegrationsPage from './views/IntegrationsPage';
import AmazonIntegration from './views/integrations/AmazonIntegration';
import YouTubeIntegration from './views/integrations/YouTubeIntegration';
import Chatbot from './components/Chatbot';
import Loader from './components/Loader';
import DonationModal from './components/DonationModal';
import { MenuIcon, CloseIcon, SparklesIcon } from './components/Icons';
import { calculateNextDate } from './dateUtils';
import { generateUUID } from './utils';
import { api } from './services/apiService';
import { saveFile, deleteFile } from './services/storageService';

type View = 'dashboard' | 'transactions' | 'calendar' | 'accounts' | 'reports' | 'settings' | 'tasks' | 'rules' | 'payees' | 'categories' | 'tags' | 'users' | 'hub' | 'plan' | 'documents' | 'integrations' | 'integration-amazon' | 'integration-youtube';

const DEFAULT_CATEGORIES: Category[] = [
    "Groceries", "Dining", "Shopping", "Travel", "Entertainment", "Utilities", "Health", "Services", "Transportation", "Income", "Other"
].map(name => ({ id: `default-${name.toLowerCase().replace(' ', '-')}`, name }));

const DEFAULT_TRANSACTION_TYPES: TransactionType[] = [
    { id: 'default-expense-purchase', name: 'Purchase', balanceEffect: 'expense', isDefault: true },
    { id: 'default-expense-bill', name: 'Bill Payment', balanceEffect: 'expense', isDefault: true },
    { id: 'default-income-paycheck', name: 'Paycheck', balanceEffect: 'income', isDefault: true },
    { id: 'default-transfer-transfer', name: 'Transfer', balanceEffect: 'transfer', isDefault: true },
    { id: 'default-donation', name: 'Donation', balanceEffect: 'donation', isDefault: true },
];

const App: React.FC = () => {
  const [isShellLoading, setIsShellLoading] = useState(true);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [hasLegacyData, setHasLegacyData] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  
  // Data State
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

  // Safety Ref: Only allow auto-saves after hydration is confirmed
  const hydratedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.body.classList.add('loaded');

    const hydratePriorityData = async () => {
      setIsShellLoading(true);
      
      const legacyAccounts = localStorage.getItem('accounts');
      if (legacyAccounts) setHasLegacyData(true);

      const [sets, usrs, cats, accTs, accs, txTs, tagsData, pyes, rules, folders] = await Promise.all([
        api.loadKey<SystemSettings>('systemSettings'),
        api.loadKey<User[]>('users'),
        api.loadKey<Category[]>('categories'),
        api.loadKey<AccountType[]>('accountTypes'),
        api.loadKey<Account[]>('accounts'),
        api.loadKey<TransactionType[]>('transactionTypes'),
        api.loadKey<Tag[]>('tags'),
        api.loadKey<Payee[]>('payees'),
        api.loadKey<ReconciliationRule[]>('reconciliationRules'),
        api.loadKey<DocumentFolder[]>('documentFolders'),
      ]);

      const finalSettings = sets || {};
      if (finalSettings.apiKey) localStorage.setItem('user_api_key', finalSettings.apiKey);
      setSystemSettings(finalSettings);
      hydratedKeys.current.add('systemSettings');
      
      const finalUsers = (Array.isArray(usrs) && usrs.length > 0) ? usrs : [{ id: 'default-user', name: 'Primary User', isDefault: true }];
      setUsers(finalUsers);
      hydratedKeys.current.add('users');

      setCategories(Array.isArray(cats) ? cats : DEFAULT_CATEGORIES);
      hydratedKeys.current.add('categories');

      setTransactionTypes(Array.isArray(txTs) ? txTs : DEFAULT_TRANSACTION_TYPES);
      hydratedKeys.current.add('transactionTypes');

      setTags(tagsData || []);
      hydratedKeys.current.add('tags');

      setPayees(pyes || []);
      hydratedKeys.current.add('payees');

      setReconciliationRules(rules || []);
      hydratedKeys.current.add('reconciliationRules');

      setDocumentFolders(folders || []);
      hydratedKeys.current.add('documentFolders');

      let finalAccountTypes = accTs || [];
      if (finalAccountTypes.length === 0) finalAccountTypes = [{ id: 'default-bank', name: 'Bank', isDefault: true }, { id: 'default-cc', name: 'Credit Card', isDefault: true }];
      setAccountTypes(finalAccountTypes);

      let finalAccounts = accs || [];
      if (finalAccounts.length === 0) {
          const type = finalAccountTypes[0];
          finalAccounts = [{ id: 'default-account', name: 'Primary Account', identifier: 'Default', accountTypeId: type.id }];
      }
      setAccounts(finalAccounts);
      hydratedKeys.current.add('accounts');

      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam) setCurrentView(viewParam as View);

      setIsShellLoading(false);
      loadHeavyData();
    };

    const loadHeavyData = async () => {
      setIsBackgroundLoading(true);
      const txs = await api.loadKey<Transaction[]>('transactions');
      if (txs) {
          setTransactions(txs);
          hydratedKeys.current.add('transactions');
      }

      const tasksData = await api.loadKey<TaskItem[]>('tasks');
      if (tasksData) {
          setTasks(tasksData);
          hydratedKeys.current.add('tasks');
      }

      const [completions, tmplates, events, profile, docs, reports, chats, ranges, amz, yt, ytc] = await Promise.all([
        api.loadKey<TaskCompletions>('taskCompletions'),
        api.loadKey<Template[]>('templates'),
        api.loadKey<ScheduledEvent[]>('scheduledEvents'),
        api.loadKey<BusinessProfile>('businessProfile'),
        api.loadKey<BusinessDocument[]>('businessDocuments'),
        api.loadKey<SavedReport[]>('savedReports'),
        api.loadKey<ChatSession[]>('chatSessions'),
        api.loadKey<CustomDateRange[]>('savedDateRanges'),
        api.loadKey<AmazonMetric[]>('amazonMetrics'),
        api.loadKey<YouTubeMetric[]>('youtubeMetrics'),
        api.loadKey<YouTubeChannel[]>('youtubeChannels'),
      ]);

      if (completions) setTaskCompletions(completions);
      if (tmplates) setTemplates(tmplates);
      if (events) setScheduledEvents(events);
      if (profile) { setBusinessProfile(profile); hydratedKeys.current.add('businessProfile'); }
      if (docs) { setBusinessDocuments(docs); hydratedKeys.current.add('businessDocuments'); }
      if (reports) setSavedReports(reports);
      if (chats) setChatSessions(chats);
      if (ranges) setSavedDateRanges(ranges);
      if (amz) setAmazonMetrics(amz);
      if (yt) setYoutubeMetrics(yt);
      if (ytc) setYoutubeChannels(ytc);

      setIsBackgroundLoading(false);
    };

    hydratePriorityData();
  }, []);

  const handleMigrateLegacyData = async () => {
      setIsMigrating(true);
      try {
          const keysToMigrate = ['accounts', 'categories', 'tags', 'payees', 'reconciliationRules', 'templates', 'users', 'transactionTypes', 'businessProfile', 'tasks'];
          for (const key of keysToMigrate) {
              const data = localStorage.getItem(key);
              if (data) {
                  const parsed = JSON.parse(data);
                  await api.save(key, parsed);
                  localStorage.removeItem(key);
              }
          }
          alert("Migration successful!");
          window.location.reload();
      } catch (e) {
          alert("Migration failed");
      } finally {
          setIsMigrating(false);
      }
  };

  // Save Effects
  useEffect(() => { if (hydratedKeys.current.has('systemSettings')) api.save('systemSettings', systemSettings); }, [systemSettings]);
  useEffect(() => { if (hydratedKeys.current.has('users')) api.save('users', users); }, [users]);
  useEffect(() => { if (hydratedKeys.current.has('categories')) api.save('categories', categories); }, [categories]);
  useEffect(() => { if (hydratedKeys.current.has('accounts')) api.save('accounts', accounts); }, [accounts]);
  useEffect(() => { if (hydratedKeys.current.has('transactionTypes')) api.save('transactionTypes', transactionTypes); }, [transactionTypes]);
  useEffect(() => { if (hydratedKeys.current.has('tags')) api.save('tags', tags); }, [tags]);
  useEffect(() => { if (hydratedKeys.current.has('payees')) api.save('payees', payees); }, [payees]);
  useEffect(() => { if (hydratedKeys.current.has('reconciliationRules')) api.save('reconciliationRules', reconciliationRules); }, [reconciliationRules]);
  useEffect(() => { if (hydratedKeys.current.has('documentFolders')) api.save('documentFolders', documentFolders); }, [documentFolders]);
  useEffect(() => { if (hydratedKeys.current.has('transactions')) { const h = setTimeout(() => api.save('transactions', transactions), 1000); return () => clearTimeout(h); } }, [transactions]);
  useEffect(() => { if (hydratedKeys.current.has('tasks')) api.save('tasks', tasks); }, [tasks]);
  useEffect(() => { if (hydratedKeys.current.has('businessDocuments')) api.save('businessDocuments', businessDocuments); }, [businessDocuments]);

  // Handlers
  const handleTransactionsAdded = (newlyAdded: Transaction[], newlyCreatedCategories: Category[]) => {
      if (newlyCreatedCategories.length > 0) setCategories(prev => [...prev, ...newlyCreatedCategories]);
      if (newlyAdded.length > 0) {
        const sorted = [...transactions, ...newlyAdded].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(sorted);
        api.saveTransactions(newlyAdded);
      }
  };
  const handleAddTransaction = (newTransaction: Transaction) => {
    setTransactions(prev => [...prev, newTransaction].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    api.saveTransactions([newTransaction]);
  };
  const handleUpdateTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTransaction.id ? updatedTransaction : tx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    api.saveTransactions([updatedTransaction]);
  };
  const handleDeleteTransaction = (transactionId: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
    api.deleteTransactions([transactionId]);
  };
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
  const handleDeletePayee = (payeeId: string) => setPayees(prev => { const filtered = prev.filter(p => p.id !== payeeId && p.parentId !== payeeId); return filtered; });
  const handleSaveCategory = (category: Category) => setCategories(prev => { const index = prev.findIndex(c => c.id === category.id); if (index > -1) { const newCategories = [...prev]; newCategories[index] = category; return newCategories; } return [...prev, category]; });
  const handleDeleteCategory = (categoryId: string) => setCategories(prev => prev.filter(c => c.id !== categoryId && c.parentId !== categoryId));
  const handleSaveTag = (tag: Tag) => setTags(prev => { const index = prev.findIndex(t => t.id === tag.id); if (index > -1) { const newTags = [...prev]; newTags[index] = tag; return newTags; } return [...prev, tag]; });
  const handleDeleteTag = (tagId: string) => { setTags(prev => prev.filter(t => t.id !== tagId)); setTransactions(prev => prev.map(tx => (tx.tagIds && tx.tagIds.includes(tagId)) ? { ...tx, tagIds: tx.tagIds.filter(id => id !== tagId) } : tx)); };
  const handleSaveUser = (user: User) => setUsers(prev => { const index = prev.findIndex(u => u.id === user.id); if (index > -1) { const newUsers = [...prev]; newUsers[index] = user; return newUsers; } return [...prev, user]; });
  const handleDeleteUser = (userId: string) => setUsers(prev => prev.filter(u => u.id !== userId));
  const handleAddDocument = (doc: BusinessDocument) => setBusinessDocuments(prev => [...prev, doc]);
  const handleRemoveDocument = (docId: string) => setBusinessDocuments(prev => prev.filter(d => d.id !== docId));
  const handleCreateFolder = (folder: DocumentFolder) => setDocumentFolders(prev => [...prev, folder]);
  const handleDeleteFolder = (folderId: string) => setDocumentFolders(prev => prev.filter(f => f.id !== folderId));
  const handleAddSavedReport = (report: SavedReport) => setSavedReports(prev => [...prev, report]);
  const handleAddAmazonMetrics = (newMetrics: AmazonMetric[]) => { if(newMetrics.length > 0) setAmazonMetrics(prev => [...prev, ...newMetrics].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())); };
  const handleDeleteAmazonMetrics = (ids: string[]) => { const idSet = new Set(ids); setAmazonMetrics(prev => prev.filter(m => !idSet.has(m.id))); };
  const handleAddYouTubeMetrics = (newMetrics: YouTubeMetric[]) => { if(newMetrics.length > 0) setYoutubeMetrics(prev => [...prev, ...newMetrics].sort((a,b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())); };
  const handleDeleteYouTubeMetrics = (ids: string[]) => { const idSet = new Set(ids); setYoutubeMetrics(prev => prev.filter(m => !idSet.has(m.id))); };
  const handleSaveYouTubeChannel = (channel: YouTubeChannel) => setYoutubeChannels(prev => { const index = prev.findIndex(c => c.id === channel.id); if (index > -1) { const updated = [...prev]; updated[index] = channel; return updated; } return [...prev, channel]; });
  const handleDeleteYouTubeChannel = (channelId: string) => setYoutubeChannels(prev => prev.filter(c => c.id !== channelId));

  const renderView = () => {
    if (isShellLoading) return <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200"><Loader message="Initializing secure vault..." /></div>;
    
    switch (currentView) {
      case 'dashboard': return <Dashboard onTransactionsAdded={handleTransactionsAdded} transactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} rules={reconciliationRules} payees={payees} users={users} onAddDocument={handleAddDocument} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      case 'transactions': return <AllTransactions accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} payees={payees} users={users} onSaveReport={handleAddSavedReport} />;
      case 'calendar': return <CalendarPage transactions={transactions} templates={templates} scheduledEvents={scheduledEvents} taskCompletions={taskCompletions} tasks={tasks} onAddEvent={handleAddEvent} onToggleTaskCompletion={handleToggleTaskCompletion} onToggleTask={handleToggleTask} transactionTypes={transactionTypes} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={handleAddTransaction} accounts={accounts} categories={categories} tags={tags} payees={payees} users={users} initialTaskId={initialTaskId} />;
      case 'reports': return <Reports transactions={transactions} transactionTypes={transactionTypes} categories={categories} payees={payees} users={users} tags={tags} accounts={accounts} savedReports={savedReports} setSavedReports={setSavedReports} savedDateRanges={savedDateRanges} setSavedDateRanges={setSavedDateRanges} amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} />;
      case 'settings': return <SettingsPage transactionTypes={transactionTypes} onAddTransactionType={handleAddTransactionType} onRemoveTransactionType={handleRemoveTransactionType} transactions={transactions} systemSettings={systemSettings} onUpdateSystemSettings={setSystemSettings} onAddDocument={handleAddDocument} accounts={accounts} categories={categories} tags={tags} payees={payees} rules={reconciliationRules} templates={templates} scheduledEvents={scheduledEvents} users={users} businessProfile={businessProfile} documentFolders={documentFolders} onCreateFolder={handleCreateFolder} />;
      case 'tasks': return <TasksPage tasks={tasks} onSaveTask={handleSaveTask} onDeleteTask={handleDeleteTask} onToggleTask={handleToggleTask} templates={templates} onSaveTemplate={handleSaveTemplate} onRemoveTemplate={handleRemoveTemplate} scheduledEvents={scheduledEvents} />;
      case 'hub': return <BusinessHub profile={businessProfile} onUpdateProfile={setBusinessProfile} chatSessions={chatSessions} onUpdateChatSessions={setChatSessions} transactions={transactions} accounts={accounts} categories={categories} onAddTransaction={handleAddTransaction} transactionTypes={transactionTypes} payees={payees} />;
      case 'plan': return <FinancialPlan transactions={transactions} accounts={accounts} profile={businessProfile} categories={categories} transactionTypes={transactionTypes} payees={payees} onAddTransaction={handleAddTransaction} />;
      case 'documents': return <DocumentsPage documents={businessDocuments} folders={documentFolders} onAddDocument={handleAddDocument} onRemoveDocument={handleRemoveDocument} onCreateFolder={handleCreateFolder} onDeleteFolder={handleDeleteFolder} />;
      case 'integrations': return <IntegrationsPage onNavigate={setCurrentView} />;
      case 'integration-amazon': return <AmazonIntegration metrics={amazonMetrics} onAddMetrics={handleAddAmazonMetrics} onDeleteMetrics={handleDeleteAmazonMetrics} />;
      case 'integration-youtube': return <YouTubeIntegration metrics={youtubeMetrics} onAddMetrics={handleAddYouTubeMetrics} onDeleteMetrics={handleDeleteYouTubeMetrics} channels={youtubeChannels} onSaveChannel={handleSaveYouTubeChannel} onDeleteChannel={handleDeleteYouTubeChannel} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {hasLegacyData && (
          <div className="bg-indigo-600 text-white p-3 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm font-medium sticky top-0 z-50 shadow-lg">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-indigo-300 animate-pulse" />
                <span>Legacy data detected in browser.</span>
              </div>
              <button onClick={handleMigrateLegacyData} disabled={isMigrating} className="bg-white text-indigo-600 px-4 py-1 rounded-full font-bold hover:bg-indigo-50 transition-colors shadow-sm disabled:opacity-50">
                  {isMigrating ? 'Migrating...' : 'Migrate to Server'}
              </button>
          </div>
      )}

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
          <Sidebar currentView={currentView} onNavigate={setCurrentView} transactions={transactions} onChatToggle={() => setIsChatOpen(!isChatOpen)} isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} isStreaming={isBackgroundLoading} />
        </div>
        <div className={`md:hidden fixed inset-0 z-30 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar currentView={currentView} onNavigate={(view) => { setCurrentView(view); setIsSidebarOpen(false); }} transactions={transactions} onChatToggle={() => { setIsChatOpen(!isChatOpen); setIsSidebarOpen(false); }} isStreaming={isBackgroundLoading} />
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
