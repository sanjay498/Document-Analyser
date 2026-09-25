"""
Test Suite: Tamil (தமிழ்) & Multilingual Document Analysis and English Translation
Verifies Unicode extraction, Tamil script detection, OCR fallbacks,
Tamil-to-English translation & transliteration, dynamic table extraction,
and cross-lingual conflict detection.
"""

import pytest
import pytest_asyncio
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import init_db
from backend.app.core.source_extractor import (
    detect_tamil_text,
    normalize_unicode_text,
    extract_text_from_source,
    extract_text_from_docx
)
from backend.app.core.samples import (
    generate_sample_template,
    generate_sample_tamil_source_doc,
    generate_sample_tamil_addendum_doc
)
from backend.app.core.doc_processor import detect_yellow_highlights
from backend.app.core.ai_extractor import mock_heuristic_extractor


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    await init_db()


def test_tamil_script_detection_and_normalization():
    tamil_sample = "வாடிக்கையாளர் பெயர்: ஹொரைசன் பயோடெக் சொல்யூஷன்ஸ்"
    english_sample = "Client Legal Name: Horizon BioTech Solutions Inc."
    bilingual_sample = "சென்னை (Chennai), தமிழ்நாடு (Tamil Nadu) 600002"

    assert detect_tamil_text(tamil_sample) is True
    assert detect_tamil_text(english_sample) is False
    assert detect_tamil_text(bilingual_sample) is True

    # Test Unicode NFC normalization
    normalized = normalize_unicode_text(tamil_sample)
    assert len(normalized) > 0
    assert detect_tamil_text(normalized) is True


def test_extract_text_from_tamil_docx():
    tamil_bio = generate_sample_tamil_source_doc()
    tamil_bytes = tamil_bio.getvalue()
    extracted = extract_text_from_docx(tamil_bytes, "Tamil_SOW_Intake.docx")

    assert extracted.has_tamil is True
    assert extracted.char_count > 100
    assert "வாடிக்கையாளர் சட்டப்பூர்வ பெயர்" in extracted.full_text
    assert "அண்ணா சாலை" in extracted.full_text
    assert "சென்னை" in extracted.full_text
    assert "30 நாட்கள்" in extracted.full_text
    assert len(extracted.pages) >= 1
    assert extracted.pages[0].has_tamil is True


def test_tamil_to_english_heuristic_extraction():
    template_bio = generate_sample_template()
    template_bytes = template_bio.getvalue()
    doc, fields, table_groups = detect_yellow_highlights(template_bytes)

    tamil_bio = generate_sample_tamil_source_doc()
    tamil_bytes = tamil_bio.getvalue()
    tamil_extracted = extract_text_from_source(tamil_bytes, "Tamil_SOW.docx")

    output = mock_heuristic_extractor(fields, table_groups, [tamil_extracted])

    assert len(output.fields) == len(fields)
    
    # Map results by original template text keywords
    res_map = {f.original_text: f for f in output.fields}

    # Verify Client translated/transliterated
    client_res = next((r for r in output.fields if "Nexus" in r.original_text or "Client" in (r.reasoning or "")), None)
    if client_res:
        assert client_res.value == "Horizon BioTech Solutions Inc."
        assert client_res.status == "extracted"
        assert client_res.is_translated is True
        assert client_res.source_language == "tamil"

    # Verify Effective Date translated
    date_res = next((r for r in output.fields if "January 15, 2026" in r.original_text), None)
    if date_res:
        assert date_res.value == "October 15, 2026"
        assert date_res.status == "extracted"
        assert date_res.is_translated is True

    # Verify Payment Terms translated (30 நாட்கள் -> 30 days)
    terms_res = next((r for r in output.fields if "30 days" in r.original_text), None)
    if terms_res:
        assert terms_res.value == "30 days"
        assert terms_res.status == "extracted"
        assert terms_res.is_translated is True

    # Verify Address transliterated (சென்னை, தமிழ்நாடு -> Chennai, Tamil Nadu)
    addr_res = next((r for r in output.fields if "Austin, TX" in r.original_text), None)
    if addr_res:
        assert "Chennai" in addr_res.value
        assert "Tamil Nadu" in addr_res.value
        assert addr_res.is_translated is True

    # Verify Table Milestones extracted and translated
    assert len(output.table_groups) >= 1
    table_group = output.table_groups[0]
    assert len(table_group.records) >= 3
    assert table_group.records[0]["Milestone #"] == "M-1"
    assert "Phase 1: Automated Genomic Pipeline AI Architecture" in table_group.records[0]["Deliverable Description"]
    assert "October 30, 2026" in table_group.records[0]["Completion Date"]
    assert "$110,000 USD" in table_group.records[0]["Milestone Fee"]


