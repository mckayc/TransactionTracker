
import React, { useState } from 'react';
import CalendarView from './CalendarView';
import type { Transaction } from '../types';
import { DashboardIcon, TableIcon, CalendarIcon, CreditCardIcon, ChartPieIcon, SettingsIcon, TasksIcon, LinkIcon, UsersIcon, TagIcon, UserGroupIcon, WizardIcon, DocumentIcon, WrenchIcon, ChatBubbleIcon, ChevronLeftIcon, ChevronRightIcon, PuzzleIcon, LightBulbIcon } from './Icons';

type View = 'dashboard' | 'transactions' | 'calendar' | 'accounts' | 'reports' | 'settings' | 'tasks' | 'rules' | 'payees' | 'categories' | 'tags' | 'users' | 'hub' | 'documents' | 'plan' | 'integrations' | 'integration-amazon' | 'integration-youtube';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  transactions: Transaction[];
  onChatToggle?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, transactions, onChatToggle, isCollapsed = false, onToggleCollapse }) => {
  const [isManagementOpen, setIsManagementOpen] = useState(false);

  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { id: 'transactions', label: 'Transactions', icon: TableIcon },
    { id: 'documents', label: 'Documents', icon: DocumentIcon },
    { id: 'plan', label: 'Financial Plan', icon: LightBulbIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'tasks', label: 'Tasks', icon: TasksIcon },
    { id: 'reports', label: 'Reports', icon: ChartPieIcon },
    { id: 'hub', label: 'Business Hub', icon: WizardIcon },
    { id: 'integrations', label: 'Integrations', icon: PuzzleIcon },
  ];

  const managementNavItems = [
    { id: 'accounts', label: 'Accounts', icon: CreditCardIcon },
    { id: 'users', label: 'Users', icon: UserGroupIcon },
    { id: 'payees', label: 'Payees', icon: UsersIcon },
    { id: 'categories', label: 'Categories', icon: TagIcon },
    { id: 'tags', label: 'Tags', icon: TagIcon },
    { id: 'rules', label: 'Rules', icon: LinkIcon },
  ];

  const sidebarWidthClass = isCollapsed ? 'w-20' : 'w-64';

  return (
    <aside className={`bg-slate-800 text-slate-300 ${sidebarWidthClass} transition-all duration-300 flex flex-col fixed inset-y-0 h-full overflow-y-auto overflow-x-hidden z-40 border-r border-slate-700`}>
      <div>
        <div className={`flex items-center h-16 ${isCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-2xl filter drop-shadow-sm">💰</span>
                {!isCollapsed && <h1 className="text-sm font-bold text-slate-100 uppercase tracking-widest truncate font-mono">Transaction<br/>Tracker</h1>}
            </div>
            {onToggleCollapse && !isCollapsed && (
                <button onClick={onToggleCollapse} className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-700 transition-colors">
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
            )}
        </div>
        
        {isCollapsed && onToggleCollapse && (
            <div className="flex justify-center mb-2">
                <button onClick={onToggleCollapse} className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-700 transition-colors">
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            </div>
        )}

        <nav className="px-2 space-y-1 mt-2">
            {mainNavItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as View)}
                title={isCollapsed ? item.label : ''}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'space-x-3 px-3 py-2'} rounded-md text-sm font-medium transition-colors ${
                  currentView === item.id || (item.id === 'integrations' && currentView.startsWith('integration-'))
                    ? 'bg-slate-900 text-white'
                    : 'hover:bg-slate-700'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            ))}
            
            {/* Collapsible Management Section */}
            {!isCollapsed ? (
                <div className="pt-4 pb-1">
                    <button 
                        onClick={() => setIsManagementOpen(!isManagementOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase font-bold text-slate-500 hover:text-slate-300"
                    >
                        <span>Management</span>
                        <svg className={`w-4 h-4 transition-transform ${isManagementOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            ) : (
                <div className="my-2 border-t border-slate-700 pt-2"></div>
            )}
            
            {/* Show Management Items if expanded OR if sidebar is collapsed (icons only) */}
            {(isManagementOpen || isCollapsed) && managementNavItems.map(item => (
                <button
                key={item.id}
                onClick={() => onNavigate(item.id as View)}
                title={isCollapsed ? item.label : ''}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'space-x-3 px-3 py-2'} rounded-md text-sm font-medium transition-colors ${
                    currentView === item.id
                    ? 'bg-slate-900 text-white'
                    : 'hover:bg-slate-700'
                }`}
                >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
                </button>
            ))}

            <div className={!isCollapsed ? "pt-4" : "pt-2 border-t border-slate-700 mt-2"}>
               <button
                  onClick={() => onNavigate('settings')}
                  title={isCollapsed ? 'Settings' : ''}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'space-x-3 px-3 py-2'} rounded-md text-sm font-medium transition-colors ${
                    currentView === 'settings'
                      ? 'bg-slate-900 text-white'
                      : 'hover:bg-slate-700'
                  }`}
                >
                  <SettingsIcon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span>Settings</span>}
                </button>
            </div>
        </nav>
      </div>
      
      <div className={`mt-auto pt-4 space-y-4 ${isCollapsed ? 'px-2 pb-4' : 'px-4 pb-4'}`}>
          {onChatToggle && (
              <button 
                onClick={onChatToggle}
                title={isCollapsed ? 'AI Assistant' : ''}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'gap-3 px-5 py-3'} text-sm font-medium text-indigo-300 hover:text-white hover:bg-slate-700 transition-colors rounded-md`}
              >
                  <ChatBubbleIcon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
                  {!isCollapsed && <span>AI Assistant</span>}
              </button>
          )}
          {!isCollapsed && (
            <>
              <CalendarView transactions={transactions} />
              <div className="text-center pb-2">
                <span className="text-[10px] text-slate-500 font-mono opacity-70">v0.0.33</span>
              </div>
            </>
          )}
      </div>
    </aside>
  );
};

export default Sidebar;
