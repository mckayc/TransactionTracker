
import React, { useState, useEffect } from 'react';
import type { Transaction, TransactionType, Category, Payee, User, Tag, SavedReport, ReportConfig, Account, CustomDateRange, AmazonMetric } from '../types';
import ReportColumn from '../components/ReportColumn';
import ReportConfigModal from '../components/ReportConfigModal';
import { AddIcon, DeleteIcon, EditIcon, ChartPieIcon, CloseIcon, DocumentIcon, FolderIcon, CheckCircleIcon, SettingsIcon, DragHandleIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface ReportsProps {
  transactions: Transaction[];
  amazonMetrics: AmazonMetric[];
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

const Reports: React.FC<ReportsProps> = ({ transactions, amazonMetrics, transactionTypes, categories, payees, users, tags, accounts, savedReports, setSavedReports, savedDateRanges, setSavedDateRanges }) => {
    
    // Active columns in the workspace
    const [activeReports, setActiveReports] = useState<ReportConfig[]>([]);
    
    // UI State
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<ReportConfig | undefined>(undefined);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    // Renaming State
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Drag and Drop State
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleCreateReport = (config: ReportConfig) => {
        setActiveReports(prev => [...prev, config]);
    };

    const handleCloseColumn = (index: number) => {
        setActiveReports(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateActiveReport = (index: number, config: ReportConfig) => {
        setActiveReports(prev => {
            const newReports = [...prev];
            newReports[index] = config;
            return newReports;
        });
    };

    const handleSaveReport = (config: ReportConfig) => {
        // 1. Try to find existing report by ID
        const existingIndex = savedReports.findIndex(r => r.id === config.id);
        
        if (existingIndex >= 0) {
            // Update existing (Implicit save if ID matches)
            const existing = savedReports[existingIndex];
            const updated = [...savedReports];
            updated[existingIndex] = { ...existing, name: config.name, config };
            setSavedReports(updated);
        } else {
            // 2. ID mismatch, check name collision
            const nameMatchIndex = savedReports.findIndex(r => r.name === config.name);
            
            if (nameMatchIndex >= 0) {
                if (window.confirm(`A report named "${config.name}" already exists. Overwrite it?`)) {
                    const updated = [...savedReports];
                    // We update the existing slot with the NEW config but keep the old ID to maintain consistency
                    const oldId = updated[nameMatchIndex].id;
                    updated[nameMatchIndex] = { 
                        id: oldId,
                        name: config.name,
                        config: { ...config, id: oldId } 
                    };
                    setSavedReports(updated);
                    return;
                }
            }

            // 3. Create new
            const newReport: SavedReport = {
                id: config.id,
                name: config.name,
                config
            };
            setSavedReports(prev => [...prev, newReport]);
        }
    };

    const handleLoadReport = (saved: SavedReport) => {
        // We load the EXACT ID so that edits can be saved back to it
        const config: ReportConfig = { 
            ...saved.config, 
            id: saved.id, 
            name: saved.name 
        }; 
        setActiveReports(prev => [...prev, config]);
        setIsManageModalOpen(false);
    };

    const handleDeleteSavedReport = (id: string) => {
        if (confirm("Permanently delete this saved report?")) {
            setSavedReports(prev => prev.filter(r => r.id !== id));
        }
    };

    const openCreateModal = () => {
        setEditingConfig(undefined);
        setIsManageModalOpen(false); // Close manage modal when creating new
        setIsConfigModalOpen(true);
    };

    const openEditConfigFromManage = (report: SavedReport) => {
        // Load the config into the editor, but keep the Manage modal "conceptually" parent
        // In practice we close manage, open editor. Saving in editor updates state.
        setEditingConfig({ ...report.config, id: report.id, name: report.name });
        setIsManageModalOpen(false);
        setIsConfigModalOpen(true);
    }

    const openManageReportsModal = () => {
        setIsManageModalOpen(true);
        setRenamingId(null);
    };

    // Renaming Logic
    const startRenaming = (report: SavedReport) => {
        setRenamingId(report.id);
        setRenameValue(report.name);
    };

    const saveRename = () => {
        if (renamingId && renameValue.trim()) {
            setSavedReports(prev => prev.map(r => 
                r.id === renamingId 
                    ? { ...r, name: renameValue.trim(), config: { ...r.config, name: renameValue.trim() } } 
                    : r
            ));
        }
        setRenamingId(null);
        setRenameValue('');
    };

    const cancelRename = () => {
        setRenamingId(null);
        setRenameValue('');
    };

    // Date Range Handlers
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

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Optional: Hide the ghost image if desired, or let browser handle it
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault(); // Necessary to allow dropping
        if (draggedIndex === null || draggedIndex === index) return;

        // Perform visual swap in state
        setActiveReports(prev => {
            const newReports = [...prev];
            const draggedItem = newReports[draggedIndex];
            // Remove from old position
            newReports.splice(draggedIndex, 1);
            // Insert at new position
            newReports.splice(index, 0, draggedItem);
            return newReports;
        });
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
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
                        onClick={openManageReportsModal}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
                    >
                        <FolderIcon className="w-5 h-5 text-indigo-600" /> Manage Reports
                    </button>
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
                        <p className="text-slate-500 mb-8 max-w-md text-center">Open saved reports from your library or create a new one to start analyzing.</p>
                        <div className="flex gap-4">
                            <button 
                                onClick={openManageReportsModal}
                                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-2"
                            >
                                <FolderIcon className="w-5 h-5" />
                                Manage Reports
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex gap-4 px-4 pt-6 pb-4 min-w-full w-max">
                        {activeReports.map((config, index) => (
                            <div 
                                key={config.id} // Stable ID for DnD
                                className={`w-[380px] md:w-[450px] h-full flex flex-col relative group transition-opacity duration-200 ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
                                draggable
                                onDragStart={(e) => {
                                    // Only allow dragging if the handle is the target or inside the handle
                                    if ((e.target as HTMLElement).closest('.report-drag-handle')) {
                                        handleDragStart(e, index);
                                    } else {
                                        e.preventDefault();
                                    }
                                }}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                            >
                                {/* Drag Handle */}
                                <div 
                                    className="report-drag-handle absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 text-white p-1 rounded-full shadow-md hover:bg-slate-700 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                                    title="Drag to reorder"
                                >
                                    <DragHandleIcon className="w-4 h-4" />
                                </div>

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
                                    amazonMetrics={amazonMetrics}
                                    categories={categories}
                                    transactionTypes={transactionTypes}
                                    accounts={accounts}
                                    users={users}
                                    tags={tags}
                                    payees={payees}
                                    onSaveReport={handleSaveReport}
                                    onUpdateReport={(newConfig) => handleUpdateActiveReport(index, newConfig)}
                                    savedDateRanges={savedDateRanges}
                                    onSaveDateRange={handleSaveDateRange}
                                    onDeleteDateRange={handleDeleteDateRange}
                                    savedReports={savedReports}
                                />
                            </div>
                        ))}
                        
                        {activeReports.length < 6 && (
                            <div 
                                onClick={openManageReportsModal}
                                className="w-[100px] h-full border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer transition-all flex-shrink-0"
                            >
                                <AddIcon className="w-8 h-8 mb-2" />
                                <span className="text-sm font-medium">Add</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Config Modal (Create/Edit) */}
            <ReportConfigModal 
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                onSave={handleSaveReport} // Note: This handles both create (add to list) and update (modify list)
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

            {/* Manage Reports Modal */}
            {isManageModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={() => setIsManageModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b bg-slate-50 rounded-t-xl">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Manage Reports</h2>
                                <p className="text-slate-500 text-sm">Open, edit, rename, or delete your saved reports.</p>
                            </div>
                            <button onClick={() => setIsManageModalOpen(false)} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><CloseIcon className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                            
                            {/* Create New Button */}
                            <button 
                                onClick={openCreateModal}
                                className="w-full flex items-center justify-between p-4 bg-white border-2 border-dashed border-indigo-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <AddIcon className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-indigo-900">Create New Report</h3>
                                        <p className="text-sm text-indigo-700">Start from scratch</p>
                                    </div>
                                </div>
                                <span className="text-indigo-600 font-bold text-sm">Start &rarr;</span>
                            </button>

                            <div className="border-t border-slate-200 my-2"></div>

                            {/* Saved List */}
                            {savedReports.length === 0 ? (
                                <div className="text-center py-8">
                                    <DocumentIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500">No saved reports yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {savedReports.map(report => (
                                        <div key={report.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                            
                                            {/* Report Name / Rename Input */}
                                            <div className="flex-grow flex flex-col justify-center min-w-0 pr-4">
                                                {renamingId === report.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={renameValue} 
                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                            className="flex-grow p-1 border rounded text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveRename();
                                                                if (e.key === 'Escape') cancelRename();
                                                            }}
                                                        />
                                                        <button onClick={saveRename} className="p-1 text-green-600 hover:bg-green-50 rounded"><CheckCircleIcon className="w-5 h-5"/></button>
                                                        <button onClick={cancelRename} className="p-1 text-red-500 hover:bg-red-50 rounded"><CloseIcon className="w-5 h-5"/></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 group/name cursor-pointer" onClick={() => handleLoadReport(report)}>
                                                        <h3 className="font-bold text-slate-700 group-hover/name:text-indigo-700 transition-colors truncate">{report.name}</h3>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); startRenaming(report); }}
                                                            className="text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                            title="Rename Report"
                                                        >
                                                            <EditIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 cursor-pointer" onClick={() => handleLoadReport(report)}>
                                                    <span className={`bg-slate-100 px-2 py-0.5 rounded capitalize ${report.config.dataSource === 'amazon' ? 'text-orange-700 bg-orange-100' : ''}`}>
                                                        {report.config.dataSource === 'amazon' ? 'Amazon' : 'Transaction'}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded capitalize">{report.config.groupBy}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {savedDateRanges.find(r => r.id === report.config.datePreset)?.name || 
                                                         (report.config.datePreset === 'custom' ? 'Custom Range' : report.config.datePreset)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 pl-4 border-l border-slate-100">
                                                <button 
                                                    onClick={() => openEditConfigFromManage(report)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50"
                                                    title="Edit Configuration"
                                                >
                                                    <SettingsIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteSavedReport(report.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50"
                                                    title="Delete Report"
                                                >
                                                    <DeleteIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
