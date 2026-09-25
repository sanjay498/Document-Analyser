"""
Production Admin Management API Routes
Strictly authorized (ADMIN role only), zero admin wallet, audited manual balance adjustments,
QR code upload with MIME/size validation, and immutable audit logs.
"""

import os
import re
import uuid
import json
import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from pydantic import BaseModel, Field
from PIL import Image
import io

from backend.app.db.database import get_db
from backend.app.db.models import (
    User,
    Wallet,
    Transaction,
    SystemPricingConfig,
    SystemSetting,
    PaymentVerification,
    AuditLog,
    DocumentHistoryItem
)
from backend.app.core.auth import get_current_admin_user_required
from backend.app.services.wallet_service import wallet_service
from backend.app.services.payment_service import payment_service
from backend.app.services.audit_service import audit_service
import logging

logger = logging.getLogger("docfiller.admin_routes")

router = APIRouter(prefix="/api/admin", tags=["admin"])


class WalletAdjustmentRequest(BaseModel):
    action: Optional[str] = Field(None, description="Action: 'add' (CREDIT) or 'deduct' (DEBIT)")
    type: Optional[str] = Field(None, description="Type alias: 'CREDIT' or 'DEBIT'")
    amount: float = Field(..., ge=0.01, description="Amount in INR")
    reason: str = Field(..., min_length=5, description="Audit note explaining the adjustment")
    reference: Optional[str] = Field(None, max_length=64, description="Optional reference code or note")


class UserStatusRequest(BaseModel):
    is_active: bool
    reason: str = Field(..., min_length=3, description="Reason for suspension or activation")


class VerifyPaymentRequest(BaseModel):
    admin_notes: Optional[str] = Field(None, max_length=255)


class RejectPaymentRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255, description="Reason for rejection")


class UpiSettingsUpdateRequest(BaseModel):
    upi_vpa: str = Field(..., min_length=3, max_length=100, description="Merchant UPI ID")
    upi_payee_name: str = Field(..., min_length=2, max_length=100, description="Merchant Payee Name")
    upi_qr_image_url: Optional[str] = Field("", description="Custom QR Image URL")
    payment_verification_mode: Optional[str] = Field("manual_admin", description="manual_admin or instant_simulation")
    min_deposit_amount: Optional[float] = Field(10.0, ge=1.0)
    max_deposit_amount: Optional[float] = Field(100000.0, ge=100.0)


class PricingUpdateRequest(BaseModel):
    doc_generation_fee: Optional[float] = Field(None, ge=0.0)
    ocr_per_page_fee: Optional[float] = Field(None, ge=0.0)


