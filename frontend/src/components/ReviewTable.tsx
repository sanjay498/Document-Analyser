import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Download,
  RotateCcw,
  Search,
  Info,
  Plus,
  Trash2,
  Table as TableIcon,
  ShieldAlert,
  Check,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Edit3,
  BookmarkPlus,
  CheckCheck,
  BookOpen,
  X
} from 'lucide-react';
import { getDeedModels, applyDeedModelToSession, renameSessionDocument, saveSessionAsTemplate } from '../services/api';
import {
  generateSmartDocName,
  generateSmartTemplateName,
  sanitizeFilename
} from '../utils/naming';
import { LOAN_NATURE_OPTIONS, DEFAULT_LOAN_NATURE } from '../utils/loanModels';
import type {
  HighlightedField,
  FieldExtractionResult,
  DynamicTableGroup,
  DynamicTableGroupResult,
  DeedModelDef,
  TemplateQuestion,
  QuestionAnswer,
} from '../types';
import { LegalConflictIllustration } from './illustrations/LegalIllustrations';

interface ReviewTableProps {
  fields: HighlightedField[];
  results: FieldExtractionResult[];
  tableGroups?: DynamicTableGroup[];
  tableResults?: DynamicTableGroupResult[];
  sessionId?: string;
  templateFilename?: string;
  preferredDeedModel?: string;
  initialNatureOfLoan?: string;
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
  onApplyDeedModel?: (modelId: string) => Promise<void> | void;
  onViewSource?: (
    docName: string,
    pageNum?: number,
    snippet?: string,
    fieldOrig?: string,
    extractedVal?: string
  ) => void;
  onStartNewScrutiny?: () => void;
  downloadUrl: string | null;
  qaAnswers?: QuestionAnswer[];
  questions?: TemplateQuestion[];
  onSaveAsTemplate?: () => void;
}

