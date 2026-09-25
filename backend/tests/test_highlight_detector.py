"""
Standalone Unit Tests for Yellow-Highlight Detection and Deterministic Replacement
in python-docx.
"""

from io import BytesIO
import pytest
import docx
from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from docx.shared import Pt, RGBColor
from backend.app.core.doc_processor import (
    detect_yellow_highlights,
    apply_field_values_to_template,
    is_run_yellow_highlighted
)


def create_synthetic_template() -> BytesIO:
    """
    Creates an in-memory .docx document containing:
    1. A header paragraph with no highlights.
    2. A paragraph with one yellow highlight: "[Company Name]"
    3. A paragraph with multi-run consecutive yellow highlights: "Acme " + "Technologies Inc."
    4. A paragraph with two distinct yellow highlights: "[Effective Date]" and "[Governing State]"
    5. A paragraph with a non-yellow (green) highlight that should NOT be detected.
    6. A table cell with a yellow highlight: "[Notice Email]"
    """
    doc = Document()

    # Paragraph 0: Normal text
    p0 = doc.add_paragraph("CONFIDENTIAL MUTUAL NON-DISCLOSURE AGREEMENT")
    p0.runs[0].bold = True

    # Paragraph 1: Single yellow run with custom formatting (Bold + 14pt)
    p1 = doc.add_paragraph("This Agreement is entered into by and between ")
    r_yellow1 = p1.add_run("ACME CORP")
    r_yellow1.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_yellow1.bold = True
    r_yellow1.font.size = Pt(14)
    r_yellow1.font.name = "Arial"
    p1.add_run(" (the 'Disclosing Party').")

    # Paragraph 2: Multi-run contiguous yellow highlight
    p2 = doc.add_paragraph("The Recipient organization is ")
    r_part1 = p2.add_run("Global Dynamics ")
    r_part1.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_part1.italic = True
    r_part2 = p2.add_run("International LLC")
    r_part2.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_part2.italic = True
    p2.add_run(", a Delaware corporation.")

    # Paragraph 3: Two distinct yellow highlights in same paragraph
    p3 = doc.add_paragraph("This agreement is effective as of ")
    r_date = p3.add_run("January 1, 2025")
    r_date.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p3.add_run(" and shall be governed by the laws of ")
    r_state = p3.add_run("State of New York")
    r_state.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p3.add_run(".")

    # Paragraph 4: Green highlight (should NOT be detected as dynamic field)
    p4 = doc.add_paragraph("Standard boilerplate clause with ")
    r_green = p4.add_run("important note in green")
    r_green.font.highlight_color = WD_COLOR_INDEX.BRIGHT_GREEN
    p4.add_run(" that stays intact.")

    # Paragraph 5: Table with yellow highlight in cell
    table = doc.add_table(rows=2, cols=2)
    cell_0_0 = table.cell(0, 0)
    cell_0_0.paragraphs[0].text = "Notice Address:"
    cell_0_1 = table.cell(0, 1)
    cp = cell_0_1.paragraphs[0]
    cp.add_run("Send notices to ")
    r_cell_yellow = cp.add_run("legal@acme-corp.com")
    r_cell_yellow.font.highlight_color = WD_COLOR_INDEX.YELLOW
    cp.add_run(" for prompt handling.")

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def test_yellow_highlight_detection():
    """
    Verifies that yellow highlights are accurately detected,
    grouped when contiguous, and ignore non-yellow highlights.
    """
    template_bytes = create_synthetic_template().getvalue()
    doc, fields, table_groups = detect_yellow_highlights(template_bytes)

    # We expect 5 yellow fields:
    # 1. ACME CORP
    # 2. Global Dynamics International LLC (grouped from 2 runs)
    # 3. January 1, 2025
    # 4. State of New York
    # 5. legal@acme-corp.com (in table cell)
    assert len(fields) == 5, f"Expected 5 fields, got {len(fields)}"

    # Field 1
    f1 = fields[0]
    assert f1.original_text == "ACME CORP"
    assert "Disclosing Party" in f1.paragraph_context
    assert "[FIELD: ACME CORP]" in f1.context_with_marker
    assert f1.formatting.bold is True
    assert f1.formatting.font_name == "Arial"
    assert f1.formatting.font_size_pt == 14.0

    # Field 2 (contiguous runs combined)
    f2 = fields[1]
    assert f2.original_text == "Global Dynamics International LLC"
    assert len(f2.location.run_indices) == 2
    assert f2.formatting.italic is True
    assert "[FIELD: Global Dynamics International LLC]" in f2.context_with_marker

    # Field 3 & 4 (separate fields in same paragraph)
    f3 = fields[2]
    f4 = fields[3]
    assert f3.original_text == "January 1, 2025"
    assert f4.original_text == "State of New York"
    assert f3.location.paragraph_index == f4.location.paragraph_index

    # Field 5 (in table)
    f5 = fields[4]
    assert f5.original_text == "legal@acme-corp.com"
    assert f5.location.location_type == "table_cell"


