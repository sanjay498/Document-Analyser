/**
 * Doc Filler AI - Frontend Smart Naming Utilities
 * Intelligent auto-naming and sanitization for templates and generated documents.
 */

import type { FieldExtractionResult, HighlightedField } from '../types';

export const BANK_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\b(?:State\s+Bank\s+of\s+India|SBI)\b/i, name: 'SBI' },
  { pattern: /\bCanara\s+Bank\b/i, name: 'Canara Bank' },
  { pattern: /\bIndian\s+Bank\b/i, name: 'Indian Bank' },
  { pattern: /\b(?:Bank\s+of\s+Baroda|BOB)\b/i, name: 'Bank of Baroda' },
  { pattern: /\b(?:Union\s+Bank\s+of\s+India|Union\s+Bank|UBI)\b/i, name: 'Union Bank' },
  { pattern: /\b(?:Punjab\s+National\s+Bank|PNB)\b/i, name: 'Punjab National Bank' },
  { pattern: /\bHDFC(?:\s+Bank)?\b/i, name: 'HDFC Bank' },
  { pattern: /\bICICI(?:\s+Bank)?\b/i, name: 'ICICI Bank' },
  { pattern: /\bAxis(?:\s+Bank)?\b/i, name: 'Axis Bank' },
  { pattern: /\b(?:Karur\s+Vysya\s+Bank|Karur\s+Vysya|KVB)\b/i, name: 'Karur Vysya Bank' },
  { pattern: /\b(?:Kotak\s+Mahindra\s+Bank|Kotak)\b/i, name: 'Kotak Mahindra Bank' },
  { pattern: /\bFederal\s+Bank\b/i, name: 'Federal Bank' },
  { pattern: /\bCentral\s+Bank\s+of\s+India\b/i, name: 'Central Bank of India' },
  { pattern: /\b(?:Indian\s+Overseas\s+Bank|IOB)\b/i, name: 'Indian Overseas Bank' },
  { pattern: /\bBank\s+of\s+India\b/i, name: 'Bank of India' },
  { pattern: /\b(?:City\s+Union\s+Bank|CUB)\b/i, name: 'City Union Bank' },
  { pattern: /\b(?:Tamilnad\s+Mercantile\s+Bank|TMB)\b/i, name: 'Tamilnad Mercantile Bank' },
  { pattern: /\bIDBI(?:\s+Bank)?\b/i, name: 'IDBI Bank' },
];

export const DOC_TYPE_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\b(?:Title\s+Scrutiny\s+Report|Title\s+Investigation\s+Report|TSR)\b/i, name: 'Title Scrutiny Report' },
  { pattern: /\b(?:Legal\s+Opinion|Legal\s+Scrutiny\s+Report|Title\s+Opinion)\b/i, name: 'Legal Opinion' },
  { pattern: /\b(?:Search\s+Report|Title\s+Search\s+Report)\b/i, name: 'Search Report' },
  { pattern: /\b(?:Non-?Encumbrance\s+Certificate|Encumbrance\s+Certificate|NEC)\b/i, name: 'Non-Encumbrance Certificate' },
  { pattern: /\bMortgage\s+Deed\b/i, name: 'Mortgage Deed' },
  { pattern: /\bSale\s+Deed\b/i, name: 'Sale Deed' },
  { pattern: /\bLoan\s+Agreement\b/i, name: 'Loan Agreement' },
];

