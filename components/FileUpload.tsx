
import React, { useState, useCallback, useRef, useEffect } from 'react';
/* Added CheckCircleIcon to fix 'Cannot find name' error on line 172 */
import { UploadIcon, AddIcon, CheckCircleIcon } from './Icons';
import type { Account } from '../types';

interface FileUploadProps {
  onFileUpload: (files: File[], accountId: string) => void;
  disabled: boolean;
  accounts: Account[];
  useAi: boolean;
  onAddAccountRequested?: () => void;
}

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, disabled, accounts, useAi, onAddAccountRequested }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Predict account based on filename when files are selected
  useEffect(() => {
    if (selectedFiles.length > 0 && accounts.length > 0) {
      // Logic: Look at filenames and try to find a match in account names or identifiers
      const allFileNames = selectedFiles.map(f => f.name.toLowerCase()).join(' ');
      
      const bestMatch = accounts.find(acc => {
        const name = acc.name.toLowerCase();
        const ident = acc.identifier.toLowerCase();
        // Match if identifier (e.g. 1234) or full account name is in the filename
        return (ident.length >= 3 && allFileNames.includes(ident)) || allFileNames.includes(name);
      });

      if (bestMatch) {
        setSelectedAccountId(bestMatch.id);
      }
    }
  }, [selectedFiles, accounts]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter((file: File) => 
      file.type === 'application/pdf' || 
      file.type === 'text/csv' || 
      EXCEL_MIME_TYPES.includes(file.type)
    );
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, [disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file: File) => 
        file.type === 'application/pdf' || 
        file.type === 'text/csv' || 
        EXCEL_MIME_TYPES.includes(file.type)
      );
      setSelectedFiles(files);
    }
  };

  const handleProcessClick = () => {
    if (selectedFiles.length > 0 && selectedAccountId) {
      onFileUpload(selectedFiles, selectedAccountId);
      setSelectedFiles([]);
      setSelectedAccountId('');
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const canProcess = !disabled && selectedFiles.length > 0 && selectedAccountId !== '';

  return (
    <div className="flex flex-col space-y-4">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`relative flex flex-col items-center justify-center w-full h-48 p-4 border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer 
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'}
          ${disabled ? 'cursor-not-allowed bg-slate-100' : 'hover:border-indigo-400'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center text-center text-slate-500">
          <UploadIcon className="w-10 h-10 mb-3 text-slate-400" />
          <p className="font-semibold">
            <span className="text-indigo-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-sm">
            {useAi ? 'AI processing for PDF, Excel & CSV' : 'Fast local processing for Excel & CSV'}
          </p>
        </div>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start animate-fade-in">
            <div className="space-y-2">
                <h4 className="font-medium text-slate-700">Selected files:</h4>
                <ul className="text-sm text-slate-600 list-disc list-inside max-h-24 overflow-y-auto bg-slate-50 p-2 rounded-md">
                    {selectedFiles.map((file, index) => (
                    <li key={index}>{file.name}</li>
                    ))}
                </ul>
            </div>
            <div className="space-y-2">
                 <h4 className="font-medium text-slate-700">Select Account:</h4>
                 <div className="flex gap-2">
                    {accounts.length > 0 ? (
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            disabled={disabled}
                            className={`flex-grow transition-all ${selectedAccountId ? 'border-green-400 ring-2 ring-green-100' : 'border-slate-300'}`}
                        >
                            <option value="" disabled>Select an account</option>
                            {accounts.map(account => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="flex-grow p-2 border rounded-md bg-red-50 text-red-600 text-sm font-medium border-red-100">No accounts found. Create one to continue.</div>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddAccountRequested?.(); }} 
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-indigo-600 flex items-center justify-center"
                        title="Quick add account"
                    >
                        <AddIcon className="w-5 h-5" />
                    </button>
                 </div>
                 {selectedAccountId && (
                   <p className="text-[10px] text-green-600 font-bold uppercase flex items-center gap-1">
                     <CheckCircleIcon className="w-3 h-3" /> Account Predicted Successfully
                   </p>
                 )}
            </div>
        </div>
      )}

      <button
        onClick={handleProcessClick}
        disabled={!canProcess}
        className="w-full sm:w-auto self-start px-6 py-3 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
      >
        {disabled ? 'Processing...' : `Process ${selectedFiles.length} File(s)`}
      </button>
    </div>
  );
};

export default FileUpload;
