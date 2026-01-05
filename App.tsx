
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Payee, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, View, BusinessNote } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import AllTransactions from './views/AllTransactions';
import CalendarPage from './views/CalendarPage';
import AccountsPage from './views/AccountsPage';
import Reports from './views/Reports';
import SettingsPage from './views/SettingsPage';
import TasksPage from './views/TasksPage';
import RulesPage from './views/RulesPage';
import ManagementHub from './views/ManagementHub';
import BusinessHub from './views/BusinessHub';
import DocumentsPage from './views/DocumentsPage';
import FinancialPlanPage from './views/FinancialPlanPage';
import IntegrationsPage from './views/IntegrationsPage';
import AmazonIntegration from './views/integrations/AmazonIntegration';
import YouTubeIntegration from './views/integrations/YouTubeIntegration';
import ContentHub from './views/integrations/ContentHub';
import Chatbot from './components/Chatbot';
import Loader from './components/Loader';
import { MenuIcon, CloseIcon, SparklesIcon, ExclamationTriangleIcon, RepeatIcon } from './components/Icons';
import { api } from './services/apiService';
import { generateUUID } from './utils';

const syncChannel = new BroadcastChannel('finparser_sync');

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
    const [rules, setRules] = useState<ReconciliationRule[]>([]);
    const [payees, setPayees] = useState<Payee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({ info: {}, tax: {}, completedSteps: [] });
    const [businessNotes, setBusinessNotes] = useState<BusinessNote[]>([]);
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

    const loadCoreData = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        else setIsSyncing(true);

        try {
            const data = await api.loadAll();
            setAccounts(data.accounts || []);
            setAccountTypes(data.accountTypes || []);
            setCategories(data.categories || []);
            setTags(data.tags || []);
            setTransactionTypes(data.transactionTypes || []);
            setRules(data.reconciliationRules || []);
            setPayees(data.payees || []);
            setUsers(data.users && data.users.length > 0 ? data.users : [{ id: 'user_primary', name: 'Primary User', isDefault: true }]);
            setBusinessProfile(data.businessProfile || { info: {}, tax: {}, completedSteps: [] });
            setBusinessNotes(data.businessNotes || []);
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
            
            const txResponse = await api.getTransactions({ limit: 100 });
            setTransactions(txResponse.data);

            if (showLoader) setIsLoading(false);
        } catch (err) {
            console.error("Core Data Load Error:", err);
            setLoadError("Engine startup failed. Please check server logs.");
        } finally {
            setIsSyncing(false);
            // Crucial: Always add 'loaded' class to hide the HTML splash screen
            // Even if an error occurred, we want the error UI to be visible.
            document.body.classList.add('loaded');
        }
    };

    useEffect(() => {
        loadCoreData();
        const handleSync = (event: MessageEvent) => { if (event.data === 'REFRESH_REQUIRED') loadCoreData(false); };
        syncChannel.addEventListener('message', handleSync);
        return () => syncChannel.removeEventListener('message', handleSync);
    }, []);

    const updateData = async (key: string, value: any, setter: Function) => {
        setter(value);
        await api.save(key, value);
        syncChannel.postMessage('REFRESH_REQUIRED');
    };

    const handleTransactionsAdded = async (newTxs: Transaction[]) => {
        await api.saveTransactions(newTxs);
        loadCoreData(false);
    };

    if (loadError) return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border-2 border-red-100 text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <ExclamationTriangleIcon className="w-10 h-10" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Boot Error</h1>
                    <p className="text-slate-500 mt-2 font-medium">{loadError}</p>
                </div>
                <button onClick={() => window.location.reload()} className="w-full py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    Retry Connection
                </button>
            </div>
        </div>
    );

    if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader message="Optimizing Data Streams..." /></div>;

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
            <Sidebar currentView={currentView} onNavigate={setCurrentView} transactions={transactions} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} onChatToggle={() => setIsChatOpen(!isChatOpen)} />
            <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"><MenuIcon className="w-6 h-6" /></button>
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest truncate">{currentView.replace(/-/g, ' ')}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {isSyncing && <RepeatIcon className="w-4 h-4 animate-spin text-indigo-500" />}
                        <button onClick={() => setIsChatOpen(true)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"><SparklesIcon className="w-5 h-5" /></button>
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border-2 border-white shadow-sm">U</div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar bg-slate-50/50">
                    {currentView === 'dashboard' && (
                        <Dashboard 
                            transactions={transactions} accounts={accounts} accountTypes={accountTypes}
                            categories={categories} tags={tags} transactionTypes={transactionTypes}
                            rules={rules} payees={payees} users={users}
                            documentFolders={documentFolders} onTransactionsAdded={handleTransactionsAdded}
                            onAddAccount={(a) => updateData('accounts', [...accounts, a], setAccounts)}
                            onAddAccountType={(t) => updateData('accountTypes', [...accountTypes, t], setAccountTypes)}
                            onAddDocument={(d) => updateData('businessDocuments', [...businessDocuments, d], setBusinessDocuments)}
                            onCreateFolder={(f) => updateData('documentFolders', [...documentFolders, f], setDocumentFolders)}
                            onSaveRule={(r) => updateData('reconciliationRules', [...rules, r], setRules)}
                            onSaveCategory={(c) => updateData('categories', [...categories, c], setCategories)}
                            onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                            onUpdateTransaction={async (t) => { await api.saveTransactions([t]); loadCoreData(false); }}
                            onDeleteTransaction={async (id) => { await api.deleteTransaction(id); loadCoreData(false); }}
                            onSavePayee={(p) => updateData('payees', [...payees, p], setPayees)}
                            onSaveTag={(t) => updateData('tags', [...tags, t], setTags)}
                        />
                    )}
                    {currentView === 'transactions' && (
                        <AllTransactions 
                            accounts={accounts} categories={categories} tags={tags}
                            transactionTypes={transactionTypes} payees={payees} users={users}
                            onUpdateTransaction={async (t) => { await api.saveTransactions([t]); loadCoreData(false); }}
                            onAddTransaction={async (t) => { await api.saveTransactions([t]); loadCoreData(false); }}
                            onDeleteTransaction={async (id) => { await api.deleteTransaction(id); loadCoreData(false); }}
                            onDeleteTransactions={async (ids) => { for(const id of ids) await api.deleteTransaction(id); loadCoreData(false); }}
                            onSaveRule={(r) => updateData('reconciliationRules', [...rules, r], setRules)}
                            onSaveCategory={(c) => updateData('categories', [...categories, c], setCategories)}
                            onSavePayee={(p) => updateData('payees', [...payees, p], setPayees)}
                            onSaveTag={(t) => updateData('tags', [...tags, t], setTags)}
                            onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                            onSaveReport={(r) => updateData('savedReports', [...savedReports, r], setSavedReports)}
                        />
                    )}
                    {currentView === 'accounts' && (
                        <AccountsPage 
                            accounts={accounts} 
                            accountTypes={accountTypes}
                            onAddAccount={(a) => updateData('accounts', [...accounts, a], setAccounts)}
                            onUpdateAccount={(a) => updateData('accounts', accounts.map(x => x.id === a.id ? a : x), setAccounts)}
                            onRemoveAccount={(id) => updateData('accounts', accounts.filter(x => x.id !== id), setAccounts)}
                            onAddAccountType={(t) => updateData('accountTypes', [...accountTypes, t], setAccountTypes)}
                            onRemoveAccountType={(id) => updateData('accountTypes', accountTypes.filter(x => x.id !== id), setAccountTypes)}
                        />
                    )}
                    {currentView === 'rules' && (
                        <RulesPage 
                            rules={rules} 
                            transactions={transactions}
                            accounts={accounts}
                            categories={categories}
                            tags={tags}
                            payees={payees}
                            transactionTypes={transactionTypes}
                            onSaveRule={(r) => updateData('reconciliationRules', rules.some(x => x.id === r.id) ? rules.map(x => x.id === r.id ? r : x) : [...rules, r], setRules)}
                            onDeleteRule={(id) => updateData('reconciliationRules', rules.filter(x => x.id !== id), setRules)}
                            onUpdateTransactions={async (txs) => { await api.saveTransactions(txs); loadCoreData(false); }}
                            onSaveCategory={(c) => updateData('categories', [...categories, c], setCategories)}
                            onSavePayee={(p) => updateData('payees', [...payees, p], setPayees)}
                            onSaveTag={(t) => updateData('tags', [...tags, t], setTags)}
                            onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                        />
                    )}
                    {currentView === 'calendar' && (
                         <CalendarPage 
                            transactions={transactions} templates={templates} scheduledEvents={scheduledEvents}
                            tasks={tasks} taskCompletions={taskCompletions} accounts={accounts} 
                            categories={categories} tags={tags} payees={payees} users={users}
                            onAddEvent={(e) => updateData('scheduledEvents', [...scheduledEvents, e], setScheduledEvents)}
                            onUpdateTransaction={async (t) => { await api.saveTransactions([t]); loadCoreData(false); }}
                            onAddTransaction={async (t) => { await api.saveTransactions([t]); loadCoreData(false); }}
                            onToggleTaskCompletion={() => {}} 
                            onToggleTask={(id) => {}} 
                            transactionTypes={transactionTypes}
                         />
                    )}
                    {currentView === 'tasks' && (
                         <TasksPage 
                            tasks={tasks} 
                            onSaveTask={(t) => updateData('tasks', tasks.some(x => x.id === t.id) ? tasks.map(x => x.id === t.id ? t : x) : [...tasks, t], setTasks)}
                            onDeleteTask={(id) => updateData('tasks', tasks.filter(x => x.id !== id), setTasks)}
                            onToggleTask={(id) => updateData('tasks', tasks.map(x => x.id === id ? { ...x, isCompleted: !x.isCompleted } : x), setTasks)}
                            templates={templates} 
                            scheduledEvents={scheduledEvents}
                            onSaveTemplate={(t) => updateData('templates', templates.some(x => x.id === t.id) ? templates.map(x => x.id === t.id ? t : x) : [...templates, t], setTemplates)}
                            onRemoveTemplate={(id) => updateData('templates', templates.filter(x => x.id !== id), setTemplates)}
                         />
                    )}
                    {currentView === 'reports' && (
                        <Reports 
                            transactions={transactions} categories={categories} transactionTypes={transactionTypes}
                            accounts={accounts} users={users} tags={tags} payees={payees}
                            savedReports={savedReports} setSavedReports={(r) => updateData('savedReports', r, setSavedReports)}
                            savedDateRanges={savedDateRanges} setSavedDateRanges={(d) => updateData('savedDateRanges', d, setSavedDateRanges)}
                            amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics}
                        />
                    )}
                     {currentView === 'settings' && (
                        <SettingsPage 
                            transactions={transactions} transactionTypes={transactionTypes}
                            onAddTransactionType={(t) => updateData('transactionTypes', [...transactionTypes, t], setTransactionTypes)}
                            onRemoveTransactionType={(id) => updateData('transactionTypes', transactionTypes.filter(t => t.id !== id), setTransactionTypes)}
                            systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)}
                            accounts={accounts} categories={categories} tags={tags} payees={payees}
                            rules={rules} templates={templates} scheduledEvents={scheduledEvents}
                            tasks={tasks} taskCompletions={taskCompletions} users={users}
                            businessProfile={businessProfile} documentFolders={documentFolders}
                            businessDocuments={businessDocuments} onAddDocument={(d) => updateData('businessDocuments', [...businessDocuments, d], setBusinessDocuments)}
                            onCreateFolder={(f) => updateData('documentFolders', [...documentFolders, f], setDocumentFolders)}
                            savedReports={savedReports} savedDateRanges={savedDateRanges}
                            amazonMetrics={amazonMetrics} amazonVideos={amazonVideos}
                            youtubeMetrics={youtubeMetrics} youtubeChannels={youtubeChannels}
                            financialGoals={financialGoals} financialPlan={financialPlan}
                            contentLinks={contentLinks}
                            businessNotes={businessNotes}
                        />
                    )}
                    {currentView === 'management' && (
                        <ManagementHub 
                            transactions={transactions} categories={categories} 
                            onSaveCategory={(c) => updateData('categories', categories.some(x => x.id === c.id) ? categories.map(x => x.id === c.id ? c : x) : [...categories, c], setCategories)}
                            onDeleteCategory={(id) => updateData('categories', categories.filter(x => x.id !== id), setCategories)}
                            tags={tags} onSaveTag={(t) => updateData('tags', tags.some(x => x.id === t.id) ? tags.map(x => x.id === t.id ? t : x) : [...tags, t], setTags)}
                            onDeleteTag={(id) => updateData('tags', tags.filter(x => x.id !== id), setTags)}
                            payees={payees} onSavePayee={(p) => updateData('payees', payees.some(x => x.id === p.id) ? payees.map(x => x.id === p.id ? p : x) : [...payees, p], setPayees)}
                            onDeletePayee={(id) => updateData('payees', payees.filter(x => x.id !== id), setPayees)}
                            users={users} onSaveUser={(u) => updateData('users', users.some(x => x.id === u.id) ? users.map(x => x.id === u.id ? u : x) : [...users, u], setUsers)}
                            onDeleteUser={(id) => updateData('users', users.filter(x => x.id !== id), setUsers)}
                            transactionTypes={transactionTypes} onSaveTransactionType={(t) => updateData('transactionTypes', transactionTypes.some(x => x.id === t.id) ? transactionTypes.map(x => x.id === t.id ? t : x) : [...transactionTypes, t], setTransactionTypes)}
                            onDeleteTransactionType={(id) => updateData('transactionTypes', transactionTypes.filter(x => x.id !== id), setTransactionTypes)}
                            accountTypes={accountTypes} onSaveAccountType={(t) => updateData('accountTypes', accountTypes.some(x => x.id === t.id) ? accountTypes.map(x => x.id === t.id ? t : x) : [...accountTypes, t], setAccountTypes)}
                            onDeleteAccountType={(id) => updateData('accountTypes', accountTypes.filter(x => x.id !== id), setAccountTypes)}
                            accounts={accounts}
                        />
                    )}
                    {currentView === 'hub' && (
                        <BusinessHub 
                            profile={businessProfile} onUpdateProfile={(p) => updateData('businessProfile', p, setBusinessProfile)}
                            notes={businessNotes} onUpdateNotes={(n) => updateData('businessNotes', n, setBusinessNotes)}
                            chatSessions={chatSessions} onUpdateChatSessions={(s) => updateData('chatSessions', s, setChatSessions)}
                            transactions={transactions} accounts={accounts} categories={categories}
                        />
                    )}
                    {currentView === 'documents' && (
                        <DocumentsPage 
                            documents={businessDocuments} folders={documentFolders}
                            onAddDocument={(d) => updateData('businessDocuments', [...businessDocuments, d], setBusinessDocuments)}
                            onRemoveDocument={(id) => updateData('businessDocuments', businessDocuments.filter(d => d.id !== id), setBusinessDocuments)}
                            onCreateFolder={(f) => updateData('documentFolders', [...documentFolders, f], setDocumentFolders)}
                            onDeleteFolder={(id) => updateData('documentFolders', documentFolders.filter(f => f.id !== id), setDocumentFolders)}
                        />
                    )}
                    {currentView === 'plan' && (
                        <FinancialPlanPage 
                            transactions={transactions} goals={financialGoals}
                            onSaveGoals={(g) => updateData('financialGoals', g, setFinancialGoals)}
                            plan={financialPlan} onSavePlan={(p) => updateData('financialPlan', p, setFinancialPlan)}
                            categories={categories}
                        />
                    )}
                    {currentView === 'integrations' && <IntegrationsPage onNavigate={(v) => setCurrentView(v as View)} />}
                    {currentView === 'integration-amazon' && <AmazonIntegration metrics={amazonMetrics} onAddMetrics={(m) => updateData('amazonMetrics', [...amazonMetrics, ...m], setAmazonMetrics)} onDeleteMetrics={(ids) => updateData('amazonMetrics', amazonMetrics.filter(m => !ids.includes(m.id)), setAmazonMetrics)} videos={amazonVideos} onAddVideos={(v) => updateData('amazonVideos', [...amazonVideos, ...v], setAmazonVideos)} onDeleteVideos={(ids) => updateData('amazonVideos', amazonVideos.filter(v => !ids.includes(v.id)), setAmazonVideos)} />}
                    {currentView === 'integration-youtube' && <YouTubeIntegration metrics={youtubeMetrics} onAddMetrics={(m) => updateData('youtubeMetrics', [...youtubeMetrics, ...m], setYouTubeMetric)} onDeleteMetrics={(ids) => updateData('youtubeMetrics', youtubeMetrics.filter(m => !ids.includes(m.id)), setYouTubeMetric)} channels={youtubeChannels} onSaveChannel={(c) => updateData('youtubeChannels', youtubeChannels.some(x => x.id === c.id) ? youtubeChannels.map(x => x.id === c.id ? c : x) : [...youtubeChannels, c], setYouTubeChannels)} onDeleteChannel={(id) => updateData('youtubeChannels', youtubeChannels.filter(x => x.id !== id), setYouTubeChannels)} />}
                    {currentView === 'integration-content-hub' && <ContentHub amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} contentLinks={contentLinks} onUpdateLinks={(l) => updateData('contentLinks', l, setContentLinks)} />}
                </div>
            </main>
            <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} contextData={{ transactions: transactions.slice(0, 100), accounts }} />
        </div>
    );
};

export default App;
