
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Counterparty, ReconciliationRule, Template, ScheduledEvent, TaskCompletions, TaskItem, User, BusinessProfile, DocumentFolder, BusinessDocument, Tag, SavedReport, CustomDateRange, AmazonMetric, AmazonVideo, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan, Location, AccountType, AiConfig, BackupConfig } from '../types';
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, ExclamationTriangleIcon, DeleteIcon, ShieldCheckIcon, CloseIcon, TableIcon, CreditCardIcon, TasksIcon, BarChartIcon, DownloadIcon, BoxIcon, YoutubeIcon, InfoIcon, TrashIcon, DatabaseIcon, RobotIcon, VideoIcon, SearchCircleIcon, SparklesIcon, RepeatIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { hasApiKey, validateApiKeyConnectivity, updateGeminiConfig, getActiveModels } from '../services/geminiService';
import { Section, AiCorePanel, ContinuityPanel, MaintenancePanel } from '../components/SettingsSections';
import ConfirmationModal from '../components/ConfirmationModal';

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
    joinedMetrics: { label: 'Content ROI Data', icon: <VideoIcon className="w-4 h-4" /> },
    financialGoals: { label: 'Wealth Plan', icon: <InfoIcon className="w-4 h-4" /> },
    files_meta: { label: 'Vault Metadata', icon: <DocumentIcon className="w-4 h-4" />, warning: 'Does not delete local physical files.' }
};