def test_tamil_cross_lingual_conflict_detection():
    template_bio = generate_sample_template()
    template_bytes = template_bio.getvalue()
    doc, fields, table_groups = detect_yellow_highlights(template_bytes)

    # Source 1: Tamil SOW with 30 நாட்கள்
    tamil_bio_1 = generate_sample_tamil_source_doc()
    tamil_ext_1 = extract_text_from_source(tamil_bio_1.getvalue(), "Tamil_Primary_SOW.docx")

    # Source 2: Tamil Addendum with 60 நாட்கள்
    tamil_bio_2 = generate_sample_tamil_addendum_doc()
    tamil_ext_2 = extract_text_from_source(tamil_bio_2.getvalue(), "Tamil_Vendor_Addendum.docx")

    output = mock_heuristic_extractor(fields, table_groups, [tamil_ext_1, tamil_ext_2])

    terms_res = next((r for r in output.fields if "30 days" in r.original_text), None)
    assert terms_res is not None
    assert terms_res.status == "conflict"
    assert len(terms_res.conflicts) == 2
    conflict_vals = {c.value for c in terms_res.conflicts}
    assert "30 days" in conflict_vals
    assert "60 days" in conflict_vals


def test_tamil_sample_api_endpoints():
    client = TestClient(app)

    # 1. Test downloading Tamil sample documents
    res_tam_src = client.get("/api/samples/tamil_source.docx")
    assert res_tam_src.status_code == 200
    assert len(res_tam_src.content) > 1000

    res_tam_add = client.get("/api/samples/tamil_addendum.docx")
    assert res_tam_add.status_code == 200
    assert len(res_tam_add.content) > 1000

    # 2. Create session and load Tamil sample preset
    sess_res = client.post("/api/sessions")
    assert sess_res.status_code == 200
    sess_id = sess_res.json()["session_id"]

    load_res = client.post(f"/api/sessions/{sess_id}/load-tamil-sample")
    assert load_res.status_code == 200
    data = load_res.json()
    assert data["template_filename"] == "MSA_Template_Dynamic_Milestones.docx"
    assert len(data["fields"]) > 0
    assert len(data["sources"]) == 2
    assert data["sources"][0]["has_tamil"] is True

    # 3. Trigger extraction
    extract_res = client.post(f"/api/sessions/{sess_id}/extract")
    assert extract_res.status_code == 200
    ext_data = extract_res.json()
    assert len(ext_data["results"]) > 0
    
    # Verify conflict on payment terms was detected
    conflict_field = next((f for f in ext_data["results"] if f["status"] == "conflict"), None)
    assert conflict_field is not None
    assert len(conflict_field["conflicts"]) == 2


def test_tamil_title_deed_ocr_extraction_and_template_replacement():
    from backend.app.core.samples import generate_legal_opinion_title_report_template
    from backend.app.core.doc_processor import apply_field_values_universal

    # 1. Generate Legal Opinion template with yellow highlights
    tpl_bio = generate_legal_opinion_title_report_template()
    tpl_bytes = tpl_bio.getvalue()
    doc, fields, table_groups = detect_yellow_highlights(tpl_bytes)
    assert len(fields) >= 10

    # 2. Ingest Tamil OCR source transcript (like DOC 2001.pdf)
    ocr_sample_text = """
    --- [Document: DOC 2001.pdf | Page 1] ---
    2012 ஆம் வருடம் மே மாதம் 14 ஆம் தேதி
    கோவை மாவட்டம், பொள்ளாச்சி வட்டம், வஞ்சியாபுரம் பிரிவு கிளை
    கடன் வாங்குபவர்: முத்துலட்சுமி, க/பெ. குமார்
    
    --- [Document: DOC 2001.pdf | Page 5] ---
    1988 ம் வருடத்திய பாகப்பிரிவினை ஆவணம் எண். 1120/1988 பொள்ளாச்சி சார்பதிவாளர் அலுவலகம்.
    சுப்பைய கவுண்டர் பெயரில் அமைந்த நிலம்.
    நில அளவு: S.F.No. 245/1B மற்றும் 245/3A2 மொத்தம் 4.57 ஏக்கர் (Item 1: 1.84 ஏக்கர், Item 2: 2.57 ஏக்கர்)
    எல்லைகள்: வடக்கு நட்ராஜ் நிலம், தெற்கு இட்டேரி பாதை, கிழக்கு சுப்பைய கவுண்டர் நிலம், மேற்கு SF 244 எல்லை.
    """

    source_extracted = extract_text_from_source(ocr_sample_text.encode("utf-8"), "DOC_2001.txt")
    assert source_extracted.has_tamil is True
    assert len(source_extracted.pages) == 2

    # 3. Extract and translate Tamil data to English
    output = mock_heuristic_extractor(fields, table_groups, [source_extracted])
    assert len(output.fields) == len(fields)

    # Verify values are in English
    val_map = {f.field_id: f.value for f in output.fields if f.value}
    orig_map = {f.original_text: f.value for f in output.fields if f.value}

    assert any("K.MUTHULAKSHMI" in (v or "") for v in orig_map.values())
    assert any("4.57 Acres" in (v or "") for v in orig_map.values())
    assert any("Pollachi" in (v or "") for v in orig_map.values())

    # 4. Replace in template and verify completed document
    table_records = {}
    if output.table_groups:
        table_records[output.table_groups[0].group_id] = output.table_groups[0].records

    out_bio, c_type = apply_field_values_universal(
        template_source=tpl_bytes,
        filename="Legal_Opinion.docx",
        fields=fields,
        field_values=val_map,
        table_group_records=table_records,
        clear_highlight=True
    )

    out_bytes = out_bio.getvalue()
    assert len(out_bytes) > 2000

    # Verify no yellow highlights remain in final replaced document
    doc_final, rem_fields, rem_tables = detect_yellow_highlights(out_bytes)
    assert len(rem_fields) == 0

