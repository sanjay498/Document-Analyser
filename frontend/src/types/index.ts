export interface TemplateField {
  id: string;
  template_id: string;
  field_name: string;
  placeholder: string;
  required: boolean;
  field_type?: string;
  description?: string;
  page_number?: number;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  font_name?: string;
  font_size?: number;
  alignment?: string;
  formatting_rules?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  fields: TemplateField[];
}

export interface SourceDocument {
  id: string;
  processing_job_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  page_count?: number;
  uploaded_at: string;
}

export interface ExtractedField {
  id: string;
  processing_job_id: string;
  template_field_id?: string;
  field_name: string;
  value?: string | null;
  source_text?: string | null;
  confidence: number;
  status: 'MATCHED' | 'MISSING' | 'LOW_CONFIDENCE';
  is_manually_edited: boolean;
  bbox?: number[];
}

export interface GeneratedDocument {
  id: string;
  processing_job_id: string;
  file_name: string;
  docx_file_path?: string;
  pdf_file_path?: string;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  template_id: string;
  status: 'UPLOADED' | 'OCR_PROCESSING' | 'DOCUMENT_ANALYSIS' | 'FIELD_MATCHING' | 'VALIDATION' | 'DOCUMENT_GENERATION' | 'COMPLETED' | 'FAILED';
  error_message?: string;
  created_at: string;
  updated_at: string;
  source_documents: SourceDocument[];
  extracted_fields: ExtractedField[];
  generated_documents: GeneratedDocument[];
}

export interface AISettings {
  ai_provider: string;
  huggingface_api_token?: string;
  huggingface_model: string;
  ocr_engine: string;
}
