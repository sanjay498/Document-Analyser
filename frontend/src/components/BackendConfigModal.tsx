import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw, Globe, HelpCircle } from 'lucide-react';
import { getBackendBaseUrl, setBackendBaseUrl, getHealthStatus } from '../services/api';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const [url, setUrl] = useState(() => getBackendBaseUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const cleanUrl = url.trim().replace(/\/$/, '');
      const health = await getHealthStatus(cleanUrl || undefined);
      setTestResult({
        success: true,
        message: 'Successfully connected! Status: ' + (health.status || 'healthy') + '. Engine: ' + (health.engine || 'Active'),
        details: health,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Could not reach backend. Verify the Render URL is correct and the service is active.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    setBackendBaseUrl(cleanUrl);
    onConnected();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-up text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Connect Backend API</h3>
              <p className="text-[11px] text-slate-400">
                Configure your Render backend Web Service URL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="block font-semibold text-slate-300">
            Render Backend Web Service URL
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors font-mono"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Paste your Render Web Service URL (e.g. <span className="text-amber-300 font-mono">https://document-analyser-xxxx.onrender.com</span>).
          </p>
        </div>

        {/* Test Result Alert */}
        {testResult && (
          <div
            className={'p-3 rounded-xl border flex items-start gap-2.5 ' + (
              testResult.success
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            )}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="space-y-0.5 flex-1">
              <span className="font-semibold block">
                {testResult.success ? 'Backend Connected' : 'Connection Failed'}
              </span>
              <span className="text-[11px] opacity-90 leading-relaxed block">
                {testResult.message}
              </span>
            </div>
          </div>
        )}

        {/* Quick Instructions Guide */}
        <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>How to Connect Render to Vercel</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-0.5 leading-relaxed">
            <li>
              Deploy your FastAPI backend on <strong className="text-white">Render</strong> as a Web Service.
            </li>
            <li>
              Copy your Render URL (<span className="text-amber-300 font-mono">https://...onrender.com</span>) and paste it above to connect right away.
            </li>
            <li>
              For permanent setup across all users: Go to <strong className="text-white">Vercel Dashboard → Project Settings → Environment Variables</strong>, add <span className="text-sky-300 font-mono">VITE_API_URL</span> with your Render URL, and redeploy.
            </li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={'w-3.5 h-3.5 ' + (isTesting ? 'animate-spin' : '')} />
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-slate-950 bg-amber-400 hover:bg-amber-300 font-bold transition-all shadow-md shadow-amber-400/10 cursor-pointer"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};
