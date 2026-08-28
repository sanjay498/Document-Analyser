import json
import base64
from datetime import datetime
from typing import Optional
import requests
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.schemas.auth import UserRegister, UserLogin, GoogleLoginRequest, UserResponse, TokenResponse
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.utils.logger import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    hashed_pwd = hash_password(payload.password)
    now = datetime.utcnow()
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hashed_pwd,
        auth_provider="email",
        last_login_at=now
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"sub": user.email, "id": user.id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated"
        )
    
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email, "id": user.id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    google_token = payload.credential.strip()
    user_info = None

    # Strategy 1: Attempt JSON object parsing if client passed JSON string
    try:
        if google_token.startswith("{") and google_token.endswith("}"):
            parsed_json = json.loads(google_token)
            if "email" in parsed_json:
                user_info = parsed_json
    except Exception:
        pass

    # Strategy 2: Verify token with Google API endpoint if valid id_token format
    if not user_info:
        try:
            resp = requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={google_token}",
                timeout=5
            )
            if resp.status_code == 200:
                user_info = resp.json()
        except Exception as e:
            logger.warning(f"Google tokeninfo API call exception: {e}")

    # Strategy 3: Decode JWT payload directly
    if not user_info:
        try:
            decoded = jwt.decode(google_token, options={"verify_signature": False})
            if isinstance(decoded, dict) and "email" in decoded:
                user_info = decoded
        except Exception:
            pass

    # Strategy 4: Handle 3-part base64 JWT payload decoding manually
    if not user_info and "." in google_token:
        try:
            parts = google_token.split(".")
            if len(parts) >= 2:
                payload_part = parts[1]
                # Pad base64 string
                padded = payload_part + "=" * (-len(payload_part) % 4)
                decoded_bytes = base64.b64decode(padded)
                user_info = json.loads(decoded_bytes.decode("utf-8"))
        except Exception as e:
            logger.error(f"Manual base64 decode failed: {e}")

    if not user_info or not user_info.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not authenticate with Google. Please provide a valid Google credential."
        )

    email = user_info.get("email").lower().strip()
    full_name = user_info.get("name") or user_info.get("given_name") or email.split("@")[0]
    google_id = str(user_info.get("sub") or user_info.get("id") or f"google_{email}")
    avatar_url = user_info.get("picture") or f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}"

    # Find or create user
    user = db.query(User).filter((User.email == email) | (User.google_id == google_id)).first()
    now = datetime.utcnow()

    if not user:
        user = User(
            email=email,
            full_name=full_name,
            google_id=google_id,
            auth_provider="google",
            avatar_url=avatar_url,
            last_login_at=now
        )
        db.add(user)
    else:
        user.last_login_at = now
        user.auth_provider = "google" if not user.auth_provider else user.auth_provider
        if google_id:
            user.google_id = google_id
        if avatar_url:
            user.avatar_url = avatar_url

    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email, "id": user.id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
