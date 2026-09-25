"""
Unit & Integration Tests for Intelligent Legal Template Question Answering
Tests dynamic template extraction, multi-document evidence indexing,
strict zero-hallucination responses, conflict detection, chronology/encumbrance
synthesis, and API workflows.
"""

import pytest
import io
import json
from io import BytesIO
from docx import Document
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.core.qa_engine import (
    extract_template_questions,
    build_document_index,
    generate_grounded_answer,
    generate_qa_report,
    classify_question,
    TemplateQuestion,
    QuestionLocation
)
from backend.app.core.source_extractor import ExtractedSourceDocument, SourceDocumentPage


def create_mock_template_docx() -> bytes:
    """Creates a sample legal scrutiny template in .docx format."""
    doc = Document()
    doc.add_heading("LEGAL TITLE SCRUTINY REPORT", level=1)
    
    # Section 1: Property Particulars
    doc.add_heading("1. PARTICULARS OF PROPERTY", level=2)
    p1 = doc.add_paragraph("Name of Borrower: ________________________")
    p2 = doc.add_paragraph("Survey Number of Property: ________________________")
    p3 = doc.add_paragraph("Total Extent of Property: ________________________")
    
    # Section 2: Detailed Scrutiny Checklist
    doc.add_heading("2. DETAILED SCRUTINY CHECKLIST", level=2)
    table = doc.add_table(rows=1, cols=3)
    table.style = 'Table Grid'
    hdr = table.rows[0].cells
    hdr[0].text = "Item No."
    hdr[1].text = "Checklist Question / Particulars"
    hdr[2].text = "Remarks / Compliance"
    
    checklist_data = [
        ("1.", "Whether the chain of title for 30 years is complete without missing links?", ""),
        ("2.", "Whether there are any prior subsisting encumbrances or mortgages over the property?", ""),
        ("3.", "Whether revenue records such as Patta, Chitta, and Adangal are produced to prove possession?", ""),
        ("4.", "Whether sanctioned building plan for a 10-story commercial tower was approved by CMDA?", ""),
        ("5.", "Whether proceedings under SARFAESI Act are enforceable against the agricultural land?", ""),
    ]
    
    for item_no, q_txt, ans in checklist_data:
        row = table.add_row().cells
        row[0].text = item_no
        row[1].text = q_txt
        row[2].text = ans
        
    out = BytesIO()
    doc.save(out)
    return out.getvalue()


def create_mock_source_docs() -> list[ExtractedSourceDocument]:
    """Creates sample extracted source legal documents (deeds, EC, Patta)."""
    # 1. Sale deed 1987
    doc1 = ExtractedSourceDocument(
        filename="Sale_Deed_1277_1987.pdf",
        file_type="pdf",
        char_count=500,
        page_or_section_count=2,
        full_text="",
        is_scanned_ocr=False,
        has_tamil=False,
        pages=[
            SourceDocumentPage(
                page_number=1,
                text="Sale deed Doc No. 1277/1987 executed on 05.05.1987 by Murugesan in favour of Gopalan. "
                     "Conveying land in S.F.No. 245/1B measuring an extent of 0.16 Acres situated at Mannur Village, Pollachi.",
                is_ocr=False,
                char_count=200,
                has_tamil=False
            ),
            SourceDocumentPage(
                page_number=2,
                text="Boundaries: North by Ammasai Gounder land, South by Road, East by Cart Track, West by Channel.",
                is_ocr=False,
                char_count=100,
                has_tamil=False
            )
        ]
    )
    
    # 2. Mortgage Deed 2001 & Discharge Receipt 2007
    doc2 = ExtractedSourceDocument(
        filename="Encumbrance_Certificate_2026.pdf",
        file_type="pdf",
        char_count=600,
        page_or_section_count=1,
        full_text="",
        is_scanned_ocr=False,
        has_tamil=False,
        pages=[
            SourceDocumentPage(
                page_number=1,
                text="Encumbrance Certificate ECA/Online/No.195476108/2026 from 01.01.1987 to 25.06.2026. "
                     "Entry 1: 16.11.1987 Sale deed Doc No. 2860/1987 Murugesan to Gopalan. "
                     "Entry 2: 11.07.2001 Mortgage Deed Doc No. 2001/2001 executed by Gopalan in favour of Primary Co-op Society. "
                     "Entry 3: 11.01.2007 Discharge Receipt Doc No. 2007/2007 executed by Primary Co-op Society in favour of Gopalan. "
                     "No other subsisting encumbrance found.",
                is_ocr=False,
                char_count=450,
                has_tamil=False
            )
        ]
    )

    # 3. Revenue Records & Possession (Tamil)
    doc3 = ExtractedSourceDocument(
        filename="Patta_Chitta_Mannur.pdf",
        file_type="pdf",
        char_count=400,
        page_or_section_count=1,
        full_text="",
        is_scanned_ocr=True,
        has_tamil=True,
        pages=[
            SourceDocumentPage(
                page_number=1,
                text="தமிழ்நாடு அரசு வருவாய்த்துறை. Computerized Chitta and Adangal for S.F.No. 245/1B and 245/3A2 "
                     "in Mannur Village standing in the name of Muthulakshmi. Possession Certificate issued by VAO.",
                is_ocr=True,
                char_count=250,
                has_tamil=True
            )
        ]
    )

    return [doc1, doc2, doc3]


