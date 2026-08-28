import axios from 'axios';
import {
  Template,
  TemplateField,
  ProcessingJob,
  ExtractedField,
  GeneratedDocument,
  AISettings,
} from '../types';

const API_BASE = '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('docauto_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface UserDetail {
  id: string;
  email: string;
  full_name?: string;
  auth_provider: string;
  avatar_url?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  template_count: number;
  processing_job_count: number;
}

export const api = {
  // Auth
  register: async (email: string, password: string, fullName?: string) => {
    const res = await client.post('/auth/register', { email, password, full_name: fullName });
    return res.data;
  },

  login: async (email: string, password: string) => {
    const res = await client.post('/auth/login', { email, password });
    return res.data;
  },

  loginWithGoogle: async (credential: string) => {
    const res = await client.post('/auth/google', { credential });
    return res.data;
  },

  getMe: async () => {
    const res = await client.get('/auth/me');
    return res.data;
  },

  // Admin & User Logins
  getAdminUsers: async (): Promise<UserDetail[]> => {
    const res = await client.get('/admin/users');
    return res.data;
  },

  // Templates
  getTemplates: async (): Promise<Template[]> => {
    const res = await client.get('/templates');
    return res.data;
  },

  getTemplate: async (id: string): Promise<Template> => {
    const res = await client.get(`/templates/${id}`);
    return res.data;
  },

  uploadTemplate: async (name: string, description: string, file: File): Promise<Template> => {
    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    formData.append('file', file);

    const res = await client.post('/templates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await client.delete(`/templates/${id}`);
  },

  addTemplateField: async (
    templateId: string,
    field: Partial<TemplateField>
  ): Promise<TemplateField> => {
    const res = await client.post(`/templates/${templateId}/fields`, field);
    return res.data;
  },

  updateTemplateField: async (
    fieldId: string,
    field: Partial<TemplateField>
  ): Promise<TemplateField> => {
    const res = await client.put(`/templates/fields/${fieldId}`, field);
    return res.data;
  },

  deleteTemplateField: async (fieldId: string): Promise<void> => {
    await client.delete(`/templates/fields/${fieldId}`);
  },

  // Document Processing
  startProcessingJob: async (templateId: string, files: File[]): Promise<ProcessingJob> => {
    const formData = new FormData();
    formData.append('template_id', templateId);
    files.forEach((f) => formData.append('source_files', f));

    const res = await client.post('/process/start', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  analyzeJob: async (jobId: string): Promise<ProcessingJob> => {
    const res = await client.post(`/process/${jobId}/analyze`);
    return res.data;
  },

  getJobStatus: async (jobId: string): Promise<ProcessingJob> => {
    const res = await client.get(`/process/${jobId}`);
    return res.data;
  },

  updateExtractedField: async (fieldId: string, value: string): Promise<ExtractedField> => {
    const res = await client.put(`/process/fields/${fieldId}`, { value });
    return res.data;
  },

  generateDocument: async (
    jobId: string,
    outputFormats: string[] = ['docx', 'pdf']
  ): Promise<GeneratedDocument> => {
    const res = await client.post(`/process/${jobId}/generate`, { output_formats: outputFormats });
    return res.data;
  },

  // Documents
  getGeneratedDocuments: async (): Promise<GeneratedDocument[]> => {
    const res = await client.get('/documents');
    return res.data;
  },

  getDownloadUrl: (docId: string, format: string): string => {
    return `${API_BASE}/documents/${docId}/download/${format}`;
  },

  // Settings
  getSettings: async (): Promise<AISettings> => {
    const res = await client.get('/settings');
    return res.data;
  },

  updateSettings: async (settings: AISettings): Promise<AISettings> => {
    const res = await client.put('/settings', settings);
    return res.data;
  },
};
