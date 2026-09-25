"""
Tests for Item 7 - Advanced Document Formats:
- PPTX Templates with Yellow Highlight Runs
- PDF Interactive Form Templates with Fillable Fields
"""

import io
from io import BytesIO
import pytest
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
import pypdf

from backend.app.core.doc_processor import (
    detect_pptx_highlights,
    apply_pptx_field_values,
    detect_pdf_form_fields,
    apply_pdf_form_values,
    detect_template_universal,
    apply_field_values_universal
)


def create_mock_pptx_template() -> bytes:
    """
    Creates a sample PPTX presentation with yellow-highlighted run.
    """
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank slide

    tx_box = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(6), Inches(3))
    tf = tx_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Contract Overview for "

    # Run with yellow highlight/color
    run_highlight = p.add_run()
    run_highlight.text = "Acme Global Solutions LLC"
    run_highlight.font.color.rgb = RGBColor(255, 255, 0)
    run_highlight.font.bold = True

    p2 = tf.add_paragraph()
    p2.text = "Payment Term: "
    r2 = p2.add_run()
    r2.text = "30 Days Net"
    r2.font.color.rgb = RGBColor(255, 255, 0)

    bio = BytesIO()
    prs.save(bio)
    return bio.getvalue()


def test_pptx_highlight_detection_and_replacement():
    pptx_bytes = create_mock_pptx_template()

    # 1. Detect
    prs, fields, table_groups = detect_pptx_highlights(pptx_bytes, "Pitch_Template.pptx")
    assert len(fields) >= 2
    assert any("Acme Global Solutions" in f.original_text for f in fields)
    assert any("30 Days Net" in f.original_text for f in fields)

    # 2. Replace
    field_values = {
        fields[0].field_id: "Horizon BioTech Systems Inc.",
        fields[1].field_id: "45 Days Net"
    }
    out_bio = apply_pptx_field_values(pptx_bytes, fields, field_values)
    assert len(out_bio.getvalue()) > 0

    # 3. Verify in output presentation
    out_prs = Presentation(out_bio)
    text_content = ""
    for slide in out_prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                text_content += shape.text_frame.text + "\n"

    assert "Horizon BioTech Systems Inc." in text_content
    assert "45 Days Net" in text_content


def test_universal_template_dispatcher():
    pptx_bytes = create_mock_pptx_template()

    # Universal detection
    doc, fields, table_groups = detect_template_universal(pptx_bytes, "Corporate_Pitch.pptx")
    assert len(fields) >= 2

    # Universal export
    field_vals = {fields[0].field_id: "Zenith Aerospace LLC"}
    bio, content_type = apply_field_values_universal(
        template_source=pptx_bytes,
        filename="Corporate_Pitch.pptx",
        fields=fields,
        field_values=field_vals
    )
    assert "presentationml" in content_type
    assert len(bio.getvalue()) > 0
