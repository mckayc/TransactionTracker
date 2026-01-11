
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Counterparty, ReconciliationRule, Template, ScheduledEvent, TaskCompletions, TaskItem, User, BusinessProfile, DocumentFolder, BusinessDocument, Tag, SavedReport, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, ContentLink, Location, AccountType, AiConfig, BackupConfig } from '../types';
// Added missing RobotIcon import
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, ExclamationTriangleIcon, DeleteIcon, ShieldCheckIcon, CloseIcon, TableIcon, CreditCardIcon, TasksIcon, BarChartIcon, DownloadIcon, BoxIcon, YoutubeIcon, InfoIcon, TrashIcon, DatabaseIcon, RobotIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { hasApiKey, validateApiKeyConnectivity, updateGeminiConfig, getActiveModels } from '../services/geminiService';
import { Section, AiCorePanel, ContinuityPanel, MaintenancePanel } from '../components/SettingsSections';

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
    businessNotes: any[];
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

const ENTITY_LABELS: Record<string, { label: string, icon: React.ReactNode, warning?: string }> = {
    transactions: { label: 'Transactions', icon: <TableIcon className="w-4 h-4" /> },
    accounts: { label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" /> },
    categories: { label: 'Categories', icon: <DatabaseIcon className="w-4 h-4" /> },
    tags: { label: 'Tags', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    counterparties: { label: 'Entities', icon: <BoxIcon className="w-4 h-4" /> },
    reconciliationRules: { label: 'Automation Rules', icon: <RobotIcon className="w-4 h-4" /> },
    templates: { label: 'Checklists', icon: <TasksIcon className="w-4 h-4" /> },
    tasks: { label: 'Operations', icon: <CheckCircleIcon className="w-4 h-4" /> },
    businessProfile: { label: 'Identity Profile', icon: <DocumentIcon className="w-4 h-4" /> },
    savedReports: { label: 'Analytics Reports', icon: <BarChartIcon className="w-4 h-4" /> },
    amazonMetrics: { label: 'Amazon Yield', icon: <BoxIcon className="w-4 h-4" /> },
    youtubeMetrics: { label: 'YouTube Yield', icon: <YoutubeIcon className="w-4 h-4" /> },
    financialGoals: { label: 'Wealth Plan', icon: <InfoIcon className="w-4 h-4" /> },
    files_meta: { label: 'Vault Metadata', icon: <DocumentIcon className="w-4 h-4" />, warning: 'Does not delete local physical files.' }
};

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    transactions, systemSettings, onUpdateSystemSettings,
    accounts, categories, tags, counterparties, rules, templates, tasks, users, businessProfile, businessDocuments, documentFolders,
    savedReports, amazonMetrics, youtubeMetrics, financialGoals, locations, accountTypes
}) => {
    const importFileRef = useRef<HTMLInputElement>(null);
    const [apiKeyActive, setApiKeyActive] = useState(hasApiKey());
    const [isTestingKey, setIsTestingKey] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isRepairing, setIsRepairing] = useState(false);
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
    const [aiConfig, setAiConfig] = useState<AiConfig>(systemSettings.aiConfig || getActiveModels());
    const [backupFreq, setBackupFreq] = useState<BackupConfig['frequency']>(systemSettings.backupConfig?.frequency || 'never');
    const [retentionCount, setRetentionCount] = useState(systemSettings.backupConfig?.retentionCount || 5);
    const [exportSelection, setExportSelection] = useState<Set<string>>(new Set(Object.keys(ENTITY_LABELS)));
    const [purgeSelection, setPurgeSelection] = useState<Set<string>>(new Set());
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [restoreData, setRestoreData] = useState<any>(null);
    const [restoreSelection, setRestoreSelection] = useState<Set<string>>(new Set());
    const [isPurging, setIsPurging] = useState(false);

    const runDiagnostics = async () => {
        try { const data = await api.getDiagnostics(); setDiagnostics(data); } catch (e) { console.error(e); }
    };

    useEffect(() => { runDiagnostics(); }, []);

    const handleTestConnectivity = async () => {
        setIsTestingKey(true); setTestResult(null);
        try { const result = await validateApiKeyConnectivity(); setTestResult(result); } catch (e: any) { setTestResult({ success: false, message: e.message }); }
        finally { setIsTestingKey(false); }
    };

    const handleRepairSystem = async () => {
        if (!confirm("Execute system repair?")) return;
        setIsRepairing(true);
        try { if (await api.repairSystem()) window.location.reload(); } catch (err) { alert("Repair failed."); }
        finally { setIsRepairing(false); }
    };

    const handleUpdateAiConfig = (key: keyof AiConfig, value: any) => {
        const next = { ...aiConfig, [key]: value };
        setAiConfig(next); updateGeminiConfig(next);
        onUpdateSystemSettings({ ...systemSettings, aiConfig: next });
    };

    const handleUpdateBackupSettings = (freq: BackupConfig['frequency'], count: number) => {
        setBackupFreq(freq); setRetentionCount(count);
        onUpdateSystemSettings({ ...systemSettings, backupConfig: { frequency: freq, retentionCount: count, lastBackupDate: systemSettings.backupConfig?.lastBackupDate } });
    };

    const handleExportData = () => {
        const data: any = { exportDate: new Date().toISOString(), version: '0.6.0' };
        const map: Record<string, any> = { transactions, accounts, categories, tags, counterparties, reconciliationRules: rules, businessProfile, financialGoals, systemSettings, businessDocuments, documentFolders, templates, tasks, savedReports, amazonMetrics, youtubeMetrics };
        exportSelection.forEach(key => { if (map[key]) data[key] = map[key]; else if (key === 'files_meta') { data.businessDocuments = businessDocuments; data.documentFolders = documentFolders; } });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `finparser-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
            <header>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">Infrastructure Control</h1>
                <p className="text-slate-500 mt-2 text-lg">Local engine configuration and logical preservation settings.</p>
            </header>

            <AiCorePanel 
                apiKeyActive={apiKeyActive} onTest={handleTestConnectivity} 
                isTesting={isTestingKey} testResult={testResult} 
                aiConfig={aiConfig} onUpdate={handleUpdateAiConfig} 
            />

            <ContinuityPanel 
                backupFreq={backupFreq} retentionCount={retentionCount} 
                onUpdate={handleUpdateBackupSettings} 
            />

            <MaintenancePanel 
                diagnostics={diagnostics} onRepair={handleRepairSystem} 
                isRepairing={isRepairing} onCopyManifesto={() => {}} 
                copyState={copyState} 
            />

            <Section title="Institutional Data Portability">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><DownloadIcon className="w-6 h-6 text-indigo-600" /><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Outbound Export</h3></div>
                        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {Object.entries(ENTITY_LABELS).map(([key, cfg]) => (
                                <label key={key} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors group">
                                    <input type="checkbox" checked={exportSelection.has(key)} onChange={() => { const n = new Set(exportSelection); if(n.has(key)) n.delete(key); else n.add(key); setExportSelection(n); }} className="rounded text-indigo-600" />
                                    <span className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                                </label>
                            ))}
                        </div>
                        <button onClick={handleExportData} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"><DownloadIcon className="w-5 h-5" /> Pack Archive</button>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><UploadIcon className="w-6 h-6 text-indigo-600" /><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Inbound Restore</h3></div>
                        <div onClick={() => importFileRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group">
                            <CloudArrowUpIcon className="w-12 h-12 text-slate-300 group-hover:text-indigo-500 transition-colors mb-4" />
                            <p className="text-sm font-bold text-slate-700">Identify Backup File</p>
                            <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={() => {}} />
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="The Danger Zone" variant="danger">
                <div className="bg-red-50 p-8 rounded-[2.5rem] border-2 border-red-100 flex flex-col md:flex-row items-center gap-8">
                    <div className="p-4 bg-red-600 rounded-full text-white shadow-xl shadow-red-200"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                    <div className="flex-1">
                        <h3 className="text-xl font-black text-red-800 uppercase tracking-tight">Partial or Total Purge</h3>
                        <p className="text-sm text-red-600 mt-1 max-w-xl font-medium">Permanently wipe selected logical clusters from the SQLite engine. Physical files in the vault will remain on disk.</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full md:w-64">
                        <button onClick={() => {}} disabled={isPurging} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                            <TrashIcon className="w-5 h-5" /> Execute Purge
                        </button>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default SettingsPage;
