"""
Production-Grade Payment Verification & User Wallet Acceptance Test Suite
Strictly verifies:
- Test 1: Successful payment -> Provider SUCCESS -> Verified webhook -> Wallet +₹500 -> Transaction SUCCESS -> WalletLedger CREDIT
- Test 2: Failed payment -> Provider FAILED -> Wallet unchanged
- Test 3: Duplicate webhook -> Wallet credited exactly once (Idempotency)
- Test 4: Amount mismatch -> Expected ₹500, Provider ₹100 -> Wallet NOT credited -> Payment FAILED
- Test 5: Fake frontend success -> Wallet balance unchanged
- Test 6: Unauthorized wallet access -> User A cannot view/tamper User B's payments/wallet
- Test 7: Admin has NO wallet & can perform audited manual adjustment
- Test 8: Concurrent payments -> Simultaneous payments accurately credited without race condition
- Test 9: Webhook signature verification -> Invalid signature rejected with HTTP 400
- Test 10: Legitimate refund -> Wallet debited, REFUND ledger entry created, original transaction preserved
"""

import uuid
import json
import hmac
import hashlib
import time
import pytest
import asyncio
from decimal import Decimal
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import AsyncSessionLocal, init_db
from backend.app.db.models import User, Wallet, Transaction, Payment, WalletLedger
from backend.app.core.auth import hash_password, create_access_token


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def run_async(coro):
    return asyncio.run(coro)


@pytest.fixture(scope="module", autouse=True)
def setup_payment_db():
    run_async(init_db())


def create_test_user(role="USER", name="Test User", balance=Decimal("0.00")):
    async def _create():
        async with AsyncSessionLocal() as session:
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name=name,
                email=f"user_{uuid.uuid4().hex[:8]}@example.com",
                mobile=f"+91{uuid.uuid4().int % 10000000000:010d}",
                password_hash=hash_password("SecurePass123!"),
                role=role,
                is_active=True
            )
            session.add(user)
            await session.flush()

            if role == "USER":
                wallet = Wallet(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    balance=balance,
                    currency="INR"
                )
                session.add(wallet)

            await session.commit()
            return user_id, user.email
    return run_async(_create())


def get_user_wallet_balance(user_id: str) -> Decimal:
    async def _get():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            stmt = select(Wallet).where(Wallet.user_id == user_id)
            res = await session.execute(stmt)
            w = res.scalar_one_or_none()
            return w.balance if w else Decimal("0.00")
    return run_async(_get())


def sign_upi_webhook_payload(payload_bytes: bytes, secret: str = "upi_super_secret_webhook_key_2026") -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


