import React, { useState, useEffect } from 'react';
import { X, Layers, Upload, Plus, Trash2, Play, Download, FileText } from 'lucide-react';
import { createBatchJob, getBatchStatus } from '../services/api';
import type { BatchJobStatus } from '../types';

interface BatchGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
}

export const BatchGenerationModal: React.FC<BatchGenerationModalProps> = ({
  isOpen,
  onClose,
  apiKey,
}) => {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [batchItems, setBatchItems] = useState<Array<{ name: string; assignedFileIndex: number }>>([
    { name: 'Batch Item 1 (Applicant A)', assignedFileIndex: 0 },
    { name: 'Batch Item 2 (Applicant B)', assignedFileIndex: 0 },
  ]);
  const [activeJob, setActiveJob] = useState<BatchJobStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Poll active batch status every 2 seconds if processing
  useEffect(() => {
    let interval: any = null;
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'processing')) {
      interval = setInterval(async () => {
        try {
          const updated = await getBatchStatus(activeJob.id);
          setActiveJob(updated);
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeJob]);

  if (!isOpen) return null;

  const handleAddBatchItem = () => {
    setBatchItems((prev) => [
      ...prev,
      { name: `Batch Item ${prev.length + 1}`, assignedFileIndex: 0 },
    ]);
  };

  const handleRemoveBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartBatch = async () => {
    if (!templateFile) {
      setErrorMsg('Please select a .docx template file.');
      return;
    }
    if (sourceFiles.length === 0) {
      setErrorMsg('Please upload at least one source document.');
      return;
    }
    if (batchItems.length === 0) {
      setErrorMsg('Please configure at least one batch item.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const itemsPayload = batchItems.map((item) => ({
        item_name: item.name,
        source_filenames: sourceFiles.map((f) => f.name),
      }));

      const job = await createBatchJob(templateFile, itemsPayload, sourceFiles, apiKey);
      setActiveJob(job);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start batch job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Batch Document Generator</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate dozens of tailored documents from 1 template across multiple source document packages
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Active Job Progress View */}
          {activeJob ? (
            <div className="space-y-4 p-5 rounded-xl bg-slate-900/80 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Batch Job: {activeJob.id.slice(0, 8)}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        activeJob.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-purple-500/20 text-purple-300 animate-pulse'
                      }`}
                    >
                      {activeJob.status}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Template: {activeJob.template_filename} • {activeJob.completed_items} of {activeJob.total_items} items processed
                  </p>
                </div>

                {activeJob.status === 'completed' && activeJob.download_zip_url && (
                  <a
                    href={activeJob.download_zip_url}
                    download
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download All as ZIP</span>
                  </a>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Batch Progress</span>
                  <span className="font-bold text-purple-300 font-mono">{activeJob.progress_percentage}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${activeJob.progress_percentage}%` }}
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 pt-2">
                {activeJob.items.map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <span className="text-slate-300 font-medium">{item.item_name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : item.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              {activeJob.status === 'completed' && (
                <button
                  onClick={() => setActiveJob(null)}
                  className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  Configure Another Batch
                </button>
              )}
            </div>
          ) : (
            /* Batch Setup Form */
            <div className="space-y-5">
              {/* Step 1: Upload Batch Template */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">1. Select Master Template (.docx, .pptx, .pdf)</label>
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 text-center relative hover:border-purple-500/50 transition-colors">
                  <input
                    type="file"
                    accept=".docx,.pptx,.pdf"
                    onChange={(e) => e.target.files?.[0] && setTemplateFile(e.target.files[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-medium text-slate-300">
                    {templateFile ? templateFile.name : 'Click or drop .docx, .pptx, or .pdf template file here'}
                  </p>
                </div>
              </div>

              {/* Step 2: Upload Source Documents */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  2. Upload Source Documents Pool (.docx, .pdf, .txt)
                </label>
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 text-center relative hover:border-purple-500/50 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept=".docx,.pdf,.txt,.md"
                    onChange={(e) => e.target.files && setSourceFiles(Array.from(e.target.files))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileText className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-medium text-slate-300">
                    {sourceFiles.length > 0
                      ? `${sourceFiles.length} source file(s) selected: ${sourceFiles.map((f) => f.name).join(', ')}`
                      : 'Click or drop source documents to extract from'}
                  </p>
                </div>
              </div>

              {/* Step 3: Configure Target Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    3. Configure Batch Items to Generate ({batchItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddBatchItem}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {batchItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                    >
                      <span className="text-[11px] font-mono text-slate-500 w-6 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, name: val } : it))
                          );
                        }}
                        placeholder="Document Item Name..."
                        className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                      {batchItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchItem(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Launch Button */}
              <button
                onClick={handleStartBatch}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Run Background Batch ({batchItems.length} Documents)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>Background jobs run asynchronously with real-time progress polling</span>
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