@router.get("/dashboard")
@router.get("/metrics")
async def get_admin_metrics(
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns platform financial figures, user stats, and actual transactional trends.
    Does NOT contain any admin wallet balances.
    """
    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Total Platform Deposits
    rev_stmt = (
        select(func.sum(Transaction.amount))
        .where(Transaction.type == "WALLET_CREDIT")
        .where(Transaction.status == "SUCCESS")
    )
    rev_res = await db.execute(rev_stmt)
    total_platform_revenue = rev_res.scalar() or Decimal("0.00")

    # 2. Total User Spend
    spend_stmt = (
        select(func.sum(func.abs(Transaction.amount)))
        .where(Transaction.type == "WALLET_DEBIT")
        .where(Transaction.status == "SUCCESS")
    )
    spend_res = await db.execute(spend_stmt)
    total_user_spent = spend_res.scalar() or Decimal("0.00")

    # 3. Total Active User Float Liability
    float_stmt = select(func.sum(Wallet.balance))
    float_res = await db.execute(float_stmt)
    total_outstanding_float = float_res.scalar() or Decimal("0.00")

    # 4. User Counts
    total_users_stmt = select(func.count(User.id))
    total_users = (await db.execute(total_users_stmt)).scalar() or 0

    admin_users_stmt = select(func.count(User.id)).where(User.role == "ADMIN")
    admin_users = (await db.execute(admin_users_stmt)).scalar() or 0

    active_users_stmt = select(func.count(User.id)).where(User.role == "USER", User.is_active == True)
    active_users = (await db.execute(active_users_stmt)).scalar() or 0

    suspended_users_stmt = select(func.count(User.id)).where(User.role == "USER", User.is_active == False)
    suspended_users = (await db.execute(suspended_users_stmt)).scalar() or 0

    # 5. Document History Counts
    docs_stmt = select(func.count(DocumentHistoryItem.id))
    total_documents = (await db.execute(docs_stmt)).scalar() or 0

    today_start = datetime.datetime.combine(now.date(), datetime.time.min, tzinfo=datetime.timezone.utc)
    docs_today_stmt = select(func.count(DocumentHistoryItem.id)).where(DocumentHistoryItem.generated_at >= today_start)
    docs_today = (await db.execute(docs_today_stmt)).scalar() or 0

    month_start = datetime.datetime(now.year, now.month, 1, tzinfo=datetime.timezone.utc)
    docs_month_stmt = select(func.count(DocumentHistoryItem.id)).where(DocumentHistoryItem.generated_at >= month_start)
    docs_this_month = (await db.execute(docs_month_stmt)).scalar() or 0

    # 6. Total Transactions Count
    txns_stmt = select(func.count(Transaction.id))
    total_transactions = (await db.execute(txns_stmt)).scalar() or 0

    # 7. Payment Verifications Breakdown
    pend_stmt = select(func.count(PaymentVerification.id)).where(PaymentVerification.status == "PENDING")
    pending_verifications = (await db.execute(pend_stmt)).scalar() or 0

    succ_stmt = select(func.count(PaymentVerification.id)).where(PaymentVerification.status == "SUCCESS")
    successful_payments = (await db.execute(succ_stmt)).scalar() or 0

    fail_stmt = select(func.count(PaymentVerification.id)).where(PaymentVerification.status.in_(["FAILED", "REJECTED"]))
    failed_payments = (await db.execute(fail_stmt)).scalar() or 0

    # 8. Daily 7-day Trends
    chart_days = []
    for i in range(6, -1, -1):
        day_date = (now - datetime.timedelta(days=i)).date()
        chart_days.append({
            "date": day_date.strftime("%b %d"),
            "full_date": str(day_date),
            "deposits": 0.0,
            "spends": 0.0
        })

    seven_days_ago = now - datetime.timedelta(days=7)
    recent_stmt = (
        select(Transaction)
        .where(Transaction.created_at >= seven_days_ago)
        .order_by(Transaction.created_at)
    )
    recent_txns = (await db.execute(recent_stmt)).scalars().all()

    for txn in recent_txns:
        if not txn.created_at:
            continue
        t_date_str = str(txn.created_at.date())
        for d in chart_days:
            if d["full_date"] == t_date_str:
                if txn.type == "WALLET_CREDIT":
                    d["deposits"] += float(txn.amount)
                elif txn.type == "WALLET_DEBIT":
                    d["spends"] += abs(float(txn.amount))

    # 9. Type Breakdown
    type_counts_stmt = (
        select(Transaction.type, func.count(Transaction.id), func.sum(func.abs(Transaction.amount)))
        .group_by(Transaction.type)
    )
    type_res = await db.execute(type_counts_stmt)
    breakdown = [
        {"type": row[0], "count": row[1], "volume": float(row[2] or 0.0)}
        for row in type_res.all()
    ]

    return {
        "status": "operational",
        "financials": {
            "total_platform_revenue": float(total_platform_revenue),
            "total_user_spent": float(total_user_spent),
            "total_outstanding_float": float(total_outstanding_float),
            "currency": "INR",
            "currency_symbol": "₹"
        },
        "counts": {
            "total_users": total_users,
            "active_users": active_users,
            "suspended_users": suspended_users,
            "admin_users": admin_users,
            "regular_users": max(0, total_users - admin_users),
            "total_documents": total_documents,
            "docs_today": docs_today,
            "docs_this_month": docs_this_month,
            "total_transactions": total_transactions,
            "pending_verifications": pending_verifications,
            "successful_payments": successful_payments,
            "pending_payments": pending_verifications,
            "failed_payments": failed_payments
        },
        "charts": {
            "daily_trends": chart_days,
            "type_breakdown": breakdown
        }
    }


@router.get("/users")
async def get_admin_users(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists user accounts with their wallet balance, role, and active status.
    Never returns passwords or password hashes.
    """
    query = select(User)
    if search:
        s_term = f"%{search.lower().strip()}%"
        query = query.where(or_(User.email.ilike(s_term), User.name.ilike(s_term), User.mobile.ilike(s_term)))

    if status_filter:
        s_clean = status_filter.lower().strip()
        if s_clean == "active":
            query = query.where(User.is_active == True)
        elif s_clean in ["suspended", "inactive"]:
            query = query.where(User.is_active == False)

    query = query.order_by(desc(User.created_at)).offset(offset).limit(limit)
    res = await db.execute(query)
    users = res.scalars().all()

    user_list = []
    for u in users:
        # Fetch wallet if standard user
        wallet = await wallet_service.get_user_wallet(db, u.id)
        wallet_bal = float(wallet.balance) if wallet else 0.0

        # Count documents
        doc_count_stmt = select(func.count(DocumentHistoryItem.id)).where(DocumentHistoryItem.user_id == u.id)
        docs_count = (await db.execute(doc_count_stmt)).scalar() or 0

        user_list.append({
            "id": u.id,
            "name": u.name,
            "full_name": u.name,
            "email": u.email,
            "mobile": u.mobile,
            "role": u.role,
            "is_admin": (u.role == "ADMIN"),
            "is_active": u.is_active,
            "wallet_balance": wallet_bal if u.role == "USER" else None,
            "documents_count": docs_count,
            "created_at": u.created_at.isoformat() if u.created_at else ""
        })

    return user_list


@router.get("/users/{user_id}")
async def get_admin_user_detail(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns complete user profile, wallet balance, recent transactions,
    payment verifications, and generated documents.
    """
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")

    wallet = await wallet_service.get_user_wallet(db, target_user.id)
    wallet_bal = float(wallet.balance) if wallet else (0.0 if target_user.role == "USER" else None)

    # Recent transactions
    tx_stmt = select(Transaction).where(Transaction.user_id == target_user.id).order_by(desc(Transaction.created_at)).limit(20)
    txns = (await db.execute(tx_stmt)).scalars().all()

    # Recent payment verifications
    pv_stmt = select(PaymentVerification).where(PaymentVerification.user_id == target_user.id).order_by(desc(PaymentVerification.created_at)).limit(20)
    pvs = (await db.execute(pv_stmt)).scalars().all()

    # Recent documents
    docs_stmt = select(DocumentHistoryItem).where(DocumentHistoryItem.user_id == target_user.id).order_by(desc(DocumentHistoryItem.generated_at)).limit(20)
    docs = (await db.execute(docs_stmt)).scalars().all()

    return {
        "id": target_user.id,
        "name": target_user.name,
        "email": target_user.email,
        "mobile": target_user.mobile,
        "role": target_user.role,
        "is_admin": (target_user.role == "ADMIN"),
        "is_active": target_user.is_active,
        "wallet_balance": wallet_bal,
        "created_at": target_user.created_at.isoformat() if target_user.created_at else "",
        "recent_transactions": [
            {
                "id": t.id,
                "amount": float(t.amount),
                "type": t.type,
                "status": t.status,
                "description": t.description,
                "reference_id": t.reference_id,
                "balance_after": float(t.balance_after),
                "created_at": t.created_at.isoformat() if t.created_at else ""
            }
            for t in txns
        ],
        "recent_verifications": [
            {
                "id": p.id,
                "amount": float(p.amount),
                "method": p.method,
                "utr_number": p.utr_number,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else ""
            }
            for p in pvs
        ],
        "recent_documents": [
            {
                "id": d.id,
                "template_filename": d.template_filename,
                "status": d.status,
                "generated_at": d.generated_at.isoformat() if d.generated_at else ""
            }
            for d in docs
        ]
    }


@router.get("/users/{user_id}/wallet")
async def get_admin_user_wallet(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a target user's wallet details and recent transactions.
    """
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")

    if target_user.role == "ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Administrator accounts do not possess a wallet.")

    wallet = await wallet_service.get_user_wallet(db, target_user.id)
    if not wallet:
        wallet = await wallet_service.create_user_wallet(db, target_user)
        await db.commit()

    tx_stmt = select(Transaction).where(Transaction.user_id == target_user.id).order_by(desc(Transaction.created_at)).limit(20)
    txns = (await db.execute(tx_stmt)).scalars().all()

    return {
        "user_id": target_user.id,
        "wallet_id": wallet.id,
        "balance": float(wallet.balance),
        "currency": wallet.currency,
        "recent_transactions": [
            {
                "id": t.id,
                "amount": float(t.amount),
                "type": t.type,
                "status": t.status,
                "description": t.description,
                "reference_id": t.reference_id,
                "balance_after": float(t.balance_after),
                "created_at": t.created_at.isoformat() if t.created_at else ""
            }
            for t in txns
        ]
    }


@router.post("/users/{user_id}/wallet/adjust")
@router.post("/users/{user_id}/wallet-adjust")
async def adjust_user_wallet(
    user_id: str,
    payload: WalletAdjustmentRequest,
    request: Request,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Performs an explicit, audited balance adjustment on a user's wallet.
    Admin directly specifies:
    - action: 'add' (CREDIT) or 'deduct' (DEBIT)
    - amount: strictly > 0
    - reason: mandatory audit description (min 5 characters)
    - reference: optional tracking note/code
    Creates immutable WalletAdjustment and AuditLog records.
    """
    # 1. Target user verification
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")

    if target_user.role == "ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot adjust balance for an administrator account.")

    # 2. Normalize adjustment type
    action_clean = (payload.action or payload.type or "").lower().strip()
    if action_clean in ["add", "credit"]:
        adj_type = "CREDIT"
    elif action_clean in ["deduct", "debit"]:
        adj_type = "DEBIT"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Action must be 'add' (credit) or 'deduct' (debit).")

    client_ip = request.client.host if request.client else "unknown"

    adj, txn = await wallet_service.adjust_wallet_balance(
        db=db,
        target_user_id=target_user.id,
        admin_user=current_admin,
        amount=Decimal(str(payload.amount)),
        adjustment_type=adj_type,
        reason=payload.reason,
        reference=payload.reference,
        ip_address=client_ip
    )

    return {
        "success": True,
        "message": f"Successfully adjusted wallet balance for {target_user.email}.",
        "user_id": target_user.id,
        "adjustment_id": adj.id,
        "type": adj.type,
        "amount": float(adj.amount),
        "reference": adj.reference,
        "balance_after": float(txn.balance_after)
    }


@router.post("/users/{user_id}/status")
async def toggle_user_active_status(
    user_id: str,
    payload: UserStatusRequest,
    request: Request,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Suspends or activates a user account with audit logging.
    Prevents administrators from locking themselves out.
    """
    if user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot suspend your own administrator account.")

    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")

    target_user.is_active = payload.is_active

    client_ip = request.client.host if request.client else "unknown"
    await audit_service.log_action(
        db=db,
        admin_id=current_admin.id,
        action="USER_ACTIVATION" if payload.is_active else "USER_SUSPENSION",
        target_type="USER",
        target_id=target_user.id,
        metadata={"email": target_user.email, "reason": payload.reason},
        ip_address=client_ip
    )

    await db.commit()
    return {
        "success": True,
        "user_id": target_user.id,
        "is_active": target_user.is_active,
        "message": f"User {target_user.email} status updated to {'Active' if target_user.is_active else 'Suspended'}."
    }


@router.get("/verifications")
async def get_admin_verifications(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns payment verification requests submitted by users for admin audit.
    """
    query = (
        select(PaymentVerification, User.email, User.name, User.mobile)
        .join(User, PaymentVerification.user_id == User.id)
    )
    if status_filter:
        query = query.where(PaymentVerification.status == status_filter.upper().strip())

    query = query.order_by(desc(PaymentVerification.created_at)).offset(offset).limit(limit)
    rows = (await db.execute(query)).all()

    return [
        {
            "id": ver.id,
            "user_id": ver.user_id,
            "user_email": email,
            "user_name": name,
            "user_mobile": mobile,
            "amount": float(ver.amount),
            "method": ver.method,
            "utr_number": ver.utr_number,
            "user_notes": ver.user_notes,
            "status": ver.status,
            "admin_notes": ver.admin_notes,
            "verified_by": ver.verified_by,
            "verified_at": ver.verified_at.isoformat() if ver.verified_at else None,
            "created_at": ver.created_at.isoformat() if ver.created_at else ""
        }
        for ver, email, name, mobile in rows
    ]


@router.post("/verifications/{verification_id}/verify")
async def verify_payment(
    verification_id: str,
    payload: VerifyPaymentRequest = VerifyPaymentRequest(),
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin confirms incoming bank transaction, marks verification as SUCCESS,
    and atomically credits user's wallet float.
    """
    client_ip = request.client.host if request and request.client else "unknown"
    ver = await payment_service.verify_and_credit(
        db=db,
        verification_id=verification_id,
        admin_user=current_admin,
        admin_notes=payload.admin_notes,
        ip_address=client_ip
    )

    wallet = await wallet_service.get_user_wallet(db, ver.user_id)

    return {
        "success": True,
        "message": f"Payment of ₹{ver.amount:.2f} verified. User wallet successfully credited.",
        "verification_id": ver.id,
        "status": ver.status,
        "new_balance": float(wallet.balance) if wallet else 0.0
    }


@router.post("/verifications/{verification_id}/reject")
async def reject_payment(
    verification_id: str,
    payload: RejectPaymentRequest,
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin rejects an invalid payment request. User wallet is untouched.
    """
    client_ip = request.client.host if request and request.client else "unknown"
    ver = await payment_service.reject_payment(
        db=db,
        verification_id=verification_id,
        admin_user=current_admin,
        reason=payload.reason,
        ip_address=client_ip
    )

    return {
        "success": True,
        "message": "Payment verification request rejected.",
        "verification_id": ver.id,
        "status": ver.status,
        "reason": ver.admin_notes
    }


@router.get("/upi-settings")
async def get_upi_settings(
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SystemSetting)
    res = await db.execute(stmt)
    settings = {s.key: s.value for s in res.scalars().all()}

    return {
        "upi_vpa": settings.get("upi_vpa", "lextitle.billing@icici"),
        "upi_payee_name": settings.get("upi_payee_name", "LexTitle AI Legal Systems"),
        "upi_qr_image_url": settings.get("upi_qr_image_url", ""),
        "payment_verification_mode": settings.get("payment_verification_mode", "manual_admin"),
        "min_deposit_amount": float(settings.get("min_deposit_amount", 10.0)),
        "max_deposit_amount": float(settings.get("max_deposit_amount", 100000.0))
    }


@router.post("/upi-settings")
async def update_upi_settings(
    payload: UpiSettingsUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates UPI VPA and Merchant settings.
    Validates VPA format: e.g. merchant@icici or user@upi.
    """
    vpa = payload.upi_vpa.strip()
    if not re.match(r"^[\w\.\-]+@[\w\.\-]+$", vpa):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UPI VPA format (e.g. business@bank).")

    updates = {
        "upi_vpa": vpa,
        "upi_payee_name": payload.upi_payee_name.strip(),
        "payment_verification_mode": payload.payment_verification_mode or "manual_admin",
        "min_deposit_amount": str(payload.min_deposit_amount or 10.0),
        "max_deposit_amount": str(payload.max_deposit_amount or 100000.0)
    }
    if payload.upi_qr_image_url is not None:
        updates["upi_qr_image_url"] = payload.upi_qr_image_url.strip()

    for key, val in updates.items():
        stmt = select(SystemSetting).where(SystemSetting.key == key)
        cfg = (await db.execute(stmt)).scalar_one_or_none()
        if cfg:
            cfg.value = val
        else:
            db.add(SystemSetting(id=str(uuid.uuid4()), key=key, value=val))

    client_ip = request.client.host if request.client else "unknown"
    await audit_service.log_action(
        db=db,
        admin_id=current_admin.id,
        action="UPI_SETTINGS_CHANGED",
        target_type="SETTING",
        target_id="upi_vpa",
        metadata=updates,
        ip_address=client_ip
    )

    await db.commit()
    return {"success": True, "message": "UPI payment settings updated successfully.", "settings": updates}


@router.post("/upload-qr")
async def upload_qr_code(
    file: UploadFile = File(...),
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Secure QR Code upload:
    - Validates MIME type: image/png, image/jpeg, image/webp
    - Validates file size: max 5MB
    - Verifies image format using Pillow
    - Saves to secure upload directory outside git repository
    """
    ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only PNG, JPEG, and WebP are supported."
        )

    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code image exceeds maximum allowed size of 5 MB."
        )

    # Validate image integrity
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Corrupted or invalid image file.")

    # Secure storage directory
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "qr")
    os.makedirs(upload_dir, exist_ok=True)

    ext = ".png" if "png" in (file.content_type or "") else ".jpg"
    filename = f"qr_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(file_bytes)

    relative_url = f"/uploads/qr/{filename}"

    # Update system setting
    stmt = select(SystemSetting).where(SystemSetting.key == "upi_qr_image_url")
    cfg = (await db.execute(stmt)).scalar_one_or_none()
    if cfg:
        cfg.value = relative_url
    else:
        db.add(SystemSetting(id=str(uuid.uuid4()), key="upi_qr_image_url", value=relative_url))

    client_ip = request.client.host if request and request.client else "unknown"
    await audit_service.log_action(
        db=db,
        admin_id=current_admin.id,
        action="QR_CODE_UPLOADED",
        target_type="SETTING",
        target_id="upi_qr_image_url",
        metadata={"filename": filename, "size_bytes": len(file_bytes)},
        ip_address=client_ip
    )

    await db.commit()
    return {
        "success": True,
        "message": "QR code uploaded and configured successfully.",
        "qr_image_url": relative_url
    }


@router.delete("/remove-qr")
async def remove_qr_code(
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Removes custom uploaded QR code and reverts to dynamic SVG generator."""
    stmt = select(SystemSetting).where(SystemSetting.key == "upi_qr_image_url")
    cfg = (await db.execute(stmt)).scalar_one_or_none()
    if cfg:
        cfg.value = ""

    client_ip = request.client.host if request and request.client else "unknown"
    await audit_service.log_action(
        db=db,
        admin_id=current_admin.id,
        action="QR_CODE_REMOVED",
        target_type="SETTING",
        target_id="upi_qr_image_url",
        ip_address=client_ip
    )
    await db.commit()
    return {"success": True, "message": "Custom QR code removed."}


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns immutable audit log records for administrative compliance.
    """
    stmt = (
        select(AuditLog, User.email)
        .outerjoin(User, AuditLog.admin_id == User.id)
        .order_by(desc(AuditLog.created_at))
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "id": log.id,
            "admin_id": log.admin_id,
            "admin_email": email or "SYSTEM",
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "metadata": log.metadata_json,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else ""
        }
        for log, email in rows
    ]


@router.get("/transactions")
async def get_all_platform_transactions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Platform-wide transaction audit ledger across all users.
    """
    query = (
        select(Transaction, User.email, User.name)
        .join(User, Transaction.user_id == User.id)
        .order_by(desc(Transaction.created_at))
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(query)).all()

    return [
        {
            "id": txn.id,
            "user_id": txn.user_id,
            "user_email": email,
            "user_name": name,
            "amount": float(txn.amount),
            "type": txn.type,
            "transaction_type": txn.transaction_type,
            "status": txn.status,
            "description": txn.description,
            "reference_id": txn.reference_id,
            "balance_after": float(txn.balance_after),
            "created_at": txn.created_at.isoformat() if txn.created_at else ""
        }
        for txn, email, name in rows
    ]


# ---------------- DOCUMENT HISTORY ENDPOINTS (PERSISTENT STORAGE) ----------------

@router.get("/documents")
async def get_admin_documents(
    search: Optional[str] = None,
    user_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns persistent generated document records with user metadata,
    search, and status filters.
    """
    query = (
        select(DocumentHistoryItem, User.email, User.name)
        .outerjoin(User, DocumentHistoryItem.user_id == User.id)
    )
    if user_id:
        query = query.where(DocumentHistoryItem.user_id == user_id)
    if status_filter and status_filter.lower() != "all":
        query = query.where(DocumentHistoryItem.status.ilike(status_filter.strip()))
    if search:
        s_term = f"%{search.lower().strip()}%"
        query = query.where(
            or_(
                DocumentHistoryItem.template_filename.ilike(s_term),
                DocumentHistoryItem.id.ilike(s_term),
                User.email.ilike(s_term),
                User.name.ilike(s_term)
            )
        )
    query = query.order_by(desc(DocumentHistoryItem.generated_at)).offset(offset).limit(limit)
    rows = (await db.execute(query)).all()

    documents = []
    for doc, email, name in rows:
        sources_cnt = 0
        if doc.sources_summary_json:
            try:
                sources_cnt = len(json.loads(doc.sources_summary_json))
            except Exception:
                pass
        fields_cnt = 0
        if doc.field_values_json:
            try:
                fields_cnt = len(json.loads(doc.field_values_json))
            except Exception:
                pass
        documents.append({
            "id": doc.id,
            "user_id": doc.user_id,
            "user_email": email or "Unknown",
            "user_name": name or "Unknown",
            "document_type": doc.template_filename.split(".")[0].replace("_", " ").title(),
            "template_filename": doc.template_filename,
            "status": doc.status or "completed",
            "generated_at": doc.generated_at.isoformat() if doc.generated_at else "",
            "sources_count": sources_cnt,
            "fields_count": fields_cnt
        })
    return documents


@router.get("/documents/{document_id}")
async def get_admin_document_detail(
    document_id: str,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns detailed document metadata, sources used, extracted fields,
    and table records.
    """
    query = (
        select(DocumentHistoryItem, User.email, User.name)
        .outerjoin(User, DocumentHistoryItem.user_id == User.id)
        .where(DocumentHistoryItem.id == document_id)
    )
    res = await db.execute(query)
    row = res.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document record not found.")

    doc, email, name = row
    sources_summary = []
    if doc.sources_summary_json:
        try:
            sources_summary = json.loads(doc.sources_summary_json)
        except Exception:
            sources_summary = []

    field_values = {}
    if doc.field_values_json:
        try:
            field_values = json.loads(doc.field_values_json)
        except Exception:
            field_values = {}

    table_records = []
    if doc.table_records_json:
        try:
            table_records = json.loads(doc.table_records_json)
        except Exception:
            table_records = []

    return {
        "id": doc.id,
        "user_id": doc.user_id,
        "user_email": email or "Unknown",
        "user_name": name or "Unknown",
        "document_type": doc.template_filename.split(".")[0].replace("_", " ").title(),
        "template_filename": doc.template_filename,
        "status": doc.status or "completed",
        "generated_at": doc.generated_at.isoformat() if doc.generated_at else "",
        "storage_key": f"db://document_history/{doc.id}",
        "sources_summary": sources_summary,
        "field_values": field_values,
        "table_records": table_records
    }


@router.get("/documents/{document_id}/download")
async def download_admin_document(
    document_id: str,
    request: Request,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Secure document download endpoint:
    - Verifies document exists in persistent store
    - Logs DOCUMENT_DOWNLOADED audit record
    - Returns document binary stream
    """
    stmt = select(DocumentHistoryItem).where(DocumentHistoryItem.id == document_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc or not doc.docx_bytes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found in persistent storage.")

    client_ip = request.client.host if request.client else "unknown"
    await audit_service.log_action(
        db=db,
        admin_id=current_admin.id,
        action="DOCUMENT_DOWNLOADED",
        target_type="DOCUMENT",
        target_id=doc.id,
        metadata={"template": doc.template_filename, "user_id": doc.user_id},
        ip_address=client_ip
    )
    await db.commit()

    filename = doc.template_filename or f"document_{doc.id}.docx"
    return Response(
        content=doc.docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ---------------- PRICING & SETTINGS CONFIGURATION ----------------

@router.get("/pricing")
@router.get("/settings")
async def get_pricing(
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Returns platform fee configuration."""
    stmt = select(SystemPricingConfig)
    res = await db.execute(stmt)
    pricing = {p.key: float(p.value) for p in res.scalars().all()}
    return {
        "doc_generation_fee": pricing.get("doc_generation_fee", 50.0),
        "ocr_per_page_fee": pricing.get("ocr_per_page_fee", 5.0),
        "signup_bonus": pricing.get("signup_bonus", 0.0),
    }


@router.post("/pricing")
@router.post("/settings")
async def update_pricing(
    payload: PricingUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Updates platform pricing configuration and audits the change."""
    updates = {}
    if payload.doc_generation_fee is not None:
        updates["doc_generation_fee"] = Decimal(str(payload.doc_generation_fee))
    if payload.ocr_per_page_fee is not None:
        updates["ocr_per_page_fee"] = Decimal(str(payload.ocr_per_page_fee))

    for k, v in updates.items():
        stmt = select(SystemPricingConfig).where(SystemPricingConfig.key == k)
        cfg = (await db.execute(stmt)).scalar_one_or_none()
        if cfg:
            cfg.value = v
        else:
            db.add(SystemPricingConfig(id=str(uuid.uuid4()), key=k, value=v, description=k))

    client_ip = request.client.host if request and request.client else "unknown"
    await audit_service.log_action(
        db=db,
        admin_id=current_admin.id,
        action="PLATFORM_PRICING_UPDATED",
        target_type="SETTING",
        target_id="pricing",
        metadata={k: float(v) for k, v in updates.items()},
        ip_address=client_ip
    )
    await db.commit()
    return {
        "success": True,
        "message": "Platform pricing rules updated successfully.",
        "pricing": {k: float(v) for k, v in updates.items()}
    }


# ---------------- PAYMENT & PAYMENT-METHODS ALIASES ----------------

@router.get("/payments")
async def get_admin_payments(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Alias for /verifications."""
    return await get_admin_verifications(status_filter=status_filter, limit=limit, offset=offset, current_admin=current_admin, db=db)


@router.post("/payments/{verification_id}/verify")
async def verify_payment_alias(
    verification_id: str,
    payload: VerifyPaymentRequest = VerifyPaymentRequest(),
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Alias for /verifications/{verification_id}/verify."""
    return await verify_payment(verification_id=verification_id, payload=payload, request=request, current_admin=current_admin, db=db)


@router.post("/payments/{verification_id}/reject")
async def reject_payment_alias(
    verification_id: str,
    payload: RejectPaymentRequest = None,
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Alias for /verifications/{verification_id}/reject."""
    return await reject_payment(verification_id=verification_id, payload=payload, request=request, current_admin=current_admin, db=db)


@router.get("/payment-methods")
async def get_admin_payment_methods(
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Returns payment methods and UPI configuration."""
    return await get_upi_settings(current_admin=current_admin, db=db)


@router.post("/payment-methods/upi")
async def update_admin_payment_methods_upi(
    payload: UpiSettingsUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Updates UPI configuration."""
    return await update_upi_settings(payload=payload, request=request, current_admin=current_admin, db=db)


@router.post("/payment-methods/qr")
async def upload_admin_payment_methods_qr(
    file: UploadFile = File(...),
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Uploads QR image."""
    return await upload_qr_code(file=file, request=request, current_admin=current_admin, db=db)


@router.delete("/payment-methods/qr")
async def remove_admin_payment_methods_qr(
    request: Request = None,
    current_admin: User = Depends(get_current_admin_user_required),
    db: AsyncSession = Depends(get_db)
):
    """Removes custom QR image."""
    return await remove_qr_code(request=request, current_admin=current_admin, db=db)

