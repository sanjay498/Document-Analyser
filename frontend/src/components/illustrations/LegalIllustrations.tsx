import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number;
}

/**
 * Minimalist legal document illustration for empty workspaces or template upload zones.
 */
export const LegalDocEmptyIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Base Document Outline */}
    <rect x="28" y="18" width="64" height="84" rx="4" className="stroke-slate-800" strokeWidth="1.5" fill="#0b0f19" />
    <path d="M72 18V38H92" className="stroke-slate-800" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M72 18L92 38" className="stroke-slate-800" strokeWidth="1.5" strokeLinejoin="round" />

    {/* Elegant Content Lines */}
    <line x1="38" y1="46" x2="68" y2="46" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="38" y1="56" x2="82" y2="56" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="38" y1="64" x2="76" y2="64" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="38" y1="72" x2="82" y2="72" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="38" y1="80" x2="60" y2="80" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />

    {/* Subtle Legal Seal */}
    <circle cx="74" cy="84" r="8" stroke="#d97706" strokeWidth="1.2" strokeDasharray="2 2" fill="#1c1917" fillOpacity="0.4" />
    <path d="M74 81L76 84H72L74 81Z" fill="#f59e0b" />
  </svg>
);

/**
 * Document with active scanning laser / analysis line for intake & processing states.
 */
export const LegalDocScanIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Background Document Shadow */}
    <rect x="36" y="24" width="56" height="74" rx="4" fill="#070a13" className="stroke-slate-800/80" strokeWidth="1.2" />

    {/* Primary Document */}
    <rect x="26" y="16" width="62" height="82" rx="4" fill="#0b0f19" stroke="#334155" strokeWidth="1.5" />
    <path d="M68 16V34H88" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />

    {/* Legal Clauses */}
    <line x1="36" y1="42" x2="60" y2="42" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="36" y1="50" x2="78" y2="50" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="36" y1="58" x2="74" y2="58" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="36" y1="66" x2="78" y2="66" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />

    {/* Scan Ray / Beam */}
    <line x1="20" y1="54" x2="94" y2="54" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="20" y="52" width="74" height="4" fill="url(#scanGlow)" opacity="0.4" />

    <defs>
      <linearGradient id="scanGlow" x1="20" y1="54" x2="94" y2="54" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f59e0b" stopOpacity="0.1" />
        <stop offset="0.5" stopColor="#fbbf24" stopOpacity="0.8" />
        <stop offset="1" stopColor="#f59e0b" stopOpacity="0.1" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Structured document analysis illustration showing extracted nodes / key data rows.
 */
export const LegalDocAnalyzeIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Deed Outline */}
    <rect x="24" y="20" width="52" height="74" rx="4" fill="#0b0f19" stroke="#334155" strokeWidth="1.5" />
    <line x1="32" y1="32" x2="52" y2="32" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="32" y1="42" x2="64" y2="42" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="32" y1="50" x2="60" y2="50" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="32" y1="58" x2="64" y2="58" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />

    {/* Connecting Flow Lines to Extracted Nodes */}
    <path d="M68 46H84" stroke="#d97706" strokeWidth="1.2" strokeDasharray="2 2" />
    <path d="M68 64H84" stroke="#059669" strokeWidth="1.2" strokeDasharray="2 2" />

    {/* Extracted Data Badges */}
    <rect x="80" y="38" width="28" height="16" rx="3" fill="#172554" stroke="#3b82f6" strokeWidth="1" />
    <rect x="80" y="56" width="28" height="16" rx="3" fill="#064e3b" stroke="#10b981" strokeWidth="1" />

    <circle cx="86" cy="46" r="2" fill="#60a5fa" />
    <line x1="91" y1="46" x2="102" y2="46" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round" />

    <circle cx="86" cy="64" r="2" fill="#34d399" />
    <line x1="91" y1="64" x2="102" y2="64" stroke="#6ee7b7" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

/**
 * Verified document seal illustration for completed scrutiny reports.
 */
export const LegalDocVerifyIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Finished Legal Folio */}
    <rect x="28" y="16" width="64" height="84" rx="4" fill="#0b0f19" stroke="#334155" strokeWidth="1.5" />
    <path d="M72 16V36H92" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />

    <line x1="38" y1="44" x2="66" y2="44" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="38" y1="52" x2="80" y2="52" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="38" y1="60" x2="74" y2="60" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />

    {/* Rosette & Ribbon */}
    <circle cx="76" cy="78" r="12" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
    <path d="M72 78L75 81L81 75" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M73 89L76 96L79 89" fill="#065f46" stroke="#047857" strokeWidth="1" />
  </svg>
);

/**
 * Two documents comparison illustration for conflict detection.
 */
export const LegalConflictIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Document A */}
    <rect x="18" y="24" width="42" height="64" rx="3" fill="#0b0f19" stroke="#475569" strokeWidth="1.2" />
    <line x1="25" y1="36" x2="45" y2="36" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="25" y1="44" x2="52" y2="44" stroke="#334155" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="25" y1="52" x2="48" y2="52" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />

    {/* Document B */}
    <rect x="60" y="24" width="42" height="64" rx="3" fill="#0b0f19" stroke="#475569" strokeWidth="1.2" />
    <line x1="67" y1="36" x2="87" y2="36" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="67" y1="44" x2="94" y2="44" stroke="#334155" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="67" y1="52" x2="90" y2="52" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />

    {/* Discrepancy Nexus */}
    <circle cx="60" cy="52" r="7" fill="#1e1b4b" stroke="#f43f5e" strokeWidth="1.5" />
    <path d="M60 48V53" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="60" cy="56" r="0.75" fill="#f43f5e" />
  </svg>
);

/**
 * Clean architectural folder outline for empty template libraries.
 */
export const FolderEmptyIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Tab & Folder Backing */}
    <path d="M22 36C22 33.7909 23.7909 32 26 32H46L54 40H94C96.2091 40 98 41.7909 98 44V84C98 86.2091 96.2091 88 94 88H26C23.7909 88 22 86.2091 22 84V36Z" fill="#0b0f19" stroke="#334155" strokeWidth="1.5" />
    <rect x="30" y="48" width="60" height="34" rx="2" fill="#070a13" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
    <circle cx="60" cy="65" r="8" stroke="#475569" strokeWidth="1.2" fill="none" />
    <line x1="60" y1="61" x2="60" y2="69" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="56" y1="65" x2="64" y2="65" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/**
 * Minimal archive folio for empty history log.
 */
export const HistoryEmptyIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect x="30" y="22" width="60" height="76" rx="4" fill="#0b0f19" stroke="#334155" strokeWidth="1.5" />
    <circle cx="60" cy="54" r="14" stroke="#475569" strokeWidth="1.5" fill="#070a13" />
    <path d="M60 46V54L65 57" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="42" y1="76" x2="78" y2="76" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="48" y1="84" x2="72" y2="84" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
