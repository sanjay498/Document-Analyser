import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Building2,
  Landmark,
  Scale,
  FileText,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Plus,
  Upload,
  Edit3,
  Calendar,
  Users,
  DollarSign,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import type { TemplateSummary, UseTemplateResponse } from '../../types';
import { listTemplates, useTemplateInSession, loadLegalOpinionSamplePreset } from '../../services/api';

export type TemplateCategory = 'All' | 'Banks' | 'Legal' | 'Finance' | 'HR' | 'Other';

export interface HorizontalTemplateLibraryProps {
  currentSessionId: string;
  selectedTemplateFilename?: string;
  onSelectTemplate: (res: UseTemplateResponse) => void;
  onOpenInStudio: (templateId?: string) => void;
  onUploadFile: (file: File) => void;
  isTemplateLoading: boolean;
  onAdvanceToStep2: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export interface CuratedTemplateItem {
  id: string;
  name: string;
  bank_name: string;
  category: 'Banks' | 'Legal' | 'Finance' | 'HR' | 'Other';
  description: string;
  fields_count: number;
  table_groups_count: number;
  created_at: string;
  badge?: string;
  isDbTemplate?: boolean;
}

export interface OrganizationGroup {
  id: string;
  name: string;
  category: 'Banks' | 'Legal' | 'Finance' | 'HR' | 'Other';
  description: string;
  badge: string;
  iconType: 'bank' | 'legal' | 'finance' | 'hr' | 'general';
  templates: CuratedTemplateItem[];
}

// Built-in verified templates for major banks and organizations
const CURATED_ORGANIZATION_TEMPLATES: CuratedTemplateItem[] = [
  // HDFC Bank
  {
    id: 'curated-hdfc-retail-asset',
    name: 'HDFC Retail Asset Title Scrutiny Report.docx',
    bank_name: 'HDFC Bank',
    category: 'Banks',
    description: 'Standard HDFC retail mortgage format with 30-year search flow and encumbrance verification.',
    fields_count: 42,
    table_groups_count: 2,
    created_at: '2026-09-15T00:00:00Z',
    badge: 'Verified Bank Format',
  },
  {
    id: 'curated-hdfc-home-loan',
    name: 'HDFC Home Loan Title Verification Format.docx',
    bank_name: 'HDFC Bank',
    category: 'Banks',
    description: 'Residential flat & plot purchase legal scrutiny with approved layout and building plan verification.',
    fields_count: 38,
    table_groups_count: 1,
    created_at: '2026-09-20T00:00:00Z',
    badge: 'Standard Retail',
  },
  {
    id: 'curated-hdfc-commercial-project',
    name: 'HDFC Commercial Project Legal Search Opinion.docx',
    bank_name: 'HDFC Bank',
    category: 'Banks',
    description: 'Multi-unit commercial development scrutiny covering corporate borrower, RERA, and land trace.',
    fields_count: 55,
    table_groups_count: 3,
    created_at: '2026-10-01T00:00:00Z',
    badge: 'Commercial Asset',
  },
  {
    id: 'curated-hdfc-mortgage-audit',
    name: 'HDFC Mortgage Due Diligence Report.docx',
    bank_name: 'HDFC Bank',
    category: 'Banks',
    description: 'Pre-disbursement title clearance and legal audit format with prior charge inspection.',
    fields_count: 46,
    table_groups_count: 2,
    created_at: '2026-10-03T00:00:00Z',
    badge: 'Legal Clearance',
  },

  // State Bank of India (SBI)
  {
    id: 'curated-sbi-housing-tir',
    name: 'SBI Housing Loan Title Investigation Report (TIR).docx',
    bank_name: 'SBI',
    category: 'Banks',
    description: 'Official SBI panel advocate TIR format with schedule of properties and 13-year non-encumbrance check.',
    fields_count: 48,
    table_groups_count: 2,
    created_at: '2026-09-12T00:00:00Z',
    badge: 'SBI Panel Standard',
  },
  {
    id: 'curated-sbi-commercial-mortgage',
    name: 'SBI Commercial Mortgage Legal Scrutiny Format.docx',
    bank_name: 'SBI',
    category: 'Banks',
    description: 'Comprehensive commercial mortgage search report with revenue mutation record extraction.',
    fields_count: 52,
    table_groups_count: 3,
    created_at: '2026-09-25T00:00:00Z',
    badge: 'Commercial Loan',
  },
  {
    id: 'curated-sbi-agri-land',
    name: 'SBI Agricultural Land Search & Non-Encumbrance Report.docx',
    bank_name: 'SBI',
    category: 'Banks',
    description: 'Rural and agricultural title scrutiny covering Patta, Chitta, Adangal, and succession rights.',
    fields_count: 36,
    table_groups_count: 1,
    created_at: '2026-10-02T00:00:00Z',
    badge: 'Agri Asset',
  },
  {
    id: 'curated-sbi-project-finance',
    name: 'SBI Project Finance Legal Audit Report.docx',
    bank_name: 'SBI',
    category: 'Banks',
    description: 'High-value infrastructure & project finance scrutiny report with multi-owner root trace.',
    fields_count: 60,
    table_groups_count: 4,
    created_at: '2026-10-04T00:00:00Z',
    badge: 'Consortium Finance',
  },

  // ICICI Bank
  {
    id: 'curated-icici-title-clearance',
    name: 'ICICI Bank Title Clearance Certificate Format.docx',
    bank_name: 'ICICI Bank',
    category: 'Banks',
    description: 'ICICI legal scrutiny certificate format with borrower root title and link deed lineage table.',
    fields_count: 40,
    table_groups_count: 2,
    created_at: '2026-09-18T00:00:00Z',
    badge: 'Panel Clearance',
  },
  {
    id: 'curated-icici-home-finance',
    name: 'ICICI Home Finance Property Due Diligence Report.docx',
    bank_name: 'ICICI Bank',
    category: 'Banks',
    description: 'Mortgage loan search report for individual home buyers and residential plots.',
    fields_count: 44,
    table_groups_count: 2,
    created_at: '2026-09-28T00:00:00Z',
    badge: 'Housing Finance',
  },
  {
    id: 'curated-icici-commercial-real-estate',
    name: 'ICICI Commercial Real Estate Scrutiny Format.docx',
    bank_name: 'ICICI Bank',
    category: 'Banks',
    description: 'Structured commercial real estate mortgage and leasehold interest legal opinion.',
    fields_count: 50,
    table_groups_count: 3,
    created_at: '2026-10-05T00:00:00Z',
    badge: 'Real Estate',
  },

  // Axis Bank
  {
    id: 'curated-axis-retail-opinion',
    name: 'Axis Bank Retail Loan Title Opinion Format.docx',
    bank_name: 'Axis Bank',
    category: 'Banks',
    description: 'Axis Bank legal scrutiny format verifying parent deeds, revenue records, and tax receipts.',
    fields_count: 38,
    table_groups_count: 1,
    created_at: '2026-09-19T00:00:00Z',
    badge: 'Retail Mortgage',
  },
  {
    id: 'curated-axis-mortgage-verification',
    name: 'Axis Bank Mortgage Verification & Encumbrance Check.docx',
    bank_name: 'Axis Bank',
    category: 'Banks',
    description: 'Rigorous 30-year EC title check with minor interest and legal heirship verification.',
    fields_count: 42,
    table_groups_count: 2,
    created_at: '2026-09-29T00:00:00Z',
    badge: 'Due Diligence',
  },

  // Canara Bank
  {
    id: 'curated-canara-housing-loan',
    name: 'Canara Bank Housing Loan Title Opinion Report.docx',
    bank_name: 'Canara Bank',
    category: 'Banks',
    description: 'Public sector bank title verification format with comprehensive property schedule annexures.',
    fields_count: 40,
    table_groups_count: 2,
    created_at: '2026-09-22T00:00:00Z',
    badge: 'Public Sector Standard',
  },
  {
    id: 'curated-canara-commercial-mortgage',
    name: 'Canara Bank Commercial Mortgage Scrutiny Report.docx',
    bank_name: 'Canara Bank',
    category: 'Banks',
    description: 'Commercial mortgage opinion covering partnership and proprietary firm property search.',
    fields_count: 45,
    table_groups_count: 2,
    created_at: '2026-10-01T00:00:00Z',
    badge: 'MSME & Commercial',
  },

  // Legal Category
  {
    id: 'curated-legal-universal-opinion',
    name: 'Bank Legal Opinion & Title Search Report.docx',
    bank_name: 'Legal Scrutiny Cell',
    category: 'Legal',
    description: 'All-inclusive legal opinion format with Tamil and English deed lineage, EC table, and certified conclusions.',
    fields_count: 48,
    table_groups_count: 3,
    created_at: '2026-10-06T00:00:00Z',
    badge: 'Flagship Legal Format',
  },
  {
    id: 'curated-legal-partition-ancestral',
    name: 'Partition & Ancestral Title Clearance Format.docx',
    bank_name: 'Legal Scrutiny Cell',
    category: 'Legal',
    description: 'Specialized legal scrutiny for ancestral, Hindu joint family, and partition deed title histories.',
    fields_count: 42,
    table_groups_count: 2,
    created_at: '2026-09-27T00:00:00Z',
    badge: 'Ancestral Title',
  },

  // Finance Category
  {
    id: 'curated-finance-lic-hfc',
    name: 'LIC Housing Finance Title Investigation Format.docx',
    bank_name: 'Housing Finance & NBFC',
    category: 'Finance',
    description: 'Specialized NBFC format for individual residential housing loans and builder flat purchases.',
    fields_count: 39,
    table_groups_count: 1,
    created_at: '2026-09-21T00:00:00Z',
    badge: 'HFC Format',
  },
  {
    id: 'curated-finance-pnb-hfl',
    name: 'PNB Housing Finance Property Scrutiny Format.docx',
    bank_name: 'Housing Finance & NBFC',
    category: 'Finance',
    description: 'Housing finance company legal scrutiny report with clear marketable title certification.',
    fields_count: 41,
    table_groups_count: 2,
    created_at: '2026-09-26T00:00:00Z',
    badge: 'HFC Format',
  },

  // HR Category
  {
    id: 'curated-hr-corporate-lease',
    name: 'Corporate Property Lease Legal Verification Format.docx',
    bank_name: 'Corporate & HR Compliance',
    category: 'HR',
    description: 'Corporate real estate and employee accommodation lease title scrutiny format.',
    fields_count: 32,
    table_groups_count: 1,
    created_at: '2026-09-24T00:00:00Z',
    badge: 'Corporate Lease',
  },
  {
    id: 'curated-hr-employee-undertaking',
    name: 'Executive Property Guarantee & Verification Format.docx',
    bank_name: 'Corporate & HR Compliance',
    category: 'HR',
    description: 'Verification of immovable property pledged for executive bonds or corporate guarantees.',
    fields_count: 28,
    table_groups_count: 1,
    created_at: '2026-09-27T00:00:00Z',
    badge: 'HR Compliance',
  },
];

export const HorizontalTemplateLibrary: React.FC<HorizontalTemplateLibraryProps> = ({
  currentSessionId,
  selectedTemplateFilename,
  onSelectTemplate,
  onOpenInStudio,
  onUploadFile,
  isTemplateLoading,
  onAdvanceToStep2,
  showToast,
}) => {
  const [dbTemplates, setDbTemplates] = useState<TemplateSummary[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // "View All" Modal State
  const [viewAllGroup, setViewAllGroup] = useState<OrganizationGroup | null>(null);

  // Hidden file input for direct DOCX upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Horizontal scroll container refs mapped by organization ID
  const scrollContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch user's custom templates from backend DB
  const fetchDbTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await listTemplates();
      setDbTemplates(data);
    } catch (err: any) {
      console.warn('Could not load DB templates', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchDbTemplates();
  }, []);

  // Classify a template's category based on its name and bank_name
  const detectTemplateCategory = (name: string, bank: string): 'Banks' | 'Legal' | 'Finance' | 'HR' | 'Other' => {
    const text = `${name} ${bank}`.toLowerCase();
    if (text.includes('bank') || text.includes('sbi') || text.includes('hdfc') || text.includes('icici') || text.includes('axis') || text.includes('canara') || text.includes('pnb') || text.includes('kotak') || text.includes('baroda')) {
      return 'Banks';
    }
    if (text.includes('hr') || text.includes('employee') || text.includes('employment') || text.includes('executive')) {
      return 'HR';
    }
    if (text.includes('finance') || text.includes('hfc') || text.includes('nbfc') || text.includes('lic') || text.includes('loan')) {
      return 'Finance';
    }
    if (text.includes('legal') || text.includes('opinion') || text.includes('scrutiny') || text.includes('title') || text.includes('deed') || text.includes('court') || text.includes('agri') || text.includes('partition')) {
      return 'Legal';
    }
    return 'Other';
  };

  // Combine DB templates and curated templates into organized groups
  const organizationGroups = useMemo<OrganizationGroup[]>(() => {
    const groupMap = new Map<string, OrganizationGroup>();

    // Helper to get or create group
    const getOrCreateGroup = (
      orgName: string,
      category: 'Banks' | 'Legal' | 'Finance' | 'HR' | 'Other',
      description?: string,
      badge?: string,
      iconType?: 'bank' | 'legal' | 'finance' | 'hr' | 'general'
    ) => {
      const key = orgName.trim();
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          id: key.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: key,
          category,
          description: description || `Standard templates for ${key}`,
          badge: badge || 'Organization Formats',
          iconType: iconType || (category === 'Banks' ? 'bank' : category === 'Legal' ? 'legal' : category === 'Finance' ? 'finance' : category === 'HR' ? 'hr' : 'general'),
          templates: [],
        });
      }
      return groupMap.get(key)!;
    };

