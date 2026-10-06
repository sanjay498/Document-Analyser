import type {
  HighlightedField,
  DynamicTableGroup,
  ExtractedSourceDocument,
  FieldExtractionResult,
  DynamicTableGroupResult,
  SessionState,
  AuthResponse,
  UserProfile,
  TemplateSummary,
  UseTemplateResponse,
  HistorySummary,
  HistoryDetail,
  BatchJobStatus,
  DeedModelDef,
  SystemMetrics,
  WalletTransaction,
  WalletSummary,
  AdminMetrics,
  AdminUserItem,
  AdminUserDetail,
  AdminDocumentItem,
  AdminDocumentDetail,
  AuditLogItem,
  PricingConfig,
  PaymentVerificationItem,
  UpiSettings,
  PaymentConfig,
  PaymentItem,
  DepositResponse,
  PaymentStatusResponse,
  TemplateQuestion,
  QuestionAnswer,
  QASessionState,
  SourceDocSummary,
  Client,
  ClientDetailResponse,
  CreateClientRequest,
  CheckExistingClientResponse,
  StartScrutinyResponse,
} from '../types';

export const DEFAULT_PRODUCTION_BACKEND = 'https://document-analyser-1-momv.onrender.com';

let cachedBackendBase = (() => {
  try {
    const custom = localStorage.getItem('lex_backend_url');
    if (custom && custom.trim()) return custom.trim().replace(/\/$/, '');
  } catch {}
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return DEFAULT_PRODUCTION_BACKEND;
  }
  return '';
})();

export let API_BASE = cachedBackendBase ? `${cachedBackendBase}/api` : '/api';

export function getBackendBaseUrl(): string {
  return cachedBackendBase;
}

export function setBackendBaseUrl(url: string): void {
  const clean = (url || '').trim().replace(/\/$/, '');
  cachedBackendBase = clean;
  API_BASE = clean ? `${clean}/api` : '/api';
  try {
    if (!clean) {
      localStorage.removeItem('lex_backend_url');
    } else {
      localStorage.setItem('lex_backend_url', clean);
    }
  } catch {}
}

/**
 * Resilient API fetch wrapper with exponential backoff and cold-start auto-retry.
 * Transparently absorbs Render wake-up delays (502 / 503 / 504 / network errors).
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delayMs = 1500
): Promise<Response> {
  let lastError: any = null;
  let targetUrl = url;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(targetUrl, options);

      // Render cold-start status codes: 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries) {
        console.warn(`[API] Backend waking up (HTTP ${res.status}). Retrying ${attempt + 1}/${retries}...`);
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(1.5, attempt)));
        continue;
      }

      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        // If attempting localhost and it failed, and no custom URL is configured, fallback to production Render
        if (!cachedBackendBase && attempt === 0 && typeof window !== 'undefined') {
          console.log('[API] Localhost unreachable. Auto-routing to cloud Render backend...');
          setBackendBaseUrl(DEFAULT_PRODUCTION_BACKEND);
          if (targetUrl.startsWith('/api')) {
            targetUrl = `${DEFAULT_PRODUCTION_BACKEND}${targetUrl}`;
          }
        }

        console.warn(`[API] Network error (${err.message || 'Connecting...'}). Retrying ${attempt + 1}/${retries}...`);
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(1.5, attempt)));
        continue;
      }
    }
  }

  throw lastError || new Error('Network request failed');
}

/**
 * Robust health check with extended timeout to allow Render instances to complete cold-start boot.
 */
