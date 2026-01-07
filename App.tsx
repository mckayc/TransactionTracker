import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Counterparty, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, View, BusinessNote, Location } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import ImportPage from './views/ImportPage';
import AllTransactions from './views/AllTransactions';
import CalendarPage from './views/CalendarPage';
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
// Added OmniSearch import
import OmniSearch from './components/OmniSearch';
import { MenuIcon, RepeatIcon, SparklesIcon, ExclamationTriangleIcon } from './components/Icons';
import { api } from './services/apiService';
import { generateUUID } from './utils';

const getSyncChannel = () => {
    try {
        if (typeof BroadcastChannel !== 'undefined') return new BroadcastChannel('finparser_sync');
    } catch (e) {}
    return null;
};
const syncChannel = getSyncChannel();

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    // Added isOmniSearchOpen state
    const [isOmniSearchOpen, setIsOmniSearchOpen] = useState(false);
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
    const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
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
            setAccounts((data.accounts || []).filter(Boolean));
            setAccountTypes((data.accountTypes || []).filter(Boolean));
            setCategories((data.categories || []).filter(Boolean));
            setTags((data.tags || []).filter(Boolean));
            setTransactionTypes((data.transactionTypes || []).filter(Boolean));
            setRules((data.reconciliationRules || []).filter(Boolean));
            setCounterparties((data.counterparties || []).filter(Boolean));
            setLocations((data.locations || []).filter(Boolean));
            setUsers(data.users && data.users.length > 0 ? data.users.filter(Boolean) : [{ id: 'user_primary', name: 'Primary User', isDefault: true }]);
            setBusinessProfile(data.businessProfile || { info: {}, tax: {}, completedSteps: [] });
            setBusinessNotes((data.businessNotes || []).filter(Boolean));
            setDocumentFolders((data.documentFolders || []).filter(Boolean));
            setBusinessDocuments((data.businessDocuments || []).filter(Boolean));
            setTemplates((data.templates || []).filter(Boolean));
            setScheduledEvents((data.scheduledEvents || []).filter(Boolean));
            setTasks((data.tasks || []).filter(Boolean));
            setTaskCompletions(data.taskCompletions || {});
            setSavedReports((data.savedReports || []).filter(Boolean));
            setSavedDateRanges((data.savedDateRanges || []).filter(Boolean));
            setChatSessions((data.chatSessions || []).filter(Boolean));
            setAmazonMetrics((data.amazonMetrics || []).filter(Boolean));
            setAmazonVideos((data.amazonVideos || []).filter(Boolean));
            setYouTubeMetric((data.youtubeMetrics || []).filter(Boolean));
            setYouTubeChannels((data.youtubeChannels || []).filter(Boolean));
            setFinancialGoals((data.financialGoals || []).filter(Boolean));
            setFinancialPlan(data.financialPlan || null);
            setContentLinks((data.contentLinks || []).filter(Boolean));
            setSystemSettings(data.systemSettings || {});
            
            try {
                const txResponse = await api.getTransactions({ limit: 1000 });
                if (txResponse && txResponse.data) setTransactions(txResponse.data.filter(Boolean));
            } catch (txErr) {}
        } catch (err) {
            console.error("Core Data Load Error:", err);
            setLoadError("Critical Engine Connection Failure. Verify API/DB reachability.");
        } finally {
            if (showLoader) setIsLoading(false);
            setIsSyncing(false);
            document.body.classList.add('loaded');
        }
    };

    useEffect(() => {
        loadCoreData();
        const handleSync = (event: MessageEvent) => { if (event.data === 'REFRESH_REQUIRED') loadCoreData(false); };
        if (syncChannel) syncChannel.addEventListener('message', handleSync);

        // Added global keyboard listener for OmniSearch (Cmd+K)
        const handleGlobalKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOmniSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleGlobalKey);

        return () => { 
            if (syncChannel) syncChannel.removeEventListener('message', handleSync); 
            window.removeEventListener('keydown', handleGlobalKey);
        };
    }, []);

    const updateData = async (key: string, value: any, setter: Function) => {
        setter(value);
        await api.save(key, value);
        if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
    };

    const bulkUpdateData = async (key: string, newItems: any[], setter: Function) => {
        // Use a more stable state management pattern to prevent race conditions during save
        setter((prev: any[]) => {
            const current = Array.isArray(prev) ? prev.filter(Boolean) : [];
            const next = [...current];
            newItems.filter(Boolean).forEach(item => {
                const idx = next.findIndex(x => x && x.id === item.id);
                if (idx > -1) next[idx] = item;
                else next.push(item);
            });
            
            // Trigger API save outside this synchronous block
            api.save(key, next).then(() => {
                if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
            });
            
            return next;
        });
    };

    const handleTransactionsAdded = async (newTxs: Transaction[], newCategories: Category[] = []) => {
        if (newCategories.length > 0) {
            setCategories(prev => {
                const next = [...prev.filter(Boolean), ...newCategories.filter(Boolean)];
                api.save('categories', next);
                return next;
            });
        }
        await api.saveTransactions(newTxs.filter(Boolean));
        loadCoreData(false);
    };

    const handleUpdateTransaction = async (tx: Transaction) => {
        setTransactions(prev => prev.map(t => t && t.id === tx.id ? tx : t));
        await api.saveTransactions([tx]);
    };

    const handleDeleteTransaction = async (id: string) => {
        setTransactions(prev => prev.filter(t => t && t.id !== id));
        await api.deleteTransaction(id);
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

    if (isLoading) return (
        <div className="h-screen flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Waking Engine...</p>
            </div>
        </div>
    );

    const currentContext = { transactions, accounts, categories, tags, counterparties, locations, users, amazonMetrics, youtubeMetrics, financialGoals, businessProfile };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
            {/* Added onSearchToggle to Sidebar */}
            <Sidebar 
                currentView={currentView} 
                onNavigate={setCurrentView} 
                transactions={transactions} 
                isCollapsed={isSidebarCollapsed} 
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                onChatToggle={() => setIsChatOpen(!isChatOpen)} 
                onSearchToggle={() => setIsOmniSearchOpen(true)}
            />
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
                            transactions={transactions} 
                            savedReports={savedReports} 
                            tasks={tasks}
                            goals={financialGoals}
                            systemSettings={systemSettings}
                            onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)}
                        />
                    )}
                    {currentView === 'import' && (
                        <ImportPage 
                            transactions={transactions} accounts={accounts} accountTypes={accountTypes}
                            categories={categories} tags={tags} transactionTypes={transactionTypes}
                            rules={rules} counterparties={counterparties} locations={locations} users={users}
                            documentFolders={documentFolders} onTransactionsAdded={handleTransactionsAdded}
                            onAddAccount={(a) => bulkUpdateData('accounts', [a], setAccounts)}
                            onAddAccountType={(t) => bulkUpdateData('accountTypes', [t], setAccountTypes)}
                            onSaveRule={(r) => bulkUpdateData('reconciliationRules', [r], setRules)}
                            onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)}
                            onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)}
                            onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)}
                            onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)}
                            onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction}
                            onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments)}
                            onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders)}
                        />
                    )}
                    {currentView === 'transactions' && (
                        <AllTransactions 
                            accounts={accounts} categories={categories} tags={tags} 
                            transactionTypes={transactionTypes} counterparties={counterparties} users={users}
                            onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction}
                            onDeleteTransactions={async (ids) => { setTransactions(prev => prev.filter(t => t && !ids.includes(t.id))); for(const id of ids) await api.deleteTransaction(id); }}
                            onAddTransaction={(tx) => handleTransactionsAdded([tx])}
                            onSaveRule={(r) => bulkUpdateData('reconciliationRules', [r], setRules)}
                            onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)}
                            onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)}
                            onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)}
                            onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)}
                            onSaveReport={(r) => bulkUpdateData('savedReports', [r], setSavedReports)}
                        />
                    )}
                    {currentView === 'calendar' && (
                        <CalendarPage 
                            transactions={transactions} tasks={tasks} templates={templates} scheduledEvents={scheduledEvents}
                            taskCompletions={taskCompletions} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} users={users}
                            onAddEvent={(e) => bulkUpdateData('scheduledEvents', [e], setScheduledEvents)}
                            onUpdateTransaction={handleUpdateTransaction} onAddTransaction={(tx) => handleTransactionsAdded([tx])}
                            onToggleTaskCompletion={async (d, eid, tid) => { const next = {...taskCompletions, [`${d}_${eid}_${tid}`]: !taskCompletions[`${d}_${eid}_${tid}`]}; updateData('taskCompletions', next, setTaskCompletions); }}
                            onToggleTask={(id) => setTaskCompletions(prev => ({...prev, [id]: !prev[id]}))} 
                            onSaveTask={(t) => bulkUpdateData('tasks', [t], setTasks)}
                            transactionTypes={transactionTypes}
                        />
                    )}
                    {currentView === 'rules' && (
                        <RulesPage 
                            rules={rules} 
                            onSaveRule={(r) => bulkUpdateData('reconciliationRules', [r], setRules)}
                            onSaveRules={(rs) => bulkUpdateData('reconciliationRules', rs, setRules)}
                            onDeleteRule={(id) => setRules(prev => { const next = prev.filter(r => r && r.id !== id); api.save('reconciliationRules', next); return next; })}
                            accounts={accounts} transactionTypes={transactionTypes} categories={categories} tags={tags} counterparties={counterparties} 
                            locations={locations} users={users} transactions={transactions}
                            onUpdateTransactions={(txs) => handleTransactionsAdded(txs)}
                            onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)}
                            onSaveCategories={(cs) => bulkUpdateData('categories', cs, setCategories)}
                            onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)}
                            onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties)}
                            onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations)}
                            onSaveLocations={(ls) => bulkUpdateData('locations', ls, setLocations)}
                            onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)}
                            onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)}
                            onSaveUser={(u) => bulkUpdateData('users', [u], setUsers)}
                        />
                    )}
                    {currentView === 'management' && (
                        <ManagementHub 
                            transactions={transactions} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} 
                            locations={locations} users={users} transactionTypes={transactionTypes} accountTypes={accountTypes}
                            onSaveAccount={(a) => bulkUpdateData('accounts', [a], setAccounts)}
                            onDeleteAccount={(id) => setAccounts(prev => { const next = prev.filter(x => x && x.id !== id); api.save('accounts', next); return next; })}
                            onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)}
                            onDeleteCategory={(id) => setCategories(prev => { const next = prev.filter(c => c && c.id !== id); api.save('categories', next); return next; })}
                            onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)}
                            onDeleteTag={(id) => setTags(prev => { const next = prev.filter(t => t && t.id !== id); api.save('tags', next); return next; })}
                            onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)}
                            onDeleteCounterparty={(id) => setCounterparties(prev => { const next = prev.filter(p => p && p.id !== id); api.save('counterparties', next); return next; })}
                            onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties)}
                            onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations)}
                            onDeleteLocation={(id) => setLocations(prev => { const next = prev.filter(l => l && l.id !== id); api.save('locations', next); return next; })}
                            onSaveUser={(u) => bulkUpdateData('users', [u], setUsers)}
                            onDeleteUser={(id) => setUsers(prev => { const next = prev.filter(u => u && u.id !== id); api.save('users', next); return next; })}
                            onSaveTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)}
                            onDeleteTransactionType={(id) => setTransactionTypes(prev => { const next = prev.filter(t => t && t.id !== id); api.save('transactionTypes', next); return next; })}
                            onSaveAccountType={(t) => bulkUpdateData('accountTypes', [t], setAccountTypes)}
                            onDeleteAccountType={(id) => setAccountTypes(prev => { const next = prev.filter(t => t && t.id !== id); api.save('accountTypes', next); return next; })}
                        />
                    )}
                    {currentView === 'reports' && (
                        <Reports 
                            transactions={transactions} transactionTypes={transactionTypes} categories={categories} 
                            counterparties={counterparties} users={users} tags={tags} accounts={accounts} savedReports={savedReports} 
                            setSavedReports={(val) => {
                                const newVal = typeof val === 'function' ? val(savedReports) : val;
                                updateData('savedReports', newVal, setSavedReports);
                            }}
                            savedDateRanges={savedDateRanges}
                            setSavedDateRanges={(val) => {
                                const newVal = typeof val === 'function' ? val(savedDateRanges) : val;
                                updateData('savedDateRanges', newVal, setSavedDateRanges);
                            }}
                            amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics}
                            onSaveReport={(r) => bulkUpdateData('savedReports', [r], setSavedReports)}
                        />
                    )}
                    {currentView === 'settings' && (
                        <SettingsPage 
                            transactions={transactions} transactionTypes={transactionTypes} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)}
                            onRemoveTransactionType={(id) => setTransactionTypes(prev => { const next = prev.filter(x => x && x.id !== id); api.save('transactionTypes', next); return next; })}
                            systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)}
                            accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} rules={rules}
                            templates={templates} scheduledEvents={scheduledEvents} tasks={tasks} taskCompletions={taskCompletions}
                            users={users} businessProfile={businessProfile} businessNotes={businessNotes} documentFolders={documentFolders}
                            businessDocuments={businessDocuments} onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments)}
                            onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders)}
                            savedReports={savedReports} savedDateRanges={savedDateRanges} amazonMetrics={amazonMetrics} amazonVideos={amazonVideos}
                            youtubeMetrics={youtubeMetrics} youtubeChannels={youtubeChannels} financialGoals={financialGoals} 
                            financialPlan={financialPlan} contentLinks={contentLinks}
                            locations={locations} accountTypes={accountTypes}
                        />
                    )}
                    {currentView === 'tasks' && (
                        <TasksPage 
                            tasks={tasks} onSaveTask={(t) => bulkUpdateData('tasks', [t], setTasks)}
                            onDeleteTask={(id) => setTasks(prev => { const next = prev.filter(t => t && t.id !== id); api.save('tasks', next); return next; })}
                            onToggleTask={(id) => setTasks(prev => { const next = prev.map(t => t && t.id === id ? {...t, isCompleted: !t.isCompleted} : t); api.save('tasks', next); return next; })}
                            templates={templates} scheduledEvents={scheduledEvents}
                            onSaveTemplate={(t) => bulkUpdateData('templates', [t], setTemplates)}
                            onRemoveTemplate={(id) => setTemplates(prev => { const next = prev.filter(t => t && t.id !== id); api.save('templates', next); return next; })}
                            categories={categories}
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
                            onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments)}
                            onRemoveDocument={(id) => setBusinessDocuments(prev => { const next = prev.filter(d => d && d.id !== id); api.save('businessDocuments', next); return next; })}
                            onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders)}
                            onDeleteFolder={(id) => setDocumentFolders(prev => { const next = prev.filter(f => f && f.id !== id); api.save('documentFolders', next); return next; })}
                        />
                    )}
                    {currentView === 'plan' && (
                        <FinancialPlanPage 
                            transactions={transactions} goals={financialGoals} 
                            onSaveGoals={(g) => updateData('financialGoals', g, setFinancialGoals)}
                            plan={financialPlan} onSavePlan={(p) => updateData('financialPlan', p, setFinancialPlan)}
                            categories={categories} businessProfile={businessProfile}
                        />
                    )}
                    {currentView === 'integrations' && <IntegrationsPage onNavigate={setCurrentView} />}
                    {currentView === 'integration-amazon' && (
                        <AmazonIntegration 
                            metrics={amazonMetrics} onAddMetrics={(m) => bulkUpdateData('amazonMetrics', m, setAmazonMetrics)}
                            onDeleteMetrics={(ids) => setAmazonMetrics(prev => { const next = prev.filter(m => m && !ids.includes(m.id)); api.save('amazonMetrics', next); return next; })}
                            videos={amazonVideos} onAddVideos={(v) => bulkUpdateData('amazonVideos', v, setAmazonVideos)}
                            onDeleteVideos={(ids) => setAmazonVideos(prev => { const next = prev.filter(v => v && !ids.includes(v.id)); api.save('amazonVideos', next); return next; })}
                        />
                    )}
                    {currentView === 'integration-youtube' && (
                        <YouTubeIntegration 
                            metrics={youtubeMetrics} onAddMetrics={(m) => bulkUpdateData('youtubeMetrics', m, setYouTubeMetric)}
                            onDeleteMetrics={(ids) => setYouTubeMetric(prev => { const next = prev.filter(m => m && !ids.includes(m.id)); api.save('youtubeMetrics', next); return next; })}
                            channels={youtubeChannels} onSaveChannel={(c) => bulkUpdateData('youtubeChannels', [c], setYouTubeChannels)}
                            onDeleteChannel={(id) => setYouTubeChannels(prev => { const next = prev.filter(c => c && c.id !== id); api.save('youtubeChannels', next); return next; })}
                        />
                    )}
                    {currentView === 'integration-content-hub' && (
                        <ContentHub 
                            amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} contentLinks={contentLinks}
                            onUpdateLinks={(l) => updateData('contentLinks', l, setContentLinks)}
                        />
                    )}
                </div>
            </main>
            <Chatbot contextData={currentContext} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            {/* Added missing OmniSearch component with correct state handling */}
            <OmniSearch 
                isOpen={isOmniSearchOpen} 
                onClose={() => setIsOmniSearchOpen(false)} 
                transactions={transactions} 
                categories={categories} 
                counterparties={counterparties} 
                onNavigate={(v) => setCurrentView(v)}
            />
        </div>
    );
};

export default App;