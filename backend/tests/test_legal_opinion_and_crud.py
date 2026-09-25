"""
Test Suite: Bank Legal Opinion & Title Search Report Template,
Template Management CRUD, and Document Generation History API.
"""

import pytest
import pytest_asyncio
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import init_db
from backend.app.core.samples import generate_legal_opinion_title_report_template
from backend.app.core.doc_processor import detect_yellow_highlights


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    await init_db()


def test_generate_legal_opinion_template_highlight_detection():
    bio = generate_legal_opinion_title_report_template()
    raw_bytes = bio.getvalue()
    assert len(raw_bytes) > 2000

    doc, fields, table_groups = detect_yellow_highlights(raw_bytes)
    assert len(fields) > 10
    assert len(table_groups) >= 2  # Documents scrutinized table + Property description table

    # Verify key highlighted runs detected
    orig_texts = [f.original_text for f in fields]
    assert any("08.07.2026" in t for t in orig_texts)
    assert any("Vanjiyapuram Pirivu" in t for t in orig_texts)
    assert any("K.MUTHULAKSHMI" in t for t in orig_texts)
    assert any("4.57 Acres" in t for t in orig_texts)
    assert any("Sale deed executed by Murugesan" in t for t in orig_texts)
    assert any("The properties in S.F.No.245/1B measuring an extent of 0.16 Acres" in t for t in orig_texts)
    assert any("K.KANDAKUMARRAJ" in t for t in orig_texts)


def test_legal_opinion_sample_endpoints():
    client = TestClient(app)

    # 1. Download Legal Opinion sample .docx
    res_dl = client.get("/api/samples/legal_opinion_template.docx")
    assert res_dl.status_code == 200
    assert len(res_dl.content) > 2000

    # 2. Create session and load Legal Opinion preset
    sess_res = client.post("/api/sessions")
    assert sess_res.status_code == 200
    session_id = sess_res.json()["session_id"]

    load_res = client.post(f"/api/sessions/{session_id}/load-legal-opinion-sample")
    assert load_res.status_code == 200
    load_data = load_res.json()
    assert load_data["template_filename"] == "Legal_Opinion_Title_Search_Report_Template.docx"
    assert len(load_data["fields"]) > 10
    assert len(load_data["table_groups"]) >= 2
    assert len(load_data["sources"]) == 1


def test_template_library_crud_endpoints():
    client = TestClient(app)

    # 1. Create a session, load a template, and save to template library
    sess_res = client.post("/api/sessions")
    session_id = sess_res.json()["session_id"]
    client.post(f"/api/sessions/{session_id}/load-legal-opinion-sample")

    save_res = client.post("/api/templates", data={
        "session_id": session_id,
        "name": "Custom_Title_Opinion_Template.docx"
    })
    assert save_res.status_code == 200
    legal_tpl = save_res.json()
    assert legal_tpl["name"] == "Custom_Title_Opinion_Template.docx"
    assert legal_tpl["fields_count"] > 10

    # 2. Get template detail
    detail_res = client.get(f"/api/templates/{legal_tpl['id']}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert len(detail_data["fields"]) > 10
    assert len(detail_data["table_groups"]) >= 2

    # 3. Download template file
    dl_res = client.get(f"/api/templates/{legal_tpl['id']}/download")
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 1000

    # 4. Rename template
    new_name = "Bank_of_Maharashtra_Title_Report_Pollachi.docx"
    rename_res = client.patch(f"/api/templates/{legal_tpl['id']}", json={"name": new_name})
    assert rename_res.status_code == 200
    assert rename_res.json()["name"] == new_name

    # 5. Use template in new session (skipping re-parsing)
    use_res = client.post(f"/api/templates/{legal_tpl['id']}/use")
    assert use_res.status_code == 200
    use_data = use_res.json()
    assert use_data["session_id"]
    assert use_data["template_filename"] == new_name
    assert use_data["fields_count"] > 10

    # 6. Delete template
    del_res = client.delete(f"/api/templates/{legal_tpl['id']}")
    assert del_res.status_code == 200

    # Verify deleted
    get_del = client.get(f"/api/templates/{legal_tpl['id']}")
    assert get_del.status_code == 404


def test_document_history_crud_endpoints():
    client = TestClient(app)

    # 1. Create a session, load Legal Opinion, and export to create a history record
    sess_res = client.post("/api/sessions")
    session_id = sess_res.json()["session_id"]

    client.post(f"/api/sessions/{session_id}/load-legal-opinion-sample")
    exp_res = client.post(f"/api/sessions/{session_id}/export", json={
        "field_values": {
            "p_date": "08.07.2026",
            "p_borrower": "K.MUTHULAKSHMI, W/o G.Kumar"
        }
    })
    assert exp_res.status_code == 200

    # 2. List history
    hist_list_res = client.get("/api/history")
    assert hist_list_res.status_code == 200
    hist_items = hist_list_res.json()
    assert len(hist_items) >= 1

    first_item = hist_items[0]
    assert first_item["template_filename"] == "Legal_Opinion_Title_Search_Report_Template.docx"

    # 3. Get history detail
    detail_res = client.get(f"/api/history/{first_item['id']}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["template_filename"] == first_item["template_filename"]
    assert "p_date" in detail_data["field_values"]

    # 4. Download generated history document
    dl_res = client.get(f"/api/history/{first_item['id']}/download")
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 1000

    # 5. Delete single history record
    del_res = client.delete(f"/api/history/{first_item['id']}")
    assert del_res.status_code == 200

    # 6. Clear all history
    clear_res = client.delete("/api/history")
    assert clear_res.status_code == 200
    assert len(client.get("/api/history").json()) == 0
