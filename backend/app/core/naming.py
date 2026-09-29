"""
Doc Filler AI - Smart Naming Module
Provides intelligent auto-naming for templates and generated legal documents
based on detected bank, document type, and borrower/client names.
"""

import re
from typing import Tuple, Optional, List, Dict, Any

# Standard recognized banks and their normalized labels
BANK_PATTERNS = [
    (r"\b(?:State\s+Bank\s+of\s+India|SBI)\b", "SBI"),
    (r"\bCanara\s+Bank\b", "Canara Bank"),
    (r"\bIndian\s+Bank\b", "Indian Bank"),
    (r"\b(?:Bank\s+of\s+Baroda|BOB)\b", "Bank of Baroda"),
    (r"\b(?:Union\s+Bank\s+of\s+India|Union\s+Bank|UBI)\b", "Union Bank"),
    (r"\b(?:Punjab\s+National\s+Bank|PNB)\b", "Punjab National Bank"),
    (r"\bHDFC(?:\s+Bank)?\b", "HDFC Bank"),
    (r"\bICICI(?:\s+Bank)?\b", "ICICI Bank"),
    (r"\bAxis(?:\s+Bank)?\b", "Axis Bank"),
    (r"\b(?:Karur\s+Vysya\s+Bank|Karur\s+Vysya|KVB)\b", "Karur Vysya Bank"),
    (r"\b(?:Kotak\s+Mahindra\s+Bank|Kotak)\b", "Kotak Mahindra Bank"),
    (r"\bFederal\s+Bank\b", "Federal Bank"),
    (r"\bCentral\s+Bank\s+of\s+India\b", "Central Bank of India"),
    (r"\b(?:Indian\s+Overseas\s+Bank|IOB)\b", "Indian Overseas Bank"),
    (r"\bBank\s+of\s+India\b", "Bank of India"),
    (r"\b(?:City\s+Union\s+Bank|CUB)\b", "City Union Bank"),
    (r"\b(?:Tamilnad\s+Mercantile\s+Bank|TMB)\b", "Tamilnad Mercantile Bank"),
    (r"\bIDBI(?:\s+Bank)?\b", "IDBI Bank"),
]

# Document types and their normalized labels
DOC_TYPE_PATTERNS = [
    (r"\b(?:Title\s+Scrutiny\s+Report|Title\s+Investigation\s+Report|TSR)\b", "Title Scrutiny Report"),
    (r"\b(?:Legal\s+Opinion|Legal\s+Scrutiny\s+Report|Title\s+Opinion)\b", "Legal Opinion"),
    (r"\b(?:Search\s+Report|Title\s+Search\s+Report)\b", "Search Report"),
    (r"\b(?:Non-?Encumbrance\s+Certificate|Encumbrance\s+Certificate|NEC)\b", "Non-Encumbrance Certificate"),
    (r"\bMortgage\s+Deed\b", "Mortgage Deed"),
    (r"\bSale\s+Deed\b", "Sale Deed"),
    (r"\bLoan\s+Agreement\b", "Loan Agreement"),
]


def clean_filename(name: str, default_ext: str = ".docx") -> str:
    """
    Sanitizes a filename by stripping invalid filesystem characters, path traversal,
    and ensuring a valid extension.
    """
    if not name:
        return f"document{default_ext}"
    
    # Remove path slashes and traversal
    name = name.replace("\\", "/").split("/")[-1].strip()

    # Extract extension if present
    ext = ""
    lower = name.lower()
    for valid_ext in [".docx", ".pdf", ".pptx", ".txt"]:
        if lower.endswith(valid_ext):
            ext = valid_ext
            name = name[:-len(valid_ext)]
            break

    if not ext:
        ext = default_ext
    
    # Remove invalid filesystem characters: < > : " / \ | ? * and control chars
    name = re.sub(r'[\<\>\:\"\/\\\|\?\*\x00-\x1f]', '_', name)
    
    # Collapse multiple underscores/spaces and strip leading/trailing separators
    name = re.sub(r'[_\s]+', '_', name).strip('._')
    
    if not name:
        name = "document"
        
    return f"{name}{ext}"