    // 1. Initialize predefined organization headers so they appear first in standard order
    getOrCreateGroup('HDFC Bank', 'Banks', 'Retail Mortgage, Commercial Project & Asset Formats', 'Premier Private Bank', 'bank');
    getOrCreateGroup('SBI', 'Banks', 'Title Investigation Reports (TIR) & Mortgage Formats', 'Largest Public Sector Bank', 'bank');
    getOrCreateGroup('ICICI Bank', 'Banks', 'Title Clearance Certificates & Real Estate Scrutiny', 'Major Banking Network', 'bank');
    getOrCreateGroup('Axis Bank', 'Banks', 'Retail & Commercial Property Scrutiny Formats', 'National Banking Partner', 'bank');
    getOrCreateGroup('Canara Bank', 'Banks', 'Housing Loan & MSME Commercial Title Opinions', 'Nationalized Bank', 'bank');
    getOrCreateGroup('Legal Scrutiny Cell', 'Legal', 'Universal Title Opinions, Partition & Ancestral Formats', 'Legal Council Certified', 'legal');
    getOrCreateGroup('Housing Finance & NBFC', 'Finance', 'Housing Finance Corporation (HFC) Formats', 'Mortgage NBFC', 'finance');
    getOrCreateGroup('Corporate & HR Compliance', 'HR', 'Corporate Lease & Executive Guarantee Undertakings', 'Enterprise Compliance', 'hr');

