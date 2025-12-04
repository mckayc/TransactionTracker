
import React, { useState } from 'react';
import type { Transaction, TransactionType, Category, Payee, User, Tag, SavedReport, ReportConfig, Account, CustomDateRange } from '../types';
import ReportColumn from '../components/ReportColumn';
import ReportConfigModal from '../components/ReportConfigModal';
import { AddIcon, DeleteIcon, EditIcon, ChartPieIcon, CloseIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface ReportsProps {
  transactions: Transaction[];
  transactionTypes: TransactionType[];
  categories: Category[];
  payees: Payee[];
  users: User[];
  tags: Tag[];
  accounts: Account[];
  savedReports: SavedReport[];
  setSavedReports: React.Dispatch<React.SetStateAction<SavedReport[]>>;
  savedDateRanges: CustomDateRange[];
  setSavedDateRanges: React.Dispatch<React.SetStateAction<CustomDateRange[]>>;
}

const Reports: React.FC<ReportsProps> = ({ transactions, transactionTypes, categories, payees, users, tags, accounts, savedReports, setSavedReports, savedDateRanges, setSavedDateRanges }) => {
    
    // Active columns in the workspace
    const [activeReports, setActiveReports] = useState<ReportConfig[]>([]);
    
    // UI State
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<ReportConfig | undefined>(undefined);
    const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

    const handleCreateReport = (config: ReportConfig) => {
        setActiveReports(prev => [...prev, config]);
    };

    const handleCloseColumn = (index: number) => {
        setActiveReports(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveReport = (config: ReportConfig) => {
        // Check if updating existing by ID match
        const existingIndex = savedReports.findIndex(r => r.id === config.id);
        
        if (existingIndex >= 0) {
            if (confirm(`Overwrite existing report "${config.name}"?`)) {
                const updated = [...savedReports];
                updated[existingIndex] = { ...updated[existingIndex], name: config.name, config };
                setSavedReports(updated);
            } else {
                // Save as copy with new ID if user declines overwrite? 
                // Usually Cancel means cancel, but here we can force a new ID for "Save As New" behavior if we added UI for it.
                // For now, we assume user wants to save this specific config state.
            }
        } else {
            // Check if name exists but ID is different (rare case of manual dupes)
            const nameMatch = savedReports.find(r => r.name === config.name);
            if (nameMatch && !confirm(`A report named "${config.name}" already exists. Create a duplicate?`)) {
                return;
            }

            const newReport: SavedReport = {
                id: config.id, // CRITICAL: Use the config ID as the SavedReport ID to enable future overwrites
                name: config.name,
                config
            };
            setSavedReports(prev => [...prev, newReport]);
        }
        // alert("Report saved successfully!"); // Removed alert for smoother flow
    };

    const handleLoadReport = (saved: SavedReport) => {
        // Clone config to allow independent modification, but keep ID to link back to saved report
        const config: ReportConfig = { ...saved.config, id: saved.id, name: saved.name }; 
        setActiveReports(prev => [...prev, config]);
        setIsSavedReportsOpen(false);
    };

    const handleDeleteSavedReport = (id: string) => {
        if (confirm("Permanently delete this saved report?")) {
            setSavedReports(prev => prev.filter(r => r.id !== id));
        }
    };

    const openCreateModal = () => {
        setEditingConfig(undefined);
        setIsConfigModalOpen(true);
    };

    // Date Range Handlers (Lifted for reuse in ReportColumn)
    const handleSaveDateRange = (range: CustomDateRange) => {
        setSavedDateRanges(prev => {
            const existing = prev.findIndex(r => r.id === range.id);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = range;
                return updated;
            }
            return [...prev, range];
        });
    };

    const handleDeleteDateRange = (id: string) => {
        setSavedDateRanges(prev => prev.filter(r => r.id !== id));
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 px-4 pt-2 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
                    <p className="text-slate-500 mt-1">Visualize and analyze your financial data.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsSavedReportsOpen(true)}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        Saved Reports ({savedReports.length})
                    </button>
                    {activeReports.length > 0 && (
                        <button 
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-colors"
                        >
                            <AddIcon className="w-5 h-5" /> New Report
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                {activeReports.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 m-4">
                        <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                            <ChartPieIcon className="w-16 h-16 text-indigo-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-700 mb-2">No Reports Open</h2>
                        <p className="text-slate-500 mb-8 max-w-md text-center">Create a new custom report to analyze your income, expenses, and trends, or load a saved one.</p>
                        <div className="flex gap-4">
                            <button 
                                onClick={openCreateModal}
                                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all transform hover:-translate-y-1"
                            >
                                Create Report
                            </button>
                            {savedReports.length > 0 && (
                                <button 
                                    onClick={() => setIsSavedReportsOpen(true)}
                                    className="px-8 py-3 bg-white text-slate-700 font-bold rounded-xl shadow border border-slate-200 hover:bg-slate-50 transition-all"
                                >
                                    Load Saved
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex gap-4 px-4 pb-4 min-w-full w-max">
                        {activeReports.map((config, index) => (
                            <div key={`${config.id}-${index}`} className="w-[380px] md:w-[450px] h-full flex flex-col relative group">
                                <button 
                                    onClick={() => handleCloseColumn(index)}
                                    className="absolute -top-3 -right-2 bg-slate-800 text-white p-1 rounded-full shadow-md hover:bg-slate-700 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Close Report"
                                >
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                                
                                <ReportColumn
                                    config={config}
                                    transactions={transactions}
                                    categories={categories}
                                    transactionTypes={transactionTypes}
                                    accounts={accounts}
                                    users={users}
                                    tags={tags}
                                    payees={payees}
                                    onSaveReport={handleSaveReport}
                                    savedDateRanges={savedDateRanges}
                                    onSaveDateRange={handleSaveDateRange}
                                    onDeleteDateRange={handleDeleteDateRange}
                                />
                            </div>
                        ))}
                        
                        {activeReports.length < 4 && (
                            <div 
                                onClick={openCreateModal}
                                className="w-[100px] h-full border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer transition-all flex-shrink-0"
                            >
                                <AddIcon className="w-8 h-8 mb-2" />
                                <span className="text-sm font-medium">Add</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <ReportConfigModal 
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                onSave={handleCreateReport}
                initialConfig={editingConfig}
                accounts={accounts}
                categories={categories}
                users={users}
                transactionTypes={transactionTypes}
                tags={tags}
                payees={payees}
                savedDateRanges={savedDateRanges}
                onSaveDateRange={handleSaveDateRange}
                onDeleteDateRange={handleDeleteDateRange}
                transactions={transactions}
            />

            {isSavedReportsOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={() => setIsSavedReportsOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-xl font-bold text-slate-800">Saved Reports</h2>
                            <button onClick={() => setIsSavedReportsOpen(false)} className="p-1 rounded-full hover:bg-slate-100"><CloseIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {savedReports.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">No saved reports found.</p>
                            ) : (
                                savedReports.map(report => (
                                    <div key={report.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:border-indigo-300 group">
                                        <div>
                                            <h3 className="font-bold text-slate-700">{report.name}</h3>
                                            <p className="text-xs text-slate-500">
                                                {savedDateRanges.find(r => r.id === report.config.datePreset)?.name || 
                                                 (report.config.datePreset === 'custom' ? 'Custom Range' : report.config.datePreset)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleLoadReport(report)}
                                                className="px-3 py-1.5 bg-white border border-slate-200 text-indigo-600 text-sm font-bold rounded hover:bg-indigo-50"
                                            >
                                                Load
                                            </button>
                                            <button 
                                                onClick={() => { setEditingConfig({...report.config, id: report.id, name: report.name}); setIsSavedReportsOpen(false); setIsConfigModalOpen(true); }}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-white"
                                                title="Edit Config"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteSavedReport(report.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-white"
                                                title="Delete"
                                            >
                                                <DeleteIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