export function sanitizeFilename(name: string, defaultExt: string = '.docx'): string {
  if (!name || !name.trim()) return `document${defaultExt}`;
  
  // Extract basename if path slashes exist
  let clean = name.replace(/\\/g, '/').split('/').pop()?.trim() || '';

  // Extract extension if present
  let ext = '';
  const lower = clean.toLowerCase();
  for (const validExt of ['.docx', '.pdf', '.pptx', '.txt']) {
    if (lower.endsWith(validExt)) {
      ext = validExt;
      clean = clean.slice(0, -validExt.length);
      break;
    }
  }

  if (!ext) {
    ext = defaultExt;
  }
  
  // Remove illegal characters: < > : " / \ | ? * and control chars
  clean = clean.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  
  // Collapse whitespace and underscores
  clean = clean.replace(/[_\s]+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  
  if (!clean) clean = 'document';
  
  return `${clean}${ext}`;
}

export function cleanPartyForFilename(party: string): string {
  if (!party || !party.trim()) return '';
  
  // Take first part if parentage / spouse info is included
  let p = party.split(/[,;]|\b(?:S\/o|D\/o|W\/o|Son\s+of|Daughter\s+of|Wife\s+of)\b/i)[0];
  
  // Strip honorifics
  p = p.replace(/^(?:Mr|Mrs|Ms|Dr|Thiru|Tmt|Shri|Smt)\.?\s+/i, '').trim();
  
  // Remove dots and non-alphanumeric except spaces and hyphens
  p = p.replace(/[^a-zA-Z0-9\s\-]/g, '');
  
  // Normalize spaces to underscores
  p = p.replace(/[\s\-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  
  return p.slice(0, 50);
}

export function detectBankAndDocType(
  text: string,
  filename: string = ''
): { bank: string; docType: string } {
  const combined = `${filename} ${text.slice(0, 3000)}`;
  const searchStr = combined.replace(/_/g, ' ');
  
  let detectedBank = '';
  for (const { pattern, name } of BANK_PATTERNS) {
    if (pattern.test(searchStr)) {
      detectedBank = name;
      break;
    }
  }
  
  let detectedDocType = 'Legal Opinion';
  for (const { pattern, name } of DOC_TYPE_PATTERNS) {
    if (pattern.test(searchStr)) {
      detectedDocType = name;
      break;
    }
  }
  
  return { bank: detectedBank, docType: detectedDocType };
}

export function generateSmartTemplateName(params: {
  templateFilename?: string;
  fields?: HighlightedField[];
  bankName?: string;
}): string {
  const { templateFilename = '', fields = [], bankName = '' } = params;
  const sampleText = fields.slice(0, 10).map((f) => f.paragraph_context).join(' ');
  const detected = detectBankAndDocType(sampleText, templateFilename);
  
  const bank = bankName && bankName !== 'General' ? bankName : detected.bank;
  const docType = detected.docType || 'Legal Opinion';
  
  const name = bank ? `${bank} ${docType} Template.docx` : `${docType} Template.docx`;
  return sanitizeFilename(name);
}

export function generateSmartDocName(params: {
  templateFilename?: string;
  results?: FieldExtractionResult[];
  fields?: HighlightedField[];
  bankName?: string;
  resolvedValues?: Record<string, string>;
}): string {
  const {
    templateFilename = '',
    results = [],
    fields = [],
    bankName = '',
    resolvedValues = {},
  } = params;
  
  // 1. Detect borrower / client name from results, fields, and resolved values
  let borrower = '';
  const borrowerKeywords = ['borrower', 'applicant', 'purchaser', 'client', 'title holder', 'owner', 'mortgagor', 'buyer'];
  
  for (const r of results) {
    const val = resolvedValues[r.field_id] !== undefined ? resolvedValues[r.field_id] : r.value;
    if (!val || !val.trim()) continue;
    
    const orig = (r.original_text || '').toLowerCase();
    const fid = (r.field_id || '').toLowerCase();
    
    // Check matching field
    const matchedField = fields.find((f) => f.field_id === r.field_id);
    const pContext = (matchedField?.paragraph_context || '').toLowerCase();
    
    if (borrowerKeywords.some((k) => orig.includes(k) || fid.includes(k) || pContext.includes(k))) {
      // Ensure value is a person/entity name, not a huge sentence
      if (val.trim().length <= 60 && !val.includes('\n')) {
        borrower = val.trim();
        break;
      }
    }
  }
  
  // 2. Detect bank and document type
  const sampleText = fields.slice(0, 10).map((f) => f.paragraph_context).join(' ');
  const detected = detectBankAndDocType(sampleText, templateFilename);
  const bank = bankName && bankName !== 'General' ? bankName : detected.bank;
  
  // Normalize bank for filename (e.g. 'Canara Bank' -> 'Canara_Bank', 'State Bank of India' -> 'SBI')
  let bankToken = '';
  if (bank) {
    if (/state\s+bank\s+of\s+india|sbi/i.test(bank)) {
      bankToken = 'SBI';
    } else {
      bankToken = bank.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    }
  }
  
  const docTypeToken = (detected.docType || 'Legal_Opinion').replace(/[\s\-]+/g, '_');
  const cleanBorrower = cleanPartyForFilename(borrower);
  
  if (cleanBorrower) {
    if (bankToken) {
      return sanitizeFilename(`${bankToken}_${docTypeToken}_${cleanBorrower}.docx`);
    }
    return sanitizeFilename(`${docTypeToken}_${cleanBorrower}.docx`);
  }
  
  // If no borrower found yet, strip generic and template author artifacts (like 'muthulakshmi', 'template', 'completed')
  let base = templateFilename.replace(/\.[^/.]+$/, '');
  base = base.replace(/\b(?:template|completed|_completed|draft|copy|\(1\)|\(2\)|muthulakshmi)\b/gi, '');
  base = base.replace(/[_\s]+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  
  if (base && base.length >= 3) {
    return sanitizeFilename(`${base}_completed.docx`);
  }
  if (bankToken) {
    return sanitizeFilename(`${bankToken}_${docTypeToken}.docx`);
  }
  return sanitizeFilename(`${docTypeToken}.docx`);
}
