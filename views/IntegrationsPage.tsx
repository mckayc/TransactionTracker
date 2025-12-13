

import React from 'react';
import { PuzzleIcon, ArrowRightIcon, BoxIcon, YoutubeIcon } from '../components/Icons';

interface IntegrationsPageProps {
    onNavigate: (view: 'integration-amazon' | 'integration-youtube') => void;
}

const IntegrationCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    status: 'active' | 'inactive';
    onClick: () => void;
}> = ({ title, description, icon, status, onClick }) => {
    return (
        <div 
            onClick={onClick}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col h-full"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {icon}
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded-full uppercase ${status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {status}
                </span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-sm text-slate-600 flex-grow">{description}</p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-indigo-600 font-medium text-sm gap-1 group-hover:gap-2 transition-all">
                <span>Open Integration</span>
                <ArrowRightIcon className="w-4 h-4" />
            </div>
        </div>
    );
};

const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ onNavigate }) => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Integrations</h1>
                <p className="text-slate-500 mt-1">Connect external platforms to track income and performance metrics alongside your finances.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <IntegrationCard 
                    title="Amazon Influencer" 
                    description="Import commission reports, track clicks, and analyze top-performing products from the Amazon Associates program."
                    icon={<BoxIcon className="w-8 h-8" />}
                    status="active"
                    onClick={() => onNavigate('integration-amazon')}
                />

                <IntegrationCard 
                    title="YouTube Analytics" 
                    description="Track estimated revenue, views, subscribers, and watch time performance by video."
                    icon={<YoutubeIcon className="w-8 h-8" />}
                    status="active"
                    onClick={() => onNavigate('integration-youtube')}
                />
                
                {/* Future placeholders */}
                <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center opacity-70">
                    <div className="p-3 bg-slate-200 rounded-lg text-slate-400 mb-3">
                        <PuzzleIcon className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-slate-600">More Coming Soon</h3>
                    <p className="text-xs text-slate-500 mt-1">Etsy, Shopify, and more.</p>
                </div>
            </div>
        </div>
    );
};

export default IntegrationsPage;