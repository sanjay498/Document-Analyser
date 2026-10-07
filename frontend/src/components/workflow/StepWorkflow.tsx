import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  Trash2,
  Upload,
  RefreshCw,
  Sparkles,
  User,
  Phone,
  Mail,
  Building,
  AlertCircle
} from 'lucide-react';
import type {
  ExtractedSourceDocument,
  FieldExtractionResult,
  DynamicTableGroupResult,
  HighlightedField,
  DynamicTableGroup,
  TemplateQuestion,
  QuestionAnswer,
  Client,
  UseTemplateResponse
} from '../../types';
import { getClients } from '../../services/api';
import { LOAN_NATURE_OPTIONS } from '../../utils/loanModels';
import { WorkspaceProcessing } from '../workspace/WorkspaceProcessing';
import { ReviewTable } from '../ReviewTable';
import { HorizontalTemplateLibrary } from './HorizontalTemplateLibrary';

export interface StepWorkflowProps {
  currentStep: 1 | 2 | 3 | 4;
  onSetStep: (step: 1 | 2 | 3 | 4) => void;
  onBackToHome?: () => void;

  // Step 1: Template Selection
  templateFilename?: string;
  fieldsCount: number;
  tableGroupsCount: number;
  onSelectTemplateFromLibrary: (res: UseTemplateResponse) => void;
  onUploadTemplateFile: (file: File) => Promise<void> | void;
  onOpenInStudio: (templateId?: string) => void;
  isTemplateLoading: boolean;

  // Step 2: Client Details (preserved across Back/Next)
  clientName: string;
  onChangeClientName: (val: string) => void;
  clientPhone: string;
  onChangeClientPhone: (val: string) => void;
  clientEmail: string;
  onChangeClientEmail: (val: string) => void;
  clientTitle: string;
  onChangeClientTitle: (val: string) => void;
  clientNatureOfLoan: string;
  onChangeClientNatureOfLoan: (val: string) => void;
  activeClient: Client | null;
  onSelectExistingClient: (client: Client) => void;

  // Step 3: Deeds / Documents Upload (preserved across Back/Next)
  sources: ExtractedSourceDocument[];
  isSourcesLoading: boolean;
  onUploadSources: (files: File[]) => void;
  onRemoveSource: (filename: string) => void;

  // Step 4: Opinion Generation & Scrutiny Review
  isExtracting: boolean;
  onStartScrutiny: () => void;
  results: FieldExtractionResult[];
  tableResults: DynamicTableGroupResult[];
  qaAnswers: QuestionAnswer[];
  questions: TemplateQuestion[];
  fields: HighlightedField[];
  tableGroups: DynamicTableGroup[];
  sessionId: string;
  preferredDeedModel: string;
  onApplyDeedModel: (m: string) => void;
  isExporting: boolean;
  onExport: (
    fieldValues: Record<string, string | null>,
    tableRecords: Record<string, Array<Record<string, any>>>,
    clearHighlight: boolean,
    preferredDeedModel?: string,
    qaAnswers?: QuestionAnswer[],
    docCustomName?: string,
    natureOfLoan?: string
  ) => void;
  onViewSource: (
    docName: string,
    pageNum?: number,
    snippet?: string,
    fieldOrig?: string,
    extractedVal?: string
  ) => void;
  onResetSession: () => void;
  downloadUrl: string | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const StepWorkflow: React.FC<StepWorkflowProps> = ({
  currentStep,
  onSetStep,
  onBackToHome,
  templateFilename,
  fieldsCount: _fieldsCount,
  tableGroupsCount: _tableGroupsCount,
  onSelectTemplateFromLibrary,
  onUploadTemplateFile,
  onOpenInStudio,
  isTemplateLoading,
  clientName,
  onChangeClientName,
  clientPhone,
  onChangeClientPhone,
  clientEmail,
  onChangeClientEmail,
  clientTitle,
  onChangeClientTitle,
  clientNatureOfLoan,
  onChangeClientNatureOfLoan,
  activeClient,
  onSelectExistingClient,
  sources,
  isSourcesLoading,
  onUploadSources,
  onRemoveSource,
  isExtracting,
  onStartScrutiny,
  results,
  tableResults,
  qaAnswers,
  questions,
  fields,
  tableGroups,
  sessionId,
  preferredDeedModel,
  onApplyDeedModel,
  isExporting,
  onExport,
  onViewSource,
  onResetSession,
  downloadUrl,
  showToast,
}) => {
  // Step 2: Saved clients for quick auto-fill
  const [savedClients, setSavedClients] = useState<Client[]>([]);

  // Step 3: Drag & drop deed upload states
  const [isDeedDragOver, setIsDeedDragOver] = useState<boolean>(false);
  const deedsFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch saved clients for Step 2
  const fetchClientsList = async () => {
    try {
      const data = await getClients();
      setSavedClients(data);
    } catch (err: any) {
      console.error('Failed to load clients', err);
    }
  };

  useEffect(() => {
    fetchClientsList();
  }, []);

  // Handle deed files drop / upload
  const handleDeedFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    onUploadSources(fileArray);
  };

