
import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, Account, Category, BusinessProfile, BusinessInfo, TaxInfo } from '../types';
import { SendIcon, ShieldCheckIcon, BoxIcon, RobotIcon } from '../components/Icons';
import { askAiAdvisor } from '../services/geminiService';

interface BusinessHubProps {
    profile: BusinessProfile;
    onUpdateProfile: (profile: BusinessProfile) => void;
    notes: any[]; 
    onUpdateNotes: (notes: any[]) => void;
    chatSessions: any[];
    onUpdateChatSessions: (sessions: any[]) => void;
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
}

const BusinessHub: React.FC<BusinessHubProps> = ({ profile, onUpdateProfile }) => {
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const updateInfo = (key: keyof BusinessInfo, value: string) => {
        onUpdateProfile({ ...profile, info: { ...profile.info, [key]: value } });
    };

    const updateTax = (key: keyof TaxInfo, value: string) => {
        onUpdateProfile({ ...profile, tax: { ...profile.tax, [key]: value } });
    };

    const handleAskAi = async () => {
        if (!aiQuery.trim() || isAiLoading) return;
        setIsAiLoading(true);
        try {
            const prompt = `Based on my business profile: ${JSON.stringify(profile)}, ${aiQuery}`;
            const response = await askAiAdvisor(prompt);
            setAiResponse(response);
        } catch (e) {
            setAiResponse("I encountered an error processing your query.");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Business Hub</h1>
                    <p className="text-sm text-slate-500">Legal Entity Identity & Compliance.</p>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden pb-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                    <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><ShieldCheckIcon className="w-6 h-6 text-indigo-600" /> Legal Entity</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Name</label><input type="text" value={profile.info.llcName || ''} onChange={e => updateInfo('llcName', e.target.value)} className="w-full font-bold" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Structure</label><select value={profile.info.businessType || ''} onChange={e => updateInfo('businessType', e.target.value)} className="w-full font-bold"><option value="">Select...</option><option value="sole-prop">Sole Prop</option><option value="single-llc">SMLLC</option><option value="multi-llc">Multi-LLC</option><option value="s-corp">S-Corp</option></select></div>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><BoxIcon className="w-6 h-6 text-emerald-600" /> Tax Profile</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filing Status</label><select value={profile.tax.filingStatus || ''} onChange={e => updateTax('filingStatus', e.target.value)} className="w-full font-bold"><option value="">Select...</option><option value="individual">Individual</option><option value="s-corp">S-Corp</option></select></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Accountant</label><input type="text" value={profile.tax.accountantName || ''} onChange={e => updateTax('accountantName', e.target.value)} className="w-full font-bold" /></div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col gap-6 relative overflow-hidden shadow-xl">
                        <div className="relative z-10 flex flex-col h-full">
                            <h3 className="font-black uppercase tracking-tight flex items-center gap-2 mb-4"><RobotIcon className="w-6 h-6 text-indigo-400" /> Advisor</h3>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 text-sm leading-relaxed text-slate-300 bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                                {aiResponse ? <div dangerouslySetInnerHTML={{ __html: aiResponse.replace(/\n/g, '<br/>') }} /> : <p className="italic text-slate-500">Ask about tax strategy or compliance deadlines...</p>}
                            </div>
                            <div className="space-y-3">
                                <textarea value={aiQuery} onChange={e => setAiQuery(e.target.value)} className="w-full bg-white/5 border-white/10 text-white rounded-xl text-xs p-3 focus:border-indigo-500 transition-all placeholder:text-slate-600 min-h-[100px] resize-none" placeholder="How should I handle estimated payments?" />
                                <button onClick={handleAskAi} disabled={isAiLoading || !aiQuery.trim()} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-30">
                                    {isAiLoading ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin"></div> : <SendIcon className="w-4 h-4" />} Consult
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessHub;
