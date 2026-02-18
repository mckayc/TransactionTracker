import React from 'react';
import type { View } from '../../types';
import { PuzzleIcon, ArrowRightIcon, BoxIcon, YoutubeIcon, WorkflowIcon } from '../../components/Icons';

interface IntegrationsPageProps {
    onNavigate: (view: View) => void;
}

const IntegrationCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    status: 'active' | 'inactive';
    onClick: () => void;
    variant?: 'primary' | 'secondary';
}> = ({ title, description, icon, status, onClick, variant = 'secondary' }) => {
    return (
        <div 
            onClick={onClick}
            className={`p-6 rounded-xl shadow-sm border transition-all cursor-pointer group flex flex-col h-full ${variant === 'primary' ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-200' : 'bg-white border-slate-200 hover:shadow-md hover:border-indigo-300'}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg transition-colors ${variant === 'primary' ? 'bg-white/20 text-white group-hover:bg-white group-hover:text-indigo-600' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                    {icon}
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded-full uppercase ${status === 'active' ? (variant === 'primary' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700') : 'bg-slate-100 text-slate-500'}`}>
                    {status}
                </span>
            </div>
            <h3 className={`text-lg font-bold mb-2 ${variant === 'primary' ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
            <p className={`text-sm flex-grow ${variant === 'primary' ? 'text-indigo-100' : 'text-slate-600'}`}>{description}</p>
            <div className={`mt-4 pt-4 border-t flex items-center font-medium text-sm gap-1 group-hover:gap-2 transition-all ${variant === 'primary' ? 'border-white/20 text-white' : 'border-slate-100 text-indigo-600'}`}>
                <span>Open Project Hub</span>
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
                <p className="text-slate-500 mt-1">Connect platforms and analyze your Content ROI across ecosystems.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <IntegrationCard 
                    title="Product & ASIN Joiner" 
                    description="The ultimate content ROI workspace. Create isolated project batches to link YouTube performance with Amazon onsite, offsite, and Creator Connection revenue."
                    icon={<WorkflowIcon className="w-8 h-8" />}
                    status="active"
                    variant="primary"
                    onClick={() => onNavigate('integration-product-joiner')}
                />

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
            </div>
        </div>
    );
};

export default IntegrationsPage;