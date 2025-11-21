
import React, { useState, useRef } from 'react';
import type { BusinessDocument, DocumentFolder } from '../types';
import { DocumentIcon, CloudArrowUpIcon, DeleteIcon, DownloadIcon, AddIcon, ExclamationTriangleIcon } from '../components/Icons';
import { analyzeBusinessDocument, hasApiKey } from '../services/geminiService';
import { saveFile, deleteFile, getFile } from '../services/storageService';
import { generateUUID } from '../utils';

interface DocumentsPageProps {
    documents: BusinessDocument[];
    folders: DocumentFolder[];
    onAddDocument: (doc: BusinessDocument) => void;
    onRemoveDocument: (id: string) => void;
    onCreateFolder: (folder: DocumentFolder) => void;
    onDeleteFolder: (id: string) => void;
}

const FolderIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 20.25V9" />
    </svg>
);

const DocumentsPage: React.FC<DocumentsPageProps> = ({ documents, folders, onAddDocument, onRemoveDocument, onCreateFolder, onDeleteFolder }) => {
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
        const originalFile = e.target.files?.[0];
        if (!originalFile) return;

        setIsUploading(true);
        try {
            // Prepend Date/Time to filename for better organization and collision avoidance
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            
            const timestampPrefix = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
            const newFileName = `${timestampPrefix}_${originalFile.name}`;

            // Create a new File object with the updated name
            const file = new File([originalFile], newFileName, { type: originalFile.type });

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
            alert(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}. Check server logs/permissions.`);
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
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Document Vault</h1>
                <p className="text-slate-500 mt-1">Securely store and organize your financial documents.</p>
            </div>

            <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-slate-500 overflow-x-auto">
                        <button 
                            onClick={() => setCurrentFolderId(undefined)} 
                            className={`hover:text-indigo-600 font-medium ${!currentFolderId ? 'text-slate-800' : ''}`}
                        >
                            Home
                        </button>
                        {currentPath.map(folder => (
                            <React.Fragment key={folder.id}>
                                <span className="text-slate-300">/</span>
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
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <AddIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">New Folder</span>
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors shadow-sm font-medium"
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
                                    <div className="bg-indigo-50 p-2 rounded-lg">
                                        <FolderIcon className="w-6 h-6 text-indigo-500" />
                                    </div>
                                    <span className="font-medium text-slate-700 truncate max-w-[150px]">{folder.name}</span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} 
                                    className="p-2 text-slate-300 hover:text-red-500 rounded-full hover:bg-slate-100"
                                    title="Delete Folder"
                                >
                                    <DeleteIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        {/* Files */}
                        {visibleDocuments.map(doc => (
                            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
                                <div className="p-4 flex items-start justify-between bg-slate-50 border-b border-slate-100">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-white p-2 rounded border border-slate-200">
                                            <DocumentIcon className="w-6 h-6 text-slate-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm truncate" title={doc.name}>{doc.name}</h3>
                                            <p className="text-xs text-slate-500">{doc.uploadDate} • {(doc.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 space-y-2 flex-grow flex flex-col">
                                    {doc.aiAnalysis ? (
                                        <div className="space-y-2 flex-grow">
                                            <p className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded inline-block">{doc.aiAnalysis.documentType}</p>
                                            <p className="text-xs text-slate-600 line-clamp-3">{doc.aiAnalysis.summary}</p>
                                            {doc.aiAnalysis.keyDates && doc.aiAnalysis.keyDates.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {doc.aiAnalysis.keyDates.map((date, i) => (
                                                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                                                            {date}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-grow flex items-center justify-center">
                                            <p className="text-xs text-slate-400 italic">No AI analysis available.</p>
                                        </div>
                                    )}
                                    
                                    <div className="pt-3 mt-auto flex justify-between border-t border-slate-100">
                                        <button onClick={() => handleDownload(doc)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                            <DownloadIcon className="w-3 h-3" /> Download
                                        </button>
                                        <button onClick={() => handleDelete(doc.id)} className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1">
                                            <DeleteIcon className="w-3 h-3" /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DocumentsPage;
