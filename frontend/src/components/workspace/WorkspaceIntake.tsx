import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  Trash2,
  Plus,
  ArrowRight,
  FolderOpen,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { ExtractedSourceDocument, DeedModelDef } from '../../types';
import { LegalDocEmptyIllustration } from '../illustrations/LegalIllustrations';
import { getDeedModels, detectDeedModel } from '../../services/api';

interface WorkspaceIntakeProps {
  templateFilename?: string;
  templateFieldsCount: number;
  tableGroupsCount: number;
  sources: ExtractedSourceDocument[];
  isTemplateLoading: boolean;
  isSourcesLoading: boolean;
  onUploadTemplate: (file: File) => void;
  onUploadSources: (files: File[]) => void;
  onRemoveSource: (filename: string) => void;
  onClearTemplate: () => void;
  onOpenTemplateLibrary: () => void;
  sessionId: string;
  preferredDeedModel: string;
  onSelectDeedModel: (modelId: string) => void;
  onStartScrutiny: () => void;
}

export const WorkspaceIntake: React.FC<WorkspaceIntakeProps> = ({
  templateFilename,
  templateFieldsCount,
  tableGroupsCount,
  sources,
  isTemplateLoading,
  isSourcesLoading,
  onUploadTemplate,
  onUploadSources,
  onRemoveSource,
  onClearTemplate,
  onOpenTemplateLibrary,
  sessionId,
  preferredDeedModel,
  onSelectDeedModel,
  onStartScrutiny,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [deedModels, setDeedModels] = useState<DeedModelDef[]>([]);
  const [autoDetectedModel, setAutoDetectedModel] = useState<DeedModelDef | null>(null);
  const [showSyntaxPreview, setShowSyntaxPreview] = useState(false);
  const [expandedDocText, setExpandedDocText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const deedsInputRef = useRef<HTMLInputElement>(null);

  // Load available deed phrasing models on mount
  useEffect(() => {
    getDeedModels()
      .then((res) => {
        if (res.models) setDeedModels(res.models);
      })
      .catch((err) => console.error('Failed to load deed models', err));
  }, []);

  // Auto-detect root deed model when sessionId or sources change
  useEffect(() => {
    if (sessionId && sources.length > 0) {
      detectDeedModel({ session_id: sessionId })
        .then((res) => {
          if (res.detected_model) {
            setAutoDetectedModel(res.detected_model);
          }
        })
        .catch((err) => console.error('Failed to auto-detect deed model', err));
    }
  }, [sessionId, sources.length]);

  const hasDocuments = Boolean(templateFilename || sources.length > 0);
  const canRunScrutiny = Boolean(templateFilename && sources.length > 0);

  // Unified File Drop Handler (smartly routes templates vs deeds)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFiles = (files: File[]) => {
    const templateCandidate = files.find((f) => {
      const lower = f.name.toLowerCase();
      return (
        lower.endsWith('.docx') &&
        (lower.includes('template') ||
          lower.includes('opinion') ||
          lower.includes('scrutiny') ||
          lower.includes('format') ||
          !templateFilename)
      );
    });

    const deedsCandidates = files.filter((f) => f !== templateCandidate);

    if (templateCandidate && !templateFilename) {
      onUploadTemplate(templateCandidate);
    }

    if (deedsCandidates.length > 0) {
      onUploadSources(deedsCandidates);
    } else if (templateCandidate && templateFilename) {
      // If template already exists and user uploaded another docx, treat as deed
      onUploadSources([templateCandidate]);
    }
  };

  const activeModel = preferredDeedModel === 'auto'
    ? autoDetectedModel
    : deedModels.find((m) => m.id === preferredDeedModel) || autoDetectedModel;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
          }
        }}
        className="hidden"
      />
      <input
        ref={templateInputRef}
        type="file"
        accept=".docx,.pptx,.pdf"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadTemplate(e.target.files[0]);
          }
        }}
        className="hidden"
      />
      <input
        ref={deedsInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadSources(Array.from(e.target.files));
          }
        }}
        className="hidden"
      />

      {/* Screen Title & Purpose (One screen. One clear purpose) */}
      <div className="text-center space-y-2 pt-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {hasDocuments ? 'Documents Ready for Title Scrutiny' : 'Start a new scrutiny'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          {hasDocuments
            ? 'Review your opinion template and source deeds below, then execute the AI legal scrutiny.'
            : 'Analyze bilingual English & Tamil property deeds, verify title passage, and synthesize legal opinions.'}
        </p>
      </div>

      {/* STAGE 1: EMPTY INTAKE DROPZONE (iLovePDF Style Simplicity) */}
      {!hasDocuments ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4 ${
            isDragOver
              ? 'border-amber-400 bg-amber-500/5 scale-[1.01]'
              : 'border-slate-800 bg-[#0b0f19] hover:border-slate-700 hover:bg-[#0d121f]'
          }`}
        >
          <LegalDocEmptyIllustration size={100} className="opacity-90" />

          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Drop your legal documents here
            </h2>
            <p className="text-xs text-slate-400">
              or choose files from your computer
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-400/10 active:scale-95 cursor-pointer"
            >
              Choose Documents
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTemplateLibrary();
              }}
              className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Select from Template Library</span>
            </button>
          </div>

          <div className="pt-3 text-[11px] text-slate-500 font-medium flex items-center gap-2">
            <span>PDF (Scanned & Digital)</span>
            <span>•</span>
            <span>Word (.docx)</span>
            <span>•</span>
            <span>English & Tamil OCR</span>
          </div>
        </div>
      ) : (
        /* STAGE 1B: DOCUMENT DESK (Document-First Workspace) */
        <div className="space-y-6">
          {/* Document Cards Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* 1. Legal Opinion Template Card */}
            <div className="rounded-2xl p-5 bg-[#0b0f19] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Legal Opinion Template
                </span>
                {templateFilename && (
                  <button
                    type="button"
                    onClick={onClearTemplate}
                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                    title="Remove Template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isTemplateLoading ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-amber-300 font-medium">Parsing yellow highlighted variables...</p>
                </div>
              ) : templateFilename ? (
                <div className="p-4 rounded-xl bg-[#070a13] border border-slate-800 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate" title={templateFilename}>
                        {templateFilename}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {templateFieldsCount} Yellow Variables
                        </span>
                        {tableGroupsCount > 0 && (
                          <span className="text-[10px] font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            {tableGroupsCount} Schedule Tables
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Template Loaded
                    </span>
                    <button
                      type="button"
                      onClick={() => templateInputRef.current?.click()}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Change Template
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => templateInputRef.current?.click()}
                  className="p-6 rounded-xl border border-dashed border-slate-800 bg-[#070a13] hover:border-slate-700 text-center cursor-pointer transition-colors space-y-2"
                >
                  <FileText className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    Upload Opinion Template (.docx)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    or choose from your template library
                  </p>
                  <div className="pt-1 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        templateInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      Upload .docx
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTemplateLibrary();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-amber-300 hover:bg-slate-850 cursor-pointer"
                    >
                      Library
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Source Title Deeds Card */}
            <div className="rounded-2xl p-5 bg-[#0b0f19] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  Source Title Deeds ({sources.length})
                </span>
                <button
                  type="button"
                  onClick={() => deedsInputRef.current?.click()}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Deed</span>
                </button>
              </div>

              {isSourcesLoading ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-indigo-300 font-medium">Running OCR & extracting ground-truth text...</p>
                </div>
              ) : sources.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {sources.map((doc) => (
                    <div
                      key={doc.filename}
                      className="p-3 rounded-xl bg-[#070a13] border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                          {doc.file_type.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate max-w-[200px]" title={doc.filename}>
                            {doc.filename}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                            <span>{doc.char_count.toLocaleString()} chars</span>
                            <span>•</span>
                            <span>{doc.page_or_section_count} {doc.file_type === 'pdf' ? 'pages' : 'sections'}</span>
                            {doc.is_scanned_ocr && (
                              <span className="text-purple-400">• OCR</span>
                            )}
                            {doc.has_tamil && (
                              <span className="text-amber-400">• தமிழ்</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedDocText(expandedDocText === doc.filename ? null : doc.filename)}
                          className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Preview Extracted Text"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveSource(doc.filename)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                          title="Remove deed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => deedsInputRef.current?.click()}
                  className="p-6 rounded-xl border border-dashed border-slate-800 bg-[#070a13] hover:border-slate-700 text-center cursor-pointer transition-colors space-y-2"
                >
                  <FileText className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    Upload Parent Deeds / Scans
                  </p>
                  <p className="text-[11px] text-slate-500">
                    PDF, DOCX, TXT, or scanned images (English/Tamil)
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deedsInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer mt-1"
                  >
                    Select Deeds
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Extracted Text Preview Drawer */}
          {expandedDocText && (
            <div className="p-4 rounded-2xl bg-[#070a13] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Extracted Ground-Truth: {expandedDocText}
                </span>
                <button
                  onClick={() => setExpandedDocText(null)}
                  className="text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-800">
                {sources.find((s) => s.filename === expandedDocText)?.full_text}
              </div>
            </div>
          )}

          {/* Configuration & Phrasing Option */}
          <div className="p-4 rounded-2xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Deed Phrasing Cadence:</span>
              <select
                value={preferredDeedModel}
                onChange={(e) => onSelectDeedModel(e.target.value)}
                className="bg-[#070a13] border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 font-medium max-w-[240px]"
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
                  className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
                  title="Toggle Phrasing Format Preview"
                >
                  {showSyntaxPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              {templateFilename && sources.length > 0 ? (
                <span className="text-emerald-400 font-medium">✓ Ready for Title Scrutiny</span>
              ) : !templateFilename ? (
                <span className="text-amber-400 font-medium">Select a template above to continue</span>
              ) : (
                <span className="text-amber-400 font-medium">Upload at least one deed above to continue</span>
              )}
            </div>
          </div>

          {/* Phrasing Syntax Preview Dropdown */}
          {showSyntaxPreview && activeModel && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 animate-fade-in">
              <span className="font-semibold text-amber-300">{activeModel.name} Cadence:</span>
              <p className="text-[11px] font-mono text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800">
                "{activeModel.sample_text}"
              </p>
            </div>
          )}

          {/* LARGE PRIMARY ACTION BUTTON (Unmistakable, Dominant) */}
          <div className="pt-2">
            <button
              onClick={onStartScrutiny}
              disabled={!canRunScrutiny}
              className={`w-full py-4 px-6 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-xl ${
                !canRunScrutiny
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/10 active:scale-[0.99] cursor-pointer'
              }`}
            >
              <span>Run AI Title Scrutiny</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
