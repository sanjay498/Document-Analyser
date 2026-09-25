"""
Production Server-Side Gemini API Routes
All AI generation and multimodal extraction calls route through backend GeminiService.
Clients never provide, see, or handle the GEMINI_API_KEY.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.core.auth import get_current_user_required
from backend.app.core.rate_limiter import rate_limit
from backend.app.core.gemini_service import gemini_service
from backend.app.db.models import User

router = APIRouter(prefix="/api/ai", tags=["ai"])


class FieldExtractionRequest(BaseModel):
    template_fields: List[Dict[str, Any]] = Field(..., description="Target fields to extract")
    source_texts: List[str] = Field(..., description="Extracted text from source legal documents")


class AiStatusResponse(BaseModel):
    configured: bool
    service: str = "Google Gemini & NVIDIA Nemotron AI Engine"
    mode: str = "Server-Side Protected"
    gemini_configured: bool = False
    nemotron_configured: bool = False
    active_engines: List[str] = Field(default_factory=list)


@router.get("/status", response_model=AiStatusResponse)
async def get_ai_status():
    """
    Checks whether the backend has configured AI engines (Gemini and/or Nemotron Nano)
    without exposing any secrets.
    """
    from backend.app.core.nemotron_service import nemotron_service

    is_gemini = gemini_service.is_configured()
    is_nemotron = nemotron_service.is_configured()

    active = []
    if is_gemini:
        active.append("Google Gemini 3.6 Flash")
    if is_nemotron:
        active.append("NVIDIA Nemotron-3 Nano")
    active.append("LLaMA 3.3 70B Versatile (Groq)")

    return AiStatusResponse(
        configured=is_gemini or is_nemotron,
        service="Google Gemini & NVIDIA Nemotron AI Engine",
        mode="Server-Side Protected",
        gemini_configured=is_gemini,
        nemotron_configured=is_nemotron,
        active_engines=active
    )


@router.post(
    "/extract",
    dependencies=[Depends(rate_limit(max_requests=20, window_seconds=60, scope="ai_extract"))]
)
async def extract_fields_with_gemini(
    payload: FieldExtractionRequest,
    current_user: User = Depends(get_current_user_required)
):
    """
    Authenticates user and securely performs field extraction using server-side Gemini.
    Never exposes raw provider errors or keys.
    """
    if not gemini_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI extraction engine is currently unavailable on the server."
        )

    try:
        results = await gemini_service.extract_fields_from_text(
            template_fields=payload.template_fields,
            source_texts=payload.source_texts
        )
        return {
            "success": True,
            "data": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