export async function getHealthStatus(testUrl?: string, timeoutMs = 25000): Promise<Record<string, any>> {
  const base = testUrl !== undefined ? testUrl.trim().replace(/\/$/, '') : cachedBackendBase;
  const apiBase = base ? `${base}/api` : '/api';

  try {
    const res = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // continue to fallback
  }

  if (base) {
    try {
      const fallback = await fetch(`${base}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      if (fallback.ok) return await fallback.json();
    } catch (e) {}
  }

  // Fallback to DEFAULT_PRODUCTION_BACKEND if not already tested
  if (!base && DEFAULT_PRODUCTION_BACKEND) {
    try {
      const prodRes = await fetch(`${DEFAULT_PRODUCTION_BACKEND}/api/health`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (prodRes.ok) {
        setBackendBaseUrl(DEFAULT_PRODUCTION_BACKEND);
        return await prodRes.json();
      }
    } catch (e) {}
  }

  throw new Error('Health check failed: Unable to reach backend server');
}

/**
 * Actively wakes up a sleeping backend by polling with progressive backoff.
 */
export async function wakeUpBackend(
  maxWaitSeconds = 60,
  onProgress?: (elapsedSec: number, statusText: string) => void
): Promise<boolean> {
  const startTime = Date.now();
  let elapsed = 0;

  while (elapsed < maxWaitSeconds) {
    try {
      onProgress?.(elapsed, `Waking up server (${elapsed}s elapsed)...`);
      const h = await getHealthStatus(undefined, 8000);
      if (h && h.status === 'healthy') {
        onProgress?.(elapsed, 'Connected!');
        return true;
      }
    } catch (e) {
      // Still waking up
    }

    await new Promise((r) => setTimeout(r, 4000));
    elapsed = Math.round((Date.now() - startTime) / 1000);
  }

  return false;
}

/**
 * In-browser 24/7 keep-alive heartbeat loop.
 * Pings backend every 3.5 minutes while tab is open, preventing Render 15-min idle sleep.
 * Also auto-pings whenever user switches back to the tab.
 */
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

export function startKeepAliveHeartbeat(
  onStatusChange?: (status: 'healthy' | 'waking' | 'offline') => void
): () => void {
  const doPing = async () => {
    try {
      const res = await getHealthStatus(undefined, 10000);
      if (res && res.status === 'healthy') {
        onStatusChange?.('healthy');
      } else {
        onStatusChange?.('waking');
      }
    } catch (e) {
      onStatusChange?.('offline');
    }
  };

  // Immediate ping
  doPing();

  // Heartbeat every 210 seconds (3.5 minutes - well under Render's 15-minute shutdown limit)
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(doPing, 210000);

  // Resume / tab focus listener: immediately wake up & verify when user returns
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      doPing();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', doPing);
  }

  return () => {
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', doPing);
    }
  };
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) {
    const fallback = await fetch(`${cachedBackendBase || ''}/metrics`);
    if (!fallback.ok) throw new Error('Failed to fetch system metrics');
    return fallback.json();
  }
  return res.json();
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------- AUTH APIS ----------------
export interface RegisterPayload {
  name: string;
  email: string;
  mobile: string;
  password: string;
  confirm_password?: string;
  full_name?: string;
}

export async function registerUser(
  payloadOrEmail: RegisterPayload | string,
  password?: string,
  fullName?: string,
  mobile?: string,
  confirmPassword?: string
): Promise<AuthResponse> {
  let bodyPayload: Record<string, any>;
  if (typeof payloadOrEmail === 'object') {
    bodyPayload = {
      name: payloadOrEmail.name || payloadOrEmail.full_name || '',
      email: payloadOrEmail.email,
      mobile: payloadOrEmail.mobile,
      password: payloadOrEmail.password,
      confirm_password: payloadOrEmail.confirm_password || payloadOrEmail.password,
    };
  } else {
    bodyPayload = {
      name: fullName || '',
      email: payloadOrEmail,
      mobile: mobile || '',
      password: password || '',
      confirm_password: confirmPassword || password || '',
    };
  }

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(errorData.detail || 'Registration failed');
  }
  const data: AuthResponse = await res.json();
  if (data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(errorData.detail || 'Invalid email or password');
  }
  const data: AuthResponse = await res.json();
  if (data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }
  return data;
}

export async function refreshToken(): Promise<string | null> {
  const rf = localStorage.getItem('refresh_token');
  if (!rf) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rf }),
    });
    if (!res.ok) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      return null;
    }
    const data = await res.json();
    if (data.token) localStorage.setItem('auth_token', data.token);
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    return data.token;
  } catch (e) {
    return null;
  }
}

export async function getMeProfile(): Promise<UserProfile | null> {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  let res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 401) {
    // Attempt token refresh
    const newToken = await refreshToken();
    if (newToken) {
      res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders(),
      });
    }
  }
  if (!res.ok) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    return null;
  }
  return res.json();
}

export async function logoutUser(): Promise<void> {
  const rf = localStorage.getItem('refresh_token');
  if (rf) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rf }),
      });
    } catch (e) {
      // Best-effort logout
    }
  }
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
}

// ---------------- GENERATION SESSION APIS ----------------
export async function createSession(): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) throw new Error('Failed to create generation session');
  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch session state');
  return res.json();
}

export async function uploadTemplate(sessionId: string, file: File): Promise<{
  session_id: string;
  template_filename: string;
  fields_count: number;
  table_groups_count: number;
  questions_count?: number;
  fields: HighlightedField[];
  table_groups: DynamicTableGroup[];
  questions?: TemplateQuestion[];
  suggested_template_name?: string;
  suggested_doc_name?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/sessions/${sessionId}/template`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
  } catch (netErr: any) {
    throw new Error('Cannot connect to backend server. Render service may be waking up (please wait 10-15 seconds and retry) or check backend status in the top bar.');
  }

  if (!res.ok) {
    let detail = 'Failed to upload template';
    try {
      const errorData = await res.json();
      detail = errorData.detail || errorData.message || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function uploadSources(sessionId: string, files: File[]): Promise<{
  session_id: string;
  sources_count: number;
  sources: ExtractedSourceDocument[];
}> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/sessions/${sessionId}/sources`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
  } catch (netErr: any) {
    throw new Error('Cannot connect to backend server. Render service may be waking up (please wait 10-15 seconds and retry) or check backend status in the top bar.');
  }

  if (!res.ok) {
    let detail = 'Failed to upload source documents';
    try {
      const errorData = await res.json();
      detail = errorData.detail || errorData.message || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function getSessionState(sessionId: string): Promise<{
  session_id: string;
  client_id?: string;
  template_id?: string;
  status: string;
  template_filename?: string;
  fields: HighlightedField[];
  table_groups: DynamicTableGroup[];
  sources: ExtractedSourceDocument[];
  results: FieldExtractionResult[];
  table_results: DynamicTableGroupResult[];
  has_final_doc: boolean;
}> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch session state');
  }
  return res.json();
}

export async function getDeedModels(): Promise<{ models: DeedModelDef[] }> {
  const res = await fetch(`${API_BASE}/deed-models`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch deed models');
  }
  return res.json();
}

export async function detectDeedModel(params: {
  text?: string;
  filename?: string;
  session_id?: string;
}): Promise<{ detected_model: DeedModelDef }> {
  const res = await fetch(`${API_BASE}/deed-models/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error('Failed to detect deed model');
  }
  return res.json();
}

export async function extractFields(
  sessionId: string,
  _apiKey?: string,
  model?: string,
  preferredDeedModel?: string
): Promise<{
  session_id: string;
  results: FieldExtractionResult[];
  table_groups: DynamicTableGroupResult[];
  total_fields: number;
  extracted_count: number;
  conflict_count: number;
  not_found_count: number;
  questions_count?: number;
  qa_answers?: QuestionAnswer[];
  questions?: TemplateQuestion[];
  doc_custom_name?: string;
  suggested_template_name?: string;
}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };

  const res = await fetch(`${API_BASE}/sessions/${sessionId}/extract`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'free_ai_model',
      preferred_deed_model: preferredDeedModel || undefined,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to run AI extraction' }));
    throw new Error(errorData.detail || 'Failed to run AI extraction');
  }
  return res.json();
}

export async function exportDocument(
  sessionId: string,
  fieldValues: Record<string, string | null>,
  tableGroupRecords?: Record<string, Array<Record<string, any>>>,
  clearHighlight: boolean = true,
  preferredDeedModel?: string,
  qaAnswers?: QuestionAnswer[],
  docCustomName?: string,
  natureOfLoan?: string
): Promise<{
  status: string;
  message: string;
  download_url: string;
  history_id?: string;
}> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      field_values: fieldValues,
      table_group_records: tableGroupRecords,
      clear_highlight: clearHighlight,
      preferred_deed_model: preferredDeedModel || undefined,
      qa_answers: qaAnswers,
      doc_custom_name: docCustomName,
      nature_of_loan: natureOfLoan || undefined,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to export document' }));
    throw new Error(errorData.detail || 'Failed to export document');
  }
  return res.json();
}

