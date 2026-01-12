import React from 'react';
import type { FinancialPlan } from '../../types';
import { RobotIcon, SparklesIcon } from '../Icons';

interface Props {
    plan: FinancialPlan | null;
}

export const AiInsightsWidget: React.FC<Props> = ({ plan }) => {
    return (
        <div className="p-6 space-y-4 flex flex-col h-full bg-indigo-900 text-white relative">
            <div className="relative z-10 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {plan ? (
                        <p className="text-sm text-indigo-100 leading-relaxed italic line-clamp-6">
                            "{plan.strategy.split('\n')[0] || plan.strategy}"
                        </p>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                            <RobotIcon className="w-8 h-8 text-indigo-400 opacity-50" />
                            <p className="text-xs text-indigo-300 font-medium">No strategy generated yet.</p>
                        </div>
                    )}
                </div>
            </div>
            <SparklesIcon className="absolute -right-12 -top-12 w-48 h-48 opacity-10 text-indigo-400 pointer-events-none" />
        </div>
    );
};
