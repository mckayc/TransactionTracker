import React, { useState, useMemo } from 'react';
import type { Transaction, TransactionType, Category, Payee, User, Tag, SavedReport, ReportConfig, Account, CustomDateRange, AmazonMetric, YouTubeMetric } from '../types';
import ReportColumn from '../components/ReportColumn';
import ReportConfigModal from '../components/ReportConfigModal';
import { AddIcon, DeleteIcon, EditIcon, ChartPieIcon, CloseIcon, DocumentIcon, FolderIcon, CheckCircleIcon, SettingsIcon, DragHandleIcon, SearchCircleIcon, BoxIcon, YoutubeIcon, DollarSign, TrendingUpIcon } from '../components/Icons';
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
  amazonMetrics: AmazonMetric[];
  youtubeMetrics: YouTubeMetric[];
  onSaveReport: (report: SavedReport) => void;
}

const Reports: React.FC<ReportsProps> = ({ transactions, transactionTypes, categories, payees, users, tags, accounts, savedReports, setSavedReports, savedDateRanges, setSavedDateRanges, amazonMetrics, youtubeMetrics, onSaveReport }) => {
    const [selectedType, setSelectedType] = useState<'financial' | 'amazon' | 'youtube' | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const filteredReports = useMemo(() => {
        return savedReports.filter(r => {
            const matchesType = selectedType === 'all' || (r.config.dataSource || 'financial') === selectedType;
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [savedReports, selectedType, searchTerm]);

    const activeReport = useMemo(() => savedReports.find(r => r.id === activeReportId), [savedReports, activeReportId]);

    const handleSaveConfig = (config: ReportConfig) => {
        const report: SavedReport = {
            id: config.id,
            name: config.name,
            config
        };
        onSaveReport(report);
        setActiveReportId(report.id);
        setIsConfigModalOpen(false);
        setIsCreating(false);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Intelligence Reports</h1>
                    <p className="text-sm text-slate-500">Visualization engines for cash flow and growth.</p>
                </div>
                <button onClick={() => { setIsConfigModalOpen(true); setIsCreating(true); setActiveReportId(null); }} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <AddIcon className="w-5 h-5" /> New Report
                </button>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* LEFT: TYPES */}
                <div className="w-64 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 flex-shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Report Class</p>
                    <div className="space-y-1">
                        {[
                            { id: 'all', label: 'Everything', icon: <ChartPieIcon className="w-4 h-4" /> },
                            { id: 'financial', label: 'Cash Flow', icon: <TrendingUpIcon className="w-4 h-4 text-emerald-500" /> },
                            { id: 'amazon', label: 'Amazon Affiliate', icon: <BoxIcon className="w-4 h-4 text-orange-500" /> },
                            { id: 'youtube', label: 'YouTube Ads', icon: <YoutubeIcon className="w-4 h-4 text-red-600" /> }
                        ].map(t => (
                            <button key={t.id} onClick={() => setSelectedType(t.id as any)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedType === t.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* MIDDLE: LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b">
                        <div className="relative">
                            <input type="text" placeholder="Search saved..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border rounded-xl text-xs focus:bg-white outline-none" />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredReports.length === 0 ? (
                            <div className="p-10 text-center text-slate-300 flex flex-col items-center">
                                <DocumentIcon className="w-10 h-10 mb-2 opacity-10" />
                                <p className="text-[11px] font-bold">No reports yet.</p>
                            </div>
                        ) : (
                            filteredReports.map(r => (
                                <div key={r.id} onClick={() => { setActiveReportId(r.id); setIsCreating(false); }} className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-1 ${activeReportId === r.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                    <h4 className={`text-sm font-bold truncate pr-2 ${activeReportId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</h4>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{r.config.dataSource || 'financial'}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: EDITOR/VIEWER */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 relative">
                    {activeReportId && activeReport ? (
                        <ReportColumn
                            config={activeReport.config}
                            transactions={transactions}
                            categories={categories}
                            transactionTypes={transactionTypes}
                            accounts={accounts}
                            users={users}
                            tags={tags}
                            payees={payees}
                            onSaveReport={(c) => handleSaveConfig(c)}
                            onUpdateReport={(c) => handleSaveConfig(c)}
                            savedDateRanges={savedDateRanges}
                            onSaveDateRange={(r) => setSavedDateRanges([...savedDateRanges, r])}
                            onDeleteDateRange={(id) => setSavedDateRanges(savedDateRanges.filter(r => r.id !== id))}
                            amazonMetrics={amazonMetrics}
                            youtubeMetrics={youtubeMetrics}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 mb-6">
                                <ChartPieIcon className="w-10 h-10 text-indigo-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Report Viewer</h3>
                            <p className="text-slate-400 text-sm mt-3 font-medium max-w-xs">Select a saved report to visualize your data or create a new strategy.</p>
                        </div>
                    )}
                </div>
            </div>

            <ReportConfigModal 
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                onSave={handleSaveConfig}
                initialConfig={activeReport?.config}
                accounts={accounts}
                categories={categories}
                users={users}
                transactionTypes={transactionTypes}
                tags={tags}
                payees={payees}
                savedDateRanges={savedDateRanges}
                onSaveDateRange={(r) => setSavedDateRanges([...savedDateRanges, r])}
                onDeleteDateRange={(id) => setSavedDateRanges(savedDateRanges.filter(r => r.id !== id))}
                transactions={transactions}
                amazonMetrics={amazonMetrics}
            />
        </div>
    );
};

export default Reports;