# ---------------------------------------------------------------------------
# Core Engine Tests
# ---------------------------------------------------------------------------
def test_dynamic_template_question_extraction():
    """Verifies dynamic extraction of paragraphs and table questions without hardcoding."""
    docx_bytes = create_mock_template_docx()
    questions = extract_template_questions(docx_bytes, "scrutiny_template.docx")
    
    assert len(questions) >= 7
    # Verify both placeholders and table rows were extracted
    types = [q.question_type for q in questions]
    assert "SURVEY_NUMBER" in types
    assert "PROPERTY_EXTENT" in types
    
    # Check that section names were mapped
    sections = set(q.section for q in questions)
    assert any("PARTICULARS" in s for s in sections)
    assert any("CHECKLIST" in s for s in sections)


def test_question_classifier():
    """Tests dynamic categorization across legal types."""
    assert classify_question("What is the S.F.No. of the land?") == "SURVEY_NUMBER"
    assert classify_question("Extent of area in acres") == "PROPERTY_EXTENT"
    assert classify_question("Four boundaries of the subject property") == "BOUNDARY"
    assert classify_question("Details of discharge receipt or release deed") == "DISCHARGE"
    assert classify_question("Whether SARFAESI proceedings are applicable") == "COMPLIANCE"
    assert classify_question("Has the mortgage been cleared?") == "MORTGAGE"


def test_strict_zero_hallucination_on_missing_evidence():
    """
    CRITICAL INVARIANT:
    If evidence is missing, AI strictly outputs 'Not found in the provided documents.'
    with status 'not_found' and confidence 0.0. Never invents missing permits.
    """
    source_docs = create_mock_source_docs()
    index = build_document_index(source_docs)

    missing_q = TemplateQuestion(
        id="q_missing",
        section="Permits",
        question_text="Whether sanctioned building plan for a 10-story commercial tower was approved by CMDA?",
        question_type="CONSTRUCTION_APPROVAL",
        location=QuestionLocation(location_type="paragraph", paragraph_index=0)
    )

    ans = generate_grounded_answer(missing_q, index)
    assert ans.answer == "Not found in the provided documents."
    assert ans.status == "not_found"
    assert ans.confidence == 0.0
    assert len(ans.evidence) == 0


def test_grounded_survey_and_extent_answers():
    """Verifies facts are correctly extracted and cited from source docs."""
    source_docs = create_mock_source_docs()
    index = build_document_index(source_docs)

    q_sf = TemplateQuestion(
        id="q_sf",
        section="Particulars",
        question_text="Survey Number of Property:",
        question_type="SURVEY_NUMBER",
        location=QuestionLocation(location_type="placeholder", paragraph_index=1)
    )
    ans_sf = generate_grounded_answer(q_sf, index)
    assert "245/1B" in ans_sf.answer
    assert ans_sf.status == "supported"
    assert len(ans_sf.evidence) > 0
    assert ans_sf.evidence[0].document_name == "Sale_Deed_1277_1987.pdf"
    assert ans_sf.evidence[0].page_number == 1


def test_chronology_and_encumbrance_synthesis():
    """Verifies detection of mortgage creation and subsequent discharge receipt."""
    source_docs = create_mock_source_docs()
    index = build_document_index(source_docs)

    q_enc = TemplateQuestion(
        id="q_enc",
        section="Checklist",
        question_text="Whether there are any prior subsisting encumbrances or mortgages over the property?",
        question_type="ENCUMBRANCE",
        location=QuestionLocation(location_type="table_cell", table_index=0, row_index=2, answer_col_index=2)
    )
    ans_enc = generate_grounded_answer(q_enc, index)
    assert "discharged" in ans_enc.answer.lower()
    assert "no subsisting encumbrance" in ans_enc.answer.lower()
    assert ans_enc.compliance_status == "Complied"


