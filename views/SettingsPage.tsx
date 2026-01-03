
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Payee, ReconciliationRule, Template, ScheduledEvent, TaskCompletions, TaskItem, User, BusinessProfile, DocumentFolder, BusinessDocument, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, AmazonVideo } from '../types';
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, FolderIcon, ExclamationTriangleIcon, DeleteIcon, ShieldCheckIcon, CloseIcon, SettingsIcon, TableIcon, TagIcon, CreditCardIcon, ChatBubbleIcon, TasksIcon, LightBulbIcon, BarChartIcon, DownloadIcon, RobotIcon, ExternalLinkIcon, WrenchIcon, SparklesIcon, ChecklistIcon, HeartIcon, SearchCircleIcon, BoxIcon, YoutubeIcon, InfoIcon } from '../components/Icons';
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

const ENTITY_LABELS: Record<string, { label: string, icon: React.ReactNode, warning?: string }> = {
    transactions: { label: 'Transactions', icon: <TableIcon className="w-4 h-4" /> },
    accounts: { label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" /> },
    categories: { label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
    tags: { label: 'Tags', icon: <TagIcon className="w-4 h-4" /> },
    payees: { label: 'Income Sources', icon: <DocumentIcon className="w-4 h-4" /> },
    reconciliationRules: { label: 'Automation Rules', icon: <SettingsIcon className="w-4 h-4" /> },
    templates: { label: 'Checklist Templates', icon: <TasksIcon className="w-4 h-4" /> },
    tasks: { label: 'Task Instances', icon: <ChecklistIcon className="w-4 h-4" /> },
    businessProfile: { label: 'Business Profile', icon: <DocumentIcon className="w-4 h-4" /> },
    savedReports: { label: 'Saved Reports', icon: <BarChartIcon className="w-4 h-4" /> },
    amazonMetrics: { label: 'Amazon Affiliate Data', icon: <BoxIcon className="w-4 h-4" /> },
    youtubeMetrics: { label: 'YouTube Analytics', icon: <YoutubeIcon className="w-4 h-4" /> },
    financialGoals: { label: 'Financial Plan', icon: <LightBulbIcon className="w-4 h-4" /> },
    contentLinks: { label: 'Platform Links (CC)', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    businessDocuments: { 
        label: 'Document Metadata', 
        icon: <DocumentIcon className="w-4 h-4" />,
        warning: 'This backs up document records, not the actual PDF files. Manually back up the /media volume.'
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
        } else {
            setBackupFreq('never');
            setRetentionCount(5);
        }
    }, [systemSettings]);

    const dataHealthSummary = useMemo(() => {
        const totalSize = businessDocuments.reduce((acc, doc) => acc + (doc.size || 0), 0);
        return {
            recordCount: transactions.length + accounts.length + amazonMetrics.length + youtubeMetrics.length,
            documentCount: businessDocuments.length,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
            orphanCount: businessDocuments.filter(d => !d.parentId).length
        };
    }, [transactions, accounts, amazonMetrics, youtubeMetrics, businessDocuments]);

    const handleSaveBackupSettings = () => {
        const newConfig = {
            frequency: backupFreq,
            retentionCount: retentionCount > 0 ? retentionCount : 1,
            lastBackupDate: systemSettings.backupConfig?.lastBackupDate
        };
        onUpdateSystemSettings({ ...systemSettings, backupConfig: newConfig });
        alert("Backup settings saved!");
    };

    const toggleExportSelection = (key: string) => {
        const newSet = new Set(exportSelection);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExportSelection(newSet);
    };

    const getExportData = () => {
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
        if (exportSelection.has('businessDocuments')) {
            data.businessDocuments = businessDocuments;
            data.documentFolders = documentFolders;
        }
        if (exportSelection.has('templates')) { data.templates = templates; data.scheduledEvents = scheduledEvents; }
        if (exportSelection.has('tasks')) { data.tasks = tasks; data.taskCompletions = taskCompletions; }
        if (exportSelection.has('savedReports')) { data.savedReports = savedReports; data.savedDateRanges = savedDateRanges; }
        if (exportSelection.has('amazonMetrics')) { data.amazonMetrics = amazonMetrics; data.amazonVideos = amazonVideos; }
        if (exportSelection.has('youtubeMetrics')) { data.youtubeMetrics = youtubeMetrics; data.youtubeChannels = youtubeChannels; }
        return data;
    };

    const handleExportData = () => {
        if (exportSelection.size === 0) { alert("Please select at least one item to back up."); return; }
        const data = getExportData();
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
                const detectedKeys = Object.keys(ENTITY_LABELS).filter(key => json.hasOwnProperty(key));
                if (detectedKeys.length === 0) throw new Error("No valid data detected.");
                setRestoreData(json);
                setRestoreSelection(new Set(detectedKeys));
                setIsRestoreModalOpen(true);
            } catch (err) { alert("Restore failed."); }
        };
        reader.readAsText(file);
    };

    const handleConfirmRestore = async () => {
        if (!restoreData || restoreSelection.size === 0) return;
        if (!confirm("This will overwrite existing data. Proceed?")) return;
        try {
            const savePromises: Promise<any>[] = [];
            for (const key of Array.from(restoreSelection)) {
                if (key === 'templates') {
                    savePromises.push(api.save('templates', restoreData.templates));
                    savePromises.push(api.save('scheduledEvents', restoreData.scheduledEvents || []));
                } else if (key === 'tasks') {
                    savePromises.push(api.save('tasks', restoreData.tasks));
                    savePromises.push(api.save('taskCompletions', restoreData.taskCompletions || {}));
                } else if (key === 'businessDocuments') {
                    savePromises.push(api.save('businessDocuments', restoreData.businessDocuments));
                    savePromises.push(api.save('documentFolders', restoreData.documentFolders || []));
                } else { savePromises.push(api.save(key, restoreData[key])); }
            }
            if (restoreData.transactionTypes) savePromises.push(api.save('transactionTypes', restoreData.transactionTypes));
            if (restoreData.users) savePromises.push(api.save('users', restoreData.users));
            await Promise.all(savePromises);
            window.location.reload();
        } catch (err) { alert("Restore error."); }
    };

    const handlePurgeDatabase = async () => {
        setIsPurging(true);
        if (await api.resetDatabase()) window.location.reload();
        else setIsPurging(false);
    };
    
    return (
        <div className="space-y-8 pb-20">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
                <p className="text-slate-500 mt-1">Manage app configuration, AI, and data security.</p>
            </div>
            
            <div className="space-y-6">
                <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                            <ShieldCheckIcon className="w-8 h-8 text-indigo-300" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">System Status</h3>
                            <p className="text-sm text-indigo-200">All local databases operational.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Records</p><p className="text-2xl font-black">{formatNumber(dataHealthSummary.recordCount)}</p></div>
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Vault Items</p><p className="text-2xl font-black">{dataHealthSummary.documentCount}</p></div>
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Storage</p><p className="text-2xl font-black">{dataHealthSummary.totalSizeMB} MB</p></div>
                        <div className="text-center"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Rules</p><p className="text-2xl font-black">{rules.length}</p></div>
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
                                    <h3 className={`text-lg font-bold ${apiKeyActive ? 'text-emerald-800' : 'text-amber-800'}`}>AI Status: {apiKeyActive ? 'Active' : 'Offline'}</h3>
                                    <p className={`text-sm mt-1 ${apiKeyActive ? 'text-emerald-700' : 'text-amber-700'}`}>{apiKeyActive ? "Your Gemini API Key is configured via environment variable. All features are enabled." : "AI capabilities are disabled. Configure API_KEY on the server to unlock."}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-indigo-600" />Enabled Features:</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { title: 'Pattern Auditing', desc: 'Find anomalies in spending.' },
                                    { title: 'Tax Guidance', desc: 'Dynamic consultation based on profile.' },
                                    { title: 'PDF Extraction', desc: 'Convert statements to records.' },
                                    { title: 'Cross-Link ROI', desc: 'Unified platform analysis.' }
                                ].map((feature, i) => (
                                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg"><p className="text-sm font-bold text-slate-800">{feature.title}</p><p className="text-xs text-slate-500 mt-1">{feature.desc}</p></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="Backups & Portability">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4 flex flex-col h-full">
                            <div className="flex-grow">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2"><ShieldCheckIcon className="w-5 h-5 text-green-600" />Auto-Snapshots</h3>
                                <p className="text-sm text-slate-600 mt-1">Saves structured data state to the vault.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequency</label><select value={backupFreq} onChange={(e) => setBackupFreq(e.target.value as any)} className="w-full p-2 border rounded-md text-sm bg-white"><option value="never">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Retention</label><input type="number" min="1" max="50" value={retentionCount} onChange={(e) => setRetentionCount(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-md text-sm" /></div>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <p className="text-[10px] text-slate-400 italic">Last Run: {systemSettings.backupConfig?.lastBackupDate ? new Date(systemSettings.backupConfig.lastBackupDate).toLocaleString() : 'Never'}</p>
                                <button onClick={handleSaveBackupSettings} className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors">Save</button>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-indigo-100 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div><h3 className="font-bold text-indigo-900 flex items-center gap-2 text-lg"><CloudArrowUpIcon className="w-6 h-6 text-indigo-600" />JSON Backup</h3><p className="text-sm text-indigo-700">Export structured databases to a local file.</p></div>
                                <button onClick={handleExportData} className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-md">
                                    <DownloadIcon className="w-4 h-4" /> Download JSON
                                </button>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {Object.entries(ENTITY_LABELS).map(([key, { label, icon }]) => (
                                        <button key={key} onClick={() => toggleExportSelection(key)} className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${exportSelection.has(key) ? 'bg-white border-indigo-400 text-indigo-700 shadow-sm ring-1 ring-indigo-400' : 'bg-slate-100 border-slate-200 text-slate-500 grayscale opacity-60'}`}>
                                            <div className={exportSelection.has(key) ? 'text-indigo-600' : 'text-slate-400'}>{icon}</div>
                                            <span className="text-[11px] font-bold truncate">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-indigo-50 flex items-center justify-between">
                                <p className="text-sm text-slate-600">Restore from file?</p>
                                <div className="relative">
                                    <input type="file" accept=".json" ref={importFileRef} onChange={handleImportFileChange} className="hidden" />
                                    <button onClick={() => importFileRef.current?.click()} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 shadow-md transition-colors">
                                        <UploadIcon className="w-4 h-4" /> Restore JSON
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="System Integrity" variant="danger">
                    <div className="bg-red-50 p-6 rounded-xl border border-red-200 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-grow">
                            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2"><ExclamationTriangleIcon className="w-6 h-6" />Factory Purge</h3>
                            <p className="text-sm text-red-700 mt-2">Permanently delete all databases and documents. <strong>This is irreversible.</strong></p>
                        </div>
                        <div className="flex-shrink-0 w-full md:w-auto">
                            {purgeStep === 'idle' && <button onClick={() => setPurgeStep('confirm')} className="w-full px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md">Purge Everything</button>}
                            {purgeStep === 'confirm' && (
                                <div className="space-y-3 bg-white p-4 rounded-lg border border-red-300 shadow-lg animate-slide-up">
                                    <p className="text-xs text-slate-600">Are you absolutely sure?</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setPurgeStep('idle')} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded">Cancel</button>
                                        <button onClick={() => setPurgeStep('final')} className="flex-1 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded">Confirm</button>
                                    </div>
                                </div>
                            )}
                            {purgeStep === 'final' && (
                                <div className="space-y-4 bg-white p-4 rounded-lg border border-red-500 shadow-xl animate-slide-up">
                                    <p className="text-xs text-slate-600">Type <span className="font-mono font-bold text-red-600">PURGE</span> to confirm.</p>
                                    <input type="text" value={purgeText} onChange={(e) => setPurgeText(e.target.value.toUpperCase())} placeholder="Type PURGE" className="w-full p-2 border-red-300 text-center font-bold" autoFocus />
                                    <button disabled={purgeText !== 'PURGE' || isPurging} onClick={handlePurgeDatabase} className="w-full px-3 py-2 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 disabled:opacity-30">{isPurging ? 'Purging...' : 'Delete Forever'}</button>
                                </div>
                            )}
                        </div>
                    </div>
                </Section>
            </div>

            {isRestoreModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-lg">Selective Restore</h3>
                            <button onClick={() => setIsRestoreModalOpen(false)}><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="max-h-60 overflow-y-auto space-y-1">
                                {Object.entries(ENTITY_LABELS).map(([key, { label, icon }]) => {
                                    if (!restoreData.hasOwnProperty(key)) return null;
                                    return (
                                        <label key={key} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${restoreSelection.has(key) ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                            <input type="checkbox" checked={restoreSelection.has(key)} onChange={() => { const s = new Set(restoreSelection); if(s.has(key)) s.delete(key); else s.add(key); setRestoreSelection(s); }} className="w-5 h-5 text-indigo-600 rounded border-slate-300" />
                                            <div className="ml-3 flex items-center gap-2"><span className="text-indigo-600 opacity-60">{icon}</span><span className="font-bold text-slate-700 text-sm">{label}</span></div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setIsRestoreModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
                            <button onClick={handleConfirmRestore} disabled={restoreSelection.size === 0} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all disabled:opacity-30">Restore Selected</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
