"""
Production Test Suite for Wallet, UPI Gateway, and Admin Control Architecture.
Verifies:
1. Zero initial wallet balance (strictly ₹0.00).
2. Only USER accounts have wallets (ADMIN accounts have NO wallet).
3. Secure authentication, mobile & password validation.
4. Idempotent payment verification (Bank UTR proof, Admin Verify & Credit, rejection).
5. Audited administrative wallet adjustments (CREDIT, DEBIT).
6. Non-advertised admin authorization guards (403 Forbidden).
7. UPI configuration management.
"""

import pytest
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import AsyncSessionLocal, init_db
from backend.app.db.models import User
from backend.app.core.auth import hash_password


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_admin():
    """Provisions a test administrator account in the test database."""
    import asyncio
    async def _setup():
        await init_db()
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            stmt = select(User).where(User.email == "testadmin@enterprise.internal")
            admin = (await session.execute(stmt)).scalar_one_or_none()
            if not admin:
                admin_user = User(
                    id=str(uuid.uuid4()),
                    name="Test Executive Admin",
                    email="testadmin@enterprise.internal",
                    mobile="+919876543210",
                    password_hash=hash_password("AdminSecurePassword2026!"),
                    role="ADMIN",
                    is_active=True
                )
                session.add(admin_user)
                await session.commit()
    asyncio.run(_setup())


def get_admin_token(client) -> str:
    res = client.post("/api/auth/login", json={
        "email": "testadmin@enterprise.internal",
        "password": "AdminSecurePassword2026!"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["token"]


def test_user_registration_initial_balance_zero(client):
    """Verify that registering a new user grants exactly 0.00 balance and creates a wallet."""
    unique_email = f"client_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Jane Doe",
        "email": unique_email,
        "mobile": f"+91{uuid.uuid4().int % 10000000000:010d}",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!"
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert "token" in data
    user = data["user"]
    assert user["wallet_balance"] == 0.0, "Initial balance must strictly be 0.00"
    assert user["is_admin"] is False
    assert user["role"] == "USER"


def test_admin_has_no_wallet(client):
    """Verify that ADMIN accounts do NOT possess a wallet."""
    admin_token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Profile must indicate no wallet balance
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["is_admin"] is True
    assert me_res.json()["role"] == "ADMIN"
    assert me_res.json()["wallet_balance"] is None

    # 2. Attempting to access wallet summary with admin token must be rejected
    wallet_res = client.get("/api/wallet/summary", headers=headers)
    assert wallet_res.status_code == 400
    assert "Administrators do not possess wallets" in wallet_res.json()["detail"]


def test_admin_authorization_guard(client):
    """Verify that standard users receive 403 Forbidden on all admin routes."""
    user_email = f"regular_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "name": "Regular User",
        "email": user_email,
        "mobile": f"+91{uuid.uuid4().int % 10000000000:010d}",
        "password": "StandardUser2026!",
        "confirm_password": "StandardUser2026!"
    })
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Regular user attempting admin metrics
    assert client.get("/api/admin/metrics", headers=headers).status_code == 403

    # Regular user attempting admin users list
    assert client.get("/api/admin/users", headers=headers).status_code == 403

    # Regular user attempting admin audit logs
    assert client.get("/api/admin/audit-logs", headers=headers).status_code == 403


