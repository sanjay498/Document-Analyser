import React, { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck, AlertCircle, FileText, ChevronDown, ChevronUp, Check, Info } from 'lucide-react';
import { getDeedModels, detectDeedModel } from '../services/api';
import type { DeedModelDef } from '../types';

interface ExtractionActionCardProps {
  fieldsCount: number;
  sourcesCount: number;
  isLoading: boolean;
  apiKey?: string;
  sessionId?: string | null;
  onExtract: (model: string, preferredDeedModel?: string) => void;
}

export const ExtractionActionCard: React.FC<ExtractionActionCardProps> = ({
  fieldsCount,
  sourcesCount,
  isLoading,
  sessionId,
  onExtract,
}) => {
  const canExtract = fieldsCount > 0 && sourcesCount > 0;
  const [deedModels, setDeedModels] = useState<DeedModelDef[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('auto');
  const [autoDetectedModel, setAutoDetectedModel] = useState<DeedModelDef | null>(null);
  const [showSyntaxPreview, setShowSyntaxPreview] = useState<boolean>(false);

  // Load available deed models on mount
  useEffect(() => {
    getDeedModels()
      .then((res) => {
        if (res.models) {
          setDeedModels(res.models);
        }
      })
      .catch((err) => console.error('Failed to load deed models', err));
  }, []);

  // Auto-detect root deed model when sessionId or sourcesCount changes
  useEffect(() => {
    if (sessionId && sourcesCount > 0) {
      detectDeedModel({ session_id: sessionId })
        .then((res) => {
          if (res.detected_model) {
            setAutoDetectedModel(res.detected_model);
          }
        })
        .catch((err) => console.error('Failed to auto-detect deed model', err));
    }
  }, [sessionId, sourcesCount]);

  const activeModel = selectedModelId === 'auto'
    ? autoDetectedModel
    : deedModels.find((m) => m.id === selectedModelId) || autoDetectedModel;

  const handleExtractClick = () => {
    const preferred = selectedModelId === 'auto' ? (autoDetectedModel?.id || undefined) : selectedModelId;
    onExtract('free_ai_model', preferred);
  };

  return (
    <div className="rounded-2xl p-6 bg-[#0b0f19] border border-slate-800 shadow-xl relative overflow-hidden space-y-5 group hover:border-slate-700 transition-all">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-xs">
              03
            </span>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
              <span>AI Document Scrutiny & Extraction</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                Hybrid Pipeline
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
            Classifies deed types, extracts title passage recitals, aligns dates, and maps variables into your template.
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              {fieldsCount} Highlighted Variables
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              {sourcesCount} Source Deeds
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verifiable Page Provenance
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <button
            onClick={handleExtractClick}
            disabled={!canExtract || isLoading}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${
              !canExtract
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : isLoading
                ? 'bg-slate-800 text-white cursor-wait opacity-90 border border-slate-700'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/10 active:scale-[0.98] cursor-pointer'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing Deeds...</span>
              </>
            ) : (
              <>
                <span>Run AI Title Scrutiny</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Root Deed Phrasing Model Selector */}
      <div className="pt-3 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#070a13] p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-white">First Paragraph Deed Phrasing:</span>
                {autoDetectedModel && selectedModelId === 'auto' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                    <Check className="w-2.5 h-2.5" />
                    Auto-Detected: {autoDetectedModel.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Recital sentence format for the root acquisition paragraph in Trace of Title.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 font-medium"
            >
              <option value="auto">
                {autoDetectedModel ? `✨ Auto-Detect (${autoDetectedModel.name})` : '✨ Auto-Detect from Deeds'}
              </option>
              <optgroup label="Trace of Title Models">
                {deedModels
                  .filter((m) => m.category === 'trace_of_title' || m.is_root_deed_candidate)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Revenue & Other Models">
                {deedModels
                  .filter((m) => m.category !== 'trace_of_title' && !m.is_root_deed_candidate)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
            </select>

            {activeModel && (
              <button
                type="button"
                onClick={() => setShowSyntaxPreview(!showSyntaxPreview)}
                className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg bg-slate-900 border border-slate-700 transition-colors"
                title="Toggle Phrasing Format Preview"
              >
                {showSyntaxPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable Phrasing Syntax Preview */}
        {showSyntaxPreview && activeModel && (
          <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>{activeModel.name} Phrasing Format:</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {activeModel.id}</span>
            </div>
            <p className="text-[11px] font-mono text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
              "{activeModel.sample_text}"
            </p>
          </div>
        )}
      </div>

      {!canExtract && (
        <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-xs text-amber-400/80">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {fieldsCount === 0 && sourcesCount === 0
              ? 'Upload a template and at least one source document above to begin.'
              : fieldsCount === 0
              ? 'Upload a template (.docx) with highlighted placeholders.'
              : 'Upload at least one source document (.pdf or .docx).'}
          </span>
        </div>
      )}
    </div>
  );
};
