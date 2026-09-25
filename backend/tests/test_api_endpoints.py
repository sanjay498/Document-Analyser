"""
API Endpoint integration tests for Doc Filler AI (Phase 2).
"""

import pytest
from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.core.samples import (
    generate_sample_template,
    generate_sample_source_doc_1,
    generate_sample_source_doc_2
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "doc-filler-ai"

    # Also test /api/health
    api_health = client.get("/api/health")
    assert api_health.status_code == 200
    assert api_health.json()["status"] == "healthy"

    # Test /api/metrics
    metrics = client.get("/api/metrics")
    assert metrics.status_code == 200
    m_data = metrics.json()
    assert m_data["status"] == "operational"
    assert m_data["deed_models"]["total_models"] == 32
    assert "gemini-3.6-flash (Free)" in m_data["ai_engine"]["supported_models"]


def test_full_pipeline_flow_with_conflicts_and_tables(client):
    # 1. Create session
    res = client.post("/api/sessions")
    assert res.status_code == 200
    session_id = res.json()["session_id"]
    assert session_id

    # 2. Upload template (.docx)
    tpl_bytes = generate_sample_template().getvalue()
    files = {
        "file": ("MSA_Template_Dynamic_Milestones.docx", tpl_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }
    res_tpl = client.post(f"/api/sessions/{session_id}/template", files=files)
    assert res_tpl.status_code == 200
    tpl_data = res_tpl.json()
    assert tpl_data["fields_count"] > 0
    assert tpl_data["table_groups_count"] >= 1
    fields = tpl_data["fields"]
    assert any(f.get("is_table_cell") for f in fields)

    # 3. Upload 2 source documents (.docx) with intentional conflict (30 days vs 60 days)
    src1_bytes = generate_sample_source_doc_1().getvalue()
    src2_bytes = generate_sample_source_doc_2().getvalue()
    files_src = [
        ("files", ("Primary_SOW.docx", src1_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
        ("files", ("Vendor_RFP.docx", src2_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
    ]
    res_src = client.post(f"/api/sessions/{session_id}/sources", files=files_src)
    assert res_src.status_code == 200
    src_data = res_src.json()
    assert src_data["sources_count"] == 2

    # 4. Run AI field extraction
    res_ext = client.post(f"/api/sessions/{session_id}/extract", json={})
    assert res_ext.status_code == 200
    ext_data = res_ext.json()
    assert ext_data["total_fields"] == tpl_data["fields_count"]
    assert len(ext_data["results"]) == ext_data["total_fields"]
    assert len(ext_data["table_groups"]) >= 1

    # Check that at least one conflict was detected between the 2 source docs!
    assert ext_data["conflict_count"] >= 1
    conflict_field = next(r for r in ext_data["results"] if r["status"] == "conflict")
    assert len(conflict_field["conflicts"]) >= 2

    # 5. Export final docx after resolving all fields
    resolved_values = {}
    for r in ext_data["results"]:
        if r["status"] == "conflict":
            # Pick first option
            resolved_values[r["field_id"]] = r["conflicts"][0]["value"]
        elif r["value"]:
            resolved_values[r["field_id"]] = r["value"]
        else:
            resolved_values[r["field_id"]] = "Manual Resolved Value"

    table_records = {}
    for tg in ext_data["table_groups"]:
        table_records[tg["group_id"]] = tg["records"]

    res_exp = client.post(
        f"/api/sessions/{session_id}/export",
        json={
            "field_values": resolved_values,
            "table_group_records": table_records,
            "clear_highlight": True
        }
    )
    assert res_exp.status_code == 200
    exp_data = res_exp.json()
    assert exp_data["status"] == "success"

    # 6. Download final docx
    res_dl = client.get(f"/api/sessions/{session_id}/download")
    assert res_dl.status_code == 200
    assert len(res_dl.content) > 0


def test_load_sample_preset_endpoint(client):
    res = client.post("/api/sessions")
    session_id = res.json()["session_id"]

    res_preset = client.post(f"/api/sessions/{session_id}/load-sample")
    assert res_preset.status_code == 200
    data = res_preset.json()
    assert len(data["fields"]) > 0
    assert len(data["table_groups"]) >= 1
    assert len(data["sources"]) == 2


def test_validate_google_key_endpoint(client):
    # Test validation endpoint with configured key
    res = client.get("/api/validate-google-key")
    assert res.status_code == 200
    data = res.json()
    assert "valid" in data
    if data["valid"]:
        assert "model" in data
        assert "Gemini" in data.get("provider", "")
    else:
        # Sandboxed or offline environment without internet access
        assert "error" in data

    # Test with invalid key
    res_bad = client.post("/api/validate-google-key", json={"api_key": "bad_invalid_key_12345"})
    assert res_bad.status_code == 200
    data_bad = res_bad.json()
    assert data_bad["valid"] is False
    assert "error" in data_bad