def clean_party_for_filename(party: str) -> str:
    """
    Cleans party/borrower name for safe and readable inclusion in filenames.
    e.g. 'Mr. Suresh Kumar, S/o Raman' -> 'Suresh_Kumar'
    """
    if not party:
        return ""
    
    # Take first part if parentage / spouse info is included
    p = re.split(r'[,;]|\b(?:S\/o|D\/o|W\/o|Son\s+of|Daughter\s+of|Wife\s+of)\b', party, flags=re.IGNORECASE)[0]
    
    # Strip honorifics
    p = re.sub(r'^(?:Mr|Mrs|Ms|Dr|Thiru|Tmt|Shri|Smt)\.?\s+', '', p.strip(), flags=re.IGNORECASE)
    
    # Remove dots and non-alphanumeric except spaces and hyphens
    p = re.sub(r'[^a-zA-Z0-9\s\-]', '', p)
    
    # Normalize spaces and hyphens to underscores
    p = re.sub(r'[\s\-]+', '_', p).strip('._')
    
    return p[:50]  # Cap length for safety


def detect_bank_and_doc_type(text: str, filename: str = "") -> Tuple[str, str]:
    """
    Scans document text and filename to detect bank name and document type.
    Returns (bank_name, doc_type).
    """
    combined = f"{filename} {text[:3000]}" if text else filename
    search_str = combined.replace("_", " ")
    
    detected_bank = ""
    for pattern, bank in BANK_PATTERNS:
        if re.search(pattern, search_str, re.IGNORECASE):
            detected_bank = bank
            break
            
    detected_doc_type = "Legal Opinion"
    for pattern, doc_type in DOC_TYPE_PATTERNS:
        if re.search(pattern, search_str, re.IGNORECASE):
            detected_doc_type = doc_type
            break
            
    return detected_bank, detected_doc_type


def generate_smart_template_name(
    bank: str = "",
    doc_type: str = "Legal Opinion",
    original_filename: str = ""
) -> str:
    """
    Generates an intelligent, clean template name.
    e.g. 'Canara Bank Legal Opinion Template.docx' or 'SBI Title Scrutiny Template.docx'
    """
    # Detect from original filename if not provided
    if not bank or not doc_type or doc_type == "Legal Opinion":
        d_bank, d_type = detect_bank_and_doc_type("", original_filename)
        if not bank and d_bank:
            bank = d_bank
        if doc_type == "Legal Opinion" and d_type:
            doc_type = d_type
            
    # Clean bank name if passed
    bank_clean = (bank or "").strip()
    doc_clean = (doc_type or "Legal Opinion").strip()
    
    # Format template title
    if bank_clean and bank_clean.lower() != "general":
        name = f"{bank_clean} {doc_clean} Template.docx"
    else:
        name = f"{doc_clean} Template.docx"

    # Clean invalid filesystem characters and path traversal, keeping readable spaces
    name = name.replace("\\", "/").split("/")[-1].strip()
    name = re.sub(r'[\<\>\:\"\/\\\|\?\*\x00-\x1f]', '', name).strip()
    return name


def generate_smart_document_name(
    borrower_name: str = "",
    bank: str = "",
    doc_type: str = "Legal_Opinion",
    original_filename: str = ""
) -> str:
    """
    Generates an intelligent, clean output document name.
    e.g. 'Legal_Opinion_Suresh_Kumar.docx' or 'SBI_Legal_Opinion_R_Gopalan.docx'
    Avoids retaining old template author/placeholder names (e.g. Muthulakshmi).
    """
    # Normalize doc_type
    doc_clean = doc_type.replace(" ", "_") if doc_type else "Legal_Opinion"
    
    # Normalize bank
    bank_clean = ""
    if bank and bank.lower() != "general":
        bank_clean = re.sub(r'[^a-zA-Z0-9]', '_', bank).strip('_')
        # Common acronym conversion
        if bank.lower() in ("state bank of india", "sbi"):
            bank_clean = "SBI"
            
    # Clean borrower name
    clean_borrower = clean_party_for_filename(borrower_name)
    
    if clean_borrower:
        if bank_clean:
            name = f"{bank_clean}_{doc_clean}_{clean_borrower}.docx"
        else:
            name = f"{doc_clean}_{clean_borrower}.docx"
    else:
        # If borrower is not yet known, sanitize original_filename
        # Strip generic/stale markers: 'template', 'completed', 'draft', 'muthulakshmi'
        base = re.sub(r'\.[^/.]+$', '', original_filename or "")
        base = re.sub(r'\b(?:template|completed|_completed|draft|copy|\(1\)|\(2\)|muthulakshmi)\b', '', base, flags=re.IGNORECASE)
        base = re.sub(r'[_\s]+', '_', base).strip('._')
        
        if base and len(base) >= 3:
            name = f"{base}_completed.docx"
        elif bank_clean:
            name = f"{bank_clean}_{doc_clean}.docx"
        else:
            name = f"{doc_clean}.docx"
            
    return clean_filename(name)
