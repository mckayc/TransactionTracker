import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { BusinessDocument, DocumentFolder } from '../types';
import { DocumentIcon, CloudArrowUpIcon, DeleteIcon, DownloadIcon, AddIcon, ExclamationTriangleIcon, FolderIcon, ShieldCheckIcon } from '../components/Icons';
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

const DocumentsPage: React.FC<DocumentsPageProps> = ({ documents, folders, onAddDocument, onRemoveDocument, onCreateFolder, onDeleteFolder }) => {
    const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [apiKeyAvailable, setApiKeyAvailable] = useState(hasApiKey());
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkKey = () => {
            const current = hasApiKey();
            setApiKeyAvailable(current);
        };
        
        checkKey();
        const interval = setInterval(checkKey, 5000);
        return () => clearInterval(interval);
    }, []);

    const currentPath = React.useMemo(() => {
        const path = [];
        let current = folders.find(f => f.id === currentFolderId);
        if (!current && currentFolderId === 'folder_system_backups') {
            return [{ id: 'folder_system_backups', name: 'System Backups', createdAt: '' }];
        }
        while (current) {
            path.unshift(current);
            current = folders.find(f => f.id === current?.parentId);
        }
        return path;
    }, [folders, currentFolderId]);

    const visibleDocuments = documents.filter(doc => doc.parentId === currentFolderId);
    
    // Fixed: Added useMemo import to React
    const allVisibleFolders = useMemo(() => {
        const list = [...folders.filter(f => f.parentId === currentFolderId)];
        if (currentFolderId === undefined) {
            // Add virtual system folder to home
            list.push({ id: 'folder_system_backups', name: 'System Backups', createdAt: '', parentId: undefined });
        }
        return list;
    }, [folders, currentFolderId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const originalFile = e.target.files?.[0];
        if (!originalFile) return;

        setIsUploading(true);
        try {
            const now = new Date();
            const timestampPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
            const newFileName = `${timestampPrefix}_${originalFile.name}`;

            const file = new File([originalFile], newFileName, { type: originalFile.type });
            const docId = generateUUID();
            
            await saveFile(docId, file);

            let analysis = undefined;
            if (apiKeyAvailable && file.type !== 'application/json' && file.size < 5 * 1024 * 1024) {
                try {
                    analysis = await analyzeBusinessDocument(file, (msg) => console.log(msg));
                } catch (aiError) {
                    console.warn("AI analysis failed, saving document without insights.", aiError);
                }
            }

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
            alert(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}.`);
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
                            className={`hover:text-indigo-600 font-medium ${!currentFolderId ? 'text-slate-800' : 'text-slate-400'}`}
                        >
                            Home
                        </button>
                        {currentPath.map(folder => (
                            <React.Fragment key={folder.id}>
                                <span className="text-slate-300">/</span>
                                <button 
                                    onClick={() => setCurrentFolderId(folder.id)}
                                    className={`hover:text-indigo-600 font-medium ${currentFolderId === folder.id ? 'text-slate-800' : 'text-slate-400'}`}
                                >
                                    {folder.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsCreatingFolder(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-bold text-xs uppercase"
                        >
                            <AddIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">New Folder</span>
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors shadow-sm font-black text-xs uppercase"
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

                {visibleDocuments.length === 0 && allVisibleFolders.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <DocumentIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">This folder is empty.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allVisibleFolders.map(folder => (
                            <div 
                                key={folder.id} 
                                className="bg-white p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between group"
                                onClick={() => setCurrentFolderId(folder.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${folder.id === 'folder_system_backups' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-500'}`}>
                                        {folder.id === 'folder_system_backups' ? <ShieldCheckIcon className="w-6 h-6" /> : <FolderIcon className="w-6 h-6" />}
                                    </div>
                                    <span className="font-bold text-slate-700 truncate max-w-[150px]">{folder.name}</span>
                                </div>
                                {folder.id !== 'folder_system_backups' && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} 
                                        className="p-2 text-slate-300 hover:text-red-500 rounded-full hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete Folder"
                                    >
                                        <DeleteIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}

                        {visibleDocuments.map(doc => (
                            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
                                <div className="p-4 flex items-start justify-between bg-slate-50 border-b border-slate-100">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-white p-2 rounded border border-slate-200">
                                            <DocumentIcon className="w-6 h-6 text-slate-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm truncate" title={doc.name}>{doc.name}</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{doc.uploadDate} • {(doc.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 space-y-2 flex-grow flex flex-col">
                                    {doc.aiAnalysis ? (
                                        <div className="space-y-2 flex-grow">
                                            <p className="text-[10px] font-black bg-green-100 text-green-800 px-2 py-0.5 rounded inline-block uppercase tracking-widest">{doc.aiAnalysis.documentType}</p>
                                            <p className="text-xs text-slate-600 line-clamp-3 font-medium">{doc.aiAnalysis.summary}</p>
                                        </div>
                                    ) : doc.parentId === 'folder_system_backups' ? (
                                        <div className="flex-grow flex flex-col items-center justify-center py-4 opacity-50">
                                            <ShieldCheckIcon className="w-8 h-8 text-amber-500 mb-1" />
                                            <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest text-center">System Ledger Archive</p>
                                        </div>
                                    ) : (
                                        <div className="flex-grow flex items-center justify-center py-4 opacity-30">
                                            <p className="text-xs text-slate-400 italic">No analysis</p>
                                        </div>
                                    )}
                                    
                                    <div className="pt-3 mt-auto flex justify-between border-t border-slate-100">
                                        <button onClick={() => handleDownload(doc)} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                            <DownloadIcon className="w-3 h-3" /> Download
                                        </button>
                                        <button onClick={() => handleDelete(doc.id)} className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 flex items-center gap-1">
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