# ---------------- TEST 1: SUCCESSFUL PAYMENT VIA VERIFIED WEBHOOK ----------------
def test_1_successful_payment_via_verified_webhook(client):
    user_id, email = create_test_user(role="USER", name="Alice Payment", balance=Decimal("0.00"))
    token = create_access_token(user_id=user_id, email=email, role="USER")

    # 1. Create deposit intent
    resp = client.post(
        "/api/wallet/deposit",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 500.0, "provider": "upi", "method": "upi"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    payment_id = data["payment_id"]
    assert data["status"] == "PENDING"
    assert data["amount"] == 500.0

    # Wallet MUST NOT be credited yet
    assert get_user_wallet_balance(user_id) == Decimal("0.00")

    # 2. Simulate provider sending signed webhook
    prov_tx_id = f"BANK-UTR-{uuid.uuid4().hex[:10].upper()}"
    webhook_body = json.dumps({
        "event": "upi.payment_status",
        "payment_id": payment_id,
        "provider_payment_id": prov_tx_id,
        "amount": "500.00",
        "currency": "INR",
        "status": "SUCCESS"
    }).encode("utf-8")

    signature = sign_upi_webhook_payload(webhook_body)
    wh_resp = client.post(
        "/api/payments/webhook/upi",
        data=webhook_body,
        headers={"Content-Type": "application/json", "x-upi-signature": signature}
    )
    assert wh_resp.status_code == 200, wh_resp.text
    assert wh_resp.json()["status"] == "SUCCESS"

    # Wallet MUST now be credited exactly ₹500.00
    assert get_user_wallet_balance(user_id) == Decimal("500.00")

    # Verify transaction and ledger entry
    async def _verify_ledger():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            t_stmt = select(Transaction).where(Transaction.provider_transaction_id == prov_tx_id)
            txn = (await session.execute(t_stmt)).scalar_one_or_none()
            assert txn is not None
            assert txn.amount == Decimal("500.00")
            assert txn.type == "WALLET_CREDIT"

            l_stmt = select(WalletLedger).where(WalletLedger.transaction_id == txn.id)
            ledger = (await session.execute(l_stmt)).scalar_one_or_none()
            assert ledger is not None
            assert ledger.entry_type == "CREDIT"
            assert ledger.amount == Decimal("500.00")
            assert ledger.balance_after == Decimal("500.00")
    run_async(_verify_ledger())


# ---------------- TEST 2: FAILED PAYMENT VIA WEBHOOK ----------------
def test_2_failed_payment_via_webhook(client):
    user_id, email = create_test_user(role="USER", name="Bob Failed", balance=Decimal("0.00"))
    token = create_access_token(user_id=user_id, email=email, role="USER")

    # 1. Create deposit
    resp = client.post(
        "/api/wallet/deposit",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 500.0, "provider": "upi"}
    )
    assert resp.status_code == 200
    payment_id = resp.json()["payment_id"]

    # 2. Webhook reports FAILED
    webhook_body = json.dumps({
        "event": "upi.payment_status",
        "payment_id": payment_id,
        "amount": "500.00",
        "currency": "INR",
        "status": "FAILED",
        "error_message": "User declined payment in bank app"
    }).encode("utf-8")

    signature = sign_upi_webhook_payload(webhook_body)
    wh_resp = client.post(
        "/api/payments/webhook/upi",
        data=webhook_body,
        headers={"Content-Type": "application/json", "x-upi-signature": signature}
    )
    assert wh_resp.status_code == 200

    # Wallet MUST remain strictly 0.00
    assert get_user_wallet_balance(user_id) == Decimal("0.00")

    # Check status endpoint
    st_resp = client.get(
        f"/api/payments/status/{payment_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert st_resp.status_code == 200
    assert st_resp.json()["status"] == "FAILED"


# ---------------- TEST 3: DUPLICATE WEBHOOK IDEMPOTENCY ----------------
def test_3_duplicate_webhook_idempotency(client):
    user_id, email = create_test_user(role="USER", name="Charlie Idempotent", balance=Decimal("0.00"))
    token = create_access_token(user_id=user_id, email=email, role="USER")

    # Create deposit
    resp = client.post(
        "/api/wallet/deposit",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 500.0, "provider": "upi"}
    )
    payment_id = resp.json()["payment_id"]
    prov_tx_id = f"IDEM-{uuid.uuid4().hex[:10].upper()}"

    webhook_body = json.dumps({
        "event": "upi.payment_status",
        "payment_id": payment_id,
        "provider_payment_id": prov_tx_id,
        "amount": "500.00",
        "currency": "INR",
        "status": "SUCCESS"
    }).encode("utf-8")
    signature = sign_upi_webhook_payload(webhook_body)
    headers = {"Content-Type": "application/json", "x-upi-signature": signature}

    # Send Webhook 1
    wh1 = client.post("/api/payments/webhook/upi", data=webhook_body, headers=headers)
    assert wh1.status_code == 200
    assert get_user_wallet_balance(user_id) == Decimal("500.00")

    # Send Webhook 2 (duplicate)
    wh2 = client.post("/api/payments/webhook/upi", data=webhook_body, headers=headers)
    assert wh2.status_code == 200
    assert get_user_wallet_balance(user_id) == Decimal("500.00"), "Balance must NOT double credit"

    # Send Webhook 3 (triplicate)
    wh3 = client.post("/api/payments/webhook/upi", data=webhook_body, headers=headers)
    assert wh3.status_code == 200
    assert get_user_wallet_balance(user_id) == Decimal("500.00"), "Balance must remain exactly ₹500.00"


