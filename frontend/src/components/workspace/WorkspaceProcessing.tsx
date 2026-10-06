import React, { useState, useEffect } from 'react';
import { LegalDocScanIllustration } from '../illustrations/LegalIllustrations';
import { Check, Sparkles } from 'lucide-react';

interface WorkspaceProcessingProps {
  templateFilename?: string;
  sourcesCount: number;
}

export const WorkspaceProcessing: React.FC<WorkspaceProcessingProps> = ({
  templateFilename,
  sourcesCount,
}) => {
  const steps = [
    { label: 'Document Loaded', description: 'Deeds & template validated' },
    { label: 'Reading & OCR', description: 'Multilingual text extraction' },
    { label: 'Analyzing Recitals', description: 'Classifying partition, sale, settlement' },
    { label: 'Title Scrutiny', description: 'Cross-verifying survey numbers & dates' },
    { label: 'Synthesizing Opinion', description: 'Mapping variables to opinion template' }
  ];

  const [activeStepIndex, setActiveStepIndex] = useState(1);

  // Smoothly advance through the stages to communicate progression
  useEffect(() => {
    const timer1 = setTimeout(() => setActiveStepIndex(2), 2500);
    const timer2 = setTimeout(() => setActiveStepIndex(3), 5500);
    const timer3 = setTimeout(() => setActiveStepIndex(4), 9500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-8 animate-fade-in">
      {/* Central Legal Processing Graphic */}
      <div className="relative inline-block">
        <LegalDocScanIllustration size={120} className="mx-auto" />
      </div>

      {/* Primary Status Title & Message */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Scrutinizing Legal Documents
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          {steps[activeStepIndex]?.description || 'Processing documents and tracing passage of title...'}
        </p>
      </div>

      {/* Document Context Tag */}
      {(templateFilename || sourcesCount > 0) && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-700 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>{templateFilename || 'Opinion Template'}</span>
          <span>•</span>
          <span>{sourcesCount} {sourcesCount === 1 ? 'deed' : 'deeds'}</span>
        </div>
      )}

      {/* Step Sequence Tracker (Document -> Reading -> Analyzing -> Scrutinizing -> Ready) */}
      <div className="pt-4 max-w-xl mx-auto">
        <div className="grid grid-cols-5 gap-2">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;

            return (
              <div key={idx} className="flex flex-col items-center space-y-2 text-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : isCurrent
                      ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-400/30 font-bold'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] font-medium leading-tight hidden sm:block ${
                    isCurrent ? 'text-amber-800 font-bold' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Indeterminate Scanning Line */}
        <div className="mt-6 w-full h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div className="h-full bg-gradient-to-r from-transparent via-amber-500 to-transparent w-1/3 animate-indeterminate-slide"></div>
        </div>
      </div>

      <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Multilingual OCR • Page-by-page verification • Zero hallucinations</span>
      </div>
    </div>
  );
};
