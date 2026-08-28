import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  PlayCircle,
  FileCheck,
  Settings,
  Sparkles,
  Layers,
  Users,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Templates', href: '/templates', icon: Layers },
  { name: 'Process Document', href: '/process', icon: PlayCircle },
  { name: 'Generated Documents', href: '/documents', icon: FileCheck },
  { name: 'User Logins', href: '/admin/users', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-surface-900 border-r border-slate-800/80 flex flex-col h-screen sticky top-0 z-30">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-lg text-white tracking-wide">DocAuto</span>
          <span className="text-xs font-semibold px-1.5 py-0.5 ml-1.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
            AI
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* System Badge */}
      <div className="p-4 m-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <span>Hugging Face AI Engine Ready</span>
      </div>
    </aside>
  );
};
