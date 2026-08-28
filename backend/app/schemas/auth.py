from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class UserRegister(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., description="Google OAuth ID Token / Credential string")

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    auth_provider: str = "email"
    avatar_url: Optional[str] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
