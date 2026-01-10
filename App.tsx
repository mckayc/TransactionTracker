
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Counterparty, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, View, BusinessNote, Location, RuleCategory } from './types';
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
import JournalPage from './views/JournalPage';
import DocumentsPage from './views/DocumentsPage';
import FinancialPlanPage from './views/FinancialPlanPage';
import IntegrationsPage from './views/IntegrationsPage';
import AmazonIntegration from './views/integrations/AmazonIntegration';
import YouTubeIntegration from './views/integrations/YouTubeIntegration';
import ContentHub from './views/integrations/ContentHub';
import Chatbot from './components/Chatbot';
import { MenuIcon, RepeatIcon, SparklesIcon, ExclamationTriangleIcon } from './components/Icons';
import { api } from './services/apiService';
import { generateUUID } from './utils';
import { updateGeminiConfig } from './services/geminiService';

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
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [ruleCategories, setRuleCategories] = useState<RuleCategory[]>([]);
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

    const isDirty = useRef<boolean>(false);
    const updateQueues = useRef<Record<string, Promise<void>>>({});

    const executeQueuedUpdate = async (key: string, updateFn: () => Promise<void>) => {
        const previousUpdate = updateQueues.current[key] || Promise.resolve();
        const currentUpdate = previousUpdate.then(updateFn).catch(err => {
            console.error(`[APP] Queued update failed for '${key}':`, err);
        });
        updateQueues.current[key] = currentUpdate;
        return currentUpdate;
    };

    const loadCoreData = async (showLoader = true) => {
        if (isDirty.current) {
            console.log("[APP] System is dirty (save in progress). Postponing background sync.");
            return;
        }
        if (showLoader) setIsLoading(true);
        else setIsSyncing(true);

        try {
            const data = await api.loadAll();
            
            setAccounts((data.accounts || []).filter(Boolean));
            setAccountTypes((data.accountTypes || []).filter(Boolean));
            setCategories((data.categories || []).filter(Boolean));
            setRuleCategories((data.ruleCategories || []).filter(Boolean));
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
            
            if (data.systemSettings?.aiConfig) {
                updateGeminiConfig(data.systemSettings.aiConfig);
            }

            try {
                const txResponse = await api.getTransactions({ limit: 1000 });
                if (txResponse && txResponse.data) setTransactions(txResponse.data.filter(Boolean));
            } catch (txErr) {
                console.error("[APP] Tx fetch failed:", txErr);
            }
        } catch (err) {
            console.error("[APP] Critical state load error:", err);
            setLoadError(`Engine Connection Failure: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            if (showLoader) setIsLoading(false);
            setIsSyncing(false);
            document.body.classList.add('loaded');
        }
    };

    useEffect(() => {
        loadCoreData();
        const handleSync = (event: MessageEvent) => { 
            if (event.data === 'REFRESH_REQUIRED') {
                loadCoreData(false); 
            }
        };
        if (syncChannel) syncChannel.addEventListener('message', handleSync);
        return () => { if (syncChannel) syncChannel.removeEventListener('message', handleSync); };
    }, []);

    const updateData = async (key: string, value: any, setter: Function) => {
        return executeQueuedUpdate(key, async () => {
            isDirty.current = true;
            try {
                await api.save(key, value);
                setter(value);
                if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
            } catch (e) {
                console.error(`[APP] Database write failed for '${key}':`, e);
                alert(`Error saving ${key}. Changes may be lost.`);
            } finally {
                isDirty.current = false;
            }
        });
    };

    const handleSaveRule = async (rule: ReconciliationRule) => {
        return executeQueuedUpdate('reconciliationRules', async () => {
            isDirty.current = true;
            try {
                await api.saveRule(rule);
                setRules(prev => {
                    const idx = prev.findIndex(r => r.id === rule.id);
                    if (idx > -1) return [...prev.slice(0, idx), rule, ...prev.slice(idx + 1)];
                    return [...prev, rule];
                });
                if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
            } finally {
                isDirty.current = false;
            }
        });
    };

    const handleSaveRules = async (newRules: ReconciliationRule[]) => {
        return updateData('reconciliationRules', [...rules, ...newRules], setRules);
    };

    const handleDeleteRule = async (id: string) => {
        return executeQueuedUpdate('reconciliationRules', async () => {
            isDirty.current = true;
            try {
                await api.deleteRule(id);
                setRules(prev => prev.filter(r => r.id !== id));
                if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
            } finally {
                isDirty.current = false;
            }
        });
    };

    const bulkUpdateData = async (key: string, newItems: any[], setter: Function, currentList: any[]) => {
        const next = [...currentList];
        newItems.filter(Boolean).forEach((item) => {
            if (!item || typeof item !== 'object' || !item.id) return;
            const idx = next.findIndex(x => x && x.id === item.id);
            if (idx > -1) next[idx] = item;
            else next.push(item);
        });
        await updateData(key, next, setter);
    };

    const handleTransactionsAdded = async (newTxs: Transaction[], newCategories: Category[] = []) => {
        isDirty.current = true;
        try {
            if (newCategories.length > 0) {
                await updateData('categories', [...categories, ...newCategories], setCategories);
            }
            await api.saveTransactions(newTxs.filter(Boolean));
            await loadCoreData(false);
            if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
        } catch (e) {
            console.error("[APP] Ingestion failure:", e);
            alert("Ledger save failed.");
        } finally {
            isDirty.current = false;
        }
    };

    const handleUpdateTransaction = async (tx: Transaction) => {
        isDirty.current = true;
        try {
            await api.saveTransactions([tx]);
            setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
            if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
        } finally {
            isDirty.current = false;
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        isDirty.current = true;
        try {
            await api.deleteTransaction(id);
            setTransactions(prev => prev.filter(t => t.id !== id));
            if (syncChannel) syncChannel.postMessage('REFRESH_REQUIRED');
        } finally {
            isDirty.current = false;
        }
    };

    if (loadError) return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border-2 border-red-100 text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                <div><h1 className="text-2xl font-black text-slate-800">Boot Error</h1><p className="text-slate-500 mt-2 font-medium">{loadError}</p></div>
                <button onClick={() => window.location.reload()} className="w-full py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Retry Connection</button>
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
                    {currentView === 'dashboard' && <Dashboard transactions={transactions} savedReports={savedReports} tasks={tasks} goals={financialGoals} systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)} categories={categories} amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} financialPlan={financialPlan} />}
                    {currentView === 'import' && <ImportPage transactions={transactions} accounts={accounts} accountTypes={accountTypes} categories={categories} tags={tags} transactionTypes={transactionTypes} rules={rules} counterparties={counterparties} locations={locations} users={users} documentFolders={documentFolders} onTransactionsAdded={handleTransactionsAdded} onAddAccount={(a) => bulkUpdateData('accounts', [a], setAccounts, accounts)} onAddAccountType={(t) => bulkUpdateData('accountTypes', [t], setAccountTypes, accountTypes)} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories, categories)} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties, counterparties)} onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations, locations)} onSaveUser={(u) => bulkUpdateData('users', [u], setUsers, users)} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags, tags)} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes, transactionTypes)} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments, businessDocuments)} onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders, documentFolders)} ruleCategories={ruleCategories} onSaveRuleCategory={(rc) => bulkUpdateData('ruleCategories', [rc], setRuleCategories, ruleCategories)} onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties, counterparties)} onSaveLocations={(ls) => bulkUpdateData('locations', ls, setLocations, locations)} onSaveCategories={(cs) => bulkUpdateData('categories', cs, setCategories, categories)} />}
                    {currentView === 'transactions' && <AllTransactions accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} onDeleteTransactions={async (ids) => { for(const id of ids) await api.deleteTransaction(id); await loadCoreData(false); }} onAddTransaction={(tx) => handleTransactionsAdded([tx])} onSaveRule={handleSaveRule} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories, categories)} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties, counterparties)} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags, tags)} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes, transactionTypes)} onSaveReport={(r) => bulkUpdateData('savedReports', [r], setSavedReports, savedReports)} />}
                    {currentView === 'calendar' && <CalendarPage transactions={transactions} tasks={tasks} templates={templates} scheduledEvents={scheduledEvents} taskCompletions={taskCompletions} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} users={users} onAddEvent={(e) => bulkUpdateData('scheduledEvents', [e], setScheduledEvents, scheduledEvents)} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={(tx) => handleTransactionsAdded([tx])} onToggleTaskCompletion={async (d, eid, tid) => { const next = {...taskCompletions, [`${d}_${eid}_${tid}`]: !taskCompletions[`${d}_${eid}_${tid}`]}; updateData('taskCompletions', next, setTaskCompletions); }} onToggleTask={(id) => { const next = {...taskCompletions, [id]: !taskCompletions[id]}; updateData('taskCompletions', next, setTaskCompletions); }} onSaveTask={(t) => bulkUpdateData('tasks', [t], setTasks, tasks)} transactionTypes={transactionTypes} />}
                    {currentView === 'rules' && <RulesPage rules={rules} onSaveRule={handleSaveRule} onSaveRules={handleSaveRules} onDeleteRule={handleDeleteRule} accounts={accounts} transactionTypes={transactionTypes} categories={categories} tags={tags} counterparties={counterparties} locations={locations} users={users} transactions={transactions} onUpdateTransactions={(txs) => handleTransactionsAdded(txs)} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories, categories)} onSaveCategories={(cs) => bulkUpdateData('categories', cs, setCategories, categories)} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties, counterparties)} onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties, counterparties)} onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations, locations)} onSaveLocations={(ls) => bulkUpdateData('locations', ls, setLocations, locations)} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags, tags)} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes, transactionTypes)} onSaveUser={(u) => bulkUpdateData('users', [u], setUsers, users)} ruleCategories={ruleCategories} onSaveRuleCategory={(rc) => bulkUpdateData('ruleCategories', [rc], setRuleCategories, ruleCategories)} onDeleteRuleCategory={(id) => { const next = ruleCategories.filter(rc => rc.id !== id); updateData('ruleCategories', next, setRuleCategories); }} systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)} />}
                    {currentView === 'management' && <ManagementHub transactions={transactions} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} locations={locations} users={users} transactionTypes={transactionTypes} accountTypes={accountTypes} onSaveAccount={(a) => bulkUpdateData('accounts', [a], setAccounts, accounts)} onDeleteAccount={(id) => { const next = accounts.filter(x => x.id !== id); updateData('accounts', next, setAccounts); }} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories, categories)} onDeleteCategory={(id) => { const next = categories.filter(c => c.id !== id); updateData('categories', next, setCategories); }} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags, tags)} onDeleteTag={(id) => { const next = tags.filter(t => t.id !== id); updateData('tags', next, setTags); }} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties, counterparties)} onDeleteCounterparty={(id) => { const next = counterparties.filter(p => p.id !== id); updateData('counterparties', next, setCounterparties); }} onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties, counterparties)} onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations, locations)} onDeleteLocation={(id) => { const next = locations.filter(l => l.id !== id); updateData('locations', next, setLocations); }} onSaveUser={(u) => bulkUpdateData('users', [u], setUsers, users)} onDeleteUser={(id) => { const next = users.filter(u => u.id !== id); updateData('users', next, setUsers); }} onSaveTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes, transactionTypes)} onDeleteTransactionType={(id) => { const next = transactionTypes.filter(t => t.id !== id); updateData('transactionTypes', next, setTransactionTypes); }} onSaveAccountType={(t) => bulkUpdateData('accountTypes', [t], setAccountTypes, accountTypes)} onDeleteAccountType={(id) => { const next = accountTypes.filter(at => at.id !== id); updateData('accountTypes', next, setAccountTypes); }} onSaveCategories={(cs) => bulkUpdateData('categories', cs, setCategories, categories)} onSaveLocations={(ls) => bulkUpdateData('locations', ls, setLocations, locations)} />}
                    {currentView === 'reports' && <Reports transactions={transactions} transactionTypes={transactionTypes} categories={categories} counterparties={counterparties} users={users} tags={tags} accounts={accounts} savedReports={savedReports} setSavedReports={(val) => { const newVal = typeof val === 'function' ? val(savedReports) : val; updateData('savedReports', newVal, setSavedReports); }} savedDateRanges={savedDateRanges} setSavedDateRanges={(val) => { const newVal = typeof val === 'function' ? val(savedDateRanges) : val; updateData('savedDateRanges', newVal, setSavedDateRanges); }} amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} onSaveReport={(r) => bulkUpdateData('savedReports', [r], setSavedReports, savedReports)} />}
                    {currentView === 'settings' && <SettingsPage transactions={transactions} transactionTypes={transactionTypes} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes, transactionTypes)} onRemoveTransactionType={(id) => { const next = transactionTypes.filter(x => x.id !== id); updateData('transactionTypes', next, setTransactionTypes); }} systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} rules={rules} templates={templates} scheduledEvents={scheduledEvents} tasks={tasks} taskCompletions={taskCompletions} users={users} businessProfile={businessProfile} businessNotes={businessNotes} documentFolders={documentFolders} businessDocuments={businessDocuments} onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments, businessDocuments)} onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders, documentFolders)} savedReports={savedReports} savedDateRanges={savedDateRanges} amazonMetrics={amazonMetrics} amazonVideos={amazonVideos} youtubeMetrics={youtubeMetrics} youtubeChannels={youtubeChannels} financialGoals={financialGoals} financialPlan={financialPlan} contentLinks={contentLinks} locations={locations} accountTypes={accountTypes} />}
                    {currentView === 'tasks' && <TasksPage tasks={tasks} onSaveTask={(t) => bulkUpdateData('tasks', [t], setTasks, tasks)} onDeleteTask={(id) => { const next = tasks.filter(t => t.id !== id); updateData('tasks', next, setTasks); }} onToggleTask={(id) => { const next = tasks.map(t => t.id === id ? {...t, isCompleted: !t.isCompleted} : t); updateData('tasks', next, setTasks); }} templates={templates} scheduledEvents={scheduledEvents} onSaveTemplate={(t) => bulkUpdateData('templates', [t], setTemplates, templates)} onRemoveTemplate={(id) => { const next = templates.filter(t => t.id !== id); updateData('templates', next, setTemplates); }} categories={categories} />}
                    {currentView === 'hub' && <BusinessHub profile={businessProfile} onUpdateProfile={(p) => updateData('businessProfile', p, setBusinessProfile)} notes={businessNotes} onUpdateNotes={(n) => updateData('businessNotes', n, setBusinessNotes)} chatSessions={chatSessions} onUpdateChatSessions={(s) => updateData('chatSessions', s, setChatSessions)} transactions={transactions} accounts={accounts} categories={categories} />}
                    {currentView === 'journal' && <JournalPage notes={businessNotes} onUpdateNotes={(n) => updateData('businessNotes', n, setBusinessNotes)} profile={businessProfile} />}
                    {currentView === 'documents' && <DocumentsPage documents={businessDocuments} folders={documentFolders} onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments, businessDocuments)} onRemoveDocument={(id) => { const next = businessDocuments.filter(d => d.id !== id); updateData('businessDocuments', next, setBusinessDocuments); }} onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders, documentFolders)} onDeleteFolder={(id) => { const next = documentFolders.filter(f => f.id !== id); updateData('documentFolders', next, setDocumentFolders); }} />}
                    {currentView === 'plan' && <FinancialPlanPage transactions={transactions} goals={financialGoals} onSaveGoals={(g) => updateData('financialGoals', g, setFinancialGoals)} plan={financialPlan} onSavePlan={(p) => updateData('financialPlan', p, setFinancialPlan)} categories={categories} businessProfile={businessProfile} />}
                    {currentView === 'integrations' && <IntegrationsPage onNavigate={setCurrentView} />}
                    {currentView === 'integration-amazon' && <AmazonIntegration metrics={amazonMetrics} onAddMetrics={(m) => bulkUpdateData('amazonMetrics', m, setAmazonMetrics, amazonMetrics)} onDeleteMetrics={(ids) => { const next = amazonMetrics.filter(m => !ids.includes(m.id)); updateData('amazonMetrics', next, setAmazonMetrics); }} videos={amazonVideos} onAddVideos={(v) => bulkUpdateData('amazonVideos', v, setAmazonVideos, amazonVideos)} onDeleteVideos={(ids) => { const next = amazonVideos.filter(v => !ids.includes(v.id)); updateData('amazonVideos', next, setAmazonVideos); }} />}
                    {currentView === 'integration-youtube' && <YouTubeIntegration metrics={youtubeMetrics} onAddMetrics={(m) => bulkUpdateData('youtubeMetrics', m, setYouTubeMetric, youtubeMetrics)} onDeleteMetrics={(ids) => { const next = youtubeMetrics.filter(m => !ids.includes(m.id)); updateData('youtubeMetrics', next, setYouTubeMetric); }} channels={youtubeChannels} onSaveChannel={(c) => bulkUpdateData('youtubeChannels', [c], setYouTubeChannels, youtubeChannels)} onDeleteChannel={(id) => { const next = youtubeChannels.filter(c => c.id !== id); updateData('youtubeChannels', next, setYouTubeChannels); }} />}
                    {currentView === 'integration-content-hub' && <ContentHub amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} contentLinks={contentLinks} onUpdateLinks={(l) => updateData('contentLinks', l, setContentLinks)} />}
                </div>
            </main>
            <Chatbot contextData={currentContext} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        </div>
    );
};

export default App;