export async function renameSessionDocument(
  sessionId: string,
  filename: string
): Promise<{ status: string; filename: string }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/rename`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to rename document' }));
    throw new Error(errorData.detail || 'Failed to rename document');
  }
  return res.json();
}

export async function saveSessionAsTemplate(
  sessionId: string,
  name?: string,
  bankName: string = 'General'
): Promise<{ status: string; template_id: string; name: string; bank_name: string }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/save-as-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ name, bank_name: bankName }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to save template' }));
    throw new Error(errorData.detail || 'Failed to save template');
  }
  return res.json();
}

export async function applyDeedModelToSession(
  sessionId: string,
  modelId: string,
  context?: Record<string, any>
): Promise<{
  status: string;
  model_id: string;
  model_name: string;
  formatted_text: string;
  results: FieldExtractionResult[];
  table_groups: DynamicTableGroupResult[];
}> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/apply-deed-model`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      model_id: modelId,
      context,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to apply deed model' }));
    throw new Error(errorData.detail || 'Failed to apply deed model');
  }
  return res.json();
}

export async function loadSamplePreset(sessionId: string): Promise<{
  session_id: string;
  template_filename: string;
  fields: HighlightedField[];
  table_groups: DynamicTableGroup[];
  sources: ExtractedSourceDocument[];
}> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/load-sample`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to load sample preset');
  }
  return res.json();
}

export async function loadTamilSamplePreset(sessionId: string): Promise<{
  session_id: string;
  template_filename: string;
  fields: HighlightedField[];
  table_groups: DynamicTableGroup[];
  sources: ExtractedSourceDocument[];
}> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/load-tamil-sample`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to load Tamil sample preset');
  }
  return res.json();
}

