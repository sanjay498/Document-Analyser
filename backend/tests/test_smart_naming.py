import pytest
import io
import json
import uuid
from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.core.naming import (
    detect_bank_and_doc_type,
    generate_smart_template_name,
    generate_smart_document_name,
    clean_party_for_filename,
    clean_filename
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_detect_bank_and_doc_type():
    # Test bank detection
    bank, dtype = detect_bank_and_doc_type("We submit this Legal Opinion on behalf of Canara Bank")
    assert bank == "Canara Bank"
    assert dtype == "Legal Opinion"

    # Test SBI and Title Scrutiny Report
    bank, dtype = detect_bank_and_doc_type("State Bank of India Title Scrutiny Report for loan scrutiny")
    assert bank == "SBI"
    assert dtype == "Title Scrutiny Report"

    # Test filename detection fallback with underscores
    bank, dtype = detect_bank_and_doc_type("", "HDFC_Bank_Search_Report.docx")
    assert bank == "HDFC Bank"
    assert dtype == "Search Report"


def test_generate_smart_template_name():
    # Auto-named template with bank
    tpl1 = generate_smart_template_name(bank="Canara Bank", doc_type="Legal Opinion")
    assert tpl1 == "Canara Bank Legal Opinion Template.docx"

    # Auto-named template with SBI
    tpl2 = generate_smart_template_name(bank="SBI", doc_type="Title Scrutiny Report")
    assert tpl2 == "SBI Title Scrutiny Report Template.docx"

    # Auto-named template with General / no bank
    tpl3 = generate_smart_template_name(bank="General", doc_type="Legal Opinion")
    assert tpl3 == "Legal Opinion Template.docx"

    # Auto-named template detected from filename
    tpl4 = generate_smart_template_name(original_filename="Indian_Bank_Title_Opinion.docx")
    assert "Indian Bank" in tpl4
    assert tpl4.endswith(".docx")


def test_generate_smart_document_name():
    # Borrower and DocType
    name1 = generate_smart_document_name(borrower_name="Mr. Suresh Kumar", doc_type="Legal_Opinion")
    assert name1 == "Legal_Opinion_Suresh_Kumar.docx"

    # Bank, DocType, and Borrower
    name2 = generate_smart_document_name(borrower_name="R. Gopalan", bank="SBI", doc_type="Legal_Opinion")
    assert name2 == "SBI_Legal_Opinion_R_Gopalan.docx"

    # Strip parentage/spouse and honorifics
    name3 = generate_smart_document_name(
        borrower_name="Thiru Balashanmugam, S/o Ramasamy",
        bank="Canara Bank",
        doc_type="Title_Scrutiny_Report"
    )
    assert name3 == "Canara_Bank_Title_Scrutiny_Report_Balashanmugam.docx"

    # Template filename cleanup (stripping stale template author like Muthulakshmi)
    name4 = generate_smart_document_name(original_filename="Muthulakshmi Bank Legal Opinion Template.docx")
    assert "muthulakshmi" not in name4.lower()
    assert "template" not in name4.lower()
    assert name4.endswith(".docx")


def test_clean_filename():
    assert clean_filename("bad/file:name*?.docx") == "file_name.docx"
    assert clean_filename("my_document") == "my_document.docx"
    assert clean_filename("already.pdf") == "already.pdf"
    assert clean_filename("../../../secret.docx") == "secret.docx"


def test_session_rename_and_download_flow(client):
    # 1. Create a session and load sample preset
    sess_id = f"rename-test-{uuid.uuid4().hex[:8]}"
    res_sample = client.post(f"/api/sessions/{sess_id}/load-sample")
    assert res_sample.status_code == 200

    # 2. Extract fields (should auto-generate smart document name)
    res_extract = client.post(f"/api/sessions/{sess_id}/extract", json={})
    assert res_extract.status_code == 200
    ext_data = res_extract.json()
    assert "doc_custom_name" in ext_data
    assert ext_data["doc_custom_name"].endswith(".docx")

    # 3. Rename document via dedicated rename endpoint
    new_name = "Custom_SBI_Legal_Opinion_Karthik.docx"
    res_rename = client.post(
        f"/api/sessions/{sess_id}/rename",
        json={"filename": new_name}
    )
    assert res_rename.status_code == 200
    assert res_rename.json()["filename"] == new_name

    # 4. Save session as template (should auto-name cleanly)
    res_tpl = client.post(
        f"/api/sessions/{sess_id}/save-as-template",
        json={"bank_name": "SBI"}
    )
    assert res_tpl.status_code == 200
    tpl_name = res_tpl.json()["name"]
    assert "_completed" not in tpl_name
    assert "Template" in tpl_name

    # 5. Export document
    field_values = {}
    for r in ext_data["results"]:
        field_values[r["field_id"]] = r.get("value") or "Sample"
    res_export = client.post(
        f"/api/sessions/{sess_id}/export",
        json={"field_values": field_values, "doc_custom_name": new_name}
    )
    assert res_export.status_code == 200

    # 6. Download final document and verify Content-Disposition
    res_download = client.get(f"/api/sessions/{sess_id}/download")
    assert res_download.status_code == 200
    cd_header = res_download.headers.get("content-disposition", "")
    assert new_name in cd_header

    # 7. Download PDF format
    res_pdf = client.get(f"/api/sessions/{sess_id}/download?format=pdf")
    assert res_pdf.status_code == 200
    cd_pdf = res_pdf.headers.get("content-disposition", "")
    assert "Custom_SBI_Legal_Opinion_Karthik.pdf" in cd_pdf
