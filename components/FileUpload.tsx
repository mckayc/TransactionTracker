import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, AddIcon, CheckCircleIcon, RobotIcon } from './Icons';
import type { Account } from '../types';

interface FileUploadProps {
  onFileUpload: (files: File[], accountId: string, useAi: boolean) => void;
  disabled: boolean;
  accounts?: Account[];
  onAddAccountRequested?: () => void;
  label?: string;
  showAiToggle?: boolean;
  acceptedFileTypes?: string;
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  disabled, 
  accounts = [], 
  onAddAccountRequested,
  label = "Click or drag files to import",
  showAiToggle = false,
  acceptedFileTypes = ".pdf,.csv,.xlsx,.xls",
  multiple = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [useAi, setUseAi] = useState(showAiToggle);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedFiles.length > 0 && accounts.length > 0 && !selectedAccountId) {
      const allNames = selectedFiles.map(f => f.name.toLowerCase()).join(' ');
      const match = accounts.find(acc => acc.identifier && allNames.includes(acc.identifier.toLowerCase()));
      if (match) setSelectedAccountId(match.id);
    }
  }, [selectedFiles, accounts, selectedAccountId]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setSelectedFiles(files);
  }, [disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(Array.from(e.target.files));
  };

  const handleProcessClick = () => {
    if (selectedFiles.length > 0) {
      if (accounts.length > 0 && !selectedAccountId) {
          alert("Please select a target account.");
          return;
      }
      onFileUpload(selectedFiles, selectedAccountId, useAi);
      setSelectedFiles([]);
      setSelectedAccountId('');
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {showAiToggle && (
          <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`p-2 rounded-lg transition-colors ${useAi ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                      <RobotIcon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                      <span className={`text-sm font-bold ${useAi ? 'text-indigo-700' : 'text-slate-500'}`}>Use Gemini AI Processing</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Best for PDFs & Complex Layouts</span>
                  </div>
                  <input type="checkbox" className="sr-only" checked={useAi} onChange={() => setUseAi(!useAi)} />
                  <div className={`ml-4 w-10 h-5 rounded-full relative transition-colors ${useAi ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${useAi ? 'left-6' : 'left-1'}`} />
                  </div>
              </label>
          </div>
      )}

      <div
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center w-full h-40 p-4 border-2 border-dashed rounded-3xl transition-all cursor-pointer 
          ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-300'}
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input ref={fileInputRef} type="file" multiple={multiple} accept={acceptedFileTypes} onChange={handleFileChange} className="hidden" disabled={disabled} />
        <UploadIcon className="w-8 h-8 mb-2 text-slate-400" />
        <p className="font-bold text-slate-700 text-lg">{label}</p>
        <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">{acceptedFileTypes.replace(/\./g, '').toUpperCase()} supported</p>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Files</h4>
                <ul className="text-sm text-slate-600 space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                    {selectedFiles.map((f, i) => <li key={i} className="truncate px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 font-medium">• {f.name}</li>)}
                </ul>
            </div>
            {accounts.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Accounting Destination</h4>
                    <div className="flex gap-2">
                        <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} disabled={disabled} className="flex-grow font-bold text-slate-700 rounded-xl border-slate-200">
                            <option value="" disabled>Select target account...</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.identifier})</option>)}
                        </select>
                        <button onClick={(e) => { e.stopPropagation(); onAddAccountRequested?.(); }} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-indigo-600 transition-colors shadow-sm"><AddIcon className="w-5 h-5" /></button>
                    </div>
                </div>
            )}
        </div>
      )}

      {selectedFiles.length > 0 && (
          <button
            onClick={handleProcessClick}
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all disabled:bg-slate-200 uppercase tracking-widest text-xs"
          >
            Process Inbound Stream
          </button>
      )}
    </div>
  );
};

export default FileUpload;