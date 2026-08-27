import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Upload,
  Plus,
  FileText,
  Trash2,
  PlayCircle,
  Eye,
  X,
  Layers,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';

export const TemplatesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!name || !file) throw new Error('Please enter template name and choose a file');
      return api.uploadTemplate(name, description, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsUploadOpen(false);
      setName('');
      setDescription('');
      setFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-400" /> Template Management
          </h1>
          <p className="text-slate-400 text-sm">
            Upload predefined DOCX templates with dynamic tags like <code className="text-brand-300 bg-brand-500/10 px-1 py-0.5 rounded">{"{{BORROWER_NAME}}"}</code>
          </p>
        </div>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-lg shadow-brand-600/25 transition-all"
        >
          <Plus className="w-4 h-4" /> Upload New Template
        </button>
      </div>

      {/* Grid of Templates */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-4">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-200">No Templates Uploaded Yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Upload a DOCX template containing placeholders like <code className="text-brand-300">{"{{NAME}}"}</code> or <code className="text-brand-300">{"{{DATE}}"}</code> to get started.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all"
          >
            <Upload className="w-4 h-4" /> Upload First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div key={tpl.id} className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {tpl.fields.length} Dynamic Fields
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white leading-tight">{tpl.name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {tpl.description || 'No description provided.'}
                  </p>
                </div>

                {/* Placeholders preview badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tpl.fields.slice(0, 4).map((f) => (
                    <span
                      key={f.id}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-brand-300 border border-slate-700"
                    >
                      {f.placeholder}
                    </span>
                  ))}
                  {tpl.fields.length > 4 && (
                    <span className="text-[11px] text-slate-500 px-1 py-0.5">
                      +{tpl.fields.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <Link
                  to={`/templates/${tpl.id}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Fields
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/process?template_id=${tpl.id}`}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"
                  >
                    <PlayCircle className="w-3.5 h-3.5" /> Process
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this template?')) {
                        deleteMutation.mutate(tpl.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-400" /> Upload DOCX Template
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                uploadMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal Opinion Template"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Brief overview of document template requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Template File (.docx or .pdf) *
                </label>
                <input
                  type="file"
                  accept=".docx,.pdf"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  The system will automatically detect placeholders enclosed in double curly braces, such as <code className="font-mono text-white">{"{{BORROWER_NAME}}"}</code>.
                </span>
              </div>

              {uploadMutation.isError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{(uploadMutation.error as Error).message}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
