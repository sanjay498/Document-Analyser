import React from 'react';
import { X, FileText, Copy, Check, ShieldCheck, Eye } from 'lucide-react';
import type { ExtractedSourceDocument } from '../types';

interface SourceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string | null;
  pageNumber?: number;
  snippet?: string;
  fieldOriginalText?: string;
  extractedValue?: string;
  sources: ExtractedSourceDocument[];
}

export const SourceViewerModal: React.FC<SourceViewerModalProps> = ({
  isOpen,
  onClose,
  documentName,
  pageNumber = 1,
  snippet,
  fieldOriginalText,
  extractedValue,
  sources,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !documentName) return null;

  const targetDoc = sources.find((s) => s.filename.toLowerCase() === documentName.toLowerCase());
  const targetPage = targetDoc?.pages?.find((p) => p.page_number === pageNumber);

  const displayPageText = targetPage ? targetPage.text : (targetDoc ? targetDoc.full_text : 'Source document text not available.');

  const handleCopySnippet = () => {
    if (snippet || extractedValue) {
      navigator.clipboard.writeText(snippet || extractedValue || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Highlight snippet or extracted value in the page text
  const renderHighlightedText = () => {
    const termToFind = (extractedValue && extractedValue.trim().length > 1)
      ? extractedValue.trim()
      : (snippet && snippet.trim().length > 1 ? snippet.trim() : null);

    if (!termToFind || !displayPageText) {
      return <span className="whitespace-pre-wrap">{displayPageText}</span>;
    }

    try {
      const parts = displayPageText.split(new RegExp(`(${termToFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return (
        <span className="whitespace-pre-wrap leading-relaxed">
          {parts.map((part, i) =>
            part.toLowerCase() === termToFind.toLowerCase() ? (
              <mark
                key={i}
                className="bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded border border-amber-500/40 font-medium inline-block"
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
      );
    } catch {
      return <span className="whitespace-pre-wrap">{displayPageText}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0b0f19] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#070a13]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white truncate max-w-md">{documentName}</h3>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  Page {pageNumber}
                </span>
                {targetPage?.is_ocr && (
                  <span className="px-2 py-0.2 rounded text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    OCR Scanned
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Exact source verification with page boundary provenance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cited Match Spotlight */}
        {(extractedValue || snippet) && (
          <div className="px-6 py-3 bg-[#070a13] border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs">
                <span className="text-slate-400 font-medium">Extracted Value: </span>
                <span className="font-semibold text-amber-300 font-mono">"{extractedValue || snippet}"</span>
                {fieldOriginalText && (
                  <span className="text-slate-500 text-[11px] ml-2 block truncate">
                    Maps to template: <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded font-mono">{fieldOriginalText}</span>
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleCopySnippet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* Document Content View */}
        <div className="p-6 overflow-y-auto space-y-3 font-mono text-xs text-slate-300 bg-slate-950/70 leading-relaxed max-h-[50vh]">
          {renderHighlightedText()}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#070a13] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Document provenance verified across {targetDoc?.pages?.length || 1} page(s)</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
