import React from 'react';
import {
  Users,
  History as HistoryIcon,
  Wallet as WalletIcon,
  Plus,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  activeTab: 'workspace' | 'clients' | 'qa' | 'templates' | 'studio' | 'history' | 'wallet' | 'admin';
  onSelectTab: (tab: 'workspace' | 'clients' | 'qa' | 'templates' | 'studio' | 'history' | 'wallet' | 'admin') => void;
  onOpenHelpModal: () => void;
  onOpenBatchModal?: () => void;
  onOpenMetricsModal?: () => void;
  onOpenWalletModal?: () => void;
  onSwitchToUser?: () => void;
  onLogout?: () => void;
  onResetSession: () => void;
  isHealthOk?: boolean;
  onOpenBackendSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  onOpenHelpModal,
  onOpenWalletModal,
  onSwitchToUser,
  onLogout,
  onResetSession,
  isHealthOk = true,
  onOpenBackendSettings,
}) => {
  const isUserAdmin = user?.role === 'ADMIN' || user?.is_admin === true;
  const displayBalance = user?.wallet_balance ?? 0.0;

  return (
    <header className="border-b border-slate-800/80 bg-[#070a13] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('workspace')}
            className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none"
          >
            {/* Minimal Legal Monogram Mark */}
            <div className="w-7 h-7 rounded border border-slate-700 bg-[#0b0f19] flex items-center justify-center text-slate-200 group-hover:border-amber-500/50 transition-colors">
              <span className="font-serif font-bold text-xs tracking-wider text-amber-400">§</span>
            </div>
            <div className="flex items-baseline">
              <span className="font-semibold text-sm tracking-tight text-white group-hover:text-slate-200 transition-colors">
                LexTitle
              </span>
              <span className="text-[10px] font-bold text-amber-400 tracking-wider ml-1">AI</span>
            </div>
          </button>

          {/* Status Dot & Backend Connection Settings trigger */}
          <button
            type="button"
            onClick={onOpenBackendSettings}
            className="hidden sm:inline-flex items-center gap-1.5 pl-3 border-l border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title={isHealthOk ? 'Backend connected. Click to view/configure API URL' : 'Backend offline. Click to connect your Render Web Service'}
          >
            <span className={`w-2 h-2 rounded-full ${isHealthOk ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`} />
            <span className={`text-[10px] font-medium ${isHealthOk ? 'text-slate-400' : 'text-rose-400 font-semibold underline'}`}>
              {isHealthOk ? 'System Live' : 'Offline (Click to Connect)'}
            </span>
          </button>
        </div>

        {/* Center Primary Navigation - ONLY Client Details and History per requirements */}
        <nav className="flex items-center gap-1.5 bg-[#0b0f19] border border-slate-800/90 rounded-xl p-1" aria-label="Main Navigation">
          <button
            onClick={() => onSelectTab('clients')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'clients'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
            title="Client Details & Past Scrutinies"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Client Details</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
            title="Generated Legal Opinions History"
          >
            <HistoryIcon className="w-3.5 h-3.5 text-slate-300" />
            <span>History</span>
          </button>
        </nav>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-2.5">
          {/* Switch to User button if in admin mode */}
          {isUserAdmin && onSwitchToUser && activeTab === 'admin' && (
            <button
              onClick={onSwitchToUser}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              title="Return to User Workspace"
            >
              <ArrowLeft className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">User Mode</span>
            </button>
          )}

          {/* Wallet Balance Header Pill */}
          <button
            onClick={onOpenWalletModal || (() => onSelectTab('wallet'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              activeTab === 'wallet'
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                : 'border-slate-800 hover:border-slate-700 bg-[#0b0f19] hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Wallet Balance & Billing (Click to Top-Up)"
          >
            <WalletIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 font-medium">Wallet:</span>
            <span className="font-mono text-xs font-bold text-amber-300">₹{displayBalance.toFixed(2)}</span>
          </button>

          {/* Primary CTA: + New Opinion */}
          <button
            onClick={onResetSession}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Start a new document / opinion workflow"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Opinion</span>
          </button>

          {/* Help Modal Trigger */}
          <button
            type="button"
            onClick={onOpenHelpModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="How It Works & Quick Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* User Profile / Logout Indicator */}
          {user && (
            <div className="hidden md:flex items-center gap-2 pl-1 border-l border-slate-800 text-xs">
              <span className="text-slate-400 truncate max-w-[120px]" title={user.email}>
                {user.name || user.email.split('@')[0]}
              </span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Logout"
                >
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
