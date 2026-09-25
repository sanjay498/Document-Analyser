import React, { useRef, useState } from 'react';
import { FileText, ChevronDown, ChevronUp, CheckCircle, Sparkles } from 'lucide-react';
import type { ExtractedSourceDocument } from '../types';
import { LegalDocScanIllustration } from './illustrations/LegalIllustrations';

interface SourcesUploadCardProps {
  sources: ExtractedSourceDocument[];
  isLoading: boolean;
  onUpload: (files: File[]) => void;
}

export const SourcesUploadCard: React.FC<SourcesUploadCardProps> = ({
  sources,
  isLoading,
  onUpload,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
    }
  };

  const toggleExpand = (filename: string) => {
    setExpandedDoc(expandedDoc === filename ? null : filename);
  };

  return (
    <div className="rounded-2xl p-6 bg-[#0b0f19] border border-slate-800 shadow-xl transition-all relative overflow-hidden group hover:border-slate-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold text-xs">
              02
            </span>
            <h2 className="text-sm font-bold text-white tracking-tight">Source Title Deeds & Revenue Records</h2>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              Multilingual OCR
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload parent deeds, partition/settlement deeds, sale deeds, GPAs, and revenue certificates (Tamil & English).
          </p>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-indigo-400/80 bg-indigo-500/5'
            : 'border-slate-800 bg-[#070a13] hover:border-slate-700 hover:bg-slate-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf,.txt,.md"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-indigo-300 mt-3 font-medium">Running multilingual OCR & extracting document text...</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 py-2">
            <LegalDocScanIllustration size={80} className="shrink-0 opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-slate-200">
                Drop one or more <span className="text-indigo-300">.pdf</span> (Scanned & Digital),{' '}
                <span className="text-slate-300">.docx</span>, or <span className="text-slate-300">.txt</span> deeds
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Bilingual English & Tamil (தமிழ்) scanned deeds • Automatic page boundary indexing and date extraction
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Documents List */}
      {sources.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Uploaded Source Documents ({sources.length})</span>
            <span className="text-[11px] text-slate-500">Click document to preview extracted text & page boundaries</span>
          </div>

          <div className="space-y-2">
            {sources.map((doc) => {
              const isExpanded = expandedDoc === doc.filename;
              return (
                <div
                  key={doc.filename}
                  className="rounded-xl bg-[#070a13] border border-slate-800 overflow-hidden transition-all hover:border-slate-700"
                >
                  <div
                    onClick={() => toggleExpand(doc.filename)}
                    className="p-3 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        doc.file_type === 'pdf'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-medium text-slate-200 truncate">{doc.filename}</p>
                          {doc.is_scanned_ocr && (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              OCR applied
                            </span>
                          )}
                          {doc.has_tamil && (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              தமிழ் Tamil
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {doc.char_count.toLocaleString()} chars • {doc.page_or_section_count} {doc.file_type === 'pdf' ? 'pages' : 'sections'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Extracted
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-slate-950 border-t border-slate-800">
                      <div className="max-h-48 overflow-y-auto p-2.5 rounded bg-slate-900/60 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-800/80">
                        {doc.full_text}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