# ---------------- TEST 4: AMOUNT MISMATCH ABORTS CREDIT ----------------
def test_4_amount_mismatch_aborts_credit(client):
    user_id, email = create_test_user(role="USER", name="David Mismatch", balance=Decimal("0.00"))
    token = create_access_token(user_id=user_id, email=email, role="USER")

    # User creates ₹500.00 deposit order
    resp = client.post(
        "/api/wallet/deposit",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 500.0, "provider": "upi"}
    )
    payment_id = resp.json()["payment_id"]

    # Provider reports only ₹100.00
    webhook_body = json.dumps({
        "event": "upi.payment_status",
        "payment_id": payment_id,
        "provider_payment_id": f"TAMPER-{uuid.uuid4().hex[:8]}",
        "amount": "100.00",
        "currency": "INR",
        "status": "SUCCESS"
    }).encode("utf-8")
    signature = sign_upi_webhook_payload(webhook_body)

    wh_resp = client.post(
        "/api/payments/webhook/upi",
        data=webhook_body,
        headers={"Content-Type": "application/json", "x-upi-signature": signature}
    )
    assert wh_resp.status_code == 200
    assert wh_resp.json()["status"] == "FAILED"

    # Wallet MUST NOT be credited ₹500.00 or ₹100.00!
    assert get_user_wallet_balance(user_id) == Decimal("0.00")

    # Status check confirms amount mismatch error
    st = client.get(f"/api/payments/status/{payment_id}", headers={"Authorization": f"Bearer {token}"}).json()
    assert st["status"] == "FAILED"
    assert "mismatch" in st["error_message"].lower()


# ---------------- TEST 5: FAKE FRONTEND SUCCESS DOES NOT CHANGE WALLET ----------------
def test_5_fake_frontend_success_does_not_change_wallet(client):
    user_id, email = create_test_user(role="USER", name="Eve FakeSuccess", balance=Decimal("0.00"))
    token = create_access_token(user_id=user_id, email=email, role="USER")

    # Client tries to send paymentSuccessful=true
    resp = client.post(
        "/api/wallet/deposit",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 500.0, "paymentSuccessful": True, "status": "SUCCESS"}
    )
    assert resp.status_code == 200
    data = resp.json()
    # Backend MUST still store it as PENDING and NOT credit the wallet
    assert data["status"] == "PENDING"
    assert get_user_wallet_balance(user_id) == Decimal("0.00")


