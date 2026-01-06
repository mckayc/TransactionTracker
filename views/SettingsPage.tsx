
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Payee, ReconciliationRule, Template, ScheduledEvent, TaskCompletions, TaskItem, User, BusinessProfile, DocumentFolder, BusinessDocument, Tag, SavedReport, CustomDateRange, AmazonMetric, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, AmazonVideo, BusinessNote } from '../types';
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, FolderIcon, ExclamationTriangleIcon, DeleteIcon, ShieldCheckIcon, CloseIcon, SettingsIcon, TableIcon, TagIcon, CreditCardIcon, ChatBubbleIcon, TasksIcon, LightBulbIcon, BarChartIcon, DownloadIcon, RobotIcon, ExternalLinkIcon, WrenchIcon, SparklesIcon, ChecklistIcon, HeartIcon, SearchCircleIcon, BoxIcon, YoutubeIcon, InfoIcon, SortIcon, CheckBadgeIcon, BugIcon, NotesIcon, FileCodeIcon, RepeatIcon, PlayIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { hasApiKey, healDataSnippet, validateApiKeyConnectivity } from '../services/geminiService';

interface SettingsPageProps {
    transactions: Transaction[];
    transactionTypes: TransactionType[];
    onAddTransactionType: (type: TransactionType) => void;
    onRemoveTransactionType: (typeId: string) => void;
    systemSettings: SystemSettings;
    onUpdateSystemSettings: (settings: SystemSettings) => void;
    accounts: Account[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    rules: ReconciliationRule[];
    templates: Template[];
    scheduledEvents: ScheduledEvent[];
    tasks: TaskItem[];
    taskCompletions: TaskCompletions;
    users: User[];
    businessProfile: BusinessProfile;
    businessNotes: BusinessNote[];
    documentFolders: DocumentFolder[];
    businessDocuments: BusinessDocument[];
    onAddDocument: (doc: BusinessDocument) => void;
    onCreateFolder: (folder: DocumentFolder) => void;
    savedReports: SavedReport[];
    savedDateRanges: CustomDateRange[];
    amazonMetrics: AmazonMetric[];
    amazonVideos: AmazonVideo[];
    youtubeMetrics: YouTubeMetric[];
    youtubeChannels: YouTubeChannel[];
    financialGoals: FinancialGoal[];
    financialPlan: FinancialPlan | null;
    contentLinks: ContentLink[];
}

const ENTITY_LABELS: Record<string, { label: string, icon: React.ReactNode, warning?: string }> = {
    transactions: { label: 'Transactions', icon: <TableIcon className="w-4 h-4" /> },
    accounts: { label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" /> },
    categories: { label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
    tags: { label: 'Tags', icon: <TagIcon className="w-4 h-4" /> },
    payees: { label: 'Payees', icon: <DocumentIcon className="w-4 h-4" /> },
    reconciliationRules: { label: 'Automation Rules', icon: <SettingsIcon className="w-4 h-4" /> },
    templates: { label: 'Checklist Templates', icon: <TasksIcon className="w-4 h-4" /> },
    tasks: { label: 'Task Instances', icon: <ChecklistIcon className="w-4 h-4" /> },
    businessProfile: { label: 'Business Profile', icon: <DocumentIcon className="w-4 h-4" /> },
    businessNotes: { label: 'Journal & Bugs', icon: <BugIcon className="w-4 h-4" /> },
    savedReports: { label: 'Saved Reports', icon: <BarChartIcon className="w-4 h-4" /> },
    amazonMetrics: { label: 'Amazon Affiliate Data', icon: <BoxIcon className="w-4 h-4" /> },
    youtubeMetrics: { label: 'YouTube Analytics', icon: <YoutubeIcon className="w-4 h-4" /> },
    financialGoals: { label: 'Financial Plan', icon: <LightBulbIcon className="w-4 h-4" /> },
    contentLinks: { label: 'Platform Links (CC)', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    files_meta: { 
        label: 'Document Metadata', 
        icon: <DocumentIcon className="w-4 h-4" />,
        warning: 'This purges database records, not the actual files.'
    },
    systemSettings: { label: 'App Configuration', icon: <WrenchIcon className="w-4 h-4" /> },
};

const Section: React.FC<{title: string, variant?: 'default' | 'danger' | 'info', children: React.ReactNode}> = ({title, variant = 'default', children}) => (
    <details className={`bg-white p-6 rounded-xl shadow-sm border ${
        variant === 'danger' ? 'border-red-200 open:ring-red-500' : 
        variant === 'info' ? 'border-indigo-200 open:ring-indigo-500' :
        'border-slate-200 open:ring-indigo-500'
    }`} open>
        <summary className={`text-xl font-bold cursor-pointer ${
            variant === 'danger' ? 'text-red-700' : 
            variant === 'info' ? 'text-indigo-700' :
            'text-slate-700'
        }`}>{title}</summary>
        <div className="mt-4">
            {children}
        </div>
    </details>
);

const formatNumber = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    transactions, transactionTypes, onAddTransactionType, onRemoveTransactionType, systemSettings, onUpdateSystemSettings,
    accounts, categories, tags, payees, rules, templates, scheduledEvents, tasks, taskCompletions, users, businessProfile, businessNotes, documentFolders, businessDocuments, onAddDocument, onCreateFolder,
    savedReports, savedDateRanges, amazonMetrics, amazonVideos, youtubeMetrics, youtubeChannels, financialGoals, financialPlan, contentLinks
}) => {
    const importFileRef = useRef<HTMLInputElement>(null);
    
    // Periodically check for API Key availability as it might be shimmed late
    const [apiKeyActive, setApiKeyActive] = useState(hasApiKey());
    const [isTestingKey, setIsTestingKey] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    
    useEffect(() => {
        // Diagnostic Logging
        console.log("[SYS] Settings Page loaded. Diagnostic Check...");
        
        const runtimeConfig = (window as any).__FINPARSER_CONFIG__;
        console.log("[SYS] window.__FINPARSER_CONFIG__ found:", !!runtimeConfig);
        if (runtimeConfig) {
            console.log("[SYS] Runtime API_KEY present:", !!runtimeConfig.API_KEY);
            if (runtimeConfig.API_KEY) {
                 console.log("[SYS] Runtime API_KEY Length:", runtimeConfig.API_KEY.length);
                 console.log("[SYS] Runtime API_KEY Prefix:", runtimeConfig.API_KEY.substring(0, 4));
            }
        }

        const processObj = (window as any).process;
        console.log("[SYS] window.process object found:", !!processObj);
        if (processObj?.env) {
            console.log("[SYS] process.env.API_KEY present:", !!processObj.env.API_KEY);
        }
        
        const interval = setInterval(() => {
            const current = hasApiKey();
            if (current !== apiKeyActive) {
                console.log("[SYS] hasApiKey() status changed to:", current);
                setApiKeyActive(current);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [apiKeyActive]);

    const handleTestConnectivity = async () => {
        setIsTestingKey(true);
        setTestResult(null);
        try {
            const result = await validateApiKeyConnectivity();
            setTestResult(result);
        } catch (e: any) {
            setTestResult({ success: false, message: `Unexpected error: ${e.message}` });
        } finally {
            setIsTestingKey(false);
        }
    };

    const [exportSelection, setExportSelection] = useState<Set<string>>(new Set(Object.keys(ENTITY_LABELS)));
    const [purgeSelection, setPurgeSelection] = useState<Set<string>>(new Set());

    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [restoreData, setRestoreData] = useState<any>(null);
    const [restoreSelection, setRestoreSelection] = useState<Set<string>>(new Set());
    
    // Paste Restore State
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [isHealing, setIsHealing] = useState(false);

    const [purgeStep, setPurgeStep] = useState<'idle' | 'confirm' | 'final'>('idle');
    const [purgeText, setPurgeText] = useState('');
    const [isPurging, setIsPurging] = useState(false);
    
    const [backupFreq, setBackupFreq] = useState<'daily' | 'weekly' | 'monthly' | 'never'>('never');
    const [retentionCount, setRetentionCount] = useState(5);

    useEffect(() => {
        if (systemSettings.backupConfig) {
            setBackupFreq(systemSettings.backupConfig.frequency);
            setRetentionCount(systemSettings.backupConfig.retentionCount);
        }
    }, [systemSettings]);

    const dataHealthSummary = useMemo(() => {
        const totalSize = businessDocuments.reduce((acc, doc) => acc + (doc.size || 0), 0);
        return {
            recordCount: transactions.length + accounts.length + amazonMetrics.length + youtubeMetrics.length,
            documentCount: businessDocuments.length,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
            ruleCount: rules.length
        };
    }, [transactions, accounts, amazonMetrics, youtubeMetrics, businessDocuments, rules]);

    const handleSaveBackupSettings = () => {
        const newConfig = {
            frequency: backupFreq,
            retentionCount: retentionCount > 0 ? retentionCount : 1,
            lastBackupDate: systemSettings.backupConfig?.lastBackupDate
        };
        onUpdateSystemSettings({ ...systemSettings, backupConfig: newConfig });
        alert("Backup settings saved!");
    };

    const togglePurgeSelection = (key: string) => {
        const newSet = new Set(purgeSelection);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setPurgeSelection(newSet);
    };

    const handlePurgeAction = async () => {
        if (purgeSelection.size === 0) return;
        
        setIsPurging(true);
        try {
            const targets = Array.from(purgeSelection) as string[];
            const isFullReset = targets.length === Object.keys(ENTITY_LABELS).length;
            const success = await api.resetDatabase(isFullReset ? ['all'] : targets);
            if (success) {
                window.location.reload();
            } else {
                throw new Error("Purge failed.");
            }
        } catch (err) {
            alert("An error occurred during deletion.");
            setIsPurging(false);
        }
    };

    const toggleExportSelection = (key: string) => {
        const newSet = new Set(exportSelection);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExportSelection(newSet);
    };

    const handleExportData = () => {
        if (exportSelection.size === 0) { alert("Please select items to back up."); return; }
        const data: any = {
            exportDate: new Date().toISOString(),
            version: '0.0.53',
            transactionTypes,
            users
        };
        if (exportSelection.has('transactions')) data.transactions = transactions;
        if (exportSelection.has('accounts')) data.accounts = accounts;
        if (exportSelection.has('categories')) data.categories = categories;
        if (exportSelection.has('tags')) data.tags = tags;
        if (exportSelection.has('payees')) data.payees = payees;
        if (exportSelection.has('reconciliationRules')) data.reconciliationRules = rules;
        if (exportSelection.has('businessProfile')) data.businessProfile = businessProfile;
        if (exportSelection.has('businessNotes')) data.businessNotes = businessNotes;
        if (exportSelection.has('financialGoals')) data.financialGoals = financialGoals;
        if (exportSelection.has('contentLinks')) data.contentLinks = contentLinks;
        if (exportSelection.has('systemSettings')) data.systemSettings = systemSettings;
        if (exportSelection.has('files_meta')) { data.businessDocuments = businessDocuments; data.documentFolders = documentFolders; }
        if (exportSelection.has('templates')) { data.templates = templates; data.scheduledEvents = scheduledEvents; }
        if (exportSelection.has('tasks')) { data.tasks = tasks; data.taskCompletions = taskCompletions; }
        if (exportSelection.has('savedReports')) { data.savedReports = savedReports; data.savedDateRanges = savedDateRanges; }
        if (exportSelection.has('amazonMetrics')) { data.amazonMetrics = amazonMetrics; data.amazonVideos = amazonVideos; }
        if (exportSelection.has('youtubeMetrics')) { data.youtubeMetrics = youtubeMetrics; data.youtubeChannels = youtubeChannels; }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finparser-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                handleLoadedRestoreData(json);
            } catch (err) { alert("Invalid backup file."); }
        };
        reader.readAsText(file);
    };

    const handlePasteRestore = async () => {
        let json;
        try {
            json = JSON.parse(pasteText);
        } catch (err) {
            console.warn("Direct JSON parse failed. Attempting AI Healing...");
            setIsHealing(true);
            try {
                json = await healDataSnippet(pasteText);
            } catch (aiErr) {
                alert("AI could not repair the data snippet. Please ensure it is a valid list or object.");
                setIsHealing(false);
                return;
            } finally {
                setIsHealing(false);
            }
        }
        
        if (json) {
            if (Array.isArray(json)) {
                const first = json[0];
                if (first.asin) json = { amazonMetrics: json };
                else if (first.videoId) json = { youtubeMetrics: json };
                else if (first.date && first.description && first.amount) json = { transactions: json };
                else if (first.name && (first.parentId !== undefined || first.notes !== undefined)) json = { payees: json };
                else if (first.name && first.isDefault !== undefined) json = { users: json };
            }

            handleLoadedRestoreData(json);
            setIsPasteModalOpen(false);
            setPasteText('');
        }
    };

    const handleLoadedRestoreData = (json: any) => {
        const detectedKeys = Object.keys(ENTITY_LABELS).filter(key => json.hasOwnProperty(key) || (key === 'files_meta' && json.hasOwnProperty('businessDocuments')));
        if (detectedKeys.length === 0) {
            alert("No valid data patterns detected in the JSON provided.");
            return;
        }
        setRestoreData(json);
        setRestoreSelection(new Set(detectedKeys));
        setIsRestoreModalOpen(true);
    };

    const handleConfirmRestore = async (overwrite: boolean = false) => {
        if (!restoreData || restoreSelection.size === 0) return;
        
        const modeLabel = overwrite ? "OVERWRITE AND REPLACE" : "MERGE WITH EXISTING";
        if (!confirm(`CAUTION: This will ${modeLabel} your data for the selected categories. This cannot be undone. Proceed?`)) return;
        
        try {
            if (overwrite) {
                await api.resetDatabase(Array.from(restoreSelection));
            }

            for (const key of Array.from(restoreSelection) as string[]) {
                if (key === 'templates') {
                    await api.save('templates', restoreData.templates);
                    await api.save('scheduledEvents', restoreData.scheduledEvents || []);
                } else if (key === 'tasks') {
                    await api.save('tasks', restoreData.tasks);
                    await api.save('taskCompletions', restoreData.taskCompletions || {});
                } else if (key === 'files_meta') {
                    await api.save('businessDocuments', restoreData.businessDocuments);
                    await api.save('documentFolders', restoreData.documentFolders || []);
                } else { 
                    await api.save(key, restoreData[key]); 
                }
            }
            
            if (restoreData.transactionTypes) await api.save('transactionTypes', restoreData.transactionTypes);
            if (restoreData.users) await api.save('users', restoreData.users);

            window.location.reload();
        } catch (err) { 
            console.error("Restore Failure:", err);
            alert(`Restore failed: ${err instanceof Error ? err.message : 'Unknown internal error'}.`); 
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
                <p className="text-slate-500 mt-1">Global app control and data maintenance.</p>
            </div>
            <div className="space-y-6">
                <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center animate-pulse"><ShieldCheckIcon className="w-8 h-8 text-indigo-300" /></div>
                        <div><h3 className="text-lg font-bold">System Integrity</h3><p className="text-sm text-indigo-200">Local SQLite instance status: OK</p></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Records</p><p className="text-2xl font-black">{formatNumber(dataHealthSummary.recordCount)}</p></div>
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Documents</p><p className="text-2xl font-black">{dataHealthSummary.documentCount}</p></div>
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Vault</p><p className="text-2xl font-black">{dataHealthSummary.totalSizeMB} MB</p></div>
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Rules</p><p className="text-2xl font-black">{dataHealthSummary.ruleCount}</p></div>
                    </div>
                </div>

                <Section title="AI Intelligence" variant="info">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className={`p-6 rounded-xl border transition-all ${apiKeyActive ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full shadow-sm ${apiKeyActive ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}><RobotIcon className="w-8 h-8" /></div>
                                <div className="flex-grow">
                                    <h3 className={`text-lg font-bold ${apiKeyActive ? 'text-emerald-800' : 'text-amber-800'}`}>AI Status: {apiKeyActive ? 'Enabled' : 'Disabled'}</h3>
                                    <p className={`text-sm mt-1 ${apiKeyActive ? 'text-emerald-700' : 'text-amber-700'}`}>{apiKeyActive ? "Healthy Gemini 3 connection detected." : "Missing or invalid API_KEY in environment. Check Docker logs."}</p>
                                    
                                    <div className="mt-4 pt-4 border-t border-indigo-100 flex flex-col gap-3">
                                        <button 
                                            onClick={handleTestConnectivity} 
                                            disabled={isTestingKey || !apiKeyActive}
                                            className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isTestingKey ? <RepeatIcon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4" />}
                                            Test API Connectivity
                                        </button>
                                        
                                        {testResult && (
                                            <div className={`p-3 rounded-lg text-xs font-bold border ${testResult.success ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                                <div className="flex gap-2 items-start">
                                                    {testResult.success ? <CheckCircleIcon className="w-4 h-4 shrink-0" /> : <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />}
                                                    <span>{testResult.message}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-indigo-600" />Intelligence Features:</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{['Pattern Auditing', 'Tax Strategy', 'PDF Extraction', 'Cross-Platform ROI'].map((f, i) => (<div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">{f}</div>))}</div>
                        </div>
                    </div>
                </Section>

                <Section title="Data Backups">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4 flex flex-col h-full">
                            <div className="flex-grow"><h3 className="font-bold text-slate-900 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5 text-green-600" />Backup Frequency</h3><p className="text-sm text-slate-600 mt-1">Control state snapshots.</p></div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Freq</label><select value={backupFreq} onChange={(e) => setBackupFreq(e.target.value as any)} className="w-full p-2 border rounded-md text-sm"><option value="never">Manual</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limit</label><input type="number" min="1" max="50" value={retentionCount} onChange={(e) => setRetentionCount(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-md text-sm" /></div>
                            </div>
                            <button onClick={handleSaveBackupSettings} className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md border border-indigo-200">Apply Config</button>
                        </div>

                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-indigo-100 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div><h3 className="font-bold text-indigo-900 flex items-center gap-2 text-lg"><CloudArrowUpIcon className="w-6 h-6 text-indigo-600" />Snapshot Tools</h3><p className="text-sm text-indigo-700">Portable backups.</p></div>
                                <button onClick={handleExportData} className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"><DownloadIcon className="w-4 h-4" /> Export All Selected</button>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex justify-between items-center mb-3 px-1">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Included Data Sets</h4>
                                    <div className="flex gap-4">
                                        <button onClick={() => setExportSelection(new Set(Object.keys(ENTITY_LABELS)))} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-tighter">Select All</button>
                                        <button onClick={() => setExportSelection(new Set())} className="text-[10px] font-black text-slate-400 hover:text-red-500 hover:underline uppercase tracking-tighter">Clear All</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {Object.entries(ENTITY_LABELS).map(([key, { label }]) => (
                                        <button key={key} onClick={() => toggleExportSelection(key)} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-bold transition-all ${exportSelection.has(key) ? 'bg-white border-indigo-400 text-indigo-700 shadow-sm ring-1 ring-indigo-400' : 'bg-slate-100 border-slate-200 text-slate-500 grayscale opacity-60'}`}>{label}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-indigo-50 flex flex-wrap items-center justify-between gap-4">
                                <p className="text-sm text-slate-600 font-medium">Restore or migrate data:</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsPasteModalOpen(true)} className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"><FileCodeIcon className="w-4 h-4 text-indigo-600" /> Paste JSON</button>
                                    <input type="file" accept=".json" min-h-0 className="hidden" ref={importFileRef} onChange={handleImportFileChange} />
                                    <button onClick={() => importFileRef.current?.click()} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-black transition-colors shadow-sm"><UploadIcon className="w-4 h-4" /> Upload File</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="System Integrity" variant="danger">
                    <div className="space-y-6">
                        <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <h3 className="text-lg font-bold text-red-800 flex items-center gap-2"><ExclamationTriangleIcon className="w-6 h-6" />Selective Data Wipe</h3>
                                    <p className="text-sm text-red-700 mt-2">Purge datasets preserving configuration.</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setPurgeStep('confirm')} disabled={purgeSelection.size === 0} className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-30">Purge Selection</button>
                                    <div className="flex justify-center gap-3">
                                        <button onClick={() => setPurgeSelection(new Set(Object.keys(ENTITY_LABELS)))} className="text-[9px] font-black text-red-600 hover:underline uppercase">Select All</button>
                                        <button onClick={() => setPurgeSelection(new Set())} className="text-[9px] font-black text-slate-400 hover:underline uppercase">Clear</button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
                                {Object.entries(ENTITY_LABELS).map(([key, { label, icon, warning }]) => (
                                    <button key={key} onClick={() => togglePurgeSelection(key)} className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all relative ${purgeSelection.has(key) ? 'bg-red-100 border-red-500' : 'bg-white border-slate-200 hover:border-red-200'}`}>
                                        <div className={`p-2 rounded-lg mb-2 ${purgeSelection.has(key) ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{icon}</div>
                                        <span className={`text-[10px] font-black uppercase tracking-tighter text-center ${purgeSelection.has(key) ? 'text-red-700' : 'text-slate-600'}`}>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        {purgeStep === 'confirm' && (
                            <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-2xl space-y-6 animate-fade-in">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-red-600 rounded-full animate-bounce"><ExclamationTriangleIcon className="w-8 h-8" /></div>
                                    <div><h4 className="text-xl font-black">Confirm Deletion</h4><p className="text-slate-400">Permanently delete <strong>{purgeSelection.size}</strong> datasets?</p></div>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-sm">Type <span className="font-mono font-bold text-red-500">FACTORY PURGE</span></p>
                                    <div className="flex gap-4">
                                        <input type="text" value={purgeText} onChange={e => setPurgeText(e.target.value.toUpperCase())} className="flex-1 bg-white/5 border-2 border-white/20 rounded-xl p-3 text-center font-black tracking-widest text-xl outline-none" />
                                        <button disabled={purgeText !== 'FACTORY PURGE' || isPurging} onClick={handlePurgeAction} className="px-10 bg-red-600 text-white font-black rounded-xl disabled:opacity-20">{isPurging ? 'PURGING...' : 'EXECUTE'}</button>
                                        <button onClick={() => setPurgeStep('idle')} className="px-6 text-slate-400 font-bold">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Section>
            </div>

            {isRestoreModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-black text-slate-800 text-xl">Confirm Restore</h3>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Found {restoreSelection.size} Data Categories</p>
                            </div>
                            <button onClick={() => setIsRestoreModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                {Object.entries(ENTITY_LABELS).map(([key, { label }]) => {
                                    if (!restoreData.hasOwnProperty(key) && !(key === 'files_meta' && restoreData.hasOwnProperty('businessDocuments'))) return null;
                                    return (
                                        <label key={key} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${restoreSelection.has(key) ? 'bg-indigo-50 border-indigo-400 shadow-sm' : 'bg-white border-slate-200 opacity-60'}`}>
                                            <input type="checkbox" checked={restoreSelection.has(key)} onChange={() => { const s = new Set(restoreSelection); if(s.has(key)) s.delete(key); else s.add(key); setRestoreSelection(s); }} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                            <span className="ml-3 font-bold text-slate-700 text-sm">{label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3 items-start">
                                <InfoIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 leading-relaxed font-medium">Choose <strong>Merge</strong> to append data (safe) or <strong>Replace</strong> to wipe current categories before importing (destructive).</p>
                            </div>
                        </div>
                        <div className="p-6 border-t bg-slate-50 flex flex-col sm:flex-row justify-end gap-3">
                            <button onClick={() => setIsRestoreModalOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                            <button onClick={() => handleConfirmRestore(false)} disabled={restoreSelection.size === 0} className="px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-sm">Merge Data</button>
                            <button onClick={() => handleConfirmRestore(true)} disabled={restoreSelection.size === 0} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">Replace & Overwrite</button>
                        </div>
                    </div>
                </div>
            )}

            {isPasteModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-black text-slate-800 text-xl">Paste Backup Data</h3>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Raw JSON Restore</p>
                            </div>
                            <button onClick={() => setIsPasteModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <div className="p-8 space-y-4">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Backup JSON Content</label>
                            <textarea 
                                value={pasteText} 
                                onChange={e => setPasteText(e.target.value)} 
                                placeholder='{ "transactions": [...], "accounts": [...] }'
                                className="w-full h-80 p-4 font-mono text-xs bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 transition-all outline-none resize-none"
                            />
                            <p className="text-xs text-slate-400 italic">Formatting tip: Paste content from a .json file export. If the text is malformed, AI will attempt to heal it.</p>
                        </div>
                        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 items-center">
                            {isHealing && (
                                <div className="flex items-center gap-2 mr-auto text-indigo-600 animate-pulse">
                                    <RepeatIcon className="w-4 h-4 animate-spin" />
                                    <span className="text-xs font-black uppercase tracking-widest">AI Attempting Repair...</span>
                                </div>
                            )}
                            <button onClick={() => setIsPasteModalOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                            <button 
                                onClick={handlePasteRestore} 
                                disabled={!pasteText.trim() || isHealing}
                                className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-30"
                            >
                                Validate & Restore
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