def test_deterministic_replacement_and_format_preservation():
    """
    Verifies that replacing fields:
    1. Inserts the new extracted values.
    2. Strips the yellow highlight.
    3. Retains font, size, bold, italic.
    4. Leaves all non-highlighted runs completely intact.
    """
    template_bytes = create_synthetic_template().getvalue()
    _, fields, _ = detect_yellow_highlights(template_bytes)

    field_values = {
        fields[0].field_id: "VERTEX AI SYSTEMS INC.",
        fields[1].field_id: "Quantum Leap Technologies Corp",
        fields[2].field_id: "October 15, 2026",
        fields[3].field_id: "State of California",
        fields[4].field_id: "notices@vertexai.io"
    }

    output_bio = apply_field_values_to_template(
        template_source=template_bytes,
        fields=fields,
        field_values=field_values,
        clear_highlight=True
    )

    # Re-parse the output document to inspect
    doc_out = Document(output_bio)

    # Paragraph 0: untouched
    assert doc_out.paragraphs[0].text == "CONFIDENTIAL MUTUAL NON-DISCLOSURE AGREEMENT"
    assert doc_out.paragraphs[0].runs[0].bold is True

    # Paragraph 1: Replaced & preserved formatting & highlight removed
    p1 = doc_out.paragraphs[1]
    assert "VERTEX AI SYSTEMS INC." in p1.text
    assert "Disclosing Party" in p1.text
    r_replaced1 = p1.runs[1]
    assert r_replaced1.text == "VERTEX AI SYSTEMS INC."
    assert r_replaced1.bold is True
    assert r_replaced1.font.size == Pt(14)
    assert not is_run_yellow_highlighted(r_replaced1)

    # Paragraph 2: Multi-run replaced cleanly
    p2 = doc_out.paragraphs[2]
    assert "Quantum Leap Technologies Corp" in p2.text
    assert "Delaware corporation" in p2.text
    assert not is_run_yellow_highlighted(p2.runs[1])

    # Paragraph 3: Both fields in same paragraph replaced
    p3 = doc_out.paragraphs[3]
    assert "October 15, 2026" in p3.text
    assert "State of California" in p3.text

    # Paragraph 4: Green highlight remained intact
    p4 = doc_out.paragraphs[4]
    assert "important note in green" in p4.text
    assert p4.runs[1].font.highlight_color == WD_COLOR_INDEX.BRIGHT_GREEN

    # Table cell replaced
    table = doc_out.tables[0]
    cp = table.cell(0, 1).paragraphs[0]
    assert "notices@vertexai.io" in cp.text
    assert not is_run_yellow_highlighted(cp.runs[1])

    # Ensure no yellow highlights remain in the output
    _, remaining_yellow, _ = detect_yellow_highlights(output_bio.getvalue())
    assert len(remaining_yellow) == 0, f"Expected 0 yellow highlights, found {len(remaining_yellow)}"


def test_missing_or_null_field_value_handling():
    """
    Verifies that when a field value is None or missing,
    it gracefully retains the original text without throwing errors.
    """
    template_bytes = create_synthetic_template().getvalue()
    _, fields, _ = detect_yellow_highlights(template_bytes)

    # Only supply value for field 0
    field_values = {
        fields[0].field_id: "SOLARIS ENERGY CORP",
        fields[1].field_id: None  # missing / not_found
    }

    output_bio = apply_field_values_to_template(
        template_source=template_bytes,
        fields=fields,
        field_values=field_values,
        clear_highlight=True
    )

    doc_out = Document(output_bio)
    assert "SOLARIS ENERGY CORP" in doc_out.paragraphs[1].text
    # Field 1 should have retained original text
    assert "Global Dynamics International LLC" in doc_out.paragraphs[2].text
