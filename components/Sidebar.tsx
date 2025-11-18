
import React from 'react';
import CalendarView from './CalendarView';
import type { Transaction } from '../types';
import { DashboardIcon, TableIcon, CalendarIcon, CreditCardIcon, ChartPieIcon, SettingsIcon, TasksIcon, LinkIcon, UsersIcon, TagIcon, UserGroupIcon, WizardIcon } from './Icons';

type View = 'dashboard' | 'transactions' | 'calendar' | 'accounts' | 'reports' | 'settings' | 'tasks' | 'rules' | 'payees' | 'categories' | 'users' | 'hub';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  transactions: Transaction[];
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, transactions }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { id: 'transactions', label: 'Transactions', icon: TableIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'reports', label: 'Reports', icon: ChartPieIcon },
    { id: 'hub', label: 'Business Hub', icon: WizardIcon },
    { id: 'tasks', label: 'Tasks', icon: TasksIcon },
    { id: 'accounts', label: 'Accounts', icon: CreditCardIcon },
    { id: 'users', label: 'Users', icon: UserGroupIcon },
    { id: 'payees', label: 'Payees', icon: UsersIcon },
    { id: 'categories', label: 'Categories', icon: TagIcon },
    { id: 'rules', label: 'Rules', icon: LinkIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="bg-slate-800 text-slate-300 w-64 p-4 flex flex-col fixed inset-y-0">
      <div>
        <div className="flex items-center space-x-3 mb-8 px-2 pt-2">
            <svg className="h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.75A.75.75 0 013 4.5h.75m0 0A.75.75 0 014.5 6v.75m0 0v-.75A.75.75 0 014.5 4.5h.75m0 0A.75.75 0 016 6v.75m0 0v-.75A.75.75 0 016 4.5h.75m0 0A.75.75 0 017.5 6v.75m0 0v-.75A.75.75 0 017.5 4.5h.75m0 0A.75.75 0 019 6v.75m0 0v-.75A.75.75 0 019 4.5h.75m0 0a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75h.75m0 0a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75H15M21.75 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-xl font-bold text-white">FinParser</h1>
        </div>
        <nav className="px-2">
          <ul className="space-y-1">
            {navItems.map(item => (
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
          </ul>
        </nav>
      </div>
      <CalendarView transactions={transactions} />
    </aside>
  );
};

export default Sidebar;
