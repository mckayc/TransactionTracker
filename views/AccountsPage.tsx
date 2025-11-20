
import React, { useState, useMemo } from 'react';
import type { Account, AccountType } from '../types';
import { DeleteIcon } from '../components/Icons';
import { generateUUID } from '../utils';

interface AccountsPageProps {
    accounts: Account[];
    onAddAccount: (account: Account) => void;
    onRemoveAccount: (accountId: string) => void;
    accountTypes: AccountType[];
    onAddAccountType: (profile: AccountType) => void;
    onRemoveAccountType: (profileId: string) => void;
}

const Section: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <details className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 open:ring-2 open:ring-indigo-500" open>
        <summary className="text-xl font-bold text-slate-700 cursor-pointer">{title}</summary>
        <div className="mt-4">
            {children}
        </div>
    </details>
);

const AccountsPage: React.FC<AccountsPageProps> = ({ accounts, onAddAccount, onRemoveAccount, accountTypes, onAddAccountType, onRemoveAccountType }) => {
    const [accountName, setAccountName] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [accountTypeId, setAccountTypeId] = useState('');
    const [newTypeName, setNewTypeName] = useState('');

    const accountTypeMap = useMemo(() => new Map(accountTypes.map(type => [type.id, type])), [accountTypes]);
    const usedAccountTypes = useMemo(() => new Set(accounts.map(acc => acc.accountTypeId)), [accounts]);

    const handleAddAccountSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (accountName.trim() && identifier.trim() && accountTypeId) {
            const newAccount: Account = {
                id: generateUUID(),
                name: accountName.trim(),
                identifier: identifier.trim(),
                accountTypeId: accountTypeId,
            };
            onAddAccount(newAccount);
            setAccountName('');
            setIdentifier('');
            setAccountTypeId('');
        }
    };
    
    const handleAddTypeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTypeName.trim()) {
            const newType: AccountType = {
                id: generateUUID(),
                name: newTypeName.trim(),
                isDefault: false,
            };
            onAddAccountType(newType);
            setNewTypeName('');
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Accounts</h1>
                <p className="text-slate-500 mt-1">Manage your financial accounts and their types.</p>
            </div>
            
            <div className="space-y-6">
                <Section title="Accounts">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Add New Account</h3>
                            <form onSubmit={handleAddAccountSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="accountName" className="block text-sm font-medium text-slate-700">Account Name</label>
                                    <input type="text" id="accountName" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="e.g., Chase Checking, Amex Gold" className="mt-1" required />
                                </div>
                                <div>
                                    <label htmlFor="identifier" className="block text-sm font-medium text-slate-700">Identifier</label>
                                    <input type="text" id="identifier" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="e.g., Last 4 digits '1234'" className="mt-1" required />
                                </div>
                                <div>
                                    <label htmlFor="accountType" className="block text-sm font-medium text-slate-700">Account Type</label>
                                     <select id="accountType" value={accountTypeId} onChange={e => setAccountTypeId(e.target.value)} required>
                                        <option value="" disabled>Select a type...</option>
                                        {accountTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                    </select>
                                    {accountTypes.length === 0 && <p className="text-xs text-slate-500 mt-1">You must add an Account Type first.</p>}
                                </div>
                                <button type="submit" className="w-full sm:w-auto px-6 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                                    Add Account
                                </button>
                            </form>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Your Accounts</h3>
                            {accounts.length > 0 ? (
                                <ul className="space-y-3">
                                    {accounts.map(account => (
                                        <li key={account.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <div>
                                                <p className="font-medium text-slate-800">{account.name}</p>
                                                <p className="text-sm text-slate-500">{accountTypeMap.get(account.accountTypeId)?.name} • {account.identifier}</p>
                                            </div>
                                            <button onClick={() => onRemoveAccount(account.id)} className="text-red-500 hover:text-red-700 font-medium text-sm">
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-center text-slate-500 py-8">You haven't added any accounts yet.</p>
                            )}
                        </div>
                    </div>
                </Section>
                
                 <Section title="Account Types">
                    <p className="text-sm text-slate-600 mb-4">Define the types of accounts you use, such as "Bank", "Credit Card", or "Loan".</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Add New Type</h3>
                            <form onSubmit={handleAddTypeSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="newTypeName" className="block text-sm font-medium text-slate-700">Type Name</label>
                                    <input type="text" id="newTypeName" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="e.g., Loan, Investment" className="mt-1" required />
                                </div>
                                <button type="submit" className="w-full sm:w-auto px-6 py-2 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                                    Add Type
                                </button>
                            </form>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Your Account Types</h3>
                            {accountTypes.length > 0 ? (
                                <ul className="space-y-3">
                                    {accountTypes.map(type => {
                                        const isUsed = usedAccountTypes.has(type.id);
                                        const canBeDeleted = !type.isDefault && !isUsed;
                                        return (
                                            <li key={type.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                <div>
                                                    <p className="font-medium text-slate-800">{type.name}</p>
                                                    {type.isDefault && <p className="text-xs text-slate-400">Default</p>}
                                                </div>
                                                <button 
                                                    onClick={() => onRemoveAccountType(type.id)}
                                                    disabled={!canBeDeleted}
                                                    className="text-red-500 hover:text-red-700 disabled:text-slate-400 disabled:cursor-not-allowed font-medium text-sm"
                                                    title={type.isDefault ? "Cannot delete a default type." : isUsed ? "Cannot delete a type that is in use." : "Delete type"}
                                                >
                                                    Remove
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="text-center text-slate-500 py-8">No account types found.</p>
                            )}
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
};

export default React.memo(AccountsPage);
