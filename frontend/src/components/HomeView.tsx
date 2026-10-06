import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  ArrowRight,
  FolderOpen,
  Users,
  History as HistoryIcon,
  Sparkles,
  Download,
  Edit3,
  RefreshCw,
  Play,
  Clock,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import type {
  UserProfile,
  TemplateSummary,
  HistorySummary,
  Client,
  UseTemplateResponse
} from '../types';
import { listTemplates, listHistory, getClients, useTemplateInSession } from '../services/api';

export interface HomeViewProps {
  user: UserProfile | null;
  onStartNewOpinion: () => void;
  onSelectTemplateFromLibrary: (res: UseTemplateResponse) => void;
  onSelectClientForOpinion: (client: Client) => void;
  onOpenInStudio: (templateId?: string) => void;
  onNavigateToTab: (tab: 'home' | 'workspace' | 'clients' | 'history' | 'wallet' | 'studio' | 'admin') => void;
  onOpenWalletModal: () => void;
  onResumeWorkflow?: () => void;
  activeSessionInfo?: {
    templateFilename?: string;
    clientName?: string;
    workflowStep: 1 | 2 | 3 | 4;
    sourcesCount: number;
    resultsCount: number;
  };
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user: _user,
  onStartNewOpinion,
  onSelectTemplateFromLibrary,
  onSelectClientForOpinion,
  onOpenInStudio,
  onNavigateToTab,
  onOpenWalletModal: _onOpenWalletModal,
  onResumeWorkflow,
  activeSessionInfo,
  showToast,
}) => {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [historyList, setHistoryList] = useState<HistorySummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [tData, hData, cData] = await Promise.all([
        listTemplates().catch(() => []),
        listHistory().catch(() => []),
        getClients().catch(() => []),
      ]);
      setTemplates(tData);
      setHistoryList(hData);
      setClients(cData);
    } catch (err: any) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleQuickUseTemplate = async (templateId: string) => {
    setLoadingTemplateId(templateId);
    try {
      const res = await useTemplateInSession(templateId);
      onSelectTemplateFromLibrary(res);
      showToast(`Selected "${res.template_filename}"! Advancing to Client Details.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to load template', 'error');
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const hasActiveSession = Boolean(
    activeSessionInfo &&
      (activeSessionInfo.templateFilename ||
        activeSessionInfo.clientName ||
        activeSessionInfo.sourcesCount > 0 ||
        activeSessionInfo.resultsCount > 0)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* ============================================================ */}
      {/* HERO SECTION WITH WORKFLOW CTA & WORKSPACE STATS             */}
      {/* ============================================================ */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Automated Legal Title Opinion & Scrutiny Engine</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Welcome to <span className="text-amber-600">Opinion Generator</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Synthesize institutional legal title opinions and bank property search reports from scanned deeds,
              patta records, and parent documents with deterministic accuracy.
            </p>

            {/* Main Action CTAs */}
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={onStartNewOpinion}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Create New Opinion</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenInStudio()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-all cursor-pointer shadow-xs"
              >
                <Edit3 className="w-4 h-4 text-amber-600" />
                <span>Highlight Studio</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab('clients')}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 text-slate-500" />
                <span>View Clients</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics & Workspace Overview Card (Account Balance Removed) */}
          <div className="w-full lg:w-72 rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Workspace Overview</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Ready
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-normal">
              Quick access to your legal templates, registered clients, and finalized opinions.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="block text-base font-bold text-slate-900">{templates.length}</span>
                <span className="text-[10px] text-slate-500 font-medium">Templates</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="block text-base font-bold text-slate-900">{clients.length}</span>
                <span className="text-[10px] text-slate-500 font-medium">Clients</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="block text-base font-bold text-slate-900">{historyList.length}</span>
                <span className="text-[10px] text-slate-500 font-medium">Opinions</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* IN-PROGRESS ACTIVE OPINION RESUME BANNER                     */}
      {/* ============================================================ */}
      {hasActiveSession && onResumeWorkflow && (
        <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  In-Progress Session Active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 text-[10px] font-semibold border border-slate-200">
                  Step {activeSessionInfo?.workflowStep} of 4
                </span>
              </div>
              <p className="text-xs text-slate-800 font-medium mt-0.5">
                {activeSessionInfo?.clientName ? `Client: ${activeSessionInfo.clientName}` : 'Unassigned Client'}
                {activeSessionInfo?.templateFilename ? ` • Template: "${activeSessionInfo.templateFilename}"` : ''}
                {activeSessionInfo?.sourcesCount ? ` • ${activeSessionInfo.sourcesCount} deed(s) attached` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResumeWorkflow}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-xs cursor-pointer"
            >
              <span>Resume Opinion</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onStartNewOpinion}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="Start fresh session"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4-STEP WORKFLOW WALKTHROUGH STRIP                            */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase tracking-wider">
              The 4-Step Opinion Workflow
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              One clear purpose at every stage. Never lose your place or data.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartNewOpinion}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
          >
            <span>Start Workflow</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Step 1 */}
          <div
            onClick={onStartNewOpinion}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center border border-amber-200">
                1
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
              Choose Template
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pick from existing bank templates or build custom fields in Highlight Studio.
            </p>
          </div>

          {/* Step 2 */}
          <div
            onClick={onStartNewOpinion}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center border border-amber-200">
                2
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
              Client Details
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Enter client or borrower name, loan classification, and matter property info.
            </p>
          </div>

          {/* Step 3 */}
          <div
            onClick={onStartNewOpinion}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center border border-amber-200">
                3
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
              Upload Deeds
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Upload title deeds, parent deeds, ECs, and pattas in PDF, Word, or images.
            </p>
          </div>

          {/* Step 4 */}
          <div
            onClick={onStartNewOpinion}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center border border-amber-200">
                4
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
              Generate Opinion
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Deterministic synthesis with page citations, conflict audit, and Word/PDF export.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TEMPLATE LIBRARY QUICK SELECT CARDS                         */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-600" />
              <span>Available Opinion Templates</span>
            </h2>
            <p className="text-xs text-slate-500">
              Select a template to immediately jump into Step 2 with that template pre-loaded.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenInStudio()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>+ New in Studio</span>
            </button>
            <button
              type="button"
              onClick={loadDashboardData}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
            <FolderOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500">No saved templates found.</p>
            <button
              type="button"
              onClick={() => onOpenInStudio()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-xs"
            >
              Create First Template in Highlight Studio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.slice(0, 6).map((tpl) => (
              <div
                key={tpl.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between gap-4 shadow-xs group hover:shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-1">
                          {tpl.name}
                        </h3>
                        {tpl.bank_name && (
                          <span className="text-[10px] text-amber-700 font-semibold block">
                            {tpl.bank_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2">
                    {tpl.fields_count} dynamic field(s)
                    {tpl.table_groups_count > 0 ? ` & ${tpl.table_groups_count} table(s)` : ''} for
                    legal property search.
                  </p>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
                    <Clock className="w-3 h-3" />
                    <span>Updated {formatDate(tpl.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleQuickUseTemplate(tpl.id)}
                    disabled={loadingTemplateId === tpl.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingTemplateId === tpl.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Use Template</span>
                        <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenInStudio(tpl.id)}
                    className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
                    title="Edit in Highlight Studio"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* TWO-COLUMN LOWER SECTION: RECENT OPINIONS & SAVED CLIENTS    */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Generated Opinions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Opinions</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('history')}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {historyList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No past opinions generated yet. Click "+ Create New Opinion" to generate your first document.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyList.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate max-w-[240px]">
                        {item.template_filename}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span>{formatDate(item.generated_at)}</span>
                        <span>•</span>
                        <span>{item.resolved_fields_count} fields</span>
                        {item.nature_of_loan && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 font-medium">{item.nature_of_loan}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <a
                      href={item.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all shrink-0 cursor-pointer"
                      title="Download generated document"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigateToTab('history')}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-center cursor-pointer"
            >
              Browse Complete Document History ({historyList.length}) →
            </button>
          </div>
        </div>

        {/* Saved Clients */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Clients & Matters</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('clients')}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Clients</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {clients.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No clients saved yet. Add clients in Client Details or start a new opinion.
              </div>
            ) : (
              <div className="space-y-2.5">
                {clients.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                        {c.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        {c.title && <span className="truncate max-w-[140px]">{c.title}</span>}
                        {c.phone && <span>• {c.phone}</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectClientForOpinion(c)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all shrink-0 cursor-pointer"
                      title={`Start new opinion for ${c.name}`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Start Opinion</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigateToTab('clients')}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-center cursor-pointer"
            >
              Open Client Directory ({clients.length}) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
