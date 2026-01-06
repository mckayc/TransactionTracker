import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, AddIcon, CheckCircleIcon, SparklesIcon, RobotIcon } from './Icons';
import type { Account } from '../types';

interface FileUploadProps {
  onFileUpload: (files: File[], accountId: string, useAi: boolean) => void;
  disabled: boolean;
  accounts: Account[];
  onAddAccountRequested?: () => void;
}

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, disabled, accounts, onAddAccountRequested }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [useAi, setUseAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Robust Account Prediction
  useEffect(() => {
    if (selectedFiles.length > 0 && accounts.length > 0) {
      const allNames = selectedFiles.map(f => f.name.toLowerCase()).join(' ');
      
      const scoredAccounts = accounts.map(acc => {
        let score = 0;
        const name = acc.name.toLowerCase();
        const ident = acc.identifier.toLowerCase();
        
        // Clean names for matching (e.g. "U.S. Bank" -> "us bank")
        const cleanName = name.replace(/[^a-z0-9]/g, ' ');
        const cleanIdent = ident.replace(/[^a-z0-9]/g, ' ');

        if (ident.length >= 3 && allNames.includes(ident)) score += 10;
        if (cleanIdent.length >= 3 && allNames.includes(cleanIdent)) score += 8;
        
        const nameWords = cleanName.split(/\s+/).filter(w => w.length > 2);
        nameWords.forEach(word => {
            if (allNames.includes(word)) score += 5;
        });

        if (allNames.includes(cleanName)) score += 20;

        return { id: acc.id, score };
      }).sort((a, b) => b.score - a.score);

      if (scoredAccounts[0] && scoredAccounts[0].score > 0) {
        setSelectedAccountId(scoredAccounts[0].id);
      }
    }
  }, [selectedFiles, accounts]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.type === 'text/csv' || EXCEL_MIME_TYPES.includes(f.type));
    if (files.length > 0) setSelectedFiles(files);
  }, [disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.type === 'text/csv' || EXCEL_MIME_TYPES.includes(f.type));
      setSelectedFiles(files);
    }
  };

  const handleProcessClick = () => {
    if (selectedFiles.length > 0 && selectedAccountId) {
      onFileUpload(selectedFiles, selectedAccountId, useAi);
      setSelectedFiles([]);
      setSelectedAccountId('');
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`p-2 rounded-lg transition-colors ${useAi ? 'bg-indigo-600 text-white shadow-indigo-100 shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                  <RobotIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                  <span className={`text-sm font-bold transition-colors ${useAi ? 'text-indigo-700' : 'text-slate-500'}`}>Use Gemini AI Processing</span>
                  <span className="text-[10px] text-slate-400 font-medium">Better for PDFs & complex statements</span>
              </div>
              <input type="checkbox" className="sr-only" checked={useAi} onChange={() => setUseAi(!useAi)} />
              <div className={`ml-4 w-10 h-5 rounded-full relative transition-colors ${useAi ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${useAi ? 'left-6' : 'left-1'}`} />
              </div>
          </label>
      </div>

      <div
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center w-full h-40 p-4 border-2 border-dashed rounded-2xl transition-all cursor-pointer 
          ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" disabled={disabled} />
        <UploadIcon className="w-8 h-8 mb-2 text-slate-400" />
        <p className="font-bold text-slate-700">Click or drag files to import</p>
        <p className="text-xs text-slate-400 mt-1">PDF, CSV, or Excel formats supported</p>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in bg-white p-4 rounded-2xl border border-slate-200">
            <div>
                <h4 className="text-xs font-black text-slate-400 uppercase mb-2">Pending Files</h4>
                <ul className="text-sm text-slate-600 space-y-1 max-h-24 overflow-y-auto">
                    {selectedFiles.map((f, i) => <li key={i} className="truncate px-2 py-1 bg-slate-50 rounded border border-slate-100">• {f.name}</li>)}
                </ul>
            </div>
            <div>
                 <h4 className="text-xs font-black text-slate-400 uppercase mb-2">Target Account</h4>
                 <div className="flex gap-2">
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} disabled={disabled} className="flex-grow font-bold text-slate-700">
                        <option value="" disabled>Select account...</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.identifier})</option>)}
                    </select>
                    <button onClick={(e) => { e.stopPropagation(); onAddAccountRequested?.(); }} className="p-2 border rounded-lg hover:bg-slate-50 text-indigo-600"><AddIcon className="w-5 h-5" /></button>
                 </div>
                 {selectedAccountId && <p className="text-[9px] text-green-600 font-black uppercase mt-1 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Auto-matched with high confidence</p>}
            </div>
        </div>
      )}

      <button
        onClick={handleProcessClick}
        disabled={disabled || selectedFiles.length === 0 || !selectedAccountId}
        className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all disabled:bg-slate-200 disabled:text-slate-400"
      >
        {disabled ? 'Working...' : `Process ${selectedFiles.length} File(s)`}
      </button>
    </div>
  );
};

export default FileUpload;
