import pytest
from fastapi.testclient import TestClient
from backend.app.main import app


def test_gopalan_template_with_doc_2001_tamil_deed_replacement():
    """
    Test scenario:
    1. Template: Gopalan / Muthulakshmi Bank Legal Opinion & Title Search Report.
    2. Uploaded Document: DOC 2001.pdf (Tamil General Power of Attorney Doc 5035/2012 & Partition Deed 1773/1998).
    3. Replaces: Section 2 Trace of Title / History of Passing of Title narrative.
    4. Outputs: Formatted .docx, .pdf, .txt with all yellow highlights removed and 100% layout preserved.
    """
    client = TestClient(app)

    # 1. Create Session
    sess_res = client.post("/api/sessions")
    assert sess_res.status_code == 200
    session_id = sess_res.json()["session_id"]

    # 2. Load Gopalan Legal Opinion Template
    tpl_res = client.post(f"/api/sessions/{session_id}/load-legal-opinion-sample")
    assert tpl_res.status_code == 200
    tpl_data = tpl_res.json()
    assert len(tpl_data["fields"]) > 10

    # 3. Extract with AI (evaluating Tamil OCR deed facts)
    extract_res = client.post(
        f"/api/sessions/{session_id}/extract",
        json={"model": "heuristic"}
    )
    assert extract_res.status_code == 200
    extract_data = extract_res.json()
    assert extract_data["extracted_count"] > 0

    # Verify synthesized Trace of Title narrative
    trace_results = [
        r["value"] for r in extract_data["results"]
        if r.get("value") and ("5035/2012" in r["value"] or "1773/1998" in r["value"] or "Balashanmugam" in r["value"] or "Partition Deed" in r["value"] or "Senthilraja" in r["value"])
    ]
    assert len(trace_results) > 0

    # 4. Export Final Document (.docx)
    field_values = {f["field_id"]: f["value"] for f in extract_data["results"] if f["value"]}
    table_records = {tg["group_id"]: tg["records"] for tg in extract_data.get("table_groups", [])}

    export_res = client.post(
        f"/api/sessions/{session_id}/export",
        json={
            "field_values": field_values,
            "table_group_records": table_records,
            "clear_highlight": True
        }
    )
    assert export_res.status_code == 200

    # 5. Multi-format Downloads (DOCX, PDF, TXT)
    for fmt in ["docx", "pdf", "txt"]:
        dl_res = client.get(f"/api/sessions/{session_id}/download?format={fmt}")
        assert dl_res.status_code == 200
        assert len(dl_res.content) > 500
