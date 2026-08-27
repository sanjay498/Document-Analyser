import pytest
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from app.document_generation.pdf_template_engine import pdf_template_engine

def create_sample_pdf_template(output_path: str):
    c = canvas.Canvas(output_path, pagesize=letter)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(100, 750, "PDF LEGAL OPINION TEMPLATE")
    
    c.setFont("Helvetica", 11)
    c.drawString(100, 700, "Borrower Name: {{BORROWER_NAME}}")
    c.drawString(100, 670, "Document Number: {{DOCUMENT_NUMBER}}")
    c.drawString(100, 640, "Date: {{DATE}}")
    
    c.save()

def test_pdf_template_placeholder_extraction_and_generation(tmp_path):
    pdf_tpl_path = tmp_path / "sample_pdf_template.pdf"
    create_sample_pdf_template(str(pdf_tpl_path))

    # 1. Extract placeholders
    placeholders = pdf_template_engine.extract_placeholders(str(pdf_tpl_path))
    assert len(placeholders) >= 3

    field_names = [p["field_name"] for p in placeholders]
    assert "BORROWER_NAME" in field_names
    assert "DOCUMENT_NUMBER" in field_names
    assert "DATE" in field_names

    # 2. Generate PDF document from template
    output_pdf_path = tmp_path / "generated_from_pdf.pdf"
    field_values = {
        "BORROWER_NAME": "K.MUTHULAKSHMI",
        "DOCUMENT_NUMBER": "1277/1987",
        "DATE": "05.05.1987"
    }

    out_file = pdf_template_engine.generate_document_from_pdf(
        str(pdf_tpl_path),
        str(output_pdf_path),
        field_values
    )

    assert Path(out_file).exists()
    assert Path(out_file).stat().st_size > 0
