
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, Account, Category, BusinessProfile, BusinessInfo, TaxInfo, BusinessDocument, DocumentFolder, TaxYearConfig } from '../types';
import { 
    SendIcon, ShieldCheckIcon, BoxIcon, RobotIcon, ChecklistIcon, 
    CloudArrowUpIcon, DownloadIcon, FileTextIcon, PlusIcon, 
    TrashIcon, CheckCircleIcon, InfoIcon, SparklesIcon,
    PrinterIcon, ExternalLinkIcon, ChevronRightIcon, TableIcon
} from '../components/Icons';
import { askAiAdvisor, analyzeBusinessDocument } from '../services/geminiService';
import { generateUUID } from '../utils';
import FileUpload from '../components/FileUpload';
import { api } from '../services/apiService';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface BusinessAndTaxesProps {
    profile: BusinessProfile;
    onUpdateProfile: (profile: BusinessProfile) => void;
    notes: any[]; 
    onUpdateNotes: (notes: any[]) => void;
    chatSessions: any[];
    onUpdateChatSessions: (sessions: any[]) => void;
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
    documents: BusinessDocument[];
    folders: DocumentFolder[];
    onAddDocument: (doc: BusinessDocument) => void;
    onRemoveDocument: (id: string) => void;
    onCreateFolder: (folder: DocumentFolder) => void;
}

const DEFAULT_CHECKLIST = [
    "Confirm all bank accounts are reconciled",
    "Verify business entity information is correct",
    "Upload all 1099 forms received",
    "Review and categorize all large expenses (> $2500)",
    "Confirm home office deduction details",
    "Verify mileage logs for the year",
    "Gather all payroll reports (if applicable)",
    "Review health insurance premiums paid",
    "Check for any major asset purchases (depreciation)",
    "Confirm estimated tax payments made"
];

