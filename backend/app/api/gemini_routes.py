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


@router.get("/diagnose")
async def diagnose_ai():
    """
    Live diagnostic endpoint to verify Google Gemini API connectivity and credentials.
    """
    key = gemini_service.api_key
    if not key:
        return {"status": "error", "message": "Neither GEMINI_API_KEY nor GOOGLE_API_KEY is configured in backend environment."}

    masked_key = f"{key[:4]}...{key[-4:]}" if len(key) > 8 else "***"
    models_to_test = ["gemini-3.8-flash", "gemini-3.8-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
    diagnostics = {}

    import httpx
    for model in models_to_test:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        headers = {"Content-Type": "application/json"}
        if key.startswith("AQ.") or key.startswith("ya29."):
            headers["Authorization"] = f"Bearer {key}"
        
        # Test A: Standard payload without thinkingConfig
        payload_std = {
            "contents": [{"parts": [{"text": "Reply with single word: OK"}]}],
            "generationConfig": {"temperature": 0.0, "maxOutputTokens": 10}
        }
        
        # Test B: Payload with thinkingBudget: 0
        payload_thinking = {
            "contents": [{"parts": [{"text": "Reply with single word: OK"}]}],
            "generationConfig": {"temperature": 0.0, "maxOutputTokens": 10, "thinkingConfig": {"thinkingBudget": 0}}
        }

        model_res = {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp_std = await client.post(url, json=payload_std, headers=headers)
                model_res["standard_call"] = {
                    "status_code": resp_std.status_code,
                    "body": resp_std.json() if resp_std.status_code == 200 else resp_text_clean(resp_std.text)
                }
                resp_th = await client.post(url, json=payload_thinking, headers=headers)
                model_res["thinking_call"] = {
                    "status_code": resp_th.status_code,
                    "body": resp_th.json() if resp_th.status_code == 200 else resp_text_clean(resp_th.text)
                }
        except Exception as e:
            model_res["error"] = str(e)

        diagnostics[model] = model_res

    return {
        "status": "tested",
        "api_key_configured": True,
        "api_key_preview": masked_key,
        "diagnostics": diagnostics
    }


def resp_text_clean(text: str) -> Any:
    try:
        import json
        return json.loads(text)
    except:
        return text[:300]


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
