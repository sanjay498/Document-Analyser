import io
import pytest
import docx
from docx.enum.text import WD_COLOR_INDEX

from backend.app.core.doc_processor import (
    HighlightedField,
    FieldLocation,
    FieldFormatting,
    detect_yellow_highlights,
    apply_field_values_to_template,
)
from backend.app.core.source_extractor import ExtractedSourceDocument
from backend.app.core.ai_extractor import (
    extract_legal_entities_from_text,
    mock_heuristic_extractor,
    classify_field,
)


def test_entity_extraction_accuracy_real_world_complex_deed():
    """
    Test extraction accuracy on a realistic Tamil legal deed with:
    - Multiple survey numbers (old & new)
    - Compound metric and imperial extents
    - Distinct village, taluk, and SRO
    - Tamil document date, doc number, and registration year
    - Prior owner and beneficiary
    """
    sample_deed_text = """
    ஆவண எண்: 8945/2023
    நாள்: 24.11.2023
    சார்பதிவாளர் அலுவலகம்: மேட்டுப்பாளையம் சார்பதிவகம் (Mettupalayam SRO)
    சொத்து விவரம்:
    கோயம்புத்தூர் மாவட்டம், மேட்டுப்பாளையம் வட்டம், காரமடை கிராமம் (Karamadai Village),
    பழைய சர்வே எண்: 312/1A, 312/1B மற்றும் புது சர்வே எண்: 312/1C
    விஸ்தீரணம்: 0.94.50 ஹெக்டேர் (2.33 ஏக்கர்) அதாவது 1,01,495 சதுர அடி
    சொத்து கிரையம் வாங்கியவர்: Dr. K. Soundararajan, M.B.B.S., D.G.O.
    விற்பனை செய்தவர் / முந்தைய உரிமையாளர்: V. Rangasamy Chettiar, S/o Venkatachalam
    பாகப்பிரிவினை ஆவணம் எண் 2140/1995 மூலம் பெற்ற சொத்து.
    தற்போது வருவாய் பட்டா எண் 4521 உரிமையாளர் சௌந்தரராஜன் பெயரில் உள்ளது.
    நான்கு எல்லைகள்:
    கிழக்கு: ரங்கசாமி செட்டியார் நிலம்
    மேற்கு: 30 அடி பஞ்சாயத்து தார் ரோடு
    தெற்கு: வேணுகோபால் நிலம்
    வடக்கு: வாய்க்கால் மற்றும் பொது பாதை
    """

    entities = extract_legal_entities_from_text(sample_deed_text, filename="Soundararajan_Purchase_8945.pdf")

    # Accurate document numbers and dates
    assert entities.get("doc_no") == "8945"
    assert entities.get("year") == "2023"
    assert entities.get("date") == "24.11.2023"

    # Accurate location
    assert "Karamadai" in (entities.get("village") or "")
    assert "Mettupalayam" in (entities.get("sro") or "")

    # Accurate party names
    assert "Soundararajan" in (entities.get("borrower") or "")
    assert "Rangasamy Chettiar" in (entities.get("ancestor") or entities.get("seller") or "")

    # Accurate compound extent & survey numbers
    sf_res = entities.get("sf_nos") or ""
    assert "312/1" in sf_res
    ext_res = entities.get("extent") or ""
    assert "2.33" in ext_res or "0.94.50" in ext_res

    # Accurate revenue records
    assert entities.get("patta_no") == "4521"


def test_client_anchoring_overrides_stale_or_generic_borrowers():
    """
    When client_info is provided from the workflow (Step 2 client selection),
    the borrower, mortgagor, and title holder fields must strictly anchor to the client's name.
    """
    client_info = {
        "id": "cli_9988",
        "name": "Mrs. Priya Anand, W/o Anand Kumar",
        "phone": "+91 98765 43210",
        "email": "priya.anand@example.com",
        "matter_title": "SBI Housing Loan Scrutiny",
        "loan_type": "Housing Loan",
    }

    sample_deed = """
    ஆவணம் எண்: 1234/2022
    கிரையம் பெற்றவர்: S. Govindaraj (Co-owner / Relative)
    பழைய சர்வே எண்: 104/2
    விஸ்தீரணம்: 1500 Sq.Ft.
    """

    entities = extract_legal_entities_from_text(
        sample_deed,
        filename="TitleDeed_1234.pdf",
        client_info=client_info
    )

    # Must be anchored to the user-chosen client
    assert "Priya Anand" in (entities.get("borrower") or "")
    assert "Priya Anand" in (entities.get("allottee") or "")


