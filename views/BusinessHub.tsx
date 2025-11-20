
import React, { useState, useRef } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo, BusinessDocument, DocumentFolder } from '../types';
import { CheckCircleIcon, SparklesIcon, DocumentIcon, CloudArrowUpIcon, LightBulbIcon, DeleteIcon, CurrencyDollarIcon, SendIcon, ExclamationTriangleIcon, AddIcon } from '../components/Icons';
import { analyzeBusinessDocument, askAiAdvisor, getIndustryDeductions, hasApiKey } from '../services/geminiService';
import { saveFile, deleteFile, getFile } from '../services/storageService';
import { generateUUID } from '../utils';

interface BusinessHubProps {
    profile: BusinessProfile;
    documents: BusinessDocument[];
    folders: DocumentFolder[];
    onUpdateProfile: (profile: BusinessProfile) => void;
    onAddDocument: (doc: BusinessDocument) => void;
    onRemoveDocument: (docId: string) => void;
    onCreateFolder: (folder: DocumentFolder) => void;
    onDeleteFolder: (folderId: string) => void;
}

const FolderIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 20.25V9" />
    </svg>
);

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-3.75-3.75M12 12.75l3.75-3.75M12 12.75V3" />
    </svg>
);

// ... (SetupGuideTab, TaxAdvisorTab, CalendarTab components remain unchanged) ...
const SetupGuideTab: React.FC<{ profile: BusinessProfile; onUpdateProfile: (p: BusinessProfile) => void }> = ({ profile, onUpdateProfile }) => {
    const updateInfo = (key: keyof BusinessInfo, value: any) => {
        onUpdateProfile({
            ...profile,
            info: { ...profile.info, [key]: value }
        });
    };

    const updateTax = (key: keyof TaxInfo, value: any) => {
        onUpdateProfile({
            ...profile,
            tax: { ...profile.tax, [key]: value }
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <CheckCircleIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Business Structure</h2>
                </div>
                
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Legal Business Name</label>
                        <input 
                            type="text" 
                            value={profile.info.llcName || ''} 
                            onChange={(e) => updateInfo('llcName', e.target.value)}
                            placeholder="My Business LLC"
                            className="w-full p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Industry / Activity</label>
                        <input 
                            type="text" 
                            value={profile.info.industry || ''} 
                            onChange={(e) => updateInfo('industry', e.target.value)}
                            placeholder="e.g. Graphic Design, Software"
                            className="w-full p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
                            <select 
                                value={profile.info.businessType || ''} 
                                onChange={(e) => updateInfo('businessType', e.target.value)}
                                className="w-full p-2 border rounded-md"
                            >
                                <option value="">Select...</option>
                                <option value="sole-proprietor">Sole Proprietor</option>
                                <option value="llc-single">Single-Member LLC</option>
                                <option value="llc-multi">Multi-Member LLC</option>
                                <option value="s-corp">S-Corp</option>
                                <option value="c-corp">C-Corp</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                            <input 
                                type="text" 
                                value={profile.info.stateOfFormation || ''} 
                                onChange={(e) => updateInfo('stateOfFormation', e.target.value)}
                                placeholder="e.g. DE"
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">EIN (Tax ID)</label>
                        <input 
                            type="text" 
                            value={profile.info.ein || ''} 
                            onChange={(e) => updateInfo('ein', e.target.value)}
                            placeholder="XX-XXXXXXX"
                            className="w-full p-2 border rounded-md"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Formation Date</label>
                        <input 
                            type="date" 
                            value={profile.info.formationDate || ''} 
                            onChange={(e) => updateInfo('formationDate', e.target.value)}
                            className="w-full p-2 border rounded-md"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                    <div className="bg-green-100 p-2 rounded-lg">
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Tax Settings</h2>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tax Filing Status</label>
                        <select 
                            value={profile.tax.filingStatus || ''} 
                            onChange={(e) => updateTax('filingStatus', e.target.value)}
                            className="w-full p-2 border rounded-md"
                        >
                            <option value="">Select Status...</option>
                            <option value="sole-proprietor">Sole Proprietor (Schedule C)</option>
                            <option value="partnership">Partnership (Form 1065)</option>
                            <option value="s-corp">S-Corporation (Form 1120-S)</option>
                            <option value="c-corp">C-Corporation (Form 1120)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tax Year End</label>
                        <input 
                            type="date" 
                            value={profile.tax.taxYearEnd || ''} 
                            onChange={(e) => updateTax('taxYearEnd', e.target.value)}
                            className="w-full p-2 border rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Accountant Contact</label>
                        <input 
                            type="text" 
                            value={profile.tax.accountantName || ''} 
                            onChange={(e) => updateTax('accountantName', e.target.value)}
                            placeholder="Name or Email"
                            className="w-full p-2 border rounded-md"
                        />
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                    <p className="font-semibold mb-1">Pro Tip:</p>
                    <p>Keep your EIN letter and Articles of Organization handy. You'll need them for opening bank accounts and applying for credit.</p>
                </div>
            </div>
        </div>
    );
}

const DocumentsTab: React.FC<{ 
    documents: BusinessDocument[]; 
    folders: DocumentFolder[];
    onAddDocument: (doc: BusinessDocument) => void;
    onRemoveDocument: (id: string) => void;
    onCreateFolder: (folder: DocumentFolder) => void;
    onDeleteFolder: (id: string) => void;
}> = ({ documents, folders, onAddDocument, onRemoveDocument, onCreateFolder, onDeleteFolder }) => {
    const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const apiKeyAvailable = hasApiKey();

    const currentPath = React.useMemo(() => {
        const path = [];
        let current = folders.find(f => f.id === currentFolderId);
        while (current) {
            path.unshift(current);
            current = folders.find(f => f.id === current?.parentId);
        }
        return path;
    }, [folders, currentFolderId]);

    const visibleDocuments = documents.filter(doc => doc.parentId === currentFolderId);
    const visibleFolders = folders.filter(f => f.parentId === currentFolderId);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const docId = generateUUID();
            
            // 1. Save file content to Server
            await saveFile(docId, file);

            let analysis = undefined;
            // 2. Analyze with AI only if API key is present AND it's not a JSON backup
            if (apiKeyAvailable && file.type !== 'application/json') {
                try {
                    analysis = await analyzeBusinessDocument(file, (msg) => console.log(msg));
                } catch (aiError) {
                    console.warn("AI analysis failed, saving document without insights.", aiError);
                }
            }

            // 3. Save metadata
            const newDoc: BusinessDocument = {
                id: docId,
                name: file.name,
                uploadDate: new Date().toISOString().split('T')[0],
                size: file.size,
                mimeType: file.type,
                parentId: currentFolderId,
                aiAnalysis: analysis
            };
            onAddDocument(newDoc);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload document.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    
    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        const folder: DocumentFolder = {
            id: generateUUID(),
            name: newFolderName.trim(),
            parentId: currentFolderId,
            createdAt: new Date().toISOString()
        };
        onCreateFolder(folder);
        setNewFolderName('');
        setIsCreatingFolder(false);
    };

    const handleDelete = async (docId: string) => {
        if(confirm('Delete this document? This cannot be undone.')) {
            await deleteFile(docId);
            onRemoveDocument(docId);
        }
    }

    const handleDownload = async (doc: BusinessDocument) => {
        const storedFile = await getFile(doc.id);
        if (storedFile) {
            const url = window.URL.createObjectURL(storedFile.fileData);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', storedFile.name);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } else {
            alert("File content not found on server.");
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 overflow-x-auto">
                    <button 
                        onClick={() => setCurrentFolderId(undefined)} 
                        className={`hover:text-indigo-600 font-medium ${!currentFolderId ? 'text-slate-800' : ''}`}
                    >
                        Home
                    </button>
                    {currentPath.map(folder => (
                        <React.Fragment key={folder.id}>
                            <span>/</span>
                            <button 
                                onClick={() => setCurrentFolderId(folder.id)}
                                className={`hover:text-indigo-600 font-medium ${currentFolderId === folder.id ? 'text-slate-800' : ''}`}
                            >
                                {folder.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsCreatingFolder(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <AddIcon className="w-5 h-5" />
                        <span>New Folder</span>
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors"
                    >
                        <CloudArrowUpIcon className="w-5 h-5" />
                        <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileUpload}
                    />
                </div>
            </div>
            
            {isCreatingFolder && (
                <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <FolderIcon className="w-6 h-6 text-slate-400" />
                    <input 
                        type="text" 
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder Name"
                        className="flex-grow p-2 border rounded-md"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder();
                            if (e.key === 'Escape') setIsCreatingFolder(false);
                        }}
                    />
                    <button onClick={handleCreateFolder} className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Create</button>
                    <button onClick={() => setIsCreatingFolder(false)} className="px-3 py-2 text-slate-500 hover:bg-slate-200 rounded-md">Cancel</button>
                </div>
            )}

            {!apiKeyAvailable && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">AI Analysis Disabled</p>
                        <p className="text-sm text-amber-700">Because the API_KEY environment variable is missing, documents will be stored but not analyzed for insights.</p>
                    </div>
                </div>
            )}

            {visibleDocuments.length === 0 && visibleFolders.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <DocumentIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">This folder is empty.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Folders */}
                    {visibleFolders.map(folder => (
                        <div 
                            key={folder.id} 
                            className="bg-white p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between group"
                            onClick={() => setCurrentFolderId(folder.id)}
                        >
                            <div className="flex items-center gap-3">
                                <FolderIcon className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                <span className="font-medium text-slate-700 truncate max-w-[150px]">{folder.name}</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} 
                                className="p-2 text-slate-300 hover:text-red-500 rounded-full hover:bg-slate-100"
                            >
                                <DeleteIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    {/* Files */}
                    {visibleDocuments.map(doc => (
                        <div key={doc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                            <div className="p-4 flex items-start justify-between bg-slate-50 border-b">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <DocumentIcon className="w-8 h-8 text-indigo-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-800 truncate" title={doc.name}>{doc.name}</h3>
                                        <p className="text-xs text-slate-500">{doc.uploadDate} • {(doc.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex">
                                    <button onClick={() => handleDownload(doc)} className="p-1 text-slate-400 hover:text-indigo-600" title="Download">
                                        <DownloadIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(doc.id)} className="p-1 text-slate-400 hover:text-red-500" title="Delete">
                                        <DeleteIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 space-y-2 flex-grow">
                                {doc.aiAnalysis ? (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-1 rounded inline-block">{doc.aiAnalysis.documentType}</p>
                                        <p className="text-xs text-slate-600 line-clamp-3">{doc.aiAnalysis.summary}</p>
                                        {doc.aiAnalysis.keyDates && doc.aiAnalysis.keyDates.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {doc.aiAnalysis.keyDates.map((date, i) => (
                                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                                                        {date}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic mt-2">No AI analysis available.</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const TaxAdvisorTab: React.FC<{ profile: BusinessProfile }> = ({ profile }) => {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [deductions, setDeductions] = useState<string[]>([]);
    const [loadingDeductions, setLoadingDeductions] = useState(false);
    const apiKeyAvailable = hasApiKey();

    const handleAsk = async () => {
        if (!question.trim()) return;
        setLoading(true);
        try {
            const prompt = `
                You are an expert US tax accountant for small businesses.
                User Profile:
                - Entity: ${profile.info.businessType || 'Unknown'}
                - State: ${profile.info.stateOfFormation || 'Unknown'}
                - Industry: ${profile.info.industry || 'Unknown'}

                User Question: ${question}

                Provide a clear, concise answer emphasizing tax maximization and compliance. Use Markdown for formatting.
            `;
            const result = await askAiAdvisor(prompt);
            setAnswer(result);
        } catch (e) {
            setAnswer('Error connecting to AI tax advisor. Please check your API key and internet connection.');
        } finally {
            setLoading(false);
        }
    };

    const generateDeductions = async () => {
        if (!profile.info.industry) {
            alert('Please enter an Industry in the Setup Guide tab first.');
            return;
        }
        setLoadingDeductions(true);
        try {
            const list = await getIndustryDeductions(profile.info.industry);
            setDeductions(list);
        } catch (e) {
            console.error(e);
            alert('Could not generate deductions list.');
        } finally {
            setLoadingDeductions(false);
        }
    };

    const complianceItems = [
        { task: 'File Annual Report', note: `Required in most states (like ${profile.info.stateOfFormation || 'yours'}).` },
        { task: 'Pay Estimated Taxes', note: 'Quarterly (Apr, Jun, Sep, Jan) if you owe >$1000.' },
        { task: 'Renew Business License', note: 'Check your local city/county requirements.' },
        { task: 'File Beneficial Ownership Info (BOI)', note: 'New FinCEN requirement for most LLCs.' },
    ];

    if (!apiKeyAvailable) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <ExclamationTriangleIcon className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">API Key Missing</h3>
                <p className="text-slate-500 mt-2 max-w-md">
                    The Tax Advisor and Deduction Scout features rely on AI. Please configure the <code className="bg-slate-200 px-1 rounded">API_KEY</code> environment variable to unlock these tools.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Chat Section */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[500px]">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <CurrencyDollarIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Tax Q&A Advisor</h2>
                        <p className="text-xs text-slate-500">Ask about maximized returns, filing status, or compliance.</p>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto mb-4 space-y-4 bg-slate-50 p-4 rounded-lg">
                    {answer ? (
                        <div className="prose prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: answer.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    ) : (
                        <div className="text-center text-slate-400 mt-10">
                            <SparklesIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>Ask me anything about your business taxes!</p>
                            <p className="text-xs mt-2">e.g., "Can I deduct my home internet?", "When are my estimated taxes due?"</p>
                        </div>
                    )}
                     {loading && (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={question} 
                        onChange={(e) => setQuestion(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                        placeholder="Type your tax question..." 
                        className="flex-grow p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button 
                        onClick={handleAsk} 
                        disabled={loading || !question.trim()}
                        className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Sidebar Section */}
            <div className="space-y-6">
                {/* Deductions Scout */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <SparklesIcon className="w-5 h-5 text-yellow-500" />
                        <h3 className="font-bold text-slate-800">Deduction Scout</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        Discover tax write-offs tailored to the <strong>{profile.info.industry || 'General'}</strong> industry.
                    </p>
                    
                    {deductions.length > 0 ? (
                         <ul className="space-y-2 mb-4">
                            {deductions.map((d, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 bg-green-50 p-2 rounded-md border border-green-100">
                                    <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>{d}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <button 
                            onClick={generateDeductions} 
                            disabled={loadingDeductions}
                            className="w-full py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors mb-4 text-sm"
                        >
                            {loadingDeductions ? 'Scouting...' : 'Find Deductions'}
                        </button>
                    )}
                </div>

                {/* Compliance Checklist */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex items-center gap-2 mb-4">
                        <CheckCircleIcon className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-slate-800">Compliance Checklist</h3>
                    </div>
                    <ul className="space-y-3">
                        {complianceItems.map((item, i) => (
                            <li key={i} className="text-sm">
                                <div className="font-medium text-slate-800">{item.task}</div>
                                <div className="text-xs text-slate-500">{item.note}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

const CalendarTab: React.FC<{ profile: BusinessProfile }> = ({ profile }) => {
    const entityType = profile.info.businessType;
    const deadlines = [
        { date: 'Jan 31', title: 'Form 1099-NEC Deadline', description: 'Send 1099s to contractors paid over $600.' },
        { date: 'Mar 15', title: 'S-Corp & Partnership Filing', description: 'Deadline for Form 1120-S and Form 1065.', type: ['s-corp', 'partnership', 'llc-multi'] },
        { date: 'Apr 15', title: 'Individual & C-Corp Filing', description: 'Deadline for Form 1040 and Form 1120.', type: ['sole-proprietor', 'c-corp', 'llc-single'] },
        { date: 'Apr 15', title: 'Q1 Estimated Tax', description: 'Payment for income earned Jan 1 - Mar 31.' },
        { date: 'Jun 15', title: 'Q2 Estimated Tax', description: 'Payment for income earned Apr 1 - May 31.' },
        { date: 'Sep 15', title: 'Q3 Estimated Tax', description: 'Payment for income earned Jun 1 - Aug 31.' },
        { date: 'Jan 15', title: 'Q4 Estimated Tax', description: 'Payment for income earned Sep 1 - Dec 31.' },
    ];

    const relevantDeadlines = deadlines.filter(d => !d.type || (entityType && d.type.includes(entityType)));

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-700 mb-4">Tax Calendar</h2>
                <div className="space-y-4">
                    {relevantDeadlines.map((event, index) => (
                        <div key={index} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                            <div className="flex-shrink-0 w-16 text-center">
                                <span className="block text-sm font-bold text-indigo-600">{event.date}</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">{event.title}</h3>
                                <p className="text-sm text-slate-600">{event.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-start gap-3">
                <SparklesIcon className="w-6 h-6 text-indigo-500 flex-shrink-0 mt-1" />
                <div>
                    <h3 className="font-bold text-sm text-slate-800">Estimated Taxes?</h3>
                    <p className="text-sm text-slate-600 mt-1">
                        If you expect to owe more than $1,000 in taxes when you file your return, the IRS requires you to make estimated tax payments quarterly. Failure to do so can result in penalties.
                    </p>
                </div>
            </div>
        </div>
    );
}


const BusinessHub: React.FC<BusinessHubProps> = ({ profile, documents, folders, onUpdateProfile, onAddDocument, onRemoveDocument, onCreateFolder, onDeleteFolder }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'docs' | 'calendar' | 'advisor'>('guide');

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Business Hub</h1>
                <p className="text-slate-500 mt-1">Manage your entity details, documents, and tax strategy.</p>
            </div>

            <div className="flex border-b border-slate-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('guide')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'guide' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Setup Guide
                </button>
                <button 
                    onClick={() => setActiveTab('advisor')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'advisor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Tax Advisor
                </button>
                <button 
                    onClick={() => setActiveTab('docs')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'docs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Document Vault
                </button>
                <button 
                    onClick={() => setActiveTab('calendar')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'calendar' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Tax Calendar
                </button>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'guide' && <SetupGuideTab profile={profile} onUpdateProfile={onUpdateProfile} />}
                {activeTab === 'advisor' && <TaxAdvisorTab profile={profile} />}
                {activeTab === 'docs' && <DocumentsTab documents={documents} folders={folders} onAddDocument={onAddDocument} onRemoveDocument={onRemoveDocument} onCreateFolder={onCreateFolder} onDeleteFolder={onDeleteFolder} />}
                {activeTab === 'calendar' && <CalendarTab profile={profile} />}
            </div>
        </div>
    );
};

export default BusinessHub;
