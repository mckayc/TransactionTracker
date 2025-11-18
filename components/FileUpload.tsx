
import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './Icons';
import type { Account } from '../types';

interface FileUploadProps {
  onFileUpload: (files: File[], accountId: string) => void;
  disabled: boolean;
  accounts: Account[];
  useAi: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, disabled, accounts, useAi }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      file.type === 'application/pdf' || file.type === 'text/csv'
    );
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, [disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file: File) => 
        file.type === 'application/pdf' || file.type === 'text/csv'
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
          accept="application/pdf,text/csv"
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
            {useAi ? 'AI processing for PDF & CSV' : 'Fast local processing for PDF & CSV'}
          </p>
        </div>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
                 {accounts.length > 0 ? (
                    <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        disabled={disabled}
                    >
                        <option value="" disabled>Select an account</option>
                        {accounts.map(account => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                        ))}
                    </select>
                 ) : (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">Please create an Account on the Accounts page first.</p>
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
