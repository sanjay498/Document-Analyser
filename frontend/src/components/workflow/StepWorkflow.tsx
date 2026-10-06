import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  ArrowRight,
  ArrowLeft,
  Check,
  Trash2,
  Upload,
  RefreshCw,
  FolderOpen,
  Edit3,
  Calendar,
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
  TemplateSummary,
  Client,
  UseTemplateResponse
} from '../../types';
import { listTemplates, getClients, useTemplateInSession } from '../../services/api';
import { LOAN_NATURE_OPTIONS } from '../../utils/loanModels';
import { WorkspaceProcessing } from '../workspace/WorkspaceProcessing';
import { ReviewTable } from '../ReviewTable';

export interface StepWorkflowProps {
  currentStep: 1 | 2 | 3 | 4;
  onSetStep: (step: 1 | 2 | 3 | 4) => void;

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
  templateFilename,
  fieldsCount,
  tableGroupsCount,
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
  // Existing template cards state for Step 1
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Saved clients list for auto-fill in Step 2
  const [savedClients, setSavedClients] = useState<Client[]>([]);

  // File input refs
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const deedsFileInputRef = useRef<HTMLInputElement>(null);
  const [isDeedDragOver, setIsDeedDragOver] = useState<boolean>(false);

  // Fetch templates for Step 1
  const fetchTemplatesList = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (err: any) {
      console.error('Failed to load templates', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

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
    fetchTemplatesList();
    fetchClientsList();
  }, []);

