export interface LoanNatureOption {
  value: string;
  label: string;
  description: string;
  shortDesc: string;
  badgeClass: string;
}

export const LOAN_NATURE_OPTIONS: LoanNatureOption[] = [
  {
    value: 'House Model',
    label: 'House Model',
    description: 'Housing / Residential Property Mortgage & Construction Loan',
    shortDesc: 'Housing / Residential',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    value: 'Agri Model',
    label: 'Agri Model',
    description: 'Agricultural Land & Farming Cultivation Credit Facility',
    shortDesc: 'Agricultural Land',
    badgeClass: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
  },
  {
    value: 'Non Agri Model',
    label: 'Non Agri Model',
    description: 'Commercial, Industrial & Non-Agricultural Real Estate Conveyance',
    shortDesc: 'Commercial / Non-Agri',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  {
    value: 'Agreement Base Model',
    label: 'Agreement Base Model',
    description: 'Agreement Based Loan (Under-Construction / Builder Tripartite)',
    shortDesc: 'Under Construction / Tripartite',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  {
    value: 'Take Over Model',
    label: 'Take Over Model',
    description: 'Takeover of Existing Mortgage Loan from Other Bank / NBFC',
    shortDesc: 'Takeover / Refinance',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    value: 'Already Deposited Model',
    label: 'Already Deposited Model',
    description: 'Equitable Mortgage Extension / Title Deeds Already Deposited with Bank',
    shortDesc: 'Equitable Mortgage Extension',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
];

export const DEFAULT_LOAN_NATURE = 'House Model';

export function getLoanNatureBadgeClass(val?: string): string {
  const match = LOAN_NATURE_OPTIONS.find((o) => o.value.toLowerCase() === (val || '').toLowerCase());
  return match?.badgeClass || 'bg-slate-800 text-slate-300 border-slate-700';
}