  // Validate Step 2 Client Details before continuing
  const handleContinueToStep3 = () => {
    if (!clientName.trim()) {
      showToast('Please enter the Client Name to continue', 'error');
      return;
    }
    onSetStep(3);
  };

  // Trigger opinion generation from Step 3
  const handleGenerateOpinionClick = () => {
    if (sources.length === 0) {
      showToast('Please upload at least one deed document', 'error');
      return;
    }
    onSetStep(4);
    onStartScrutiny();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-16">
      {/* Return to Home link */}
      {onBackToHome && (
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Return to Home Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-500" />
            <span>← Back to Home Dashboard</span>
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* WORKFLOW PROGRESS INDICATOR (At Top)                        */}
      {/* ✓ Template  →  ✓ Client Details  →  ③ Upload Deeds  →  ④ Opinion */}
      {/* ============================================================ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold overflow-x-auto gap-2">
          {/* Step 1: Template */}
          <button
            type="button"
            onClick={() => onSetStep(1)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              currentStep === 1
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs ring-2 ring-amber-400/30'
                : currentStep > 1
                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                : 'text-slate-400'
            }`}
            title="Step 1: Choose Template"
          >
            {currentStep > 1 ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-950/15 text-[10px] flex items-center justify-center font-bold">1</span>
            )}
            <span>Template</span>
          </button>

          <span className="text-slate-300 font-bold">→</span>

          {/* Step 2: Client Details */}
          <button
            type="button"
            onClick={() => {
              if (currentStep > 2 || templateFilename) onSetStep(2);
            }}
            disabled={!templateFilename && currentStep === 1}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              currentStep === 2
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs ring-2 ring-amber-400/30 cursor-pointer'
                : currentStep > 2
                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 cursor-pointer'
                : 'text-slate-400 cursor-not-allowed opacity-60'
            }`}
            title="Step 2: Client Details"
          >
            {currentStep > 2 ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-950/15 text-[10px] flex items-center justify-center font-bold">2</span>
            )}
            <span>Client Details</span>
          </button>

          <span className="text-slate-300 font-bold">→</span>

