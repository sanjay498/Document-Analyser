import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  BookOpen,
  Download,
  Edit3,
  Check,
  Upload,
  RefreshCw,
  Eye,
  Sparkles,
  ShieldCheck,
  FileText,
  Scale,
  Search,
  CheckCheck,
  Languages,
  ArrowRight,
  X
} from 'lucide-react';
import type {
  TemplateQuestion,
  QuestionAnswer,
  SourceDocSummary,
  Client
} from '../types';
import {
  createQASession,
  uploadQATemplate,
  uploadQASources,
  runIntelligentQA,
  updateQAAnswer,
  approveAllQAAnswers,
  generateQAReport,
  downloadQAReport,
  renameQADocument,
  useQADocAsNextTemplate
} from '../services/api';

interface TemplateQAViewProps {
  activeClient?: Client | null;
  onNavigateToWorkspace?: () => void;
}

export const TemplateQAView: React.FC<TemplateQAViewProps> = ({
  activeClient,
  onNavigateToWorkspace: _onNavigateToWorkspace,
}) => {
  // Session & Workflow State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [templateFilename, setTemplateFilename] = useState<string | null>(null);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [sourceSummaries, setSourceSummaries] = useState<SourceDocSummary[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<
    'intake' | 'uploading' | 'analyzing' | 'review' | 'generating' | 'error'
  >('intake');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Review & Inspection State
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline Edit State
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editCompliance, setEditCompliance] = useState<string>('Complied');
  const [editNotes, setEditNotes] = useState<string>('');

  // Document Renaming State
  const [isRenamingDoc, setIsRenamingDoc] = useState<boolean>(false);
  const [docNewName, setDocNewName] = useState<string>('');

  // Auto-clear notification messages
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  // Initial Session Initialization
  const handleStartSession = async () => {
    try {
      setErrorMessage(null);
      const res = await createQASession(activeClient?.id);
      setSessionId(res.session_id);
      return res.session_id;
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start QA session');
      return null;
    }
  };

  // Upload Template
  const handleTemplateSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setTemplateFilename(file.name);

    try {
      setErrorMessage(null);
      let sid = sessionId;
      if (!sid) {
        sid = await handleStartSession();
        if (!sid) return;
      }

      setWorkflowStatus('uploading');
      const res = await uploadQATemplate(sid, file);
      setQuestions(res.questions);
      setWorkflowStatus('intake');
      setSuccessMessage(`Parsed template successfully! Identified ${res.questions_count} questions across ${res.sections.length} sections.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload template');
      setWorkflowStatus('intake');
    }
  };

  // Upload Source Documents
  const handleSourcesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setSourceFiles((prev) => [...prev, ...files]);

    try {
      setErrorMessage(null);
      let sid = sessionId;
      if (!sid) {
        sid = await handleStartSession();
        if (!sid) return;
      }

      setWorkflowStatus('uploading');
      const res = await uploadQASources(sid, files);
      setSourceSummaries(res.documents);
      setWorkflowStatus('intake');
      setSuccessMessage(`Uploaded and processed ${res.documents_count} source documents with OCR and Tamil support.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload sources');
      setWorkflowStatus('intake');
    }
  };

  // Run Dynamic QA
  const handleRunQA = async () => {
    if (!sessionId) {
      setErrorMessage('Please start a session and upload files first.');
      return;
    }
    if (questions.length === 0) {
      setErrorMessage('Please upload a template document containing questions or checklist rows.');
      return;
    }
    if (sourceFiles.length === 0 && sourceSummaries.length === 0) {
      setErrorMessage('Please upload at least one legal source document (Deed, EC, Patta, etc.).');
      return;
    }

    try {
      setErrorMessage(null);
      setWorkflowStatus('analyzing');
      const res = await runIntelligentQA(sessionId);
      setAnswers(res.answers);
      setWorkflowStatus('review');
      if (res.answers.length > 0) {
        setSelectedQuestionId(res.answers[0].question_id);
      }
      setSuccessMessage(
        `Dynamic Legal QA completed! Verified ${res.supported_count} answers, flagged ${res.conflicts_count} conflicts, and safely returned ${res.not_found_count} not found.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'QA Analysis failed');
      setWorkflowStatus('intake');
    }
  };

  // Inline Edit Trigger
  const handleStartEdit = (ans: QuestionAnswer) => {
    setEditingQuestionId(ans.question_id);
    setEditText(ans.answer);
    setEditCompliance(ans.compliance_status || 'Complied');
    setEditNotes(ans.user_notes || '');
  };

  // Save Inline Edit & Mark Human Verified
  const handleSaveEdit = async (questionId: string) => {
    if (!sessionId) return;
    try {
      const updated = await updateQAAnswer(sessionId, questionId, {
        answer: editText,
        compliance_status: editCompliance,
        status: 'user_edited',
        verification_badge: 'Human Verified',
        user_notes: editNotes,
      });

      setAnswers((prev) =>
        prev.map((a) => (a.question_id === questionId ? updated : a))
      );
      setEditingQuestionId(null);
      setSuccessMessage('Answer saved and marked as Human Verified!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update answer');
    }
  };

  // Quick Verify Answer
  const handleQuickVerify = async (questionId: string) => {
    if (!sessionId) return;
    const target = answers.find((a) => a.question_id === questionId);
    if (!target) return;

    try {
      const updated = await updateQAAnswer(sessionId, questionId, {
        answer: target.answer,
        compliance_status: target.compliance_status,
        status: 'user_approved',
        verification_badge: 'Human Verified',
      });

      setAnswers((prev) =>
        prev.map((a) => (a.question_id === questionId ? updated : a))
      );
      setSuccessMessage('Marked answer as Human Verified!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to verify answer');
    }
  };

  // Bulk Approve Supported Answers
  const handleApproveAll = async () => {
    if (!sessionId) return;
    try {
      const updatedList = await approveAllQAAnswers(sessionId);
      setAnswers(updatedList);
      setSuccessMessage('All supported, non-conflict answers have been bulk-verified!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to bulk-approve');
    }
  };

  // Rename Document
  const handleStartRename = () => {
    setDocNewName(templateFilename || 'untitled_template.docx');
    setIsRenamingDoc(true);
  };

  const handleSaveRename = async () => {
    if (!sessionId || !docNewName.trim()) {
      setIsRenamingDoc(false);
      return;
    }
    try {
      const res = await renameQADocument(sessionId, docNewName.trim());
      setTemplateFilename(res.template_filename);
      setIsRenamingDoc(false);
      setSuccessMessage(`Document renamed to "${res.template_filename}"`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to rename document');
    }
  };

  // Chain Generated Doc as Next Template
  const handleUseAsNextTemplate = async (keepSources: boolean = true) => {
    if (!sessionId) return;
    try {
      setWorkflowStatus('uploading');
      const res = await useQADocAsNextTemplate(sessionId, {
        keep_sources: keepSources,
      });
      setSessionId(res.session_id);
      setQuestions(res.questions);
      setTemplateFilename(`Next_Template_${templateFilename || 'Report'}.docx`);
      setAnswers([]);
      setSelectedQuestionId(null);
      setWorkflowStatus('intake');
      setSuccessMessage(
        `Successfully loaded generated document as the active template! Extracted ${res.questions_count} questions for your next scrutiny round.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to use document as next template');
      setWorkflowStatus('review');
    }
  };

  // Generate & Download Completed Report
  const handleGenerateReport = async () => {
    if (!sessionId) return;
    try {
      setWorkflowStatus('generating');
      await generateQAReport(sessionId);
      const downloadFilename = templateFilename
        ? (templateFilename.toLowerCase().endsWith('.docx') ? templateFilename : `${templateFilename}.docx`)
        : 'Scrutiny_Report.docx';
      await downloadQAReport(sessionId, downloadFilename);
      setWorkflowStatus('review');
      setSuccessMessage(`Report generated and downloaded as "${downloadFilename}"!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate report');
      setWorkflowStatus('review');
    }
  };

  // Load Sample Demo
  const handleLoadSample = async () => {
    try {
      setErrorMessage(null);
      setWorkflowStatus('uploading');
      const sid = await handleStartSession();
      if (!sid) return;

      // Sample template content (mock text representation)
      const sampleTemplateText = `LEGAL TITLE SCRUTINY REPORT & OPINION\n\n1. PARTICULARS OF PROPERTY\nName of Borrower: ________________________\nSurvey Number of Property: ________________________\nTotal Extent of Property: ________________________\nBoundaries of Subject Property: ________________________\n\n2. SCRUTINY CHECKLIST & ENQUIRY\n1. Whether chain of title for 30 years is complete without missing links?\n2. Whether there are any prior subsisting encumbrances or mortgages?\n3. Whether revenue records (Patta, Chitta, Adangal) are produced to prove possession?\n4. Whether sanctioned building plan for a 10-story commercial tower was approved by CMDA?\n5. Whether proceedings under SARFAESI Act are enforceable against the agricultural land?`;
      const templateBlob = new Blob([sampleTemplateText], { type: 'text/plain' });
      const sampleTFile = new File([templateBlob], 'Title_Scrutiny_Template.txt', { type: 'text/plain' });
      setTemplateFilename('Title_Scrutiny_Template.txt');

      const resT = await uploadQATemplate(sid, sampleTFile);
      setQuestions(resT.questions);

      // Sample source deeds content
      const sampleDeedText = `Sale Deed Doc No. 1277/1987 executed on 05.05.1987 by Murugesan in favour of Gopalan. Conveying agricultural land in S.F.No. 245/1B measuring an extent of 0.16 Acres situated at Mannur Village, Pollachi. Boundaries: North by Ammasai Gounder land, South by Road, East by Cart Track, West by Channel. Will Doc No. 387/BK3/2023 executed by Gopalan in favour of Muthulakshmi. Death certificate of Gopalan dated 06.05.2025. Encumbrance Certificate ECA/Online/No.195476108/2026 for period from 01.01.1987 to 25.06.2026. Entry 1: 16.11.1987 Sale deed Doc No. 2860/1987. Entry 2: 11.07.2001 Mortgage deed Doc No. 2001/2001 in favour of Primary Co-op Society. Entry 3: 11.01.2007 Discharge receipt Doc No. 2007/2007 executed by Primary Co-op Society. No other subsisting encumbrances.`;
      const deedBlob = new Blob([sampleDeedText], { type: 'text/plain' });
      const deedFile = new File([deedBlob], 'Parent_Deeds_and_EC.txt', { type: 'text/plain' });

      const tamilRevText = `தமிழ்நாடு அரசு வருவாய்த்துறை. Computerized Chitta, Adangal, and Possession Certificate for S.F.No. 245/1B in Mannur Village standing in the name of Muthulakshmi.`;
      const tamilBlob = new Blob([tamilRevText], { type: 'text/plain' });
      const tamilFile = new File([tamilBlob], 'Revenue_Records_Mannur.txt', { type: 'text/plain' });

      setSourceFiles([deedFile, tamilFile]);
      const resS = await uploadQASources(sid, [deedFile, tamilFile]);
      setSourceSummaries(resS.documents);

      // Trigger QA automatically
      setWorkflowStatus('analyzing');
      const resQA = await runIntelligentQA(sid);
      setAnswers(resQA.answers);
      setWorkflowStatus('review');
      if (resQA.answers.length > 0) {
        setSelectedQuestionId(resQA.answers[0].question_id);
      }
      setSuccessMessage('Loaded real-world Title Scrutiny sample & executed grounded QA successfully!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Sample load failed');
      setWorkflowStatus('intake');
    }
  };

  // Reset Session
  const handleResetSession = () => {
    setSessionId(null);
    setTemplateFilename(null);
    setSourceFiles([]);
    setQuestions([]);
    setAnswers([]);
    setSourceSummaries([]);
    setSelectedQuestionId(null);
    setWorkflowStatus('intake');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Active Selected Question and Answer for Right Inspector Panel
  const activeAnswer = answers.find((a) => a.question_id === selectedQuestionId) || answers[0];

  // Metrics
  const totalQCount = answers.length;
  const supportedCount = answers.filter((a) => a.status === 'supported' || a.status === 'user_approved').length;
  const reviewCount = answers.filter((a) => a.status === 'needs_review').length;
  const conflictCount = answers.filter((a) => a.status === 'conflict_detected').length;
  const notFoundCount = answers.filter((a) => a.status === 'not_found').length;
  const verifiedCount = answers.filter((a) => a.verification_badge === 'Human Verified').length;

  // Filtered Answers List
  const filteredAnswers = answers.filter((ans) => {
    if (filterStatus === 'supported' && ans.status !== 'supported' && ans.status !== 'user_approved') return false;
    if (filterStatus === 'needs_review' && ans.status !== 'needs_review') return false;
    if (filterStatus === 'conflict_detected' && ans.status !== 'conflict_detected') return false;
    if (filterStatus === 'not_found' && ans.status !== 'not_found') return false;
    if (filterStatus === 'verified' && ans.verification_badge !== 'Human Verified') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ans.question_text.toLowerCase().includes(q) ||
        ans.answer.toLowerCase().includes(q) ||
        ans.section.toLowerCase().includes(q) ||
        ans.question_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Active Client Context Banner */}
      {activeClient && (
        <div className="bg-[#0b0f19] border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
              {activeClient.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{activeClient.name}</span>
                <span className="text-[10px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded border border-slate-700">
                  {activeClient.title}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                <span>Phone: {activeClient.phone}</span>
                {activeClient.email && <span>• Email: {activeClient.email}</span>}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold tracking-wider text-amber-400 uppercase bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
            Active Client Scrutiny
          </span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Scale className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Intelligent Legal Template Question Answering
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Zero Hallucination
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Dynamic title scrutiny QA: grounds template checklist queries in uploaded deeds, EC, and revenue records with verifiable citations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {workflowStatus === 'review' && (
            <>
              <button
                onClick={handleApproveAll}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-600/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors"
                title="Bulk approve all supported answers"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Approve All Supported
              </button>
              <button
                onClick={() => handleUseAsNextTemplate(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 flex items-center gap-1.5 shadow-sm transition-colors"
                title="Use this generated document as the template for your next Q&A scrutiny cycle"
              >
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                Use as Next Template
              </button>
              <button
                onClick={handleGenerateReport}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-sm transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Download Report (.docx)
              </button>
            </>
          )}

          <button
            onClick={handleResetSession}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            New Session
          </button>
        </div>
      </div>

      {/* Active Document Name & Quick Rename Bar */}
      {sessionId && (
        <div className="bg-[#0b0f19] border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <FileText className="w-4 h-4 text-amber-400" />
              Document / Template:
            </span>
            {isRenamingDoc ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={docNewName}
                  onChange={(e) => setDocNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setIsRenamingDoc(false);
                  }}
                  autoFocus
                  placeholder="Document name (e.g. Title_Opinion.docx)"
                  className="bg-slate-900 border border-amber-500/60 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-64"
                />
                <button
                  onClick={handleSaveRename}
                  className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  title="Save name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsRenamingDoc(false)}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                  {templateFilename || 'untitled_template.docx'}
                </span>
                <button
                  onClick={handleStartRename}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 text-[11px]"
                  title="Rename document"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rename</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>Session: <code className="text-slate-300 font-mono">{sessionId.slice(0, 8)}...</code></span>
            {workflowStatus === 'review' && (
              <button
                onClick={() => handleUseAsNextTemplate(true)}
                className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center gap-1.5 transition-colors font-medium"
                title="Use generated report as the template for next Q&A round"
              >
                <ArrowRight className="w-3 h-3 text-indigo-400" />
                Use as Next Template
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* INTAKE MODE: Upload Template & Sources */}
      {/* ------------------------------------------------------------------ */}
      {workflowStatus !== 'review' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Template Upload Card */}
            <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                    <FileQuestion className="w-4 h-4 text-amber-400" />
                    1. Upload Legal Template
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                    DOCX, TXT, PDF
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Upload any title scrutiny checklist, bank legal format, or opinion template.
                  The system dynamically detects questions, sections, and table rows without hardcoding.
                </p>

                <label className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#080c14] group">
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-amber-400 mb-2 transition-colors" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">
                    {templateFilename ? templateFilename : 'Select or drop template file'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">.docx, .txt, .pdf supported</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".docx,.txt,.pdf"
                    onChange={handleTemplateSelected}
                  />
                </label>
              </div>

              {questions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {questions.length} Questions Extracted
                  </span>
                  <span className="text-slate-400">
                    {Array.from(new Set(questions.map((q) => q.section))).length} Sections
                  </span>
                </div>
              )}
            </div>

            {/* Source Documents Upload Card */}
            <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                    <BookOpen className="w-4 h-4 text-sky-400" />
                    2. Upload Source Documents
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                    Multi-file • OCR • Tamil
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Upload all relevant title deeds (Sale, Will, Settlement), Encumbrance Certificates (EC),
                  Patta, Chitta, Adangal, and Possession Certificates.
                </p>

                <label className="border-2 border-dashed border-slate-700 hover:border-sky-500/50 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#080c14] group">
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-sky-400 mb-2 transition-colors" />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">
                    {sourceFiles.length > 0
                      ? `${sourceFiles.length} source file(s) selected`
                      : 'Select or drop multiple legal documents'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    Multi-page PDFs, scans, images, deeds
                  </span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleSourcesSelected}
                  />
                </label>
              </div>

              {sourceSummaries.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 text-sky-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {sourceSummaries.length} Documents Indexed
                    </span>
                    <span className="text-slate-400">
                      {sourceSummaries.reduce((acc, d) => acc + d.page_or_section_count, 0)} Total Pages
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sourceSummaries.map((doc, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1"
                      >
                        {doc.filename}
                        {doc.has_tamil && (
                          <span title="Tamil Detected">
                            <Languages className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                        {doc.is_scanned_ocr && (
                          <span title="Scanned OCR">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleLoadSample}
                disabled={workflowStatus === 'analyzing' || workflowStatus === 'uploading'}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-700 text-slate-200 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Load Sample Scrutiny Template & Deeds (1-Click Demo)
              </button>
            </div>

            <button
              onClick={handleRunQA}
              disabled={
                workflowStatus === 'analyzing' ||
                workflowStatus === 'uploading' ||
                questions.length === 0 ||
                (sourceFiles.length === 0 && sourceSummaries.length === 0)
              }
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {workflowStatus === 'analyzing' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing Multi-Document Evidence...
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4" />
                  Analyze Documents & Answer Questions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* REVIEW MODE: Side-by-Side Question Answering & Evidence Inspector */}
      {/* ------------------------------------------------------------------ */}
      {workflowStatus === 'review' && (
        <div className="space-y-4">
          {/* Metrics & Filter Bar */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Stat Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-md font-medium border transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                All ({totalQCount})
              </button>
              <button
                onClick={() => setFilterStatus('supported')}
                className={`px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-colors ${
                  filterStatus === 'supported'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-emerald-500/5 text-emerald-400/80 border-emerald-500/20 hover:text-emerald-300'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Supported ({supportedCount})
              </button>
              <button
                onClick={() => setFilterStatus('conflict_detected')}
                className={`px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-colors ${
                  filterStatus === 'conflict_detected'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-rose-500/5 text-rose-400/80 border-rose-500/20 hover:text-rose-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Conflicts ({conflictCount})
              </button>
              <button
                onClick={() => setFilterStatus('needs_review')}
                className={`px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-colors ${
                  filterStatus === 'needs_review'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-amber-500/5 text-amber-400/80 border-amber-500/20 hover:text-amber-300'
                }`}
              >
                <AlertCircle className="w-3 h-3 text-amber-400" />
                Needs Review ({reviewCount})
              </button>
              <button
                onClick={() => setFilterStatus('not_found')}
                className={`px-2.5 py-1 rounded-md font-medium border transition-colors ${
                  filterStatus === 'not_found'
                    ? 'bg-slate-800 text-slate-300 border-slate-600'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Not Found ({notFoundCount})
              </button>
              <button
                onClick={() => setFilterStatus('verified')}
                className={`px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-colors ${
                  filterStatus === 'verified'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    : 'bg-teal-500/5 text-teal-400/80 border-teal-500/20 hover:text-teal-300'
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-teal-400" />
                Human Verified ({verifiedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search questions or answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* 2-Column Split: Left = Questions List, Right = Evidence Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Questions & Answers (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {filteredAnswers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-[#0b0f19] border border-slate-800 rounded-xl">
                  No questions match the selected filter.
                </div>
              ) : (
                filteredAnswers.map((ans) => {
                  const isSelected = ans.question_id === selectedQuestionId;
                  const isEditing = ans.question_id === editingQuestionId;
                  const isVerified = ans.verification_badge === 'Human Verified';
                  const isConflict = ans.status === 'conflict_detected';
                  const isNotFound = ans.status === 'not_found';

                  return (
                    <div
                      key={ans.question_id}
                      onClick={() => setSelectedQuestionId(ans.question_id)}
                      className={`bg-[#0b0f19] border rounded-xl p-4 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500/60 shadow-md ring-1 ring-amber-500/20'
                          : isConflict
                          ? 'border-rose-500/40 hover:border-rose-500/70'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Question Header & Category */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/80 px-2 py-0.5 rounded">
                            {ans.section}
                          </span>
                          <span className="text-[10px] font-medium text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                            {ans.question_type.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5">
                          {isVerified ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              Human Verified
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              AI Generated
                            </span>
                          )}

                          {isConflict && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              Conflict
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Question Text */}
                      <h3 className="text-xs font-semibold text-slate-100 mb-2 leading-relaxed">
                        {ans.question_text}
                      </h3>

                      {/* Answer Display or Inline Edit Form */}
                      {isEditing ? (
                        <div className="mt-3 p-3 rounded-lg bg-slate-900/90 border border-amber-500/40 space-y-3" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Verified Answer:
                            </label>
                            <textarea
                              rows={3}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full p-2 text-xs rounded bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400 font-mono"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                Compliance Status:
                              </label>
                              <select
                                value={editCompliance}
                                onChange={(e) => setEditCompliance(e.target.value)}
                                className="w-full p-1.5 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400"
                              >
                                <option value="Complied">Complied</option>
                                <option value="Not Complied">Not Complied</option>
                                <option value="Partially Complied">Partially Complied</option>
                                <option value="Not Applicable">Not Applicable</option>
                                <option value="Unable to Determine">Unable to Determine</option>
                                <option value="Needs Review">Needs Review</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                Reviewer Notes (Optional):
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Verified with parent deed"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="w-full p-1.5 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingQuestionId(null)}
                              className="px-2.5 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(ans.question_id)}
                              className="px-3 py-1 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save & Verify
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`p-3 rounded-lg text-xs leading-relaxed border ${
                            isConflict
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                              : isNotFound
                              ? 'bg-slate-900/50 border-slate-800 text-slate-400 italic'
                              : 'bg-slate-900/70 border-slate-800 text-slate-200'
                          }`}
                        >
                          {ans.answer}

                          {ans.compliance_status && (
                            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Compliance:</span>
                              <span className="font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {ans.compliance_status}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Footer Controls */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                        <div className="flex items-center gap-2 text-slate-400">
                          {ans.evidence.length > 0 ? (
                            <span className="flex items-center gap-1 text-sky-400 font-medium">
                              <BookOpen className="w-3 h-3" />
                              {ans.evidence.length} Source Citation(s)
                            </span>
                          ) : (
                            <span className="text-slate-500">Zero Evidence (Not Found)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(ans);
                            }}
                            className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                          {!isVerified && !isConflict && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickVerify(ans.question_id);
                              }}
                              className="px-2 py-0.5 rounded border border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex items-center gap-1 transition-colors font-medium"
                            >
                              <Check className="w-3 h-3" />
                              Verify
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuestionId(ans.question_id);
                            }}
                            className="px-2 py-0.5 rounded border border-sky-600/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Inspect
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Panel: Source Evidence Inspector (5 cols) */}
            <div className="lg:col-span-5 sticky top-20 space-y-4">
              <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    Evidence & Traceability Inspector
                  </div>
                  {activeAnswer && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      QID: {activeAnswer.question_id}
                    </span>
                  )}
                </div>

                {activeAnswer ? (
                  <div className="space-y-4">
                    {/* Active Question Title */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                        Active Scrutiny Point:
                      </div>
                      <div className="text-xs font-medium text-slate-200">
                        {activeAnswer.question_text}
                      </div>
                    </div>

                    {/* Conflict Resolution Card (if any) */}
                    {activeAnswer.conflict && (
                      <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/40 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          Contradiction Detected Across Documents
                        </div>
                        <p className="text-xs text-rose-200/90 leading-relaxed">
                          {activeAnswer.conflict.explanation}
                        </p>

                        <div className="space-y-2 mt-2 pt-2 border-t border-rose-500/20">
                          <span className="text-[11px] font-semibold text-rose-300">
                            Conflicting Citations:
                          </span>
                          {activeAnswer.conflict.sources.map((src, i) => (
                            <div
                              key={i}
                              className="p-2 rounded bg-slate-950/80 border border-rose-500/30 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px] text-rose-300 font-medium">
                                <span>{src.document_name}</span>
                                <span>Page {src.page_number}</span>
                              </div>
                              <p className="text-[11px] text-slate-300 font-mono">
                                "{src.snippet}"
                              </p>
                              <button
                                onClick={() => {
                                  handleStartEdit(activeAnswer);
                                  setEditText(src.highlight_facts[0] || src.snippet);
                                }}
                                className="mt-1 text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                              >
                                Accept this source value →
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Supporting Evidence List */}
                    {activeAnswer.evidence.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                          <span>Verifiable Evidence Passages:</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {activeAnswer.evidence.length} citation(s)
                          </span>
                        </div>

                        {activeAnswer.evidence.map((ev, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-700/80 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                {ev.document_name}
                              </span>
                              <span className="text-[10px] font-medium bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
                                Page {ev.page_number}
                              </span>
                            </div>

                            {/* Excerpt Snippet */}
                            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed">
                              "{ev.snippet}"
                            </div>

                            {/* Tamil Translation Display if Tamil Document */}
                            {ev.original_tamil_text && (
                              <div className="p-2 rounded bg-amber-500/5 border border-amber-500/20 text-[11px] space-y-1">
                                <div className="flex items-center gap-1 text-amber-400 font-semibold text-[10px] uppercase">
                                  <Languages className="w-3 h-3" />
                                  Original Tamil Source Excerpt:
                                </div>
                                <div className="text-slate-300 font-serif leading-relaxed">
                                  "{ev.original_tamil_text}"
                                </div>
                              </div>
                            )}

                            {/* Highlighted Facts & Relevance */}
                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                {ev.highlight_facts.map((fact, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium"
                                  >
                                    {fact}
                                  </span>
                                ))}
                              </div>
                              <span className="text-[10px] text-emerald-400 font-medium">
                                {Math.round(ev.relevance * 100)}% Match
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Zero Hallucination Guard Display */
                      <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-center space-y-2">
                        <ShieldCheck className="w-6 h-6 text-slate-500 mx-auto" />
                        <div className="text-xs font-bold text-slate-300">
                          Strict Anti-Hallucination Safe State
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          No supporting evidence clauses or verifiable entries were found in the uploaded documents for this question.
                          The AI strictly returned <span className="text-slate-300 font-medium">"Not found in the provided documents."</span> rather than inventing missing information.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-8">
                    Select a question on the left to inspect its grounded evidence and source citations.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