interface AnomalyEntry {
    t: Transaction;
    type: string;
    color: string;
}

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
    
    // Continuity state
    const [backupEnabled, setBackupEnabled] = useState(systemSettings.backupConfig?.enabled || false);
    const [backupFreq, setBackupFreq] = useState<BackupConfig['frequency']>(systemSettings.backupConfig?.frequency || 'never');
    const [retentionCount, setRetentionCount] = useState(systemSettings.backupConfig?.retentionCount || 5);
    const backupLogs = systemSettings.backupConfig?.logs || [];

    const [exportSelection, setExportSelection] = useState<Set<string>>(new Set(Object.keys(ENTITY_LABELS)));
    const [purgeSelection, setPurgeSelection] = useState<Set<string>>(new Set());
    const [isPurging, setIsPurging] = useState(false);
    const [isConfirmPurgeOpen, setIsConfirmPurgeOpen] = useState(false);

    // Integrity Lab State
    const [isScanningIntegrity, setIsScanningIntegrity] = useState(false);
    const [integrityReport, setIntegrityReport] = useState<{ orphans: Transaction[], emptyParents: Transaction[], brokenLinks: Transaction[], futureDates?: Transaction[] } | null>(null);

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

    const handleScanIntegrity = async () => {
        setIsScanningIntegrity(true);
        try {
            const report = await api.auditIntegrity();
            setIntegrityReport(report);
        } catch (e) {
            alert("Scan failed.");
        } finally {
            setIsScanningIntegrity(false);
        }
    };

    const handleExpungeGhost = async (id: string) => {
        if (!confirm("Permanently expunge this broken record?")) return;
        try {
            await api.deleteTransaction(id);
            // Re-scan to refresh
            await handleScanIntegrity();
        } catch (e) {
            alert("Deletion failed.");
        }
    };

    const handleUpdateAiConfig = (key: keyof AiConfig, value: any) => {
        const next = { ...aiConfig, [key]: value };
        setAiConfig(next); updateGeminiConfig(next);
        onUpdateSystemSettings({ ...systemSettings, aiConfig: next });
    };

    const handleUpdateBackupSettings = (enabled: boolean, freq: BackupConfig['frequency'], count: number) => {
        setBackupEnabled(enabled);
        setBackupFreq(freq); 
        setRetentionCount(count);
        onUpdateSystemSettings({ 
            ...systemSettings, 
            backupConfig: { 
                ...systemSettings.backupConfig,
                enabled,
                frequency: freq, 
                retentionCount: count
            } 
        });
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

    const handlePurge = async () => {
        if (purgeSelection.size === 0) return;
        setIsPurging(true);
        try {
            await api.resetDatabase(Array.from(purgeSelection));
            window.location.reload();
        } catch (e) {
            alert("Purge operation failed.");
            setIsPurging(false);
        }
    };

    const anomalyList = useMemo<AnomalyEntry[]>(() => {
        if (!integrityReport) return [];
        const list: AnomalyEntry[] = [];
        integrityReport.orphans.forEach(t => list.push({ t, type: 'Orphaned Child', color: 'bg-red-100 text-red-700' }));
        integrityReport.emptyParents.forEach(t => list.push({ t, type: 'Empty Parent', color: 'bg-amber-100 text-amber-700' }));
        integrityReport.brokenLinks.forEach(t => list.push({ t, type: 'Frag. Link Group', color: 'bg-indigo-100 text-indigo-700' }));
        (integrityReport.futureDates || []).forEach(t => list.push({ t, type: 'Future Date (Overflow Error)', color: 'bg-orange-100 text-orange-700' }));
        return list;
    }, [integrityReport]);

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
                backupEnabled={backupEnabled}
                backupFreq={backupFreq} 
                retentionCount={retentionCount} 
                logs={backupLogs}
                onUpdate={handleUpdateBackupSettings} 
            />

            <Section title="Data Integrity Lab">
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8">
                        <div className="p-5 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl">
                            <SparklesIcon className="w-10 h-10" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-black text-slate-800">Scan Ledger Health</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-lg">Checks for orphaned records, empty parent containers, and future-dated records (often caused by CSV parsing overflows).</p>
                        </div>
                        <button 
                            onClick={handleScanIntegrity} 
                            disabled={isScanningIntegrity}
                            className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isScanningIntegrity ? <RepeatIcon className="w-5 h-5 animate-spin" /> : <SearchCircleIcon className="w-5 h-5" />}
                            Execute Diagnostic
                        </button>
                    </div>

                    {integrityReport && (
                        <div className="space-y-4 animate-slide-up">
                            {anomalyList.length === 0 ? (
                                <div className="p-8 text-center bg-emerald-50 text-emerald-700 border-2 border-dashed border-emerald-200 rounded-[2rem] font-bold">
                                    <CheckCircleIcon className="w-10 h-10 mx-auto mb-2" />
                                    Institutional data is clean. No broken links or date overflows detected.
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400">
                                            <tr>
                                                <th className="px-6 py-4 text-left">Anomaly Class</th>
                                                <th className="px-6 py-4 text-left">Description</th>
                                                <th className="px-6 py-4 text-left">Date</th>
                                                <th className="px-6 py-4 text-right">Amount</th>
                                                <th className="px-6 py-4 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {anomalyList.map(({ t, type, color }) => (
                                                <tr key={t.id} className="hover:bg-red-50/30">
                                                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${color}`}>{type}</span></td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-700 truncate max-w-[200px]">{t.description}</td>
                                                    <td className="px-6 py-4 text-[10px] font-mono font-bold text-slate-500">{t.date}</td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">${t.amount.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-center"><button onClick={() => handleExpungeGhost(t.id)} title="Expunge Logical Error" className="p-2 text-slate-300 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Section>

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
                        
                        <div className="mt-6 bg-white/40 p-4 rounded-3xl border border-red-200 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {Object.entries(ENTITY_LABELS).map(([key, cfg]) => (
                                <label key={key} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors group">
                                    <input type="checkbox" checked={purgeSelection.has(key)} onChange={() => { const n = new Set(purgeSelection); if(n.has(key)) n.delete(key); else n.add(key); setPurgeSelection(n); }} className="rounded text-red-600" />
                                    <span className="text-[10px] font-black text-red-600 uppercase flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full md:w-64">
                        <button 
                            onClick={() => setIsConfirmPurgeOpen(true)} 
                            disabled={isPurging || purgeSelection.size === 0} 
                            className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                        >
                            <TrashIcon className="w-5 h-5" /> Execute Purge
                        </button>
                    </div>
                </div>
            </Section>

            <ConfirmationModal 
                isOpen={isConfirmPurgeOpen}
                onClose={() => setIsConfirmPurgeOpen(false)}
                onConfirm={handlePurge}
                title="Execute Data Purge?"
                message={`You are about to permanently remove ${purgeSelection.size} data categories from the system ledger. This cannot be undone.`}
                confirmLabel="Execute Permanent Wipe"
                variant="danger"
            />
        </div>
    );
};

export default SettingsPage;