export function getDownloadUrl(sessionId: string): string {
  return `${API_BASE}/sessions/${sessionId}/download`;
}

// ---------------- TEMPLATE LIBRARY APIS ----------------
export async function listTemplates(bankName?: string): Promise<TemplateSummary[]> {
  const url = bankName && bankName !== 'all'
    ? `${API_BASE}/templates?bank_name=${encodeURIComponent(bankName)}`
    : `${API_BASE}/templates`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch template library');
  return res.json();
}

export async function listBankFolders(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/templates/groups`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const fallback = await fetch(`${API_BASE}/templates/banks`, { headers: getAuthHeaders() });
    if (!fallback.ok) throw new Error('Failed to fetch template groups');
    return fallback.json();
  }
  return res.json();
}

export async function createTemplateGroup(name: string, description?: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_BASE}/templates/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create template group' }));
    throw new Error(err.detail || 'Failed to create template group');
  }
  return res.json();
}

export async function deleteTemplateGroup(groupName: string, deleteTemplates: boolean = true): Promise<void> {
  const res = await fetch(`${API_BASE}/templates/groups/${encodeURIComponent(groupName)}?delete_templates=${deleteTemplates}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete template group' }));
    throw new Error(err.detail || 'Failed to delete template group');
  }
}

export async function saveTemplateToLibrary(
  file?: File,
  sessionId?: string,
  name?: string,
  bankName?: string
): Promise<TemplateSummary> {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (sessionId) formData.append('session_id', sessionId);
  if (name) formData.append('name', name);
  if (bankName) formData.append('bank_name', bankName);

  const res = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to save template to library' }));
    throw new Error(err.detail || 'Failed to save template to library');
  }
  return res.json();
}

export async function renameTemplate(templateId: string, name: string, bankName?: string): Promise<TemplateSummary> {
  const res = await fetch(`${API_BASE}/templates/${templateId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ name, bank_name: bankName }),
  });
  if (!res.ok) throw new Error('Failed to update template');
  return res.json();
}

export async function updateTemplateBank(templateId: string, bankName: string): Promise<TemplateSummary> {
  const res = await fetch(`${API_BASE}/templates/${templateId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ bank_name: bankName }),
  });
  if (!res.ok) throw new Error('Failed to move template to bank folder');
  return res.json();
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/templates/${templateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete template');
}

