"""
Production Wallet API Routes
Strictly user-scoped, decimal-precise, with Payment Gateway & Bank UTR verification.
Enforces that Administrator accounts cannot operate user wallets.
"""

from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel, Field

from backend.app.db.database import get_db
from backend.app.db.models import User, Transaction, SystemSetting, PaymentVerification, Payment
from backend.app.core.auth import get_current_user_required
from backend.app.core.rate_limiter import rate_limit
from backend.app.services.wallet_service import wallet_service
from backend.app.services.payment_service import payment_service

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


class DepositRequest(BaseModel):
    amount: float = Field(..., ge=10.0, le=100000.0, description="Amount to deposit in INR (min ₹10.00, max ₹100,000.00)")
    provider: Optional[str] = Field("upi", description="Payment provider: strictly 'upi'")
    method: Optional[str] = Field("upi", description="Payment method channel: strictly 'upi'")


class DepositResponse(BaseModel):
    payment_id: str
    amount: float
    currency: str
    status: str
    provider: str
    provider_order_id: Optional[str] = None
    client_secret: Optional[str] = None
    checkout_url: Optional[str] = None
    qr_data: Optional[str] = None
    message: str


class SubmitVerificationRequest(BaseModel):
    amount: float = Field(..., ge=10.0, description="Amount transferred in INR (min ₹10.00)")
    method: str = Field(default="upi", description="Payment channel: upi, card, netbanking")
    utr_number: str = Field(..., min_length=6, max_length=100, description="12-digit Bank UTR / Transaction Reference")
    user_notes: Optional[str] = Field(None, max_length=255, description="Sender remarks")


class TransactionResponse(BaseModel):
    id: str
    amount: float
    type: str
    status: str
    description: str
    reference_id: Optional[str] = None
    balance_before: float
    balance_after: float
    created_at: str
    transaction_type: str


class WalletSummaryResponse(BaseModel):
    wallet_balance: float
    total_spent: float
    total_deposited: float
    transactions_count: int
    currency: str = "INR"
    currency_symbol: str = "₹"
    recent_transactions: List[TransactionResponse]


class PaymentConfigResponse(BaseModel):
    upi_vpa: str
    upi_payee_name: str
    upi_qr_image_url: str
    min_deposit_amount: float
    max_deposit_amount: float
    verification_required: bool = True
    currency: str = "INR"
    currency_symbol: str = "₹"


def require_user_role(current_user: User):
    """Guards wallet endpoints against administrative accounts."""
    if current_user.role == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators do not possess wallets. Wallets are exclusively allocated to user accounts."
        )


@router.post(
    "/deposit",
    response_model=DepositResponse,
    dependencies=[Depends(rate_limit(max_requests=15, window_seconds=60, scope="wallet_deposit"))]
)
async def create_wallet_deposit(
    payload: DepositRequest,
    request: Request,
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates an internal payment order for adding money to user wallet:
    - Never trusts userId from frontend (uses authenticated user context)
    - Validates amount
    - Calls payment provider abstraction to generate order / intent
    - Stores payment as PENDING
    - Wallet is NEVER credited at this stage
    """
    require_user_role(current_user)
    client_ip = request.client.host if request.client else None

    payment, client_data = await payment_service.create_payment(
        db=db,
        user=current_user,
        amount=Decimal(str(payload.amount)),
        provider_name="upi",
        method="upi",
        client_ip=client_ip
    )

    return DepositResponse(
        payment_id=payment.id,
        amount=float(payment.amount),
        currency=payment.currency,
        status=payment.status,
        provider=payment.provider,
        provider_order_id=payment.provider_order_id,
        client_secret=payment.client_secret,
        checkout_url=client_data.get("checkout_url"),
        qr_data=client_data.get("qr_data"),
        message=f"Payment order {payment.id} created. Complete payment to verify and credit your wallet."
    )


@router.get("/summary", response_model=WalletSummaryResponse)
async def get_wallet_summary(
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the authenticated user's current wallet balance and recent ledger history.
    """
    require_user_role(current_user)

    wallet = await wallet_service.get_user_wallet(db, current_user.id)
    if not wallet:
        wallet = await wallet_service.create_user_wallet(db, current_user)
        await db.commit()

    # Recent transactions
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(desc(Transaction.created_at))
        .limit(10)
    )
    res = await db.execute(stmt)
    txns = res.scalars().all()

    # Total deposited
    dep_stmt = (
        select(func.sum(Transaction.amount))
        .where(Transaction.user_id == current_user.id)
        .where(Transaction.type == "WALLET_CREDIT")
        .where(Transaction.status == "SUCCESS")
    )
    dep_res = await db.execute(dep_stmt)
    total_deposited = dep_res.scalar() or Decimal("0.00")

    # Total spent
    spend_stmt = (
        select(func.sum(func.abs(Transaction.amount)))
        .where(Transaction.user_id == current_user.id)
        .where(Transaction.type == "WALLET_DEBIT")
        .where(Transaction.status == "SUCCESS")
    )
    spend_res = await db.execute(spend_stmt)
    total_spent = spend_res.scalar() or Decimal("0.00")

    # Total count
    count_stmt = select(func.count(Transaction.id)).where(Transaction.user_id == current_user.id)
    count_res = await db.execute(count_stmt)
    txns_count = count_res.scalar() or 0

    return WalletSummaryResponse(
        wallet_balance=float(wallet.balance),
        total_spent=float(total_spent),
        total_deposited=float(total_deposited),
        transactions_count=txns_count,
        currency=wallet.currency,
        currency_symbol="₹",
        recent_transactions=[
            TransactionResponse(
                id=t.id,
                amount=float(t.amount),
                type=t.type,
                transaction_type=t.transaction_type,
                status=t.status,
                description=t.description,
                reference_id=t.reference_id,
                balance_before=float(t.balance_before),
                balance_after=float(t.balance_after),
                created_at=t.created_at.isoformat() if t.created_at else ""
            )
            for t in txns
        ]
    )


