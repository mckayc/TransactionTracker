
import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import type { Transaction, Account, AccountType, Template, ScheduledEvent, TaskCompletions, TransactionType, ReconciliationRule, Counterparty, Category, RawTransaction, User, BusinessProfile, BusinessDocument, TaskItem, SystemSettings, DocumentFolder, BackupConfig, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, View, BusinessNote, Location, RuleCategory, JoinedMetric, ProductJoinerProject } from './types';
import Sidebar from './components/Sidebar';
import Chatbot from './components/Chatbot';
import { MenuIcon, RepeatIcon, SparklesIcon, ExclamationTriangleIcon } from './components/Icons';
import { api } from './services/apiService';
import { generateUUID } from './utils';
import { updateGeminiConfig } from './services/geminiService';

// Level 2 Optimization: Route-Based Code Splitting
const Dashboard = lazy(() => import('./views/Dashboard'));
const ImportPage = lazy(() => import('./views/ImportPage'));
const AllTransactions = lazy(() => import('./views/AllTransactions'));
const CalendarPage = lazy(() => import('./views/CalendarPage'));
const Reports = lazy(() => import('./views/Reports'));
const SettingsPage = lazy(() => import('./views/SettingsPage'));
const TasksPage = lazy(() => import('./views/TasksPage'));
const RulesPage = lazy(() => import('./views/RulesPage'));
const ManagementHub = lazy(() => import('./views/ManagementHub'));
const BusinessHub = lazy(() => import('./views/BusinessHub'));
const JournalPage = lazy(() => import('./views/JournalPage'));
const DocumentsPage = lazy(() => import('./views/DocumentsPage'));
const FinancialPlanPage = lazy(() => import('./views/FinancialPlanPage'));
const IntegrationsPage = lazy(() => import('./views/IntegrationsPage'));
const AmazonIntegration = lazy(() => import('./views/integrations/AmazonIntegration'));
const YouTubeIntegration = lazy(() => import('./views/integrations/YouTubeIntegration'));
const VideoProductJoiner = lazy(() => import('./views/integrations/VideoProductJoiner'));
const ProductAsinJoiner = lazy(() => import('./views/integrations/ProductAsinJoiner'));

const APP_INSTANCE_ID = generateUUID();

const getSyncChannel = () => {
    try {
        if (typeof BroadcastChannel !== 'undefined') return new BroadcastChannel('finparser_sync_v2');
    } catch (e) {}
    return null;
};
const syncChannel = getSyncChannel();

