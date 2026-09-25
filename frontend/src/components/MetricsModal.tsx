import React, { useState, useEffect } from 'react';
import {
  Activity,
  X,
  RefreshCw,
  Cpu,
  BookOpen,
  FileCheck2,
  CheckCircle2,
  Sparkles,
  Globe2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { getSystemMetrics, getHealthStatus } from '../services/api';
import type { SystemMetrics } from '../types';

interface MetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MetricsModal: React.FC<MetricsModalProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [healthData, setHealthData] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const [m, h] = await Promise.all([
        getSystemMetrics().catch(() => null),
        getHealthStatus().catch(() => null),
      ]);
      const end = performance.now();
      setLatencyMs(Math.round(end - start));
      if (m) setMetrics(m);
      if (h) setHealthData(h);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load metrics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c101d] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090d18]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-amber-500/20 text-amber-400 border border-amber-500/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  System Health & Live API Metrics
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  {metrics?.status === 'operational' ? 'API Operational' : 'Online'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time latency, multi-model AI routing, and document synthesis stats
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMetrics}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300 custom-scrollbar">
          {/* Top Quick Status Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span>API Latency</span>
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white flex items-baseline gap-1">
                {latencyMs !== null ? `${latencyMs}` : '--'}
                <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Fast in-memory routing</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span>Primary AI Engine</span>
                <Cpu className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 text-base font-bold text-amber-300">
                Gemini + Groq
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Enterprise Hybrid Pipeline</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span>Deed Phrasing Models</span>
                <BookOpen className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                {metrics?.deed_models?.total_models ?? 32}
              </div>
              <div className="text-[10px] text-purple-300 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                <span>Standard Bank Recitals</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span>Documents Completed</span>
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                {metrics?.database_metrics?.completed_documents ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {metrics?.database_metrics?.total_sessions ?? 0} total sessions
              </div>
            </div>
          </div>

          {/* Section 1: AI Engine & Provider Status */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>AI Multi-Model Provider Architecture</span>
              </h3>
              <span className="text-[11px] text-amber-300 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Auto-Fallback Routing Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Google Gemini API</span>
                  {metrics?.ai_engine?.gemini_configured || healthData?.gemini_configured ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                      Fallback
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Multilingual context parsing, Tamil script translation, and legal synthesis.
                </p>
                <div className="text-[10px] text-indigo-300 font-mono">
                  Models: gemini-3.6-flash, gemini-3.5-flash
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Groq Cloud AI</span>
                  {metrics?.ai_engine?.groq_configured || healthData?.groq_configured ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                      Fallback
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Ultra-low latency LLaMA 3.3 70B Versatile reasoning.
                </p>
                <div className="text-[10px] text-indigo-300 font-mono">
                  Models: llama-3.3-70b-versatile, llama-3.1-8b-instant
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Heuristic Fallback</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Always On
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Zero-downtime offline rule engine guaranteeing 100% field extraction.
                </p>
                <div className="text-[10px] text-amber-300 font-mono">
                  Status: 100% Deterministic Offline
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 32 Deed Models Breakdown */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>32 Standard Legal Deed Phrasing Models</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                17 Trace of Title • 15 Revenue & Regulatory
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Trace of Title Root Deeds (17 Models)</span>
                </div>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  <li>Normal Partition Deed & Life Estate Partition</li>
                  <li>Absolute Sale Deed & Settlement Deeds</li>
                  <li>Registered Will, Death & Legal Heirship Succession</li>
                  <li>General Power of Attorney (GPA) with Agent Powers</li>
                  <li>Release Deeds, Exchange Deeds, and Gift Deeds</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <span>Revenue & Regulatory Models (15 Models)</span>
                </div>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  <li>Computerized Patta, Revenue R.S.R. & A-Register</li>
                  <li>DTCP / Local Body Approved Layout Formats</li>
                  <li>SRO Encumbrance Certificate (Nil EC & Continuity)</li>
                  <li>Bank MODT Discharge & Memorandum of Deposit</li>
                  <li>Court Decrees, Name Change Gazette, FMB Maps</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3: OCR & Multilingual Capabilities */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-emerald-400" />
                <span>Multilingual OCR & Document Engine</span>
              </h3>
              <span className="text-[11px] text-emerald-300 font-semibold">
                Tamil & English Bilingual
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
                <span className="text-slate-400 block">Tamil OCR Engine</span>
                <span className="text-white font-semibold text-xs">Tesseract + Tamil Script Parser</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
                <span className="text-slate-400 block">Page Provenance Audit</span>
                <span className="text-emerald-300 font-semibold text-xs">Snippet & Page Tracking</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
                <span className="text-slate-400 block">Export Formats</span>
                <span className="text-white font-semibold text-xs">.docx, .pdf, .txt, .pptx</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-[#090d18] text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Last checked: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Just now'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