export async function getTemplateDetail(templateId: string): Promise<{
  id: string;
  name: string;
  created_at: string;
  fields_count: number;
  table_groups_count: number;
  fields: any[];
  table_groups: any[];
}> {
  const res = await fetch(`${API_BASE}/templates/${templateId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch template detail');
  return res.json();
}

export function getTemplateDownloadUrl(templateId: string): string {
  return `${API_BASE}/templates/${templateId}/download`;
}

export async function seedDefaultTemplates(): Promise<TemplateSummary[]> {
  const res = await fetch(`${API_BASE}/templates/seed-defaults`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to seed default templates');
  return res.json();
}

export async function deleteAllTemplates(): Promise<void> {
  const res = await fetch(`${API_BASE}/templates/all`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete all templates');
}

export async function useTemplateInSession(templateId: string): Promise<UseTemplateResponse> {
  const res = await fetch(`${API_BASE}/templates/${templateId}/use`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load template into session');
  return res.json();
}

// ---------------- DOCUMENT HISTORY APIS ----------------
export async function listHistory(): Promise<HistorySummary[]> {
  const res = await fetch(`${API_BASE}/history`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch document history');
  return res.json();
}

export async function getHistoryDetail(historyId: string): Promise<HistoryDetail> {
  const res = await fetch(`${API_BASE}/history/${historyId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch history detail');
  return res.json();
}

export async function deleteHistoryItem(historyId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/history/${historyId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete history record');
}

export async function clearAllHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/history`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear history');
}

// ---------------- BATCH GENERATION APIS ----------------
export async function createBatchJob(
  templateFile: File,
  items: Array<{ item_name: string; source_filenames: string[] }>,
  sourceFiles: File[],
  _apiKey?: string
): Promise<BatchJobStatus> {
  const formData = new FormData();
  formData.append('template_file', templateFile);
  formData.append('items_json', JSON.stringify(items));
  for (const f of sourceFiles) {
    formData.append('files', f);
  }

  const res = await fetch(`${API_BASE}/batch`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create batch job' }));
    throw new Error(err.detail || 'Failed to create batch job');
  }
  return res.json();
}

export async function getBatchStatus(batchId: string): Promise<BatchJobStatus> {
  const res = await fetch(`${API_BASE}/batch/${batchId}/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get batch status');
  return res.json();
}

// ---------------- IN-BROWSER HIGHLIGHT STUDIO APIS ----------------
export interface EditorTextRun {
  text: string;
  is_highlighted: boolean;
  bold?: boolean;
  italic?: boolean;
}

export interface EditorParagraph {
  runs: EditorTextRun[];
  heading_level?: number | null;
  alignment?: 'left' | 'center' | 'right';
}

export interface EditorTableColumn {
  header: string;
  sample_text: string;
  is_highlighted: boolean;
}

export interface EditorDynamicTable {
  title?: string;
  columns: EditorTableColumn[];
  rows?: EditorTextRun[][];
}

export interface EditorElement {
  type: 'paragraph' | 'table';
  paragraph?: EditorParagraph;
  table?: EditorDynamicTable;
}

export interface EditorDocumentPayload {
  title: string;
  paragraphs: EditorParagraph[];
  tables: EditorDynamicTable[];
  elements?: EditorElement[];
  raw_docx_base64?: string;
}

export async function convertEditorToDocx(payload: EditorDocumentPayload): Promise<Blob> {
  const res = await fetch(`${API_BASE}/editor/convert-to-docx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to convert editor document to .docx');
  return res.blob();
}

export async function saveEditorAsTemplate(payload: EditorDocumentPayload): Promise<TemplateSummary> {
  const res = await fetch(`${API_BASE}/editor/save-as-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to save template to library' }));
    throw new Error(err.detail || 'Failed to save template');
  }
  return res.json();
}

export async function useEditorInSession(payload: EditorDocumentPayload): Promise<UseTemplateResponse> {
  const res = await fetch(`${API_BASE}/editor/use-in-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to initialize session from editor' }));
    throw new Error(err.detail || 'Failed to use in session');
  }
  return res.json();
}

export async function importFileToEditor(file: File): Promise<EditorDocumentPayload> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/editor/import-file`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to import file to editor' }));
    throw new Error(err.detail || 'Failed to import file');
  }
  return res.json();
}

export async function importTemplateToEditor(templateId: string): Promise<EditorDocumentPayload> {
  const res = await fetch(`${API_BASE}/editor/import-template/${templateId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load template into editor');
  return res.json();
}

export async function updateTemplateInLibrary(templateId: string, payload: EditorDocumentPayload): Promise<TemplateSummary> {
  const res = await fetch(`${API_BASE}/editor/templates/${templateId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update template in library' }));
    throw new Error(err.detail || 'Failed to update template');
  }
  return res.json();
}

export async function validateGoogleKey(apiKey?: string): Promise<{
  valid: boolean;
  model?: string;
  provider?: string;
  status?: string;
  message?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/validate-google-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ api_key: apiKey || undefined }),
  });
  if (!res.ok) {
    return { valid: false, error: `Validation request failed with status ${res.status}` };
  }
  return res.json();
}

// ---------------- WALLET APIS ----------------
export async function getWalletSummary(): Promise<WalletSummary> {
  const res = await fetch(`${API_BASE}/wallet/summary`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch wallet summary' }));
    throw new Error(err.detail || 'Failed to fetch wallet summary');
  }
  return res.json();
}

