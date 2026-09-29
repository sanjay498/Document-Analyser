"""
Unit and Integration Tests for Client Management, Duplicate Detection,
and Scrutiny Association (Client -> Template -> Session -> History).
"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.db.database import init_db
from backend.app.core.samples import generate_legal_opinion_title_report_template
from backend.app.core.doc_processor import detect_yellow_highlights
import json


@pytest.mark.asyncio
async def test_client_validation_and_creation():
    """Validates required client fields and creates real client in DB."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Missing name
        res = await client.post("/api/clients", json={
            "name": "",
            "phone": "9876543210",
            "email": "test@example.com",
            "title": "Title Search"
        })
        assert res.status_code == 400
        assert "Name is required" in res.json()["detail"]

        # 2. Invalid email
        res = await client.post("/api/clients", json={
            "name": "Sanjay Raman",
            "phone": "9876543210",
            "email": "invalid-email",
            "title": "Title Search"
        })
        assert res.status_code == 400
        assert "valid Email" in res.json()["detail"]

        # 3. Missing phone
        res = await client.post("/api/clients", json={
            "name": "Sanjay Raman",
            "phone": "123",
            "email": "sanjay@example.com",
            "title": "Title Search"
        })
        assert res.status_code == 400
        assert "valid Phone" in res.json()["detail"]

        # 4. Valid client creation
        res = await client.post("/api/clients", json={
            "name": "R. K. Swaminathan",
            "phone": "9842112345",
            "email": "swaminathan@example.com",
            "title": "Title Scrutiny for S.F. No. 245/1B, Mannur Village"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["id"]
        assert data["name"] == "R. K. Swaminathan"
        assert data["phone"] == "9842112345"
        assert data["email"] == "swaminathan@example.com"
        assert data["title"] == "Title Scrutiny for S.F. No. 245/1B, Mannur Village"
        assert data["created_at"]
        assert data["updated_at"]
        assert data["scrutiny_count"] == 0


@pytest.mark.asyncio
async def test_check_existing_client_duplicate_detection():
    """Verifies duplicate checking by phone or email without silent overwrite."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create unique client
        unique_phone = f"98{uuid.uuid4().hex[:8]}"
        unique_email = f"client_{uuid.uuid4().hex[:6]}@lawfirm.in"

        res_create = await client.post("/api/clients", json={
            "name": "Gopalan Krishnan",
            "phone": unique_phone,
            "email": unique_email,
            "title": "Agricultural Title Verification"
        })
        assert res_create.status_code == 200
        client_id = res_create.json()["id"]

        # 1. Check with matching phone
        res_phone = await client.post("/api/clients/check-existing", json={
            "phone": unique_phone,
            "email": "different@lawfirm.in"
        })
        assert res_phone.status_code == 200
        phone_data = res_phone.json()
        assert phone_data["exists"] is True
        assert phone_data["client"]["id"] == client_id
        assert phone_data["client"]["name"] == "Gopalan Krishnan"

        # 2. Check with matching email (case insensitive)
        res_email = await client.post("/api/clients/check-existing", json={
            "phone": "9999999999",
            "email": unique_email.upper()
        })
        assert res_email.status_code == 200
        email_data = res_email.json()
        assert email_data["exists"] is True
        assert email_data["client"]["id"] == client_id

        # 3. Check non-existent
        res_none = await client.post("/api/clients/check-existing", json={
            "phone": "1111111111",
            "email": "doesnotexist@nowhere.com"
        })
        assert res_none.status_code == 200
        assert res_none.json()["exists"] is False
        assert res_none.json()["client"] is None


@pytest.mark.asyncio
async def test_client_list_and_search():
    """Tests real client listing and multi-field search filter."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        test_tag = uuid.uuid4().hex[:6]
        c1_name = f"Anand Narayanan {test_tag}"
        c2_name = f"Bala Subramanian {test_tag}"

        await client.post("/api/clients", json={
            "name": c1_name,
            "phone": f"91{uuid.uuid4().hex[:8]}",
            "email": f"anand_{test_tag}@test.com",
            "title": "Commercial Complex Scrutiny"
        })
        await client.post("/api/clients", json={
            "name": c2_name,
            "phone": f"92{uuid.uuid4().hex[:8]}",
            "email": f"bala_{test_tag}@test.com",
            "title": "Industrial Land Search"
        })

        # List all
        res_all = await client.get("/api/clients")
        assert res_all.status_code == 200
        all_clients = res_all.json()
        assert len(all_clients) >= 2
        names = [c["name"] for c in all_clients]
        assert c1_name in names
        assert c2_name in names

        # Search by specific name tag
        res_search1 = await client.get(f"/api/clients?search=Anand+{test_tag}")
        assert res_search1.status_code == 200
        results1 = res_search1.json()
        assert len(results1) == 1
        assert results1[0]["name"] == c1_name

        # Search by title keyword
        res_search2 = await client.get(f"/api/clients?search=Industrial")
        assert res_search2.status_code == 200
        results2 = res_search2.json()
        assert any(c["name"] == c2_name for c in results2)


@pytest.mark.asyncio
async def test_client_to_scrutiny_traceability():
    """
    Tests the complete relationship:
    Client -> Template -> Scrutiny Session -> Uploaded Documents -> AI Analysis -> Final Document.
    """
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Client
        res_c = await client.post("/api/clients", json={
            "name": "Muthulakshmi & G. Kumar",
            "phone": "9443123456",
            "email": "muthulakshmi@property.org",
            "title": "Pollachi Agricultural Land Scrutiny"
        })
        assert res_c.status_code == 200
        client_data = res_c.json()
        client_id = client_data["id"]

        # 2. Ensure a real Template exists in library
        res_templates = await client.get("/api/templates")
        templates = res_templates.json()
        if not templates:
            # Seed template
            tpl_bio = generate_legal_opinion_title_report_template()
            tpl_bytes = tpl_bio.getvalue()
            _, fields, tg = detect_yellow_highlights(tpl_bytes)
            files = {"file": ("Legal_Opinion_Master.docx", tpl_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
            res_save = await client.post("/api/templates", files=files, data={"name": "Legal_Opinion_Master.docx", "bank_name": "General"})
            template_id = res_save.json()["id"]
        else:
            template_id = templates[0]["id"]

        # 3. Start Scrutiny for Client with Template
        res_start = await client.post(f"/api/clients/{client_id}/start-scrutiny", json={
            "template_id": template_id
        })
        assert res_start.status_code == 200
        start_data = res_start.json()
        session_id = start_data["session_id"]
        assert session_id
        assert start_data["client_id"] == client_id
        assert start_data["template_id"] == template_id
        assert start_data["fields_count"] > 0

        # 4. Upload Source Documents
        source_files = [
            ("files", ("Sale_Deed_1987.txt", b"Sale Deed Doc No. 1277/1987 Murugesan to Gopalan for S.F.No. 245/1B measuring 0.16 Acres.", "text/plain")),
            ("files", ("Patta_Passbook.txt", b"Patta No. 512 standing in the name of Muthulakshmi for S.F. 245/1B.", "text/plain"))
        ]
        res_upload = await client.post(f"/api/sessions/{session_id}/sources", files=source_files)
        assert res_upload.status_code == 200
        assert res_upload.json()["sources_count"] == 2

        # 5. Export Final Document (records into history linked to client_id)
        export_payload = {
            "field_values": {"p14_r0_0": "Verified title deed trace"},
            "table_group_records": {},
            "clear_highlight": True
        }
        res_export = await client.post(f"/api/sessions/{session_id}/export", json=export_payload)
        assert res_export.status_code == 200
        assert res_export.json()["status"] == "success"

        # 6. Verify Client Detail has full Scrutiny History
        res_detail = await client.get(f"/api/clients/{client_id}")
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert detail["scrutiny_count"] >= 1
        assert len(detail["scrutinies"]) >= 1

        sc = detail["scrutinies"][0]
        assert sc["session_id"] == session_id
        assert sc["status"] == "completed"
        assert sc["sources_count"] == 2
        assert "Sale_Deed_1987.txt" in sc["sources_names"]
        assert sc["final_document_ready"] is True
        assert sc["history_id"] is not None


@pytest.mark.asyncio
async def test_multiple_scrutinies_per_client():
    """Verifies that a client can maintain multiple distinct scrutiny sessions."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create client
        res_c = await client.post("/api/clients", json={
            "name": "K. V. Ramanathan",
            "phone": f"93{uuid.uuid4().hex[:8]}",
            "email": f"raman_{uuid.uuid4().hex[:6]}@realestate.com",
            "title": "Commercial Development Scrutiny"
        })
        client_id = res_c.json()["id"]

        # 2. Get template
        res_tpls = await client.get("/api/templates")
        tpl_id = res_tpls.json()[0]["id"]

        # 3. Start Scrutiny #1
        res_s1 = await client.post(f"/api/clients/{client_id}/start-scrutiny", json={"template_id": tpl_id})
        assert res_s1.status_code == 200

        # 4. Start Scrutiny #2
        res_s2 = await client.post(f"/api/clients/{client_id}/start-scrutiny", json={"template_id": tpl_id})
        assert res_s2.status_code == 200
        assert res_s1.json()["session_id"] != res_s2.json()["session_id"]

        # 5. Check client detail shows both sessions
        res_detail = await client.get(f"/api/clients/{client_id}")
        detail = res_detail.json()
        assert detail["scrutiny_count"] == 2
        sess_ids = [s["session_id"] for s in detail["scrutinies"]]
        assert res_s1.json()["session_id"] in sess_ids
        assert res_s2.json()["session_id"] in sess_ids


@pytest.mark.asyncio
async def test_client_document_preview_and_download():
    """
    Verifies that clicking/inspecting a client displays generated document particulars,
    live text preview, and allows direct downloads (docx, pdf, txt).
    """
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create client
        res_c = await client.post("/api/clients", json={
            "name": "K. Muthulakshmi",
            "phone": f"98{uuid.uuid4().hex[:8]}",
            "email": f"muthu_{uuid.uuid4().hex[:6]}@lawfirm.in",
            "title": "Title Scrutiny for S.F. No. 245/1B"
        })
        client_id = res_c.json()["id"]

        # 2. Get template
        res_tpls = await client.get("/api/templates")
        tpl_id = res_tpls.json()[0]["id"]

        # 3. Start scrutiny
        res_start = await client.post(f"/api/clients/{client_id}/start-scrutiny", json={"template_id": tpl_id})
        session_id = res_start.json()["session_id"]

        # 4. Upload source doc
        source_files = [
            ("files", ("Deed.txt", b"Sale Deed executed in favour of K. Muthulakshmi for S.F. No. 245/1B measuring 4.57 Acres at SRO Pollachi.", "text/plain"))
        ]
        await client.post(f"/api/sessions/{session_id}/sources", files=source_files)

        # 5. Export document
        export_payload = {
            "field_values": {"p14_r0_0": "Verified title trace for K. Muthulakshmi"},
            "table_group_records": {},
            "clear_highlight": True
        }
        await client.post(f"/api/sessions/{session_id}/export", json=export_payload)

        # 6. Retrieve client detail and verify document display particulars
        res_detail = await client.get(f"/api/clients/{client_id}")
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert len(detail["scrutinies"]) == 1
        sc = detail["scrutinies"][0]
        assert sc["final_document_ready"] is True
        assert len(sc["preview_paragraphs"]) > 0
        assert sc["preview_text"] is not None
        assert sc["download_url_docx"] == f"/api/sessions/{session_id}/download?format=docx"
        assert sc["download_url_pdf"] == f"/api/sessions/{session_id}/download?format=pdf"
        assert sc["download_url_txt"] == f"/api/sessions/{session_id}/download?format=txt"

        # 7. Test direct client document downloads
        # DOCX
        res_dl_docx = await client.get(f"/api/clients/{client_id}/documents/{session_id}/download?format=docx")
        assert res_dl_docx.status_code == 200
        assert "wordprocessingml" in res_dl_docx.headers.get("content-type", "")
        assert len(res_dl_docx.content) > 1000

        # PDF
        res_dl_pdf = await client.get(f"/api/clients/{client_id}/documents/{session_id}/download?format=pdf")
        assert res_dl_pdf.status_code == 200
        assert "pdf" in res_dl_pdf.headers.get("content-type", "")
        assert len(res_dl_pdf.content) > 500

        # TXT
        res_dl_txt = await client.get(f"/api/clients/{client_id}/documents/{session_id}/download?format=txt")
        assert res_dl_txt.status_code == 200
        assert "text" in res_dl_txt.headers.get("content-type", "")
        assert len(res_dl_txt.content) > 50


@pytest.mark.asyncio
async def test_delete_client_workflow():
    """
    Verifies that deleting a client removes them from the client list,
    dissociates their sessions without crashing, and returns 404 on subsequent lookups.
    """
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create client
        res_c = await client.post("/api/clients", json={
            "name": "Temporary Client",
            "phone": f"97{uuid.uuid4().hex[:8]}",
            "email": f"temp_{uuid.uuid4().hex[:6]}@example.com",
            "title": "Title Search for Disposal Property"
        })
        assert res_c.status_code == 200
        client_id = res_c.json()["id"]

        # 2. Get template & start scrutiny
        res_tpls = await client.get("/api/templates")
        tpl_id = res_tpls.json()[0]["id"]
        res_start = await client.post(f"/api/clients/{client_id}/start-scrutiny", json={"template_id": tpl_id})
        session_id = res_start.json()["session_id"]

        # 3. Verify client detail exists
        res_detail = await client.get(f"/api/clients/{client_id}")
        assert res_detail.status_code == 200
        assert res_detail.json()["id"] == client_id

        # 4. Delete client
        res_del = await client.delete(f"/api/clients/{client_id}")
        assert res_del.status_code == 200
        del_data = res_del.json()
        assert del_data["success"] is True
        assert del_data["client_id"] == client_id
        assert "deleted successfully" in del_data["message"]

        # 5. Verify client no longer exists
        res_get_deleted = await client.get(f"/api/clients/{client_id}")
        assert res_get_deleted.status_code == 404

        # 6. Verify client is not in list
        res_list = await client.get("/api/clients")
        client_ids = [c["id"] for c in res_list.json()]
        assert client_id not in client_ids

        # 7. Verify session is preserved with nullified client_id
        res_sess = await client.get(f"/api/sessions/{session_id}")
        assert res_sess.status_code == 200
        assert res_sess.json().get("client_id") is None

        # 8. Deleting again returns 404
        res_del_again = await client.delete(f"/api/clients/{client_id}")
        assert res_del_again.status_code == 404