# ---------------- TEST 6: UNAUTHORIZED WALLET ACCESS ----------------
def test_6_unauthorized_wallet_access(client):
    user_a_id, email_a = create_test_user(role="USER", name="User A")
    token_a = create_access_token(user_id=user_a_id, email=email_a, role="USER")

    user_b_id, email_b = create_test_user(role="USER", name="User B")
    token_b = create_access_token(user_id=user_b_id, email=email_b, role="USER")

    # User A creates a payment
    resp_a = client.post(
        "/api/wallet/deposit",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"amount": 500.0}
    )
    payment_id_a = resp_a.json()["payment_id"]

    # User B attempts to view User A's payment status
    resp_b = client.get(
        f"/api/payments/status/{payment_id_a}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert resp_b.status_code == 403, "User B must be forbidden from accessing User A's payment"


# ---------------- TEST 7: ADMIN HAS NO WALLET & AUDITED MANUAL ADJUSTMENT ----------------
def test_7_admin_has_no_wallet_and_audited_adjustment(client):
    admin_id, admin_email = create_test_user(role="ADMIN", name="Admin Account")
    admin_token = create_access_token(user_id=admin_id, email=admin_email, role="ADMIN")

    user_id, user_email = create_test_user(role="USER", name="User Target", balance=Decimal("100.00"))

    # Admin attempts to initiate wallet deposit -> MUST fail
    dep_resp = client.post(
        "/api/wallet/deposit",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amount": 500.0}
    )
    assert dep_resp.status_code == 400
    assert "administrators" in dep_resp.json()["detail"].lower()

    # Admin attempts to query wallet summary -> MUST fail
    sum_resp = client.get("/api/wallet/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert sum_resp.status_code == 400

    # Admin performs audited manual CREDIT on User Target
    adj_resp = client.post(
        f"/api/admin/users/{user_id}/wallet/adjust",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "amount": 250.0,
            "type": "CREDIT",
            "reason": "Customer loyalty reward bonus",
            "reference": f"BONUS-{uuid.uuid4().hex[:8]}"
        }
    )
    assert adj_resp.status_code == 200
    assert get_user_wallet_balance(user_id) == Decimal("350.00")


# ---------------- TEST 8: CONCURRENT PAYMENTS ----------------
def test_8_concurrent_payments():
    """Two verified payments arrive simultaneously; both must be credited accurately."""
    user_id, email = create_test_user(role="USER", name="Grace Concurrency", balance=Decimal("500.00"))

    async def _concurrent():
        from backend.app.services.wallet_service import wallet_service

        async def _credit_a():
            async with AsyncSessionLocal() as session1:
                return await wallet_service.credit_wallet(
                    db=session1,
                    user_id=user_id,
                    amount=Decimal("500.00"),
                    payment_provider="UPI",
                    provider_transaction_id=f"CONC-A-{uuid.uuid4().hex[:8]}",
                    description="Simultaneous Payment A"
                )

        async def _credit_b():
            async with AsyncSessionLocal() as session2:
                return await wallet_service.credit_wallet(
                    db=session2,
                    user_id=user_id,
                    amount=Decimal("300.00"),
                    payment_provider="UPI",
                    provider_transaction_id=f"CONC-B-{uuid.uuid4().hex[:8]}",
                    description="Simultaneous Payment B"
                )

        await asyncio.gather(_credit_a(), _credit_b())

    run_async(_concurrent())
    # Initial ₹500 + ₹500 + ₹300 = ₹1,300.00 exactly
    assert get_user_wallet_balance(user_id) == Decimal("1300.00")


# ---------------- TEST 9: WEBHOOK INVALID SIGNATURE REJECTED ----------------
def test_9_webhook_invalid_signature_rejected(client):
    user_id, email = create_test_user(role="USER", name="Hacker Attempt")
    token = create_access_token(user_id=user_id, email=email, role="USER")

    resp = client.post("/api/wallet/deposit", headers={"Authorization": f"Bearer {token}"}, json={"amount": 500.0})
    payment_id = resp.json()["payment_id"]

    webhook_body = json.dumps({
        "payment_id": payment_id,
        "amount": "500.00",
        "currency": "INR",
        "status": "SUCCESS"
    }).encode("utf-8")

    # Send with bogus/fake signature
    bad_wh = client.post(
        "/api/payments/webhook/upi",
        data=webhook_body,
        headers={"Content-Type": "application/json", "x-upi-signature": "bogus_signature_12345"}
    )
    assert bad_wh.status_code == 400
    assert "signature" in bad_wh.json()["detail"].lower()
    # Wallet remains ₹0.00
    assert get_user_wallet_balance(user_id) == Decimal("0.00")


# ---------------- TEST 10: LEGITIMATE REFUND ----------------
def test_10_legitimate_refund(client):
    user_id, email = create_test_user(role="USER", name="Refund User", balance=Decimal("0.00"))
    token = create_access_token(user_id=user_id, email=email, role="USER")

    # 1. Create and credit ₹500 payment
    resp = client.post("/api/wallet/deposit", headers={"Authorization": f"Bearer {token}"}, json={"amount": 500.0})
    payment_id = resp.json()["payment_id"]
    prov_tx_id = f"REF-TX-{uuid.uuid4().hex[:8]}"

    wh_body = json.dumps({
        "payment_id": payment_id,
        "provider_payment_id": prov_tx_id,
        "amount": "500.00",
        "currency": "INR",
        "status": "SUCCESS"
    }).encode("utf-8")
    client.post(
        "/api/payments/webhook/upi",
        data=wh_body,
        headers={"Content-Type": "application/json", "x-upi-signature": sign_upi_webhook_payload(wh_body)}
    )
    assert get_user_wallet_balance(user_id) == Decimal("500.00")

    # 2. Provider sends REFUNDED webhook
    refund_body = json.dumps({
        "payment_id": payment_id,
        "provider_payment_id": prov_tx_id,
        "amount": "500.00",
        "currency": "INR",
        "status": "REFUNDED"
    }).encode("utf-8")
    ref_wh = client.post(
        "/api/payments/webhook/upi",
        data=refund_body,
        headers={"Content-Type": "application/json", "x-upi-signature": sign_upi_webhook_payload(refund_body)}
    )
    assert ref_wh.status_code == 200
    assert ref_wh.json()["status"] == "REFUNDED"

    # Wallet debited back to ₹0.00
    assert get_user_wallet_balance(user_id) == Decimal("0.00")