export async function getWalletTransactions(limit = 50, offset = 0, transactionType?: string): Promise<WalletTransaction[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (transactionType) params.append('transaction_type', transactionType);
  const res = await fetch(`${API_BASE}/wallet/transactions?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

// ---------------- PAYMENT CONFIG & VERIFICATION APIS ----------------
export async function getPaymentConfig(): Promise<PaymentConfig> {
  const res = await fetch(`${API_BASE}/wallet/config`);
  if (!res.ok) throw new Error('Failed to load payment config');
  return res.json();
}

export async function submitPaymentVerification(
  amount: number,
  method: string,
  utrNumber: string,
  userNotes?: string
): Promise<{ status: string; verification_id: string; message: string; wallet_balance?: number; utr_number: string }> {
  const res = await fetch(`${API_BASE}/wallet/submit-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      amount,
      method,
      utr_number: utrNumber,
      user_notes: userNotes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to submit payment verification' }));
    throw new Error(err.detail || 'Failed to submit payment verification');
  }
  return res.json();
}

export async function getUserVerifications(): Promise<PaymentVerificationItem[]> {
  const res = await fetch(`${API_BASE}/wallet/verifications`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load user verifications');
  return res.json();
}

// ---------------- PAYMENT GATEWAY & VERIFICATION APIS ----------------
export async function createDeposit(
  amount: number,
  provider = 'upi',
  method = 'upi'
): Promise<DepositResponse> {
  const res = await fetch(`${API_BASE}/wallet/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ amount, provider, method }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to initiate deposit' }));
    throw new Error(err.detail || 'Failed to initiate deposit');
  }
  return res.json();
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  const res = await fetch(`${API_BASE}/payments/status/${paymentId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to query payment status' }));
    throw new Error(err.detail || 'Failed to query payment status');
  }
  return res.json();
}

export async function getPaymentHistory(limit = 50, offset = 0): Promise<PaymentItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API_BASE}/payments/history?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch payment history');
  return res.json();
}


// ---------------- ADMIN APIS ----------------
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const res = await fetch(`${API_BASE}/admin/metrics`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to load admin metrics' }));
    throw new Error(err.detail || 'Admin access required');
  }
  return res.json();
}

export async function getAdminUsers(search?: string, status?: string, limit = 50, offset = 0): Promise<AdminUserItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search) params.append('search', search);
  if (status && status !== 'all') params.append('status', status);
  const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch user list');
  return res.json();
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to load user details' }));
    throw new Error(err.detail || 'Failed to load user details');
  }
  return res.json();
}

export async function adjustUserWallet(
  userId: string,
  action: 'add' | 'deduct',
  amount: number,
  reason: string,
  reference?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/wallet/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ action, amount, reason, reference }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to adjust wallet' }));
    throw new Error(err.detail || 'Failed to adjust wallet');
  }
  return res.json();
}

export async function toggleUserStatus(userId: string, is_active: boolean, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ is_active, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update user status' }));
    throw new Error(err.detail || 'Failed to update user status');
  }
  return res.json();
}

export async function toggleUserAdmin(userId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-admin`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to toggle admin status' }));
    throw new Error(err.detail || 'Failed to toggle admin status');
  }
  return res.json();
}

export async function getAdminTransactions(limit = 50, offset = 0, transactionType?: string, userId?: string): Promise<any[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (transactionType) params.append('transaction_type', transactionType);
  if (userId) params.append('user_id', userId);
  const res = await fetch(`${API_BASE}/admin/transactions?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load transaction audit ledger');
  return res.json();
}

export async function getAdminPricing(): Promise<PricingConfig> {
  const res = await fetch(`${API_BASE}/admin/pricing`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch pricing config');
  return res.json();
}

export async function updateAdminPricing(payload: Partial<PricingConfig>): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/pricing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update pricing rules');
  return res.json();
}

export async function getAdminVerifications(status?: string, limit = 50, offset = 0): Promise<PaymentVerificationItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.append('status', status);
  const res = await fetch(`${API_BASE}/admin/verifications?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load payment verifications');
  return res.json();
}

export async function verifyPayment(verificationId: string, adminNotes?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/verifications/${verificationId}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ admin_notes: adminNotes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Verification failed' }));
    throw new Error(err.detail || 'Failed to verify payment');
  }
  return res.json();
}

export async function rejectPayment(verificationId: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/verifications/${verificationId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Rejection failed' }));
    throw new Error(err.detail || 'Failed to reject payment');
  }
  return res.json();
}

export async function getAdminUpiSettings(): Promise<UpiSettings> {
  const res = await fetch(`${API_BASE}/admin/upi-settings`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load UPI scanner settings');
  return res.json();
}

export async function updateAdminUpiSettings(payload: UpiSettings): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/upi-settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update UPI settings' }));
    throw new Error(err.detail || 'Failed to update UPI settings');
  }
  return res.json();
}

export async function uploadQrCode(file: File): Promise<{ success: boolean; message: string; qr_image_url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/admin/upload-qr`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to upload QR code' }));
    throw new Error(err.detail || 'Failed to upload QR code');
  }
  return res.json();
}

