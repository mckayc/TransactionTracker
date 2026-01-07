import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Counterparty, ReconciliationRule, Template, ScheduledEvent, TaskCompletions, TaskItem, User, BusinessProfile, DocumentFolder, BusinessDocument, Tag, SavedReport, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, BusinessNote, Location, AccountType, AiConfig } from '../types';
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, ExclamationTriangleIcon, DeleteIcon, ShieldCheckIcon, CloseIcon, SettingsIcon, TableIcon, TagIcon, CreditCardIcon, TasksIcon, LightBulbIcon, BarChartIcon, DownloadIcon, RobotIcon, WrenchIcon, SparklesIcon, ChecklistIcon, HeartIcon, BoxIcon, YoutubeIcon, InfoIcon, SortIcon, BugIcon, RepeatIcon, PlayIcon, MapPinIcon, UsersIcon, StethoscopeIcon, TrashIcon, CopyIcon, DatabaseIcon, ChevronDownIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { hasApiKey, validateApiKeyConnectivity, updateGeminiConfig, getActiveModels } from '../services/geminiService';

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
    counterparties: Counterparty[];
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
    locations: Location[];
    accountTypes: AccountType[];
}

const MODEL_OPTIONS = [
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Performant)', tier: 'Standard', desc: 'Cutting-edge speed and high reliability for ledger sorting.' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Analytical)', tier: 'Advanced', desc: 'Superior reasoning for complex financial roadmap synthesis.' },
    { id: 'gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro (Deep Reasoning)', tier: 'Advanced', desc: 'Powerful logic from the 2.5 series, great for multi-step strategy.' },
    { id: 'gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash (Balanced)', tier: 'Standard', desc: 'Fast, efficient, and capable 2.5 series model.' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite (Efficient)', tier: 'Standard', desc: 'Optimized for low-latency basic text extraction.' }
];

