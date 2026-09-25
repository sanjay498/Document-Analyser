"""
Test suite for Wallet Idempotency, Exact Decimal Arithmetic, and Concurrency.
"""

import pytest
import uuid
import asyncio
from decimal import Decimal
from backend.app.db.database import AsyncSessionLocal, init_db
from backend.app.db.models import User, Wallet, Transaction
from backend.app.services.wallet_service import wallet_service


@pytest.mark.asyncio
async def test_wallet_idempotency_duplicate_provider_tx():
    """Verify that processing the exact same provider transaction ID credits only once."""
    await init_db()
    async with AsyncSessionLocal() as session:
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Idempotency User",
            email=f"idem_{uuid.uuid4().hex[:6]}@test.com",
            mobile=f"+91{uuid.uuid4().int % 10000000000:010d}",
            password_hash="dummy_hash",
            role="USER",
            is_active=True
        )
        session.add(user)
        await session.flush()
        wallet = await wallet_service.create_user_wallet(session, user)
        await session.commit()

        provider_tx_id = f"PAY-IDEM-{uuid.uuid4().hex[:10].upper()}"

        # 1. First credit of ₹500.00
        txn1 = await wallet_service.credit_wallet(
            db=session,
            user_id=user_id,
            amount=Decimal("500.00"),
            payment_provider="RAZORPAY",
            provider_transaction_id=provider_tx_id,
            description="First webhook credit"
        )
        assert txn1.amount == Decimal("500.00")

        # Check balance
        w_res = await wallet_service.get_user_wallet(session, user_id)
        assert w_res.balance == Decimal("500.00")

        # 2. Second webhook with identical provider_tx_id
        txn2 = await wallet_service.credit_wallet(
            db=session,
            user_id=user_id,
            amount=Decimal("500.00"),
            payment_provider="RAZORPAY",
            provider_transaction_id=provider_tx_id,
            description="Duplicate webhook arrival"
        )
        # Must return the existing transaction ID
        assert txn2.id == txn1.id

        # Balance must strictly remain ₹500.00, NOT ₹1,000.00
        w_res2 = await wallet_service.get_user_wallet(session, user_id)
        assert w_res2.balance == Decimal("500.00"), "Balance must NOT double credit on duplicate webhook"


@pytest.mark.asyncio
async def test_exact_decimal_arithmetic():
    """Verify that monetary additions and subtractions maintain 100% exact precision without float drift."""
    await init_db()
    async with AsyncSessionLocal() as session:
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Decimal User",
            email=f"decimal_{uuid.uuid4().hex[:6]}@test.com",
            mobile=f"+91{uuid.uuid4().int % 10000000000:010d}",
            password_hash="dummy_hash",
            role="USER",
            is_active=True
        )
        session.add(user)
        await session.flush()
        await wallet_service.create_user_wallet(session, user)
        await session.commit()

        # Add 0.10, 0.20, 0.30 - in float 0.1+0.2+0.3 = 0.6000000000000001
        for val in ["0.10", "0.20", "0.30"]:
            await wallet_service.credit_wallet(
                db=session,
                user_id=user_id,
                amount=Decimal(val),
                payment_provider="SYSTEM",
                description="Cent test"
            )

        w = await wallet_service.get_user_wallet(session, user_id)
        assert w.balance == Decimal("0.60"), f"Expected 0.60, got {w.balance}"
