import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Upload,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Download,
  FileText,
  FileCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Eye,
  Check,
  X,
  FileCode,
  Layers,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { Template, ProcessingJob, ExtractedField, GeneratedDocument } from '../types';

const PROCESS_STEPS = [
  'UPLOADED',
  'OCR_PROCESSING',
  'DOCUMENT_ANALYSIS',
  'FIELD_MATCHING',
  'VALIDATION',
  'DOCUMENT_GENERATION',
  'COMPLETED',
];

export const ProcessDocumentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateIdParam = searchParams.get('template_id');

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateIdParam || '');
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [activeTab, setActiveTab] = useState<'review' | 'preview'>('review');

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  });

  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Start Job Mutation
  const startJobMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId || sourceFiles.length === 0) {
        throw new Error('Please select a template and upload at least one source document');
      }
      const job = await api.startProcessingJob(selectedTemplateId, sourceFiles);
      const analyzedJob = await api.analyzeJob(job.id);
      return analyzedJob;
    },
    onSuccess: (data) => {
      setCurrentJob(data);
    },
  });

  // Edit Extracted Field Mutation
  const updateFieldMutation = useMutation({
    mutationFn: async ({ fieldId, val }: { fieldId: string; val: string }) => {
      return api.updateExtractedField(fieldId, val);
    },
    onSuccess: (updatedField) => {
      if (currentJob) {
        setCurrentJob({
          ...currentJob,
          extracted_fields: currentJob.extracted_fields.map((f) =>
            f.id === updatedField.id ? updatedField : f
          ),
        });
      }
      setEditingFieldId(null);
    },
  });

  // Generate Document Mutation
  const generateDocMutation = useMutation({
    mutationFn: async () => {
      if (!currentJob) throw new Error('No processing job active');
      return api.generateDocument(currentJob.id, ['docx', 'pdf']);
    },
    onSuccess: (data) => {
      setGeneratedDoc(data);
      setActiveTab('preview');
    },
  });

  const getStepStatusIndex = (status: string) => {
    return PROCESS_STEPS.indexOf(status);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-brand-400" /> AI Document Automation Wizard
        </h1>
        <p className="text-slate-400 text-sm">
          Map arbitrary source document data onto dynamic template placeholders with layout preservation.
        </p>
      </div>

      {/* Step 1 & Step 2: Select Template & Dynamic Fields Preview */}
      {!currentJob && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Template Selection */}
          <div className="lg:col-span-2 glass-card p-6 rounded-2xl space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">1</span>
              Select Template Document
            </h2>

            {templates.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No templates available. Please upload a template in the Template Management page first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedTemplateId === tpl.id
                        ? 'bg-brand-600/10 border-brand-500 shadow-lg shadow-brand-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm">{tpl.name}</h3>
                      {selectedTemplateId === tpl.id && (
                        <CheckCircle2 className="w-5 h-5 text-brand-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{tpl.description || 'DOCX Template'}</p>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <Layers className="w-3.5 h-3.5" /> {tpl.fields.length} placeholders
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Source Documents Upload Drag-Drop */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">2</span>
                Upload Source Document(s)
              </h2>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                    setSourceFiles(Array.from(e.dataTransfer.files));
                  }
                }}
                className="border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-2xl p-8 text-center bg-slate-900/40 transition-colors cursor-pointer space-y-3"
              >
                <Upload className="w-10 h-10 text-brand-400 mx-auto animate-bounce" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Drag and drop source documents here, or browse
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports PDF, DOCX, JPG, JPEG, PNG (scanned documents, multi-page files)
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files) {
                      setSourceFiles(Array.from(e.target.files));
                    }
                  }}
                  className="hidden"
                  id="source_file_input"
                />
                <label
                  htmlFor="source_file_input"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer transition-colors"
                >
                  Select Files
                </label>
              </div>

              {/* Uploaded files list */}
              {sourceFiles.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-slate-400">Selected Source Files:</h4>
                  {sourceFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-400" />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        onClick={() => setSourceFiles(sourceFiles.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Process Button */}
              <div className="pt-4">
                <button
                  onClick={() => startJobMutation.mutate()}
                  disabled={startJobMutation.isPending || !selectedTemplateId || sourceFiles.length === 0}
                  className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-xl shadow-brand-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {startJobMutation.isPending ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Analyzing Document & OCR Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Analyze & Extract Fields with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Template Fields Panel */}
          <div className="glass-card p-6 rounded-2xl space-y-4 h-fit">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-400" /> Target Dynamic Fields
            </h3>
            <p className="text-xs text-slate-400">
              The AI model will scan the uploaded source document for matches corresponding to these placeholders:
            </p>
            {selectedTemplate ? (
              <div className="space-y-2 pt-2">
                {selectedTemplate.fields.map((field) => (
                  <div
                    key={field.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-200">{field.field_name}</span>
                    <span className="font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                      {field.placeholder}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-4">No template selected.</div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Analysis Pipeline Progress & Extracted Fields Review */}
      {currentJob && (
        <div className="space-y-8">
          {/* Progress Tracker */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Processing Pipeline Status</h3>
                <p className="text-xs text-slate-400">Job ID: {currentJob.id}</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Status: {currentJob.status}
              </span>
            </div>

            {/* Stepper Bar */}
            <div className="grid grid-cols-7 gap-2 pt-2">
              {PROCESS_STEPS.map((step, idx) => {
                const isCompleted = getStepStatusIndex(currentJob.status) >= idx;
                const isCurrent = currentJob.status === step;
                return (
                  <div key={step} className="flex flex-col items-center gap-1.5 text-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                          : isCurrent
                          ? 'bg-brand-600 text-white animate-pulse'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">
                      {step.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Tabs (Field Review vs Document Preview) */}
          <div className="flex border-b border-slate-800 gap-4">
            <button
              onClick={() => setActiveTab('review')}
              className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'review'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Human Review & Field Mapping
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              disabled={!generatedDoc}
              className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors disabled:opacity-40 ${
                activeTab === 'preview'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-4 h-4" /> Generated Document Preview
            </button>
          </div>

          {/* Tab 1: Human-in-the-Loop Review Table */}
          {activeTab === 'review' && (
            <div className="glass-card p-6 rounded-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand-400" /> Extracted Field Mapping Review
                  </h2>
                  <p className="text-xs text-slate-400">
                    Verify AI matched values from source document. Edit any missing or low-confidence field values before generating final DOCX/PDF.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentJob(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={() => generateDocMutation.mutate()}
                    disabled={generateDocMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {generateDocMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Generating DOCX & PDF...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Approve & Generate Final Document
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Template Field</th>
                      <th className="py-3 px-4">Extracted Value</th>
                      <th className="py-3 px-4">Source Context Quote</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {currentJob.extracted_fields.map((ef) => (
                      <tr key={ef.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-200">
                          {ef.field_name}
                          {ef.is_manually_edited && (
                            <span className="ml-2 text-[10px] text-indigo-400 font-normal">
                              (Edited)
                            </span>
                          )}
                        </td>

                        {/* Extracted Value with Inline Edit */}
                        <td className="py-3.5 px-4">
                          {editingFieldId === ef.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-brand-500 focus:outline-none"
                              />
                              <button
                                onClick={() =>
                                  updateFieldMutation.mutate({ fieldId: ef.id, val: editValue })
                                }
                                className="p-1.5 rounded bg-emerald-600 text-white"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingFieldId(null)}
                                className="p-1.5 rounded bg-slate-800 text-slate-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`font-semibold ${
                                !ef.value ? 'text-rose-400 italic' : 'text-slate-100'
                              }`}
                            >
                              {ef.value || 'Missing Information'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate font-mono text-[11px]">
                          {ef.source_text || '—'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                              ef.confidence >= 0.9
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : ef.confidence >= 0.7
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {(ef.confidence * 100).toFixed(0)}% Match
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setEditingFieldId(ef.id);
                              setEditValue(ef.value || '');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Side-by-Side Generated Document Preview */}
          {activeTab === 'preview' && generatedDoc && (
            <div className="glass-card p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-400" /> Document Generation Complete
                  </h2>
                  <p className="text-xs text-slate-400">
                    File: <span className="text-white font-semibold">{generatedDoc.file_name}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {generatedDoc.docx_file_path && (
                    <a
                      href={api.getDownloadUrl(generatedDoc.id, 'docx')}
                      download
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/30 flex items-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" /> Download DOCX
                    </a>
                  )}
                  {generatedDoc.pdf_file_path && (
                    <a
                      href={api.getDownloadUrl(generatedDoc.id, 'pdf')}
                      download
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </a>
                  )}
                </div>
              </div>

              {/* Side by side view */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Source Information Summary
                  </h3>
                  <div className="space-y-2 text-xs">
                    {currentJob.source_documents.map((sd) => (
                      <div key={sd.id} className="p-2.5 rounded-lg bg-slate-950 text-slate-300">
                        {sd.file_name} ({(sd.file_size / 1024).toFixed(1)} KB)
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Inserted Dynamic Field Map
                  </h3>
                  <div className="space-y-2 text-xs">
                    {currentJob.extracted_fields.map((ef) => (
                      <div key={ef.id} className="p-2.5 rounded-lg bg-slate-950 flex justify-between">
                        <span className="font-mono text-brand-400">{ef.field_name}</span>
                        <span className="font-semibold text-slate-200">{ef.value || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
