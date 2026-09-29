export interface FieldLocation {
  location_type: string;
  paragraph_index: number;
  table_index?: number;
  row_index?: number;
  col_index?: number;
  cell_paragraph_index?: number;
  run_indices: number[];
}

export interface FieldFormatting {
  font_name?: string;
  font_size_pt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color_rgb?: string;
}

export interface HighlightedField {
  field_id: string;
  original_text: string;
  paragraph_context: string;
  context_with_marker: string;
  location: FieldLocation;
  formatting: FieldFormatting;
  is_table_cell?: boolean;
  is_question?: boolean;
  column_header?: string;
  row_context?: string;
  table_group_id?: string;
}

export interface TableColumnDef {
  col_index: number;
  header: string;
  field_id?: string;
  sample_text: string;
}

export interface DynamicTableGroup {
  group_id: string;
  table_index: number;
  template_row_index: number;
  columns: TableColumnDef[];
  template_row_context: string;
}

export interface SourceDocumentPage {
  page_number: number;
  text: string;
  is_ocr?: boolean;
  char_count?: number;
  has_tamil?: boolean;
}

export interface ExtractedSourceDocument {
  filename: string;
  file_type: string;
  char_count: number;
  page_or_section_count: number;
  full_text: string;
  is_scanned_ocr?: boolean;
  has_tamil?: boolean;
  pages?: SourceDocumentPage[];
}

export interface ConflictOption {
  value: string;
  source_document: string;
  source_page?: number;
  source_snippet?: string;
  is_translated?: boolean;
  source_language?: string;
}

export interface FieldExtractionResult {
  field_id: string;
  original_text: string;
  value: string | null;
  source_document: string | null;
  source_page?: number;
  source_snippet?: string;
  confidence: number;
  status: 'extracted' | 'conflict' | 'not_found' | 'edited';
  conflicts?: ConflictOption[];
  reasoning?: string;
  is_translated?: boolean;
  source_language?: string;
}

export interface DynamicTableGroupResult {
  group_id: string;
  table_index: number;
  template_row_index: number;
  records: Array<Record<string, string>>;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  mobile?: string;
  role: 'USER' | 'ADMIN' | string;
  is_admin?: boolean;
  is_active?: boolean;
  wallet_balance?: number;
  total_spent?: number;
  created_at?: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  type?: string;
  transaction_type: 'WALLET_CREDIT' | 'WALLET_DEBIT' | 'ADMIN_ADJUSTMENT' | 'REFUND' | 'deposit' | 'spend' | string;
  status?: string;
  description: string;
  reference_id?: string;
  balance_before?: number;
  balance_after: number;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export interface WalletSummary {
  wallet_balance: number;
  total_spent: number;
  total_deposited: number;
  transactions_count: number;
  currency: string;
  currency_symbol: string;
  recent_transactions: WalletTransaction[];
}

export interface AdminChartDay {
  date: string;
  full_date: string;
  deposits: number;
  spends: number;
}

export interface AdminTypeBreakdown {
  type: string;
  count: number;
  volume: number;
}

export interface AdminMetrics {
  status: string;
  financials: {
    total_platform_revenue: number;
    total_user_spent: number;
    total_outstanding_float: number;
    currency: string;
    currency_symbol: string;
  };
  counts: {
    total_users: number;
    active_users?: number;
    suspended_users?: number;
    admin_users: number;
    regular_users: number;
    total_documents: number;
    docs_today?: number;
    docs_this_month?: number;
    total_transactions: number;
    pending_verifications?: number;
    successful_payments?: number;
    pending_payments?: number;
    failed_payments?: number;
  };
  charts: {
    daily_trends: AdminChartDay[];
    type_breakdown: AdminTypeBreakdown[];
  };
}

export interface AdminDocumentItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  document_type: string;
  template_filename: string;
  status: string;
  generated_at: string;
  sources_count?: number;
  fields_count?: number;
}

