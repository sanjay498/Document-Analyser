import React, { useState, useEffect } from 'react';
import {
  History,
  Download,
  Trash2,
  Eye,
  FileCheck,
  Search,
  Calendar,
  CheckCircle2,
  X
} from 'lucide-react';
import { listHistory, getHistoryDetail, deleteHistoryItem, clearAllHistory } from '../services/api';
import type { HistorySummary, HistoryDetail } from '../types';
import { HistoryEmptyIllustration } from './illustrations/LegalIllustrations';

interface HistoryViewProps {
  onNavigateToWorkspace: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onNavigateToWorkspace }) => {
  const [historyList, setHistoryList] = useState<HistorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<HistoryDetail | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const list = await listHistory();
      setHistoryList(list);
    } catch (err: any) {
      console.error('Failed to list history', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleInspectDetail = async (historyId: string) => {
    try {
      const detail = await getHistoryDetail(historyId);
      setSelectedHistory(detail);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load document history details' });
    }
  };

  const handleDeleteItem = async (historyId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete this generated document record for "${templateName}"?`)) return;
    try {
      await deleteHistoryItem(historyId);
      setHistoryList((prev) => prev.filter((h) => h.id !== historyId));
      if (selectedHistory?.id === historyId) {
        setSelectedHistory(null);
      }
      setMessage({ type: 'success', text: 'Document history record deleted' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to delete record' });
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL past generated document records? This cannot be undone.')) return;
    try {
      await clearAllHistory();
      setHistoryList([]);
      setSelectedHistory(null);
      setMessage({ type: 'success', text: 'All document history records cleared' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to clear history' });
    }
  };

  const filteredHistory = historyList.filter((h) =>
    h.template_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.sources_summary.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl p-6 bg-[#0b0f19] border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Generated Documents History</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete audit trail of all finalized documents with source citations and instant re-download links.
            </p>
          </div>
        </div>

        {historyList.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {/* Alert / Notification */}
      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between animate-slide-up ${
            message.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by template or source document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <span className="text-xs text-slate-400">
          Showing <strong className="text-slate-200">{filteredHistory.length}</strong> of {historyList.length} documents
        </span>
      </div>

      {/* History List */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading document generation audit log...</div>
      ) : filteredHistory.length === 0 ? (
        <div className="rounded-2xl p-12 text-center border border-slate-800 bg-[#0b0f19] space-y-4">
          <HistoryEmptyIllustration size={100} className="mx-auto opacity-80" />
          <div>
            <h3 className="text-sm font-bold text-white">No Past Scrutiny Reports Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              Documents generated in your workspace will be securely archived here with full source citations.
            </p>
          </div>
          <button
            onClick={onNavigateToWorkspace}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
          >
            <span>Open Document Workspace</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredHistory.map((h) => (
            <div
              key={h.id}
              className="rounded-2xl p-4 bg-[#0b0f19] border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-white truncate max-w-md" title={h.template_filename}>
                      {h.template_filename}
                    </h3>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Generated
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(h.generated_at).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-slate-300 font-medium">
                      {h.resolved_fields_count} Fields Filled
                    </span>
                    {h.sources_summary.length > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 truncate max-w-xs" title={h.sources_summary.join(', ')}>
                          Sources: {h.sources_summary.join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                <button
                  onClick={() => handleInspectDetail(h.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Audit Trail</span>
                </button>

                <a
                  href={`${h.download_url}?format=docx`}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer"
                  title="Download Microsoft Word .docx"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOCX</span>
                </a>

                <a
                  href={`${h.download_url}?format=pdf`}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </a>

                <button
                  onClick={() => handleDeleteItem(h.id, h.template_filename)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                  title="Delete record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Detail Audit Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0b0f19] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#070a13]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{selectedHistory.template_filename}</h3>
                  <p className="text-[11px] text-slate-500">
                    Generated on {new Date(selectedHistory.generated_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistory(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs bg-slate-950/40">
              {/* Field Values Breakdown */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Populated Field Values ({Object.keys(selectedHistory.field_values).length})
                </h4>
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#070a13] divide-y divide-slate-800">
                  {Object.entries(selectedHistory.field_values).map(([fieldId, val], idx) => (
                    <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-mono text-slate-400 text-[11px]">{fieldId}</span>
                      <span className="font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-left sm:text-right max-w-md truncate">
                        {val !== null && val !== undefined ? String(val) : '<Left Blank>'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Table Records */}
              {Object.keys(selectedHistory.table_records).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                    Dynamic Table Rows Injected
                  </h4>
                  {Object.entries(selectedHistory.table_records).map(([groupId, rows], idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#070a13] border border-slate-800 space-y-2">
                      <p className="font-semibold text-slate-300">Table Group: {groupId} ({rows.length} rows)</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                              {rows.length > 0 && Object.keys(rows[0]).map((col, cIdx) => (
                                <th key={cIdx} className="p-2 font-semibold">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, rIdx) => (
                              <tr key={rIdx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                {Object.values(r).map((cellVal: any, cIdx) => (
                                  <td key={cIdx} className="p-2 text-slate-200">{String(cellVal)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-[#070a13] flex items-center justify-between">
              <button
                onClick={() => setSelectedHistory(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Close
              </button>

              <a
                href={selectedHistory.download_url}
                download
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Re-Download Final .docx</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
