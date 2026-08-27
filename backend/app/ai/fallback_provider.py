import re
from typing import List, Optional, Tuple
from app.ai.base import BaseAIProvider
from app.schemas.ai import AIMappingResult, AIFieldMappingItem
from app.schemas.template import TemplateFieldResponse
from app.ocr.layout import DocumentContext
from app.utils.logger import logger

class FallbackAIProvider(BaseAIProvider):
    """
    Offline semantic fuzzy & regex matching engine.
    Extracts key-value pairs and semantic matches from arbitrary document text.
    """

    def map_fields(
        self,
        template_fields: List[TemplateFieldResponse],
        source_contexts: List[DocumentContext]
    ) -> AIMappingResult:
        full_text = "\n".join([ctx.full_text for ctx in source_contexts if ctx.full_text])
        lines = [line.strip() for line in full_text.splitlines() if line.strip()]

        extracted_items: List[AIFieldMappingItem] = []
        warnings: List[str] = []

        for field in template_fields:
            field_name = field.field_name
            val, src_text, conf = self._find_best_match(field_name, lines, full_text)

            if val:
                extracted_items.append(AIFieldMappingItem(
                    field_name=field_name,
                    value=val,
                    source_text=src_text,
                    confidence=conf
                ))
            else:
                extracted_items.append(AIFieldMappingItem(
                    field_name=field_name,
                    value=None,
                    source_text=None,
                    confidence=0.0
                ))
                warnings.append(f"Field '{field_name}' could not be automatically located in source document.")

        return AIMappingResult(
            document_type="general_doc",
            fields=extracted_items,
            warnings=warnings
        )

    def _find_best_match(self, field_name: str, lines: List[str], full_text: str) -> Tuple[Optional[str], Optional[str], float]:
        clean_fn = field_name.upper().replace("_", " ")

        # Common synonym dictionary
        synonyms = {
            "BORROWER_NAME": ["BORROWER", "NAME OF THE BORROWER", "CLIENT", "BUYER", "CUSTOMER", "APPLICANT"],
            "DOCUMENT_NUMBER": ["DOCUMENT NO", "DOC NO", "REGISTRATION NO", "REGISTERED AS DOCUMENT", "NUMBER", "REF NO"],
            "PROPERTY_DESCRIPTION": ["PROPERTY", "DESCRIPTION OF PROPERTY", "S.F.NO", "SURVEY NO", "PREMISES", "LOCATION"],
            "DATE": ["DATE", "DATED", "EXECUTION DATE", "REGISTRATION DATE"],
            "ADDRESS": ["ADDRESS", "RESIDENCE", "LOCATION"],
            "NAME": ["NAME", "FULL NAME", "PERSON NAME"],
        }

        search_keys = [clean_fn]
        for key, syn_list in synonyms.items():
            if key in clean_fn or clean_fn in key:
                search_keys.extend(syn_list)

        # Strategy 1: Line key-value search ("Key : Value" or "Key - Value")
        for line in lines:
            for key in search_keys:
                pattern = re.compile(rf"{re.escape(key)}\s*[:\-]\s*(.+)", re.IGNORECASE)
                m = pattern.search(line)
                if m:
                    val = m.group(1).strip()
                    if val:
                        return val, line, 0.98

        # Strategy 2: Date regex for DATE fields
        if "DATE" in clean_fn:
            date_pattern = re.compile(r'\b(?:\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*\d{4})\b')
            for line in lines:
                m = date_pattern.search(line)
                if m:
                    return m.group(0), line, 0.95

        # Strategy 3: Document Number regex for DOCUMENT_NUMBER / DOC_NO
        if any(k in clean_fn for k in ["NUMBER", "NO", "CODE", "ID"]):
            doc_num_pattern = re.compile(r'\b(?:\d+[\/\-]\d+|\b\d{4,10}\b)')
            for line in lines:
                if any(kw in line.upper() for kw in ["DOC", "DOCUMENT", "NO", "NUMBER", "REF"]):
                    m = doc_num_pattern.search(line)
                    if m:
                        return m.group(0), line, 0.92

        # Strategy 4: Fuzzy line inclusion
        for line in lines:
            for key in search_keys:
                if key in line.upper():
                    # Extract string after key
                    idx = line.upper().find(key)
                    remainder = line[idx + len(key):].strip(" :-=,\t")
                    if len(remainder) > 2:
                        return remainder, line, 0.85

        return None, None, 0.0
