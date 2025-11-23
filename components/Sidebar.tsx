
import React, { useState } from 'react';
import CalendarView from './CalendarView';
import type { Transaction } from '../types';
import { DashboardIcon, TableIcon, CalendarIcon, CreditCardIcon, ChartPieIcon, SettingsIcon, TasksIcon, LinkIcon, UsersIcon, TagIcon, UserGroupIcon, WizardIcon, DocumentIcon, WrenchIcon } from './Icons';

type View = 'dashboard' | 'transactions' | 'calendar' | 'accounts' | 'reports' | 'settings' | 'tasks' | 'rules' | 'payees' | 'categories' | 'tags' | 'users' | 'hub' | 'documents';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  transactions: Transaction[];
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, transactions }) => {
  const [isManagementOpen, setIsManagementOpen] = useState(false);

  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { id: 'transactions', label: 'Transactions', icon: TableIcon },
    { id: 'documents', label: 'Documents', icon: DocumentIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'tasks', label: 'Tasks', icon: TasksIcon },
    { id: 'reports', label: 'Reports', icon: ChartPieIcon },
    { id: 'hub', label: 'Business Hub', icon: WizardIcon },
  ];

  const managementNavItems = [
    { id: 'accounts', label: 'Accounts', icon: CreditCardIcon },
    { id: 'users', label: 'Users', icon: UserGroupIcon },
    { id: 'payees', label: 'Payees', icon: UsersIcon },
    { id: 'categories', label: 'Categories', icon: TagIcon },
    { id: 'tags', label: 'Tags', icon: TagIcon },
    { id: 'rules', label: 'Rules', icon: LinkIcon },
  ];

  return (
    <aside className="bg-slate-800 text-slate-300 w-64 p-4 flex flex-col fixed inset-y-0 h-full overflow-y-auto">
      <div>
        <div className="flex items-center space-x-3 mb-8 px-2 pt-2">
            <svg className="h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.75A.75.75 0 013 4.5h.75m0 0A.75.75 0 014.5 6v.75m0 0v-.75A.75.75 0 016 4.5h.75m0 0A.75.75 0 017.5 6v.75m0 0v-.75A.75.75 0 017.5 4.5h.75m0 0A.75.75 0 019 6v.75m0 0v-.75A.75.75 0 019 4.5h.75m0 0a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75H15M21.75 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-xl font-bold text-white">FinParser</h1>
        </div>
        <nav className="px-2">
          <ul className="space-y-1">
            {mainNavItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id as View)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === item.id
                      ? 'bg-slate-900 text-white'
                      : 'hover:bg-slate-700'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
            
            {/* Collapsible Management Section */}
            <li className="pt-4 pb-1">
                <button 
                    onClick={() => setIsManagementOpen(!isManagementOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase font-bold text-slate-500 hover:text-slate-300"
                >
                    <span>Management</span>
                    <svg className={`w-4 h-4 transition-transform ${isManagementOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </li>
            
            {isManagementOpen && managementNavItems.map(item => (
                <li key={item.id}>
                    <button
                    onClick={() => onNavigate(item.id as View)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentView === item.id
                        ? 'bg-slate-900 text-white'
                        : 'hover:bg-slate-700'
                    }`}
                    >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    </button>
                </li>
            ))}

            <li className="pt-4">
               <button
                  onClick={() => onNavigate('settings')}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'settings'
                      ? 'bg-slate-900 text-white'
                      : 'hover:bg-slate-700'
                  }`}
                >
                  <SettingsIcon className="w-5 h-5" />
                  <span>Settings</span>
                </button>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mt-auto pt-4">
          <CalendarView transactions={transactions} />
      </div>
    </aside>
  );
};

export default Sidebar;
