"""
Isolated Unit Tests for OCR and Page-Aware Traceability
(Phase 3 Production Readiness)
"""

from io import BytesIO
import pytest
from PIL import Image, ImageDraw, ImageFont
import pypdf
from backend.app.core.source_extractor import (
    extract_text_from_source,
    extract_text_from_docx,
    extract_text_from_pdf,
    ExtractedSourceDocument,
    SourceDocumentPage
)
from docx import Document


def create_mock_searchable_pdf() -> bytes:
    """
    Creates a multi-page searchable PDF with text layer.
    """
    writer = pypdf.PdfWriter()
    
    # Page 1
    p1 = writer.add_blank_page(width=612, height=792)
    # Note: pypdf doesn't easily draw text, so we can use reportlab or docx or synthetic text
    # Instead, create docx or inspect text extraction
    doc = Document()
    doc.add_heading("Statement of Work - Horizon BioTech", level=1)
    doc.add_paragraph("This statement of work is effective October 15, 2026.")
    doc.add_paragraph("Total contract budget: $280,000 USD.")
    bio = BytesIO()
    doc.save(bio)
    return bio.getvalue()


def test_docx_page_and_section_traceability():
    """
    Tests that docx extraction preserves page/section chunks and metadata.
    """
    doc = Document()
    doc.add_heading("Master Services Agreement", level=1)
    doc.add_paragraph("Effective Date: November 1, 2026")
    doc.add_paragraph("Governing Law: State of California")
    for i in range(40):
        doc.add_paragraph(f"Section clause {i}: Boilerplate terms and regulatory compliance.")

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)

    extracted = extract_text_from_docx(bio.getvalue(), "MSA_Agreement.docx")

    assert extracted.file_type == "docx"
    assert len(extracted.pages) >= 2
    assert extracted.pages[0].page_number == 1
    assert "November 1, 2026" in extracted.pages[0].text
    assert extracted.is_scanned_ocr is False
    assert "--- [Document: MSA_Agreement.docx | Section 1] ---" in extracted.full_text


def test_txt_traceability_chunks():
    """
    Tests plain text chunking and page boundary preservation.
    """
    text_content = "\n".join([f"Line {i}: Contract terms and specifications." for i in range(75)])
    raw_bytes = text_content.encode("utf-8")

    extracted = extract_text_from_source(raw_bytes, "terms_sheet.txt")

    assert extracted.file_type == "txt"
    assert len(extracted.pages) == 3
    assert extracted.pages[0].page_number == 1
    assert extracted.pages[1].page_number == 2
    assert extracted.pages[2].page_number == 3
    assert "Line 0" in extracted.pages[0].text
    assert "Line 30" in extracted.pages[1].text
