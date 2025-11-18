
import React, { useState, useMemo, useRef } from 'react';
import type { Transaction, TransactionType } from '../types';
import { CloudArrowUpIcon, UploadIcon } from '../components/Icons';

interface SettingsPageProps {
    transactions: Transaction[];
    transactionTypes: TransactionType[];
    onAddTransactionType: (type: TransactionType) => void;
    onRemoveTransactionType: (typeId: string) => void;
}

const Section: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <details className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 open:ring-2 open:ring-indigo-500" open>
        <summary className="text-xl font-bold text-slate-700 cursor-pointer">{title}</summary>
        <div className="mt-4">
            {children}
        </div>
    </details>
);

const SettingsPage: React.FC<SettingsPageProps> = ({ transactions, transactionTypes, onAddTransactionType, onRemoveTransactionType }) => {
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeEffect, setNewTypeEffect] = useState<'income' | 'expense' | 'transfer'>('expense');
    const importFileRef = useRef<HTMLInputElement>(null);

    const usedTransactionTypes = useMemo(() => new Set(transactions.map(tx => tx.typeId)), [transactions]);
    
    const handleAddTransactionType = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newTypeName.trim();
        if (trimmedName) {
            const newType: Omit<TransactionType, 'id'> = {
                name: trimmedName,
                balanceEffect: newTypeEffect,
                isDefault: false
            };
            onAddTransactionType({ ...newType, id: crypto.randomUUID() });
            setNewTypeName('');
            setNewTypeEffect('expense');
        }
    };

    const handleExportData = () => {
        const data = {
            exportDate: new Date().toISOString(),
            version: '0.0.8',
            transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
            accounts: JSON.parse(localStorage.getItem('accounts') || '[]'),
            accountTypes: JSON.parse(localStorage.getItem('accountTypes') || '[]'),
            categories: JSON.parse(localStorage.getItem('categories') || '[]'),
            payees: JSON.parse(localStorage.getItem('payees') || '[]'),
            rules: JSON.parse(localStorage.getItem('reconciliationRules') || '[]'),
            templates: JSON.parse(localStorage.getItem('templates') || '[]'),
            scheduledEvents: JSON.parse(localStorage.getItem('scheduledEvents') || '[]'),
            users: JSON.parse(localStorage.getItem('users') || '[]'),
            transactionTypes: JSON.parse(localStorage.getItem('transactionTypes') || '[]'),
            businessProfile: JSON.parse(localStorage.getItem('businessProfile') || '{}'),
            // Note: We do not export documents here as they are stored in IndexedDB and are too large for simple JSON export
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finparser-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm("Warning: Importing data will OVERWRITE your current local data. This action cannot be undone. Are you sure?")) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                
                // Validate keys roughly
                const requiredKeys = ['transactions', 'accounts', 'categories'];
                const missingKeys = requiredKeys.filter(k => !json.hasOwnProperty(k));
                
                if (missingKeys.length > 0) {
                    throw new Error(`Invalid backup file. Missing keys: ${missingKeys.join(', ')}`);
                }

                // Restore data
                localStorage.setItem('transactions', JSON.stringify(json.transactions));
                localStorage.setItem('accounts', JSON.stringify(json.accounts));
                localStorage.setItem('accountTypes', JSON.stringify(json.accountTypes));
                localStorage.setItem('categories', JSON.stringify(json.categories));
                localStorage.setItem('payees', JSON.stringify(json.payees));
                localStorage.setItem('reconciliationRules', JSON.stringify(json.rules));
                localStorage.setItem('templates', JSON.stringify(json.templates));
                localStorage.setItem('scheduledEvents', JSON.stringify(json.scheduledEvents));
                localStorage.setItem('users', JSON.stringify(json.users));
                localStorage.setItem('transactionTypes', JSON.stringify(json.transactionTypes));
                localStorage.setItem('businessProfile', JSON.stringify(json.businessProfile));

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
                <Section title="Data Management">
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-4">
                        <div>
                            <h3 className="font-semibold text-indigo-900">Backup & Migration</h3>
                            <p className="text-sm text-indigo-700 mt-1">
                                Use these tools to move your data. Export your current data before switching to a self-hosted version, then use Import to restore it.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={handleExportData}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 font-medium rounded-lg hover:bg-indigo-50 shadow-sm transition-colors"
                            >
                                <CloudArrowUpIcon className="w-5 h-5" />
                                Export All Data
                            </button>
                            
                            <div className="relative">
                                <input 
                                    type="file" 
                                    accept=".json"
                                    ref={importFileRef}
                                    onChange={handleImportData}
                                    className="hidden"
                                />
                                <button 
                                    onClick={() => importFileRef.current?.click()}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors w-full sm:w-auto"
                                >
                                    <UploadIcon className="w-5 h-5" />
                                    Import / Restore
                                </button>
                            </div>
                        </div>
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
