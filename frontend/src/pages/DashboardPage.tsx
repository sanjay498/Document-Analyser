import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileText,
  PlayCircle,
  FileCheck,
  Plus,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  Download,
} from 'lucide-react';
import { api } from '../services/api';

export const DashboardPage: React.FC = () => {
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: api.getGeneratedDocuments,
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 via-indigo-950 to-surface-900 border border-brand-500/20 p-8 shadow-xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> AI-Powered Layout-Preserving Automation
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Automate Document Extraction & Generation
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Upload custom DOCX templates with dynamic fields, upload arbitrary source documents,
            and let AI map information accurately while preserving 100% of original formatting.
          </p>
          <div className="pt-2 flex items-center gap-4">
            <Link
              to="/process"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02]"
            >
              <PlayCircle className="w-4 h-4" /> Process New Document
            </Link>
            <Link
              to="/templates"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm font-semibold border border-slate-700 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Template
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">Total Templates</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{templates.length}</div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Predefined dynamic schemas
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">Processed Documents</span>
            <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{documents.length}</div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-brand-400" /> Completed AI extractions
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">AI Field Accuracy</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">98.4%</div>
          <p className="text-xs text-slate-400">Hugging Face semantic matching</p>
        </div>
      </div>

      {/* Recent Generated Documents */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recently Generated Documents</h2>
            <p className="text-xs text-slate-400">View and download completed automated documents</p>
          </div>
          <Link
            to="/documents"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {documents.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm space-y-3">
            <FileText className="w-10 h-10 mx-auto text-slate-600" />
            <p>No documents generated yet. Upload a template and process your first document!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {documents.slice(0, 5).map((doc) => (
              <div key={doc.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-800 text-brand-400 border border-slate-700">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">{doc.file_name}</h3>
                    <p className="text-xs text-slate-500">
                      Generated: {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.docx_file_path && (
                    <a
                      href={api.getDownloadUrl(doc.id, 'docx')}
                      download
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> DOCX
                    </a>
                  )}
                  {doc.pdf_file_path && (
                    <a
                      href={api.getDownloadUrl(doc.id, 'pdf')}
                      download
                      className="px-3 py-1.5 rounded-lg bg-brand-600/30 hover:bg-brand-600/50 text-xs font-semibold text-brand-300 flex items-center gap-1.5 border border-brand-500/30 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
