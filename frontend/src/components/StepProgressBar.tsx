import React from 'react';
import { Check, ChevronRight } from 'lucide-react';

interface StepProgressBarProps {
  currentStep: number;
  templateLoaded: boolean;
  sourcesLoaded: boolean;
  extracted: boolean;
  exported: boolean;
  onSelectStep: (step: number) => void;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({
  currentStep,
  templateLoaded,
  sourcesLoaded,
  extracted,
  exported,
  onSelectStep,
}) => {
  const steps = [
    {
      id: 1,
      name: 'Template',
      hint: 'Word or PDF form',
      isDone: templateLoaded,
    },
    {
      id: 2,
      name: 'Source Deeds',
      hint: 'Registered deeds & EC',
      isDone: sourcesLoaded,
    },
    {
      id: 3,
      name: 'Title Scrutiny',
      hint: 'AI extraction & trace',
      isDone: extracted,
    },
    {
      id: 4,
      name: 'Review & Opinion',
      hint: 'Audit & download',
      isDone: exported,
    },
  ];

  return (
    <nav className="w-full max-w-4xl mx-auto my-4 px-2" aria-label="Workflow Steps">
      <ol className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isDone = step.isDone;

          return (
            <React.Fragment key={step.id}>
              <li className="flex-1">
                <button
                  type="button"
                  onClick={() => onSelectStep(step.id)}
                  className="w-full text-left group flex items-center gap-2.5 focus:outline-none cursor-pointer"
                >
                  {/* Step Status Badge */}
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                      isDone
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : isActive
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : step.id}
                  </span>

                  {/* Step Text */}
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium truncate transition-colors ${
                        isActive
                          ? 'text-white font-semibold'
                          : isDone
                          ? 'text-slate-300'
                          : 'text-slate-500 group-hover:text-slate-400'
                      }`}
                    >
                      {step.name}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                      {step.hint}
                    </p>
                  </div>
                </button>
              </li>

              {idx < steps.length - 1 && (
                <li className="shrink-0 px-2 text-slate-700" aria-hidden="true">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