const ViewLoader = () => (
    <div className="h-full w-full flex flex-col items-center justify-center space-y-4 animate-fade-in">
        <div className="w-10 h-10 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initializing Logic...</p>
    </div>
);

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
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
    
    // New Data State for Multi-Project Joiner
    const [productJoinerProjects, setProductJoinerProjects] = useState<ProductJoinerProject[]>([]);
    const [joinedMetrics, setJoinedMetrics] = useState<JoinedMetric[]>([]); // Legacy compatibility

    const isDirty = useRef<boolean>(false);
    const updateQueues = useRef<Record<string, Promise<void>>>({});

    const loadCoreData = async (showLoader = true) => {
        if (isDirty.current) return;
        if (showLoader) setIsLoading(true);
        else setIsSyncing(true);

        try {
            const data = await api.loadAll();
            
            // Atomic Batch Update to prevent multiple renders
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
            setSystemSettings(data.systemSettings || {});
            setJoinedMetrics((data.joinedMetrics || []).filter(Boolean));
            setProductJoinerProjects((data.productJoinerProjects || []).filter(Boolean));
            
            if (data.systemSettings?.aiConfig) {
                updateGeminiConfig(data.systemSettings.aiConfig);
            }

            try {
                // LOAD OPTIMIZATION:
                const txResponse = await api.getTransactions({ limit: 1000 });
                if (txResponse && txResponse.data) setTransactions(txResponse.data.filter(Boolean));
            } catch (txErr) {
                console.error("[APP] Tx warm-up failed:", txErr);
            }
        } catch (err) {
            console.error("[APP] State load error:", err);
            setLoadError(`Database Connection Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            if (showLoader) setIsLoading(false);
            setIsSyncing(false);
            document.body.classList.add('loaded');
        }
    };

    useEffect(() => {
        loadCoreData();
        const handleSync = (event: MessageEvent) => { 
            if (event.data.origin === APP_INSTANCE_ID) return;
            if (event.data.type === 'REFRESH_REQUIRED') {
                console.log("[SYNC] Remote change detected. Syncing...");
                loadCoreData(false); 
            }
        };
        if (syncChannel) syncChannel.addEventListener('message', handleSync);
        return () => { if (syncChannel) syncChannel.removeEventListener('message', handleSync); };
    }, []);

    const executeQueuedUpdate = async (key: string, updateFn: () => Promise<void>) => {
        const previousUpdate = updateQueues.current[key] || Promise.resolve();
        const currentUpdate = previousUpdate.then(updateFn).catch(err => {
            console.error(`[APP] Queue failure for '${key}':`, err);
        });
        updateQueues.current[key] = currentUpdate;
        return currentUpdate;
    };

    const updateData = async (key: string, value: any, setter: Function) => {
        setter(value);
        return executeQueuedUpdate(key, async () => {
            isDirty.current = true;
            try {
                await api.save(key, value);
                if (syncChannel) {
                    syncChannel.postMessage({ 
                        type: 'REFRESH_REQUIRED', 
                        key, 
                        origin: APP_INSTANCE_ID 
                    });
                }
            } catch (e) {
                console.error(`[APP] Background save failed for '${key}':`, e);
                loadCoreData(false);
            } finally {
                isDirty.current = false;
            }
        });
    };

    const handleSaveRule = async (rule: ReconciliationRule) => {
        setRules(prev => {
            const idx = prev.findIndex(r => r.id === rule.id);
            if (idx > -1) return [...prev.slice(0, idx), rule, ...prev.slice(idx + 1)];
            return [...prev, rule];
        });

        return executeQueuedUpdate('reconciliationRules', async () => {
            isDirty.current = true;
            try {
                await api.saveRule(rule);
                if (syncChannel) {
                    syncChannel.postMessage({ type: 'REFRESH_REQUIRED', origin: APP_INSTANCE_ID });
                }
            } catch (e) {
                console.error("[APP] Rule save failed:", e);
                loadCoreData(false);
            } finally {
                isDirty.current = false;
            }
        });
    };

    const handleSaveRules = async (newRules: ReconciliationRule[]) => {
        for(const rule of newRules) {
            await api.saveRule(rule);
        }
        loadCoreData(false);
    };

    const handleDeleteRule = async (id: string) => {
        setRules(prev => prev.filter(r => r.id !== id));

        return executeQueuedUpdate('reconciliationRules', async () => {
            isDirty.current = true;
            try {
                await api.deleteRule(id);
                if (syncChannel) {
                    syncChannel.postMessage({ type: 'REFRESH_REQUIRED', origin: APP_INSTANCE_ID });
                }
            } catch (e) {
                console.error("[APP] Rule delete failed:", e);
                loadCoreData(false);
            } finally {
                isDirty.current = false;
            }
        });
    };

    const bulkUpdateData = async (key: string, newItems: any[], setter: Function) => {
        setter((prev: any[]) => {
            const next = [...prev];
            newItems.filter(Boolean).forEach((item) => {
                if (!item || typeof item !== 'object' || !item.id) return;
                const idx = next.findIndex(x => x && x.id === item.id);
                if (idx > -1) next[idx] = item;
                else next.push(item);
            });
            
            executeQueuedUpdate(key, async () => {
                isDirty.current = true;
                try {
                    await api.save(key, next);
                    if (syncChannel) {
                        syncChannel.postMessage({ type: 'REFRESH_REQUIRED', key, origin: APP_INSTANCE_ID });
                    }
                } catch (e) {
                    console.error(`[APP] Bulk background save failed for '${key}':`, e);
                    loadCoreData(false);
                } finally {
                    isDirty.current = false;
                }
            });

            return next;
        });
    };

    const handleTransactionsAdded = async (newTxs: Transaction[], newCategories: Category[] = []) => {
        isDirty.current = true;
        try {
            if (newCategories.length > 0) {
                const updatedCats = [...categories, ...newCategories];
                setCategories(updatedCats);
                await api.save('categories', updatedCats);
            }
            setTransactions(prev => [...newTxs.filter(Boolean), ...prev].slice(0, 5000)); 
            await api.saveTransactions(newTxs.filter(Boolean));
            if (syncChannel) syncChannel.postMessage({ type: 'REFRESH_REQUIRED', origin: APP_INSTANCE_ID });
        } catch (e) {
            console.error("[APP] Ingestion failure:", e);
            alert("Ledger synchronization failed.");
        } finally {
            isDirty.current = false;
        }
    };

    const handleUpdateTransaction = async (tx: Transaction) => {
        setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
        isDirty.current = true;
        try {
            await api.saveTransactions([tx]);
            if (syncChannel) {
                syncChannel.postMessage({ type: 'REFRESH_REQUIRED', origin: APP_INSTANCE_ID });
            }
        } catch (e) {
            console.error("[APP] Tx update failed:", e);
            loadCoreData(false);
        } finally {
            isDirty.current = false;
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        isDirty.current = true;
        try {
            await api.deleteTransaction(id);
            if (syncChannel) {
                syncChannel.postMessage({ type: 'REFRESH_REQUIRED', origin: APP_INSTANCE_ID });
            }
        } catch (e) {
            console.error("[APP] Tx delete failed:", e);
            loadCoreData(false);
        } finally {
            isDirty.current = false;
        }
    };

    if (loadError) return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border-2 border-red-100 text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                <div><h1 className="text-2xl font-black text-slate-800">Connection Error</h1><h1 className="text-slate-500 mt-2 font-medium">{loadError}</h1></div>
                <button onClick={() => window.location.reload()} className="w-full py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg">Retry Connection</button>
            </div>
        </div>
    );

    if (isLoading) return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">FinParser Handshake...</p>
            </div>
        </div>
    );

    const currentContext = { transactions, accounts, categories, tags, counterparties, locations, users, amazonMetrics, youtubeMetrics, financialGoals, businessProfile, joinedMetrics, productJoinerProjects };

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
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border-2 border-white shadow-sm">{APP_INSTANCE_ID.substring(0,1).toUpperCase()}</div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar bg-slate-50/50">
                    <Suspense fallback={<ViewLoader />}>
                        {currentView === 'dashboard' && <Dashboard transactions={transactions} savedReports={savedReports} tasks={tasks} goals={financialGoals} systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)} categories={categories} counterparties={counterparties} amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} financialPlan={financialPlan} accounts={accounts} tags={tags} transactionTypes={transactionTypes} users={users} joinedMetrics={joinedMetrics} />}
                        {currentView === 'import' && <ImportPage transactions={transactions} accounts={accounts} accountTypes={accountTypes} categories={categories} tags={tags} transactionTypes={transactionTypes} rules={rules} counterparties={counterparties} locations={locations} users={users} documentFolders={documentFolders} onTransactionsAdded={handleTransactionsAdded} onAddAccount={(a) => bulkUpdateData('accounts', [a], setAccounts)} onAddAccountType={(t) => bulkUpdateData('accountTypes', [t], setAccountTypes)} onSaveRule={handleSaveRule} onDeleteRule={handleDeleteRule} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)} onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations)} onSaveUser={(u) => bulkUpdateData('users', [u], setUsers)} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments)} onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders)} ruleCategories={ruleCategories} onSaveRuleCategory={(rc) => bulkUpdateData('ruleCategories', [rc], setRuleCategories)} onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties)} onSaveLocations={(ls) => bulkUpdateData('locations', ls, setLocations)} onSaveCategories={(cs) => bulkUpdateData('categories', cs, setCategories)} onNavigate={setCurrentView} />}
                        {currentView === 'transactions' && <AllTransactions allGlobalTransactions={transactions} accounts={accounts} categories={categories} tags={tags} transactionTypes={transactionTypes} counterparties={counterparties} users={users} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} onDeleteTransactions={async (ids) => { await api.deleteTransactions(ids); await loadCoreData(false); }} onAddTransaction={(tx) => handleTransactionsAdded([tx])} onSaveRule={handleSaveRule} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)} onSaveReport={(r) => bulkUpdateData('savedReports', [r], setSavedReports)} rules={rules} ruleCategories={ruleCategories} onSaveRuleCategory={(rc) => bulkUpdateData('ruleCategories', [rc], setRuleCategories)} locations={locations} onDeleteRule={handleDeleteRule} />}
                        {currentView === 'calendar' && <CalendarPage transactions={transactions} tasks={tasks} templates={templates} scheduledEvents={scheduledEvents} taskCompletions={taskCompletions} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} users={users} onAddEvent={(e) => bulkUpdateData('scheduledEvents', [e], setScheduledEvents)} onUpdateTransaction={handleUpdateTransaction} onAddTransaction={(tx) => handleTransactionsAdded([tx])} onToggleTaskCompletion={async (d, eid, tid) => { const next = {...taskCompletions, [`${d}_${eid}_${tid}`]: !taskCompletions[`${d}_${eid}_${tid}`]}; updateData('taskCompletions', next, setTaskCompletions); }} onToggleTask={(id) => { const next = {...taskCompletions, [id]: !taskCompletions[id]}; updateData('taskCompletions', next, setTaskCompletions); }} onSaveTask={(t) => bulkUpdateData('tasks', [t], setTasks)} transactionTypes={transactionTypes} />}
                        {currentView === 'rules' && <RulesPage rules={rules} onSaveRule={handleSaveRule} onSaveRules={handleSaveRules} onDeleteRule={handleDeleteRule} accounts={accounts} transactionTypes={transactionTypes} categories={categories} tags={tags} counterparties={counterparties} locations={locations} users={users} transactions={transactions} onUpdateTransactions={(txs) => handleTransactionsAdded(txs)} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)} onSaveCategories={(cs) => bulkUpdateData('categories', cs, setCategories)} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)} onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties)} onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations)} onSaveLocations={(ls) => bulkUpdateData('locations', ls, setLocations)} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)} onSaveUser={(user: User) => bulkUpdateData('users', [user], setUsers)} ruleCategories={ruleCategories} onSaveRuleCategory={(rc) => bulkUpdateData('ruleCategories', [rc], setRuleCategories)} onDeleteRuleCategory={(id) => { setRuleCategories(prev => { const next = prev.filter(rc => rc.id !== id); updateData('ruleCategories', next, setRuleCategories); return next; }); }} systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)} />}
                        {currentView === 'management' && <ManagementHub transactions={transactions} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} locations={locations} users={users} transactionTypes={transactionTypes} accountTypes={accountTypes} onSaveAccount={(a) => bulkUpdateData('accounts', [a], setAccounts)} onDeleteAccount={(id) => { setAccounts(prev => { const next = prev.filter(x => x.id !== id); updateData('accounts', next, setAccounts); return next; }); }} onSaveCategory={(c) => bulkUpdateData('categories', [c], setCategories)} onDeleteCategory={(id) => { setCategories(prev => { const next = prev.filter(c => c.id !== id); updateData('categories', next, setCategories); return next; }); }} onSaveTag={(t) => bulkUpdateData('tags', [t], setTags)} onDeleteTag={(id) => { setTags(prev => { const next = prev.filter(t => t.id !== id); updateData('tags', next, setTags); return next; }); }} onSaveCounterparty={(p) => bulkUpdateData('counterparties', [p], setCounterparties)} onDeleteCounterparty={(id) => { setCounterparties(prev => { const next = prev.filter(p => p.id !== id); updateData('counterparties', next, setCounterparties); return next; }); }} onSaveCounterparties={(ps) => bulkUpdateData('counterparties', ps, setCounterparties)} onSaveLocation={(l) => bulkUpdateData('locations', [l], setLocations)} onDeleteLocation={(id) => { setLocations(prev => { const next = prev.filter(l => l.id !== id); updateData('locations', next, setLocations); return next; }); }} onSaveUser={(u) => bulkUpdateData('users', [u], setUsers)} onDeleteUser={(id) => { setUsers(prev => { const next = prev.filter(u => u.id !== id); updateData('users', next, setUsers); return next; }); }} onSaveTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)} onDeleteTransactionType={(id) => { setTransactionTypes(prev => { const next = prev.filter(t => t.id !== id); updateData('transactionTypes', next, setTransactionTypes); return next; }); }} onSaveAccountType={(t) => bulkUpdateData('accountTypes', [t], setAccountTypes)} onDeleteAccountType={(id) => { setAccountTypes(prev => { const next = prev.filter(at => at.id !== id); updateData('accountTypes', next, setAccountTypes); return next; }); }} onSaveCategories={(cs) => bulkUpdateData('categories', cs, setCategories)} onSaveLocations={(ls) => bulkUpdateData('locations', ls, setLocations)} onSaveRules={handleSaveRules} rules={rules} onDeleteRule={handleDeleteRule} />}
                        {currentView === 'reports' && <Reports transactions={transactions} transactionTypes={transactionTypes} categories={categories} counterparties={counterparties} users={users} tags={tags} accounts={accounts} savedReports={savedReports} setSavedReports={(val) => { setterProxy(val, savedReports, 'savedReports', setSavedReports); }} savedDateRanges={savedDateRanges} setSavedDateRanges={(val) => { setterProxy(val, savedDateRanges, 'savedDateRanges', setSavedDateRanges); }} amazonMetrics={amazonMetrics} youtubeMetrics={youtubeMetrics} onSaveReport={(r) => bulkUpdateData('savedReports', [r], setSavedReports)} />}
                        {currentView === 'settings' && <SettingsPage transactions={transactions} transactionTypes={transactionTypes} onAddTransactionType={(t) => bulkUpdateData('transactionTypes', [t], setTransactionTypes)} onRemoveTransactionType={(id) => { setTransactionTypes(prev => { const next = prev.filter(x => x.id !== id); updateData('transactionTypes', next, setTransactionTypes); return next; }); }} systemSettings={systemSettings} onUpdateSystemSettings={(s) => updateData('systemSettings', s, setSystemSettings)} accounts={accounts} categories={categories} tags={tags} counterparties={counterparties} rules={rules} templates={templates} scheduledEvents={scheduledEvents} tasks={tasks} taskCompletions={taskCompletions} users={users} businessProfile={businessProfile} businessNotes={businessNotes} documentFolders={documentFolders} businessDocuments={businessDocuments} onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments)} onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders)} savedReports={savedReports} savedDateRanges={savedDateRanges} amazonMetrics={amazonMetrics} amazonVideos={amazonVideos} youtubeMetrics={youtubeMetrics} youtubeChannels={youtubeChannels} financialGoals={financialGoals} financialPlan={financialPlan} locations={locations} accountTypes={accountTypes} />}
                        {currentView === 'tasks' && <TasksPage tasks={tasks} onSaveTask={(t) => bulkUpdateData('tasks', [t], setTasks)} onDeleteTask={(id) => { setTasks(prev => { const next = prev.filter(t => t.id !== id); updateData('tasks', next, setTasks); return next; }); }} onToggleTask={(id) => { setTasks(prev => { const next = prev.map(t => t.id === id ? {...t, isCompleted: !t.isCompleted} : t); updateData('tasks', next, setTasks); return next; }); }} templates={templates} scheduledEvents={scheduledEvents} onSaveTemplate={(t) => bulkUpdateData('templates', [t], setTemplates)} onRemoveTemplate={(id) => { setTemplates(prev => { const next = prev.filter(t => t.id !== id); updateData('templates', next, setTemplates); return next; }); }} categories={categories} />}
                        {currentView === 'hub' && <BusinessHub profile={businessProfile} onUpdateProfile={(p) => updateData('businessProfile', p, setBusinessProfile)} notes={businessNotes} onUpdateNotes={(n) => updateData('businessNotes', n, setBusinessNotes)} chatSessions={chatSessions} onUpdateChatSessions={(s) => updateData('chatSessions', s, setChatSessions)} transactions={transactions} accounts={accounts} categories={categories} />}
                        {currentView === 'journal' && <JournalPage notes={businessNotes} onUpdateNotes={(n) => updateData('businessNotes', n, setBusinessNotes)} profile={businessProfile} />}
                        {currentView === 'documents' && <DocumentsPage documents={businessDocuments} folders={documentFolders} onAddDocument={(d) => bulkUpdateData('businessDocuments', [d], setBusinessDocuments)} onRemoveDocument={(id) => { setBusinessDocuments(prev => { const next = prev.filter(d => d.id !== id); updateData('businessDocuments', next, setBusinessDocuments); return next; }); }} onCreateFolder={(f) => bulkUpdateData('documentFolders', [f], setDocumentFolders)} onDeleteFolder={(id) => { setDocumentFolders(prev => { const next = prev.filter(f => f.id !== id); updateData('documentFolders', next, setDocumentFolders); return next; }); }} />}
                        {currentView === 'plan' && <FinancialPlanPage transactions={transactions} goals={financialGoals} onSaveGoals={(g) => updateData('financialGoals', g, setFinancialGoals)} plan={financialPlan} onSavePlan={(p) => updateData('financialPlan', p, setFinancialPlan)} categories={categories} businessProfile={businessProfile} />}
                        {currentView === 'integrations' && <IntegrationsPage onNavigate={setCurrentView} />}
                        {currentView === 'integration-amazon' && <AmazonIntegration metrics={amazonMetrics} onAddMetrics={(m) => bulkUpdateData('amazonMetrics', m, setAmazonMetrics)} onDeleteMetrics={(ids) => { setAmazonMetrics(prev => { const next = prev.filter(m => !ids.includes(m.id)); updateData('amazonMetrics', next, setAmazonMetrics); return next; }); }} videos={amazonVideos} onAddVideos={(v) => bulkUpdateData('amazonVideos', v, setAmazonVideos)} onDeleteVideos={(ids) => { setAmazonVideos(prev => { const next = prev.filter(v => !ids.includes(v.id)); updateData('amazonVideos', next, setAmazonVideos); return next; }); }} />}
                        {currentView === 'integration-youtube' && <YouTubeIntegration metrics={youtubeMetrics} onAddMetrics={(m) => bulkUpdateData('youtubeMetrics', m, setYouTubeMetric)} onDeleteMetrics={(ids) => { setYouTubeMetric(prev => { const next = prev.filter(m => !ids.includes(m.id)); updateData('youtubeMetrics', next, setYouTubeMetric); return next; }); }} channels={youtubeChannels} onSaveChannel={(c) => bulkUpdateData('youtubeChannels', [c], setYouTubeChannels)} onDeleteChannel={(id) => { setYouTubeChannels(prev => { const next = prev.filter(c => c.id !== id); updateData('youtubeChannels', next, setYouTubeChannels); return next; }); }} />}
                        {currentView === 'integration-joiner' && <VideoProductJoiner metrics={joinedMetrics} onSaveMetrics={(m) => updateData('joinedMetrics', m, setJoinedMetrics)} youtubeMetrics={youtubeMetrics} amazonMetrics={amazonMetrics} />}
                        {currentView === 'integration-product-joiner' && <ProductAsinJoiner projects={productJoinerProjects} onUpdateProjects={(p) => updateData('productJoinerProjects', p, setProductJoinerProjects)} />}
                    </Suspense>
                </div>
            </main>
            <Chatbot contextData={currentContext} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        </div>
    );

    // Helper proxy to support existing setter patterns while ensuring sync
    function setterProxy(val: any, current: any, key: string, setter: Function) {
        const newVal = typeof val === 'function' ? val(current) : val;
        updateData(key, newVal, setter);
    }
};

export default App;
