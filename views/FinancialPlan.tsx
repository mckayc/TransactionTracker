
import React, { useState, useMemo } from 'react';
import type { Transaction, Account, BusinessProfile, Category, TransactionType, Payee } from '../types';
import { getAiFinancialAnalysis } from '../services/geminiService';
// FIX: Using CurrencyDollarIcon as DollarSign is not exported from Icons.tsx. Removed unused Loader and BarChartIcon.
import { SparklesIcon, LightBulbIcon, ShieldCheckIcon, CurrencyDollarIcon, HeartIcon } from '../components/Icons';
import DonationModal from '../components/DonationModal';

interface FinancialPlanProps {
    transactions: Transaction[];
    accounts: Account[];
    profile: BusinessProfile;
    categories: Category[];
    transactionTypes: TransactionType[];
    payees: Payee[];
    onAddTransaction: (tx: Transaction) => void;
}

const FinancialPlan: React.FC<FinancialPlanProps> = ({ transactions, accounts, profile, categories, transactionTypes, payees, onAddTransaction }) => {
    const [plan, setPlan] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

    // Calculate basic metrics for AI prompt
    const metrics = useMemo(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        
        const monthlyTxs = transactions.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });

        const income = monthlyTxs.filter(t => t.typeId.includes('income')).reduce((sum, t) => sum + t.amount, 0);
        const expense = monthlyTxs.filter(t => t.typeId.includes('expense')).reduce((sum, t) => sum + t.amount, 0);

        return { income, expense, net: income - expense };
    }, [transactions]);

    const handleGeneratePlan = async () => {
        setIsLoading(true);
        setPlan('');
        
        try {
            const stream = await getAiFinancialAnalysis(
                "Create a structured 4-phase financial roadmap for me. Phase 1: Security (Emergency Fund), Phase 2: Optimization (Debt/Expenses), Phase 3: Tax Strategy (Business-specific), Phase 4: Legacy (Investing & Donations). Focus on my specific business type and current monthly cash flow.",
                { transactions, accounts, businessProfile: profile }
            );

            let fullContent = '';
            for await (const chunk of stream) {
                fullContent += chunk.text;
                setPlan(fullContent);
            }
        } catch (error) {
            setPlan("Failed to generate plan. Please verify your API key.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Financial Roadmap</h1>
                    <p className="text-slate-500 mt-1">AI-powered strategy based on your real-time data.</p>
                </div>
                <button 
                    onClick={handleGeneratePlan}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:-translate-y-1 disabled:opacity-50"
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isLoading ? 'Analyzing...' : 'Generate Plan'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 text-indigo-600 mb-2">
                        {/* FIX: Using CurrencyDollarIcon instead of non-exported DollarSign */}
                        <CurrencyDollarIcon className="w-6 h-6" />
                        <h3 className="font-bold">Monthly Snapshot</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Income</span>
                            <span className="font-bold text-emerald-600">+${metrics.income.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Expenses</span>
                            <span className="font-bold text-rose-600">-${metrics.expense.toLocaleString()}</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between font-bold">
                            <span>Net Cash Flow</span>
                            <span className={metrics.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                ${metrics.net.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 text-pink-600 mb-2">
                        <HeartIcon className="w-6 h-6" />
                        <h3 className="font-bold">Donation Tracker</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">Calculate and commit charitable giving based on net income.</p>
                    <button 
                        onClick={() => setIsDonationModalOpen(true)}
                        className="w-full py-2 bg-pink-50 text-pink-700 font-bold rounded-lg border border-pink-100 hover:bg-pink-100 transition-colors"
                    >
                        Commit Donations
                    </button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 text-amber-600 mb-2">
                        <ShieldCheckIcon className="w-6 h-6" />
                        <h3 className="font-bold">Tax Readiness</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">Business Type: <span className="font-bold text-slate-700">{profile.info.businessType || 'Not set'}</span></p>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 w-[65%]"></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Est. Tax Liability met: 65%</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 min-h-[400px] overflow-hidden">
                {!plan && !isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                        <div className="bg-indigo-50 p-6 rounded-full mb-6">
                            <LightBulbIcon className="w-12 h-12 text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Your Plan Awaits</h3>
                        <p className="text-slate-500 max-w-md mt-2">Click "Generate Plan" to have the AI analyze your {transactions.length} transactions and create a personalized financial roadmap.</p>
                    </div>
                ) : (
                    <div className="p-8 prose prose-indigo max-w-none">
                        {isLoading && !plan && (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            </div>
                        )}
                        <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: plan.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-900">$1</strong>').replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-slate-900 mt-6 mb-2">$1</h1>').replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-800 mt-4 mb-2">$1</h2>') }} />
                    </div>
                )}
            </div>

            <DonationModal 
                isOpen={isDonationModalOpen}
                onClose={() => setIsDonationModalOpen(false)}
                onSave={onAddTransaction}
                totalIncome={metrics.income}
                monthName={new Date().toLocaleString('default', { month: 'long' })}
                payees={payees}
                accounts={accounts}
                categories={categories}
                transactionTypes={transactionTypes}
            />
        </div>
    );
};

export default FinancialPlan;