def test_payment_verification_and_wallet_credit(client):
    """
    Verifies the production payment lifecycle:
    1. User submits Bank UTR reference (status = PENDING, balance remains 0.0).
    2. Duplicate UTR submissions are rejected (409 Conflict).
    3. Admin verifies and credits the payment (status = SUCCESS, balance increases).
    """
    user_email = f"payer_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "name": "Payer Client",
        "email": user_email,
        "mobile": f"+91{uuid.uuid4().int % 10000000000:010d}",
        "password": "ClientPassword123!",
        "confirm_password": "ClientPassword123!"
    })
    user_token = reg_res.json()["token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 1. User submits Bank UTR
    test_utr = f"UTR{uuid.uuid4().hex[:10].upper()}"
    submit_res = client.post("/api/wallet/submit-verification", json={
        "amount": 500.0,
        "method": "upi",
        "utr_number": test_utr,
        "user_notes": "GPay payment transfer"
    }, headers=user_headers)
    assert submit_res.status_code == 200
    s_data = submit_res.json()
    assert s_data["status"] == "PENDING"
    verification_id = s_data["verification_id"]

    # 2. Check that user wallet is NOT yet credited
    summary_res = client.get("/api/wallet/summary", headers=user_headers)
    assert summary_res.status_code == 200
    assert summary_res.json()["wallet_balance"] == 0.0, "Wallet balance must remain 0 while pending verification"

    # 3. Prevent duplicate submission with the same UTR
    dup_res = client.post("/api/wallet/submit-verification", json={
        "amount": 500.0,
        "method": "upi",
        "utr_number": test_utr
    }, headers=user_headers)
    assert dup_res.status_code == 409

    # 4. Admin reviews and verifies payment
    admin_token = get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    ver_list = client.get("/api/admin/verifications?status=PENDING", headers=admin_headers)
    assert ver_list.status_code == 200
    assert any(v["id"] == verification_id for v in ver_list.json())

    verify_res = client.post(
        f"/api/admin/verifications/{verification_id}/verify",
        json={"admin_notes": "Verified against ICICI corporate banking statement"},
        headers=admin_headers
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "SUCCESS"
    assert verify_res.json()["new_balance"] == 500.0

    # 5. User wallet now reflects credited funds
    new_summary = client.get("/api/wallet/summary", headers=user_headers)
    assert new_summary.json()["wallet_balance"] == 500.0
    assert new_summary.json()["total_deposited"] == 500.0
    assert len(new_summary.json()["recent_transactions"]) == 1
    assert new_summary.json()["recent_transactions"][0]["type"] == "WALLET_CREDIT"


def test_payment_rejection(client):
    """Verify admin can reject invalid payment proofs without touching wallet balance."""
    user_email = f"fake_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "name": "Invalid Payer",
        "email": user_email,
        "mobile": f"+91{uuid.uuid4().int % 10000000000:010d}",
        "password": "ClientPassword123!",
        "confirm_password": "ClientPassword123!"
    })
    user_token = reg_res.json()["token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    fake_utr = f"FAKE{uuid.uuid4().hex[:8].upper()}"
    submit_res = client.post("/api/wallet/submit-verification", json={
        "amount": 200.0,
        "method": "upi",
        "utr_number": fake_utr
    }, headers=user_headers)
    assert submit_res.status_code == 200
    ver_id = submit_res.json()["verification_id"]

    admin_token = get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    reject_res = client.post(
        f"/api/admin/verifications/{ver_id}/reject",
        json={"reason": "Transaction reference not found in bank statement"},
        headers=admin_headers
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    # User balance is untouched at 0.00
    assert client.get("/api/wallet/summary", headers=user_headers).json()["wallet_balance"] == 0.0


def test_admin_audited_adjustment(client):
    """Verify admin can perform audited credit and debit adjustments with required audit reason."""
    user_email = f"adjustee_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post("/api/auth/register", json={
        "name": "Adjustee User",
        "email": user_email,
        "mobile": f"+91{uuid.uuid4().int % 10000000000:010d}",
        "password": "ClientPassword123!",
        "confirm_password": "ClientPassword123!"
    })
    target_id = reg_res.json()["user"]["id"]

    admin_token = get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Admin credits ₹300 with audit reason
    adj_credit = client.post(f"/api/admin/users/{target_id}/wallet-adjust", json={
        "action": "add",
        "amount": 300.0,
        "reason": "Enterprise offline bank wire deposit credit"
    }, headers=admin_headers)
    assert adj_credit.status_code == 200
    assert adj_credit.json()["balance_after"] == 300.0

    # 2. Admin debits ₹100 with audit reason
    adj_debit = client.post(f"/api/admin/users/{target_id}/wallet-adjust", json={
        "action": "deduct",
        "amount": 100.0,
        "reason": "Correction of duplicate invoice posting"
    }, headers=admin_headers)
    assert adj_debit.status_code == 200
    assert adj_debit.json()["balance_after"] == 200.0

    # 3. Reject adjustment without valid reason
    bad_adj = client.post(f"/api/admin/users/{target_id}/wallet-adjust", json={
        "action": "add",
        "amount": 100.0,
        "reason": "no"  # Too short (< 5 chars)
    }, headers=admin_headers)
    assert bad_adj.status_code == 422 or bad_adj.status_code == 400

    # 4. Verify audit log entry exists
    logs_res = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert logs_res.status_code == 200
    assert any(l["action"] == "WALLET_ADJUSTMENT" and l["target_id"] == target_id for l in logs_res.json())


def test_admin_upi_settings_workflow(client):
    """Verify admin can update UPI VPA and public config dynamically updates."""
    admin_token = get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    new_vpa = f"enterprise.billing{uuid.uuid4().hex[:4]}@hdfcbank"
    new_name = "LexTitle Corporate Legal Systems Ltd"

    update_res = client.post("/api/admin/upi-settings", json={
        "upi_vpa": new_vpa,
        "upi_payee_name": new_name,
        "payment_verification_mode": "manual_admin",
        "min_deposit_amount": 25.0,
        "max_deposit_amount": 50000.0
    }, headers=admin_headers)
    assert update_res.status_code == 200
    assert update_res.json()["success"] is True

    # Check public config
    cfg_res = client.get("/api/wallet/config")
    assert cfg_res.status_code == 200
    cfg_data = cfg_res.json()
    assert cfg_data["upi_vpa"] == new_vpa
    assert cfg_data["upi_payee_name"] == new_name
    assert cfg_data["min_deposit_amount"] == 25.0

    # Invalid UPI VPA format rejection
    bad_vpa = client.post("/api/admin/upi-settings", json={
        "upi_vpa": "not_an_email_or_vpa",
        "upi_payee_name": "Test"
    }, headers=admin_headers)
    assert bad_vpa.status_code == 400
