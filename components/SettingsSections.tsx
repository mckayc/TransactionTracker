import React from 'react';
import { RobotIcon, SparklesIcon, InfoIcon, CheckCircleIcon, ExclamationTriangleIcon, TableIcon, ShieldCheckIcon, StethoscopeIcon, RepeatIcon, PlayIcon, CopyIcon, ChevronRightIcon, ListIcon } from './Icons';
import type { AiConfig, BackupConfig } from '../types';

const MODEL_OPTIONS = [
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fastest)', tier: 'Standard', desc: 'Cutting-edge speed and high reliability for ledger sorting and categorization.' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Deep Analysis)', tier: 'Advanced', desc: 'Superior reasoning for complex financial roadmap synthesis and multi-step strategy.' },
    { id: 'gemini-flash-latest', label: 'Gemini Flash 2.5 (Stable)', tier: 'Standard', desc: 'The most reliable recent Flash model for consistent data extraction.' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite (Efficient)', tier: 'Standard', desc: 'Optimized for low-latency basic text extraction and simple classification.' }
];

export const Section: React.FC<{title: string, variant?: 'default' | 'danger' | 'info', children: React.ReactNode}> = ({title, variant = 'default', children}) => (
    <details className={`bg-white p-6 rounded-3xl shadow-sm border ${
        variant === 'danger' ? 'border-red-100 open:ring-red-50' : 
        variant === 'info' ? 'border-indigo-100 open:ring-indigo-50' :
        'border-slate-200 open:ring-indigo-50'
    }`} open>
        <summary className={`text-xl font-black cursor-pointer transition-colors ${
            variant === 'danger' ? 'text-red-700' : 
            variant === 'info' ? 'text-indigo-700' :
            'text-slate-800'
        }`}>{title}</summary>
        <div className="mt-6">
            {children}
        </div>
    </details>
);

export const AiCorePanel: React.FC<{
    apiKeyActive: boolean;
    onTest: () => void;
    isTesting: boolean;
    testResult: { success: boolean; message: string } | null;
    aiConfig: AiConfig;
    onUpdate: (key: keyof AiConfig, val: any) => void;
}> = ({ apiKeyActive, onTest, isTesting, testResult, aiConfig, onUpdate }) => (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-8 p-8 bg-slate-900 rounded-[2rem] text-white overflow-hidden relative">
            <div className="relative z-10 flex-1">
                <div className="flex items-center gap-3 mb-4">
                    <RobotIcon className={`w-8 h-8 ${apiKeyActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <h3 className="text-2xl font-black">Google Gemini Neural Core</h3>
                </div>
                <p className="text-slate-400 max-w-lg mb-6 leading-relaxed">
                    The system is currently using the <strong>{apiKeyActive ? 'Active' : 'Missing'}</strong> API key injected from your container environment.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button onClick={onTest} disabled={isTesting || !apiKeyActive} className="px-8 py-3 bg-white text-slate-900 font-black rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95">
                        {isTesting ? 'Negotiating...' : 'Test Connection'}
                    </button>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="px-8 py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2">
                        <InfoIcon className="w-4 h-4" /> Studio Dashboard
                    </a>
                </div>
                {testResult && (
                    <div className={`mt-6 p-4 rounded-2xl border flex items-center gap-3 animate-slide-up ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        {testResult.success ? <CheckCircleIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                        <p className="text-sm font-bold">{testResult.message}</p>
                    </div>
                )}
            </div>
            <SparklesIcon className="absolute -right-12 -top-12 w-64 h-64 opacity-5 pointer-events-none text-indigo-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2"><TableIcon className="w-5 h-5 text-indigo-500" /><h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Primary Logic Engine</h4></div>
                <select value={aiConfig.textModel} onChange={e => onUpdate('textModel', e.target.value)} className="w-full font-bold text-sm bg-slate-50">
                    {MODEL_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.tier})</option>)}
                </select>
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-[10px] text-slate-400 leading-relaxed italic">{MODEL_OPTIONS.find(o => o.id === aiConfig.textModel)?.desc}</p></div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2"><SparklesIcon className="w-5 h-5 text-indigo-500" /><h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Strategic Reasoning Engine</h4></div>
                <select value={aiConfig.complexModel} onChange={e => onUpdate('complexModel', e.target.value)} className="w-full font-bold text-sm bg-slate-50">
                    {MODEL_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.tier})</option>)}
                </select>
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-[10px] text-slate-400 leading-relaxed italic">{MODEL_OPTIONS.find(o => o.id === aiConfig.complexModel)?.desc}</p></div>
            </div>
        </div>
    </div>
);

