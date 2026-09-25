"""
Comprehensive Tests for Phase 3 Features:
- User Authentication & Scoped Access
- Template Library & Fast Reuse
- Document History & Field Audit Trails
- Batch Document Generation & ZIP Download
"""

import json
import uuid
from io import BytesIO
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from docx import Document

from backend.app.main import app
from backend.app.db.database import init_db
from backend.app.core.auth import hash_password, verify_password, create_access_token, decode_access_token
from backend.app.core.samples import generate_sample_template, generate_sample_source_doc_1


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    await init_db()


@pytest.mark.asyncio
async def test_auth_password_hashing_and_jwt():
    raw_pw = "SuperSecurePassword123!"
    hashed = hash_password(raw_pw)
    assert verify_password(raw_pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

    token = create_access_token("user-123", "test@docfiller.ai")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["email"] == "test@docfiller.ai"


@pytest.mark.asyncio
async def test_auth_registration_and_login_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"sarah_{uuid.uuid4().hex[:6]}@cyberdyne.io"
        # 1. Register
        reg_payload = {
            "email": unique_email,
            "password": "ResistancePassword2026",
            "full_name": "Sarah Connor"
        }
        res_reg = await client.post("/api/auth/register", json=reg_payload)
        assert res_reg.status_code == 200
        data_reg = res_reg.json()
        assert "token" in data_reg
        assert data_reg["user"]["email"] == unique_email
        token = data_reg["token"]

        # 2. Get profile with token
        res_me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res_me.status_code == 200
        assert res_me.json()["full_name"] == "Sarah Connor"

        # 3. Login
        res_login = await client.post("/api/auth/login", json={
            "email": unique_email,
            "password": "ResistancePassword2026"
        })
        assert res_login.status_code == 200
        assert "token" in res_login.json()


@pytest.mark.asyncio
async def test_template_library_crud_and_reuse():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        template_bio = generate_sample_template()
        template_bytes = template_bio.getvalue()

        # 1. Save template to library
        files = {"file": ("MSA_Master_Template.docx", template_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        res_save = await client.post("/api/templates", files=files, data={"name": "Corporate MSA Template"})
        assert res_save.status_code == 200
        tpl_data = res_save.json()
        tpl_id = tpl_data["id"]
        assert tpl_data["name"] == "Corporate MSA Template"
        assert tpl_data["fields_count"] > 0

        # 2. List templates
        res_list = await client.get("/api/templates")
        assert res_list.status_code == 200
        templates = res_list.json()
        assert any(t["id"] == tpl_id for t in templates)

        # 3. Rename template
        res_rename = await client.patch(f"/api/templates/{tpl_id}", json={"name": "Global MSA Template v2"})
        assert res_rename.status_code == 200
        assert res_rename.json()["name"] == "Global MSA Template v2"

        # 4. Use template (creates session with preloaded metadata)
        res_use = await client.post(f"/api/templates/{tpl_id}/use")
        assert res_use.status_code == 200
        use_data = res_use.json()
        assert "session_id" in use_data
        assert use_data["fields_count"] > 0
        assert len(use_data["fields"]) > 0

        # 5. Clean up template
        await client.delete(f"/api/templates/{tpl_id}")


@pytest.mark.asyncio
async def test_document_history_and_download():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create session & load sample preset
        res_sess = await client.post("/api/sessions")
        sess_id = res_sess.json()["session_id"]

        await client.post(f"/api/sessions/{sess_id}/load-sample")

        # Export final document
        export_payload = {
            "field_values": {"p1_r1_1": "Horizon BioTech Systems Inc."},
            "table_group_records": {},
            "clear_highlight": True
        }
        res_export = await client.post(f"/api/sessions/{sess_id}/export", json=export_payload)
        assert res_export.status_code == 200
        assert "history_id" in res_export.json()
        history_id = res_export.json()["history_id"]

        # Check history list
        res_hist = await client.get("/api/history")
        assert res_hist.status_code == 200
        hist_list = res_hist.json()
        assert any(h["id"] == history_id for h in hist_list)

        # Check history detail
        res_detail = await client.get(f"/api/history/{history_id}")
        assert res_detail.status_code == 200
        assert res_detail.json()["template_filename"] == "MSA_Template_Dynamic_Milestones.docx"

        # Download from history
        res_dl = await client.get(f"/api/history/{history_id}/download")
        assert res_dl.status_code == 200
        assert len(res_dl.content) > 0


@pytest.mark.asyncio
async def test_batch_document_generation_and_zip():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        template_bio = generate_sample_template()
        template_bytes = template_bio.getvalue()
        source_bio = generate_sample_source_doc_1()
        source_bytes = source_bio.getvalue()

        items_spec = [
            {"item_name": "Applicant 1 - Alex Rivera", "source_filenames": ["Primary_SOW.docx"]},
            {"item_name": "Applicant 2 - Jordan Chen", "source_filenames": ["Primary_SOW.docx"]}
        ]

        files = [
            ("template_file", ("Master_Template.docx", template_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
            ("files", ("Primary_SOW.docx", source_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        ]

        res_batch = await client.post(
            "/api/batch",
            files=files,
            data={"items_json": json.dumps(items_spec)}
        )
        assert res_batch.status_code == 200
        batch_id = res_batch.json()["id"]
        assert res_batch.json()["total_items"] == 2

        # Status check
        res_stat = await client.get(f"/api/batch/{batch_id}/status")
        assert res_stat.status_code == 200
        assert res_stat.json()["total_items"] == 2

        # Download zip
        res_zip = await client.get(f"/api/batch/{batch_id}/download-zip")
        assert res_zip.status_code == 200
        assert res_zip.headers["content-type"] == "application/zip"
        assert len(res_zip.content) > 0
