
import React, { useState, useEffect } from 'react';
import type { Transaction, TransactionType, Category, Payee, User, Tag, SavedReport, ReportConfig, Account } from '../types';
import ReportColumn from '../components/ReportColumn';
import { AddIcon, DeleteIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface ReportsProps {
  transactions: Transaction[];
  transactionTypes: TransactionType[];
  categories: Category[];
  payees: Payee[];
  users: User[];
  tags: Tag[];
  accounts: Account[];
}

const Reports: React.FC<ReportsProps> = ({ transactions, transactionTypes, categories, payees, users, tags, accounts }) => {
    // State to hold saved reports
    const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
        const saved = localStorage.getItem('saved_reports');
        return saved ? JSON.parse(saved) : [];
    });

    // State to hold active columns (array of configs)
    const [activeColumns, setActiveColumns] = useState<ReportConfig[]>([
        { 
            id: 'col-1', 
            name: 'This Month', 
            datePreset: 'thisMonth', 
            filters: {}, 
            hiddenCategoryIds: [] 
        }
    ]);

    useEffect(() => {
        localStorage.setItem('saved_reports', JSON.stringify(savedReports));
    }, [savedReports]);

    const handleSaveReport = (config: ReportConfig) => {
        const newReport: SavedReport = {
            id: generateUUID(),
            name: config.name,
            config: { ...config } // Clone
        };
        setSavedReports(prev => [...prev, newReport]);
    };

    const handleDeleteReport = (id: string) => {
        if (confirm("Delete this saved report?")) {
            setSavedReports(prev => prev.filter(r => r.id !== id));
        }
    };

    const addColumn = () => {
        if (activeColumns.length >= 3) return;
        setActiveColumns(prev => [...prev, {
            id: generateUUID(),
            name: 'New Report',
            datePreset: 'thisMonth',
            filters: {},
            hiddenCategoryIds: []
        }]);
    };

    const removeColumn = (index: number) => {
        setActiveColumns(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-4 pt-2">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
                    <p className="text-slate-500 mt-1">Compare spending across time periods.</p>
                </div>
                {activeColumns.length < 3 && (
                    <button 
                        onClick={addColumn}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-colors"
                    >
                        <AddIcon className="w-5 h-5" /> Add Column
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="h-full flex gap-4 px-4 pb-4 min-w-full w-max">
                    {activeColumns.map((colConfig, index) => (
                        <div key={colConfig.id} className="w-[350px] md:w-[400px] lg:w-[450px] h-full flex flex-col relative group">
                            {activeColumns.length > 1 && (
                                <button 
                                    onClick={() => removeColumn(index)}
                                    className="absolute -top-3 -right-2 bg-red-100 text-red-600 p-1 rounded-full shadow-sm hover:bg-red-200 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove Column"
                                >
                                    <DeleteIcon className="w-4 h-4" />
                                </button>
                            )}
                            <ReportColumn
                                id={colConfig.id}
                                transactions={transactions}
                                categories={categories}
                                transactionTypes={transactionTypes}
                                accounts={accounts}
                                users={users}
                                savedReports={savedReports}
                                onSaveReport={handleSaveReport}
                                onDeleteReport={handleDeleteReport}
                                initialConfig={colConfig}
                            />
                        </div>
                    ))}
                    
                    {activeColumns.length < 3 && (
                        <div 
                            onClick={addColumn}
                            className="w-[100px] h-full border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer transition-all"
                        >
                            <AddIcon className="w-8 h-8 mb-2" />
                            <span className="text-sm font-medium">Add</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
