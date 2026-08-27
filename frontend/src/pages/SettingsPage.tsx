import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Sparkles, Key, Cpu, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [provider, setProvider] = useState('huggingface');
  const [apiToken, setApiToken] = useState('');
  const [model, setModel] = useState('Qwen/Qwen2.5-72B-Instruct');
  const [ocrEngine, setOcrEngine] = useState('auto');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  useEffect(() => {
    if (settings) {
      setProvider(settings.ai_provider);
      setApiToken(settings.huggingface_api_token || '');
      setModel(settings.huggingface_model);
      setOcrEngine(settings.ocr_engine);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateSettings({
        ai_provider: provider,
        huggingface_api_token: apiToken,
        huggingface_model: model,
        ocr_engine: ocrEngine,
      }),
    onSuccess: () => {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-400" /> Platform & AI Provider Settings
        </h1>
        <p className="text-slate-400 text-sm">
          Configure Hugging Face models, API tokens, and OCR engines.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="glass-card p-6 rounded-2xl space-y-6"
      >
        {/* AI Provider Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-400" /> AI Semantic Mapping Provider
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setProvider('huggingface')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                provider === 'huggingface'
                  ? 'bg-brand-600/10 border-brand-500 shadow-md'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <h4 className="font-bold text-white text-sm">Hugging Face Inference Engine</h4>
              <p className="text-xs text-slate-400 mt-1">
                Uses Hugging Face Serverless / Inference API for LLM semantic understanding.
              </p>
            </div>

            <div
              onClick={() => setProvider('fallback')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                provider === 'fallback'
                  ? 'bg-brand-600/10 border-brand-500 shadow-md'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <h4 className="font-bold text-white text-sm">Local Offline Matcher</h4>
              <p className="text-xs text-slate-400 mt-1">
                Zero-token local fuzzy & key-value regex engine for offline use.
              </p>
            </div>
          </div>
        </div>

        {/* Hugging Face Settings */}
        {provider === 'huggingface' && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-brand-400" /> Hugging Face User Access Token
              </label>
              <input
                type="password"
                placeholder="hf_..."
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:border-brand-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Leave empty to automatically fall back to the offline semantic engine.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Hugging Face Model Endpoint
              </label>
              <input
                type="text"
                placeholder="Qwen/Qwen2.5-72B-Instruct"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Save Controls */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          {savedSuccess ? (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Settings updated successfully!
            </span>
          ) : (
            <span></span>
          )}

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/30 flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};
