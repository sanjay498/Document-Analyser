"""
Production-Grade Authentication & Authorization Engine
BCrypt password hashing, short-lived JWT access tokens, secure rotated refresh tokens,
strict role-based authorization (USER vs ADMIN), and input validation.
"""

import os
import re
import secrets
import hashlib
import datetime
from typing import Optional, Tuple
import bcrypt
import jwt
from fastapi import HTTPException, Header, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.db.database import get_db
from backend.app.db.models import User, RefreshToken, Wallet

import logging

logger = logging.getLogger("docfiller.auth")

JWT_SECRET = os.getenv("JWT_SECRET", "docfiller-production-jwt-secret-key-must-be-set-in-env-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  # 15 minutes short-lived
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 7 days long-lived


def validate_password_strength(password: str) -> None:
    """
    Validates strong password requirements:
    - Minimum 8 characters
    - Must contain both letters and numbers
    """
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain both letters and numbers."
        )


def validate_mobile_number(mobile: str) -> str:
    """
    Validates and normalizes phone number:
    Supports 10-digit Indian numbers or E.164 international formats.
    """
    if not mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number is required."
        )
    cleaned = re.sub(r"[\s\-\(\)]", "", mobile.strip())
    # Format: +919876543210 or 9876543210 (10 digits)
    if re.match(r"^\+?[1-9]\d{9,14}$", cleaned):
        return cleaned
    elif re.match(r"^[6-9]\d{9}$", cleaned):
        return f"+91{cleaned}"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number format. Please provide a valid 10-digit or international mobile number."
        )


def hash_password(password: str) -> str:
    """Hashes a plaintext password using BCrypt with salt factor 12."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plaintext password against BCrypt (with PBKDF2 fallback for migration)."""
    try:
        if not hashed_password:
            return False
        # Check standard BCrypt format ($2a$, $2b$, $2y$)
        if hashed_password.startswith("$2"):
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        
        # Legacy PBKDF2 fallback
        if "$" in hashed_password:
            salt, key_hex = hashed_password.split("$")
            computed_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
            return secrets.compare_digest(computed_key.hex(), key_hex)
        return False
    except Exception as e:
        logger.error(f"Password verification exception: {e}")
        return False


def create_access_token(user_id: str, email: str, role: str = "USER", name: str = "") -> str:
    """Generates a short-lived signed JWT access token."""
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "is_admin": (role == "ADMIN"),
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Safely decodes and verifies a signed JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None


def hash_token(raw_token: str) -> str:
    """Computes SHA-256 hash of a raw token string for secure database lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def issue_refresh_token(db: AsyncSession, user_id: str) -> str:
    """Creates and persists a secure cryptographically random refresh token."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_token(raw_token)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshToken(
        id=secrets.token_hex(16),
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        is_revoked=False
    )
    db.add(db_token)
    await db.flush()
    return raw_token


async def rotate_refresh_token(db: AsyncSession, raw_token: str) -> Tuple[str, str, User]:
    """
    Validates the supplied refresh token, marks it revoked (rotation),
    and issues a new access token and new refresh token.
    """
    token_hash = hash_token(raw_token)
    stmt = (
        select(RefreshToken)
        .options(selectinload(RefreshToken.user))
        .where(RefreshToken.token_hash == token_hash)
    )
    res = await db.execute(stmt)
    token_record = res.scalar_one_or_none()

    now = datetime.datetime.now(datetime.timezone.utc)
    if not token_record or token_record.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token. Please sign in again."
        )

    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)

    if expires_at < now:
        token_record.is_revoked = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please sign in again."
        )

    user = token_record.user
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or disabled."
        )

    # Invalidate old token (token rotation)
    new_raw_refresh = secrets.token_urlsafe(48)
    new_hash = hash_token(new_raw_refresh)
    new_expires = now + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    token_record.is_revoked = True
    token_record.replaced_by = new_hash

    new_token_record = RefreshToken(
        id=secrets.token_hex(16),
        user_id=user.id,
        token_hash=new_hash,
        expires_at=new_expires,
        is_revoked=False
    )
    db.add(new_token_record)
    await db.commit()

    new_access_token = create_access_token(user.id, user.email, user.role, user.name or "")
    return new_access_token, new_raw_refresh, user


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> bool:
    """Revokes a refresh token upon user logout."""
    token_hash = hash_token(raw_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    res = await db.execute(stmt)
    token_record = res.scalar_one_or_none()
    if token_record:
        token_record.is_revoked = True
        await db.commit()
        return True
    return False


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Extracts and verifies JWT token from Authorization header, returning User if valid."""
    if not authorization:
        return None
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    user_id = payload["sub"]
    stmt = (
        select(User)
        .options(selectinload(User.wallet))
        .where(User.id == user_id)
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if user and not user.is_active:
        return None
    return user


async def get_current_user_required(
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> User:
    """Ensures authenticated user is present and active."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token."
        )
    return current_user


async def get_current_admin_user_required(
    current_user: User = Depends(get_current_user_required)
) -> User:
    """
    Strict authorization guard ensuring the authenticated user has the ADMIN role.
    Returns HTTP 403 Forbidden to any standard user.
    """
    if current_user.role != "ADMIN":
        logger.warning(f"Unauthorized admin access attempt by user {current_user.id} ({current_user.email})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrator privileges required to access this resource."
        )
    return current_user
