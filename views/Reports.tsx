import React, { useState, useMemo } from 'react';
import type { Transaction, TransactionType, Category, Counterparty, User, Tag, SavedReport, ReportConfig, Account, CustomDateRange, AmazonMetric, YouTubeMetric } from '../types';
import ReportColumn from '../components/ReportColumn';
import ReportConfigModal from '../components/ReportConfigModal';
import { AddIcon, ChartPieIcon, DocumentIcon, SearchCircleIcon, BoxIcon, YoutubeIcon, TrendingUpIcon, BarChartIcon, CloseIcon, ShieldCheckIcon } from '../components/Icons';

interface ReportsProps {
  transactions: Transaction[];
  transactionTypes: TransactionType[];
  categories: Category[];
  counterparties: Counterparty[];
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

const Reports: React.FC<ReportsProps> = ({ transactions, transactionTypes, categories, counterparties, users, tags, accounts, savedReports, setSavedReports, savedDateRanges, setSavedDateRanges, amazonMetrics, youtubeMetrics, onSaveReport }) => {
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
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [savedReports, selectedType, searchTerm]);

    const activeReport = useMemo(() => savedReports.find(r => r.id === activeReportId), [savedReports, activeReportId]);

    const handleSaveConfig = (config: ReportConfig) => {
        const report: SavedReport = { id: config.id, name: config.name, config };
        onSaveReport(report);
        setActiveReportId(report.id);
        setIsConfigModalOpen(false);
        setIsCreating(false);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Strategy Canvas</h1>
                    <p className="text-sm text-slate-500">Visualization engines for growth auditing and asset allocation.</p>
                </div>
                <button onClick={() => { setIsConfigModalOpen(true); setIsCreating(true); setActiveReportId(null); }} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                    <AddIcon className="w-5 h-5" /> New Analysis
                </button>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden pb-10">
                {/* COLUMN 1: TAXONOMY */}
                <div className="w-64 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 flex-shrink-0 min-h-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Report Taxonomy</p>
                    <div className="space-y-1">
                        {[
                            { id: 'all', label: 'Global View', icon: <ChartPieIcon className="w-4 h-4" /> },
                            { id: 'financial', label: 'Cash Flow', icon: <TrendingUpIcon className="w-4 h-4 text-emerald-500" /> },
                            { id: 'amazon', label: 'Affiliate ROI', icon: <BoxIcon className="w-4 h-4 text-orange-500" /> },
                            { id: 'youtube', label: 'Creator Yield', icon: <YoutubeIcon className="w-4 h-4 text-red-600" /> }
                        ].map(t => (
                            <button key={t.id} onClick={() => setSelectedType(t.id as any)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedType === t.id ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* COLUMN 2: SAVED LIST */}
                <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                    <div className="p-3 border-b bg-slate-50 rounded-t-2xl">
                        <div className="relative">
                            <input type="text" placeholder="Search strategies..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:ring-1 focus:ring-indigo-500 outline-none shadow-inner" />
                            <SearchCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-white/50">
                        {filteredReports.length === 0 ? (
                            <div className="p-16 text-center text-slate-300 flex flex-col items-center">
                                <DocumentIcon className="w-12 h-12 mb-4 opacity-5" />
                                <p className="text-[10px] font-black uppercase tracking-tighter">No blueprints</p>
                            </div>
                        ) : (
                            filteredReports.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => { setActiveReportId(r.id); setIsCreating(false); }} 
                                    className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-1 ${activeReportId === r.id ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <h4 className={`text-sm font-black tracking-tight truncate ${activeReportId === r.id ? 'text-indigo-900' : 'text-slate-700'}`}>{r.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{r.config.dataSource || 'financial'}</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">{r.config.groupBy} level</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* COLUMN 3: ENGINE */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 relative">
                    {activeReportId && activeReport ? (
                        <div className="flex flex-col h-full animate-fade-in bg-white">
                            <ReportColumn
                                config={activeReport.config}
                                transactions={transactions}
                                categories={categories}
                                transactionTypes={transactionTypes}
                                accounts={accounts}
                                users={users}
                                tags={tags}
                                payees={counterparties}
                                onSaveReport={(c) => handleSaveConfig(c)}
                                onUpdateReport={(c) => handleSaveConfig(c)}
                                savedDateRanges={savedDateRanges}
                                onSaveDateRange={(r) => setSavedDateRanges([...savedDateRanges, r])}
                                onDeleteDateRange={(id) => setSavedDateRanges(savedDateRanges.filter(r => r.id !== id))}
                                amazonMetrics={amazonMetrics}
                                youtubeMetrics={youtubeMetrics}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-100 mb-8 animate-bounce-subtle">
                                <BarChartIcon className="w-12 h-12 text-indigo-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Blueprints Dashboard</h3>
                            <p className="text-slate-400 text-sm mt-4 font-medium max-w-sm leading-relaxed">Select a saved visualization strategy from the stack to audit institutional performance or construct a new analytic lens using the forge.</p>
                            <div className="mt-12 grid grid-cols-3 gap-6 max-w-xl w-full">
                                <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3 group hover:border-indigo-300 transition-all cursor-pointer" onClick={() => { setIsConfigModalOpen(true); setIsCreating(true); }}>
                                    <ChartPieIcon className="w-8 h-8 text-indigo-300 group-hover:text-indigo-600 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Composition</span>
                                </div>
                                <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3 group hover:border-emerald-300 transition-all cursor-pointer" onClick={() => { setIsConfigModalOpen(true); setIsCreating(true); }}>
                                    <TrendingUpIcon className="w-8 h-8 text-emerald-300 group-hover:text-emerald-600 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trendline</span>
                                </div>
                                <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3 group hover:border-indigo-300 transition-all cursor-pointer" onClick={() => { setIsConfigModalOpen(true); setIsCreating(true); }}>
                                    <ShieldCheckIcon className="w-8 h-8 text-indigo-300 group-hover:text-indigo-600 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Yield Audit</span>
                                </div>
                            </div>
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
                payees={counterparties}
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