@router.get("/transactions", response_model=List[TransactionResponse])
async def get_user_transactions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns paginated transaction history for the authenticated user.
    """
    require_user_role(current_user)

    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(desc(Transaction.created_at))
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    txns = res.scalars().all()

    return [
        TransactionResponse(
            id=t.id,
            amount=float(t.amount),
            type=t.type,
            transaction_type=t.transaction_type,
            status=t.status,
            description=t.description,
            reference_id=t.reference_id,
            balance_before=float(t.balance_before),
            balance_after=float(t.balance_after),
            created_at=t.created_at.isoformat() if t.created_at else ""
        )
        for t in txns
    ]


@router.get("/config", response_model=PaymentConfigResponse)
async def get_payment_config(db: AsyncSession = Depends(get_db)):
    """
    Returns public merchant payment coordinates (UPI VPA, Payee Name, QR image).
    """
    stmt = select(SystemSetting)
    res = await db.execute(stmt)
    settings = {s.key: s.value for s in res.scalars().all()}

    return PaymentConfigResponse(
        upi_vpa=settings.get("upi_vpa", "lextitle.billing@icici"),
        upi_payee_name=settings.get("upi_payee_name", "LexTitle AI Legal Systems"),
        upi_qr_image_url=settings.get("upi_qr_image_url", ""),
        min_deposit_amount=float(settings.get("min_deposit_amount", 10.0)),
        max_deposit_amount=float(settings.get("max_deposit_amount", 100000.0)),
        verification_required=True,
        currency="INR",
        currency_symbol="₹"
    )


@router.post(
    "/submit-verification",
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60, scope="wallet_utr"))]
)
async def submit_payment_verification(
    payload: SubmitVerificationRequest,
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a Bank UTR / Transaction Reference proof for verification:
    - Validates UTR length
    - Checks duplicate submissions
    - Records verification request with status PENDING
    - Wallet is NOT credited until verified by administration
    """
    require_user_role(current_user)

    ver = await payment_service.submit_payment_for_verification(
        db=db,
        user=current_user,
        amount=Decimal(str(payload.amount)),
        method=payload.method,
        utr_number=payload.utr_number,
        user_notes=payload.user_notes
    )

    return {
        "success": True,
        "status": ver.status,
        "verification_id": ver.id,
        "utr_number": ver.utr_number,
        "amount": float(ver.amount),
        "message": f"Payment of ₹{payload.amount:.2f} submitted for verification (UTR: {ver.utr_number}). Your balance will update immediately once confirmed by administration."
    }


@router.get("/verifications")
async def get_user_verifications(
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all submitted payment verifications for the authenticated user.
    """
    require_user_role(current_user)

    stmt = (
        select(PaymentVerification)
        .where(PaymentVerification.user_id == current_user.id)
        .order_by(desc(PaymentVerification.created_at))
        .limit(25)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()

    return [
        {
            "id": v.id,
            "amount": float(v.amount),
            "method": v.method,
            "utr_number": v.utr_number,
            "user_notes": v.user_notes,
            "status": v.status,
            "admin_notes": v.admin_notes,
            "created_at": v.created_at.isoformat() if v.created_at else "",
            "verified_at": v.verified_at.isoformat() if v.verified_at else None
        }
        for v in items
    ]