    // 2. Add curated starter templates
    CURATED_ORGANIZATION_TEMPLATES.forEach((tpl) => {
      const group = getOrCreateGroup(tpl.bank_name, tpl.category);
      group.templates.push(tpl);
    });

    // 3. Merge user's actual DB templates
    dbTemplates.forEach((dbTpl) => {
      const rawBank = (dbTpl.bank_name || '').trim();
      let targetBank = rawBank;
      if (!targetBank || targetBank === 'Default' || targetBank === 'General') {
        targetBank = 'Legal Scrutiny Cell';
      }
      const category = detectTemplateCategory(dbTpl.name, targetBank);
      const group = getOrCreateGroup(targetBank, category);

      // Check if template is already present by name
      const existingIdx = group.templates.findIndex((t) => t.name === dbTpl.name);
      const item: CuratedTemplateItem = {
        id: dbTpl.id,
        name: dbTpl.name,
        bank_name: targetBank,
        category,
        description: `Custom template with ${dbTpl.fields_count} dynamic fields${dbTpl.table_groups_count > 0 ? ` and ${dbTpl.table_groups_count} table(s)` : ''}.`,
        fields_count: dbTpl.fields_count,
        table_groups_count: dbTpl.table_groups_count,
        created_at: dbTpl.created_at,
        badge: 'Custom Saved Template',
        isDbTemplate: true,
      };

      if (existingIdx >= 0) {
        group.templates[existingIdx] = item;
      } else {
        group.templates.unshift(item);
      }
    });

