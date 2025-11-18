
import React, { useState } from 'react';
import type { BusinessProfile, BusinessInfo, TaxInfo } from '../types';
import { CheckCircleIcon, SparklesIcon } from '../components/Icons';
import { askAiAdvisor } from '../services/geminiService';

interface BusinessWizardProps {
    profile: BusinessProfile;
    onUpdateProfile: (profile: BusinessProfile) => void;
}

const STEPS = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'structure', title: 'Structure' },
    { id: 'details', title: 'Details' },
    { id: 'tax', title: 'Tax Setup' },
    { id: 'summary', title: 'Summary' }
];

const AiAssistant: React.FC<{ prompt: string; buttonText: string }> = ({ prompt, buttonText }) => {
    const [response, setResponse] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAsk = async () => {
        setLoading(true);
        try {
            const text = await askAiAdvisor(prompt);
            setResponse(text);
        } catch (e) {
            setResponse("Sorry, I'm having trouble connecting to the AI right now.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <div className="flex items-center gap-2 mb-2">
                <SparklesIcon className="w-5 h-5 text-indigo-600" />
                <span className="font-semibold text-indigo-800">AI Assistant</span>
            </div>
            {!response && !loading && (
                <button onClick={handleAsk} className="text-sm text-indigo-600 hover:underline font-medium">
                    {buttonText}
                </button>
            )}
            {loading && <p className="text-sm text-slate-500 italic">Thinking...</p>}
            {response && (
                <div className="text-sm text-slate-700 prose prose-sm max-w-none">
                    {response.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                </div>
            )}
        </div>
    );
};

const BusinessWizard: React.FC<BusinessWizardProps> = ({ profile, onUpdateProfile }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    
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

    const nextStep = () => {
        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
            window.scrollTo(0,0);
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) setCurrentStepIndex(currentStepIndex - 1);
    };

    const currentStepId = STEPS[currentStepIndex].id;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
             <div>
                <h1 className="text-3xl font-bold text-slate-800">Business Setup Wizard</h1>
                <p className="text-slate-500 mt-1">A step-by-step guide to getting your business finances ready.</p>
            </div>

            {/* Progress Bar */}
            <div className="flex justify-between mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
                {STEPS.map((step, index) => {
                    const isCompleted = index < currentStepIndex;
                    const isActive = index === currentStepIndex;
                    return (
                        <div key={step.id} className="flex flex-col items-center bg-slate-100 px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : isCompleted ? 'bg-green-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                                {isCompleted ? <CheckCircleIcon className="w-5 h-5" /> : index + 1}
                            </div>
                            <span className={`text-xs mt-2 font-medium ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>{step.title}</span>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                
                {currentStepId === 'welcome' && (
                    <div className="flex-grow space-y-6 text-center">
                        <h2 className="text-2xl font-bold text-slate-800">Let's Get Organized</h2>
                        <p className="text-slate-600 max-w-lg mx-auto">
                            Setting up a business entity (like an LLC) and preparing for taxes can be daunting. 
                            This wizard will help you record the necessary information and understand what is required.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto mt-8">
                            <div className="p-4 border rounded-lg bg-slate-50">
                                <h3 className="font-semibold text-slate-700">Entity Formation</h3>
                                <p className="text-sm text-slate-500">We'll record your LLC details, EIN, and formation dates.</p>
                            </div>
                            <div className="p-4 border rounded-lg bg-slate-50">
                                <h3 className="font-semibold text-slate-700">Tax Preparation</h3>
                                <p className="text-sm text-slate-500">We'll help you identify your filing status and key dates.</p>
                            </div>
                        </div>
                    </div>
                )}

                {currentStepId === 'structure' && (
                    <div className="flex-grow space-y-6">
                        <h2 className="text-xl font-bold text-slate-700">Business Structure</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Legal Entity Type</label>
                                    <select 
                                        value={profile.info.businessType || ''} 
                                        onChange={(e) => updateInfo('businessType', e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                    >
                                        <option value="">Select Type...</option>
                                        <option value="sole-proprietorship">Sole Proprietorship (No formal entity)</option>
                                        <option value="llc-single">Single-Member LLC</option>
                                        <option value="llc-multi">Multi-Member LLC</option>
                                        <option value="s-corp">S-Corporation</option>
                                        <option value="c-corp">C-Corporation</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Industry / Business Activity</label>
                                    <input 
                                        type="text" 
                                        value={profile.info.industry || ''} 
                                        onChange={(e) => updateInfo('industry', e.target.value)}
                                        placeholder="e.g., Graphic Design, E-commerce"
                                        className="w-full p-2 border rounded-md"
                                    />
                                </div>
                            </div>
                            <div>
                                <AiAssistant 
                                    buttonText="Help me decide on a structure" 
                                    prompt="Explain the main tax and liability differences between a Sole Proprietorship, a Single-Member LLC, and an S-Corp for a small business owner in simple terms."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {currentStepId === 'details' && (
                    <div className="flex-grow space-y-6">
                        <h2 className="text-xl font-bold text-slate-700">Entity Details</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Legal Business Name</label>
                                    <input 
                                        type="text" 
                                        value={profile.info.llcName || ''} 
                                        onChange={(e) => updateInfo('llcName', e.target.value)}
                                        placeholder="My Business LLC"
                                        className="w-full p-2 border rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">State of Formation</label>
                                    <input 
                                        type="text" 
                                        value={profile.info.stateOfFormation || ''} 
                                        onChange={(e) => updateInfo('stateOfFormation', e.target.value)}
                                        placeholder="e.g., Delaware, Wyoming"
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
                                 <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">EIN (Employer Identification Number)</label>
                                    <input 
                                        type="text" 
                                        value={profile.info.ein || ''} 
                                        onChange={(e) => updateInfo('ein', e.target.value)}
                                        placeholder="XX-phishing-redacted"
                                        className="w-full p-2 border rounded-md"
                                    />
                                </div>
                            </div>
                             <div>
                                <AiAssistant 
                                    buttonText="Why do I need an EIN?" 
                                    prompt="Explain why a small business might need an Employer Identification Number (EIN) even if they don't have employees. Mention banking and privacy."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {currentStepId === 'tax' && (
                    <div className="flex-grow space-y-6">
                        <h2 className="text-xl font-bold text-slate-700">Tax Preparation</h2>
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Accountant Name / Contact</label>
                                    <input 
                                        type="text" 
                                        value={profile.tax.accountantName || ''} 
                                        onChange={(e) => updateTax('accountantName', e.target.value)}
                                        placeholder="Optional"
                                        className="w-full p-2 border rounded-md"
                                    />
                                </div>
                            </div>
                            <div>
                                <AiAssistant 
                                    buttonText="What are estimated taxes?" 
                                    prompt="Explain estimated quarterly taxes for small business owners in the US. Who needs to pay them and when are they generally due?"
                                />
                            </div>
                        </div>
                    </div>
                )}

                 {currentStepId === 'summary' && (
                    <div className="flex-grow space-y-6">
                        <h2 className="text-xl font-bold text-slate-700">Business Profile Summary</h2>
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Entity Name</p>
                                    <p className="font-medium">{profile.info.llcName || 'Not set'}</p>
                                </div>
                                 <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Type</p>
                                    <p className="font-medium capitalize">{profile.info.businessType?.replace('-', ' ') || 'Not set'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">EIN</p>
                                    <p className="font-medium">{profile.info.ein || 'Not set'}</p>
                                </div>
                                 <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">State</p>
                                    <p className="font-medium">{profile.info.stateOfFormation || 'Not set'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Tax Status</p>
                                    <p className="font-medium capitalize">{profile.tax.filingStatus?.replace('-', ' ') || 'Not set'}</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-slate-600">
                            Your information is saved locally in your browser. You can return here anytime to update it.
                        </p>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="mt-8 flex justify-between pt-4 border-t border-slate-100">
                    <button 
                        onClick={prevStep} 
                        disabled={currentStepIndex === 0}
                        className="px-6 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Back
                    </button>
                    <button 
                        onClick={nextStep} 
                        disabled={currentStepIndex === STEPS.length - 1}
                        className={`px-6 py-2 rounded-lg font-medium text-white shadow-md transition-colors ${currentStepIndex === STEPS.length - 1 ? 'bg-green-600 cursor-default' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {currentStepIndex === STEPS.length - 1 ? 'Finished' : 'Next Step'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BusinessWizard;