const ENTITY_LABELS: Record<string, { label: string, icon: React.ReactNode, warning?: string }> = {
    transactions: { label: 'Transactions', icon: <TableIcon className="w-4 h-4" /> },
    accounts: { label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" /> },
    categories: { label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
    tags: { label: 'Tags', icon: <TagIcon className="w-4 h-4" /> },
    counterparties: { label: 'Counterparties', icon: <BoxIcon className="w-4 h-4" /> },
    transactionTypes: { label: 'Transaction Types', icon: <ChecklistIcon className="w-4 h-4" /> },
    accountTypes: { label: 'Account Types', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    users: { label: 'Users', icon: <UsersIcon className="w-4 h-4" /> },
    locations: { label: 'Locations', icon: <MapPinIcon className="w-4 h-4" /> },
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
    <details className={`bg-white p-6 rounded-3xl shadow-sm border ${
        variant === 'danger' ? 'border-red-100 open:ring-red-500' : 
        variant === 'info' ? 'border-indigo-100 open:ring-indigo-500' :
        'border-slate-200 open:ring-indigo-500'
    }`} open>
        <summary className={`text-xl font-black cursor-pointer transition-colors ${
            variant === 'danger' ? 'text-red-700' : 
            variant === 'info' ? 'text-indigo-700' :
            'text-slate-800'
        }`}>{title}</summary>
        <div className="mt-6">
            {children}
        </div>
    </details>
);

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    transactions, transactionTypes, onAddTransactionType, onRemoveTransactionType, systemSettings, onUpdateSystemSettings,
    accounts, categories, tags, counterparties, rules, templates, scheduledEvents, tasks, taskCompletions, users, businessProfile, businessNotes, documentFolders, businessDocuments, onAddDocument, onCreateFolder,
    savedReports, savedDateRanges, amazonMetrics, amazonVideos, youtubeMetrics, youtubeChannels, financialGoals, financialPlan, contentLinks, locations, accountTypes
}) => {
    const importFileRef = useRef<HTMLInputElement>(null);
    const [apiKeyActive, setApiKeyActive] = useState(hasApiKey());
    const [isTestingKey, setIsTestingKey] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isRepairing, setIsRepairing] = useState(false);
    
    // Diagnostics state
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

    const runDiagnostics = async () => {
        setIsDiagnosing(true);
        try {
            const data = await api.getDiagnostics();
            setDiagnostics(data);
        } catch (e) {
            console.error("Diagnosis failed", e);
        } finally {
            setIsDiagnosing(false);
        }
    };

    useEffect(() => {
        runDiagnostics();
    }, []);

    const copyToClipboard = (text: string) => {
        return new Promise<void>((resolve, reject) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(resolve).catch(reject);
            } else {
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    textArea.style.top = "0";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (successful) resolve();
                    else reject(new Error("ExecCommand failed"));
                } catch (err) {
                    reject(err);
                }
            }
        });
    };

    const copySupportManifesto = async () => {
        if (!diagnostics) {
            await runDiagnostics();
            if (!diagnostics) {
                setCopyState('error');
                setTimeout(() => setCopyState('idle'), 2000);
                return;
            }
        }

        const report = `FINPARSER SYSTEM MANIFESTO\n` +
            `Timestamp: ${diagnostics.timestamp}\n` +
            `Database Size: ${(diagnostics.databaseSize / 1024).toFixed(2)} KB\n\n` +
            (diagnostics.tables || []).map((t: any) => 
                `TABLE: ${t.table} (${t.rowCount} rows)\nSCHEMA: ${t.schema}\n`
            ).join('\n');
        
        try {
            await copyToClipboard(report);
            setCopyState('success');
            setTimeout(() => setCopyState('idle'), 3000);
        } catch (err) {
            setCopyState('error');
            setTimeout(() => setCopyState('idle'), 2000);
            alert("Clipboard access denied.");
        }
    };
    
    useEffect(() => {
        const interval = setInterval(() => {
            const current = hasApiKey();
            if (current !== apiKeyActive) setApiKeyActive(current);
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

    const handleRepairSystem = async () => {
        if (!confirm("Execute system repair? This will verify database schema, migrate legacy tables, and standardize casing.")) return;
        setIsRepairing(true);
        try {
            const success = await api.repairSystem();
            if (success) {
                alert("Repair Protocol Complete. Schema standardized and legacy entities consolidated. Refreshing...");
                window.location.reload();
            } else {
                throw new Error("Repair sequence failed.");
            }
        } catch (err: any) {
            alert(`Repair failed: ${err.message}`);
        } finally {
            setIsRepairing(false);
        }
    };

    const [aiConfig, setAiConfig] = useState<AiConfig>(systemSettings.aiConfig || getActiveModels());

    const handleUpdateAiConfig = (key: keyof AiConfig, value: any) => {
        const next = { ...aiConfig, [key]: value };
        setAiConfig(next);
        updateGeminiConfig(next);
        onUpdateSystemSettings({ ...systemSettings, aiConfig: next });
    };

    const [exportSelection, setExportSelection] = useState<Set<string>>(new Set(Object.keys(ENTITY_LABELS)));
    const [purgeSelection, setPurgeSelection] = useState<Set<string>>(new Set());

    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [restoreData, setRestoreData] = useState<any>(null);
    const [restoreSelection, setRestoreSelection] = useState<Set<string>>(new Set());
    
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

    const handleExportData = () => {
        if (exportSelection.size === 0) { alert("Please select items to back up."); return; }
        const data: any = { exportDate: new Date().toISOString(), version: '0.6.0' };
        const map: Record<string, any> = { transactions, accounts, categories, tags, counterparties, transactionTypes, accountTypes, users, locations, reconciliationRules: rules, businessProfile, businessNotes, financialGoals, contentLinks, systemSettings, businessDocuments, documentFolders, templates, scheduledEvents, tasks, taskCompletions, savedReports, savedDateRanges, amazonMetrics, amazonVideos, youtubeMetrics, youtubeChannels };

        exportSelection.forEach(key => {
            if (map[key]) data[key] = map[key];
            else if (key === 'files_meta') {
                data.businessDocuments = businessDocuments;
                data.documentFolders = documentFolders;
            }
        });

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finparser-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileRestoreSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setRestoreData(json);
                const keys = Object.keys(ENTITY_LABELS).filter(k => k in json || (k === 'files_meta' && 'businessDocuments' in json));
                setRestoreSelection(new Set(keys));
                setIsRestoreModalOpen(true);
            } catch (err) { alert("Invalid backup file."); }
        };
        reader.readAsText(file);
    };

    const handleFinalRestore = async () => {
        if (!restoreData) return;
        if (!confirm("Proceed with data restoration? This will overwrite existing records for the selected entities.")) return;
        for (const key of Array.from(restoreSelection)) {
            const data = restoreData[key];
            if (data) await api.save(key, data);
            else if (key === 'files_meta') {
                if (restoreData.businessDocuments) await api.save('businessDocuments', restoreData.businessDocuments);
                if (restoreData.documentFolders) await api.save('documentFolders', restoreData.documentFolders);
            }
        }
        alert("Restoration complete. Refreshing...");
        window.location.reload();
    };

    const handlePurgeAction = async () => {
        if (purgeSelection.size === 0) return;
        if (!confirm(`Permanently delete ${purgeSelection.size} selected entities? This cannot be undone.`)) return;
        setIsPurging(true);
        try {
            const targets = Array.from(purgeSelection) as string[];
            const isFullReset = targets.length === Object.keys(ENTITY_LABELS).length;
            const success = await api.resetDatabase(isFullReset ? ['all'] : targets);
            if (success) window.location.reload();
            else throw new Error("Purge failed.");
        } catch (err) {
            alert("An error occurred during deletion.");
            setIsPurging(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
            <header>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">System Infrastructure</h1>
                <p className="text-slate-500 mt-2 text-lg">Manage the local engine, data schemas, and API connectivity.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Registry</p>
                    <p className="text-2xl font-black text-indigo-600 mt-1">{dataHealthSummary.recordCount.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Records in DB</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vault Storage</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{dataHealthSummary.documentCount}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Managed Files</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disk Usage</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{dataHealthSummary.totalSizeMB} MB</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">In Media Directory</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Rules</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{dataHealthSummary.ruleCount}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Logic Processors</p>
                </div>
            </div>

            <Section title="AI Connectivity Engine">
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-center gap-8 p-8 bg-slate-900 rounded-[2rem] text-white overflow-hidden relative">
                        <div className="relative z-10 flex-1">
                            <div className="flex items-center gap-3 mb-4">
                                <RobotIcon className={`w-8 h-8 ${apiKeyActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                                <h3 className="text-2xl font-black">Google Gemini Neural Core</h3>
                            </div>
                            <p className="text-slate-400 max-w-lg mb-6 leading-relaxed">
                                The system is currently using the <strong>{apiKeyActive ? 'Active' : 'Missing'}</strong> API key injected from your container environment.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={handleTestConnectivity} disabled={isTestingKey || !apiKeyActive} className="px-8 py-3 bg-white text-slate-900 font-black rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95">
                                    {isTestingKey ? 'Negotiating...' : 'Test Connection'}
                                </button>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="px-8 py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2">
                                    <InfoIcon className="w-4 h-4" /> Manage Keys
                                </a>
                            </div>
                            {testResult && (
                                <div className={`mt-6 p-4 rounded-2xl border flex items-center gap-3 animate-slide-up ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    {testResult.success ? <CheckCircleIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                                    <p className="text-sm font-bold">{testResult.message}</p>
                                </div>
                            )}
                        </div>
                        <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-5 pointer-events-none" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 mb-2"><TableIcon className="w-5 h-5 text-indigo-500" /><h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Primary Logic Engine</h4></div>
                            <select value={aiConfig.textModel} onChange={e => handleUpdateAiConfig('textModel', e.target.value)} className="w-full font-bold text-sm">
                                {MODEL_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.tier})</option>)}
                            </select>
                            <div className="p-3 bg-slate-50 rounded-xl"><p className="text-[10px] text-slate-400 leading-relaxed italic">{MODEL_OPTIONS.find(o => o.id === aiConfig.textModel)?.desc}</p></div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 mb-2"><SparklesIcon className="w-5 h-5 text-indigo-500" /><h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Strategic Reasoning Engine</h4></div>
                            <select value={aiConfig.complexModel} onChange={e => handleUpdateAiConfig('complexModel', e.target.value)} className="w-full font-bold text-sm">
                                {MODEL_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.tier})</option>)}
                            </select>
                            <div className="p-3 bg-slate-50 rounded-xl"><p className="text-[10px] text-slate-400 leading-relaxed italic">{MODEL_OPTIONS.find(o => o.id === aiConfig.complexModel)?.desc}</p></div>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Maintenance Hub" variant="info">
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-start gap-6 p-6 bg-indigo-50 border-2 border-indigo-100 rounded-[2.5rem] shadow-inner">
                        <div className="p-5 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-200"><StethoscopeIcon className="w-10 h-10" /></div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-indigo-900">System Doctor & Diagnostics</h3>
                            <p className="text-sm text-indigo-700 mt-1 leading-relaxed">Probe the SQLite engine. If features fail, use Force Repair to normalize column names and consolidate legacy tables.</p>
                            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                                {diagnostics?.tables?.map((t: any) => (
                                    <div key={t.table} className={`p-3 rounded-xl border flex flex-col gap-1 ${t.rowCount > 0 ? 'bg-white border-indigo-200' : 'bg-red-50 border-red-200 animate-pulse'}`}>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{t.table}</p>
                                        <p className={`text-lg font-black ${t.rowCount > 0 ? 'text-indigo-600' : 'text-red-600'}`}>{t.rowCount}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Records</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                            <button onClick={handleRepairSystem} disabled={isRepairing} className="w-full px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                {isRepairing ? <RepeatIcon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4" />} Force Repair
                            </button>
                            <button onClick={copySupportManifesto} disabled={isDiagnosing} className={`w-full px-8 py-3 font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm border ${copyState === 'success' ? 'bg-emerald-500 border-emerald-600 text-white' : copyState === 'error' ? 'bg-red-500 border-red-600 text-white' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}>
                                {copyState === 'success' ? <CheckCircleIcon className="w-4 h-4" /> : copyState === 'error' ? <ExclamationTriangleIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />} {copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Failed' : 'Copy Manifesto'}
                            </button>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Data Management & Backup">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><DownloadIcon className="w-6 h-6 text-indigo-600" /><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Institutional Export</h3></div>
                        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {Object.entries(ENTITY_LABELS).map(([key, cfg]) => (
                                <label key={key} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors group">
                                    <input type="checkbox" checked={exportSelection.has(key)} onChange={() => { const n = new Set(exportSelection); if(n.has(key)) n.delete(key); else n.add(key); setExportSelection(n); }} className="rounded text-indigo-600" />
                                    <span className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                                </label>
                            ))}
                        </div>
                        <button onClick={handleExportData} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"><DownloadIcon className="w-5 h-5" /> Generate Archive</button>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><UploadIcon className="w-6 h-6 text-indigo-600" /><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">System Restoration</h3></div>
                        <div onClick={() => importFileRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group">
                            <CloudArrowUpIcon className="w-12 h-12 text-slate-300 group-hover:text-indigo-500 transition-colors mb-4" />
                            <p className="text-sm font-bold text-slate-700">Select Backup File</p>
                            <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={handleFileRestoreSelect} />
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="The Danger Zone" variant="danger">
                <div className="space-y-8">
                    <div className="bg-red-50 p-8 rounded-[2.5rem] border-2 border-red-100 flex flex-col md:flex-row items-center gap-8">
                        <div className="p-4 bg-red-600 rounded-full text-white shadow-xl shadow-red-200"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-xl font-black text-red-800 uppercase tracking-tight">System Rebuild</h3>
                            <p className="text-sm text-red-600 mt-1 max-w-xl font-medium">Permanently wipe specific clusters. Note: Selective purge preserves files on disk but wipes the database index.</p>
                        </div>
                        <div className="flex flex-col gap-2 w-full md:w-64">
                            <div className="bg-white p-3 rounded-2xl border border-red-100 max-h-40 overflow-y-auto space-y-1 shadow-inner custom-scrollbar">
                                {Object.entries(ENTITY_LABELS).map(([key, cfg]) => (
                                    <label key={key} className="flex items-center gap-2 p-1.5 hover:bg-red-50 rounded-lg cursor-pointer group">
                                        <input type="checkbox" checked={purgeSelection.has(key)} onChange={() => { const n = new Set(purgeSelection); if(n.has(key)) n.delete(key); else n.add(key); setPurgeSelection(n); }} className="rounded text-red-600 focus:ring-red-500" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter group-hover:text-red-700">{cfg.label}</span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={handlePurgeAction} disabled={isPurging || purgeSelection.size === 0} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-30">
                                <TrashIcon className="w-5 h-5" /> Execute Purge
                            </button>
                        </div>
                    </div>
                </div>
            </Section>

            {isRestoreModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
                            <div><h3 className="text-xl font-black">Restoration Forge</h3><p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Importing Blueprint</p></div>
                            <button onClick={() => setIsRestoreModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-white"/></button>
                        </div>
                        <div className="p-8 space-y-6 bg-slate-50">
                            <p className="text-sm font-medium text-slate-600">Select the data clusters you wish to overwrite in the current system:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1 custom-scrollbar">
                                {Object.entries(ENTITY_LABELS).map(([key, cfg]) => {
                                    const available = key in (restoreData || {}) || (key === 'files_meta' && restoreData?.businessDocuments);
                                    if (!available) return null;
                                    return (
                                        <label key={key} className="flex items-center justify-between p-4 bg-white border-2 border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-500 transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-50 transition-colors">{cfg.icon}</div>
                                                <span className="text-xs font-black text-slate-700 uppercase">{cfg.label}</span>
                                            </div>
                                            <input type="checkbox" checked={restoreSelection.has(key)} onChange={() => { const n = new Set(restoreSelection); if(n.has(key)) n.delete(key); else n.add(key); setRestoreSelection(n); }} className="rounded text-indigo-600 h-5 w-5" />
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsRestoreModalOpen(false)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-colors">Abort</button>
                                <button onClick={handleFinalRestore} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all">Execute Restoration</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
