"""
Production Wallet Service
Performs atomic, decimal-exact balance updates with row locking and idempotency.
Guarantees that admin accounts never possess wallets.
Records every balance change in the immutable Transaction and WalletLedger systems.
Protects against concurrent race conditions with serialized user-level locks.
"""

import uuid
import datetime
import asyncio
from collections import defaultdict
from decimal import Decimal
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.db.models import User, Wallet, Transaction, WalletAdjustment, WalletLedger
from backend.app.services.audit_service import audit_service
import logging

logger = logging.getLogger("docfiller.wallet_service")

# Concurrency guard: serializes balance updates per user across asynchronous tasks
_user_locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


class WalletService:
    @staticmethod
    async def get_user_wallet(db: AsyncSession, user_id: str) -> Optional[Wallet]:
        stmt = select(Wallet).where(Wallet.user_id == user_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def create_user_wallet(db: AsyncSession, user: User) -> Wallet:
        if user.role == "ADMIN":
            raise ValueError("Administrator accounts cannot have a wallet.")

        existing = await WalletService.get_user_wallet(db, user.id)
        if existing:
            return existing

        wallet = Wallet(
            id=str(uuid.uuid4()),
            user_id=user.id,
            balance=Decimal("0.00"),
            currency="INR"
        )
        db.add(wallet)
        await db.flush()
        return wallet

    @staticmethod
    async def credit_wallet(
        db: AsyncSession,
        user_id: str,
        amount: Decimal,
        payment_provider: str,
        provider_transaction_id: Optional[str] = None,
        description: str = "Wallet Top-Up",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Transaction:
        """
        Atomically credits a user's wallet.
        Enforces idempotency: if provider_transaction_id has already been processed,
        returns the existing transaction without crediting again.
        Creates both a Transaction and an auditable WalletLedger entry.
        """
        amount_decimal = Decimal(str(amount)).quantize(Decimal("0.01"))
        if amount_decimal <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Deposit amount must be strictly greater than 0."
            )

        async with _user_locks[user_id]:
            # 1. Idempotency check: provider_transaction_id uniqueness
            if provider_transaction_id:
                dup_stmt = select(Transaction).where(Transaction.provider_transaction_id == provider_transaction_id)
                dup_res = await db.execute(dup_stmt)
                existing_txn = dup_res.scalar_one_or_none()
                if existing_txn:
                    logger.info(f"Idempotent skip: provider transaction {provider_transaction_id} already executed.")
                    return existing_txn

            # 2. Lock & fetch wallet
            stmt = select(Wallet).where(Wallet.user_id == user_id)
            try:
                stmt = stmt.with_for_update()
            except Exception:
                pass

            res = await db.execute(stmt)
            wallet = res.scalar_one_or_none()
            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User wallet not found."
                )

            balance_before = Decimal(str(wallet.balance)).quantize(Decimal("0.01"))
            balance_after = (balance_before + amount_decimal).quantize(Decimal("0.01"))

            # Update wallet balance atomically
            wallet.balance = balance_after

            # 3. Create immutable transaction record
            txn_id = str(uuid.uuid4())
            txn = Transaction(
                id=txn_id,
                user_id=user_id,
                wallet_id=wallet.id,
                payment_provider=payment_provider,
                provider_transaction_id=provider_transaction_id,
                amount=amount_decimal,
                currency=wallet.currency,
                status="SUCCESS",
                type="WALLET_CREDIT",
                balance_before=balance_before,
                balance_after=balance_after,
                description=description,
                metadata_json=str(metadata) if metadata else None
            )
            db.add(txn)

            # 4. Create auditable WalletLedger entry
            ledger = WalletLedger(
                id=str(uuid.uuid4()),
                wallet_id=wallet.id,
                user_id=user_id,
                transaction_id=txn_id,
                entry_type="CREDIT",
                amount=amount_decimal,
                balance_before=balance_before,
                balance_after=balance_after,
                description=description,
                reference_id=provider_transaction_id or txn_id
            )
            db.add(ledger)

            await db.commit()
            await db.refresh(txn)

            logger.info(f"Wallet credited: User={user_id}, Amount=+{amount_decimal}, BalAfter={balance_after}, Txn={txn_id}")
            return txn

    @staticmethod
    async def debit_wallet(
        db: AsyncSession,
        user_id: str,
        amount: Decimal,
        description: str,
        reference_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Transaction:
        """
        Atomically debits a user's wallet.
        Validates that available funds are sufficient; raises 402 if insufficient.
        Creates both a Transaction and an auditable WalletLedger entry.
        """
        amount_decimal = Decimal(str(amount)).quantize(Decimal("0.01"))
        if amount_decimal <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debit amount must be strictly greater than 0."
            )

        async with _user_locks[user_id]:
            stmt = select(Wallet).where(Wallet.user_id == user_id)
            try:
                stmt = stmt.with_for_update()
            except Exception:
                pass

            res = await db.execute(stmt)
            wallet = res.scalar_one_or_none()
            if not wallet:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User wallet not found.")

            balance_before = Decimal(str(wallet.balance)).quantize(Decimal("0.01"))
            if balance_before < amount_decimal:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Insufficient wallet balance. Required: ₹{amount_decimal:.2f}, Available: ₹{balance_before:.2f}"
                )

            balance_after = (balance_before - amount_decimal).quantize(Decimal("0.01"))
            wallet.balance = balance_after

            txn_id = str(uuid.uuid4())
            txn = Transaction(
                id=txn_id,
                user_id=user_id,
                wallet_id=wallet.id,
                payment_provider="SYSTEM",
                provider_transaction_id=reference_id,
                amount=-amount_decimal,
                currency=wallet.currency,
                status="SUCCESS",
                type="WALLET_DEBIT",
                balance_before=balance_before,
                balance_after=balance_after,
                description=description,
                metadata_json=str(metadata) if metadata else None
            )
            db.add(txn)

            ledger = WalletLedger(
                id=str(uuid.uuid4()),
                wallet_id=wallet.id,
                user_id=user_id,
                transaction_id=txn_id,
                entry_type="DEBIT",
                amount=-amount_decimal,
                balance_before=balance_before,
                balance_after=balance_after,
                description=description,
                reference_id=reference_id or txn_id
            )
            db.add(ledger)

            await db.commit()
            await db.refresh(txn)

            logger.info(f"Wallet debited: User={user_id}, Amount=-{amount_decimal}, BalAfter={balance_after}, Txn={txn_id}")
            return txn

    @staticmethod
    async def adjust_wallet_balance(
        db: AsyncSession,
        target_user_id: str,
        admin_user: User,
        amount: Decimal,
        adjustment_type: str,
        reason: str,
        reference: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Tuple[WalletAdjustment, Transaction]:
        """
        Executes an audited manual adjustment by an Administrator on a user's wallet.
        Requires explicit reason (minimum 5 characters), records negative balance checks,
        and logs to AuditLog, Transaction, and WalletLedger.
        """
        if admin_user.role != "ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can adjust balances.")

        if not reason or len(reason.strip()) < 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audit reason of at least 5 characters is required.")

        amount_decimal = Decimal(str(amount)).quantize(Decimal("0.01"))
        adj_type = adjustment_type.upper().strip()
        if adj_type not in ["CREDIT", "DEBIT"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adjustment type must be 'CREDIT' or 'DEBIT'.")

        async with _user_locks[target_user_id]:
            stmt = select(Wallet).where(Wallet.user_id == target_user_id)
            try:
                stmt = stmt.with_for_update()
            except Exception:
                pass
            res = await db.execute(stmt)
            wallet = res.scalar_one_or_none()
            if not wallet:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user wallet not found.")

            balance_before = Decimal(str(wallet.balance)).quantize(Decimal("0.01"))
            if adj_type == "CREDIT":
                balance_after = (balance_before + amount_decimal).quantize(Decimal("0.01"))
                delta = amount_decimal
                desc = f"Admin Credit (+₹{amount_decimal:.2f}): {reason.strip()}"
            else:
                if balance_before < amount_decimal:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient wallet balance. Cannot debit ₹{amount_decimal:.2f}; user only has ₹{balance_before:.2f}."
                    )
                balance_after = (balance_before - amount_decimal).quantize(Decimal("0.01"))
                delta = -amount_decimal
                desc = f"Admin Debit (-₹{amount_decimal:.2f}): {reason.strip()}"

            wallet.balance = balance_after

            # 1. Create WalletAdjustment
            adj_id = str(uuid.uuid4())
            ref_code = reference.strip() if reference and reference.strip() else f"ADJ-{uuid.uuid4().hex[:8].upper()}"
            adj = WalletAdjustment(
                id=adj_id,
                user_id=target_user_id,
                admin_id=admin_user.id,
                amount=amount_decimal,
                type=adj_type,
                reason=reason.strip(),
                reference=ref_code
            )
            db.add(adj)

            # 2. Create Transaction
            txn_id = str(uuid.uuid4())
            txn = Transaction(
                id=txn_id,
                user_id=target_user_id,
                wallet_id=wallet.id,
                payment_provider="ADMIN_ADJUSTMENT",
                provider_transaction_id=ref_code,
                amount=delta,
                currency=wallet.currency,
                status="SUCCESS",
                type="ADMIN_ADJUSTMENT",
                balance_before=balance_before,
                balance_after=balance_after,
                description=desc
            )
            db.add(txn)

            # 3. Create WalletLedger entry
            ledger = WalletLedger(
                id=str(uuid.uuid4()),
                wallet_id=wallet.id,
                user_id=target_user_id,
                transaction_id=txn_id,
                entry_type="MANUAL_CREDIT" if adj_type == "CREDIT" else "MANUAL_DEBIT",
                amount=delta,
                balance_before=balance_before,
                balance_after=balance_after,
                description=desc,
                reference_id=ref_code
            )
            db.add(ledger)

            # 4. Create AuditLog entry
            await audit_service.log_action(
                db=db,
                admin_id=admin_user.id,
                action="WALLET_ADJUSTMENT",
                target_type="USER",
                target_id=target_user_id,
                metadata={
                    "type": adj_type,
                    "amount": float(amount_decimal),
                    "reason": reason.strip(),
                    "balance_before": float(balance_before),
                    "balance_after": float(balance_after),
                    "reference": ref_code
                },
                ip_address=ip_address
            )

            await db.commit()
            await db.refresh(adj)
            await db.refresh(txn)

            return adj, txn

    @staticmethod
    async def refund_wallet(
        db: AsyncSession,
        user_id: str,
        amount: Decimal,
        original_payment_id: str,
        reason: str
    ) -> Transaction:
        """
        Executes a legitimate refund debit on a user's wallet.
        Decreases wallet balance, creates a REFUND transaction and ledger entry,
        without deleting the original transaction.
        """
        amount_decimal = Decimal(str(amount)).quantize(Decimal("0.01"))
        if amount_decimal <= Decimal("0.00"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refund amount must be positive.")

        async with _user_locks[user_id]:
            stmt = select(Wallet).where(Wallet.user_id == user_id)
            try:
                stmt = stmt.with_for_update()
            except Exception:
                pass

            res = await db.execute(stmt)
            wallet = res.scalar_one_or_none()
            if not wallet:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User wallet not found.")

            balance_before = Decimal(str(wallet.balance)).quantize(Decimal("0.01"))
            balance_after = (balance_before - amount_decimal).quantize(Decimal("0.01"))
            wallet.balance = balance_after

            txn_id = str(uuid.uuid4())
            txn = Transaction(
                id=txn_id,
                user_id=user_id,
                wallet_id=wallet.id,
                payment_provider="SYSTEM",
                provider_transaction_id=f"REFUND-{original_payment_id}-{uuid.uuid4().hex[:6]}",
                amount=-amount_decimal,
                currency=wallet.currency,
                status="SUCCESS",
                type="REFUND",
                balance_before=balance_before,
                balance_after=balance_after,
                description=f"Refund: {reason} (Ref: {original_payment_id})"
            )
            db.add(txn)

            ledger = WalletLedger(
                id=str(uuid.uuid4()),
                wallet_id=wallet.id,
                user_id=user_id,
                transaction_id=txn_id,
                entry_type="REFUND",
                amount=-amount_decimal,
                balance_before=balance_before,
                balance_after=balance_after,
                description=f"Refund: {reason}",
                reference_id=original_payment_id
            )
            db.add(ledger)

            await db.commit()
            await db.refresh(txn)
            return txn


wallet_service = WalletService()
