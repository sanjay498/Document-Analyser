import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  Trash2,
  Plus,
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
  Users,
  Search,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Building,
  UploadCloud,
  Phone,
  Mail,
  UserCheck,
  X
} from 'lucide-react';
import type {
  ExtractedSourceDocument,
  DeedModelDef,
  Client,
  TemplateSummary,
  StartScrutinyResponse
} from '../../types';
import { LegalDocEmptyIllustration } from '../illustrations/LegalIllustrations';
import {
  getDeedModels,
  detectDeedModel,
  listTemplates,
  saveTemplateToLibrary,
  checkExistingClient,
  createClient,
  startScrutinyForClient,
  linkClientToSession,
  getClients
} from '../../services/api';
import {
  LOAN_NATURE_OPTIONS,
  DEFAULT_LOAN_NATURE,
  getLoanNatureBadgeClass
} from '../../utils/loanModels';

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
  // Client Scrutiny Workflow Integration
  activeClient?: Client | null;
  onScrutinySessionReady: (res: StartScrutinyResponse) => void;
  onClearActiveClient?: () => void;
  showToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const WorkspaceIntake: React.FC<WorkspaceIntakeProps> = ({
  templateFilename,
  templateFieldsCount,
  tableGroupsCount,
  sources,
  isTemplateLoading,
  isSourcesLoading,
  onUploadTemplate: _onUploadTemplate,
  onUploadSources,
  onRemoveSource,
  onClearTemplate,
  onOpenTemplateLibrary: _onOpenTemplateLibrary,
  sessionId,
  preferredDeedModel,
  onSelectDeedModel,
  onStartScrutiny,
  activeClient,
  onScrutinySessionReady,
  onClearActiveClient,
  showToast,
}) => {
  // Drag and drop & deed models
  const [isDragOver, setIsDragOver] = useState(false);
  const [deedModels, setDeedModels] = useState<DeedModelDef[]>([]);
  const [autoDetectedModel, setAutoDetectedModel] = useState<DeedModelDef | null>(null);
  const [showSyntaxPreview, setShowSyntaxPreview] = useState(false);
  const [expandedDocText, setExpandedDocText] = useState<string | null>(null);

  // Template Selection (Step 1 of Create New Scrutiny)
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState<string>(() => {
    try {
      return localStorage.getItem('lex_scrutiny_template_search') || '';
    } catch {
      return '';
    }
  });
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [isUploadingNewTemplate, setIsUploadingNewTemplate] = useState(false);

  const handleTemplateSearchChange = (val: string) => {
    setTemplateSearch(val);
    try {
      localStorage.setItem('lex_scrutiny_template_search', val);
    } catch {
      // ignore storage issues
    }
  };

  // Client Details Form (Step 2 of Create New Scrutiny)
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTitle, setClientTitle] = useState('');
  const [clientNatureOfLoan, setClientNatureOfLoan] = useState<string>(DEFAULT_LOAN_NATURE);
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);

  // Existing Client Detection & Selection
  const [existingClientMatch, setExistingClientMatch] = useState<Client | null>(null);
  const [showExistingSelector, setShowExistingSelector] = useState(false);
  const [existingClients, setExistingClients] = useState<Client[]>([]);
  const [isLoadingExistingClients, setIsLoadingExistingClients] = useState(false);

  // Hidden File Inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateUploadInputRef = useRef<HTMLInputElement>(null);
  const deedsInputRef = useRef<HTMLInputElement>(null);

  // Fetch real database templates on mount
  const fetchRealTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await listTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to load templates from database', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchRealTemplates();
  }, []);

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

  // Fetch existing clients list when toggling existing client selector
  const loadExistingClientsList = async () => {
    setIsLoadingExistingClients(true);
    try {
      const list = await getClients();
      setExistingClients(list || []);
    } catch (err) {
      console.error('Failed to load existing clients', err);
    } finally {
      setIsLoadingExistingClients(false);
    }
  };

  const hasConfiguredSession = Boolean(templateFilename && activeClient);
  const canRunScrutiny = Boolean(templateFilename && activeClient && sources.length > 0);

  // Unified File Drop Handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (hasConfiguredSession) {
      // Session already configured with client & template, dropped files are deeds
      onUploadSources(files);
    } else {
      // Not yet configured, check if user dropped a template .docx
      const templateCandidate = files.find((f) => f.name.toLowerCase().endsWith('.docx'));
      if (templateCandidate) {
        handleUploadNewTemplateFile(templateCandidate);
      } else {
        showToast?.('Please select or upload an opinion template (.docx) first.', 'info');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Uploading a new .docx template directly into the database library
  const handleUploadNewTemplateFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      showToast?.('Only Word document (.docx) opinion templates are supported.', 'error');
      return;
    }
    setIsUploadingNewTemplate(true);
    try {
      const saved = await saveTemplateToLibrary(file);
      showToast?.(`Template "${saved.name}" uploaded to database!`, 'success');
      await fetchRealTemplates();
      handleSelectTemplate(saved);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to upload template', 'error');
    } finally {
      setIsUploadingNewTemplate(false);
    }
  };

  // Select a template from Step 1
  const handleSelectTemplate = async (template: TemplateSummary) => {
    setSelectedTemplate(template);
    setClientFormError(null);
    setExistingClientMatch(null);

    // If activeClient is already selected (e.g. from ClientsView), immediately start scrutiny!
    if (activeClient) {
      try {
        setIsSubmittingClient(true);
        const res = await startScrutinyForClient(activeClient.id, template.id);
        onScrutinySessionReady(res);
        setSelectedTemplate(null);
      } catch (err: any) {
        showToast?.(err.message || 'Failed to start scrutiny for client', 'error');
      } finally {
        setIsSubmittingClient(false);
      }
    }
  };

  // Submit Client Form (Step 2)
  const handleClientSubmit = async (e: React.FormEvent, forceNew: boolean = false) => {
    e.preventDefault();
    setClientFormError(null);

    const targetTemplate = selectedTemplate || templates.find((t) => t.name === templateFilename);
    if (!targetTemplate && !sessionId) {
      setClientFormError('Please select an opinion template first.');
      return;
    }

    const trimmedName = clientName.trim();
    const trimmedPhone = clientPhone.trim();
    const trimmedEmail = clientEmail.trim();
    const trimmedTitle = clientTitle.trim();

    if (!trimmedName || !trimmedPhone || !trimmedEmail || !trimmedTitle) {
      setClientFormError('All fields (Client Name, Phone Number, Email, and Title) are required.');
      return;
    }

    setIsSubmittingClient(true);
    try {
      if (!forceNew) {
        // Step 4: Check if client already exists by phone or email
        const check = await checkExistingClient(trimmedPhone, trimmedEmail);
        if (check.exists && check.client) {
          setExistingClientMatch(check.client);
          setIsSubmittingClient(false);
          return;
        }
      }

      // Step 3: Permanently store client in backend database
      const newClient = await createClient({
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        title: trimmedTitle,
        nature_of_loan: clientNatureOfLoan,
      });

      // Step 3 & 6: Start new scrutiny session or link active session
      let res: StartScrutinyResponse;
      if (targetTemplate?.id) {
        res = await startScrutinyForClient(newClient.id, targetTemplate.id);
      } else {
        res = await linkClientToSession(newClient.id, sessionId, clientNatureOfLoan);
      }
      onScrutinySessionReady(res);

      // Clean up intake state
      setSelectedTemplate(null);
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setClientTitle('');
      setClientNatureOfLoan(DEFAULT_LOAN_NATURE);
      setExistingClientMatch(null);
    } catch (err: any) {
      setClientFormError(err.message || 'Failed to register client and start scrutiny.');
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Re-use existing client chosen from duplicate check
  const handleUseExistingClientMatch = async (client: Client) => {
    const targetTemplate = selectedTemplate || templates.find((t) => t.name === templateFilename);
    if (!targetTemplate && !sessionId) return;
    setIsSubmittingClient(true);
    try {
      let res: StartScrutinyResponse;
      if (targetTemplate?.id) {
        res = await startScrutinyForClient(client.id, targetTemplate.id);
      } else {
        res = await linkClientToSession(client.id, sessionId, clientNatureOfLoan);
      }
      onScrutinySessionReady(res);
      setSelectedTemplate(null);
      setExistingClientMatch(null);
    } catch (err: any) {
      setClientFormError(err.message || 'Failed to start scrutiny with existing client.');
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Filter real database templates by search input
  const filteredTemplates = templates.filter((t) => {
    const q = templateSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.bank_name && t.bank_name.toLowerCase().includes(q))
    );
  });

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
            const files = Array.from(e.target.files);
            if (hasConfiguredSession) {
              onUploadSources(files);
            } else {
              const tmpl = files.find((f) => f.name.toLowerCase().endsWith('.docx'));
              if (tmpl) handleUploadNewTemplateFile(tmpl);
            }
          }
        }}
        className="hidden"
      />
      <input
        ref={templateUploadInputRef}
        type="file"
        accept=".docx"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadNewTemplateFile(e.target.files[0]);
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

      {/* ========================================================
          FLOW BRANCH 1: ACTIVE CONFIGURED SCRUTINY DESK
          (Client & Template are chosen, User is uploading deeds & running AI)
         ======================================================== */}
      {hasConfiguredSession ? (
        <div className="space-y-6">
          {/* Screen Title */}
          <div className="text-center space-y-2 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Step 3 of 3: Deed Upload & AI Scrutiny</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Documents Ready for Title Scrutiny
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Review your opinion template and source deeds below, then execute the AI legal scrutiny.
            </p>
          </div>

          {/* ACTIVE CLIENT BANNER (Client Record Permanently Stored in DB) */}
          {activeClient && (
            <div className="bg-[#0b0f19] border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                  {activeClient.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      Active Client
                    </span>
                    <h2 className="font-bold text-white text-base truncate" title={activeClient.name}>
                      {activeClient.name}
                    </h2>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: {activeClient.id.slice(0, 8)}...
                    </span>
                  </div>
                  <p className="text-xs text-amber-300 font-medium mt-0.5 truncate" title={activeClient.title}>
                    {activeClient.title}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {activeClient.phone}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 truncate max-w-[220px]">
                      <Mail className="w-3 h-3 text-slate-500" />
                      {activeClient.email}
                    </span>
                  </div>
                </div>
              </div>

              {onClearActiveClient && (
                <button
                  type="button"
                  onClick={onClearActiveClient}
                  className="text-xs text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors shrink-0 cursor-pointer"
                  title="Switch to another client"
                >
                  Change Client
                </button>
              )}
            </div>
          )}

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
              ) : (
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
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle className="w-3 h-3" /> Template Loaded
                    </span>
                    <button
                      type="button"
                      onClick={onClearTemplate}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Change Template
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

          {/* Phrasing Model Selector */}
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
              {sources.length > 0 ? (
                <span className="text-emerald-400 font-medium">✓ Ready for Title Scrutiny</span>
              ) : (
                <span className="text-amber-400 font-medium">Upload at least one deed above to continue</span>
              )}
            </div>
          </div>

          {/* Phrasing Preview Box */}
          {showSyntaxPreview && activeModel && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 animate-fade-in">
              <span className="font-semibold text-amber-300">{activeModel.name} Cadence:</span>
              <p className="text-[11px] font-mono text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800">
                "{activeModel.sample_text}"
              </p>
            </div>
          )}

          {/* Large Primary Action Button */}
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
      ) : (selectedTemplate || templateFilename) && !activeClient ? (
        /* ========================================================
            FLOW BRANCH 2: CLIENT DETAILS FORM (Step 2 of Scrutiny Intake)
            (Template is selected, User enters client details)
           ======================================================== */
        <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
          {/* Back Button & Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplate(null);
                  if (templateFilename) onClearTemplate();
                  setExistingClientMatch(null);
                  setClientFormError(null);
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Template Selection</span>
              </button>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Client Details & Loan Classification</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  Step 2 of 3
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Enter client information and loan classification model before proceeding to deed upload.
              </p>
            </div>

            {/* Selected Template Badge */}
            <div className="p-3 rounded-xl bg-[#070a13] border border-slate-800 flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-xs min-w-0 flex-1">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">Selected Template</span>
                <p className="font-bold text-white text-xs sm:text-sm break-words" title={selectedTemplate?.name || templateFilename || 'Opinion Template'}>
                  {selectedTemplate?.name || templateFilename || 'Opinion Template'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-amber-300 font-medium">
                    {selectedTemplate?.fields_count ?? templateFieldsCount} variables
                  </span>
                  {(selectedTemplate?.bank_name || 'General') !== 'General' && (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                      {selectedTemplate?.bank_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* DUPLICATE DETECTION PROMPT (If Existing Client Found) */}
          {existingClientMatch ? (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Existing Client Found</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                A client matching this phone number or email is already permanently registered in the database.
                Would you like to associate this new scrutiny with the existing client or register a new client?
              </p>

              <div className="bg-[#070a13] p-4 rounded-xl border border-amber-500/20 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{existingClientMatch.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: {existingClientMatch.id.slice(0, 8)}...</span>
                </div>
                <p className="text-slate-300">
                  <span className="text-slate-500">Phone:</span> {existingClientMatch.phone} • <span className="text-slate-500">Email:</span> {existingClientMatch.email}
                </p>
                <p className="text-amber-300 font-medium">
                  <span className="text-slate-500">Matter Title:</span> {existingClientMatch.title}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Nature of Loan:</span>{' '}
                  <span className="text-emerald-300 font-medium">
                    {existingClientMatch.nature_of_loan || DEFAULT_LOAN_NATURE}
                  </span>
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleUseExistingClientMatch(existingClientMatch)}
                  disabled={isSubmittingClient}
                  className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Use Existing Client & Start Scrutiny</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleClientSubmit(e, true)}
                  disabled={isSubmittingClient}
                  className="px-5 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Create New Client Anyway
                </button>

                <button
                  type="button"
                  onClick={() => setExistingClientMatch(null)}
                  className="px-4 py-3 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* MINIMAL CLIENT FORM (ONLY 4 REQUIRED FIELDS + LOAN NATURE) */
            <form onSubmit={(e) => handleClientSubmit(e, false)} className="space-y-4">
              {clientFormError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{clientFormError}</span>
                </div>
              )}

              {/* Quick Link to Select Existing Client if desired */}
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="text-slate-400 font-medium">Fill client details below:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!showExistingSelector) loadExistingClientsList();
                    setShowExistingSelector(!showExistingSelector);
                  }}
                  className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{showExistingSelector ? 'Enter Manually' : 'Select from Existing Clients'}</span>
                </button>
              </div>

              {/* Dropdown list of existing clients if toggled */}
              {showExistingSelector && (
                <div className="p-3.5 rounded-xl bg-[#070a13] border border-slate-800 space-y-2 animate-fade-in">
                  <p className="text-[11px] text-slate-400 font-medium">
                    Pick an existing client from your database:
                  </p>
                  {isLoadingExistingClients ? (
                    <div className="text-xs text-slate-500 py-2 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      Loading clients...
                    </div>
                  ) : existingClients.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No existing clients found in database.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {existingClients.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setClientName(c.name);
                            setClientPhone(c.phone);
                            setClientEmail(c.email);
                            setClientTitle(c.title);
                            if (c.nature_of_loan) {
                              setClientNatureOfLoan(c.nature_of_loan);
                            }
                            setShowExistingSelector(false);
                          }}
                          className="p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 flex items-center justify-between cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{c.name}</span>
                            <span className="text-slate-400 text-[11px]">({c.title})</span>
                            {c.nature_of_loan && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getLoanNatureBadgeClass(c.nature_of_loan)}`}>
                                {c.nature_of_loan}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-amber-400 font-mono shrink-0">{c.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 1. Client Name (Required) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Client Name</span>
                  <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K. Muthulakshmi"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-[#070a13] border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                />
              </div>

              {/* 2. Phone Number (Required) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Phone Number</span>
                  <span className="text-amber-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9842112345"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-[#070a13] border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors font-mono"
                />
              </div>

              {/* 3. Email (Required) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Email</span>
                  <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. muthulakshmi@property.org"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-[#070a13] border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                />
              </div>

              {/* 4. Title / Matter Reference (Required) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <span>Title</span>
                  <span className="text-amber-400">*</span>
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    (Matter reference or property description)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Title Scrutiny for S.F. No. 245/1B, Madurai"
                  value={clientTitle}
                  onChange={(e) => setClientTitle(e.target.value)}
                  className="w-full bg-[#070a13] border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                />
              </div>

              {/* 5. Nature of Loan / Facility (Required) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>Nature of Loan / Facility</span>
                    <span className="text-amber-400">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Model Classification
                  </span>
                </label>
                <select
                  value={clientNatureOfLoan}
                  onChange={(e) => setClientNatureOfLoan(e.target.value)}
                  className="w-full bg-[#070a13] border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-white focus:outline-none transition-colors cursor-pointer"
                >
                  {LOAN_NATURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null);
                    if (templateFilename) onClearTemplate();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingClient}
                  className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-400/10 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingClient ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Client & Proceeding...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Client & Proceed to Upload Deeds</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* ========================================================
            FLOW BRANCH 3: "CREATE NEW SCRUTINY" — SELECT TEMPLATE
            (Shows real templates with horizontal layout, persistent search, bank & category filters)
           ======================================================== */
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold mb-1">
              <span>Step 1 of 3: Choose Opinion Template</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Create New Scrutiny
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Select an opinion template directly from your database or upload a new template (.docx) to begin.
            </p>
          </div>

          {/* Template Search Bar & Upload Button (Never auto-clears typed name) */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates by deed name, category, or keywords..."
                value={templateSearch}
                onChange={(e) => handleTemplateSearchChange(e.target.value)}
                className="w-full bg-[#070a13] border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              {templateSearch && (
                <button
                  type="button"
                  onClick={() => handleTemplateSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                  title="Clear template search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => templateUploadInputRef.current?.click()}
                disabled={isUploadingNewTemplate}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isUploadingNewTemplate ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Template (.docx)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={fetchRealTemplates}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Refresh templates"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTemplates ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span>
              <strong className="text-white font-semibold">{filteredTemplates.length}</strong>{' '}
              {filteredTemplates.length === 1 ? 'template available' : 'templates available'}
            </span>
          </div>

          {/* TEMPLATES CONTAINER (CLEAN SIMPLE LIST) */}
          {isLoadingTemplates ? (
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-300">Loading templates from database...</p>
            </div>
          ) : templates.length === 0 ? (
            /* CLEAN EMPTY STATE (When no templates exist in database) */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 flex flex-col items-center justify-center space-y-4 ${
                isDragOver
                  ? 'border-amber-400 bg-amber-500/5'
                  : 'border-slate-800 bg-[#0b0f19]'
              }`}
            >
              <LegalDocEmptyIllustration size={80} className="opacity-90" />
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  No templates found in database
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  To start a scrutiny, please upload an opinion template (.docx) with yellow highlighted variables.
                  The template will be saved to your template library.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => templateUploadInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-400/10 active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Template (.docx)</span>
                </button>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            /* No search results */
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No matching templates</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No templates matched your search {templateSearch ? `"${templateSearch}"` : ''}.
              </p>
              {templateSearch && (
                <button
                  type="button"
                  onClick={() => handleTemplateSearchChange('')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Clear Search</span>
                </button>
              )}
            </div>
          ) : (
            /* CLEAN STREAMLINED TEMPLATE LIST */
            <div className="space-y-2.5">
              {filteredTemplates.map((t) => {
                const bankLabel = (t.bank_name && t.bank_name !== 'General') ? t.bank_name : 'Default';
                const isDefault = bankLabel.toLowerCase() === 'default';

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className="w-full p-4 rounded-xl bg-[#0b0f19] border border-slate-800 hover:border-amber-400/60 hover:bg-[#0e1424] transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md hover:shadow-amber-400/5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                              isDefault
                                ? 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            <Building className="w-2.5 h-2.5" />
                            {bankLabel}
                          </span>
                        </div>
                        <h3
                          className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors leading-snug break-words"
                          title={t.name}
                        >
                          {t.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                          {t.fields_count} variables
                        </span>
                        {t.table_groups_count > 0 && (
                          <span className="text-[11px] font-medium text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded">
                            {t.table_groups_count} tables
                          </span>
                        )}
                      </div>

                      <span className="px-3.5 py-1.5 rounded-xl bg-amber-400 group-hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/10 transition-all">
                        <span>Select</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Drop Area for Custom Templates */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`p-6 rounded-2xl border border-dashed text-center transition-colors cursor-pointer ${
              isDragOver
                ? 'border-amber-400 bg-amber-500/5'
                : 'border-slate-800/80 bg-[#070a13]/50 hover:border-slate-700'
            }`}
            onClick={() => templateUploadInputRef.current?.click()}
          >
            <p className="text-xs text-slate-400">
              Need to use a custom template? <span className="text-amber-400 underline font-medium">Click here or drag a .docx file</span> to add it to your library.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
