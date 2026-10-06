import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HowItWorksModal } from './components/HowItWorksModal';
import { TemplateLibraryModal } from './components/TemplateLibraryModal';
import { HistoryModal } from './components/HistoryModal';
import { BatchGenerationModal } from './components/BatchGenerationModal';
import { SourceViewerModal } from './components/SourceViewerModal';
import { TemplateManagerView } from './components/TemplateManagerView';
import { HistoryView } from './components/HistoryView';
import { HighlightStudioView } from './components/HighlightStudioView';
import { MetricsModal } from './components/MetricsModal';
import { WalletModal } from './components/WalletModal';
import { WalletView } from './components/WalletView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { ClientsView } from './components/ClientsView';
import { BackendConfigModal } from './components/BackendConfigModal';
import { StepWorkflow } from './components/workflow/StepWorkflow';
import { DEFAULT_LOAN_NATURE } from './utils/loanModels';
import {
  createSession,
  uploadTemplate,
  uploadSources,
  extractFields,
  exportDocument,
  getDownloadUrl,
  getMeProfile,
  getActiveSession,
  getWalletSummary,
  logoutUser,
  getHealthStatus,
  getSessionState,
  switchBackToUser,
  getClientDetail,
} from './services/api';
import type {
  HighlightedField,
  DynamicTableGroup,
  ExtractedSourceDocument,
  FieldExtractionResult,
  DynamicTableGroupResult,
  UserProfile,
  UseTemplateResponse,
  Client,
  TemplateQuestion,
  QuestionAnswer,
} from './types';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string>('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'workspace' | 'clients' | 'qa' | 'templates' | 'studio' | 'history' | 'wallet' | 'admin'>('workspace');
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [studioTemplateId, setStudioTemplateId] = useState<string | null>(null);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState<boolean>(false);

  // Step-by-Step Workflow Wizard State (Preserved across Next/Back transitions)
  const [workflowStep, setWorkflowStep] = useState<1 | 2 | 3 | 4>(1);
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [clientTitle, setClientTitle] = useState<string>('');
  const [clientNatureOfLoan, setClientNatureOfLoan] = useState<string>(DEFAULT_LOAN_NATURE);

  // Data states
  const [templateFilename, setTemplateFilename] = useState<string | undefined>();
  const [fields, setFields] = useState<HighlightedField[]>([]);
  const [tableGroups, setTableGroups] = useState<DynamicTableGroup[]>([]);
  const [sources, setSources] = useState<ExtractedSourceDocument[]>([]);
  const [results, setResults] = useState<FieldExtractionResult[]>([]);
  const [tableResults, setTableResults] = useState<DynamicTableGroupResult[]>([]);
  const [qaAnswers, setQaAnswers] = useState<QuestionAnswer[]>([]);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [preferredDeedModel, setPreferredDeedModel] = useState<string>('normal_partition');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Loading states
  const [isTemplateLoading, setIsTemplateLoading] = useState<boolean>(false);
  const [isSourcesLoading, setIsSourcesLoading] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isHealthOk, setIsHealthOk] = useState<boolean>(true);

  // Modals
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isTemplateLibraryModalOpen, setIsTemplateLibraryModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState<boolean>(false);

  // Source Viewer Modal State
  const [sourceViewerData, setSourceViewerData] = useState<{
    isOpen: boolean;
    documentName: string | null;
    pageNumber?: number;
    snippet?: string;
    fieldOriginalText?: string;
    extractedValue?: string;
  }>({
    isOpen: false,
    documentName: null,
  });

  // Notification / toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Check URL pathname or hash for deep linking (e.g. /admin, /#admin)
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (
        path === '/management' ||
        path.startsWith('/management/') ||
        hash === '#management' ||
        path === '/admin' ||
        path.startsWith('/admin/') ||
        hash === '#admin'
      ) {
        setActiveTab('admin');
      } else if (hash === '#qa' || path === '/qa') {
        setActiveTab('workspace');
      }
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, []);

  const handleTabChange = (tab: 'workspace' | 'clients' | 'qa' | 'templates' | 'studio' | 'history' | 'wallet' | 'admin') => {
    if (tab === 'qa') {
      setActiveTab('workspace');
    } else {
      setActiveTab(tab);
    }
    if (tab === 'admin') {
      if (window.location.pathname !== '/management') {
        window.history.pushState(null, '', '/management');
      }
    } else if (window.location.pathname === '/management' || window.location.pathname === '/admin') {
      window.history.pushState(null, '', '/');
    }
  };

  // Initialize session & user on mount with persistence across reloads
  useEffect(() => {
    const init = async () => {
      try {
        const healthRes = await getHealthStatus().catch(() => null);
        if (healthRes) setIsHealthOk(true);

        let myProfile = await getMeProfile();
        if (!myProfile) {
          try {
            const activeRes = await getActiveSession();
            if (activeRes && activeRes.user) {
              myProfile = activeRes.user;
            }
          } catch (e) {
            console.warn('Could not establish default active session', e);
          }
        }

        if (myProfile) {
          try {
            const wSummary = await getWalletSummary();
            if (wSummary && wSummary.wallet_balance !== undefined) {
              myProfile.wallet_balance = wSummary.wallet_balance;
            }
          } catch (e) {
            // fallback to profile balance
          }
          setUser(myProfile);
        }

        // Check if there is an active session in localStorage to avoid wiping work on refresh
        const savedSessionId = localStorage.getItem('lex_title_session_id');
        let restored = false;
        if (savedSessionId) {
          try {
            const state = await getSessionState(savedSessionId);
            if (state && state.session_id) {
              setSessionId(state.session_id);
              if (state.template_filename) setTemplateFilename(state.template_filename);
              if (state.fields) setFields(state.fields);
              if (state.table_groups) setTableGroups(state.table_groups);
              if (state.sources) setSources(state.sources);
              if (state.results) setResults(state.results);
              if (state.table_results) setTableResults(state.table_results);
              if (state.client_id) {
                try {
                  const cl = await getClientDetail(state.client_id);
                  setActiveClient(cl);
                  if (cl) {
                    setClientName(cl.name || '');
                    setClientPhone(cl.phone || '');
                    setClientEmail(cl.email || '');
                    setClientTitle(cl.title || '');
                    if (cl.nature_of_loan) setClientNatureOfLoan(cl.nature_of_loan);
                  }
                } catch (e) {
                  console.warn('Could not restore client for session', e);
                }
              }
              if (state.results && state.results.length > 0) {
                setWorkflowStep(4);
              } else if (state.sources && state.sources.length > 0) {
                setWorkflowStep(3);
              } else if (state.template_filename) {
                setWorkflowStep(2);
              } else {
                setWorkflowStep(1);
              }
              restored = true;
            }
          } catch (e) {
            console.log('Saved session expired, initializing new session');
          }
        }

        if (!restored) {
          const sess = await createSession();
          setSessionId(sess.session_id);
          localStorage.setItem('lex_title_session_id', sess.session_id);
        }
      } catch (err) {
        console.error('Failed to initialize session', err);
        setIsHealthOk(false);
      }
    };
    init();

    const healthInterval = setInterval(async () => {
      try {
        const res = await getHealthStatus();
        setIsHealthOk(Boolean(res && res.status === 'healthy'));
      } catch {
        setIsHealthOk(false);
      }
    }, 15000);

    return () => clearInterval(healthInterval);
  }, []);

  const handleLogout = async () => {
    logoutUser();
    try {
      const activeRes = await getActiveSession();
      if (activeRes && activeRes.user) {
        setUser(activeRes.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    showToast('Session reset to default user workspace', 'info');
  };

  const handleResetSession = async () => {
    try {
      const sess = await createSession();
      setSessionId(sess.session_id);
      localStorage.setItem('lex_title_session_id', sess.session_id);
      setTemplateFilename(undefined);
      setActiveClient(null);
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setClientTitle('');
      setClientNatureOfLoan(DEFAULT_LOAN_NATURE);
      setFields([]);
      setTableGroups([]);
      setSources([]);
      setResults([]);
      setTableResults([]);
      setQaAnswers([]);
      setQuestions([]);
      setPreferredDeedModel('normal_partition');
      setDownloadUrl(null);
      setWorkflowStep(1);
      setActiveTab('workspace');
      showToast('Session reset. Ready to choose a template.', 'info');
    } catch (err) {
      showToast('Failed to reset session', 'error');
    }
  };

  const handleStartScrutinyForClient = (client: Client) => {
    setActiveClient(client);
    setClientName(client.name || '');
    setClientPhone(client.phone || '');
    setClientEmail(client.email || '');
    setClientTitle(client.title || '');
    if (client.nature_of_loan) setClientNatureOfLoan(client.nature_of_loan);
    setSources([]);
    setResults([]);
    setTableResults([]);
    setQaAnswers([]);
    setQuestions([]);
    setDownloadUrl(null);
    setActiveTab('workspace');
    if (templateFilename) {
      setWorkflowStep(2);
    } else {
      setWorkflowStep(1);
    }
    showToast(`Selected client "${client.name}". Choose a template to begin.`, 'info');
  };

  // Upload Template
  const handleTemplateUpload = async (file: File) => {
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const sess = await createSession();
        currentSessionId = sess.session_id;
        setSessionId(currentSessionId);
        localStorage.setItem('lex_title_session_id', currentSessionId);
      } catch {
        showToast('Connecting to backend... Please try again in a few seconds.', 'error');
        return;
      }
    }
    setIsTemplateLoading(true);
    try {
      const res = await uploadTemplate(currentSessionId, file);
      setTemplateFilename(res.template_filename);
      setFields(res.fields);
      setTableGroups(res.table_groups || []);
      setQuestions(res.questions || []);
      setQaAnswers([]);
      setResults([]);
      setTableResults([]);
      setDownloadUrl(null);
      setWorkflowStep(2);
      showToast(
        `Loaded "${res.template_filename}" (${res.fields_count} dynamic fields). Continue with Client Details.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to upload template', 'error');
    } finally {
      setIsTemplateLoading(false);
    }
  };

  // Select Template from Library (fast reuse without re-parsing)
  const handleSelectTemplateFromLibrary = (res: UseTemplateResponse) => {
    setSessionId(res.session_id);
    localStorage.setItem('lex_title_session_id', res.session_id);
    setTemplateFilename(res.template_filename);
    setFields(res.fields);
    setTableGroups(res.table_groups || []);
    setResults([]);
    setTableResults([]);
    setQaAnswers([]);
    setQuestions([]);
    setDownloadUrl(null);
    setActiveTab('workspace');
    setWorkflowStep(2);
    showToast(`Loaded "${res.template_filename}"! Continue with Client Details.`, 'success');
  };

  // Upload Sources
  const handleSourcesUpload = async (files: File[]) => {
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const sess = await createSession();
        currentSessionId = sess.session_id;
        setSessionId(currentSessionId);
        localStorage.setItem('lex_title_session_id', currentSessionId);
      } catch {
        showToast('Connecting to backend... Please try again in a few seconds.', 'error');
        return;
      }
    }
    setIsSourcesLoading(true);
    try {
      const res = await uploadSources(currentSessionId, files);
      setSources(res.sources);
      const ocrCount = res.sources.filter((s) => s.is_scanned_ocr).length;
      showToast(
        `Extracted ${files.length} document(s)${
          ocrCount > 0 ? ` (${ocrCount} scanned document(s) OCR processed)` : ''
        }.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to upload source documents', 'error');
    } finally {
      setIsSourcesLoading(false);
    }
  };

  const handleRemoveSource = (filename: string) => {
    setSources((prev) => prev.filter((s) => s.filename !== filename));
    showToast(`Removed deed "${filename}".`, 'info');
  };

  // AI Extraction
  const handleExtract = async (model: string, preferredModel?: string) => {
    if (!sessionId) return;
    if (preferredModel) {
      setPreferredDeedModel(preferredModel);
    }
    setIsExtracting(true);
    setWorkflowStep(4);
    try {
      const res = await extractFields(sessionId, undefined, model, preferredModel || preferredDeedModel);
      setResults(res.results || []);
      setTableResults(res.table_groups || []);
      setQaAnswers(res.qa_answers || []);
      setQuestions(res.questions || []);
      setDownloadUrl(null);
      if (res.conflict_count > 0) {
        showToast(
          `Extracted fields. Note: ${res.conflict_count} conflict(s) detected across source documents!`,
          'info'
        );
      } else if (res.not_found_count > 0) {
        showToast(
          `Extracted ${res.extracted_count} fields. Note: ${res.not_found_count} field(s) were missing.`,
          'info'
        );
      } else {
        showToast(`Successfully extracted all ${res.total_fields} dynamic fields with page citations!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'AI extraction failed', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  // Export Document
  const handleExport = async (
    fieldValues: Record<string, string | null>,
    tableRecords: Record<string, Array<Record<string, any>>>,
    clearHighlight: boolean,
    chosenDeedModel?: string,
    updatedQaAnswers?: QuestionAnswer[],
    docCustomName?: string,
    natureOfLoan?: string
  ) => {
    if (!sessionId) return;
    setIsExporting(true);
    try {
      const modelToUse = chosenDeedModel || preferredDeedModel;
      const res: any = await exportDocument(
        sessionId,
        fieldValues,
        tableRecords,
        clearHighlight,
        modelToUse,
        updatedQaAnswers || qaAnswers,
        docCustomName,
        natureOfLoan
      );
      setDownloadUrl(getDownloadUrl(sessionId));

      if (res && res.wallet_balance !== undefined && user) {
        setUser({ ...user, wallet_balance: res.wallet_balance });
      }

      showToast(
        res && res.deducted_fee
          ? `Document synthesized! ₹${res.deducted_fee.toFixed(2)} deducted from wallet.`
          : 'Document generated successfully with selected deed phrasing model & recorded in history!',
        'success'
      );
    } catch (err: any) {
      if (err.message && (err.message.includes('Insufficient wallet balance') || err.message.includes('402'))) {
        showToast(err.message, 'error');
        setIsWalletModalOpen(true);
      } else {
        showToast(err.message || 'Failed to generate final document', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // View Source Modal Handler
  const handleOpenSourceViewer = (
    docName: string,
    pageNum?: number,
    snippet?: string,
    fieldOrig?: string,
    extractedVal?: string
  ) => {
    setSourceViewerData({
      isOpen: true,
      documentName: docName,
      pageNumber: pageNum || 1,
      snippet,
      fieldOriginalText: fieldOrig,
      extractedValue: extractedVal,
    });
  };

  const handleSwitchToUser = async () => {
    switchBackToUser();
    try {
      let profile = await getMeProfile();
      if (!profile) {
        const activeRes = await getActiveSession();
        if (activeRes && activeRes.user) {
          profile = activeRes.user;
        }
      }
      if (profile) {
        setUser(profile);
        showToast('Switched to User Workspace', 'success');
        setActiveTab('workspace');
        return;
      }
    } catch (e) {
      // Continue to workspace
    }
    setActiveTab('workspace');
    showToast('Switched to User Workspace', 'info');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070a13] text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      {/* Header */}
      <Header
        user={user}
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenMetricsModal={() => setIsMetricsModalOpen(true)}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
        onSwitchToUser={handleSwitchToUser}
        onLogout={handleLogout}
        onResetSession={handleResetSession}
        isHealthOk={isHealthOk}
        onOpenBackendSettings={() => setIsBackendModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'admin' ? (
          <AdminDashboardView
            user={user}
            onNavigateToWorkspace={() => handleTabChange('workspace')}
            onSwitchToUser={handleSwitchToUser}
            onLoginSuccess={(authedAdmin) => {
              setUser(authedAdmin);
              showToast('Authenticated as Administrator', 'success');
            }}
            showToast={showToast}
          />
        ) : activeTab === 'clients' ? (
          <ClientsView
            onStartScrutinyForClient={handleStartScrutinyForClient}
            onNavigateToWorkspace={() => handleTabChange('workspace')}
            showToast={showToast}
          />
        ) : activeTab === 'templates' ? (
          <TemplateManagerView
            currentSessionId={sessionId}
            onSelectTemplate={handleSelectTemplateFromLibrary}
            onNavigateToWorkspace={() => setActiveTab('workspace')}
            onOpenInStudio={(tId) => {
              setStudioTemplateId(tId);
              setActiveTab('studio');
            }}
          />
        ) : activeTab === 'studio' ? (
          <HighlightStudioView
            onSelectTemplate={handleSelectTemplateFromLibrary}
            onNavigateToWorkspace={() => {
              setActiveTab('workspace');
              setWorkflowStep(1);
            }}
            initialTemplateId={studioTemplateId}
          />
        ) : activeTab === 'history' ? (
          <HistoryView
            onNavigateToWorkspace={() => setActiveTab('workspace')}
          />
        ) : activeTab === 'wallet' ? (
          <WalletView
            user={user}
            onNavigateToWorkspace={() => setActiveTab('workspace')}
            onBalanceUpdated={(newBal) => {
              if (user) {
                setUser({ ...user, wallet_balance: newBal });
              }
            }}
          />
        ) : (
          /* STEP-BY-STEP WORKFLOW WIZARD: CHOOSE -> ENTER -> UPLOAD -> GENERATE */
          <StepWorkflow
            currentStep={workflowStep}
            onSetStep={(s) => setWorkflowStep(s)}
            templateFilename={templateFilename}
            fieldsCount={fields.length}
            tableGroupsCount={tableGroups.length}
            onSelectTemplateFromLibrary={handleSelectTemplateFromLibrary}
            onUploadTemplateFile={handleTemplateUpload}
            onOpenInStudio={(tId) => {
              setStudioTemplateId(tId || null);
              setActiveTab('studio');
            }}
            isTemplateLoading={isTemplateLoading}
            clientName={clientName}
            onChangeClientName={setClientName}
            clientPhone={clientPhone}
            onChangeClientPhone={setClientPhone}
            clientEmail={clientEmail}
            onChangeClientEmail={setClientEmail}
            clientTitle={clientTitle}
            onChangeClientTitle={setClientTitle}
            clientNatureOfLoan={clientNatureOfLoan}
            onChangeClientNatureOfLoan={setClientNatureOfLoan}
            activeClient={activeClient}
            onSelectExistingClient={(c) => {
              setActiveClient(c);
              setClientName(c.name || '');
              setClientPhone(c.phone || '');
              setClientEmail(c.email || '');
              setClientTitle(c.title || '');
              if (c.nature_of_loan) setClientNatureOfLoan(c.nature_of_loan);
            }}
            sources={sources}
            isSourcesLoading={isSourcesLoading}
            onUploadSources={handleSourcesUpload}
            onRemoveSource={handleRemoveSource}
            isExtracting={isExtracting}
            onStartScrutiny={() => handleExtract('free_ai_model', preferredDeedModel)}
            results={results}
            tableResults={tableResults}
            qaAnswers={qaAnswers}
            questions={questions}
            fields={fields}
            tableGroups={tableGroups}
            sessionId={sessionId}
            preferredDeedModel={preferredDeedModel}
            onApplyDeedModel={(m) => setPreferredDeedModel(m)}
            isExporting={isExporting}
            onExport={handleExport}
            onViewSource={handleOpenSourceViewer}
            onResetSession={handleResetSession}
            downloadUrl={downloadUrl}
            showToast={showToast}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-medium shadow-2xl backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <HowItWorksModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <TemplateLibraryModal
        isOpen={isTemplateLibraryModalOpen}
        onClose={() => setIsTemplateLibraryModalOpen(false)}
        currentSessionId={sessionId && templateFilename ? sessionId : undefined}
        onSelectTemplate={handleSelectTemplateFromLibrary}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      <BatchGenerationModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
      />

      <SourceViewerModal
        isOpen={sourceViewerData.isOpen}
        onClose={() => setSourceViewerData({ isOpen: false, documentName: null })}
        documentName={sourceViewerData.documentName}
        pageNumber={sourceViewerData.pageNumber}
        snippet={sourceViewerData.snippet}
        fieldOriginalText={sourceViewerData.fieldOriginalText}
        extractedValue={sourceViewerData.extractedValue}
        sources={sources}
      />

      <MetricsModal
        isOpen={isMetricsModalOpen}
        onClose={() => setIsMetricsModalOpen(false)}
      />


      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        user={user}
        onBalanceUpdated={(newBal) => {
          if (user) {
            setUser({ ...user, wallet_balance: newBal });
          }
        }}
        onRequireLogin={() => {
          setIsWalletModalOpen(false);
          getActiveSession().then((res) => {
            if (res && res.user) setUser(res.user);
          }).catch(() => {});
        }}
      />

      <BackendConfigModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        onConnected={async () => {
          showToast('Backend connected successfully!', 'success');
          try {
            const h = await getHealthStatus();
            setIsHealthOk(Boolean(h && h.status === 'healthy'));
          } catch {
            setIsHealthOk(false);
          }
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070a13] py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-slate-400 font-medium">© 2026 LexTitle AI — Automated Bank Title Opinion & Legal Scrutiny Engine</p>
          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-amber-400/90 font-semibold">Enterprise Legal AI</span>
            <span>•</span>
            <span>Multilingual Tamil/English OCR</span>
            <span>•</span>
            <span>Deterministic Word & PDF Generation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