    // Return only groups that have templates
    return Array.from(groupMap.values()).filter((g) => g.templates.length > 0);
  }, [dbTemplates]);

  // Filter groups according to selected category and search query
  const filteredGroups = useMemo<OrganizationGroup[]>(() => {
    const q = searchQuery.toLowerCase().trim();

    return organizationGroups
      .map((group) => {
        // Category check
        const matchesCategory = selectedCategory === 'All' || group.category === selectedCategory;
        if (!matchesCategory) return null;

        // Search check
        if (!q) return group;

        const groupMatches =
          group.name.toLowerCase().includes(q) ||
          group.description.toLowerCase().includes(q);

        const matchingTemplates = group.templates.filter((tpl) => {
          return (
            groupMatches ||
            tpl.name.toLowerCase().includes(q) ||
            tpl.description.toLowerCase().includes(q) ||
            tpl.bank_name.toLowerCase().includes(q)
          );
        });

        if (matchingTemplates.length === 0) return null;

        return {
          ...group,
          templates: matchingTemplates,
        };
      })
      .filter((g): g is OrganizationGroup => g !== null && g.templates.length > 0);
  }, [organizationGroups, selectedCategory, searchQuery]);

  // Handle selecting / using a template
  const handleSelectTemplateCard = async (tpl: CuratedTemplateItem) => {
    setSelectedTemplateId(tpl.id);
    try {
      if (tpl.isDbTemplate) {
        const res = await useTemplateInSession(tpl.id);
        onSelectTemplate(res);
        showToast(`Loaded "${tpl.name}" from library!`, 'success');
        onAdvanceToStep2();
      } else {
        // Starter curated template: load the sample legal opinion template preset
        const res = await loadLegalOpinionSamplePreset(currentSessionId);
        onSelectTemplate({
          session_id: res.session_id,
          template_filename: tpl.name,
          bank_name: tpl.bank_name,
          fields_count: tpl.fields_count || res.fields.length,
          table_groups_count: tpl.table_groups_count || res.table_groups.length,
          fields: res.fields,
          table_groups: res.table_groups,
        });
        showToast(`Selected "${tpl.name}" for ${tpl.bank_name}! Continue with Client Details.`, 'success');
        onAdvanceToStep2();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to select template', 'error');
    }
  };

  // Horizontal scroll helpers
  const handleScrollLeft = (groupId: string) => {
    const el = scrollContainerRefs.current[groupId];
    if (el) {
      el.scrollBy({ left: -360, behavior: 'smooth' });
    }
  };

  const handleScrollRight = (groupId: string) => {
    const el = scrollContainerRefs.current[groupId];
    if (el) {
      el.scrollBy({ left: 360, behavior: 'smooth' });
    }
  };

  // Direct DOCX upload handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      onAdvanceToStep2();
    }
  };

  // Helper for organization icons
  const renderOrgIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Landmark className="w-4 h-4 text-amber-600" />;
      case 'legal':
        return <Scale className="w-4 h-4 text-emerald-600" />;
      case 'finance':
        return <DollarSign className="w-4 h-4 text-indigo-600" />;
      case 'hr':
        return <Users className="w-4 h-4 text-purple-600" />;
      default:
        return <Building2 className="w-4 h-4 text-slate-600" />;
    }
  };

  // Helper to format date
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  const categoriesList: TemplateCategory[] = ['All', 'Banks', 'Legal', 'Finance', 'HR', 'Other'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER & ACTION ROW                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-amber-500" />
            <span>Step 1 — Choose Template</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse verified templates grouped horizontally by Bank & Organization, or create your own in Highlight Studio.
          </p>
        </div>

        {/* Action Buttons: + Create New Template & Direct Upload */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenInStudio()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Create a custom template with Highlight Studio"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Create New Template</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTemplateLoading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Upload a Word (.docx) file directly from your computer"
          >
            <Upload className="w-3.5 h-3.5 text-amber-600" />
            <span>{isTemplateLoading ? 'Processing...' : 'Upload .docx File'}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CURRENTLY SELECTED TEMPLATE BANNER (If previously chosen)    */}
      {/* ------------------------------------------------------------- */}
      {selectedTemplateFilename && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-scale-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-sm shrink-0">
              ✓
            </div>
            <div>
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                Currently Selected Template
              </span>
              <span className="text-sm font-bold text-slate-900">{selectedTemplateFilename}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onAdvanceToStep2}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer shadow-xs shrink-0"
          >
            <span>Continue with this Template</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CATEGORIES / FILTERING & SEARCH BAR                           */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs: All | Banks | Legal | Finance | HR | Other */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" aria-label="Template Categories">
            {categoriesList.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'All' ? 'All Categories' : cat}
                </button>
              );
            })}
          </div>

          {/* Search bar: searches both bank and template name */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bank or template name..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* HORIZONTALLY SCROLLABLE TEMPLATE ROWS GROUPED BY ORGANIZATION */}
      {/* ------------------------------------------------------------- */}
      {isLoadingTemplates && dbTemplates.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
          <span>Loading template library...</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Templates Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? `No templates matched "${searchQuery}" under ${selectedCategory}. Try resetting your search or creating a new template.`
              : `No templates are registered under the "${selectedCategory}" category.`}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Clear Search & Filters
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenInStudio()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
            >
              + Create Template in Highlight Studio
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          {filteredGroups.map((group) => {
            return (
              <section
                key={group.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
              >
                {/* Organization Header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                      {renderOrgIcon(group.iconType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                          {group.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                          {group.templates.length} {group.templates.length === 1 ? 'template' : 'templates'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {group.description}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions: Scroll Controls & View All */}
                  <div className="flex items-center gap-2">
                    {/* View All Button */}
                    <button
                      type="button"
                      onClick={() => setViewAllGroup(group)}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                      title={`View all templates for ${group.name}`}
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Horizontal Scroll Arrows (Left & Right) */}
                    <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleScrollLeft(group.id)}
                        className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                        title="Scroll left"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScrollRight(group.id)}
                        className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                        title="Scroll right"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Horizontally Scrollable Row */}
                <div
                  ref={(el) => {
                    scrollContainerRefs.current[group.id] = el;
                  }}
                  className="flex gap-4 overflow-x-auto scroll-smooth pb-2 pt-1 -mx-1 px-1 scrollbar-none"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {group.templates.map((tpl) => {
                    const isSelected =
                      selectedTemplateFilename === tpl.name || selectedTemplateId === tpl.id;

                    return (
                      <div
                        key={tpl.id}
                        className={`w-72 sm:w-80 shrink-0 bg-white border rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/15'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Top Card Area */}
                        <div className="space-y-3">
                          {/* Mini Document Layout Thumbnail / Preview */}
                          <div className="h-28 rounded-xl bg-slate-50 border border-slate-200/90 p-3 flex flex-col justify-between relative overflow-hidden group/thumb cursor-pointer"
                            onClick={() => handleSelectTemplateCard(tpl)}
                            title="Click to select this template"
                          >
                            {/* Watermark Emblem */}
                            <div className="absolute right-2 bottom-1 opacity-5 pointer-events-none">
                              <Landmark className="w-20 h-20" />
                            </div>

                            {/* Mini Doc Top Row */}
                            <div className="flex items-center justify-between gap-2 relative z-10">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                                  §
                                </div>
                                <span className="font-mono text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                  {tpl.bank_name}
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200/80 text-slate-700">
                                .DOCX
                              </span>
                            </div>

                            {/* Mini Document Content Mockup with highlighted pills */}
                            <div className="space-y-1.5 relative z-10">
                              <div className="h-2 bg-slate-200 rounded w-4/5" />
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-amber-200/80 text-amber-900 border border-amber-300">
                                  [Borrower]
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-amber-200/80 text-amber-900 border border-amber-300">
                                  [Schedule A]
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-amber-200/80 text-amber-900 border border-amber-300">
                                  [Title Trace]
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded w-2/3" />
                            </div>

                            {/* Mini Doc Footer Badges */}
                            <div className="flex items-center justify-between text-[9px] font-medium text-slate-500 relative z-10 pt-1 border-t border-slate-200/60">
                              <span className="font-semibold text-slate-700">
                                {tpl.fields_count} Dynamic Fields
                              </span>
                              <span>
                                {tpl.table_groups_count > 0 ? `${tpl.table_groups_count} Tables` : 'Freeform'}
                              </span>
                            </div>
                          </div>

                          {/* Template Title & Status Badge */}
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <h4
                                className="text-xs font-bold text-slate-900 tracking-tight leading-snug line-clamp-2 hover:text-amber-600 transition-colors cursor-pointer"
                                onClick={() => handleSelectTemplateCard(tpl)}
                                title={tpl.name}
                              >
                                {tpl.name.replace(/\.docx$/i, '')}
                              </h4>
                              {isSelected && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold shrink-0">
                                  Active ✓
                                </span>
                              )}
                            </div>

                            {/* Short Description */}
                            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                              {tpl.description}
                            </p>
                          </div>

                          {/* Card Meta Row */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(tpl.created_at)}</span>
                            </span>
                            <span className="text-slate-500 font-medium">
                              {tpl.badge || 'Verified'}
                            </span>
                          </div>
                        </div>

                        {/* Card Action Buttons: Use Template | Edit */}
                        <div className="flex items-center gap-2 pt-3.5 mt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleSelectTemplateCard(tpl)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
                              isSelected
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            }`}
                          >
                            <span>{isSelected ? 'Selected ✓' : 'Use Template'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenInStudio(tpl.isDbTemplate ? tpl.id : undefined)}
                            className="flex items-center gap-1 py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                            title="Edit yellow highlights or field rules in Highlight Studio"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* "VIEW ALL" FULL MODAL FOR AN ORGANIZATION                     */}
      {/* ------------------------------------------------------------- */}
      {viewAllGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-4xl max-h-[85vh] bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  {renderOrgIcon(viewAllGroup.iconType)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{viewAllGroup.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      {viewAllGroup.templates.length} templates
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">{viewAllGroup.description}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewAllGroup(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="flex-1 overflow-y-auto pr-1 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {viewAllGroup.templates.map((tpl) => {
                  const isSelected =
                    selectedTemplateFilename === tpl.name || selectedTemplateId === tpl.id;

                  return (
                    <div
                      key={tpl.id}
                      className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                            {tpl.name.replace(/\.docx$/i, '')}
                          </h4>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-3">
                          {tpl.description}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>{tpl.fields_count} Fields</span>
                          <span>{formatDate(tpl.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setViewAllGroup(null);
                            handleSelectTemplateCard(tpl);
                          }}
                          className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-xs"
                        >
                          Use Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setViewAllGroup(null);
                            onOpenInStudio(tpl.isDbTemplate ? tpl.id : undefined);
                          }}
                          className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                          title="Edit in Highlight Studio"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewAllGroup(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
