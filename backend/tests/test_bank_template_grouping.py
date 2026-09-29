"""
Test Suite: Bank Template Grouping & Folder Management.

Verifies:
1. Listing predefined and dynamically populated bank folders (`GET /api/templates/banks`).
2. Uploading/saving templates assigned to specific bank folders (`POST /api/templates`).
3. Supporting multiple distinct templates under the SAME bank (e.g. SBI Home Loan, SBI Commercial Audit).
4. Filtering templates by bank folder (`GET /api/templates?bank_name=...`).
5. Moving templates between bank folders via `PATCH /api/templates/{template_id}`.
6. Using a bank template in a session returns the associated `bank_name`.
"""

import pytest
import pytest_asyncio
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import init_db


@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    await init_db()


def test_custom_template_groups_and_zero_inbuilt_presets():
    client = TestClient(app)

    # 1. First delete any remaining templates/groups to start completely clean
    client.delete("/api/templates/all")

    # 2. Verify zero inbuilt presets are returned when empty
    res = client.get("/api/templates/groups")
    assert res.status_code == 200
    banks = res.json()
    assert isinstance(banks, list)
    assert len(banks) == 0, f"Expected 0 inbuilt banks, got: {banks}"

    # 3. Create custom template groups
    create_res1 = client.post("/api/templates/groups", json={
        "name": "State Bank of India (SBI)",
        "description": "SBI Title Scrutiny Formats"
    })
    assert create_res1.status_code == 200
    assert create_res1.json()["name"] == "State Bank of India (SBI)"

    create_res2 = client.post("/api/templates/groups", json={
        "name": "HDFC Bank",
        "description": "HDFC Home Loan Formats"
    })
    assert create_res2.status_code == 200

    # 4. Verify custom groups are listed
    res2 = client.get("/api/templates/groups")
    assert res2.status_code == 200
    groups = res2.json()
    assert "State Bank of India (SBI)" in groups
    assert "HDFC Bank" in groups


