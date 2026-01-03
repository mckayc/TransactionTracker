
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Payee, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, View } from './types';
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
import FinancialPlanPage from './views/FinancialPlanPage';
import IntegrationsPage from './views/IntegrationsPage';
import AmazonIntegration from './views/integrations/AmazonIntegration';
import YouTubeIntegration from './views/integrations/YouTubeIntegration';
import ContentHub from './views/integrations/ContentHub';
import Chatbot from './components/Chatbot';
import Loader from './components/Loader';
import { MenuIcon, CloseIcon, SparklesIcon, ExclamationTriangleIcon } from './components/Icons';
import { api } from './services/apiService';
import { generateUUID } from './utils';

const App: React.FC = () => {
    // UI State
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Core Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
    const [rules, setRules] = useState<ReconciliationRule[]>([]);
    const [payees, setPayees] = useState<Payee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
        info: {},
        tax: {},
        completedSteps: []
    });
    const [documentFolders, setDocumentFolders] = useState<DocumentFolder[]>([]);
    const [businessDocuments, setBusinessDocuments] = useState<BusinessDocument[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [taskCompletions, setTaskCompletions] = useState<TaskCompletions>({});
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [savedDateRanges, setSavedDateRanges] = useState<CustomDateRange[]>([]);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [amazonMetrics, setAmazonMetrics] = useState<AmazonMetric[]>([]);
    const [amazonVideos, setAmazonVideos] = useState<AmazonVideo[]>([]);
    const [youtubeMetrics, setYouTubeMetric] = useState<YouTubeMetric[]>([]);
    const [youtubeChannels, setYouTubeChannels] = useState<YouTubeChannel[]>([]);
    const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
    const [financialPlan, setFinancialPlan] = useState<FinancialPlan | null>(null);
    const [contentLinks, setContentLinks] = useState<ContentLink[]>([]);
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({});

    // Initialization: Fetch all data from the local API
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                const data = await api.loadAll();
                
                // Hydrate Core Data
                setTransactions(data.transactions || []);
                setAccounts(data.accounts || []);
                setAccountTypes(data.accountTypes || [
                    { id: 'bank', name: 'Bank Account', isDefault: true },
                    { id: 'cc', name: 'Credit Card' },
                    { id: 'cash', name: 'Cash' }
                ]);
                setCategories(data.categories || [
                    { id: 'groceries', name: 'Groceries' },
                    { id: 'dining', name: 'Dining' },
                    { id: 'utilities', name: 'Utilities' },
                    { id: 'income', name: 'Income' },
                    { id: 'other', name: 'Other' }
                ]);
                setTags(data.tags || []);
                setTransactionTypes(data.transactionTypes || [
                    { id: 'expense', name: 'Purchase', balanceEffect: 'expense', isDefault: true },
                    { id: 'income', name: 'Income', balanceEffect: 'income' },
                    { id: 'transfer', name: 'Transfer', balanceEffect: 'transfer' },
                    { id: 'investment', name: 'Investment', balanceEffect: 'investment' },
                    { id: 'donation', name: 'Donation', balanceEffect: 'donation' }
                ]);
                
                // DATA MIGRATION & PERSISTENCE KEY UNIFICATION
                // Automation Rules was using 'rules' key internally but 'reconciliationRules' for backup.
                // We now unify on 'reconciliationRules'.
                const initialRules = data.reconciliationRules || data.rules || [];
                setRules(initialRules);
                
                // Perform one-time migration to unified key if we found data in the old key
                if (data.rules && !data.reconciliationRules) {
                    console.log("[App] Migrating 'rules' to 'reconciliationRules' key for consistency.");
                    api.save('reconciliationRules', data.rules);
                }

                setPayees(data.payees || []);
                
                // Persistence Guard: If users exist in database, use them. Otherwise, use default.
                if (data.users && Array.isArray(data.users) && data.users.length > 0) {
                    setUsers(data.users);
                } else {
                    setUsers([{ id: 'user1', name: 'Primary User', isDefault: true }]);
                }

                setBusinessProfile(data.businessProfile || { info: {}, tax: {}, completedSteps: [] });
                setDocumentFolders(data.documentFolders || []);
                setBusinessDocuments(data.businessDocuments || []);
                setTemplates(data.templates || []);
                setScheduledEvents(data.scheduledEvents || []);
                setTasks(data.tasks || []);
                setTaskCompletions(data.taskCompletions || {});
                setSavedReports(data.savedReports || []);
                setSavedDateRanges(data.savedDateRanges || []);
                setChatSessions(data.chatSessions || []);
                setAmazonMetrics(data.amazonMetrics || []);
                setAmazonVideos(data.amazonVideos || []);
                setYouTubeMetric(data.youtubeMetrics || []);
                setYouTubeChannels(data.youtubeChannels || []);
                setFinancialGoals(data.financialGoals || []);
                setFinancialPlan(data.financialPlan || null);
                setContentLinks(data.contentLinks || []);
                setSystemSettings(data.systemSettings || {});
                
                setIsLoading(false);
                document.body.classList.add('loaded');
            } catch (err) {
                console.error("Failed to load initial data", err);
                setLoadError("Engine startup failed. Please verify your server connection and database volume permissions.");
                // We keep isLoading true to prevent the UI from overwriting state with defaults
            }
        };
        loadInitialData();
        
        // Safety timeout to remove splash only if we are successful, or if we want to show the error
        const safety = setTimeout(() => {
            if (isLoading && !loadError) {
                console.warn("[App] Loading safety timeout triggered.");
            }
        }, 10000);
        return () => clearTimeout(safety);
    }, []);

    // Helper for persisting state updates to the backend
    const updateData = async (key: string, value: any, setter: Function) => {
        setter(value);
        try {
            await api.save(key, value);
        } catch (e) {
            console.error(`Failed to persist data for key: ${key}`, e);
            alert(`Persistence Error: Changes to ${key} may not be saved.`);
        }
    };

    // Transaction Management
    const handleTransactionsAdded = (newTxs: Transaction[], newCats: Category[]) => {
        const updatedTxs = [...transactions, ...newTxs];
        const updatedCats = [...categories];
        newCats.forEach(cat => {
            if (!updatedCats.find(c => c.id === cat.id)) updatedCats.push(cat);
        });
        updateData('transactions', updatedTxs, setTransactions);
        updateData('categories', updatedCats, setCategories);
    };

    const userInitials = useMemo(() => {
        if (users.length === 0) return "U";
        const primary = users.find(u => u.isDefault) || users[0];
        const names = primary.name.split(' ');
        if (names.length > 1) return (names[0][0] + names[1][0]).toUpperCase();
        return names[0].substring(0, 2).toUpperCase();
    }, [users]);

    // Main Router
    const renderCurrentView = () => {
        switch (currentView) {
            case 'dashboard':
                return (
                    <Dashboard 
                        transactions={transactions}
                        accounts={accounts}
                        accountTypes={accountTypes}
                        categories={categories}
                        tags={tags}
                        transactionTypes={transactionTypes}
                        rules={rules}
                        payees={payees}
                        users={users}
                        documentFolders={documentFolders}
                        onTransactionsAdded={handleTransactionsAdded}
                        onAddAccount={(a) => updateData('accounts', [...accounts, a], setAccounts)}
                        onAddAccountType={(t) => updateData('accountTypes', [...accountTypes, t], setAccountTypes)}
                        onAddDocument={(d) => updateData('businessDocuments', [...businessDocuments, d], setBusinessDocuments)}
                        onCreateFolder={(f) => updateData('documentFolders', [...documentFolders, f], setDocumentFolders)}
                        onSaveRule={(r) => {
                            const exists = rules.findIndex(x => x.id === r.id);
                            const updated = exists >= 0 ? rules.map(x => x.id === r.id ? r : x) : [...rules, r];
                            updateData('reconciliationRules', updated, setRules);
                        }}
                        onSaveCategory={(c) => updateData('categories', [...categories, c], setCategories)}
                        onSavePayee={(p) => updateData('payees', [...payees, p], setPayees)}
                        onSaveTag={(t) => updateData('tags', [...tags, t], setTags)}
                        onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                        onUpdateTransaction={(t) => updateData('transactions', transactions.map(x => x.id === t.id ? t : x), setTransactions)}
                        onDeleteTransaction={(id) => updateData('transactions', transactions.filter(x => x.id !== id), setTransactions)}
                    />
                );
            case 'transactions':
                return (
                    <AllTransactions 
                        transactions={transactions}
                        accounts={accounts}
                        categories={categories}
                        tags={tags}
                        transactionTypes={transactionTypes}
                        payees={payees}
                        users={users}
                        onUpdateTransaction={(t) => updateData('transactions', transactions.map(x => x.id === t.id ? t : x), setTransactions)}
                        onAddTransaction={(t) => updateData('transactions', [...transactions, t], setTransactions)}
                        onDeleteTransaction={(id) => updateData('transactions', transactions.filter(x => x.id !== id), setTransactions)}
                        onDeleteTransactions={(ids) => updateData('transactions', transactions.filter(x => !ids.includes(x.id)), setTransactions)}
                        onSaveRule={(r) => {
                            const exists = rules.findIndex(x => x.id === r.id);
                            const updated = exists >= 0 ? rules.map(x => x.id === r.id ? r : x) : [...rules, r];
                            updateData('reconciliationRules', updated, setRules);
                        }}
                        onSaveCategory={(c) => updateData('categories', [...categories, c], setCategories)}
                        onSavePayee={(p) => updateData('payees', [...payees, p], setPayees)}
                        onSaveTag={(t) => updateData('tags', [...tags, t], setTags)}
                        onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                        onSaveReport={(r) => updateData('savedReports', [...savedReports, r], setSavedReports)}
                    />
                );
            case 'calendar':
                return (
                    <CalendarPage 
                        transactions={transactions}
                        templates={templates}
                        scheduledEvents={scheduledEvents}
                        tasks={tasks}
                        taskCompletions={taskCompletions}
                        accounts={accounts}
                        categories={categories}
                        tags={tags}
                        payees={payees}
                        users={users}
                        transactionTypes={transactionTypes}
                        onAddEvent={(e) => updateData('scheduledEvents', [...scheduledEvents, e], setScheduledEvents)}
                        onUpdateTransaction={(t) => updateData('transactions', transactions.map(x => x.id === t.id ? t : x), setTransactions)}
                        onAddTransaction={(t) => updateData('transactions', [...transactions, t], setTransactions)}
                        onToggleTaskCompletion={(date, eId, tId) => {
                            const newComps = { ...taskCompletions };
                            if (!newComps[date]) newComps[date] = {};
                            if (!newComps[date][eId]) newComps[date][eId] = [];
                            if (newComps[date][eId].includes(tId)) {
                                newComps[date][eId] = newComps[date][eId].filter(id => id !== tId);
                            } else {
                                newComps[date][eId].push(tId);
                            }
                            updateData('taskCompletions', newComps, setTaskCompletions);
                        }}
                        onToggleTask={(id) => updateData('tasks', tasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t), setTasks)}
                        onSaveTask={(t) => {
                            const exists = tasks.findIndex(x => x.id === t.id);
                            const updated = exists >= 0 ? tasks.map(x => x.id === t.id ? t : x) : [...tasks, t];
                            updateData('tasks', updated, setTasks);
                        }}
                    />
                );
            case 'accounts':
                return (
                    <AccountsPage 
                        accounts={accounts}
                        accountTypes={accountTypes}
                        onAddAccount={(a) => updateData('accounts', [...accounts, a], setAccounts)}
                        onUpdateAccount={(a) => updateData('accounts', accounts.map(x => x.id === a.id ? a : x), setAccounts)}
                        onRemoveAccount={(id) => updateData('accounts', accounts.filter(x => x.id !== id), setAccounts)}
                        onAddAccountType={(t) => updateData('accountTypes', [...accountTypes, t], setAccountTypes)}
                        onRemoveAccountType={(id) => updateData('accountTypes', accountTypes.filter(x => x.id !== id), setAccountTypes)}
                    />
                );
            case 'reports':
                return (
                    <Reports 
                        transactions={transactions}
                        transactionTypes={transactionTypes}
                        categories={categories}
                        payees={payees}
                        users={users}
                        tags={tags}
                        accounts={accounts}
                        savedReports={savedReports}
                        setSavedReports={(val) => updateData('savedReports', typeof val === 'function' ? val(savedReports) : val, setSavedReports)}
                        savedDateRanges={savedDateRanges}
                        setSavedDateRanges={(val) => updateData('savedDateRanges', typeof val === 'function' ? val(savedDateRanges) : val, setSavedDateRanges)}
                        amazonMetrics={amazonMetrics}
                        youtubeMetrics={youtubeMetrics}
                    />
                );
            case 'documents':
                return (
                    <DocumentsPage 
                        documents={businessDocuments}
                        folders={documentFolders}
                        onAddDocument={(d) => updateData('businessDocuments', [...businessDocuments, d], setBusinessDocuments)}
                        onRemoveDocument={(id) => updateData('businessDocuments', businessDocuments.filter(x => x.id !== id), setBusinessDocuments)}
                        onCreateFolder={(f) => updateData('documentFolders', [...documentFolders, f], setDocumentFolders)}
                        onDeleteFolder={(id) => updateData('documentFolders', documentFolders.filter(x => x.id !== id), setDocumentFolders)}
                    />
                );
            case 'hub':
                return (
                    <BusinessHub 
                        profile={businessProfile}
                        onUpdateProfile={(p) => updateData('businessProfile', p, setBusinessProfile)}
                        chatSessions={chatSessions}
                        onUpdateChatSessions={(s) => updateData('chatSessions', s, setChatSessions)}
                        transactions={transactions}
                        accounts={accounts}
                        categories={categories}
                    />
                );
            case 'plan':
                return (
                    <FinancialPlanPage 
                        transactions={transactions}
                        goals={financialGoals}
                        onSaveGoals={(g) => updateData('financialGoals', g, setFinancialGoals)}
                        plan={financialPlan}
                        onSavePlan={(p) => updateData('financialPlan', p, setFinancialPlan)}
                        categories={categories}
                    />
                );
            case 'integrations':
                return <IntegrationsPage onNavigate={(v) => setCurrentView(v)} />;
            case 'integration-amazon':
                return (
                    <AmazonIntegration 
                        metrics={amazonMetrics}
                        onAddMetrics={(m) => updateData('amazonMetrics', [...amazonMetrics, ...m], setAmazonMetrics)}
                        onDeleteMetrics={(ids) => updateData('amazonMetrics', amazonMetrics.filter(x => !ids.includes(x.id)), setAmazonMetrics)}
                        videos={amazonVideos}
                        onAddVideos={(v) => updateData('amazonVideos', [...amazonVideos, ...v], setAmazonVideos)}
                        onDeleteVideos={(ids) => updateData('amazonVideos', amazonVideos.filter(x => !ids.includes(x.id)), setAmazonVideos)}
                    />
                );
            case 'integration-youtube':
                return (
                    <YouTubeIntegration 
                        metrics={youtubeMetrics}
                        onAddMetrics={(m) => updateData('youtubeMetrics', [...youtubeMetrics, ...m], setYouTubeMetric)}
                        onDeleteMetrics={(ids) => updateData('youtubeMetrics', youtubeMetrics.filter(x => !ids.includes(x.id)), setYouTubeMetric)}
                        channels={youtubeChannels}
                        onSaveChannel={(c) => {
                            const exists = youtubeChannels.findIndex(x => x.id === c.id);
                            const updated = exists >= 0 ? youtubeChannels.map(x => x.id === c.id ? c : x) : [...youtubeChannels, c];
                            updateData('youtubeChannels', updated, setYouTubeChannels);
                        }}
                        onDeleteChannel={(id) => updateData('youtubeChannels', youtubeChannels.filter(x => x.id !== id), setYouTubeChannels)}
                    />
                );
            case 'integration-content-hub':
                return (
                    <ContentHub 
                        amazonMetrics={amazonMetrics}
                        youtubeMetrics={youtubeMetrics}
                        contentLinks={contentLinks}
                        onUpdateLinks={(l) => updateData('contentLinks', l, setContentLinks)}
                    />
                );
            case 'tasks':
                return (
                    <TasksPage 
                        tasks={tasks}
                        templates={templates}
                        scheduledEvents={scheduledEvents}
                        onSaveTask={(t) => {
                            const exists = tasks.findIndex(x => x.id === t.id);
                            const updated = exists >= 0 ? tasks.map(x => x.id === t.id ? t : x) : [...tasks, t];
                            updateData('tasks', updated, setTasks);
                        }}
                        onDeleteTask={(id) => updateData('tasks', tasks.filter(x => x.id !== id), setTasks)}
                        onToggleTask={(id) => updateData('tasks', tasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t), setTasks)}
                        onSaveTemplate={(t) => {
                            const exists = templates.findIndex(x => x.id === t.id);
                            const updated = exists >= 0 ? templates.map(x => x.id === t.id ? t : x) : [...templates, t];
                            updateData('templates', updated, setTemplates);
                        }}
                        onRemoveTemplate={(id) => updateData('templates', templates.filter(x => x.id !== id), setTemplates)}
                    />
                );
            case 'rules':
                return (
                    <RulesPage 
                        rules={rules}
                        accounts={accounts}
                        transactionTypes={transactionTypes}
                        categories={categories}
                        tags={tags}
                        payees={payees}
                        transactions={transactions}
                        onSaveRule={(r) => {
                            const exists = rules.findIndex(x => x.id === r.id);
                            const updated = exists >= 0 ? rules.map(x => x.id === r.id ? r : x) : [...rules, r];
                            updateData('reconciliationRules', updated, setRules);
                        }}
                        onDeleteRule={(id) => updateData('reconciliationRules', rules.filter(x => x.id !== id), setRules)}
                        onUpdateTransactions={(txs) => {
                            const txMap = new Map(txs.map(t => [t.id, t]));
                            updateData('transactions', transactions.map(t => txMap.has(t.id) ? txMap.get(t.id)! : t), setTransactions);
                        }}
                        onSaveCategory={(c) => updateData('categories', [...categories, c], setCategories)}
                        onSavePayee={(p) => updateData('payees', [...payees, p], setPayees)}
                        onSaveTag={(t) => updateData('tags', [...tags, t], setTags)}
                        onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                    />
                );
            case 'payees':
                return (
                    <PayeesPage 
                        payees={payees}
                        transactions={transactions}
                        users={users}
                        onSavePayee={(p) => {
                            const exists = payees.findIndex(x => x.id === p.id);
                            const updated = exists >= 0 ? payees.map(x => x.id === p.id ? p : x) : [...payees, p];
                            updateData('payees', updated, setPayees);
                        }}
                        onDeletePayee={(id) => updateData('payees', payees.filter(x => x.id !== id), setPayees)}
                    />
                );
            case 'categories':
                return (
                    <CategoriesPage 
                        categories={categories}
                        transactions={transactions}
                        onSaveCategory={(c) => {
                            const exists = categories.findIndex(x => x.id === c.id);
                            const updated = exists >= 0 ? categories.map(x => x.id === c.id ? c : x) : [...categories, c];
                            updateData('categories', updated, setCategories);
                        }}
                        onDeleteCategory={(id) => updateData('categories', categories.filter(x => x.id !== id), setCategories)}
                    />
                );
            case 'tags':
                return (
                    <TagsPage 
                        tags={tags}
                        onSaveTag={(t) => {
                            const exists = tags.findIndex(x => x.id === t.id);
                            const updated = exists >= 0 ? tags.map(x => x.id === t.id ? t : x) : [...tags, t];
                            updateData('tags', updated, setTags);
                        }}
                        onDeleteTag={(id) => updateData('tags', tags.filter(x => x.id !== id), setTags)}
                    />
                );
            case 'users':
                return (
                    <UsersPage 
                        users={users}
                        onSaveUser={(u) => {
                            const exists = users.findIndex(x => x.id === u.id);
                            const updated = exists >= 0 ? users.map(x => x.id === u.id ? u : x) : [...users, u];
                            updateData('users', updated, setUsers);
                        }}
                        onDeleteUser={(id) => updateData('users', users.filter(x => x.id !== id), setUsers)}
                    />
                );
            case 'settings':
                return (
                    <SettingsPage 
                        transactions={transactions}
                        transactionTypes={transactionTypes}
                        onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                        onRemoveTransactionType={(id) => updateData('transactionTypes', transactionTypes.filter(x => x.id !== id), setTransactionTypes)}
                        systemSettings={systemSettings}
                        onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)}
                        accounts={accounts}
                        categories={categories}
                        tags={tags}
                        payees={payees}
                        rules={rules}
                        templates={templates}
                        scheduledEvents={scheduledEvents}
                        tasks={tasks}
                        taskCompletions={taskCompletions}
                        users={users}
                        businessProfile={businessProfile}
                        documentFolders={documentFolders}
                        businessDocuments={businessDocuments}
                        onAddDocument={(d) => updateData('businessDocuments', [...businessDocuments, d], setBusinessDocuments)}
                        onCreateFolder={(f) => updateData('documentFolders', [...documentFolders, f], setDocumentFolders)}
                        savedReports={savedReports}
                        savedDateRanges={savedDateRanges}
                        amazonMetrics={amazonMetrics}
                        amazonVideos={amazonVideos}
                        youtubeMetrics={youtubeMetrics}
                        youtubeChannels={youtubeChannels}
                        financialGoals={financialGoals}
                        financialPlan={financialPlan}
                        contentLinks={contentLinks}
                    />
                );
            default:
                return null;
        }
    };

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-100 p-8 text-center">
                <div className="bg-white p-12 rounded-[2rem] shadow-2xl border-4 border-red-50 max-w-lg">
                    <div className="bg-red-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <ExclamationTriangleIcon className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-4 uppercase tracking-tight">Database Connectivity Error</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        {loadError}
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
                <Loader message="Initializing Data Engine..." />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Sidebar 
                currentView={currentView} 
                onNavigate={setCurrentView} 
                transactions={transactions}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onChatToggle={() => setIsChatOpen(!isChatOpen)}
            />
            
            <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-30">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
                        >
                            <MenuIcon className="w-6 h-6" />
                        </button>
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest truncate">
                            {currentView.replace(/integration-/, '').replace(/-/g, ' ')}
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsChatOpen(true)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative"
                            title="AI Assistant"
                        >
                            <SparklesIcon className="w-5 h-5" />
                        </button>
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border-2 border-white shadow-sm">
                            {userInitials}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar bg-slate-50/50">
                    {renderCurrentView()}
                </div>
            </main>

            <Chatbot 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                contextData={{
                    transactions: transactions.slice(0, 100),
                    accounts,
                    summary: {
                        income: transactions.filter(t => transactionTypes.find(tt => tt.id === t.typeId)?.balanceEffect === 'income').reduce((s,t) => s+t.amount, 0),
                        expenses: transactions.filter(t => transactionTypes.find(tt => tt.id === t.typeId)?.balanceEffect === 'expense').reduce((s,t) => s+t.amount, 0)
                    },
                    goals: financialGoals
                }}
            />
        </div>
    );
};

export default App;
