
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Payee, ReconciliationRule, Template, ScheduledEvent, User, BusinessProfile, DocumentFolder, BusinessDocument, Tag, SavedReport, ChatSession, CustomDateRange, AmazonMetric, YouTubeMetric, YouTubeChannel, FinancialGoal, FinancialPlan } from '../types';
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, FolderIcon, ExclamationTriangleIcon, DeleteIcon, ShieldCheckIcon, CloseIcon, SettingsIcon, TableIcon, TagIcon, CreditCardIcon, ChatBubbleIcon, TasksIcon, LightBulbIcon, BarChartIcon, DownloadIcon, RobotIcon, ExternalLinkIcon, WrenchIcon, SparklesIcon } from '../components/Icons';
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
    
    // Data props for export
    accounts: Account[];
    categories: Category[];
    tags: Tag[];
    payees: Payee[];
    rules: ReconciliationRule[];
    templates: Template[];
    scheduledEvents: ScheduledEvent[];
    users: User[];
    businessProfile: BusinessProfile;
    documentFolders: DocumentFolder[];
    onAddDocument: (doc: BusinessDocument) => void;
    onCreateFolder: (folder: DocumentFolder) => void;
    
    // Additional data for full backups
    savedReports: SavedReport[];
    savedDateRanges: CustomDateRange[];
    amazonMetrics: AmazonMetric[];
    youtubeMetrics: YouTubeMetric[];
    youtubeChannels: YouTubeChannel[];
    financialGoals: FinancialGoal[];
    financialPlan: FinancialPlan | null;
}