  // Handle template selection from existing cards
  const handleUseTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    try {
      const res = await useTemplateInSession(templateId);
      onSelectTemplateFromLibrary(res);
      showToast(`Selected "${res.template_filename}"`, 'success');
      // Advance automatically to Step 2: Client Details
      onSetStep(2);
    } catch (err: any) {
      showToast(err.message || 'Failed to load template', 'error');
    }
  };

  // Handle direct file upload for template
  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadTemplateFile(file);
      // Once uploaded, advance to Step 2
      onSetStep(2);
    }
  };

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

  // Format date helper
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* ============================================================ */}
      {/* WORKFLOW PROGRESS INDICATOR (At Top)                        */}
      {/* ✓ Template  →  ✓ Client Details  →  ③ Upload Deeds  →  ④ Opinion */}
      {/* ============================================================ */}
      <div className="bg-[#0b0f19] border border-slate-800/90 rounded-2xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between text-xs font-semibold overflow-x-auto gap-2">
          {/* Step 1: Template */}
          <button
            type="button"
            onClick={() => onSetStep(1)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              currentStep === 1
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20 ring-2 ring-amber-400/30'
                : currentStep > 1
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                : 'text-slate-500'
            }`}
            title="Step 1: Choose Template"
          >
            {currentStep > 1 ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-950/20 text-[10px] flex items-center justify-center font-bold">1</span>
            )}
            <span>Template</span>
          </button>

          <span className="text-slate-600 font-bold">→</span>

          {/* Step 2: Client Details */}
          <button
            type="button"
            onClick={() => {
              if (currentStep > 2 || templateFilename) onSetStep(2);
            }}
            disabled={!templateFilename && currentStep === 1}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              currentStep === 2
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20 ring-2 ring-amber-400/30 cursor-pointer'
                : currentStep > 2
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer'
                : 'text-slate-500 cursor-not-allowed opacity-60'
            }`}
            title="Step 2: Client Details"
          >
            {currentStep > 2 ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-950/20 text-[10px] flex items-center justify-center font-bold">2</span>
            )}
            <span>Client Details</span>
          </button>

          <span className="text-slate-600 font-bold">→</span>

          {/* Step 3: Upload Deeds */}
          <button
            type="button"
            onClick={() => {
              if (currentStep > 3 || (templateFilename && clientName.trim())) onSetStep(3);
            }}
            disabled={!clientName.trim() && currentStep < 3}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              currentStep === 3
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20 ring-2 ring-amber-400/30 cursor-pointer'
                : currentStep > 3
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer'
                : 'text-slate-500 cursor-not-allowed opacity-60'
            }`}
            title="Step 3: Upload Deeds"
          >
            {currentStep > 3 ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-slate-950/20 text-[10px] flex items-center justify-center font-bold">3</span>
            )}
            <span>Upload Deeds</span>
          </button>

          <span className="text-slate-600 font-bold">→</span>

          {/* Step 4: Opinion Generation */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              currentStep === 4
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20 ring-2 ring-amber-400/30'
                : 'text-slate-500 opacity-60'
            }`}
            title="Step 4: Opinion Generation"
          >
            <span className="w-4 h-4 rounded-full bg-slate-950/20 text-[10px] flex items-center justify-center font-bold">4</span>
            <span>Generate Opinion</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* STEP 1: CHOOSE TEMPLATE                                      */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Action Row */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <span>Step 1 — Choose Template</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Select a bank or legal opinion template, or create a brand new template in Highlight Studio.
              </p>
            </div>

            {/* Option 1: Create New Template */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenInStudio()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Create a brand new template using Highlight Studio"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Create New Template</span>
              </button>

              {/* Direct Word Upload */}
              <input
                ref={templateFileInputRef}
                type="file"
                accept=".docx"
                onChange={handleTemplateFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => templateFileInputRef.current?.click()}
                disabled={isTemplateLoading}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer shadow-sm"
                title="Upload a Word (.docx) template file directly"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{isTemplateLoading ? 'Processing...' : 'Upload .docx File'}</span>
              </button>
            </div>
          </div>

          {/* Currently Selected Template Banner if user navigated back */}
          {templateFilename && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider block">
                    Currently Selected Template
                  </span>
                  <span className="text-sm font-bold text-white">{templateFilename}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    ({fieldsCount} dynamic fields{tableGroupsCount > 0 ? `, ${tableGroupsCount} tables` : ''})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSetStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer"
              >
                <span>Continue with this Template</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Option 2: Use Existing Template Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Existing Templates ({templates.length})
              </h3>
              <button
                type="button"
                onClick={fetchTemplatesList}
                className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingTemplates ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingTemplates ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                <span>Loading available templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#0b0f19] border border-slate-800 text-center space-y-3">
                <FolderOpen className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  No saved templates found. Create one using Highlight Studio or upload a .docx file.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenInStudio()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Template in Highlight Studio</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tpl) => {
                  const isSelected = templateFilename === tpl.name || selectedTemplateId === tpl.id;

                  return (
                    <div
                      key={tpl.id}
                      className={`p-5 rounded-2xl bg-[#0b0f19] border transition-all flex flex-col justify-between gap-4 shadow-sm ${
                        isSelected
                          ? 'border-amber-400/80 ring-1 ring-amber-400/40 bg-amber-500/[0.03]'
                          : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                                {tpl.name}
                              </h4>
                              {tpl.bank_name && (
                                <span className="inline-block text-[10px] text-amber-400/90 font-medium">
                                  {tpl.bank_name}
                                </span>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                              Selected ✓
                            </span>
                          )}
                        </div>

                        {/* Short Description */}
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Includes {tpl.fields_count} dynamic field(s)
                          {tpl.table_groups_count > 0 ? ` and ${tpl.table_groups_count} table(s)` : ''} for
                          title search scrutiny.
                        </p>

                        {/* Last Updated Date */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                          <Calendar className="w-3 h-3" />
                          <span>Updated {formatDate(tpl.created_at)}</span>
                        </div>
                      </div>

                      {/* Card Action Buttons: Use Template | Edit */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => handleUseTemplate(tpl.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
                          }`}
                        >
                          <span>{isSelected ? 'Use Template (Active)' : 'Use Template'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenInStudio(tpl.id)}
                          className="flex items-center gap-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
                          title="Edit template in Highlight Studio"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: CLIENT DETAILS                                       */}
      {/* ============================================================ */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Header & Template Association Tag */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-400" />
                  <span>Step 2 — Client Details</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter borrower / client information. The selected template remains associated.
                </p>
              </div>

              {templateFilename && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-400">Template:</span>
                  <span className="font-semibold text-white truncate max-w-[180px]">{templateFilename}</span>
                </div>
              )}
            </div>

            {/* Quick Auto-Fill from Saved Clients (if available) */}
            {savedClients.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Quick select from existing saved clients:
                </span>
                <select
                  onChange={(e) => {
                    const c = savedClients.find((item) => item.id === e.target.value);
                    if (c) onSelectExistingClient(c);
                  }}
                  value={activeClient?.id || ''}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer"
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
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Client / Borrower Name <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => onChangeClientName(e.target.value)}
                    placeholder="e.g. Ganapathy & Lakshmi"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none font-medium transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Phone Number (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => onChangeClientPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none font-medium transition-colors"
                  />
                </div>
              </div>

              {/* Email Address (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => onChangeClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none font-medium transition-colors"
                  />
                </div>
              </div>

              {/* Property / Matter Title (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Matter / Property Reference
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={clientTitle}
                    onChange={(e) => onChangeClientTitle(e.target.value)}
                    placeholder="e.g. Plot 42, VGP Layout, Sholinganallur"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none font-medium transition-colors"
                  />
                </div>
              </div>

              {/* Nature of Loan (Optional Dropdown) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Nature of Loan / Classification
                </label>
                <select
                  value={clientNatureOfLoan}
                  onChange={(e) => onChangeClientNatureOfLoan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white focus:outline-none font-medium transition-colors cursor-pointer"
                >
                  {LOAN_NATURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions: Back | Continue */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onSetStep(1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Template</span>
              </button>

              <button
                type="button"
                onClick={handleContinueToStep3}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-md active:scale-95 cursor-pointer"
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
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Header with Client & Template Context */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>Step 3 — Upload Deeds</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload title deeds, parent documents, encumbrance certificates, and patta records.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                  Client: <strong className="text-white">{clientName}</strong>
                </span>
                {templateFilename && (
                  <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                    Template: <strong className="text-white">{templateFilename}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* List of Uploaded Documents */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Uploaded Documents ({sources.length})
              </h3>

              {sources.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No deed documents uploaded yet. Add your property documents below to proceed.
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((src) => (
                    <div
                      key={src.filename}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate max-w-[280px] sm:max-w-md">
                            {src.filename}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-medium text-slate-300">
                              {src.is_scanned_ocr ? 'Scanned OCR (Tamil/Eng)' : 'Text / PDF Document'}
                            </span>
                            <span>•</span>
                            <span>{src.page_or_section_count ? `${src.page_or_section_count} pages` : 'Processed'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Uploaded</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveSource(src.filename)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
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

              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400 mx-auto">
                {isSourcesLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-white">
                  {isSourcesLoading
                    ? 'Processing & running OCR on deeds...'
                    : '+ Add Deed / Property Document'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Drag & drop PDF, DOCX, or scanned deed images, or click to browse files
                </p>
              </div>
            </div>

            {/* Actions: Back | Generate Opinion */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onSetStep(2)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Client Details</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateOpinionClick}
                disabled={sources.length === 0 || isSourcesLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
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
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-xl">
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
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Ready to Generate Legal Opinion</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All client details and {sources.length} deed document(s) are uploaded and ready for analysis.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSetStep(3)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Deeds</span>
                </button>
                <button
                  type="button"
                  onClick={onStartScrutiny}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300"
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