const BusinessAndTaxes: React.FC<BusinessAndTaxesProps> = ({ 
    profile, onUpdateProfile, documents, folders, onAddDocument, onRemoveDocument, onCreateFolder, transactions, accounts, categories 
}) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'checklist' | 'documents' | 'export' | 'questionnaire'>('checklist');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isAnalyzingDoc, setIsAnalyzingDoc] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Ensure taxYearConfigs exists
    const taxYearConfigs = profile.taxYearConfigs || [];
    const currentYearConfig = useMemo(() => {
        return taxYearConfigs.find(c => c.year === selectedYear) || {
            year: selectedYear,
            isClosed: false,
            checklist: DEFAULT_CHECKLIST.reduce((acc, item) => ({ ...acc, [item]: false }), {}),
            questionnaire: [
                { id: 'q1', question: 'Did you have any foreign bank accounts?', answer: '', category: 'Foreign Assets' },
                { id: 'q2', question: 'Did you sell any cryptocurrency?', answer: '', category: 'Investments' },
                { id: 'q3', question: 'Did you receive any 1099-K forms?', answer: '', category: 'Income' },
                { id: 'q4', question: 'Did you pay for any health insurance through the business?', answer: '', category: 'Deductions' },
                { id: 'q5', question: 'Did you use a home office for business?', answer: '', category: 'Deductions' },
            ],
            notes: ''
        };
    }, [taxYearConfigs, selectedYear]);

    const updateInfo = (key: keyof BusinessInfo, value: string) => {
        onUpdateProfile({ ...profile, info: { ...profile.info, [key]: value } });
    };

    const updateTax = (key: keyof TaxInfo, value: string) => {
        onUpdateProfile({ ...profile, tax: { ...profile.tax, [key]: value } });
    };

    const toggleChecklistItem = (item: string) => {
        const checklist = (currentYearConfig.checklist || {}) as Record<string, boolean>;
        const newChecklist = { ...checklist, [item]: !checklist[item] };
        const newConfigs = [...taxYearConfigs];
        const index = newConfigs.findIndex(c => c.year === selectedYear);
        
        if (index >= 0) {
            newConfigs[index] = { ...newConfigs[index], checklist: newChecklist };
        } else {
            newConfigs.push({ ...currentYearConfig, checklist: newChecklist });
        }
        
        onUpdateProfile({ ...profile, taxYearConfigs: newConfigs });
    };

    const handleAskAi = async () => {
        if (!aiQuery.trim() || isAiLoading) return;
        setIsAiLoading(true);
        try {
            const context = {
                profile,
                currentYear: selectedYear,
                checklist: currentYearConfig.checklist,
                transactionSummary: transactions.slice(0, 50).map(t => ({ date: t.date, desc: t.description, amt: t.amount }))
            };
            const prompt = `Context: ${JSON.stringify(context)}. User Query: ${aiQuery}`;
            const response = await askAiAdvisor(prompt);
            setAiResponse(response);
        } catch (e) {
            setAiResponse("I encountered an error processing your query.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setIsUploading(true);
        try {
            const files = Array.from(e.target.files);
            for (const file of files) {
                const id = generateUUID();
                await api.uploadFile(id, file);
                const newDoc: BusinessDocument = {
                    id,
                    name: file.name,
                    upload_date: new Date().toISOString(),
                    size: file.size,
                    mime_type: file.type,
                    parentId: selectedYear.toString()
                };
                onUpdateProfile({
                    ...profile,
                    // Note: In a real app, documents would be stored in a separate collection
                    // For now, we'll assume the parent component handles document persistence
                });
                // Since onUpdateProfile might not handle documents directly if they are in a separate table
                // we should ideally have a separate onAddDocument callback.
                // For this demo, we'll just refresh the page or rely on the parent's state.
                window.location.reload(); // Simple way to refresh data from server
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        try {
            await api.deleteFile(id);
            window.location.reload();
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateQuestion = (id: string, answer: string) => {
        const updatedConfigs = [...taxYearConfigs];
        const configIndex = updatedConfigs.findIndex(c => c.year === selectedYear);
        
        const newQuestionnaire = (currentYearConfig.questionnaire || []).map(q => 
            q.id === id ? { ...q, answer } : q
        );

        if (configIndex > -1) {
            updatedConfigs[configIndex] = { ...currentYearConfig, questionnaire: newQuestionnaire };
        } else {
            updatedConfigs.push({ ...currentYearConfig, year: selectedYear, questionnaire: newQuestionnaire });
        }
        
        onUpdateProfile({ ...profile, taxYearConfigs: updatedConfigs });
    };
    const handleAnalyzeDoc = async (doc: BusinessDocument) => {
        setIsAnalyzingDoc(doc.id);
        try {
            const blob = await api.getFile(doc.id);
            const file = new File([blob], doc.name, { type: doc.mime_type });
            const analysis = await analyzeBusinessDocument(file, (msg) => console.log(msg));
            
            const response = `**AI Document Analysis for ${doc.name}:**\n\n` +
                `**Document Type:** ${analysis.documentType}\n` +
                `**Summary:** ${analysis.summary}\n` +
                `**Key Dates:** ${analysis.keyDates?.join(', ') || 'None identified'}\n\n` +
                `**Tax Relevance:** This document appears to be a ${analysis.documentType}. ` +
                `Make sure to include this in your ${selectedYear} tax filing.`;
                
            setAiResponse(response);
            setActiveTab('checklist');
        } catch (e) {
            console.error(e);
            setAiResponse("Failed to analyze document. Please try again.");
        } finally {
            setIsAnalyzingDoc(null);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const title = `${profile.info.llcName || 'Business'} - ${selectedYear} Tax Summary`;
        
        doc.setFontSize(20);
        doc.text(title, 20, 20);
        
        doc.setFontSize(12);
        doc.text(`Entity Type: ${profile.info.businessType || 'N/A'}`, 20, 35);
        doc.text(`Filing Status: ${profile.tax.filingStatus || 'N/A'}`, 20, 42);
        doc.text(`Accountant: ${profile.tax.accountantName || 'N/A'}`, 20, 49);
        
        doc.setFontSize(16);
        doc.text("Financial Summary", 20, 65);
        doc.setFontSize(12);
        doc.text(`Total Income: $${stats.income.toLocaleString()}`, 20, 75);
        doc.text(`Total Expenses: $${stats.expenses.toLocaleString()}`, 20, 82);
        doc.text(`Net Profit/Loss: $${stats.net.toLocaleString()}`, 20, 89);
        
        doc.setFontSize(16);
        doc.text("Tax Readiness Checklist", 20, 105);
        doc.setFontSize(10);
        let y = 115;
        Object.entries(currentYearConfig.checklist).forEach(([item, checked]) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`[${checked ? 'X' : ' '}] ${item}`, 25, y);
            y += 7;
        });

        if (currentYearConfig.questionnaire) {
            doc.addPage();
            doc.setFontSize(16);
            doc.text("Tax Questionnaire", 20, 20);
            doc.setFontSize(10);
            y = 35;
            currentYearConfig.questionnaire.forEach(q => {
                if (y > 260) { doc.addPage(); y = 20; }
                doc.setFont("helvetica", "bold");
                doc.text(q.question, 20, y);
                y += 5;
                doc.setFont("helvetica", "normal");
                doc.text(`Answer: ${q.answer || 'Not answered'}`, 25, y);
                y += 10;
            });
        }
        
        doc.save(`${profile.info.llcName || 'Business'}_Tax_Summary_${selectedYear}.pdf`);
    };

    const handleExportExcel = () => {
        const yearTransactions = transactions.filter(t => t.date.startsWith(selectedYear.toString()));
        const data = yearTransactions.map(t => ({
            Date: t.date,
            Description: t.description,
            Amount: t.amount,
            Category: categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized',
            Account: accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
            Notes: t.notes || ''
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, `${profile.info.llcName || 'Business'}_Transactions_${selectedYear}.xlsx`);
    };

    const handleAddYear = () => {
        const nextYear = Math.max(...[2023, 2024, 2025, 2026, ...taxYearConfigs.map(c => c.year)]) + 1;
        setSelectedYear(nextYear);
    };

    const yearDocuments = useMemo(() => {
        // Filter documents by year if they have a year in name or upload date
        return documents.filter(doc => doc.upload_date.startsWith(selectedYear.toString()) || doc.name.includes(selectedYear.toString()) || doc.parentId === selectedYear.toString());
    }, [documents, selectedYear]);

    const stats = useMemo(() => {
        const yearTransactions = transactions.filter(t => t.date.startsWith(selectedYear.toString()));
        const income = yearTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expenses = yearTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return { income, expenses, net: income - expenses };
    }, [transactions, selectedYear]);

    return (
        <div className="h-full flex flex-col gap-6 relative animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Business and Taxes</h1>
                    <p className="text-sm text-slate-500 font-medium">Strategic Tax Planning & Compliance Hub.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    {[2023, 2024, 2025, 2026, ...taxYearConfigs.map(c => c.year)].filter((v, i, a) => a.indexOf(v) === i).sort().map(year => (
                        <button 
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${selectedYear === year ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                        >
                            {year}
                        </button>
                    ))}
                    <button 
                        onClick={handleAddYear}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
                        title="Add Year"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex gap-1 bg-slate-200/50 p-1 rounded-2xl w-fit">
                {[
                    { id: 'checklist', label: 'Tax Readiness', icon: ChecklistIcon },
                    { id: 'questionnaire', label: 'Questionnaire', icon: InfoIcon },
                    { id: 'documents', label: 'Document Vault', icon: CloudArrowUpIcon },
                    { id: 'profile', label: 'Entity Profile', icon: ShieldCheckIcon },
                    { id: 'export', label: 'Accountant Export', icon: DownloadIcon },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden pb-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                    <div className="lg:col-span-2 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                        {activeTab === 'checklist' && (
                            <div className="space-y-6">
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-8">
                                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                            <ChecklistIcon className="w-6 h-6 text-indigo-600" /> 
                                            {selectedYear} Readiness Checklist
                                        </h2>
                                        <div className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            {Object.values(currentYearConfig.checklist).filter(Boolean).length} / {Object.keys(currentYearConfig.checklist).length} Complete
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {Object.entries(currentYearConfig.checklist).map(([item, checked]) => (
                                            <div 
                                                key={item} 
                                                onClick={() => toggleChecklistItem(item)}
                                                className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${checked ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
                                            >
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${checked ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-slate-200 text-transparent group-hover:border-indigo-300'}`}>
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                </div>
                                                <span className={`text-sm font-bold flex-1 ${checked ? 'text-emerald-800 line-through opacity-60' : 'text-slate-700'}`}>{item}</span>
                                                <ChevronRightIcon className={`w-4 h-4 transition-all ${checked ? 'text-emerald-300' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Income</p>
                                        <p className="text-2xl font-black text-slate-800">${stats.income.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Expenses</p>
                                        <p className="text-2xl font-black text-slate-800">${stats.expenses.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Profit/Loss</p>
                                        <p className={`text-2xl font-black ${stats.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>${stats.net.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'questionnaire' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                            <InfoIcon className="w-6 h-6 text-indigo-600" /> 
                                            {selectedYear} Tax Questionnaire
                                        </h2>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Helps your accountant identify deductions
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-6">
                                        {(currentYearConfig.questionnaire || []).map((q) => (
                                            <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 hover:border-indigo-200 transition-all">
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div>
                                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg mb-2 inline-block">
                                                            {q.category}
                                                        </span>
                                                        <h4 className="text-sm font-bold text-slate-800">{q.question}</h4>
                                                    </div>
                                                </div>
                                                <textarea 
                                                    value={q.answer}
                                                    onChange={(e) => handleUpdateQuestion(q.id, e.target.value)}
                                                    placeholder="Type your answer here..."
                                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[80px]"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                        <CloudArrowUpIcon className="w-6 h-6 text-indigo-600" /> 
                                        {selectedYear} Document Vault
                                    </h2>
                                    <label className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer">
                                        <PlusIcon className="w-5 h-5" />
                                        <input type="file" multiple className="hidden" onChange={handleUploadFiles} disabled={isUploading} />
                                    </label>
                                </div>

                                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-4 bg-slate-50/50">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                                        <CloudArrowUpIcon className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">Drop tax documents here</p>
                                        <p className="text-xs text-slate-500">W2s, 1099s, Receipts, or Bank Statements</p>
                                    </div>
                                    <label className="px-6 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-black rounded-xl hover:bg-slate-50 transition-all shadow-sm cursor-pointer inline-block">
                                        Browse Files
                                        <input type="file" multiple className="hidden" onChange={handleUploadFiles} disabled={isUploading} />
                                    </label>
                                </div>

                                <div className="space-y-3">
                                    {yearDocuments.length > 0 ? (
                                        yearDocuments.map(doc => (
                                            <div key={doc.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600">
                                                    <FileTextIcon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{doc.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{new Date(doc.upload_date).toLocaleDateString()} • {(doc.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => handleAnalyzeDoc(doc)}
                                                        disabled={isAnalyzingDoc === doc.id}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                                                        title="AI Analysis"
                                                    >
                                                        {isAnalyzingDoc === doc.id ? <div className="w-4 h-4 border-2 border-t-indigo-600 rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteDoc(doc.id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center">
                                            <p className="text-sm text-slate-400 italic">No documents uploaded for {selectedYear} yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><ShieldCheckIcon className="w-6 h-6 text-indigo-600" /> Legal Entity</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Name</label>
                                            <input type="text" value={profile.info.llcName || ''} onChange={e => updateInfo('llcName', e.target.value)} className="w-full font-bold" placeholder="e.g. Acme Corp LLC" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Structure</label>
                                            <select value={profile.info.businessType || ''} onChange={e => updateInfo('businessType', e.target.value)} className="w-full font-bold">
                                                <option value="">Select...</option>
                                                <option value="sole-prop">Sole Prop</option>
                                                <option value="single-llc">SMLLC</option>
                                                <option value="multi-llc">Multi-LLC</option>
                                                <option value="s-corp">S-Corp</option>
                                                <option value="c-corp">C-Corp</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><BoxIcon className="w-6 h-6 text-emerald-600" /> Tax Profile</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filing Status</label>
                                            <select value={profile.tax.filingStatus || ''} onChange={e => updateTax('filingStatus', e.target.value)} className="w-full font-bold">
                                                <option value="">Select...</option>
                                                <option value="individual">Individual / Single Member</option>
                                                <option value="partnership">Partnership</option>
                                                <option value="s-corp">S-Corp Election</option>
                                                <option value="c-corp">C-Corp</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Accountant Name</label>
                                            <input type="text" value={profile.tax.accountantName || ''} onChange={e => updateTax('accountantName', e.target.value)} className="w-full font-bold" placeholder="e.g. John Doe, CPA" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'export' && (
                            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                        <DownloadIcon className="w-6 h-6 text-indigo-600" /> 
                                        Accountant Export
                                    </h2>
                                </div>
                                
                                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-start gap-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
                                        <InfoIcon className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-indigo-900">Ready to file?</p>
                                        <p className="text-xs text-indigo-700 leading-relaxed">
                                            This tool will generate a comprehensive financial summary for {selectedYear}, including P&L statements, categorized expenses, and a list of all uploaded documents.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button 
                                        onClick={handleExportPDF}
                                        className="flex flex-col items-center justify-center gap-4 p-8 bg-slate-50 border border-slate-200 rounded-3xl hover:bg-white hover:border-indigo-400 hover:shadow-lg transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                                            <PrinterIcon className="w-6 h-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-black text-slate-800">Generate PDF Report</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Professional Summary</p>
                                        </div>
                                    </button>
                                    <button 
                                        onClick={handleExportExcel}
                                        className="flex flex-col items-center justify-center gap-4 p-8 bg-slate-50 border border-slate-200 rounded-3xl hover:bg-white hover:border-emerald-400 hover:shadow-lg transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-emerald-600 transition-colors">
                                            <TableIcon className="w-6 h-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-black text-slate-800">Export to Excel</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Raw Data for Accountant</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col gap-6 relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full -mr-32 -mt-32" />
                        <div className="relative z-10 flex flex-col h-full">
                            <h3 className="font-black uppercase tracking-tight flex items-center gap-2 mb-4"><RobotIcon className="w-6 h-6 text-indigo-400" /> Tax Advisor</h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 text-sm leading-relaxed text-slate-300 bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                                {aiResponse ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <div dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>') }} />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="italic text-slate-500">I can help you with:</p>
                                        <ul className="space-y-2 text-xs text-slate-400">
                                            <li className="flex items-center gap-2"><SparklesIcon className="w-3 h-3 text-indigo-400" /> Identifying potential deductions</li>
                                            <li className="flex items-center gap-2"><SparklesIcon className="w-3 h-3 text-indigo-400" /> Explaining tax deadlines</li>
                                            <li className="flex items-center gap-2"><SparklesIcon className="w-3 h-3 text-indigo-400" /> Analyzing uploaded documents</li>
                                            <li className="flex items-center gap-2"><SparklesIcon className="w-3 h-3 text-indigo-400" /> Strategy for {profile.info.businessType || 'your business'}</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                <textarea 
                                    value={aiQuery} 
                                    onChange={e => setAiQuery(e.target.value)} 
                                    className="w-full bg-white/5 border-white/10 text-white rounded-xl text-xs p-3 focus:border-indigo-500 transition-all placeholder:text-slate-600 min-h-[100px] resize-none" 
                                    placeholder="e.g. What are the home office deduction rules for S-Corps?" 
                                />
                                <button 
                                    onClick={handleAskAi} 
                                    disabled={isAiLoading || !aiQuery.trim()} 
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-30 transition-all active:scale-95"
                                >
                                    {isAiLoading ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin"></div> : <SendIcon className="w-4 h-4" />} Consult Advisor
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessAndTaxes;