export interface AdminDocumentDetail {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  document_type: string;
  template_filename: string;
  status: string;
  generated_at: string;
  storage_key?: string;
  sources_summary?: any[];
  field_values?: Record<string, any>;
  table_records?: any[];
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: string;
  is_admin: boolean;
  is_active: boolean;
  wallet_balance: number | null;
  created_at: string;
  recent_transactions?: any[];
  recent_verifications?: any[];
  recent_documents?: any[];
}

export interface AdminUserItem {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  mobile?: string;
  role?: string;
  is_admin: boolean;
  is_active?: boolean;
  wallet_balance: number;
  total_spent: number;
  documents_count: number;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  admin_id: string;
  admin_email?: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface PricingConfig {
  doc_generation_fee: number;
  ocr_per_page_fee: number;
  signup_bonus: number;
  currency?: string;
  currency_symbol?: string;
}

export interface PaymentVerificationItem {
  id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  amount: number;
  method: string;
  utr_number: string;
  user_notes?: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REJECTED' | 'pending' | 'verified' | 'rejected' | string;
  admin_notes?: string;
  verified_by?: string;
  verified_at?: string | null;
  created_at: string;
}

export interface UpiSettings {
  upi_vpa: string;
  upi_payee_name: string;
  upi_qr_image_url?: string;
  payment_verification_mode?: string;
  min_deposit_amount?: number;
  max_deposit_amount?: number;
}

export interface PaymentConfig {
  upi_vpa: string;
  upi_payee_name: string;
  upi_qr_image_url?: string;
  min_deposit_amount?: number;
  max_deposit_amount?: number;
  verification_required: boolean;
  currency: string;
  currency_symbol: string;
}

export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: UserProfile;
  message?: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  bank_name?: string;
  created_at: string;
  fields_count: number;
  table_groups_count: number;
}

export interface UseTemplateResponse {
  session_id: string;
  template_filename: string;
  bank_name?: string;
  fields_count: number;
  table_groups_count: number;
  fields: HighlightedField[];
  table_groups: DynamicTableGroup[];
}

export interface HistorySummary {
  id: string;
  template_filename: string;
  generated_at: string;
  sources_summary: string[];
  resolved_fields_count: number;
  download_url: string;
}

export interface HistoryDetail {
  id: string;
  template_filename: string;
  generated_at: string;
  sources: ExtractedSourceDocument[];
  field_values: Record<string, string | null>;
  table_records: Record<string, Array<Record<string, any>>>;
  download_url: string;
}

export interface BatchItemStatus {
  id: string;
  item_index: number;
  item_name: string;
  status: string;
  error_message?: string;
}

export interface BatchJobStatus {
  id: string;
  template_filename: string;
  status: string;
  total_items: number;
  completed_items: number;
  progress_percentage: number;
  created_at: string;
  items: BatchItemStatus[];
  download_zip_url?: string;
}

export interface SessionState {
  session_id: string;
  status: 'created' | 'template_loaded' | 'sources_loaded' | 'extracted' | 'completed';
  template_filename?: string;
  fields: HighlightedField[];
  table_groups: DynamicTableGroup[];
  sources: ExtractedSourceDocument[];
  results: FieldExtractionResult[];
  table_results: DynamicTableGroupResult[];
  has_final_doc: boolean;
}

export interface DeedModelDef {
  id: string;
  name: string;
  category: string;
  description: string;
  template_format: string;
  sample_text: string;
  is_root_deed_candidate: boolean;
}

export interface SystemMetrics {
  status: string;
  service: string;
  version: string;
  ai_engine: {
    primary_mode: string;
    gemini_configured: boolean;
    groq_configured: boolean;
    anthropic_configured: boolean;
    heuristic_fallback_active: boolean;
    multilingual_tamil_ocr: string;
    supported_models: string[];
  };
  deed_models: {
    total_models: number;
    categories: {
      trace_of_title: number;
      revenue_and_registration: number;
    };
    languages_supported: string[];
  };
  database_metrics: {
    total_sessions: number;
    completed_documents: number;
    saved_templates: number;
    batch_jobs: number;
  };
  supported_formats: {
    templates: string[];
    source_documents: string[];
    exports: string[];
  };
}

export interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | string;
  provider: string;
  method: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositResponse {
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  provider_order_id?: string;
  client_secret?: string;
  checkout_url?: string;
  qr_data?: string;
  message: string;
}

export interface PaymentStatusResponse {
  payment_id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | string;
  provider: string;
  method: string;
  error_message?: string | null;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
  message: string;
}

export interface QAQuestionLocation {
  location_type: 'table_cell' | 'paragraph' | 'placeholder';
  table_index?: number;
  row_index?: number;
  col_index?: number;
  answer_col_index?: number;
  paragraph_index?: number;
}

export interface TemplateQuestion {
  id: string;
  section: string;
  question_number?: string | null;
  question_text: string;
  question_type: string;
  compliance_label?: string | null;
  location: QAQuestionLocation;
  parent_id?: string | null;
  existing_sample_value?: string | null;
}

export interface SourceEvidence {
  document_name: string;
  page_number: number;
  snippet: string;
  relevance: number;
  highlight_facts: string[];
  original_tamil_text?: string | null;
  translated_meaning?: string | null;
  explanation: string;
}

export interface ConflictEvidence {
  entity_type: string;
  conflicting_values: string[];
  sources: SourceEvidence[];
  explanation: string;
}

export interface QuestionAnswer {
  question_id: string;
  question_text: string;
  section: string;
  question_type: string;
  answer: string;
  compliance_status?: 'Complied' | 'Not Complied' | 'Partially Complied' | 'Not Applicable' | 'Unable to Determine' | 'Needs Review' | string | null;
  status: 'supported' | 'needs_review' | 'conflict_detected' | 'not_found' | 'user_approved' | 'user_edited';
  verification_badge: 'AI Generated' | 'Human Verified';
  confidence: number;
  evidence: SourceEvidence[];
  conflict?: ConflictEvidence | null;
  user_notes?: string | null;
  updated_at: string;
}

export interface SourceDocSummary {
  filename: string;
  file_type: string;
  char_count: number;
  page_or_section_count: number;
  is_scanned_ocr: boolean;
  has_tamil: boolean;
}

export interface QASessionState {
  session_id: string;
  status: string;
  template_filename?: string | null;
  questions_count: number;
  documents_count: number;
  questions: TemplateQuestion[];
  answers: QuestionAnswer[];
  documents: SourceDocSummary[];
}

// ---------------- CLIENT MANAGEMENT & SCRUTINY WORKFLOW ----------------
export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  title: string;
  created_at: string;
  updated_at: string;
  scrutiny_count: number;
}

export interface ClientScrutinyHistory {
  session_id: string;
  template_filename: string;
  status: string;
  created_at: string;
  sources_count: number;
  sources_names: string[];
  final_document_ready: boolean;
  history_id?: string | null;
  title_holder?: string | null;
  property_extent?: string | null;
  survey_numbers?: string | null;
  sro_name?: string | null;
  matter_title?: string | null;
  preview_paragraphs?: string[];
  preview_text?: string | null;
  download_url_docx?: string;
  download_url_pdf?: string;
  download_url_txt?: string;
}

export interface ClientDetailResponse extends Client {
  scrutinies: ClientScrutinyHistory[];
}

export interface CreateClientRequest {
  name: string;
  phone: string;
  email: string;
  title: string;
}

export interface CheckExistingClientResponse {
  exists: boolean;
  client?: Client | null;
}

export interface StartScrutinyResponse {
  session_id: string;
  client_id: string;
  template_id: string;
  template_filename: string;
  bank_name: string;
  fields_count: number;
  table_groups_count: number;
  fields: HighlightedField[];
  table_groups: DynamicTableGroup[];
  client: Client;
}



