import React from 'react';
import { Bell, Search, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="h-16 bg-surface-900/80 backdrop-blur-md border-b border-slate-800/80 px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Search Input */}
      <div className="relative w-72">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search templates & docs..."
          className="w-full bg-slate-950/60 text-slate-200 text-sm rounded-lg pl-9 pr-4 py-1.5 border border-slate-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-slate-500"
        />
      </div>

      {/* User profile / Status */}
      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="w-2 h-2 rounded-full bg-brand-500 absolute top-1.5 right-1.5"></span>
        </button>
        <div className="h-6 w-[1px] bg-slate-800"></div>
        <div className="flex items-center gap-3 pl-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
            JD
          </div>
          <div className="text-xs">
            <p className="font-medium text-slate-200">Legal Automation Admin</p>
            <p className="text-slate-500">Enterprise License</p>
          </div>
        </div>
      </div>
    </header>
  );
};