def test_classify_field_no_negative_exclusions():
    """
    Survey numbers, extents, and party names from real deeds must be classified as
    replaceable fields and not excluded by arbitrary regex blocks.
    """
    test_cases = [
        ("S.F.No. 245/1B and 245/3A2", "survey_number"),
        ("0.06.50 Hectare (16 Cents)", "extent"),
        ("Totally measuring an extent of 4356 Sq.ft.", "extent"),
        ("Sub-Registrar Office, Pollachi", "sro_name"),
        ("Dr. Soundararajan, M.B.B.S.", "borrower_name"),
        ("Karamadai Village, Mettupalayam Taluk", "property_schedule"),
    ]

    for text, expected_type in test_cases:
        field = HighlightedField(
            field_id="f_test",
            original_text=text,
            paragraph_context=text,
            context_with_marker=f"[FIELD: {text}]",
            location=FieldLocation(location_type="table_cell", table_index=0, row_index=1, cell_index=1),
            formatting=FieldFormatting(),
            is_table_cell=True
        )
        classified = classify_field(field)
        # Should not be static_boilerplate
        assert classified != "static_boilerplate", f"Field '{text}' was incorrectly marked as static_boilerplate!"


def test_template_replacement_accuracy_end_to_end():
    """
    Creates a real Word document with yellow highlighted cells for:
    - Borrower Name
    - Survey Number
    - Extent
    - Village
    - SRO
    Applies extracted values and verifies that:
    1. All target cells have been replaced accurately.
    2. All highlights are cleanly stripped.
    3. Zero stale fixture leakage (e.g. no 'Balashanmugam', 'Muthulakshmi', 'S.F.No. 711').
    """
    doc = docx.Document()
    table = doc.add_table(rows=5, cols=2)

    labels_and_placeholders = [
        ("Name of Borrower / Applicant:", "M. Anandan, S/o Mayilsamy Kavundar"),
        ("Survey Number / S.F. No.:", "S.F.No. 711"),
        ("Extent of Property:", "2223 Sq.ft."),
        ("Village / Taluk:", "Kottur Village, Anaimalai Taluk"),
        ("Sub-Registrar Office:", "Anaimalai Sub-Registrar Office"),
    ]

    for idx, (label, placeholder) in enumerate(labels_and_placeholders):
        table.cell(idx, 0).text = label
        p = table.cell(idx, 1).paragraphs[0]
        run = p.add_run(placeholder)
        run.font.highlight_color = WD_COLOR_INDEX.YELLOW

    doc_stream = io.BytesIO()
    doc.save(doc_stream)
    doc_bytes = doc_stream.getvalue()

    # Detect fields
    _doc, detected_fields, detected_tables = detect_yellow_highlights(doc_bytes)
    assert len(detected_fields) == 5

    # Real deed extraction
    real_deed_text = """
    Document No: 5678/2024
    Date of Registration: 18.06.2024
    Sub-Registrar Office: Perur SRO
    Village: Kalampalayam Village, Perur Taluk
    Survey Numbers: S.F.No. 88/2A and 89/1B
    Extent of Land: 3200 Sq.Ft. (7.34 Cents)
    Purchaser / Present Owner: Mr. Vigneshwaran S., S/o Sundaram
    """

    sources = [
        ExtractedSourceDocument(
            filename="Vigneshwaran_Kalampalayam_5678.pdf",
            file_type="pdf",
            full_text=real_deed_text,
            char_count=len(real_deed_text),
            page_or_section_count=1
        )
    ]

    client_info = {
        "id": "c_vignesh",
        "name": "Mr. Vigneshwaran S.",
        "phone": "9998887776",
        "email": "vignesh@example.com"
    }

    extraction_result = mock_heuristic_extractor(
        detected_fields,
        detected_tables,
        sources,
        client_info=client_info
    )

    val_map = {f.field_id: f.value for f in extraction_result.fields}

    # Apply replacement
    output_io = apply_field_values_to_template(
        template_source=doc_bytes,
        fields=detected_fields,
        field_values=val_map,
        clear_highlight=True
    )
    output_docx_bytes = output_io.getvalue()

    # Verify replaced Word document
    out_doc = docx.Document(io.BytesIO(output_docx_bytes))
    out_table = out_doc.tables[0]

    replaced_borrower = out_table.cell(0, 1).text
    replaced_sf = out_table.cell(1, 1).text
    replaced_extent = out_table.cell(2, 1).text
    replaced_village = out_table.cell(3, 1).text
    replaced_sro = out_table.cell(4, 1).text

    assert "Vigneshwaran" in replaced_borrower
    assert "88/2A" in replaced_sf
    assert "3200" in replaced_extent or "7.34" in replaced_extent
    assert "Kalampalayam" in replaced_village
    assert "Perur" in replaced_sro

    # Ensure zero leakage of template placeholders
    all_table_text = " ".join([cell.text for row in out_table.rows for cell in row.cells])
    assert "Anandan" not in all_table_text
    assert "711" not in all_table_text
    assert "2223" not in all_table_text
    assert "Kottur" not in all_table_text
    assert "Anaimalai" not in all_table_text

    # Ensure highlights stripped
    for row in out_table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                for r in p.runs:
                    assert r.font.highlight_color is None


