"""
Payment Verification & Gateway Integration Service
Orchestrates payment intent creation, cryptographic webhook verification,
amount matching, idempotency checking, and atomic wallet crediting.
Never trusts the frontend to determine payment success.
"""

import hmac
import hashlib
import uuid
import json
import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.db.models import User, Payment, PaymentVerification, Wallet
from backend.app.services.wallet_service import wallet_service
from backend.app.services.audit_service import audit_service
from backend.app.services.payment_providers import get_payment_provider, PaymentIntentResult
import logging

logger = logging.getLogger("docfiller.payment_service")


class PaymentService:
    @staticmethod
    async def create_payment(
        db: AsyncSession,
        user: User,
        amount: Decimal,
        provider_name: str = "upi",
        method: str = "upi",
        client_ip: Optional[str] = None
    ) -> Tuple[Payment, Dict[str, Any]]:
        """
        Creates an internal payment record with status PENDING.
        Associates payment with authenticated user and wallet.
        Calls provider abstraction to generate payment intent/order.
        """
        if user.role == "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators do not have wallets and cannot initiate wallet deposits."
            )

        amount_decimal = Decimal(str(amount)).quantize(Decimal("0.01"))
        if amount_decimal < Decimal("10.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum deposit amount is ₹10.00."
            )
        if amount_decimal > Decimal("100000.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum deposit amount per transaction is ₹100,000.00."
            )

        # 1. Ensure user wallet exists
        wallet = await wallet_service.get_user_wallet(db, user.id)
        if not wallet:
            wallet = await wallet_service.create_user_wallet(db, user)
            await db.commit()

        # 2. Generate unique internal payment ID
        payment_id = f"PAY-{uuid.uuid4().hex[:12].upper()}"

        # 3. Call PaymentProvider abstraction
        provider = get_payment_provider(provider_name)
        intent: PaymentIntentResult = await provider.create_payment_intent(
            payment_id=payment_id,
            amount=amount_decimal,
            currency="INR",
            user_id=user.id,
            user_email=user.email,
            metadata={"client_ip": client_ip, "method": method}
        )

        # 4. Save Payment record as PENDING
        payment = Payment(
            id=payment_id,
            user_id=user.id,
            wallet_id=wallet.id,
            amount=amount_decimal,
            currency="INR",
            provider=provider.provider_name,
            provider_order_id=intent.provider_order_id,
            status="PENDING",
            method=method.lower().strip(),
            client_secret=intent.client_secret,
            metadata_json=json.dumps(intent.raw_response or {})
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)

        client_data = {
            "provider_order_id": intent.provider_order_id,
            "client_secret": intent.client_secret,
            "checkout_url": intent.checkout_url,
            "qr_data": intent.qr_data,
        }

        logger.info(f"Payment created: ID={payment_id}, User={user.id}, Amount=₹{amount_decimal}, Provider={provider.provider_name}")
        return payment, client_data

    @staticmethod
    async def process_webhook_event(
        db: AsyncSession,
        provider_name: str,
        raw_payload: bytes,
        headers: Dict[str, str],
        client_ip: Optional[str] = None
    ) -> Payment:
        """
        Processes an incoming webhook from a payment provider:
        1. Cryptographically verifies signature using provider secret.
        2. Parses event to extract payment ID, amount, currency, and status.
        3. Verifies internal payment existence and ownership.
        4. Idempotency check: if already SUCCESS, returns immediately without re-crediting.
        5. Amount verification: verifies expected amount matches reported amount.
        6. Atomically credits wallet inside ACID transaction upon verified SUCCESS.
        """
        provider = get_payment_provider(provider_name)

        # Step 1: Verify webhook signature
        is_valid = await provider.verify_webhook_signature(raw_payload, headers)
        if not is_valid:
            logger.warning(f"Invalid webhook signature rejected for provider '{provider_name}'.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid provider webhook signature"
            )

        # Step 2: Parse webhook event
        event_res = await provider.parse_webhook_event(raw_payload, headers)
        logger.info(f"Webhook parsed: Event={event_res.event_type}, Status={event_res.status}, IntID={event_res.internal_payment_id}")

        # Step 3: Identify internal payment
        payment = None
        if event_res.internal_payment_id:
            stmt = select(Payment).where(Payment.id == event_res.internal_payment_id)
            res = await db.execute(stmt)
            payment = res.scalar_one_or_none()

        if not payment and event_res.provider_order_id:
            stmt = select(Payment).where(Payment.provider_order_id == event_res.provider_order_id)
            res = await db.execute(stmt)
            payment = res.scalar_one_or_none()

        if not payment and event_res.provider_payment_id:
            stmt = select(Payment).where(Payment.provider_payment_id == event_res.provider_payment_id)
            res = await db.execute(stmt)
            payment = res.scalar_one_or_none()

        if not payment:
            logger.error(f"Webhook received for unknown payment: internal_id={event_res.internal_payment_id}, order_id={event_res.provider_order_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record not found for webhook event"
            )

        # Step 4: Idempotency Check
        if payment.status == "SUCCESS" and event_res.status == "SUCCESS":
            logger.info(f"Payment {payment.id} already verified and credited. Skipping duplicate webhook idempotently.")
            return payment
        if payment.status == "REFUNDED" and event_res.status == "REFUNDED":
            logger.info(f"Payment {payment.id} already refunded. Skipping duplicate webhook idempotently.")
            return payment

        # Step 5: Amount Verification
        expected_amount = Decimal(str(payment.amount)).quantize(Decimal("0.01"))
        reported_amount = Decimal(str(event_res.amount)).quantize(Decimal("0.01"))

        if expected_amount != reported_amount:
            logger.error(f"Payment amount mismatch on {payment.id}: Expected ₹{expected_amount}, Provider reported ₹{reported_amount}.")
            payment.status = "FAILED"
            payment.error_message = f"Amount mismatch: expected ₹{expected_amount}, provider reported ₹{reported_amount}."
            payment.updated_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
            await db.refresh(payment)

            # Audit log amount fraud/mismatch alert
            await audit_service.log_action(
                db=db,
                admin_id=None,
                action="PAYMENT_AMOUNT_MISMATCH",
                target_type="PAYMENT",
                target_id=payment.id,
                metadata={
                    "expected": float(expected_amount),
                    "reported": float(reported_amount),
                    "provider": provider_name
                },
                ip_address=client_ip
            )
            return payment

        # Step 6: Currency Verification
        if payment.currency.upper() != event_res.currency.upper():
            logger.error(f"Currency mismatch on {payment.id}: Expected {payment.currency}, Provider reported {event_res.currency}.")
            payment.status = "FAILED"
            payment.error_message = f"Currency mismatch: expected {payment.currency}, provider reported {event_res.currency}."
            payment.updated_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
            await db.refresh(payment)
            return payment

        # Step 7: Handle Verified Status
        now = datetime.datetime.now(datetime.timezone.utc)
        if event_res.status == "SUCCESS":
            provider_tx_id = event_res.provider_payment_id or f"PROV-{uuid.uuid4().hex[:10].upper()}"

            # Atomically credit wallet via WalletService inside ACID transaction
            txn = await wallet_service.credit_wallet(
                db=db,
                user_id=payment.user_id,
                amount=payment.amount,
                payment_provider=payment.provider.upper(),
                provider_transaction_id=provider_tx_id,
                description=f"Verified {payment.provider.upper()} Deposit (Payment ID: {payment.id})",
                metadata={"payment_id": payment.id, "provider_order_id": payment.provider_order_id}
            )

            payment.status = "SUCCESS"
            payment.provider_payment_id = provider_tx_id
            payment.updated_at = now
            await db.commit()
            await db.refresh(payment)

            logger.info(f"Payment {payment.id} verified & wallet credited atomically: Amount=₹{payment.amount}, Txn={txn.id}")

        elif event_res.status == "FAILED":
            payment.status = "FAILED"
            payment.error_message = event_res.error_message or "Payment failed at payment provider"
            payment.updated_at = now
            await db.commit()
            await db.refresh(payment)
            logger.info(f"Payment {payment.id} marked as FAILED by provider.")

        elif event_res.status == "REFUNDED":
            await wallet_service.refund_wallet(
                db=db,
                user_id=payment.user_id,
                amount=payment.amount,
                original_payment_id=payment.id,
                reason="Provider Webhook Refund"
            )
            payment.status = "REFUNDED"
            payment.updated_at = now
            await db.commit()
            await db.refresh(payment)
            logger.info(f"Payment {payment.id} refunded and wallet debited.")

        return payment

    @staticmethod
    async def get_payment_status(
        db: AsyncSession,
        payment_id: str,
        user: User
    ) -> Dict[str, Any]:
        """
        Returns status for a payment.
        Guarantees that user cannot view another user's payment.
        """
        stmt = select(Payment).where(Payment.id == payment_id)
        res = await db.execute(stmt)
        payment = res.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")

        if user.role != "ADMIN" and payment.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access to payment.")

        wallet = await wallet_service.get_user_wallet(db, payment.user_id)
        balance = float(wallet.balance) if wallet else 0.0

        if payment.status == "SUCCESS":
            msg = f"Payment of ₹{float(payment.amount):.2f} verified successfully. Wallet credited."
        elif payment.status == "FAILED":
            msg = f"Payment could not be verified: {payment.error_message or 'Provider rejected the payment'}"
        elif payment.status == "PENDING":
            msg = "Payment is pending verification with the payment provider."
        elif payment.status == "REFUNDED":
            msg = "Payment has been refunded."
        else:
            msg = f"Payment status: {payment.status}"

        return {
            "payment_id": payment.id,
            "amount": float(payment.amount),
            "currency": payment.currency,
            "status": payment.status,
            "provider": payment.provider,
            "method": payment.method,
            "error_message": payment.error_message,
            "wallet_balance": balance,
            "created_at": payment.created_at.isoformat() if payment.created_at else "",
            "updated_at": payment.updated_at.isoformat() if payment.updated_at else "",
            "message": msg
        }

    @staticmethod
    async def get_user_payments(
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Payment]:
        """Returns paginated payment history for a user."""
        stmt = (
            select(Payment)
            .where(Payment.user_id == user_id)
            .order_by(desc(Payment.created_at))
            .offset(offset)
            .limit(limit)
        )
        res = await db.execute(stmt)
        return res.scalars().all()

    # ------------------ Bank UTR Flow (Manual Verification Backwards-Compatibility) ------------------
    @staticmethod
    def verify_webhook_signature(payload_bytes: bytes, signature: str, secret: str) -> bool:
        """Legacy HMAC-SHA256 signature validator."""
        if not signature or not secret:
            return False
        try:
            expected = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, signature)
        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}")
            return False

    @staticmethod
    async def submit_payment_for_verification(
        db: AsyncSession,
        user: User,
        amount: Decimal,
        method: str,
        utr_number: str,
        user_notes: Optional[str] = None
    ) -> PaymentVerification:
        """
        Records a user's transfer reference (UTR) with status PENDING.
        Prevents duplicate submissions of the same UTR number.
        """
        amount_decimal = Decimal(str(amount)).quantize(Decimal("0.01"))
        if amount_decimal < Decimal("10.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum payment amount is ₹10.00."
            )

        clean_utr = utr_number.strip().upper()
        if len(clean_utr) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid Bank UTR / Transaction Reference (min 6 characters)."
            )

        # Check for duplicate UTR
        dup_stmt = select(PaymentVerification).where(PaymentVerification.utr_number == clean_utr)
        dup_res = await db.execute(dup_stmt)
        existing = dup_res.scalar_one_or_none()
        if existing:
            if existing.status == "SUCCESS":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This Bank UTR has already been verified and credited."
                )
            elif existing.status == "PENDING":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A verification request with this Bank UTR is currently pending administrator review."
                )

        order_id = f"ORDER-{uuid.uuid4().hex[:12].upper()}"
        wallet = await wallet_service.get_user_wallet(db, user.id)

        ver = PaymentVerification(
            id=str(uuid.uuid4()),
            user_id=user.id,
            wallet_id=wallet.id if wallet else None,
            order_id=order_id,
            amount=amount_decimal,
            currency="INR",
            method=method.lower().strip(),
            utr_number=clean_utr,
            status="PENDING",
            user_notes=user_notes.strip() if user_notes else None
        )
        db.add(ver)
        await db.commit()
        await db.refresh(ver)

        logger.info(f"Payment verification submitted: User={user.id}, UTR={clean_utr}, Amount=₹{amount_decimal}")
        return ver

    @staticmethod
    async def verify_and_credit(
        db: AsyncSession,
        verification_id: str,
        admin_user: User,
        admin_notes: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> PaymentVerification:
        """
        Admin reviews and approves a payment proof against bank records,
        atomically crediting the user's wallet via WalletService.
        """
        if admin_user.role != "ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

        stmt = select(PaymentVerification).where(PaymentVerification.id == verification_id)
        res = await db.execute(stmt)
        ver = res.scalar_one_or_none()
        if not ver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment verification not found.")

        if ver.status == "SUCCESS":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment has already been verified.")

        # Credit wallet atomically using WalletService with idempotency key
        txn = await wallet_service.credit_wallet(
            db=db,
            user_id=ver.user_id,
            amount=ver.amount,
            payment_provider="UPI_DIRECT",
            provider_transaction_id=ver.utr_number,
            description=f"Verified UPI Deposit (UTR: {ver.utr_number})",
            metadata={"verification_id": ver.id, "verified_by": admin_user.id}
        )

        now = datetime.datetime.now(datetime.timezone.utc)
        ver.status = "SUCCESS"
        ver.verified_by = admin_user.id
        ver.verified_at = now
        ver.admin_notes = admin_notes.strip() if admin_notes else f"Verified by {admin_user.email}"

        # Audit log entry
        await audit_service.log_action(
            db=db,
            admin_id=admin_user.id,
            action="PAYMENT_VERIFIED",
            target_type="PAYMENT",
            target_id=ver.id,
            metadata={
                "user_id": ver.user_id,
                "utr_number": ver.utr_number,
                "amount": float(ver.amount),
                "transaction_id": txn.id
            },
            ip_address=ip_address
        )

        await db.commit()
        await db.refresh(ver)
        return ver

    @staticmethod
    async def reject_payment(
        db: AsyncSession,
        verification_id: str,
        admin_user: User,
        reason: str,
        ip_address: Optional[str] = None
    ) -> PaymentVerification:
        """
        Rejects an invalid payment proof. User's wallet is completely untouched.
        """
        if admin_user.role != "ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

        if not reason or len(reason.strip()) < 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rejection reason is mandatory.")

        stmt = select(PaymentVerification).where(PaymentVerification.id == verification_id)
        res = await db.execute(stmt)
        ver = res.scalar_one_or_none()
        if not ver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment verification not found.")

        if ver.status == "SUCCESS":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reject an already credited payment.")

        now = datetime.datetime.now(datetime.timezone.utc)
        ver.status = "REJECTED"
        ver.verified_by = admin_user.id
        ver.verified_at = now
        ver.admin_notes = reason.strip()

        # Audit log entry
        await audit_service.log_action(
            db=db,
            admin_id=admin_user.id,
            action="PAYMENT_REJECTED",
            target_type="PAYMENT",
            target_id=ver.id,
            metadata={"user_id": ver.user_id, "utr_number": ver.utr_number, "reason": reason.strip()},
            ip_address=ip_address
        )

        await db.commit()
        await db.refresh(ver)
        return ver


payment_service = PaymentService()
