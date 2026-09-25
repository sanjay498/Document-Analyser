import React, { useRef, useState } from 'react';
import { CheckCircle, FileText, Eye, Info, Table as TableIcon } from 'lucide-react';
import type { HighlightedField, DynamicTableGroup } from '../types';
import { LegalDocEmptyIllustration } from './illustrations/LegalIllustrations';

interface TemplateUploadCardProps {
  templateFilename?: string;
  fields: HighlightedField[];
  tableGroups?: DynamicTableGroup[];
  isLoading: boolean;
  onUpload: (file: File) => void;
}

export const TemplateUploadCard: React.FC<TemplateUploadCardProps> = ({
  templateFilename,
  fields,
  tableGroups = [],
  isLoading,
  onUpload,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFieldDrawer, setShowFieldDrawer] = useState(false);
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
      const file = e.dataTransfer.files[0];
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.docx') || lower.endsWith('.pptx') || lower.endsWith('.pdf')) {
        onUpload(file);
      } else {
        alert('Please upload a valid .docx, .pptx, or .pdf template file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="rounded-2xl p-6 bg-[#0b0f19] border border-slate-800 shadow-xl transition-all relative overflow-hidden group hover:border-slate-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-xs">
              01
            </span>
            <h2 className="text-sm font-bold text-white tracking-tight">Legal Opinion Template</h2>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-900 text-slate-300 border border-slate-800">.DOCX</span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-900 text-slate-400 border border-slate-800">.PDF</span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-900 text-slate-400 border border-slate-800">.PPTX</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic fields highlighted in <span className="text-amber-300 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">YELLOW</span> inside Word/PowerPoint or PDF forms.
          </p>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-amber-400/80 bg-amber-500/5'
            : templateFilename
            ? 'border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50'
            : 'border-slate-800 bg-[#070a13] hover:border-slate-700 hover:bg-slate-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pptx,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-amber-300 mt-3 font-medium">Parsing yellow highlighted runs and tables in template...</p>
          </div>
        ) : templateFilename ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white tracking-tight">{templateFilename}</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Ready
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {fields.length} Highlighted Variables
                  </span>
                  {tableGroups.length > 0 && (
                    <span className="text-[11px] font-medium text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                      {tableGroups.length} Dynamic Schedule Table(s)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFieldDrawer(!showFieldDrawer);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>{showFieldDrawer ? 'Hide Variables' : 'View Variables'}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded hover:bg-slate-800 transition-colors"
              >
                Replace
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <LegalDocEmptyIllustration size={80} className="mb-2 opacity-90 group-hover:opacity-100 transition-opacity" />
            <p className="text-sm font-semibold text-slate-200">
              Drop your <span className="text-amber-300">.docx, .pdf, or .pptx</span> template here, or{' '}
              <span className="text-amber-400 underline underline-offset-4 decoration-amber-400/40 hover:decoration-amber-400">browse files</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              LexTitle AI detects highlighted runs, recital headings, borrower variables, and schedule tables.
            </p>
          </div>
        )}
      </div>

      {/* Detected Items Drawer */}
      {fields.length > 0 && (
        <div className={`mt-4 pt-4 border-t border-slate-800 transition-all ${showFieldDrawer ? 'block' : 'hidden'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              Detected Highlights & Table Groups ({fields.length} items)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {fields.map((field, idx) => (
              <div
                key={field.field_id}
                className="p-2.5 rounded-lg bg-[#070a13] border border-slate-800 text-xs flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-slate-500 font-medium">
                      #{idx + 1}
                    </span>
                    {field.is_table_cell ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <TableIcon className="w-2.5 h-2.5" />
                        {field.column_header || 'Table Cell'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                        Body
                      </span>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium truncate max-w-[130px]">
                    "{field.original_text}"
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 italic bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                  {field.context_with_marker}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
