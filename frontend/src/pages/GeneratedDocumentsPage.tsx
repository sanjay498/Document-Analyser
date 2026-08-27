import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, Download, Calendar, FileText } from 'lucide-react';
import { api } from '../services/api';

export const GeneratedDocumentsPage: React.FC = () => {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: api.getGeneratedDocuments,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-brand-400" /> Generated Documents History
        </h1>
        <p className="text-slate-400 text-sm">
          Access all processed documents and download DOCX or PDF files.
        </p>
      </div>

      <div className="glass-card p-6 rounded-2xl space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-600" />
            <p>No generated documents available yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Document Name</th>
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      {doc.file_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{doc.processing_job_id.slice(0, 8)}</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(doc.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.docx_file_path && (
                          <a
                            href={api.getDownloadUrl(doc.id, 'docx')}
                            download
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> DOCX
                          </a>
                        )}
                        {doc.pdf_file_path && (
                          <a
                            href={api.getDownloadUrl(doc.id, 'pdf')}
                            download
                            className="px-3 py-1.5 rounded-lg bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 font-semibold flex items-center gap-1 border border-brand-500/30 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