export const ReviewTable: React.FC<ReviewTableProps> = ({
  fields,
  results,
  tableGroups = [],
  tableResults = [],
  sessionId,
  templateFilename,
  preferredDeedModel = 'normal_partition',
  initialNatureOfLoan,
  isExporting,
  onExport,
  onApplyDeedModel,
  onViewSource,
  onStartNewScrutiny,
  downloadUrl,
  qaAnswers = [],
  questions: _questions = [],
  onSaveAsTemplate,
}) => {
  // Store Q&A answers and unified tab state
  const [localQaAnswers, setLocalQaAnswers] = useState<QuestionAnswer[]>(qaAnswers);
  const [activeReviewTab, setActiveReviewTab] = useState<'fields' | 'qa'>(
    results.length > 0 ? 'fields' : 'qa'
  );
  // Store nature of loan model state
  const [natureOfLoan, setNatureOfLoan] = useState<string>(
    initialNatureOfLoan || DEFAULT_LOAN_NATURE
  );

  useEffect(() => {
    if (initialNatureOfLoan) {
      setNatureOfLoan(initialNatureOfLoan);
    }
  }, [initialNatureOfLoan]);

  // Store user-resolved field values: field_id -> string
  const [resolvedValues, setResolvedValues] = useState<Record<string, string>>({});
  // Store fields marked explicitly as "leave blank / keep original"
  const [leaveBlankSet, setLeaveBlankSet] = useState<Set<string>>(new Set());
  // Store selected conflict sources: field_id -> selected value
  const [selectedConflictMap, setSelectedConflictMap] = useState<Record<string, string>>({});
  // Store dynamic table records: group_id -> array of row objects
  const [dynamicTables, setDynamicTables] = useState<Record<string, Array<Record<string, string>>>>({});

  // Smart Auto-Generated Document Name state
  const [customDocName, setCustomDocName] = useState<string>(() =>
    generateSmartDocName({
      templateFilename,
      results,
      fields,
    })
  );
  const [isEditingDocName, setIsEditingDocName] = useState<boolean>(false);
  const [editDocNameInput, setEditDocNameInput] = useState<string>(customDocName);
  const [isEditingBottomDocName, setIsEditingBottomDocName] = useState<boolean>(false);
  const [editBottomDocNameInput, setEditBottomDocNameInput] = useState<string>(customDocName);
  const userEditedDocNameRef = useRef<boolean>(false);

  // Template saving modal state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);
  const [templateSaveName, setTemplateSaveName] = useState<string>('');
  const [templateSaveBank, setTemplateSaveBank] = useState<string>('General');
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState<string | null>(null);

  const [qaSearchQuery, setQaSearchQuery] = useState<string>('');
  const [qaFilter, setQaFilter] = useState<'all' | 'complied' | 'conflicts' | 'missing'>('all');

  useEffect(() => {
    if (qaAnswers && qaAnswers.length > 0) {
      setLocalQaAnswers(qaAnswers);
    }
  }, [qaAnswers]);

  // Intelligent auto-naming effect: runs when template, results, fields, or resolved values update
  useEffect(() => {
    if (!userEditedDocNameRef.current) {
      const smart = generateSmartDocName({
        templateFilename,
        results,
        fields,
        resolvedValues,
      });
      setCustomDocName(smart);
      setEditDocNameInput(smart);
      setEditBottomDocNameInput(smart);
    }
  }, [templateFilename, results, fields, resolvedValues]);

  const handleUpdateQaAnswer = (questionId: string, answer: string) => {
    setLocalQaAnswers((prev) =>
      prev.map((a) => (a.question_id === questionId ? { ...a, answer, status: 'user_edited' } : a))
    );
  };

  const handleUpdateQaCompliance = (questionId: string, compliance_status: string) => {
    setLocalQaAnswers((prev) =>
      prev.map((a) => (a.question_id === questionId ? { ...a, compliance_status } : a))
    );
  };

  const handleApproveAllQa = () => {
    setLocalQaAnswers((prev) =>
      prev.map((a) => ({ ...a, compliance_status: 'Complied' }))
    );
  };

  // Renaming document filename (ubiquitously available at top & bottom bars)
  const handleSaveDocName = async (newName?: string) => {
    const rawName = newName !== undefined ? newName : editDocNameInput;
    const clean = sanitizeFilename(rawName.trim() || customDocName);
    setIsEditingDocName(false);
    setIsEditingBottomDocName(false);
    if (!clean) return;

    setCustomDocName(clean);
    setEditDocNameInput(clean);
    setEditBottomDocNameInput(clean);
    userEditedDocNameRef.current = true;

    if (sessionId) {
      try {
        await renameSessionDocument(sessionId, clean);
      } catch (err) {
        console.error('Failed to rename document on server:', err);
      }
    }
  };

  const handleOpenSaveTemplateModal = () => {
    const smartTpl = generateSmartTemplateName({ templateFilename, fields, bankName: 'Default' });
    setTemplateSaveName(smartTpl);
    setTemplateSaveBank('Default');
    setShowSaveTemplateModal(true);
  };

  const handleConfirmSaveTemplate = async () => {
    if (!sessionId) return;
    setIsSavingTemplate(true);
    try {
      const finalTplName = sanitizeFilename(templateSaveName.trim() || 'Template.docx');
      const res = await saveSessionAsTemplate(sessionId, finalTplName, templateSaveBank);
      setShowSaveTemplateModal(false);
      setTemplateSavedMsg(`Saved "${res.name}" to Template Library!`);
      setTimeout(() => setTemplateSavedMsg(null), 5000);
      if (onSaveAsTemplate) onSaveAsTemplate();
    } catch (err: any) {
      console.error('Failed to save template:', err);
      setTemplateSavedMsg(`Error: ${err.message || 'Failed to save template'}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };
  
  const [clearHighlight, setClearHighlight] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'verified' | 'conflicts' | 'not_found'>('verified');
  const [searchQuery, setSearchQuery] = useState('');

  // Deed Models State
  const [deedModels, setDeedModels] = useState<DeedModelDef[]>([]);
  const [selectedDeedModel, setSelectedDeedModel] = useState<string>(preferredDeedModel || 'normal_partition');
  const [isApplyingDeedModel, setIsApplyingDeedModel] = useState<boolean>(false);
  const [showSyntaxPreview, setShowSyntaxPreview] = useState<boolean>(false);

  // Load available deed models on mount
  useEffect(() => {
    getDeedModels()
      .then((res) => {
        if (res.models) {
          setDeedModels(res.models);
        }
      })
      .catch((err) => console.error('Failed to load deed models in ReviewTable', err));
  }, []);

  useEffect(() => {
    if (preferredDeedModel) {
      setSelectedDeedModel(preferredDeedModel);
    }
  }, [preferredDeedModel]);

  // Initialize values from results when results change
  const resultsSignature = useMemo(
    () => results.map((r) => `${r.field_id}:${r.status}:${r.value || ''}`).join('|'),
    [results]
  );
  const tablesSignature = useMemo(
    () => tableResults.map((tr) => `${tr.group_id}:${tr.records.length}`).join('|'),
    [tableResults]
  );

  useEffect(() => {
    const initialValues: Record<string, string> = {};
    const initialConflicts: Record<string, string> = {};

    results.forEach((r) => {
      if (r.status === 'conflict') {
        initialConflicts[r.field_id] = '';
      } else if (r.value !== null && r.value !== undefined) {
        initialValues[r.field_id] = r.value;
      } else {
        initialValues[r.field_id] = '';
      }
    });

    setResolvedValues(initialValues);
    setSelectedConflictMap(initialConflicts);

    // Initialize dynamic table records
    const initialTables: Record<string, Array<Record<string, string>>> = {};
    tableResults.forEach((tr) => {
      initialTables[tr.group_id] = tr.records.map((rec) => ({ ...rec }));
    });
    setDynamicTables(initialTables);
  }, [resultsSignature, tablesSignature]);

  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.field_id, f])), [fields]);

  // Compute resolution status per field
  const fieldResolutionStatus = useMemo(() => {
    const statusMap: Record<string, 'resolved' | 'unresolved_not_found' | 'unresolved_conflict'> = {};

    results.forEach((r) => {
      if (r.status === 'conflict') {
        const picked = selectedConflictMap[r.field_id] || resolvedValues[r.field_id];
        if (picked && picked.trim() !== '') {
          statusMap[r.field_id] = 'resolved';
        } else if (leaveBlankSet.has(r.field_id)) {
          statusMap[r.field_id] = 'resolved';
        } else {
          statusMap[r.field_id] = 'unresolved_conflict';
        }
      } else if (r.status === 'not_found') {
        const val = resolvedValues[r.field_id];
        if (val && val.trim() !== '') {
          statusMap[r.field_id] = 'resolved';
        } else if (leaveBlankSet.has(r.field_id)) {
          statusMap[r.field_id] = 'resolved';
        } else {
          statusMap[r.field_id] = 'unresolved_not_found';
        }
      } else {
        statusMap[r.field_id] = 'resolved';
      }
    });

    return statusMap;
  }, [results, resolvedValues, selectedConflictMap, leaveBlankSet]);

  const unresolvedConflictsCount = useMemo(() => {
    return results.filter((r) => {
      if (r.status !== 'conflict') return false;
      const picked = selectedConflictMap[r.field_id] || resolvedValues[r.field_id];
      return (!picked || picked.trim() === '') && !leaveBlankSet.has(r.field_id);
    }).length;
  }, [results, selectedConflictMap, resolvedValues, leaveBlankSet]);

  const unresolvedMissingCount = useMemo(() => {
    return results.filter((r) => {
      if (r.status !== 'not_found') return false;
      const val = resolvedValues[r.field_id];
      return (!val || val.trim() === '') && !leaveBlankSet.has(r.field_id);
    }).length;
  }, [results, resolvedValues, leaveBlankSet]);

  const conflictCount = useMemo(() => {
    return results.filter((r) => r.status === 'conflict').length;
  }, [results]);

  const notFoundCount = useMemo(() => {
    return results.filter((r) => r.status === 'not_found').length;
  }, [results]);

  const verifiedCount = results.length - conflictCount - notFoundCount;

  // Handlers
  const handleValueChange = (fieldId: string, val: string) => {
    setResolvedValues((prev) => ({ ...prev, [fieldId]: val }));
    setLeaveBlankSet((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  };

  const handlePickConflictOption = (fieldId: string, val: string) => {
    setSelectedConflictMap((prev) => ({ ...prev, [fieldId]: val }));
    setResolvedValues((prev) => ({ ...prev, [fieldId]: val }));
    setLeaveBlankSet((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  };

  const handleToggleLeaveBlank = (fieldId: string) => {
    setLeaveBlankSet((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
        setResolvedValues((v) => ({ ...v, [fieldId]: '' }));
      }
      return next;
    });
  };

  const handleResetToAI = (fieldId: string) => {
    const origAI = results.find((r) => r.field_id === fieldId);
    if (origAI?.value) {
      setResolvedValues((prev) => ({ ...prev, [fieldId]: origAI.value || '' }));
    }
  };

  // Dynamic Table row manipulation
  const handleTableCellChange = (groupId: string, rowIdx: number, colKey: string, val: string) => {
    setDynamicTables((prev) => {
      const rows = [...(prev[groupId] || [])];
      if (rowIdx < rows.length) {
        rows[rowIdx] = { ...rows[rowIdx], [colKey]: val };
      }
      return { ...prev, [groupId]: rows };
    });
  };

  const handleAddTableRow = (groupId: string, templateColumns: string[]) => {
    setDynamicTables((prev) => {
      const rows = [...(prev[groupId] || [])];
      const newRow: Record<string, string> = {};
      templateColumns.forEach((col) => {
        newRow[col] = '';
      });
      rows.push(newRow);
      return { ...prev, [groupId]: rows };
    });
  };

  const handleDeleteTableRow = (groupId: string, rowIdx: number) => {
    setDynamicTables((prev) => {
      const rows = [...(prev[groupId] || [])];
      rows.splice(rowIdx, 1);
      return { ...prev, [groupId]: rows };
    });
  };

  // Deed Model Selection & Application
  const handleDeedModelChange = async (modelId: string) => {
    setSelectedDeedModel(modelId);
    await handleApplyDeedModel(modelId);
  };

  const handleApplyDeedModel = async (modelId: string) => {
    if (!sessionId) {
      onApplyDeedModel?.(modelId);
      return;
    }

    setIsApplyingDeedModel(true);
    try {
      const res = await applyDeedModelToSession(sessionId, modelId, resolvedValues);
      if (res.formatted_text) {
        // Find matching trace field
        const traceResult = results.find((r) => {
          const lowerOrig = (r.original_text || '').toLowerCase();
          const lowerFieldId = (r.field_id || '').toLowerCase();
          return (
            lowerFieldId.includes('trace') ||
            lowerFieldId.includes('recital') ||
            lowerOrig.includes('trace of title') ||
            lowerOrig.includes('flow of title') ||
            lowerOrig.includes('root deed') ||
            (lowerOrig.includes('originally belonged to') && !lowerOrig.includes('sub:'))
          );
        });

        if (traceResult) {
          setResolvedValues((prev) => ({ ...prev, [traceResult.field_id]: res.formatted_text }));
        }
      }
      onApplyDeedModel?.(modelId);
    } catch (err) {
      console.error('Failed to apply deed model', err);
    } finally {
      setIsApplyingDeedModel(false);
    }
  };

  // Auto-blank all missing / not_found fields
  const handleAutoBlankAllMissing = () => {
    const nextSet = new Set(leaveBlankSet);
    const nextValues = { ...resolvedValues };
    results.forEach((r) => {
      if (r.status === 'not_found') {
        nextSet.add(r.field_id);
        nextValues[r.field_id] = '';
      }
    });
    setLeaveBlankSet(nextSet);
    setResolvedValues(nextValues);
  };

  // Export trigger
  const handleExportClick = () => {
    // 1. Check for unresolved conflicts
    const unresolvedConflicts = results.filter((r) => {
      if (r.status !== 'conflict') return false;
      const picked = selectedConflictMap[r.field_id] || resolvedValues[r.field_id];
      return (!picked || picked.trim() === '') && !leaveBlankSet.has(r.field_id);
    });

    if (unresolvedConflicts.length > 0) {
      alert(`Please select a winning source or enter a value for the ${unresolvedConflicts.length} conflicting field(s).`);
      setFilter('conflicts');
      return;
    }

    // 2. Prepare payload fields
    const payloadFields: Record<string, string | null> = {};
    results.forEach((r) => {
      if (leaveBlankSet.has(r.field_id)) {
        payloadFields[r.field_id] = null;
      } else {
        const val = resolvedValues[r.field_id];
        payloadFields[r.field_id] = val !== undefined && val.trim() !== '' ? val : null;
      }
    });

    onExport(payloadFields, dynamicTables, clearHighlight, selectedDeedModel, localQaAnswers, customDocName, natureOfLoan);
  };

  // Filtering
  const filteredResults = results.filter((r) => {
    if (filter === 'verified' && r.status !== 'extracted') return false;
    if (filter === 'conflicts' && r.status !== 'conflict') return false;
    if (filter === 'not_found' && r.status !== 'not_found') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const origField = fieldMap.get(r.field_id);
      const matchContext = origField?.paragraph_context.toLowerCase().includes(q);
      const matchOrig = r.original_text.toLowerCase().includes(q);
      const matchVal = (resolvedValues[r.field_id] || '').toLowerCase().includes(q);
      const matchSource = r.source_document?.toLowerCase().includes(q);
      return matchContext || matchOrig || matchVal || matchSource;
    }

    return true;
  });

  const filteredQaList = useMemo(() => {
    return localQaAnswers.filter((a) => {
      if (qaFilter === 'complied' && a.compliance_status !== 'Complied') return false;
      if (qaFilter === 'conflicts' && !(a.compliance_status === 'Observation' || a.status === 'conflict_detected' || Boolean(a.conflict))) return false;
      if (qaFilter === 'missing' && a.status !== 'not_found') return false;

      if (qaSearchQuery.trim()) {
        const q = qaSearchQuery.toLowerCase();
        const matchQ = (a.question_text || '').toLowerCase().includes(q);
        const matchA = (a.answer || '').toLowerCase().includes(q);
        const matchS = (a.section || '').toLowerCase().includes(q);
        return matchQ || matchA || matchS;
      }
      return true;
    });
  }, [localQaAnswers, qaFilter, qaSearchQuery]);

  const activeDeedModel = deedModels.find((m) => m.id === selectedDeedModel) || deedModels[0];

  return (
    <div className="rounded-2xl p-6 bg-[#0b0f19] border border-slate-800 shadow-xl space-y-6">
      {/* Document Summary & Stats Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs">
              04
            </span>
            <h2 className="text-sm font-bold text-white tracking-tight">Review & Audit Document</h2>
            {/* Prominent Editable Document Name */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm">
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[11px] text-slate-400 font-medium shrink-0">Doc Name:</span>
              {isEditingDocName ? (
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editDocNameInput}
                    onChange={(e) => setEditDocNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveDocName(editDocNameInput);
                      if (e.key === 'Escape') setIsEditingDocName(false);
                    }}
                    className="bg-slate-950 border border-amber-400 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-56 font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveDocName(editDocNameInput)}
                    className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer rounded hover:bg-slate-800"
                    title="Save Name"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDocName(false)}
                    className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer rounded hover:bg-slate-800"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditDocNameInput(customDocName);
                    setIsEditingDocName(true);
                  }}
                  className="group inline-flex items-center gap-2 hover:bg-slate-800 px-2 py-0.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
                  title="Click to rename final document filename"
                >
                  <span className="truncate max-w-[240px] font-mono">{customDocName}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 group-hover:text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded font-sans">
                    <Edit3 className="w-2.5 h-2.5" /> Rename
                  </span>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Resolve conflicts, verify source citations, and finalize answers before document export.
          </p>
          {templateSavedMsg && (
            <div className="mt-2 text-xs text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{templateSavedMsg}</span>
            </div>
          )}
        </div>

        {/* Stats Pills & Reset Button */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <span className="font-semibold text-white">{results.length}</span> Total Fields
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-semibold">{verifiedCount}</span> Verified
          </div>
          {conflictCount > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5 text-amber-300 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">{conflictCount}</span> Conflicts
            </div>
          )}
          {notFoundCount > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-1.5 text-rose-300 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold">{notFoundCount}</span> Missing
            </div>
          )}
          <button
            type="button"
            onClick={handleOpenSaveTemplateModal}
            disabled={isSavingTemplate}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/40 text-xs text-slate-300 hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Save this document structure to your reusable Template Library"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSavingTemplate ? 'Saving...' : 'Save as Template'}</span>
          </button>
          {onStartNewScrutiny && (
            <button
              type="button"
              onClick={onStartNewScrutiny}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition-colors ml-1 cursor-pointer"
              title="Start a new opinion session"
            >
              + New Opinion
            </button>
          )}
        </div>
      </div>

      {/* Unified Tab Switcher if both fields & scrutiny questions exist */}
      {(results.length > 0 && localQaAnswers.length > 0) && (
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <button
            type="button"
            onClick={() => setActiveReviewTab('fields')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeReviewTab === 'fields'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/10'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900 border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Fields & Narrative</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeReviewTab === 'fields' ? 'bg-slate-950/20 text-slate-900 font-extrabold' : 'bg-slate-800 text-slate-300'}`}>
              {results.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReviewTab('qa')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeReviewTab === 'qa'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/10'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900 border border-slate-800'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Questions & Checklist</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeReviewTab === 'qa' ? 'bg-slate-950/20 text-slate-900 font-extrabold' : 'bg-slate-800 text-slate-300'}`}>
              {localQaAnswers.length}
            </span>
          </button>
        </div>
      )}

      {activeReviewTab === 'fields' ? (
        <>
      {/* Deed Model Selection & Recital Formatter Bar */}
      <div className="rounded-xl bg-[#070a13] border border-slate-800 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-semibold text-white">Deed Phrasing Model:</h3>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20">
                  {activeDeedModel ? activeDeedModel.name : selectedDeedModel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Select from 32 standard bank title phrasing models to format the first paragraph recital.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <select
              value={selectedDeedModel}
              onChange={(e) => handleDeedModelChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 font-medium max-w-[260px]"
            >
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

            <button
              type="button"
              onClick={() => handleApplyDeedModel(selectedDeedModel)}
              disabled={isApplyingDeedModel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer"
              title="Apply phrasing of the selected deed model to the Trace of Title recital"
            >
              {isApplyingDeedModel ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Formatting...</span>
                </>
              ) : (
                <span>Apply Phrasing</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSyntaxPreview(!showSyntaxPreview)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Cadence</span>
              {showSyntaxPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Syntax Preview Accordion */}
        {showSyntaxPreview && activeDeedModel && (
          <div className="mt-2 pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
              <div className="text-amber-300 font-medium">Cadence Structure:</div>
              <p className="text-slate-300 leading-relaxed">{activeDeedModel.template_format}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-emerald-400">Library Sample:</span>
              <p className="text-slate-400 italic text-[11px] leading-relaxed">"{activeDeedModel.sample_text}"</p>
            </div>
          </div>
        )}
      </div>

      {/* Resolution Banner */}
      {unresolvedConflictsCount > 0 ? (
        <div className="p-4 rounded-xl bg-[#070a13] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <LegalConflictIllustration size={48} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                <span>Conflict Resolution Required: {unresolvedConflictsCount} field(s) have conflicting source values</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Generation Locked
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select a winning source document or enter a verified value for each conflicting field.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilter('conflicts')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              Review Conflicts ({unresolvedConflictsCount})
            </button>
          </div>
        </div>
      ) : unresolvedMissingCount > 0 ? (
        <div className="p-4 rounded-xl bg-[#070a13] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <span>{unresolvedMissingCount} Template Fields Not Found in Uploaded Document(s)</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Generation Ready
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                These fields were not present in the uploaded source deeds. They will default to blank in the generated Word document unless you enter values manually.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoBlankAllMissing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Acknowledge leaving all missing fields blank"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-Blank All ({unresolvedMissingCount})</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>All fields and conflicts have been resolved. Ready for deterministic document generation.</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1">
          <button
            onClick={() => setFilter('verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              filter === 'verified'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>Extracted Fields</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              filter === 'verified' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {verifiedCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('not_found')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              filter === 'not_found'
                ? 'bg-rose-600 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>Missing from Source</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              filter === 'not_found' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {notFoundCount}
            </span>
          </button>

          {conflictCount > 0 && (
            <button
              onClick={() => setFilter('conflicts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                filter === 'conflicts'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-amber-400 border border-amber-500/30 hover:text-amber-300'
              }`}
            >
              <span>Conflicts</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filter === 'conflicts' ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {conflictCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-800 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>All Fields</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              filter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {results.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search fields or context..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Main Fields Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#070a13]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4 w-10 text-center">#</th>
                <th className="py-3 px-4 min-w-[220px]">Field & Sentence Context</th>
                <th className="py-3 px-4 min-w-[130px]">Template Text</th>
                <th className="py-3 px-4 min-w-[280px]">Extracted Value / Conflict Picker</th>
                <th className="py-3 px-4 min-w-[140px]">Source Document</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    No fields match the current filter.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r, idx) => {
                  const origField = fieldMap.get(r.field_id);
                  const currentVal = resolvedValues[r.field_id] ?? '';
                  const isConflict = r.status === 'conflict';
                  const isNotFound = r.status === 'not_found';
                  const isLeaveBlank = leaveBlankSet.has(r.field_id);
                  const isResolved = fieldResolutionStatus[r.field_id] === 'resolved';

                  const lowerOrig = (r.original_text || '').toLowerCase();
                  const lowerFieldId = (r.field_id || '').toLowerCase();
                  const isTraceRecital =
                    lowerFieldId.includes('trace') ||
                    lowerFieldId.includes('recital') ||
                    lowerOrig.includes('trace of title') ||
                    lowerOrig.includes('flow of title') ||
                    lowerOrig.includes('root deed') ||
                    (lowerOrig.includes('originally belonged to') && !lowerOrig.includes('sub:'));

                  const isLongParagraph =
                    currentVal.length > 70 ||
                    r.original_text.length > 60 ||
                    isTraceRecital;

                  return (
                    <tr
                      key={r.field_id}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isConflict
                          ? 'bg-amber-950/10'
                          : isNotFound
                          ? 'bg-rose-950/5'
                          : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Context */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          {origField?.is_question ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-950/60 text-sky-300 border border-sky-800 flex items-center gap-1 font-semibold" title="Protected table question — preserved verbatim, will not be overwritten by answers">
                              <FileQuestion className="w-2.5 h-2.5" />
                              {origField.column_header ? `${origField.column_header} (Question)` : 'Table Question'}
                            </span>
                          ) : origField?.is_table_cell ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                              <TableIcon className="w-2.5 h-2.5" />
                              {origField.column_header || 'Table Cell'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                              Paragraph
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 leading-relaxed font-normal">
                          {origField ? (
                            <span>
                              {origField.context_with_marker.split('[FIELD:').map((part, pIdx) => {
                                if (pIdx === 0) return part;
                                const [fieldTxt, rest] = part.split(']');
                                return (
                                  <React.Fragment key={pIdx}>
                                    <span className="font-medium text-amber-300 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                                      {fieldTxt}
                                    </span>
                                    {rest}
                                  </React.Fragment>
                                );
                              })}
                            </span>
                          ) : (
                            r.field_id
                          )}
                        </p>
                        {r.reasoning && (
                          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 italic">
                            <Info className="w-3 h-3 text-slate-500 shrink-0" />
                            {r.reasoning}
                          </p>
                        )}
                      </td>

                      {/* Original Template Text */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono text-[11px] font-medium inline-block max-w-[140px] truncate">
                          {r.original_text}
                        </span>
                      </td>

                      {/* Extracted Value / Conflict Picker / Manual Override */}
                      <td className="py-3 px-4">
                        {isConflict ? (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Select source value to apply:
                            </p>
                            <div className="space-y-1.5">
                              {(r.conflicts || []).map((c, cIdx) => {
                                const isSelected = currentVal === c.value;
                                return (
                                  <button
                                    key={cIdx}
                                    type="button"
                                    onClick={() => handlePickConflictOption(r.field_id, c.value)}
                                    className={`w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <span className="font-semibold block truncate">"{c.value}"</span>
                                      <span className="text-[10px] text-slate-500 truncate block">from {c.source_document}</span>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-2" />}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="text"
                                placeholder="Or type custom override value..."
                                value={currentVal}
                                onChange={(e) => handleValueChange(r.field_id, e.target.value)}
                                className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        ) : isNotFound ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              disabled={isLeaveBlank}
                              placeholder={isLeaveBlank ? 'Will remain original / blank' : 'Type manual replacement value...'}
                              value={currentVal}
                              onChange={(e) => handleValueChange(r.field_id, e.target.value)}
                              className={`w-full px-3 py-1.5 rounded-lg border text-xs font-medium focus:outline-none transition-all ${
                                isLeaveBlank
                                  ? 'bg-slate-900/50 border-slate-800 text-slate-500 italic'
                                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200 placeholder-rose-400/50 focus:border-rose-400'
                              }`}
                            />
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isLeaveBlank}
                                onChange={() => handleToggleLeaveBlank(r.field_id)}
                                className="w-3 h-3 rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900"
                              />
                              <span className="text-[11px] text-slate-400 font-medium">
                                Confirm: Leave blank / keep original text
                              </span>
                            </label>
                          </div>
                        ) : isLongParagraph ? (
                          <div className="space-y-1.5">
                            <textarea
                              rows={4}
                              value={currentVal}
                              onChange={(e) => handleValueChange(r.field_id, e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 font-sans focus:outline-none focus:border-amber-400 transition-colors leading-relaxed"
                            />
                            {isTraceRecital && (
                              <div className="flex items-center justify-between gap-2 pt-0.5">
                                <span className="text-[10px] text-amber-400 font-medium">Deed Recital Model:</span>
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={selectedDeedModel}
                                    onChange={(e) => handleDeedModelChange(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded px-2 py-0.5 focus:outline-none focus:border-amber-400 max-w-[200px]"
                                  >
                                    {deedModels.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </select>
                                  {r.value && r.value !== currentVal && (
                                    <button
                                      onClick={() => handleResetToAI(r.field_id)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                      title="Reset to AI value"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative flex items-center gap-1.5">
                            <input
                              type="text"
                              value={currentVal}
                              onChange={(e) => handleValueChange(r.field_id, e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs font-medium focus:outline-none focus:border-amber-400"
                            />
                            {r.value !== currentVal && (
                              <button
                                onClick={() => handleResetToAI(r.field_id)}
                                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                title="Reset to AI value"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Source Document with Page Citation & View Source Modal Trigger */}
                      <td className="py-3 px-4">
                        {r.source_document ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 inline-block max-w-[130px] truncate"
                                title={r.source_document}
                              >
                                {r.source_document}
                              </span>
                              {r.source_page && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                  P.{r.source_page}
                                </span>
                              )}
                            </div>
                            {(r.is_translated || r.source_language === 'tamil' || (r.source_snippet && /[\u0B80-\u0BFF]/.test(r.source_snippet))) && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1 w-fit">
                                தமிழ் Translated
                              </span>
                            )}
                            {onViewSource && (
                              <button
                                type="button"
                                onClick={() =>
                                  onViewSource(
                                    r.source_document!,
                                    r.source_page || 1,
                                    r.source_snippet || r.value || '',
                                    origField?.original_text,
                                    r.value || currentVal
                                  )
                                }
                                className="flex items-center gap-1 text-[10px] font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View Source</span>
                              </button>
                            )}
                          </div>
                        ) : isConflict ? (
                          <div className="space-y-1">
                            <span className="text-amber-400 text-[11px] font-medium block">Multiple Sources</span>
                            {onViewSource && r.conflicts && r.conflicts.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const c = r.conflicts![0];
                                  onViewSource(
                                    c.source_document,
                                    c.source_page || 1,
                                    c.source_snippet || c.value,
                                    origField?.original_text,
                                    c.value
                                  );
                                }}
                                className="flex items-center gap-1 text-[10px] font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect Conflict</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isConflict ? (
                          isResolved ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ✓ Resolved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              ⚠ Conflict
                            </span>
                          )
                        ) : isNotFound ? (
                          isResolved ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ✓ Resolved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              ⚠ Not Found
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✓ Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Variable-Length Tables Section */}
      {tableGroups.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-slate-400" />
                <span>Dynamic Table Rows</span>
              </h3>
              <p className="text-xs text-slate-400">
                Populated from deeds into {Object.values(dynamicTables).flat().length} records. Add, edit, or remove rows below.
              </p>
            </div>
          </div>

          {tableGroups.map((tg) => {
            const rows = dynamicTables[tg.group_id] || [];
            const colHeaders = tg.columns.map((c) => c.header);

            return (
              <div key={tg.group_id} className="rounded-xl border border-slate-800 bg-[#070a13] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {tg.group_id}
                    </span>
                    <span className="text-xs font-medium text-slate-200">
                      Table {tg.table_index + 1} • {rows.length} {rows.length === 1 ? 'Row' : 'Rows'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTableRow(tg.group_id, colHeaders)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Row</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
                        <th className="py-2 px-3 w-8 text-center">#</th>
                        {colHeaders.map((hdr, hIdx) => (
                          <th key={hIdx} className="py-2 px-3">{hdr}</th>
                        ))}
                        <th className="py-2 px-3 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {rows.map((rowRec, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 text-center font-mono text-slate-500">{rIdx + 1}</td>
                          {colHeaders.map((hdr, hIdx) => (
                            <td key={hIdx} className="py-2 px-3">
                              <input
                                type="text"
                                value={rowRec[hdr] || ''}
                                onChange={(e) => handleTableCellChange(tg.group_id, rIdx, hdr, e.target.value)}
                                className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                              />
                            </td>
                          ))}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteTableRow(tg.group_id, rIdx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

        </>
      ) : (
        /* ========================================================
            UNIFIED SCRUTINY Q&A & CHECKLIST VIEW
           ======================================================== */
        <div className="space-y-4">
          {/* Q&A Filter & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#070a13] border border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQaFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  qaFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({localQaAnswers.length})
              </button>
              <button
                type="button"
                onClick={() => setQaFilter('complied')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  qaFilter === 'complied'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-emerald-400/80 hover:text-emerald-300'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Complied ({localQaAnswers.filter((a) => a.compliance_status === 'Complied').length})
              </button>
              <button
                type="button"
                onClick={() => setQaFilter('conflicts')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  qaFilter === 'conflicts'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Observations ({localQaAnswers.filter((a) => a.compliance_status === 'Observation' || a.status === 'conflict_detected' || Boolean(a.conflict)).length})
              </button>
              <button
                type="button"
                onClick={() => setQaFilter('missing')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  qaFilter === 'missing'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-rose-400/80 hover:text-rose-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Missing ({localQaAnswers.filter((a) => a.status === 'not_found').length})
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search scrutiny questions..."
                  value={qaSearchQuery}
                  onChange={(e) => setQaSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400/80 w-56"
                />
              </div>
              <button
                type="button"
                onClick={handleApproveAllQa}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Mark all answers as Complied"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Approve All Answers</span>
              </button>
            </div>
          </div>

          {/* Q&A Cards List */}
          {filteredQaList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-[#070a13] border border-slate-800 rounded-xl">
              No scrutiny questions match the current filter or search query.
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredQaList.map((item, idx) => (
                <div
                  key={item.question_id || idx}
                  className="rounded-xl bg-[#070a13] border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition-colors shadow-sm"
                >
                  {/* Question Meta */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.section || 'General Scrutiny'}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {item.question_text}
                      </span>
                    </div>
                    {/* Compliance Selector Pill */}
                    <select
                      value={item.compliance_status || 'Complied'}
                      onChange={(e) => handleUpdateQaCompliance(item.question_id, e.target.value)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                        item.compliance_status === 'Complied'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : item.compliance_status === 'Observation' || item.status === 'conflict_detected' || Boolean(item.conflict)
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : item.status === 'not_found'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      <option value="Complied">✓ Complied</option>
                      <option value="Observation">⚠️ Observation</option>
                      <option value="Not Applicable">Not Applicable</option>
                      <option value="Pending">Pending Verification</option>
                    </select>
                  </div>

                  {/* Answer Textarea */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">Grounded Finding / Answer:</label>
                    <textarea
                      value={item.answer}
                      onChange={(e) => handleUpdateQaAnswer(item.question_id, e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-amber-400/80 leading-relaxed font-sans"
                      placeholder="Enter legal scrutiny finding or answer..."
                    />
                  </div>

                  {/* Evidence Citations */}
                  {item.evidence && item.evidence.length > 0 && (
                    <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 p-2.5 text-xs space-y-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-sky-400" />
                        Supporting Deed Evidence Citations:
                      </span>
                      <div className="space-y-1.5">
                        {item.evidence.map((ev, evIdx) => (
                          <div key={evIdx} className="flex items-start justify-between gap-3 text-[11px] text-slate-300">
                            <p className="italic text-slate-400 font-mono text-[10.5px] leading-relaxed">
                              "{ev.snippet}"
                            </p>
                            <button
                              type="button"
                              onClick={() => onViewSource && onViewSource(ev.document_name, ev.page_number, ev.snippet, item.question_text, item.answer)}
                              className="shrink-0 flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                              title="Inspect original source document"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{ev.document_name} (p.{ev.page_number})</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export & Download Control Card */}
      <div className="p-5 rounded-2xl bg-[#070a13] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Generate Deterministic Document</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Only highlighted runs and dynamic table rows are populated. All styles, fonts, and tables are preserved.
            </p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={clearHighlight}
                onChange={(e) => setClearHighlight(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900"
              />
              <span className="text-xs text-slate-300 font-medium">
                Remove yellow highlighting from final output
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {downloadUrl ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ready to Download Document Name Pill with Rename */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-medium shrink-0">Ready:</span>
                {isEditingBottomDocName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editBottomDocNameInput}
                      onChange={(e) => setEditBottomDocNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDocName(editBottomDocNameInput);
                        if (e.key === 'Escape') setIsEditingBottomDocName(false);
                      }}
                      className="bg-slate-950 border border-amber-400 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-44 font-mono"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveDocName(editBottomDocNameInput)}
                      className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBottomDocName(false)}
                      className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white max-w-[180px] truncate font-mono" title={customDocName}>
                      {customDocName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditBottomDocNameInput(customDocName);
                        setIsEditingBottomDocName(true);
                      }}
                      className="text-slate-400 hover:text-amber-400 p-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Rename document filename"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Nature of Loan Pill */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <span className="text-[11px] text-slate-400 font-medium shrink-0">Nature of Loan:</span>
                <select
                  value={natureOfLoan}
                  onChange={(e) => setNatureOfLoan(e.target.value)}
                  className="bg-transparent border-none text-slate-200 text-xs font-medium focus:outline-none cursor-pointer max-w-[190px]"
                >
                  {LOAN_NATURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <a
                href={`${downloadUrl}?format=docx`}
                download
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer"
                title="Download formatted Microsoft Word document (.docx)"
              >
                <Download className="w-4 h-4" />
                <span>Download Word (.docx)</span>
              </a>

              <a
                href={`${downloadUrl}?format=pdf`}
                download
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                title="Download printable Adobe PDF document (.pdf)"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF (.pdf)</span>
              </a>

              <button
                type="button"
                onClick={handleExportClick}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all cursor-pointer"
                title="Re-generate document with latest edits"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Re-Generate</span>
              </button>

              {onStartNewScrutiny && (
                <button
                  type="button"
                  onClick={onStartNewScrutiny}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
                  title="Finish and start a new document session"
                >
                  <span>+ Start New Opinion</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              {/* Output File Pill with Pre-Generation Rename */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-medium shrink-0">Output File:</span>
                {isEditingBottomDocName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editBottomDocNameInput}
                      onChange={(e) => setEditBottomDocNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDocName(editBottomDocNameInput);
                        if (e.key === 'Escape') setIsEditingBottomDocName(false);
                      }}
                      className="bg-slate-950 border border-amber-400 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-44 font-mono"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveDocName(editBottomDocNameInput)}
                      className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBottomDocName(false)}
                      className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-200 max-w-[170px] truncate font-mono" title={customDocName}>
                      {customDocName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditBottomDocNameInput(customDocName);
                        setIsEditingBottomDocName(true);
                      }}
                      className="text-slate-400 hover:text-amber-400 p-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Click to rename output filename before generating"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Nature of Loan Pill Before Generating */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <span className="text-[11px] text-slate-400 font-medium shrink-0">Nature of Loan:</span>
                <select
                  value={natureOfLoan}
                  onChange={(e) => setNatureOfLoan(e.target.value)}
                  className="bg-transparent border-none text-slate-200 text-xs font-medium focus:outline-none cursor-pointer max-w-[210px]"
                >
                  {LOAN_NATURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <span className="text-[11px] text-slate-400 font-medium shrink-0">Deed Format:</span>
                <select
                  value={selectedDeedModel}
                  onChange={(e) => handleDeedModelChange(e.target.value)}
                  className="bg-transparent border-none text-slate-200 text-xs font-medium focus:outline-none cursor-pointer max-w-[210px]"
                >
                  <optgroup label="Trace of Title Models">
                    {deedModels
                      .filter((m) => m.category === 'trace_of_title' || m.is_root_deed_candidate)
                      .map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                          {m.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Revenue & Other Models">
                    {deedModels
                      .filter((m) => m.category !== 'trace_of_title' && !m.is_root_deed_candidate)
                      .map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                          {m.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
                <button
                  onClick={handleExportClick}
                  disabled={unresolvedConflictsCount > 0 || isExporting}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    unresolvedConflictsCount > 0
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : isExporting
                      ? 'bg-slate-800 text-white cursor-wait opacity-80 border border-slate-700'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer shadow-lg shadow-amber-400/10'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating .docx...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Generate Final .docx</span>
                    </>
                  )}
                </button>
                {unresolvedConflictsCount > 0 && (
                  <span className="text-[10px] text-amber-400 font-medium">
                    ⚠️ {unresolvedConflictsCount} conflict(s) remaining
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save as Reusable Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <BookmarkPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Save as Reusable Template</h3>
                  <p className="text-[11px] text-slate-400">Store template structure in library for future scrutinies</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Template Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={templateSaveName}
                  onChange={(e) => setTemplateSaveName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
                  placeholder="e.g. Canara Bank Legal Opinion Template.docx"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Auto-named based on bank & document type. You can rename it anytime.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Bank / Category Folder
                </label>
                <input
                  type="text"
                  value={templateSaveBank}
                  onChange={(e) => setTemplateSaveBank(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
                  placeholder="e.g. Default, Canara Bank, or HDFC Bank"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveTemplate}
                disabled={isSavingTemplate || !templateSaveName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/10 cursor-pointer disabled:opacity-50"
              >
                {isSavingTemplate ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving to Library...</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Save to Template Library</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