def test_multiple_templates_for_same_bank_and_filtering():
    client = TestClient(app)

    # 1. Create a session and load sample
    sess_res = client.post("/api/sessions")
    session_id = sess_res.json()["session_id"]
    client.post(f"/api/sessions/{session_id}/load-legal-opinion-sample")

    # 2. Save template 1 for SBI (Home Loan)
    res_sbi_1 = client.post("/api/templates", data={
        "session_id": session_id,
        "name": "SBI_Home_Loan_Scrutiny_Format.docx",
        "bank_name": "State Bank of India (SBI)"
    })
    assert res_sbi_1.status_code == 200
    tpl_sbi_1 = res_sbi_1.json()
    assert tpl_sbi_1["bank_name"] == "State Bank of India (SBI)"

    # 3. Save template 2 for SBI (Commercial Project)
    res_sbi_2 = client.post("/api/templates", data={
        "session_id": session_id,
        "name": "SBI_Commercial_Mortgage_Scrutiny.docx",
        "bank_name": "State Bank of India (SBI)"
    })
    assert res_sbi_2.status_code == 200
    tpl_sbi_2 = res_sbi_2.json()
    assert tpl_sbi_2["bank_name"] == "State Bank of India (SBI)"

    # 4. Save template 3 for HDFC Bank
    res_hdfc = client.post("/api/templates", data={
        "session_id": session_id,
        "name": "HDFC_Retail_Asset_Legal_Report.docx",
        "bank_name": "HDFC Bank"
    })
    assert res_hdfc.status_code == 200
    tpl_hdfc = res_hdfc.json()
    assert tpl_hdfc["bank_name"] == "HDFC Bank"

    # 5. Filter by SBI: both templates must be present, HDFC must NOT be present
    res_filter_sbi = client.get("/api/templates?bank_name=State Bank of India (SBI)")
    assert res_filter_sbi.status_code == 200
    sbi_list = res_filter_sbi.json()
    sbi_names = [t["name"] for t in sbi_list]
    assert "SBI_Home_Loan_Scrutiny_Format.docx" in sbi_names
    assert "SBI_Commercial_Mortgage_Scrutiny.docx" in sbi_names
    assert "HDFC_Retail_Asset_Legal_Report.docx" not in sbi_names

    # 6. Filter by HDFC
    res_filter_hdfc = client.get("/api/templates?bank_name=HDFC Bank")
    assert res_filter_hdfc.status_code == 200
    hdfc_list = res_filter_hdfc.json()
    hdfc_names = [t["name"] for t in hdfc_list]
    assert "HDFC_Retail_Asset_Legal_Report.docx" in hdfc_names
    assert "SBI_Home_Loan_Scrutiny_Format.docx" not in hdfc_names

    # 7. Move tpl_sbi_2 from SBI to ICICI Bank
    patch_res = client.patch(f"/api/templates/{tpl_sbi_2['id']}", json={
        "bank_name": "ICICI Bank"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["bank_name"] == "ICICI Bank"

    # Verify it now appears under ICICI Bank
    icici_list = client.get("/api/templates?bank_name=ICICI Bank").json()
    assert any(t["id"] == tpl_sbi_2["id"] for t in icici_list)

    # 8. Use template in session and verify bank_name is preserved
    use_res = client.post(f"/api/templates/{tpl_sbi_1['id']}/use")
    assert use_res.status_code == 200
    use_data = use_res.json()
    assert use_data["bank_name"] == "State Bank of India (SBI)"


def test_delete_template_group_and_clear_all():
    client = TestClient(app)

    # Create a custom group
    create_res = client.post("/api/templates/groups", json={"name": "Custom Corporate Group"})
    assert create_res.status_code == 200
    assert "Custom Corporate Group" in client.get("/api/templates/groups").json()

    # Delete group
    del_res = client.delete("/api/templates/groups/Custom Corporate Group")
    assert del_res.status_code == 200
    assert "Custom Corporate Group" not in client.get("/api/templates/groups").json()

    # Clear all templates and groups
    del_all = client.delete("/api/templates/all")
    assert del_all.status_code == 200
    assert client.get("/api/templates/groups").json() == []
    assert client.get("/api/templates").json() == []


def test_default_template_group_and_remove_from_bank():
    client = TestClient(app)

    # 1. Create a session and load sample
    sess_res = client.post("/api/sessions")
    session_id = sess_res.json()["session_id"]
    client.post(f"/api/sessions/{session_id}/load-legal-opinion-sample")

    # 2. Save template with bank_name="Default"
    res_def = client.post("/api/templates", data={
        "session_id": session_id,
        "name": "General_Title_Scrutiny_Format.docx",
        "bank_name": "Default"
    })
    assert res_def.status_code == 200
    tpl_def = res_def.json()
    assert tpl_def["bank_name"] == "Default"

    # 3. Save a template under "Canara Bank"
    res_canara = client.post("/api/templates", data={
        "session_id": session_id,
        "name": "Canara_Bank_Format.docx",
        "bank_name": "Canara Bank"
    })
    assert res_canara.status_code == 200
    tpl_canara = res_canara.json()
    assert tpl_canara["bank_name"] == "Canara Bank"

    # 4. Remove Canara_Bank_Format from bank by patching bank_name="Default"
    res_patch = client.patch(f"/api/templates/{tpl_canara['id']}", json={
        "bank_name": "Default"
    })
    assert res_patch.status_code == 200
    assert res_patch.json()["bank_name"] == "Default"

    # 5. Verify listing templates with bank_name="Default" returns both
    res_list = client.get("/api/templates?bank_name=Default")
    assert res_list.status_code == 200
    names = [t["name"] for t in res_list.json()]
    assert "General_Title_Scrutiny_Format.docx" in names
    assert "Canara_Bank_Format.docx" in names

    # 6. Verify bank folders list does not contain "Default" or "General"
    banks_res = client.get("/api/templates/banks")
    assert banks_res.status_code == 200
    banks = banks_res.json()
    assert "Default" not in banks
    assert "General" not in banks

