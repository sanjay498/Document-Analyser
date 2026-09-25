import React from 'react';
import { X, Sparkles } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel-glow w-full max-w-2xl rounded-2xl p-6 border border-slate-700 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">How LexTitle AI Works</h3>
            <p className="text-xs text-slate-400">Automated Bank Title Opinion & Legal Scrutiny Engine</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] border border-amber-500/40">1</span>
              <span>Yellow Highlights, Not Curly Brackets</span>
            </div>
            <p className="text-slate-400 leading-relaxed pl-7">
              Instead of forcing template creators to write syntax like <code className="text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded">{`{{COMPANY_NAME}}`}</code>, simply highlight standard sample text in <strong>YELLOW</strong> directly inside Microsoft Word.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] border border-indigo-500/40">2</span>
              <span>Surrounding Context Inference</span>
            </div>
            <p className="text-slate-400 leading-relaxed pl-7">
              The AI never reads the highlighted text alone. It reads the surrounding sentence and paragraph context (e.g. <em>"This agreement is made between [FIELD: ABC] and XYZ"</em>) to infer that the field represents Party A's legal entity name.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] border border-purple-500/40">3</span>
              <span>Strict Structured JSON Extraction</span>
            </div>
            <p className="text-slate-400 leading-relaxed pl-7">
              The AI model returns strict JSON with confidence scores and source document attributions. The model <strong>NEVER</strong> edits Word XML or files directly.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] border border-emerald-500/40">4</span>
              <span>Deterministic Byte-for-Byte Preservation</span>
            </div>
            <p className="text-slate-400 leading-relaxed pl-7">
              A deterministic Python document manipulation layer replaces ONLY the highlighted runs, inheriting exact font styles, bold, italic, sizes, and colors, while leaving every other word and XML structure 100% byte-for-byte identical.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] border border-cyan-500/40">5</span>
              <span>Tamil (தமிழ்) & Multilingual Document Analysis</span>
            </div>
            <p className="text-slate-400 leading-relaxed pl-7">
              Source documents can be in Tamil (தமிழ்) or bilingual formats. The pipeline extracts dates, currency, party names, addresses, and terms, transliterates and translates them into standard English matching the template format, while retaining full source traceability and cross-lingual conflict detection.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
