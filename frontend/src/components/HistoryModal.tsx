import React, { useState, useEffect } from 'react';
import { X, History, Download, Calendar, FileText, Search } from 'lucide-react';
import { listHistory, getHistoryDetail } from '../services/api';
import type { HistorySummary, HistoryDetail } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [historyList, setHistoryList] = useState<HistorySummary[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      listHistory()
        .then((data) => setHistoryList(data))
        .catch((err) => console.error('Failed to load history', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectHistory = async (id: string) => {
    try {
      const detail = await getHistoryDetail(id);
      setSelectedHistory(detail);
    } catch (err) {
      console.error('Failed to load history detail', err);
    }
  };

  const filteredHistory = historyList.filter((h) =>
    h.template_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.sources_summary.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="glass-panel w-full max-w-4xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Document Generation History & Audit Trail</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit logs of past generations, field replacements, sources used, and re-download links
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: History Items List */}
          <div className="w-full md:w-1/2 border-r border-slate-800 flex flex-col bg-slate-950/30">
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search template or source document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[55vh]">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading history logs...</div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 italic">
                  No generation history found.
                </div>
              ) : (
                filteredHistory.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleSelectHistory(h.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selectedHistory?.id === h.id
                        ? 'bg-teal-500/15 border-teal-500/40 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{h.template_filename}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {new Date(h.generated_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                            {h.resolved_fields_count} Fields Filled
                          </span>
                          <span className="px-2 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                            {h.sources_summary.length} Source(s)
                          </span>
                        </div>
                      </div>

                      <a
                        href={h.download_url}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-colors shrink-0"
                        title="Re-download .docx"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Selected Generation Detail Audit */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-slate-900/40 space-y-4 max-h-[60vh]">
            {selectedHistory ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">{selectedHistory.template_filename}</h4>
                    <p className="text-[11px] text-slate-400">
                      Generated {new Date(selectedHistory.generated_at).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={selectedHistory.download_url}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .docx</span>
                  </a>
                </div>

                {/* Sources Used */}
                <div>
                  <h5 className="text-xs font-semibold text-slate-300 mb-1.5">Source Documents Used</h5>
                  <div className="space-y-1">
                    {selectedHistory.sources.map((src, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between"
                      >
                        <span className="truncate">{src.filename || (typeof src === 'string' ? src : JSON.stringify(src))}</span>
                        <span className="text-[10px] text-slate-500">{src.file_type?.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Field-by-Field Audit */}
                <div>
                  <h5 className="text-xs font-semibold text-slate-300 mb-1.5">
                    Field Values Applied ({Object.keys(selectedHistory.field_values).length})
                  </h5>
                  <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-950">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                          <th className="py-2 px-3">Field ID</th>
                          <th className="py-2 px-3">Populated Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {Object.entries(selectedHistory.field_values).map(([fId, val]) => (
                          <tr key={fId} className="hover:bg-slate-900/40">
                            <td className="py-1.5 px-3 text-slate-400">{fId}</td>
                            <td className="py-1.5 px-3 text-emerald-300 font-semibold">{val || '<blank>'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                Select any generation log from the left to view the field-by-field audit breakdown.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>{historyList.length} total document(s) generated</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