export const ContinuityPanel: React.FC<{
    backupEnabled: boolean;
    backupFreq: BackupConfig['frequency'];
    retentionCount: number;
    logs?: BackupConfig['logs'];
    onUpdate: (enabled: boolean, freq: BackupConfig['frequency'], count: number) => void;
}> = ({ backupEnabled, backupFreq, retentionCount, logs = [], onUpdate }) => (
    <div className="space-y-6">
        <div className="bg-indigo-50 p-8 rounded-[2.5rem] border-2 border-indigo-100 flex flex-col md:flex-row items-center gap-8 shadow-inner">
            <div className={`p-5 rounded-[1.5rem] text-white shadow-xl transition-all ${backupEnabled ? 'bg-indigo-600 shadow-indigo-200 scale-105' : 'bg-slate-400 opacity-50 grayscale'}`}>
                <ShieldCheckIcon className="w-10 h-10" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-2xl font-black text-indigo-900">Automated Preservation</h3>
                        <p className="text-sm text-indigo-700 mt-1 max-w-lg leading-relaxed">Ensure system durability by enabling scheduled snapshots. Backups are stored locally and appear in your <strong>Documents</strong> view under "System Backups".</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer scale-125 mr-4">
                        <input type="checkbox" checked={backupEnabled} onChange={e => onUpdate(e.target.checked, backupFreq, retentionCount)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
                
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 transition-opacity ${backupEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Schedule Frequency</label>
                        <select 
                            value={backupFreq} 
                            onChange={e => onUpdate(backupEnabled, e.target.value as any, retentionCount)}
                            className="w-full font-bold text-sm bg-white border-indigo-200 text-indigo-900"
                        >
                            <option value="daily">Daily Snapshot</option>
                            <option value="weekly">Weekly Preservation</option>
                            <option value="monthly">Monthly Archive</option>
                            <option value="never">Manual Preservation Only</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Retention Threshold</label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="number" 
                                min="1" 
                                max="50" 
                                value={retentionCount} 
                                onChange={e => onUpdate(backupEnabled, backupFreq, parseInt(e.target.value) || 1)}
                                className="w-24 font-bold text-sm bg-white border-indigo-200 text-indigo-900" 
                            />
                            <span className="text-xs text-indigo-600 font-medium">Versions</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* BACKUP LOG CONSOLE */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <ListIcon className="w-4 h-4 text-indigo-500" />
                    System Continuity Log
                </h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing last 10 actions</p>
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {logs.length === 0 ? (
                    <div className="py-12 text-center text-slate-300 italic text-sm">No recorded continuity events.</div>
                ) : (
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50 font-black text-slate-400 text-[9px] uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-3 text-left">Timestamp</th>
                                <th className="px-6 py-3 text-left">Action</th>
                                <th className="px-6 py-3 text-left">Audit Details</th>
                                <th className="px-6 py-3 text-center">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 text-[10px] font-mono text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">{log.action}</td>
                                    <td className="px-6 py-3 text-xs text-slate-500 font-medium">{log.details}</td>
                                    <td className="px-6 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    </div>
);

export const MaintenancePanel: React.FC<{
    diagnostics: any;
    onRepair: () => void;
    isRepairing: boolean;
    onCopyManifesto: () => void;
    copyState: string;
}> = ({ diagnostics, onRepair, isRepairing, onCopyManifesto, copyState }) => (
    <div className="flex flex-col md:flex-row items-start gap-6 p-6 bg-slate-50 border border-slate-200 rounded-[2.5rem] shadow-sm">
        <div className="p-5 bg-slate-800 rounded-[1.5rem] text-white shadow-xl"><StethoscopeIcon className="w-10 h-10" /></div>
        <div className="flex-1">
            <h3 className="text-xl font-black text-slate-800">System Doctor & Diagnostics</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">Probe the SQLite engine. If features fail, use Force Repair to normalize column names and consolidate legacy tables.</p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                {diagnostics?.tables?.map((t: any) => (
                    <div key={t.table} className={`p-3 rounded-xl border flex flex-col gap-1 ${t.rowCount > 0 ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200 animate-pulse'}`}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{t.table}</p>
                        <p className={`text-lg font-black ${t.rowCount > 0 ? 'text-indigo-600' : 'text-red-600'}`}>{t.rowCount}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Records</p>
                    </div>
                ))}
            </div>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-auto">
            <button onClick={onRepair} disabled={isRepairing} className="w-full px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                {isRepairing ? <RepeatIcon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4" />} Force Repair
            </button>
            <button onClick={onCopyManifesto} className={`w-full px-8 py-3 font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm border ${copyState === 'success' ? 'bg-emerald-500 border-emerald-600 text-white' : copyState === 'error' ? 'bg-red-500 border-red-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {copyState === 'success' ? <CheckCircleIcon className="w-4 h-4" /> : copyState === 'error' ? <ExclamationTriangleIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />} {copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Failed' : 'Manifesto'}
            </button>
        </div>
    </div>
);