const ENTITY_LABELS: Record<string, { label: string, icon: React.ReactNode }> = {
    transactions: { label: 'Transactions', icon: <TableIcon className="w-4 h-4" /> },
    accounts: { label: 'Accounts', icon: <CreditCardIcon className="w-4 h-4" /> },
    categories: { label: 'Categories', icon: <TagIcon className="w-4 h-4" /> },
    tags: { label: 'Tags', icon: <TagIcon className="w-4 h-4" /> },
    payees: { label: 'Payees', icon: <DocumentIcon className="w-4 h-4" /> },
    reconciliationRules: { label: 'Rules', icon: <SettingsIcon className="w-4 h-4" /> },
    templates: { label: 'Templates & Events', icon: <TasksIcon className="w-4 h-4" /> },
    businessProfile: { label: 'Business Profile', icon: <DocumentIcon className="w-4 h-4" /> },
    savedReports: { label: 'Reports', icon: <BarChartIcon className="w-4 h-4" /> },
    amazonMetrics: { label: 'Amazon', icon: <DocumentIcon className="w-4 h-4" /> },
    youtubeMetrics: { label: 'YouTube', icon: <DocumentIcon className="w-4 h-4" /> },
    financialGoals: { label: 'Goals', icon: <LightBulbIcon className="w-4 h-4" /> },
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

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    transactions, transactionTypes, onAddTransactionType, onRemoveTransactionType, systemSettings, onUpdateSystemSettings,
    accounts, categories, tags, payees, rules, templates, scheduledEvents, users, businessProfile, documentFolders, onAddDocument, onCreateFolder,
    savedReports, savedDateRanges, amazonMetrics, youtubeMetrics, youtubeChannels, financialGoals, financialPlan
}) => {
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeEffect, setNewTypeEffect] = useState<'income' | 'expense' | 'transfer' | 'investment'>('expense');
    const importFileRef = useRef<HTMLInputElement>(null);
    const apiKeyActive = hasApiKey();

    const [exportSelection, setExportSelection] = useState<Set<string>>(new Set(Object.keys(ENTITY_LABELS)));

    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [restoreData, setRestoreData] = useState<any>(null);
    const [restoreSelection, setRestoreSelection] = useState<Set<string>>(new Set());

    const [purgeStep, setPurgeStep] = useState<'idle' | 'confirm' | 'final'>('idle');
    const [purgeText, setPurgeText] = useState('');
    const [isPurging, setIsPurging] = useState(false);

    const usedTransactionTypes = useMemo(() => new Set(transactions.map(tx => tx.typeId)), [transactions]);
    
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

    const handleSaveBackupSettings = () => {
        const newConfig = {
            frequency: backupFreq,
            retentionCount: retentionCount > 0 ? retentionCount : 1,
            lastBackupDate: systemSettings.backupConfig?.lastBackupDate
        };
        onUpdateSystemSettings({ ...systemSettings, backupConfig: newConfig });
        alert("Backup settings saved!");
    };

    const handleAddTransactionType = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newTypeName.trim();
        if (trimmedName) {
            const newType: Omit<TransactionType, 'id'> = {
                name: trimmedName,
                balanceEffect: newTypeEffect,
                isDefault: false
            };
            onAddTransactionType({ ...newType, id: generateUUID() });
            setNewTypeName('');
            setNewTypeEffect('expense');
        }
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
            version: '0.0.30',
            // Default core types
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
        
        if (exportSelection.has('templates')) {
            data.templates = templates;
            data.scheduledEvents = scheduledEvents;
        }

        if (exportSelection.has('savedReports')) {
            data.savedReports = savedReports;
            data.savedDateRanges = savedDateRanges;
        }

        if (exportSelection.has('amazonMetrics')) {
            data.amazonMetrics = amazonMetrics;
        }

        if (exportSelection.has('youtubeMetrics')) {
            data.youtubeMetrics = youtubeMetrics;
            data.youtubeChannels = youtubeChannels;
        }

        return data;
    };

    const generateBackupFilename = () => {
        const date = new Date().toISOString().split('T')[0];
        if (exportSelection.size === Object.keys(ENTITY_LABELS).length) {
            return `finparser-full-backup-${date}.json`;
        }
        const entities = Array.from(exportSelection)
            .map(key => key.replace('Metrics', '').replace('reconciliation', '').toLowerCase())
            .slice(0, 3)
            .join('-');
        const suffix = exportSelection.size > 3 ? `-and-${exportSelection.size - 3}-more` : '';
        return `finparser-backup-${entities}${suffix}-${date}.json`;
    };

    const handleExportData = () => {
        if (exportSelection.size === 0) {
            alert("Please select at least one item to back up.");
            return;
        }
        const data = getExportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = generateBackupFilename();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportToVault = async () => {
        if (exportSelection.size === 0) {
            alert("Please select at least one item to back up.");
            return;
        }
        try {
            let manualFolderId = documentFolders.find(f => f.name === "Manual Backups" && !f.parentId)?.id;
            if (!manualFolderId) {
                manualFolderId = generateUUID();
                const newFolder: DocumentFolder = {
                    id: manualFolderId,
                    name: "Manual Backups",
                    parentId: undefined,
                    createdAt: new Date().toISOString()
                };
                onCreateFolder(newFolder);
            }

            const data = getExportData();
            const jsonString = JSON.stringify(data, null, 2);
            const fileName = generateBackupFilename();
            const file = new File([jsonString], fileName, { type: 'application/json' });
            const docId = generateUUID();

            await saveFile(docId, file);

            const newDoc: BusinessDocument = {
                id: docId,
                name: fileName,
                uploadDate: new Date().toISOString().split('T')[0],
                size: file.size,
                mimeType: 'application/json',
                parentId: manualFolderId,
            };
            
            onAddDocument(newDoc);
            alert("Backup saved successfully to 'Manual Backups' folder in Document Vault!");
        } catch (e) {
            console.error(e);
            alert("Failed to save backup to vault. Check server logs.");
        }
    };

    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const detectedKeys = Object.keys(ENTITY_LABELS).filter(key => json.hasOwnProperty(key));
                if (detectedKeys.length === 0) {
                    throw new Error("The selected file does not appear to contain any valid FinParser backup data.");
                }
                setRestoreData(json);
                setRestoreSelection(new Set(detectedKeys));
                setIsRestoreModalOpen(true);
            } catch (err) {
                alert("Failed to read backup file: " + (err instanceof Error ? err.message : "Invalid JSON"));
            }
        };
        reader.readAsText(file);
    };

    const handleConfirmRestore = async () => {
        if (!restoreData || restoreSelection.size === 0) return;
        if (!window.confirm("Warning: This will overwrite existing data for the selected entities. This cannot be undone. Proceed?")) return;

        try {
            const savePromises: Promise<any>[] = [];
            for (const key of Array.from(restoreSelection)) {
                const entityKey = key as string;
                if (entityKey === 'templates') {
                    savePromises.push(api.save('templates', restoreData.templates || []));
                    savePromises.push(api.save('scheduledEvents', restoreData.scheduledEvents || []));
                } else if (entityKey === 'savedReports') {
                    savePromises.push(api.save('savedReports', restoreData.savedReports || []));
                    savePromises.push(api.save('savedDateRanges', restoreData.savedDateRanges || []));
                } else if (entityKey === 'youtubeMetrics') {
                    savePromises.push(api.save('youtubeMetrics', restoreData.youtubeMetrics || []));
                    savePromises.push(api.save('youtubeChannels', restoreData.youtubeChannels || []));
                } else {
                    savePromises.push(api.save(entityKey, restoreData[entityKey]));
                }
            }

            if (restoreData.transactionTypes) savePromises.push(api.save('transactionTypes', restoreData.transactionTypes));
            if (restoreData.users) savePromises.push(api.save('users', restoreData.users));

            await Promise.all(savePromises);
            alert("Data restored successfully! The application will now reload.");
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Failed to restore data. Check console for details.");
        }
    };

    const handlePurgeDatabase = async () => {
        setIsPurging(true);
        const success = await api.resetDatabase();
        if (success) {
            alert("All data has been purged. Application will now reload to a clean state.");
            window.location.reload();
        } else {
            alert("Failed to purge database. Check server logs for permissions or connection issues.");
            setIsPurging(false);
            setPurgeStep('idle');
        }
    };
    
    return (
        <div className="space-y-8 pb-20">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
                <p className="text-slate-500 mt-1">Manage your application settings and data backups.</p>
            </div>
            
            <div className="space-y-6">
                
                <Section title="AI & Intelligence" variant="info">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className={`p-6 rounded-xl border transition-all ${apiKeyActive ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full shadow-sm ${apiKeyActive ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    <RobotIcon className="w-8 h-8" />
                                </div>
                                <div className="flex-grow">
                                    <h3 className={`text-lg font-bold ${apiKeyActive ? 'text-emerald-800' : 'text-amber-800'}`}>
                                        AI Status: {apiKeyActive ? 'Active & Secure' : 'Configuration Required'}
                                    </h3>
                                    <p className={`text-sm mt-1 ${apiKeyActive ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {apiKeyActive 
                                            ? "Your Gemini API Key is successfully configured in the environment. AI insights, document analysis, and the Tax Advisor are fully enabled."
                                            : "AI capabilities are currently disabled because no API Key was found in your server environment."}
                                    </p>
                                    
                                    {apiKeyActive ? (
                                        <div className="mt-4 flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase">
                                                <ShieldCheckIcon className="w-4 h-4" />
                                                Managed via Environment
                                            </div>
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
                                                Manage Key Studio <ExternalLinkIcon className="w-3 h-3" />
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="mt-6 space-y-4">
                                            <div className="bg-white/60 p-4 rounded-lg border border-amber-300">
                                                <h4 className="text-xs font-bold text-amber-900 uppercase flex items-center gap-2 mb-2">
                                                    <WrenchIcon className="w-4 h-4"/> How to Enable
                                                </h4>
                                                <ol className="text-sm text-amber-900 space-y-3 list-decimal list-inside font-medium">
                                                    <li>Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Google AI Studio</a>.</li>
                                                    <li>Open your project's <code>.env</code> file (or <code>docker-compose.yml</code>).</li>
                                                    <li>Add the following line:</li>
                                                </ol>
                                                <div className="mt-3 bg-slate-900 text-slate-100 p-3 rounded font-mono text-xs select-all shadow-inner">
                                                    API_KEY=your_copied_key_here
                                                </div>
                                                <p className="text-xs text-amber-700 mt-4 italic">
                                                    After adding the key, <strong>restart</strong> your application/container to apply changes.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-indigo-600" />
                                What AI can do for you:
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { title: 'Document Analysis', desc: 'Auto-extract transactions from PDFs and bank statements.' },
                                    { title: 'Tax Advisor', desc: 'Ask complex tax questions based on your actual business data.' },
                                    { title: 'Smart Auditor', desc: 'Find hidden transfers, splits, and miscategorized recurring bills.' },
                                    { title: 'Wealth Coach', desc: 'Generate custom financial strategies based on spending patterns.' }
                                ].map((feature, i) => (
                                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                        <p className="text-sm font-bold text-slate-800">{feature.title}</p>
                                        <p className="text-xs text-slate-500 mt-1">{feature.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="Data & Backups">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4 flex flex-col h-full">
                            <div className="flex-grow">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <ShieldCheckIcon className="w-5 h-5 text-green-600" />
                                    Automated Snapshots
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Automatically save snapshots of your data to the "Automated Backups" folder in your Vault.
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequency</label>
                                    <select 
                                        value={backupFreq} 
                                        onChange={(e) => setBackupFreq(e.target.value as any)}
                                        className="w-full p-2 border rounded-md text-sm bg-white"
                                    >
                                        <option value="never">Off</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Retention</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        max="50"
                                        value={retentionCount} 
                                        onChange={(e) => setRetentionCount(parseInt(e.target.value) || 1)}
                                        className="w-full p-2 border rounded-md text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <p className="text-[10px] text-slate-400 italic">
                                    Last Run: {systemSettings.backupConfig?.lastBackupDate 
                                        ? new Date(systemSettings.backupConfig.lastBackupDate).toLocaleString() 
                                        : 'Never'}
                                </p>
                                <button 
                                    onClick={handleSaveBackupSettings}
                                    className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-indigo-100 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-indigo-900 flex items-center gap-2 text-lg">
                                        <CloudArrowUpIcon className="w-6 h-6 text-indigo-600" />
                                        Manual Backup & Restore
                                    </h3>
                                    <p className="text-sm text-indigo-700">Choose exactly which entities to include in your backup.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleExportToVault}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                                    >
                                        <FolderIcon className="w-4 h-4" /> Vault
                                    </button>
                                    <button 
                                        onClick={handleExportData}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-colors"
                                    >
                                        <DownloadIcon className="w-4 h-4" /> Download
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">What to include in export:</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setExportSelection(new Set(Object.keys(ENTITY_LABELS)))} className="text-[10px] font-bold text-indigo-600 hover:underline">Select All</button>
                                        <button onClick={() => setExportSelection(new Set())} className="text-[10px] font-bold text-slate-500 hover:underline">Clear</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {Object.entries(ENTITY_LABELS).map(([key, { label, icon }]) => (
                                        <button
                                            key={key}
                                            onClick={() => toggleExportSelection(key)}
                                            className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${exportSelection.has(key) ? 'bg-white border-indigo-400 text-indigo-700 shadow-sm ring-1 ring-indigo-400' : 'bg-slate-100 border-slate-200 text-slate-500 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                                        >
                                            <div className={exportSelection.has(key) ? 'text-indigo-600' : 'text-slate-400'}>
                                                {icon}
                                            </div>
                                            <span className="text-xs font-medium truncate">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-indigo-50">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-600">Have a backup file? Restore your data here.</p>
                                    <div className="relative">
                                        <input 
                                            type="file" 
                                            accept=".json"
                                            ref={importFileRef}
                                            onChange={handleImportFileChange}
                                            className="hidden"
                                        />
                                        <button 
                                            onClick={() => importFileRef.current?.click()}
                                            className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 shadow-md transition-colors"
                                        >
                                            <UploadIcon className="w-4 h-4" /> Restore from File
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                {isRestoreModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsRestoreModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                <div className="flex items-center gap-2">
                                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><UploadIcon className="w-5 h-5"/></div>
                                    <h3 className="font-bold text-slate-800 text-lg">Selective Restore</h3>
                                </div>
                                <button onClick={() => setIsRestoreModalOpen(false)}><CloseIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div className="text-sm text-amber-800">
                                        <p className="font-bold">Important Notice</p>
                                        <p className="mt-1">Restoring will <strong>overwrite</strong> any existing data for the selected categories. We recommend downloading a fresh backup first.</p>
                                    </div>
                                </div>

                                <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">Select data to restore from file:</p>
                                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {Object.entries(ENTITY_LABELS).map(([key, { label, icon }]) => {
                                        if (!restoreData.hasOwnProperty(key)) return null;
                                        let count = 0;
                                        const item = restoreData[key];
                                        if (Array.isArray(item)) count = item.length;
                                        else if (item && typeof item === 'object') count = Object.keys(item).length;

                                        return (
                                            <label 
                                                key={key} 
                                                className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${restoreSelection.has(key) ? 'bg-indigo-50 border-indigo-400 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={restoreSelection.has(key)}
                                                    onChange={() => {
                                                        const newSet = new Set(restoreSelection);
                                                        if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
                                                        setRestoreSelection(newSet);
                                                    }}
                                                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                />
                                                <div className="ml-3 flex-grow">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-indigo-600 opacity-70">{icon}</span>
                                                        <span className="font-bold text-slate-700">{label}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">{count} {count === 1 ? 'item' : 'items'} detected</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                                <button onClick={() => setIsRestoreModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
                                <button 
                                    onClick={handleConfirmRestore}
                                    disabled={restoreSelection.size === 0}
                                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all disabled:opacity-30"
                                >
                                    Restore {restoreSelection.size} Item{restoreSelection.size !== 1 ? 's' : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <Section title="Manage Transaction Types">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Add a New Type</h3>
                            <form onSubmit={handleAddTransactionType} className="space-y-4">
                                <div>
                                    <label htmlFor="typeName" className="block text-sm font-medium text-slate-700">Type Name</label>
                                    <input type="text" id="typeName" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="e.g., Stock Sale" className="mt-1" required />
                                </div>
                                <div>
                                    <label htmlFor="typeEffect" className="block text-sm font-medium text-slate-700">Balance Effect</label>
                                    <select id="typeEffect" value={newTypeEffect} onChange={e => setNewTypeEffect(e.target.value as any)} required>
                                        <option value="expense">Expense (decreases net worth)</option>
                                        <option value="income">Income (increases net worth)</option>
                                        <option value="investment">Investment (asset purchase)</option>
                                        <option value="transfer">Transfer (no change)</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full sm:w-auto px-6 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700">
                                    Add Type
                                </button>
                            </form>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Your Transaction Types</h3>
                            {transactionTypes.length > 0 ? (
                                <ul className="space-y-3 max-h-96 overflow-y-auto">
                                    {transactionTypes.map(type => {
                                        const isUsed = usedTransactionTypes.has(type.id);
                                        const canBeDeleted = !type.isDefault && !isUsed;
                                        return (
                                        <li key={type.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <div>
                                                <p className="font-medium text-slate-800">{type.name}</p>
                                                <p className="text-xs text-slate-500 capitalize">{type.balanceEffect}</p>
                                            </div>
                                            <button 
                                                onClick={() => onRemoveTransactionType(type.id)} 
                                                disabled={!canBeDeleted}
                                                className="text-red-500 hover:text-red-700 disabled:text-slate-400 disabled:cursor-not-allowed font-medium text-sm"
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    )})}
                                </ul>
                            ) : (
                                <p className="text-center text-slate-500 py-8">No transaction types found.</p>
                            )}
                        </div>
                    </div>
                </Section>

                <Section title="Danger Zone" variant="danger">
                    <div className="bg-red-50 p-6 rounded-xl border border-red-200 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-grow">
                            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-6 h-6" />
                                Factory Reset
                            </h3>
                            <p className="text-sm text-red-700 mt-2">
                                This will permanently delete all transactions, accounts, categories, rules, and uploaded documents from your local server. 
                                <strong> This action is irreversible.</strong>
                            </p>
                        </div>
                        
                        <div className="flex-shrink-0 w-full md:w-auto">
                            {purgeStep === 'idle' && (
                                <button 
                                    onClick={() => setPurgeStep('confirm')}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md transition-all"
                                >
                                    <DeleteIcon className="w-5 h-5" /> Purge Everything
                                </button>
                            )}

                            {purgeStep === 'confirm' && (
                                <div className="space-y-3 bg-white p-4 rounded-lg border border-red-300 shadow-lg animate-slide-up">
                                    <p className="text-xs font-bold text-red-600 uppercase flex items-center gap-1">
                                        <ShieldCheckIcon className="w-4 h-4"/> Step 1: Secure Data
                                    </p>
                                    <p className="text-xs text-slate-600">Please download a backup of your data before proceeding.</p>
                                    <div className="flex gap-2">
                                        <button onClick={handleExportData} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded hover:bg-slate-200">Download Backup</button>
                                        <button onClick={() => setPurgeStep('final')} className="flex-1 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">I Have a Backup</button>
                                    </div>
                                    <button onClick={() => setPurgeStep('idle')} className="w-full text-xs text-slate-400 hover:text-slate-600 mt-2">Cancel</button>
                                </div>
                            )}

                            {purgeStep === 'final' && (
                                <div className="space-y-4 bg-white p-4 rounded-lg border border-red-500 shadow-xl animate-slide-up">
                                    <p className="text-xs font-bold text-red-600 uppercase">Final Confirmation</p>
                                    <p className="text-xs text-slate-600">Type <span className="font-mono font-bold text-red-600 select-all">PURGE</span> below to confirm.</p>
                                    <input 
                                        type="text" 
                                        value={purgeText} 
                                        onChange={(e) => setPurgeText(e.target.value.toUpperCase())}
                                        placeholder="Type PURGE"
                                        className="w-full p-2 border-red-300 text-center font-bold focus:ring-red-500 focus:border-red-500"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => setPurgeStep('idle')} className="flex-1 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded">Abort</button>
                                        <button 
                                            disabled={purgeText !== 'PURGE' || isPurging}
                                            onClick={handlePurgeDatabase}
                                            className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 disabled:opacity-30"
                                        >
                                            {isPurging ? 'Purging...' : 'Delete Forever'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
};

export default SettingsPage;
