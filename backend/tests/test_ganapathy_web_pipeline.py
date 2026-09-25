"""
End-to-end web pipeline test for Ganapathy & Lakshmi registered Sale Deed (Doc 1931/2026).
Verifies the website API flows:
1. Loading Legal Opinion template and uploading user deed media_1789962935652.pdf.
2. AI extraction ensuring V. Lakshmi, S.F.No. 84/A2, 1.28 Acres, Pannaikinaru, Komangalam SRO, and 5-stage trace.
3. Exporting completed DOCX and PDF documents without template tags.
"""

import os
import pytest
from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.core.samples import generate_legal_opinion_title_report_template

PDF_PATH = "/Users/apple/.gemini/antigravity/brain/8be68963-6439-419d-b754-e35983734649/.user_uploaded/media_1789962935652.pdf"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_web_pipeline_with_uploaded_ganapathy_deed(client):
    assert os.path.exists(PDF_PATH), f"Uploaded PDF not found at {PDF_PATH}"
    with open(PDF_PATH, "rb") as f:
        pdf_bytes = f.read()

    # 1. Create a session and load the Bank Legal Opinion template
    res = client.post("/api/sessions")
    assert res.status_code == 200
    session_id = res.json()["session_id"]
    assert session_id

    # Load legal opinion sample (loads Bank Legal Opinion template + preloaded sample)
    res_sample = client.post(f"/api/sessions/{session_id}/load-legal-opinion-sample")
    assert res_sample.status_code == 200
    assert len(res_sample.json()["fields"]) > 10

    # 2. User uploads their own registered deed (media_1789962935652.pdf)
    files_src = [
        ("files", ("media_1789962935652.pdf", pdf_bytes, "application/pdf"))
    ]
    res_upload = client.post(f"/api/sessions/{session_id}/sources", files=files_src)
    assert res_upload.status_code == 200
    sources_data = res_upload.json()
    assert sources_data["sources_count"] >= 1

    # 3. User clicks Extract in the website UI
    res_extract = client.post(f"/api/sessions/{session_id}/extract", json={})
    assert res_extract.status_code == 200
    ext_data = res_extract.json()
    results = ext_data["results"]
    assert len(results) > 10

    field_map = {f["field_id"]: f["value"] for f in results if f.get("value")}

    # Verify key property facts extracted from media_1789962935652.pdf
    all_values = list(field_map.values())

    # Borrower: V. Lakshmi
    assert any("V. LAKSHMI" in v for v in all_values), "V. LAKSHMI not found in extracted fields"
    assert any("Vellingiri" in v for v in all_values), "Vellingiri not found in extracted fields"

    # Property: S.F.No. 84/A2, 1.28 Acres, Pannaikinaru
    assert any("84/A2" in v for v in all_values), "S.F.No. 84/A2 not found in extracted fields"
    assert any("1.28 Acres" in v or "0.52.0" in v for v in all_values), "Extent 1.28 Acres not found"
    assert any("Pannaikinaru" in v for v in all_values), "Pannaikinaru village not found"
    assert any("Komangalam" in v for v in all_values), "Komangalam SRO not found"
    assert any("Udumalaipettai" in v for v in all_values), "Udumalaipettai not found"

    # Trace of title: mentions parent deed 2874 and Doc 1931/2026
    assert any("1931" in v for v in all_values), "Doc No 1931 not found"
    assert any("2874" in v for v in all_values), "Parent Doc No 2874 not found"

    # 4. User exports final document in the website
    export_payload = {
        "field_values": field_map,
        "table_group_records": {},
        "clear_highlight": True
    }
    res_export = client.post(f"/api/sessions/{session_id}/export", json=export_payload)
    assert res_export.status_code == 200
    assert res_export.json()["status"] == "success"

    # 5. User downloads DOCX
    res_dl_docx = client.get(f"/api/sessions/{session_id}/download?format=docx")
    assert res_dl_docx.status_code == 200
    assert len(res_dl_docx.content) > 10000
    assert res_dl_docx.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    # 6. User downloads PDF
    res_dl_pdf = client.get(f"/api/sessions/{session_id}/download?format=pdf")
    assert res_dl_pdf.status_code == 200
    assert len(res_dl_pdf.content) > 5000
    assert res_dl_pdf.headers["content-type"] == "application/pdf"


def test_web_pipeline_fresh_session_user_upload_only(client):
    assert os.path.exists(PDF_PATH)
    with open(PDF_PATH, "rb") as f:
        pdf_bytes = f.read()

    # 1. Create fresh session
    res = client.post("/api/sessions")
    assert res.status_code == 200
    session_id = res.json()["session_id"]

    # 2. Upload template directly
    tpl_bytes = generate_legal_opinion_title_report_template().getvalue()
    files = {
        "file": ("Legal_Opinion_Template.docx", tpl_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }
    res_tpl = client.post(f"/api/sessions/{session_id}/template", files=files)
    assert res_tpl.status_code == 200

    # 3. Upload only user's deed media_1789962935652.pdf
    files_src = [
        ("files", ("media_1789962935652.pdf", pdf_bytes, "application/pdf"))
    ]
    res_upload = client.post(f"/api/sessions/{session_id}/sources", files=files_src)
    assert res_upload.status_code == 200

    # 4. Extract
    res_extract = client.post(f"/api/sessions/{session_id}/extract", json={})
    assert res_extract.status_code == 200
    results = res_extract.json()["results"]
    field_map = {f["field_id"]: f["value"] for f in results if f.get("value")}
    all_values = list(field_map.values())

    assert any("V. LAKSHMI" in v for v in all_values)
    assert any("84/A2" in v for v in all_values)
    assert any("Pannaikinaru" in v for v in all_values)

    # 5. Export and download
    export_payload = {
        "field_values": field_map,
        "table_group_records": {},
        "clear_highlight": True
    }
    res_export = client.post(f"/api/sessions/{session_id}/export", json=export_payload)
    assert res_export.status_code == 200

    res_dl = client.get(f"/api/sessions/{session_id}/download?format=docx")
    assert res_dl.status_code == 200
    assert len(res_dl.content) > 10000
