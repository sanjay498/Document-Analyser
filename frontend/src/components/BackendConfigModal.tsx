import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw, Globe, HelpCircle, Zap } from 'lucide-react';
import { getBackendBaseUrl, setBackendBaseUrl, getHealthStatus, wakeUpBackend, DEFAULT_PRODUCTION_BACKEND } from '../services/api';

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
  const [url, setUrl] = useState(() => getBackendBaseUrl() || DEFAULT_PRODUCTION_BACKEND);
  const [isTesting, setIsTesting] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [wakeProgress, setWakeProgress] = useState<string>('');
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
      const health = await getHealthStatus(cleanUrl || undefined, 10000);
      setTestResult({
        success: true,
        message: 'Successfully connected! Status: ' + (health.status || 'healthy') + '. Engine: ' + (health.engine || 'Active'),
        details: health,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Could not reach backend. If hosted on Render Free Tier, the server may be sleeping and need ~40 seconds to wake up.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleWakeUp = async () => {
    setIsWaking(true);
    setTestResult(null);
    setWakeProgress('Sending wake-up signal to Render...');
    try {
      const ok = await wakeUpBackend(60, (_sec, msg) => {
        setWakeProgress(msg);
      });
      if (ok) {
        setTestResult({
          success: true,
          message: 'Server woke up successfully and is now active!',
        });
        onConnected();
      } else {
        setTestResult({
          success: false,
          message: 'Wake-up took longer than 60 seconds. Please check Render dashboard status.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to wake up server.',
      });
    } finally {
      setIsWaking(false);
      setWakeProgress('');
    }
  };

  const handleSave = () => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    setBackendBaseUrl(cleanUrl);
    onConnected();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5 animate-scale-up text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Backend API Connection</h3>
              <p className="text-[11px] text-slate-500">
                Render Web Service endpoint & 24/7 Keep-Alive status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="block font-semibold text-slate-700">
            Render Backend Web Service URL
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://document-analyser-1-momv.onrender.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-colors font-mono"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Connected to Render production endpoint. The app automatically maintains connection and keeps the server warm.
          </p>
        </div>

        {/* Test Result Alert */}
        {testResult && (
          <div
            className={'p-3 rounded-xl border flex items-start gap-2.5 ' + (
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            )}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="space-y-0.5 flex-1">
              <span className="font-semibold block">
                {testResult.success ? 'Backend Connected' : 'Connection Notice'}
              </span>
              <span className="text-[11px] opacity-90 leading-relaxed block">
                {testResult.message}
              </span>
            </div>
          </div>
        )}

        {/* Wake progress message */}
        {isWaking && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
            <span className="text-[11px] font-medium">{wakeProgress || 'Sending keep-alive wake-up ping...'}</span>
          </div>
        )}

        {/* Quick Info Guide */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Always-Connected Keep-Alive</span>
          </div>
          <p className="leading-relaxed text-slate-600">
            A 24/7 background heartbeat (GitHub Actions + browser ping) automatically pings this endpoint to prevent Render Free Tier from shutting down after 15 minutes of inactivity. If Render is waking from a fresh deploy, it takes ~40 seconds to spin up.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleWakeUp}
            disabled={isWaking || isTesting}
            className="px-3.5 py-2 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Force wake up sleeping Render instance"
          >
            <Zap className={'w-3.5 h-3.5 ' + (isWaking ? 'animate-bounce text-amber-600' : 'text-amber-500')} />
            <span>{isWaking ? 'Waking...' : 'Wake Up Server'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || isWaking}
              className="px-3.5 py-2 rounded-xl text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={'w-3.5 h-3.5 ' + (isTesting ? 'animate-spin' : '')} />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-slate-950 bg-amber-400 hover:bg-amber-300 font-bold transition-all shadow-xs cursor-pointer"
            >
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
