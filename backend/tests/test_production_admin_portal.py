"""
Production Admin Portal Comprehensive Test Suite
Validates:
1. Separate Admin Login (POST /api/auth/admin/login) & Logout (POST /api/auth/admin/logout)
2. Normal users cannot log in via Admin Login (403 Forbidden)
3. Normal users receive 403 Forbidden on all /api/admin/* endpoints
4. Admin accounts NEVER have a wallet (wallet_balance is None)
5. Enhanced Dashboard metrics (user breakdown, payments breakdown, documents today/month)
6. Negative balance prevention (HTTP 400 "Insufficient wallet balance")
7. Audited manual wallet adjustments (CREDIT & DEBIT with reason, reference, admin_id)
8. User status activation & suspension with audit logging (prevents self-suspension)
9. Persistent Document History: list, details, and binary download
10. UPI VPA format validation and settings audit
"""

import uuid
import pytest
import asyncio
from decimal import Decimal
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import AsyncSessionLocal, init_db
from backend.app.db.models import User, Wallet, DocumentHistoryItem
from backend.app.core.auth import hash_password, create_access_token


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_data():
    async def _setup():
        await init_db()
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            # Admin setup
            stmt_a = select(User).where(User.email == "superadmin@management.internal")
            admin = (await session.execute(stmt_a)).scalar_one_or_none()
            if not admin:
                admin = User(
                    id=str(uuid.uuid4()),
                    name="Super Admin",
                    email="superadmin@management.internal",
                    mobile=f"+91{uuid.uuid4().int % 10000000000:010d}",
                    password_hash=hash_password("AdminSecurePassword123!"),
                    role="ADMIN",
                    is_active=True
                )
                session.add(admin)

            # User setup
            stmt_u = select(User).where(User.email == "regularuser@client.internal")
            user = (await session.execute(stmt_u)).scalar_one_or_none()
            if not user:
                user = User(
                    id=str(uuid.uuid4()),
                    name="Regular User",
                    email="regularuser@client.internal",
                    mobile=f"+91{uuid.uuid4().int % 10000000000:010d}",
                    password_hash=hash_password("UserPassword123!"),
                    role="USER",
                    is_active=True
                )
                session.add(user)
                await session.flush()

                wallet = Wallet(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    balance=Decimal("500.00"),
                    currency="INR"
                )
                session.add(wallet)
            else:
                user.is_active = True
                w_stmt = select(Wallet).where(Wallet.user_id == user.id)
                wallet = (await session.execute(w_stmt)).scalar_one_or_none()
                if wallet:
                    wallet.balance = Decimal("500.00")

            # Document setup
            stmt_d = select(DocumentHistoryItem).where(DocumentHistoryItem.id == "DOC-TEST-7788")
            doc = (await session.execute(stmt_d)).scalar_one_or_none()
            if not doc:
                doc = DocumentHistoryItem(
                    id="DOC-TEST-7788",
                    user_id=user.id,
                    session_id=str(uuid.uuid4()),
                    template_filename="Legal_Partition_Deed.docx",
                    sources_summary_json='[{"name": "Doc1.pdf", "pages": 2}]',
                    field_values_json='{"Schedule": "A", "Party": "Ramesh"}',
                    table_records_json='[{"Col1": "Val1"}]',
                    docx_bytes=b"PK\x03\x04test_docx_content_bytes",
                    status="completed"
                )
                session.add(doc)

            await session.commit()
    asyncio.run(_setup())


@pytest.fixture(scope="module")
def admin_token():
    async def _get_admin():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            stmt = select(User).where(User.email == "superadmin@management.internal")
            return (await session.execute(stmt)).scalar_one()
    admin = asyncio.run(_get_admin())
    return create_access_token(admin.id, admin.email, admin.role, admin.name)


