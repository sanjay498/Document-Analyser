import React from 'react';
import {
  FileText,
  FileQuestion,
  FolderOpen,
  Highlighter,
  History as HistoryIcon,
  Shield,
  Wallet as WalletIcon,
  Plus,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  activeTab: 'workspace' | 'qa' | 'templates' | 'studio' | 'history' | 'wallet' | 'admin';
  onSelectTab: (tab: 'workspace' | 'qa' | 'templates' | 'studio' | 'history' | 'wallet' | 'admin') => void;
  onOpenHelpModal: () => void;
  onOpenBatchModal?: () => void;
  onOpenMetricsModal?: () => void;
  onOpenWalletModal?: () => void;
  onSwitchToUser?: () => void;
  onLogout?: () => void;
  onResetSession: () => void;
  isHealthOk?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  onOpenHelpModal,
  onOpenWalletModal,
  onSwitchToUser,
  onResetSession,
  isHealthOk = true,
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

          {/* Minimal Live Status Dot */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 pl-3 border-l border-slate-800 text-[11px] text-slate-400"
            title={isHealthOk ? 'Backend API connected and responsive' : 'Backend API connection offline'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isHealthOk ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-[10px] text-slate-400 font-medium">
              {isHealthOk ? 'System Live' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Center Primary Navigation */}
        <nav className="flex items-center gap-1 bg-[#0b0f19] border border-slate-800/90 rounded-lg p-0.5" aria-label="Main Navigation">
          <button
            onClick={() => onSelectTab('workspace')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'workspace'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>

          <button
            onClick={() => onSelectTab('qa')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'qa'
                ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-amber-200 hover:bg-slate-800/40'
            }`}
            title="Intelligent Legal Template Question Answering"
          >
            <FileQuestion className="w-3.5 h-3.5 text-amber-400" />
            <span>Template Q&A</span>
            <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/20">
              NEW
            </span>
          </button>

          <button
            onClick={() => onSelectTab('templates')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Templates</span>
          </button>

          <button
            onClick={() => onSelectTab('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-slate-800 text-amber-300'
                : 'text-slate-400 hover:text-amber-200 hover:bg-slate-800/40'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-400" />
            <span>Studio</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <HistoryIcon className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          {/* User Wallet Tab */}
          <button
            onClick={() => onSelectTab('wallet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'wallet'
                ? 'bg-slate-800 text-amber-300 border border-slate-700'
                : 'text-slate-400 hover:text-amber-200 hover:bg-slate-800/40'
            }`}
            title="User Wallet, UPI Top-Up & Billing"
          >
            <WalletIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Wallet</span>
            <span className="font-mono text-[10px] text-amber-300 bg-amber-400/10 px-1 py-0.5 rounded ml-0.5 border border-amber-400/20">
              ₹{displayBalance.toFixed(2)}
            </span>
          </button>

          {/* Admin Panel Tab - ONLY visible when authenticated as administrator */}
          {isUserAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-slate-800/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-2">
          {/* Switch to User button if in admin mode */}
          {isUserAdmin && onSwitchToUser && (
            <button
              onClick={onSwitchToUser}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              title="Return to User Workspace"
            >
              <ArrowLeft className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">User Mode</span>
            </button>
          )}

          {/* Wallet Balance Shortcut Pill */}
          <button
            onClick={onOpenWalletModal || (() => onSelectTab('wallet'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
              activeTab === 'wallet'
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-slate-800 hover:border-slate-700 bg-[#0b0f19] hover:bg-slate-800/50 text-slate-300 hover:text-white'
            }`}
            title="Open Account Wallet & Billing"
          >
            <WalletIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-xs font-medium">₹{displayBalance.toFixed(2)}</span>
          </button>

          {/* New Scrutiny */}
          <button
            onClick={onResetSession}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Start fresh document scrutiny"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">New Scrutiny</span>
          </button>

          {/* Help Modal trigger */}
          <button
            onClick={onOpenHelpModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="How It Works"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