def test_conflict_detection():
    """
    CRITICAL INVARIANT:
    When two documents claim conflicting survey numbers, marks CONFLICT DETECTED
    and retains both sources side-by-side.
    """
    # Doc A has 245/1B
    docA = ExtractedSourceDocument(
        filename="DocA.pdf",
        file_type="pdf",
        char_count=150,
        page_or_section_count=1,
        full_text="",
        is_scanned_ocr=False,
        has_tamil=False,
        pages=[SourceDocumentPage(page_number=1, text="Property is located in S.F.No. 245/1B", is_ocr=False, char_count=50, has_tamil=False)]
    )
    # Doc B has conflicting S.F.No. 245/1A
    docB = ExtractedSourceDocument(
        filename="DocB.pdf",
        file_type="pdf",
        char_count=150,
        page_or_section_count=1,
        full_text="",
        is_scanned_ocr=False,
        has_tamil=False,
        pages=[SourceDocumentPage(page_number=1, text="Property is located in S.F.No. 245/1A", is_ocr=False, char_count=50, has_tamil=False)]
    )

    index = build_document_index([docA, docB])
    q_sf = TemplateQuestion(
        id="q_conflict",
        section="Particulars",
        question_text="Survey Number of Property:",
        question_type="SURVEY_NUMBER",
        location=QuestionLocation(location_type="placeholder", paragraph_index=1)
    )

    ans = generate_grounded_answer(q_sf, index)
    assert ans.status == "conflict_detected"
    assert "CONFLICT DETECTED" in ans.answer
    assert ans.conflict is not None
    assert len(ans.conflict.sources) == 2


def test_report_generation():
    """Verifies that approved answers populate into the .docx document cleanly."""
    docx_bytes = create_mock_template_docx()
    questions = extract_template_questions(docx_bytes, "template.docx")
    
    source_docs = create_mock_source_docs()
    index = build_document_index(source_docs)
    answers = [generate_grounded_answer(q, index) for q in questions]

    populated_docx_bytes = generate_qa_report(docx_bytes, answers)
    assert len(populated_docx_bytes) > len(docx_bytes) * 0.8

    # Re-read docx to check content
    populated_doc = Document(BytesIO(populated_docx_bytes))
    full_text = "\n".join(p.text for p in populated_doc.paragraphs)
    assert "245/1B" in full_text or any("245/1B" in c.text for t in populated_doc.tables for row in t.rows for c in row.cells)


from backend.app.db.database import init_db

# ---------------------------------------------------------------------------
# API Integration Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_full_qa_api_workflow():
    """Tests the complete end-to-end API lifecycle for Template QA."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Session
        res1 = await client.post("/api/qa/sessions/create")
        assert res1.status_code == 200
        session_id = res1.json()["session_id"]
        assert session_id

        # 2. Upload Template
        docx_bytes = create_mock_template_docx()
        files = {"file": ("scrutiny_template.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        res2 = await client.post(f"/api/qa/sessions/{session_id}/upload-template", files=files)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["questions_count"] >= 7
        assert len(data2["sections"]) >= 2

        # 3. Upload Sources
        source_files = [
            ("files", ("Deed_1987.txt", b"Sale deed Doc No. 1277/1987 Murugesan to Gopalan for S.F.No. 245/1B measuring 0.16 Acres.", "text/plain")),
            ("files", ("EC_2026.txt", b"Encumbrance Certificate. 11.07.2001 Mortgage Doc 2001/2001. 11.01.2007 Discharge Receipt Doc 2007/2007.", "text/plain"))
        ]
        res3 = await client.post(f"/api/qa/sessions/{session_id}/upload-sources", files=source_files)
        assert res3.status_code == 200
        assert res3.json()["documents_count"] == 2

        # 4. Run Intelligent QA
        res4 = await client.post(f"/api/qa/sessions/{session_id}/run-qa")
        assert res4.status_code == 200
        qa_data = res4.json()
        assert qa_data["supported_count"] >= 1
        assert len(qa_data["answers"]) >= 7

        # 5. Fetch Session State
        res5 = await client.get(f"/api/qa/sessions/{session_id}/state")
        assert res5.status_code == 200
        state = res5.json()
        assert state["status"] == "qa_completed"

        # 6. Human Review / Edit Answer
        first_q_id = qa_data["answers"][0]["question_id"]
        update_payload = {
            "answer": "K. MUTHULAKSHMI (Human Verified & Approved)",
            "compliance_status": "Complied",
            "status": "user_edited",
            "verification_badge": "Human Verified",
            "user_notes": "Verified against Title Deed"
        }
        res6 = await client.put(f"/api/qa/sessions/{session_id}/answers/{first_q_id}", json=update_payload)
        assert res6.status_code == 200
        assert res6.json()["verification_badge"] == "Human Verified"

        # 7. Bulk Approve All
        res7 = await client.post(f"/api/qa/sessions/{session_id}/approve-all")
        assert res7.status_code == 200

        # 8. Generate Completed Report
        res8 = await client.post(f"/api/qa/sessions/{session_id}/generate-report")
        assert res8.status_code == 200
        assert "download-report" in res8.json()["download_url"]

        # 9. Download Report
        res9 = await client.get(f"/api/qa/sessions/{session_id}/download-report")
        assert res9.status_code == 200
        assert res9.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert len(res9.content) > 1000
