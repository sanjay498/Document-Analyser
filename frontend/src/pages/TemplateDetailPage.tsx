import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  FileText,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { TemplateField } from '../types';

export const TemplateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const [newFieldName, setNewFieldName] = useState('');
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newRequired, setNewRequired] = useState(true);

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => api.getTemplate(id!),
    enabled: !!id,
  });

  const addFieldMutation = useMutation({
    mutationFn: () =>
      api.addTemplateField(id!, {
        field_name: newFieldName,
        placeholder: newPlaceholder.startsWith('{{') ? newPlaceholder : `{{${newPlaceholder}}}`,
        required: newRequired,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', id] });
      setIsAddFieldOpen(false);
      setNewFieldName('');
      setNewPlaceholder('');
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: string) => api.deleteTemplateField(fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', id] });
    },
  });

  if (isLoading || !template) {
    return <div className="py-12 text-center text-slate-400">Loading template details...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Back Button & Header */}
      <div className="space-y-4">
        <Link
          to="/templates"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Templates
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">{template.name}</h1>
              <p className="text-xs text-slate-400 mt-1">{template.description || 'DOCX Template'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/process?template_id=${template.id}`}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Process Document with Template
            </Link>
          </div>
        </div>
      </div>

      {/* Dynamic Fields Table */}
      <div className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-400" /> Defined Dynamic Fields ({template.fields.length})
            </h2>
            <p className="text-xs text-slate-400">
              Fields defined here will be semantically mapped by AI from uploaded source documents.
            </p>
          </div>
          <button
            onClick={() => setIsAddFieldOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Field
          </button>
        </div>

        {template.fields.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No dynamic fields defined. Add a field or upload a DOCX template with placeholders.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Field ID / Name</th>
                  <th className="py-3 px-4">Placeholder Tag</th>
                  <th className="py-3 px-4">Required</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {template.fields.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{f.field_name}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono px-2.5 py-1 rounded-md bg-brand-500/10 text-brand-300 border border-brand-500/20 text-xs">
                        {f.placeholder}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {f.required ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          Required
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold">
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => deleteFieldMutation.mutate(f.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Field Modal */}
      {isAddFieldOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Add Dynamic Template Field</h3>
              <button onClick={() => setIsAddFieldOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addFieldMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Field Name (e.g. BORROWER_NAME)</label>
                <input
                  type="text"
                  required
                  placeholder="BORROWER_NAME"
                  value={newFieldName}
                  onChange={(e) => {
                    setNewFieldName(e.target.value.toUpperCase().replace(/\s+/g, '_'));
                    if (!newPlaceholder) {
                      setNewPlaceholder(`{{${e.target.value.toUpperCase().replace(/\s+/g, '_')}}}`);
                    }
                  }}
                  className="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Placeholder</label>
                <input
                  type="text"
                  required
                  placeholder="{{BORROWER_NAME}}"
                  value={newPlaceholder}
                  onChange={(e) => setNewPlaceholder(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="req_check"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="req_check" className="text-xs font-semibold text-slate-300">
                  Required field
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddFieldOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFieldMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30"
                >
                  {addFieldMutation.isPending ? 'Saving...' : 'Add Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
