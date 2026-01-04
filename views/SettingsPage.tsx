
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Payee, ReconciliationRule, Template, ScheduledEvent, TaskCompletions, TaskItem, User, BusinessProfile, DocumentFolder, BusinessDocument, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, AmazonVideo } from '../types';
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, FolderIcon, ExclamationTriangleIcon, DeleteIcon, ShieldCheckIcon, CloseIcon, SettingsIcon, TableIcon, TagIcon, CreditCardIcon, ChatBubbleIcon, TasksIcon, LightBulbIcon, BarChartIcon, DownloadIcon, RobotIcon, ExternalLinkIcon, WrenchIcon, SparklesIcon, ChecklistIcon, HeartIcon, SearchCircleIcon, BoxIcon, YoutubeIcon, InfoIcon, SortIcon, CheckBadgeIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { saveFile } from '../services/storageService';
import { hasApiKey } from '../services/geminiService';

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

const ENTITY_LABELS: Record<string, { label: string, icon: React.ReactNode, warning?: string, sampleField?: string }> = {
    transactions: { label: 'Transactions', icon: <TableIcon className="w-4 h-4" />, sampleField: 'description' },
    accounts: { label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" />, sampleField: 'name' },
    categories: { label: 'Categories', icon: <TagIcon className="w-4 h-4" />, sampleField: 'name' },
    tags: { label: 'Tags', icon: <TagIcon className="w-4 h-4" />, sampleField: 'name' },
    payees: { label: 'Income Sources', icon: <DocumentIcon className="w-4 h-4" />, sampleField: 'name' },
    reconciliationRules: { label: 'Automation Rules', icon: <SettingsIcon className="w-4 h-4" />, sampleField: 'name' },
    templates: { label: 'Checklist Templates', icon: <TasksIcon className="w-4 h-4" />, sampleField: 'name' },
    tasks: { label: 'Task Instances', icon: <ChecklistIcon className="w-4 h-4" />, sampleField: 'title' },
    businessProfile: { label: 'Business Profile', icon: <DocumentIcon className="w-4 h-4" /> },
    savedReports: { label: 'Saved Reports', icon: <BarChartIcon className="w-4 h-4" />, sampleField: 'name' },
    amazonMetrics: { label: 'Amazon Affiliate Data', icon: <BoxIcon className="w-4 h-4" />, sampleField: 'productTitle' },
    youtubeMetrics: { label: 'YouTube Analytics', icon: <YoutubeIcon className="w-4 h-4" />, sampleField: 'videoTitle' },
    financialGoals: { label: 'Financial Plan', icon: <LightBulbIcon className="w-4 h-4" />, sampleField: 'title' },
    contentLinks: { label: 'Platform Links (CC)', icon: <ShieldCheckIcon className="w-4 h-4" />, sampleField: 'title' },
    files_meta: { 
        label: 'Document Metadata', 
        icon: <DocumentIcon className="w-4 h-4" />,
        warning: 'This purges database records, not the actual files. Manually clear /media/files volume if needed.',
        sampleField: 'original_name'
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
    accounts, categories, tags, payees, rules, templates, scheduledEvents, tasks, taskCompletions, users, businessProfile, documentFolders, businessDocuments, onAddDocument, onCreateFolder,
    savedReports, savedDateRanges, amazonMetrics, amazonVideos, youtubeMetrics, youtubeChannels, financialGoals, financialPlan, contentLinks
}) => {
    const importFileRef = useRef<HTMLInputElement>(null);
    const apiKeyActive = hasApiKey();

    const [exportSelection, setExportSelection] = useState<Set<string>>(new Set(Object.keys(ENTITY_LABELS)));
    const [purgeSelection, setPurgeSelection] = useState<Set<string>>(new Set());

    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [restoreData, setRestoreData] = useState<any>(null);
    const [restoreSelection, setRestoreSelection] = useState<Set<string>>(new Set());

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
        if (exportSelection.has('financialGoals')) data.financialGoals = financialGoals;
        if (exportSelection.has('contentLinks')) data.contentLinks = contentLinks;
        if (exportSelection.has('systemSettings')) data.systemSettings = systemSettings;
        if (exportSelection.has('files_meta')) {
            data.businessDocuments = businessDocuments;
            data.documentFolders = documentFolders;
        }
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
                const detectedKeys = Object.keys(ENTITY_LABELS).filter(key => json.hasOwnProperty(key) || (key === 'files_meta' && json.hasOwnProperty('businessDocuments')));
                if (detectedKeys.length === 0) throw new Error("No valid data detected.");
                setRestoreData(json);
                setRestoreSelection(new Set(detectedKeys));
                setIsRestoreModalOpen(true);
            } catch (err) { alert("Invalid backup file."); }
        };
        reader.readAsText(file);
    };

    const handleConfirmRestore = async () => {
        if (!restoreData || restoreSelection.size === 0) return;
        if (!confirm("This will merge/overwrite existing data. Proceed?")) return;
        try {
            const savePromises: Promise<any>[] = [];
            for (const key of Array.from(restoreSelection) as string[]) {
                if (key === 'templates') {
                    savePromises.push(api.save('templates', restoreData.templates));
                    savePromises.push(api.save('scheduledEvents', restoreData.scheduledEvents || []));
                } else if (key === 'tasks') {
                    savePromises.push(api.save('tasks', restoreData.tasks));
                    savePromises.push(api.save('taskCompletions', restoreData.taskCompletions || {}));
                } else if (key === 'files_meta') {
                    savePromises.push(api.save('businessDocuments', restoreData.businessDocuments));
                    savePromises.push(api.save('documentFolders', restoreData.documentFolders || []));
                } else { savePromises.push(api.save(key, restoreData[key])); }
            }
            if (restoreData.transactionTypes) savePromises.push(api.save('transactionTypes', restoreData.transactionTypes));
            if (restoreData.users) savePromises.push(api.save('users', restoreData.users));
            await Promise.all(savePromises);
            window.location.reload();
        } catch (err) { alert("Restore failed."); }
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
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                            <ShieldCheckIcon className="w-8 h-8 text-indigo-300" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">System Integrity</h3>
                            <p className="text-sm text-indigo-200">Local SQLite instance status: OK</p>
                        </div>
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
                                <div className={`p-3 rounded-full shadow-sm ${apiKeyActive ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    <RobotIcon className="w-8 h-8" />
                                </div>
                                <div className="flex-grow">
                                    <h3 className={`text-lg font-bold ${apiKeyActive ? 'text-emerald-800' : 'text-amber-800'}`}>AI Status: {apiKeyActive ? 'Enabled' : 'Disabled'}</h3>
                                    <p className={`text-sm mt-1 ${apiKeyActive ? 'text-emerald-700' : 'text-amber-700'}`}>{apiKeyActive ? "Your Gemini 3 connection is healthy. All intelligence features are available." : "Configure API_KEY to enable automated categorization and pattern detection."}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-indigo-600" />Intelligence Features:</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {['Pattern Auditing', 'Tax Strategy', 'PDF Extraction', 'Cross-Platform ROI'].map((feature, i) => (
                                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">{feature}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="Data Backups">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4 flex flex-col h-full">
                            <div className="flex-grow">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5 text-green-600" />Backup Frequency</h3>
                                <p className="text-sm text-slate-600 mt-1">Control automated state snapshots.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequency</label><select value={backupFreq} onChange={(e) => setBackupFreq(e.target.value as any)} className="w-full p-2 border rounded-md text-sm bg-white"><option value="never">Manual Only</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Retention</label><input type="number" min="1" max="50" value={retentionCount} onChange={(e) => setRetentionCount(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-md text-sm" /></div>
                            </div>
                            <button onClick={handleSaveBackupSettings} className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors">Apply Config</button>
                        </div>

                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-indigo-100 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div><h3 className="font-bold text-indigo-900 flex items-center gap-2 text-lg"><CloudArrowUpIcon className="w-6 h-6 text-indigo-600" />JSON Snapshot</h3><p className="text-sm text-indigo-700">Download a portable version of your datasets.</p></div>
                                <button onClick={handleExportData} className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-md">
                                    <DownloadIcon className="w-4 h-4" /> Export Backup
                                </button>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {Object.entries(ENTITY_LABELS).map(([key, { label }]) => (
                                        <button key={key} onClick={() => toggleExportSelection(key)} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-bold transition-all ${exportSelection.has(key) ? 'bg-white border-indigo-400 text-indigo-700 ring-1 ring-indigo-400' : 'bg-slate-100 border-slate-200 text-slate-500 grayscale opacity-60'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-indigo-50 flex items-center justify-between">
                                <p className="text-sm text-slate-600">Import snapshot file:</p>
                                <div className="relative">
                                    <input type="file" accept=".json" ref={importFileRef} onChange={handleImportFileChange} className="hidden" />
                                    <button onClick={() => importFileRef.current?.click()} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 shadow-md">
                                        <UploadIcon className="w-4 h-4" /> Restore File
                                    </button>
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
                                    <p className="text-sm text-red-700 mt-2">Choose specific datasets to purge while preserving the rest of your configuration.</p>
                                </div>
                                <button 
                                    onClick={() => setPurgeStep('confirm')} 
                                    disabled={purgeSelection.size === 0}
                                    className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Purge Selection
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
                                {Object.entries(ENTITY_LABELS).map(([key, { label, icon, warning }]) => (
                                    <button 
                                        key={key} 
                                        onClick={() => togglePurgeSelection(key)} 
                                        className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all group relative ${purgeSelection.has(key) ? 'bg-red-100 border-red-500 shadow-inner' : 'bg-white border-slate-200 hover:border-red-300'}`}
                                    >
                                        <div className={`p-2 rounded-lg mb-2 ${purgeSelection.has(key) ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-red-50 group-hover:text-red-600'}`}>{icon}</div>
                                        <span className={`text-[10px] font-black uppercase tracking-tighter text-center ${purgeSelection.has(key) ? 'text-red-700' : 'text-slate-600'}`}>{label}</span>
                                        {warning && (
                                            <div className="absolute inset-0 opacity-0 hover:opacity-100 z-10 bg-slate-900/90 flex items-center justify-center p-2 rounded-xl transition-opacity pointer-events-none">
                                                <p className="text-[8px] text-white font-bold text-center leading-tight uppercase">{warning}</p>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {purgeStep === 'confirm' && (
                            <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-2xl animate-slide-up space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-red-600 rounded-full animate-bounce"><ExclamationTriangleIcon className="w-8 h-8" /></div>
                                    <div>
                                        <h4 className="text-xl font-black">Confirm Deletion</h4>
                                        <p className="text-slate-400">You are about to permanently delete <strong>{purgeSelection.size}</strong> datasets. This cannot be undone.</p>
                                    </div>
                                </div>
                                
                                <div className="bg-white/10 p-4 rounded-xl space-y-2">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Wipe List:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from(purgeSelection).map(k => (
                                            <span key={k as string} className="px-2 py-1 bg-white/10 rounded text-xs font-bold">{ENTITY_LABELS[k as string]?.label}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-sm">Type <span className="font-mono font-bold text-red-500">FACTORY PURGE</span> to confirm your intent.</p>
                                    <div className="flex gap-4">
                                        <input 
                                            type="text" 
                                            value={purgeText} 
                                            onChange={e => setPurgeText(e.target.value.toUpperCase())}
                                            className="flex-1 bg-white/5 border-2 border-white/20 rounded-xl p-3 text-center font-black tracking-widest text-xl focus:border-red-600 outline-none" 
                                            placeholder="TYPE HERE"
                                        />
                                        <button 
                                            disabled={purgeText !== 'FACTORY PURGE' || isPurging}
                                            onClick={handlePurgeAction}
                                            className="px-10 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-all disabled:opacity-20"
                                        >
                                            {isPurging ? 'PURGING...' : 'EXECUTE'}
                                        </button>
                                        <button onClick={() => setPurgeStep('idle')} className="px-6 text-slate-400 hover:text-white font-bold">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Section>
            </div>

            {isRestoreModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Selective Restore Engine</h3>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Select items found in backup file</p>
                            </div>
                            <button onClick={() => setIsRestoreModalOpen(false)}><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-hidden flex">
                            {/* LEFT: Selection List */}
                            <div className="w-1/2 border-r border-slate-200 overflow-y-auto p-6 bg-slate-50/50">
                                <div className="space-y-1">
                                    {Object.entries(ENTITY_LABELS).map(([key, { label, icon }]) => {
                                        const fileHasData = restoreData.hasOwnProperty(key) || (key === 'files_meta' && restoreData.hasOwnProperty('businessDocuments'));
                                        if (!fileHasData) return null;

                                        const records = key === 'files_meta' ? restoreData.businessDocuments : restoreData[key];
                                        const count = Array.isArray(records) ? records.length : (records ? 1 : 0);

                                        return (
                                            <label key={key} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${restoreSelection.has(key) ? 'bg-indigo-100 border-indigo-500 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={restoreSelection.has(key)} 
                                                        onChange={() => { 
                                                            const s = new Set(restoreSelection); 
                                                            if(s.has(key)) s.delete(key); else s.add(key); 
                                                            setRestoreSelection(s); 
                                                        }} 
                                                        className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ${restoreSelection.has(key) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{icon}</div>
                                                        <span className={`font-bold text-sm ${restoreSelection.has(key) ? 'text-indigo-900' : 'text-slate-700'}`}>{label}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${restoreSelection.has(key) ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                    {count} Recs
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* RIGHT: Data Preview */}
                            <div className="w-1/2 overflow-y-auto p-6 bg-white">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Live Data Preview (Samples)</h4>
                                <div className="space-y-6">
                                    {restoreSelection.size === 0 ? (
                                        <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 opacity-50">
                                            <SearchCircleIcon className="w-12 h-12" />
                                            <p className="text-sm font-medium italic">Select a category on the left<br/>to preview its contents here.</p>
                                        </div>
                                    ) : (
                                        Array.from(restoreSelection).map(key => {
                                            const label = ENTITY_LABELS[key as string]?.label;
                                            const sampleField = ENTITY_LABELS[key as string]?.sampleField;
                                            const records = key === 'files_meta' ? restoreData.businessDocuments : restoreData[key as string];
                                            const samples = Array.isArray(records) ? records.slice(0, 3) : (records ? [records] : []);

                                            return (
                                                <div key={key as string} className="space-y-2 animate-fade-in">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                                        <h5 className="font-black text-slate-800 text-xs uppercase tracking-tight">{label}</h5>
                                                    </div>
                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                                                        {samples.map((s: any, idx: number) => (
                                                            <div key={idx} className="text-[11px] flex items-center justify-between border-b border-slate-200 last:border-0 pb-1.5 last:pb-0 font-medium text-slate-600">
                                                                <span className="truncate pr-4">{sampleField ? (s[sampleField] || 'Untitled') : 'Config Object'}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 font-mono">#{idx+1}</span>
                                                            </div>
                                                        ))}
                                                        {Array.isArray(records) && records.length > 3 && (
                                                            <p className="text-[9px] text-indigo-400 italic font-bold">...plus {records.length - 3} more records</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-slate-50 flex justify-between items-center px-8">
                            <div className="flex items-center gap-2">
                                <InfoIcon className="w-4 h-4 text-indigo-500" />
                                <p className="text-xs text-slate-500 font-medium italic">Data will be merged into your current environment.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsRestoreModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                                <button 
                                    onClick={handleConfirmRestore} 
                                    disabled={restoreSelection.size === 0} 
                                    className="px-8 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-30"
                                >
                                    <CheckBadgeIcon className="w-5 h-5" />
                                    Restore {restoreSelection.size} Categories
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
