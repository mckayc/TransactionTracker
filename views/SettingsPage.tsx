
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Transaction, TransactionType, SystemSettings, Account, Category, Payee, ReconciliationRule, Template, ScheduledEvent, User, BusinessProfile, DocumentFolder, BusinessDocument } from '../types';
import { CloudArrowUpIcon, UploadIcon, CheckCircleIcon, DocumentIcon, FolderIcon } from '../components/Icons';
import { generateUUID } from '../utils';
import { api } from '../services/apiService';
import { saveFile } from '../services/storageService';

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
    payees: Payee[];
    rules: ReconciliationRule[];
    templates: Template[];
    scheduledEvents: ScheduledEvent[];
    users: User[];
    businessProfile: BusinessProfile;
    documentFolders: DocumentFolder[];
    onAddDocument: (doc: BusinessDocument) => void;
    onCreateFolder: (folder: DocumentFolder) => void;
}

const Section: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <details className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 open:ring-2 open:ring-indigo-500" open>
        <summary className="text-xl font-bold text-slate-700 cursor-pointer">{title}</summary>
        <div className="mt-4">
            {children}
        </div>
    </details>
);

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    transactions, transactionTypes, onAddTransactionType, onRemoveTransactionType, systemSettings, onUpdateSystemSettings,
    accounts, categories, payees, rules, templates, scheduledEvents, users, businessProfile, documentFolders, onAddDocument, onCreateFolder
}) => {
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeEffect, setNewTypeEffect] = useState<'income' | 'expense' | 'transfer'>('expense');
    const [apiKey, setApiKey] = useState('');
    const [apiKeySaved, setApiKeySaved] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);

    const usedTransactionTypes = useMemo(() => new Set(transactions.map(tx => tx.typeId)), [transactions]);
    
    // Backup Settings State
    const [backupFreq, setBackupFreq] = useState<'daily' | 'weekly' | 'monthly' | 'never'>('never');
    const [retentionCount, setRetentionCount] = useState(5);

    useEffect(() => {
        if (systemSettings.apiKey) {
            setApiKey(systemSettings.apiKey);
        }
        if (systemSettings.backupConfig) {
            setBackupFreq(systemSettings.backupConfig.frequency);
            setRetentionCount(systemSettings.backupConfig.retentionCount);
        } else {
            // Default initialization
            setBackupFreq('never');
            setRetentionCount(5);
        }
    }, [systemSettings]);

    const handleSaveApiKey = () => {
        const newKey = apiKey.trim();
        onUpdateSystemSettings({ ...systemSettings, apiKey: newKey });
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 2000);
    };

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

    const getExportData = () => {
        return {
            exportDate: new Date().toISOString(),
            version: '0.0.9',
            transactions,
            accounts,
            accountTypes: [], // Legacy support mostly
            categories,
            payees,
            reconciliationRules: rules,
            templates,
            scheduledEvents,
            users,
            transactionTypes,
            businessProfile,
            documentFolders,
        };
    };

    const handleExportData = () => {
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

    const handleExportToVault = async () => {
        try {
            // 1. Ensure "Manual Backups" folder exists
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

            // 2. Create Backup File
            const data = getExportData();
            const jsonString = JSON.stringify(data, null, 2);
            const fileName = `Manual_Backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            const file = new File([jsonString], fileName, { type: 'application/json' });
            const docId = generateUUID();

            // 3. Upload to server
            await saveFile(docId, file);

            // 4. Create Document Metadata
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

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm("Warning: Importing data will OVERWRITE your current data on the server. This action cannot be undone. Are you sure?")) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                
                // Validate keys roughly
                const requiredKeys = ['transactions', 'accounts', 'categories'];
                const missingKeys = requiredKeys.filter(k => !json.hasOwnProperty(k));
                
                if (missingKeys.length > 0) {
                    throw new Error(`Invalid backup file. Missing keys: ${missingKeys.join(', ')}`);
                }

                // Send data to API
                await api.save('transactions', json.transactions || []);
                await api.save('accounts', json.accounts || []);
                await api.save('categories', json.categories || []);
                await api.save('payees', json.payees || []);
                await api.save('reconciliationRules', json.reconciliationRules || []);
                await api.save('templates', json.templates || []);
                await api.save('scheduledEvents', json.scheduledEvents || []);
                await api.save('users', json.users || []);
                await api.save('transactionTypes', json.transactionTypes || []);
                await api.save('businessProfile', json.businessProfile || {});
                await api.save('documentFolders', json.documentFolders || []);

                alert("Import successful! The application will now reload.");
                window.location.reload();

            } catch (err) {
                console.error(err);
                alert("Failed to import data: " + (err instanceof Error ? err.message : "Unknown error"));
            }
        };
        reader.readAsText(file);
    };
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
                <p className="text-slate-500 mt-1">Manage your application settings.</p>
            </div>
            
            <div className="space-y-6">
                <Section title="Data & Backups">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Backup Configuration */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                            <div>
                                <h3 className="font-semibold text-slate-900">Automated Backups</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Automatically save snapshots of your data to the "Automated Backups" folder in your Vault.
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Frequency</label>
                                    <select 
                                        value={backupFreq} 
                                        onChange={(e) => setBackupFreq(e.target.value as any)}
                                        className="w-full p-2 border rounded-md text-sm"
                                    >
                                        <option value="never">Off</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Retention (Keep Last)</label>
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
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-slate-500 italic">
                                    Last Run: {systemSettings.backupConfig?.lastBackupDate 
                                        ? new Date(systemSettings.backupConfig.lastBackupDate).toLocaleString() 
                                        : 'Never'}
                                </p>
                                <button 
                                    onClick={handleSaveBackupSettings}
                                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-md transition-colors"
                                >
                                    Save Settings
                                </button>
                            </div>
                        </div>

                        {/* Manual Actions */}
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-4">
                            <div>
                                <h3 className="font-semibold text-indigo-900">Manual Actions</h3>
                                <p className="text-sm text-indigo-700 mt-1">
                                    Create immediate backups or restore from a file. Manual backups are saved to the "Manual Backups" folder.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={handleExportToVault}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 font-medium rounded-lg hover:bg-indigo-50 shadow-sm transition-colors"
                                >
                                    <DocumentIcon className="w-5 h-5 text-indigo-600" />
                                    Save Backup to Vault
                                </button>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleExportData}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-indigo-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <CloudArrowUpIcon className="w-4 h-4" /> Download
                                    </button>
                                    <div className="relative flex-1">
                                        <input 
                                            type="file" 
                                            accept=".json"
                                            ref={importFileRef}
                                            onChange={handleImportData}
                                            className="hidden"
                                        />
                                        <button 
                                            onClick={() => importFileRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                        >
                                            <UploadIcon className="w-4 h-4" /> Restore
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="API Key Configuration">
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-slate-900">Google Gemini API Key</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                This key enables AI features like document analysis and automatic categorization. It is stored securely in your database.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="password" 
                                value={apiKey} 
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your API Key (starts with AIza...)"
                                className="flex-grow p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <button 
                                onClick={handleSaveApiKey}
                                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"
                            >
                                {apiKeySaved ? <CheckCircleIcon className="w-5 h-5" /> : null}
                                {apiKeySaved ? 'Saved!' : 'Save Key'}
                            </button>
                        </div>
                        {process.env.API_KEY && (
                            <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                                <CheckCircleIcon className="w-3 h-3" />
                                System API Key detected (from Docker ENV). The key above will take precedence if set.
                            </p>
                        )}
                    </div>
                </Section>

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
                                                title={type.isDefault ? "Cannot delete a default type." : isUsed ? "Cannot delete a type that is in use." : "Delete type"}
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
            </div>
        </div>
    );
};

export default React.memo(SettingsPage);