export async function removeQrCode(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/admin/remove-qr`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to remove QR code' }));
    throw new Error(err.detail || 'Failed to remove QR code');
  }
  return res.json();
}

export async function getAuditLogs(limit = 50, offset = 0): Promise<AuditLogItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API_BASE}/admin/audit-logs?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load audit logs');
  return res.json();
}

// ---------------- SERVER AI STATUS API ----------------
export async function getAiStatus(): Promise<{
  status: string;
  configured: boolean;
  model: string;
  multilingual_supported: boolean;
}> {
  const res = await fetch(`${API_BASE}/ai/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch AI engine status');
  return res.json();
}

export async function getActiveSession(): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/active-session`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load active session');
  const data: AuthResponse = await res.json();
  if (data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }
  return data;
}

export async function switchToAdmin(password: string): Promise<AuthResponse> {
  const currentToken = localStorage.getItem('auth_token');
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/switch-to-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ password }),
    });
  } catch (netErr: any) {
    throw new Error('Cannot connect to backend server. Please verify your Render Web Service is running and connected.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err.detail || err.message;
    } catch {
      throw new Error('Backend server is offline or returned an invalid response. Please verify your Render backend URL.');
    }
    throw new Error(detail || 'Incorrect administrator password. Please verify the password set in Render.');
  }
  const data: AuthResponse = await res.json();
  if (data.token) {
    // Preserve previous user token so user can switch back in 1 click
    if (currentToken && !localStorage.getItem('prev_user_token')) {
      localStorage.setItem('prev_user_token', currentToken);
    }
    localStorage.setItem('auth_token', data.token);
  }
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }
  return data;
}

export function switchBackToUser(): boolean {
  const prevToken = localStorage.getItem('prev_user_token');
  if (prevToken) {
    localStorage.setItem('auth_token', prevToken);
    localStorage.removeItem('prev_user_token');
    return true;
  }
  return false;
}

export async function adminLogin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Administrative authentication failed' }));
    throw new Error(err.detail || 'Administrative authentication failed');
  }
  const data: AuthResponse = await res.json();
  if (data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }
  return data;
}

export async function adminLogout(): Promise<any> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/auth/admin/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (e) {
      // Proceed with local logout regardless
    }
  }
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  return { success: true };
}

// ---------------- PERSISTENT DOCUMENT HISTORY API ----------------

export async function getAdminDocuments(params?: {
  search?: string;
  status?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminDocumentItem[]> {
  const query = new URLSearchParams();
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.offset) query.append('offset', String(params.offset));
  if (params?.search) query.append('search', params.search);
  if (params?.status && params.status !== 'all') query.append('status', params.status);
  if (params?.user_id) query.append('user_id', params.user_id);

  const res = await fetch(`${API_BASE}/admin/documents?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load document generation history');
  return res.json();
}

export async function getAdminDocumentDetail(documentId: string): Promise<AdminDocumentDetail> {
  const res = await fetch(`${API_BASE}/admin/documents/${documentId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to load document metadata' }));
    throw new Error(err.detail || 'Failed to load document metadata');
  }
  return res.json();
}

export async function downloadAdminDocument(documentId: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/documents/${documentId}/download`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to download document' }));
    throw new Error(err.detail || 'Failed to download document');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `document_${documentId}.docx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ---------------------------------------------------------------------------
// Intelligent Legal Template Question Answering API Client
// ---------------------------------------------------------------------------

export async function createQASession(clientId?: string): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/qa/sessions/create`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: clientId ? JSON.stringify({ client_id: clientId }) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create QA session' }));
    throw new Error(err.detail || 'Failed to create QA session');
  }
  return res.json();
}

export async function uploadQATemplate(
  sessionId: string,
  file: File
): Promise<{ session_id: string; questions_count: number; sections: string[]; questions: TemplateQuestion[] }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/upload-template`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to parse legal template' }));
    throw new Error(err.detail || 'Failed to parse legal template');
  }
  return res.json();
}

export async function uploadQASources(
  sessionId: string,
  files: File[]
): Promise<{ session_id: string; documents_count: number; documents: SourceDocSummary[] }> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));

  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/upload-sources`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to upload source documents' }));
    throw new Error(err.detail || 'Failed to upload source documents');
  }
  return res.json();
}