          {/* Step 3: Upload Deeds */}
          <button
            type="button"
            onClick={() => {
              if (currentStep > 3 || (templateFilename && clientName.trim())) onSetStep(3);
            }}
            disabled={!clientName.trim() && currentStep < 3}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              currentStep === 3
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs ring-2 ring-amber-400/30 cursor-pointer'
                : currentStep > 3
                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 cursor-pointer'
                : 'text-slate-400 cursor-not-allowed opacity-60'
            }`}
            title="Step 3: Upload Deeds"
          >
            {currentStep > 3 ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-950/15 text-[10px] flex items-center justify-center font-bold">3</span>
            )}
            <span>Upload Deeds</span>
          </button>

          <span className="text-slate-300 font-bold">→</span>

          {/* Step 4: Opinion Generation */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              currentStep === 4
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs ring-2 ring-amber-400/30'
                : 'text-slate-400 opacity-60'
            }`}
            title="Step 4: Opinion Generation"
          >
            <span className="w-4 h-4 rounded-full bg-slate-950/15 text-[10px] flex items-center justify-center font-bold">4</span>
            <span>Generate Opinion</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* STEP 1: CHOOSE TEMPLATE — HORIZONTALLY SCROLLABLE LIBRARY     */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <HorizontalTemplateLibrary
          currentSessionId={sessionId}
          selectedTemplateFilename={templateFilename}
          onSelectTemplate={(res) => {
            onSelectTemplateFromLibrary(res);
          }}
          onOpenInStudio={(tId) => onOpenInStudio(tId)}
          onUploadFile={(file) => onUploadTemplateFile(file)}
          isTemplateLoading={isTemplateLoading}
          onAdvanceToStep2={() => onSetStep(2)}
          showToast={showToast}
        />
      )}

      {/* ============================================================ */}
      {/* STEP 2: CLIENT DETAILS                                       */}
      {/* ============================================================ */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            {/* Header & Template Association Tag */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-600" />
                  <span>Step 2 — Client Details</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter borrower / client information. The selected template remains associated.
                </p>
              </div>

              {templateFilename && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-slate-500">Template:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[180px]">{templateFilename}</span>
                </div>
              )}
            </div>

            {/* Quick Auto-Fill from Saved Clients (if available) */}
            {savedClients.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-600 font-medium">
                  Quick select from existing saved clients:
                </span>
                <select
                  onChange={(e) => {
                    const c = savedClients.find((item) => item.id === e.target.value);
                    if (c) onSelectExistingClient(c);
                  }}
                  value={activeClient?.id || ''}
                  className="bg-white border border-slate-300 text-xs text-slate-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer shadow-xs"
                >
                  <option value="">-- Choose an existing client --</option>
                  {savedClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.title ? `(${c.title})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client Name (Required) */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Client / Borrower Name <span className="text-amber-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => onChangeClientName(e.target.value)}
                    placeholder="e.g. Ganapathy & Lakshmi"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium transition-colors shadow-xs"
                    required
                  />
                </div>
              </div>

              {/* Phone Number (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => onChangeClientPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium transition-colors shadow-xs"
                  />
                </div>
              </div>

              {/* Email Address (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => onChangeClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium transition-colors shadow-xs"
                  />
                </div>
              </div>

              {/* Property / Matter Title (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Matter / Property Reference
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={clientTitle}
                    onChange={(e) => onChangeClientTitle(e.target.value)}
                    placeholder="e.g. Plot 42, VGP Layout, Sholinganallur"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium transition-colors shadow-xs"
                  />
                </div>
              </div>

              {/* Nature of Loan (Optional Dropdown) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nature of Loan / Classification
                </label>
                <select
                  value={clientNatureOfLoan}
                  onChange={(e) => onChangeClientNatureOfLoan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-sm text-slate-900 focus:outline-none font-medium transition-colors cursor-pointer shadow-xs"
                >
                  {LOAN_NATURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white text-slate-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions: Back | Continue */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onSetStep(1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Template</span>
              </button>

              <button
                type="button"
                onClick={handleContinueToStep3}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <span>Continue to Upload Deeds</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: UPLOAD DEEDS / DOCUMENTS                             */}
      {/* ============================================================ */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            {/* Header with Client & Template Context */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <span>Step 3 — Upload Deeds</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload title deeds, parent documents, encumbrance certificates, and patta records.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                  Client: <strong className="text-slate-900">{clientName}</strong>
                </span>
                {templateFilename && (
                  <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                    Template: <strong className="text-slate-900">{templateFilename}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* List of Uploaded Documents */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Uploaded Documents ({sources.length})
              </h3>

              {sources.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  No deed documents uploaded yet. Add your property documents below to proceed.
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((src) => (
                    <div
                      key={src.filename}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                            {src.filename}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-medium text-slate-700">
                              {src.is_scanned_ocr ? 'Scanned OCR (Tamil/Eng)' : 'Text / PDF Document'}
                            </span>
                            <span>•</span>
                            <span>{src.page_or_section_count ? `${src.page_or_section_count} pages` : 'Processed'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Uploaded</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveSource(src.filename)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove deed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dropzone / Upload Area: Add Another Document */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDeedDragOver(true);
              }}
              onDragLeave={() => setIsDeedDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDeedDragOver(false);
                handleDeedFilesSelected(e.dataTransfer.files);
              }}
              className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center space-y-3 cursor-pointer ${
                isDeedDragOver
                  ? 'border-amber-500 bg-amber-50/40'
                  : 'border-slate-300 hover:border-amber-400 bg-slate-50/60 hover:bg-amber-50/20'
              }`}
              onClick={() => deedsFileInputRef.current?.click()}
            >
              <input
                ref={deedsFileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
                onChange={(e) => handleDeedFilesSelected(e.target.files)}
                className="hidden"
              />

              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-amber-600 mx-auto shadow-xs">
                {isSourcesLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-900">
                  {isSourcesLoading
                    ? 'Processing & running OCR on deeds...'
                    : '+ Add Deed / Property Document'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Drag & drop PDF, DOCX, or scanned deed images, or click to browse files
                </p>
              </div>
            </div>

            {/* Actions: Back | Generate Opinion */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onSetStep(2)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Client Details</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateOpinionClick}
                disabled={sources.length === 0 || isSourcesLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>Generate Opinion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: OPINION GENERATION & SCRUTINY REVIEW                 */}
      {/* ============================================================ */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-fade-in">
          {isExtracting ? (
            /* Dedicated Generating Screen */
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <WorkspaceProcessing
                templateFilename={templateFilename}
                sourcesCount={sources.length}
              />
            </div>
          ) : (results.length > 0 || qaAnswers.length > 0) ? (
            /* Review & Final Opinion Synthesis */
            <ReviewTable
              fields={fields}
              results={results}
              tableGroups={tableGroups}
              tableResults={tableResults}
              sessionId={sessionId}
              templateFilename={templateFilename}
              preferredDeedModel={preferredDeedModel}
              initialNatureOfLoan={clientNatureOfLoan}
              onApplyDeedModel={onApplyDeedModel}
              isExporting={isExporting}
              onExport={onExport}
              onViewSource={onViewSource}
              onStartNewScrutiny={onResetSession}
              onBackToUploads={() => onSetStep(3)}
              onRegenerate={onStartScrutiny}
              downloadUrl={downloadUrl}
              qaAnswers={qaAnswers}
              questions={questions}
            />
          ) : (
            /* Fallback if user clicked Step 4 before generating */
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Ready to Generate Legal Opinion</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All client details and {sources.length} deed document(s) are uploaded and ready for analysis.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSetStep(3)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Deeds</span>
                </button>
                <button
                  type="button"
                  onClick={onStartScrutiny}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Now</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
