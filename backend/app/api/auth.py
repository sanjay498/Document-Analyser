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
    google_token = payload.credential
    user_info = None

    # Step 1: Verify token with Google API endpoint
    try:
        resp = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={google_token}",
            timeout=10
        )
        if resp.status_code == 200:
            user_info = resp.json()
    except Exception as e:
        logger.warning(f"Google tokeninfo API call failed: {e}")

    # Fallback: Decode JWT payload directly
    if not user_info:
        try:
            decoded = jwt.decode(google_token, options={"verify_signature": False})
            if "email" in decoded:
                user_info = decoded
        except Exception as e:
            logger.error(f"Failed to decode Google JWT token: {e}")

    if not user_info or "email" not in user_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google OAuth credential token"
        )

    email = user_info.get("email")
    full_name = user_info.get("name") or user_info.get("given_name", "")
    google_id = user_info.get("sub")
    avatar_url = user_info.get("picture")

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