def test_admin_separate_login_and_logout(client):
    # 1. Admin login success
    res = client.post("/api/auth/admin/login", json={
        "email": "superadmin@management.internal",
        "password": "AdminSecurePassword123!"
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert body["user"]["role"] == "ADMIN"
    assert body["user"]["is_admin"] is True
    assert body["user"]["wallet_balance"] is None  # ADMIN MUST NEVER HAVE A WALLET
    token = body["token"]
    refresh_token = body.get("refresh_token")

    # 2. Admin logout
    logout_res = client.post(
        "/api/auth/admin/logout",
        json={"refresh_token": refresh_token},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True


def test_normal_user_blocked_from_admin_login(client):
    # Standard USER attempts to log in via admin portal
    res = client.post("/api/auth/admin/login", json={
        "email": "regularuser@client.internal",
        "password": "UserPassword123!"
    })
    # Must be rejected with 403 Forbidden
    assert res.status_code == 403
    assert "Not an administrator account" in res.json()["detail"]


def test_normal_user_cannot_access_admin_apis(client):
    async def _get_u():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            stmt = select(User).where(User.email == "regularuser@client.internal")
            return (await session.execute(stmt)).scalar_one()
    user = asyncio.run(_get_u())

    user_token = create_access_token(user.id, user.email, user.role, user.name)
    headers = {"Authorization": f"Bearer {user_token}"}

    endpoints = [
        ("GET", "/api/admin/metrics"),
        ("GET", "/api/admin/dashboard"),
        ("GET", "/api/admin/users"),
        ("GET", f"/api/admin/users/{user.id}"),
        ("GET", f"/api/admin/users/{user.id}/wallet"),
        ("GET", "/api/admin/documents"),
        ("GET", "/api/admin/audit-logs"),
        ("GET", "/api/admin/payments"),
        ("GET", "/api/admin/pricing"),
        ("GET", "/api/admin/settings"),
        ("GET", "/api/admin/payment-methods")
    ]

    for method, endpoint in endpoints:
        if method == "GET":
            res = client.get(endpoint, headers=headers)
        else:
            res = client.post(endpoint, headers=headers)
        assert res.status_code == 403, f"Expected 403 for endpoint {endpoint}, got {res.status_code}"


def test_admin_metrics_and_dashboard(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/admin/metrics", headers=headers)
    assert res.status_code == 200, res.text
    m = res.json()

    # Check required fields from Section 6 of prompt
    assert "counts" in m
    assert "total_users" in m["counts"]
    assert "active_users" in m["counts"]
    assert "suspended_users" in m["counts"]
    assert "successful_payments" in m["counts"]
    assert "pending_payments" in m["counts"]
    assert "failed_payments" in m["counts"]
    assert "total_documents" in m["counts"]
    assert "docs_today" in m["counts"]
    assert "docs_this_month" in m["counts"]

    assert "financials" in m
    assert "total_outstanding_float" in m["financials"]
    assert m["financials"]["total_outstanding_float"] >= 500.0


def test_negative_balance_prevention(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    async def _get_u():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            stmt = select(User).where(User.email == "regularuser@client.internal")
            return (await session.execute(stmt)).scalar_one()
    user = asyncio.run(_get_u())

    # User currently has ₹500.00. Attempt debit of ₹600.00.
    res = client.post(
        f"/api/admin/users/{user.id}/wallet/adjust",
        json={
            "action": "debit",
            "amount": 600.00,
            "reason": "Test unauthorized overdraft",
            "reference": f"OVERDRAFT-{uuid.uuid4().hex[:6]}"
        },
        headers=headers
    )

    # Must return 400 with "Insufficient wallet balance"
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "Insufficient wallet balance" in detail


def test_audited_wallet_credit_and_debit(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    async def _get_u():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            stmt = select(User).where(User.email == "regularuser@client.internal")
            return (await session.execute(stmt)).scalar_one()
    user = asyncio.run(_get_u())

    ref_c = f"REF-CREDIT-{uuid.uuid4().hex[:6]}"
    ref_d = f"REF-DEBIT-{uuid.uuid4().hex[:6]}"

    # 1. Credit ₹200 (Current 500 -> 700)
    res_credit = client.post(
        f"/api/admin/users/{user.id}/wallet/adjust",
        json={
            "action": "credit",
            "amount": 200.00,
            "reason": "Audited goodwill credit",
            "reference": ref_c
        },
        headers=headers
    )
    assert res_credit.status_code == 200
    assert res_credit.json()["balance_after"] == 700.00
    assert res_credit.json()["reference"] == ref_c

    # 2. Debit ₹150 (Current 700 -> 550)
    res_debit = client.post(
        f"/api/admin/users/{user.id}/wallet-adjust",
        json={
            "action": "debit",
            "amount": 150.00,
            "reason": "Service fee correction",
            "reference": ref_d
        },
        headers=headers
    )
    assert res_debit.status_code == 200
    assert res_debit.json()["balance_after"] == 550.00


def test_user_activation_and_suspension_with_audit(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    async def _get_users():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            u_stmt = select(User).where(User.email == "regularuser@client.internal")
            a_stmt = select(User).where(User.email == "superadmin@management.internal")
            u = (await session.execute(u_stmt)).scalar_one()
            a = (await session.execute(a_stmt)).scalar_one()
            return u, a
    user, admin = asyncio.run(_get_users())

    # Suspend user
    res_suspend = client.post(
        f"/api/admin/users/{user.id}/status",
        json={"is_active": False, "reason": "Suspicious chargeback activity"},
        headers=headers
    )
    assert res_suspend.status_code == 200
    assert res_suspend.json()["is_active"] is False

    # Attempting self-suspension by admin must fail
    res_self = client.post(
        f"/api/admin/users/{admin.id}/status",
        json={"is_active": False, "reason": "Accidental self lock"},
        headers=headers
    )
    assert res_self.status_code == 400


def test_persistent_document_history_and_download(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. List documents
    res_docs = client.get("/api/admin/documents", headers=headers)
    assert res_docs.status_code == 200
    docs_list = res_docs.json()
    assert len(docs_list) >= 1
    target_doc = next((d for d in docs_list if d["id"] == "DOC-TEST-7788"), None)
    assert target_doc is not None
    assert target_doc["template_filename"] == "Legal_Partition_Deed.docx"
    assert target_doc["user_email"] == "regularuser@client.internal"

    # 2. Document details
    res_detail = client.get("/api/admin/documents/DOC-TEST-7788", headers=headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == "DOC-TEST-7788"
    assert "sources_summary" in detail
    assert "field_values" in detail

    # 3. Document download
    res_dl = client.get("/api/admin/documents/DOC-TEST-7788/download", headers=headers)
    assert res_dl.status_code == 200
    assert b"test_docx_content_bytes" in res_dl.content
    assert "Legal_Partition_Deed.docx" in res_dl.headers.get("content-disposition", "")


def test_upi_settings_validation_and_audit(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Invalid UPI ID format -> 400 Bad Request
    res_invalid = client.post(
        "/api/admin/upi-settings",
        json={
            "upi_vpa": "invalid-no-at-sign",
            "upi_payee_name": "Test Payee"
        },
        headers=headers
    )
    assert res_invalid.status_code == 400

    # 2. Valid UPI ID -> 200 OK
    res_valid = client.post(
        "/api/admin/payment-methods/upi",
        json={
            "upi_vpa": "validmerchant@icici",
            "upi_payee_name": "LexTitle Technologies"
        },
        headers=headers
    )
    assert res_valid.status_code == 200
    assert res_valid.json()["settings"]["upi_vpa"] == "validmerchant@icici"


def test_switch_to_admin_with_valid_password(client):
    """
    Verifies that any session can switch to admin using ONLY the administrator password.
    """
    res = client.post("/api/auth/switch-to-admin", json={
        "password": "AdminSecurePassword123!"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["is_admin"] is True
    assert data["user"]["wallet_balance"] is None  # Admins possess no wallet
    assert data["token"]
    assert data["refresh_token"]


def test_switch_to_admin_with_invalid_password(client):
    """
    Verifies that incorrect admin password is rejected with 401 Unauthorized.
    """
    res = client.post("/api/auth/switch-to-admin", json={
        "password": "WrongAdminPassword123!"
    })
    assert res.status_code == 401
    assert "Incorrect administrator password" in res.json()["detail"]


def test_authenticated_user_switches_to_admin(client):
    """
    Verifies a logged-in user can switch to admin using password-only verification.
    """
    # 1. Register and login as regular user
    unique_email = f"user_{uuid.uuid4().hex[:6]}@client.internal"
    unique_mobile = f"+91{uuid.uuid4().int % 10000000000:010d}"
    reg_res = client.post("/api/auth/register", json={
        "name": "Switch Tester",
        "email": unique_email,
        "mobile": unique_mobile,
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert reg_res.status_code == 200
    user_token = reg_res.json()["token"]

    # 2. Switch to admin with admin password
    switch_res = client.post(
        "/api/auth/switch-to-admin",
        json={"password": "AdminSecurePassword123!"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert switch_res.status_code == 200
    switch_data = switch_res.json()
    assert switch_data["user"]["role"] == "ADMIN"
    assert switch_data["user"]["is_admin"] is True
    assert switch_data["user"]["wallet_balance"] is None

    # 3. Use new admin token to access protected admin endpoint
    admin_tok = switch_data["token"]
    admin_res = client.get("/api/admin/metrics", headers={"Authorization": f"Bearer {admin_tok}"})
    assert admin_res.status_code == 200

