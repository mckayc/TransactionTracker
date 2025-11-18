import React, { useState, useMemo } from 'react';
import type { Transaction, DuplicatePair, Account } from '../types';

interface DuplicateReviewProps {
  duplicates: DuplicatePair[];
  onComplete: (duplicatesToImport: Transaction[]) => void;
  onCancel: () => void;
  accounts: Account[];
}

type Decision = 'import' | 'skip';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const TxCard: React.FC<{ title: string; tx: Transaction; accountName: string | undefined }> = ({ title, tx, accountName }) => (
    <div className="bg-white p-3 rounded-md border">
        <h4 className="text-sm font-semibold text-slate-600">{title}</h4>
        <div className="mt-2 text-sm space-y-1">
            <p><strong className="font-medium text-slate-500">Date:</strong> {tx.date}</p>
            <p><strong className="font-medium text-slate-500">Desc:</strong> {tx.description}</p>
            <p><strong className="font-medium text-slate-500">Amount:</strong> <span className="font-bold text-slate-800">{formatCurrency(tx.amount)}</span></p>
            <p><strong className="font-medium text-slate-500">Account:</strong> {accountName || 'N/A'}</p>
            {tx.sourceFilename && <p><strong className="font-medium text-slate-500">Source:</strong> <span className="truncate block" title={tx.sourceFilename}>{tx.sourceFilename}</span></p>}
        </div>
    </div>
);


const DuplicateReview: React.FC<DuplicateReviewProps> = ({ duplicates, onComplete, onCancel, accounts }) => {
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);

  const handleDecision = (txId: string, decision: Decision) => {
    setDecisions(prev => new Map(prev).set(txId, decision));
  };
  
  const handleFinish = () => {
    const toImport: Transaction[] = [];
    duplicates.forEach(pair => {
      // Default to skipping if no decision has been made
      const decision = decisions.get(pair.newTx.id) || 'skip';
      if (decision === 'import') {
        toImport.push(pair.newTx);
      }
    });
    onComplete(toImport);
  };
  
  const setAll = (decision: Decision) => {
    const newDecisions = new Map<string, Decision>();
    duplicates.forEach(pair => newDecisions.set(pair.newTx.id, decision));
    setDecisions(newDecisions);
  };

  const undecidedCount = duplicates.filter(d => !decisions.has(d.newTx.id)).length;

  return (
    <div className="space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h2 className="text-lg font-bold text-amber-800">Review Potential Duplicates ({duplicates.length} found)</h2>
            <p className="text-sm text-amber-700 mt-1">We found transactions in your import that are very similar to existing ones. Please review each pair and decide whether to import or skip the new transaction. By default, all duplicates will be skipped.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-3 bg-slate-50 rounded-lg border">
            <div className="flex items-center gap-3">
                <button onClick={() => setAll('import')} className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200">Import All</button>
                <button onClick={() => setAll('skip')} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300">Skip All</button>
                <p className="text-sm text-slate-500">{undecidedCount} undecided</p>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border rounded-lg hover:bg-slate-50">Cancel Import</button>
                <button onClick={handleFinish} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Finish & Import</button>
            </div>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {duplicates.map(pair => {
                const decision = decisions.get(pair.newTx.id);
                return (
                    <div key={pair.newTx.id} className={`p-4 rounded-lg border-2 transition-colors ${decision === 'import' ? 'bg-green-50 border-green-400' : decision === 'skip' ? 'bg-red-50 border-red-400' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <TxCard title="New Transaction (from import)" tx={pair.newTx} accountName={accountMap.get(pair.newTx.accountId || '')} />
                           <TxCard title="Existing Transaction" tx={pair.existingTx} accountName={accountMap.get(pair.existingTx.accountId || '')} />
                        </div>
                        <div className="flex justify-end gap-3 mt-3">
                            <button 
                                onClick={() => handleDecision(pair.newTx.id, 'skip')} 
                                className={`px-4 py-2 text-sm font-semibold rounded-lg ${decision === 'skip' ? 'bg-red-600 text-white' : 'bg-white hover:bg-slate-100 border'}`}
                            >
                                Skip
                            </button>
                             <button 
                                onClick={() => handleDecision(pair.newTx.id, 'import')}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg ${decision === 'import' ? 'bg-green-600 text-white' : 'bg-white hover:bg-slate-100 border'}`}
                            >
                                Import Anyway
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default DuplicateReview;