export async function runIntelligentQA(
  sessionId: string
): Promise<{
  session_id: string;
  total_questions: number;
  supported_count: number;
  needs_review_count: number;
  conflicts_count: number;
  not_found_count: number;
  answers: QuestionAnswer[];
}> {
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/run-qa`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to execute QA engine' }));
    throw new Error(err.detail || 'Failed to execute QA engine');
  }
  return res.json();
}

export async function getQASessionState(sessionId: string): Promise<QASessionState> {
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/state`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch QA session state' }));
    throw new Error(err.detail || 'Failed to fetch QA session state');
  }
  return res.json();
}

export async function updateQAAnswer(
  sessionId: string,
  questionId: string,
  payload: {
    answer: string;
    compliance_status?: string | null;
    status?: string;
    verification_badge?: string;
    user_notes?: string | null;
  }
): Promise<QuestionAnswer> {
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/answers/${questionId}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update answer' }));
    throw new Error(err.detail || 'Failed to update answer');
  }
  return res.json();
}

export async function approveAllQAAnswers(sessionId: string): Promise<QuestionAnswer[]> {
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/approve-all`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to approve answers' }));
    throw new Error(err.detail || 'Failed to approve answers');
  }
  return res.json();
}

export async function generateQAReport(
  sessionId: string
): Promise<{ session_id: string; status: string; download_url: string }> {
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/generate-report`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate report' }));
    throw new Error(err.detail || 'Failed to generate report');
  }
  return res.json();
}

export async function renameQADocument(
  sessionId: string,
  filename: string
): Promise<{ session_id: string; template_filename: string }> {
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/rename`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to rename document' }));
    throw new Error(err.detail || 'Failed to rename document');
  }
  return res.json();
}

export async function useQADocAsNextTemplate(
  sessionId: string,
  payload?: { new_filename?: string; keep_sources?: boolean }
): Promise<{
  session_id: string;
  questions_count: number;
  sections: string[];
  questions: TemplateQuestion[];
}> {
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/use-as-next-template`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to chain document as next template' }));
    throw new Error(err.detail || 'Failed to chain document as next template');
  }
  return res.json();
}

export async function downloadQAReport(sessionId: string, filename?: string): Promise<void> {
  const query = filename ? `?filename=${encodeURIComponent(filename)}` : '';
  const res = await fetch(`${API_BASE}/qa/sessions/${sessionId}/download-report${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to download report' }));
    throw new Error(err.detail || 'Failed to download report');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `Scrutiny_Report_${sessionId}.docx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ---------------- CLIENT MANAGEMENT & SCRUTINY WORKFLOW APIS ----------------
export async function getClients(search?: string): Promise<Client[]> {
  const query = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const res = await fetch(`${API_BASE}/clients${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch clients');
  return res.json();
}

export async function getClientDetail(clientId: string): Promise<ClientDetailResponse> {
  const res = await fetch(`${API_BASE}/clients/${clientId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch client details');
  return res.json();
}

export async function createClient(data: CreateClientRequest): Promise<Client> {
  const res = await fetch(`${API_BASE}/clients`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create client' }));
    throw new Error(err.detail || 'Failed to create client');
  }
  return res.json();
}

export async function checkExistingClient(
  phone?: string,
  email?: string
): Promise<CheckExistingClientResponse> {
  const res = await fetch(`${API_BASE}/clients/check-existing`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone, email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to check client' }));
    throw new Error(err.detail || 'Failed to check client');
  }
  return res.json();
}

export async function startScrutinyForClient(
  clientId: string,
  templateId: string
): Promise<StartScrutinyResponse> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/start-scrutiny`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ template_id: templateId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to start scrutiny for client' }));
    throw new Error(err.detail || 'Failed to start scrutiny for client');
  }
  return res.json();
}

export async function deleteClient(
  clientId: string
): Promise<{ success: boolean; message: string; client_id: string }> {
  const res = await fetch(`${API_BASE}/clients/${clientId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete client' }));
    throw new Error(err.detail || 'Failed to delete client');
  }
  return res.json();
}

export async function linkClientToSession(
  clientId: string,
  sessionId: string,
  natureOfLoan?: string
): Promise<StartScrutinyResponse> {
  const res = await fetch(`${API_BASE}/clients/${clientId}/link-session/${sessionId}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nature_of_loan: natureOfLoan }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to link client to session' }));
    throw new Error(err.detail || 'Failed to link client to session');
  }
  return res.json();
}