def test_dynamic_table_multi_row_duplication_no_cell_collision():
    """
    Verifies that when a dynamic table group is duplicated into multiple rows,
    fields belonging to other rows in the same table or subsequent tables
    are NOT erroneously marked as handled or skipped.
    """
    doc = docx.Document()
    
    # Table 0: Scrutiny table (multi-column)
    t0 = doc.add_table(rows=2, cols=4)
    headers = ["Sl No", "Description of Document", "Date", "Doc No"]
    for c_idx, h in enumerate(headers):
        t0.cell(0, c_idx).text = h

    # Template row with yellow highlight (dynamic template row)
    t0.cell(1, 0).text = "1"
    r1 = t0.cell(1, 1).paragraphs[0].add_run("Sale Deed Doc No. 1001/2010")
    r1.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r2 = t0.cell(1, 2).paragraphs[0].add_run("01.01.2010")
    r2.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r3 = t0.cell(1, 3).paragraphs[0].add_run("1001/2010")
    r3.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Table 1: Separate 2-column borrower summary table
    t1 = doc.add_table(rows=2, cols=2)
    t1.cell(0, 0).text = "Borrower Name:"
    br = t1.cell(0, 1).paragraphs[0].add_run("Placeholder Borrower")
    br.font.highlight_color = WD_COLOR_INDEX.YELLOW
    
    t1.cell(1, 0).text = "Branch Name:"
    br2 = t1.cell(1, 1).paragraphs[0].add_run("Placeholder Branch")
    br2.font.highlight_color = WD_COLOR_INDEX.YELLOW

    buf = io.BytesIO()
    doc.save(buf)
    doc_bytes = buf.getvalue()

    _doc, detected_fields, detected_tables = detect_yellow_highlights(doc_bytes)

    # Dynamic records for table 0
    records = [
        {"Description of Document": "Parent Deed 500/1990", "Date": "12.05.1990", "Doc No": "500/1990"},
        {"Description of Document": "Settlement Deed 1200/2005", "Date": "18.08.2005", "Doc No": "1200/2005"},
        {"Description of Document": "Current Sale Deed 4500/2022", "Date": "20.10.2022", "Doc No": "4500/2022"},
    ]

    val_map = {}
    for f in detected_fields:
        if "borrower" in f.row_context.lower() or "borrower" in (f.column_header or "").lower():
            val_map[f.field_id] = "Mr. S. Karthikeyan"
        elif "branch" in f.row_context.lower() or "branch" in (f.column_header or "").lower():
            val_map[f.field_id] = "Coimbatore Main Branch"

    group_id = detected_tables[0].group_id if detected_tables else "table_0_row_1"
    table_group_records = {group_id: records}

    output_io = apply_field_values_to_template(
        template_source=doc_bytes,
        fields=detected_fields,
        field_values=val_map,
        table_group_records=table_group_records,
        clear_highlight=True
    )

    out_doc = docx.Document(output_io)
    out_t0 = out_doc.tables[0]
    out_t1 = out_doc.tables[1]

    # Verify Table 0 was duplicated into 3 rows
    assert len(out_t0.rows) >= 4  # Header + 3 records
    t0_text = " ".join([c.text for row in out_t0.rows for c in row.cells])
    assert "Parent Deed 500/1990" in t0_text
    assert "Settlement Deed 1200/2005" in t0_text
    assert "Current Sale Deed 4500/2022" in t0_text

    # Verify Table 1 was preserved and accurately populated (NOT skipped due to cell collision)
    out_borrower = out_t1.cell(0, 1).text
    out_branch = out_t1.cell(1, 1).text
    assert out_borrower == "Mr. S. Karthikeyan"
    assert out_branch == "Coimbatore Main Branch"
