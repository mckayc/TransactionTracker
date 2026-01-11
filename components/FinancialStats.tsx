
import React from 'react';
import { InfoIcon, ChevronRightIcon } from './Icons';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

interface MetricPillProps {
    label: string;
    value: number;
    color: string;
    icon: React.ReactNode;
    isLoading?: boolean;
    onClick?: () => void;
}

export const MetricPill: React.FC<MetricPillProps> = ({ label, value, color, icon, isLoading, onClick }) => (
    <button 
        onClick={onClick}
        disabled={isLoading}
        className={`flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm min-w-[140px] text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-95 group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
        <div className={`p-2 rounded-lg ${color} bg-opacity-10 transition-colors group-hover:bg-opacity-20`}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
                {onClick && <InfoIcon className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            {isLoading ? (
                <div className="h-5 w-16 bg-slate-100 animate-pulse rounded mt-0.5" />
            ) : (
                <p className={`text-sm font-black ${color} truncate`}>
                    {formatCurrency(Math.abs(value))}
                </p>
            )}
        </div>
    </button>
);

interface SummaryWidgetProps {
    title: string;
    value: string | number;
    helpText: string;
    colorClass?: string;
    isFocus?: boolean;
    onClick: () => void;
    isCurrency?: boolean;
}

export const SummaryWidget: React.FC<SummaryWidgetProps> = ({ title, value, helpText, colorClass = "text-slate-800", isFocus, onClick, isCurrency = true }) => (
    <button 
        onClick={onClick}
        className={`bg-white p-3 rounded-xl shadow-sm border text-left transition-all duration-300 group hover:border-indigo-400 hover:shadow-md ${isFocus ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}
    >
        <div className="flex justify-between items-center mb-0.5">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
            <ChevronRightIcon className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className={`text-xl font-bold ${colorClass}`}>
            {typeof value === 'number' && isCurrency ? formatCurrency(value) : value}
        </p>
        <p className={`text-[9px] font-medium mt-0.5 truncate ${isFocus ? 'text-indigo-600' : 'text-slate-400'}`}>{helpText}</p>
    </button>
);
