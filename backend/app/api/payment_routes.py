"""
Payment Gateway & Webhook API Routes
Strictly verifies provider webhook signatures, validates payment amounts,
guarantees idempotency, and enables secure status polling.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from backend.app.db.database import get_db
from backend.app.db.models import User
from backend.app.core.auth import get_current_user_required
from backend.app.core.rate_limiter import rate_limit
from backend.app.services.payment_service import payment_service
from backend.app.services.payment_providers import list_supported_providers
import logging

logger = logging.getLogger("docfiller.payment_routes")

router = APIRouter(prefix="/api/payments", tags=["payments"])


class PaymentHistoryItemResponse(BaseModel):
    id: str
    amount: float
    currency: str
    status: str
    provider: str
    method: str
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


@router.post(
    "/webhook",
    dependencies=[Depends(rate_limit(max_requests=100, window_seconds=60, scope="payment_webhook"))]
)
async def handle_generic_webhook(
    request: Request,
    provider: Optional[str] = Query(None, description="Optional provider query parameter"),
    db: AsyncSession = Depends(get_db)
):
    """
    Source of Truth Webhook Listener:
    1. Receives raw payload bytes directly from payment provider.
    2. Determines provider from query param or signature headers (e.g. stripe-signature, x-upi-signature).
    3. Cryptographically validates provider signature. Rejects invalid signatures with HTTP 400.
    4. Verifies amount matching expected amount.
    5. Checks idempotency (prevents double crediting on duplicate webhooks).
    6. Atomically credits user wallet inside an ACID database transaction upon verified SUCCESS.
    """
    raw_payload = await request.body()
    headers = dict(request.headers)
    client_ip = request.client.host if request.client else None

    # Determine provider
    provider_name = (provider or "").lower().strip()
    if not provider_name:
        if "stripe-signature" in [k.lower() for k in headers.keys()]:
            provider_name = "stripe"
        elif "x-upi-signature" in [k.lower() for k in headers.keys()]:
            provider_name = "upi"
        else:
            provider_name = "upi"  # default regional provider

    payment = await payment_service.process_webhook_event(
        db=db,
        provider_name=provider_name,
        raw_payload=raw_payload,
        headers=headers,
        client_ip=client_ip
    )

    return {
        "success": True,
        "payment_id": payment.id,
        "status": payment.status,
        "provider": payment.provider,
        "amount": float(payment.amount)
    }


@router.post(
    "/webhook/{provider_name}",
    dependencies=[Depends(rate_limit(max_requests=100, window_seconds=60, scope="payment_webhook"))]
)
async def handle_provider_specific_webhook(
    provider_name: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated provider webhook route (e.g. /api/payments/webhook/stripe, /api/payments/webhook/upi).
    """
    raw_payload = await request.body()
    headers = dict(request.headers)
    client_ip = request.client.host if request.client else None

    payment = await payment_service.process_webhook_event(
        db=db,
        provider_name=provider_name.lower().strip(),
        raw_payload=raw_payload,
        headers=headers,
        client_ip=client_ip
    )

    return {
        "success": True,
        "payment_id": payment.id,
        "status": payment.status,
        "provider": payment.provider,
        "amount": float(payment.amount)
    }


@router.get("/status/{payment_id}")
async def get_payment_status_endpoint(
    payment_id: str,
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Polls the backend verification status of a payment.
    Enforces user authorization: users can ONLY query their own payments.
    """
    return await payment_service.get_payment_status(
        db=db,
        payment_id=payment_id,
        user=current_user
    )


@router.get("/history", response_model=List[PaymentHistoryItemResponse])
async def get_payment_history_endpoint(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns paginated payment history for the authenticated user.
    """
    if current_user.role == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators do not possess user payments."
        )

    payments = await payment_service.get_user_payments(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )

    return [
        PaymentHistoryItemResponse(
            id=p.id,
            amount=float(p.amount),
            currency=p.currency,
            status=p.status,
            provider=p.provider,
            method=p.method,
            error_message=p.error_message,
            created_at=p.created_at.isoformat() if p.created_at else "",
            updated_at=p.updated_at.isoformat() if p.updated_at else ""
        )
        for p in payments
    ]


@router.get("/providers")
async def get_supported_payment_providers():
    """Returns list of supported payment providers."""
    return {"supported_providers": list_supported_providers()}
