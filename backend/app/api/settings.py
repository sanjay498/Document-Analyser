from fastapi import APIRouter
from app.config import settings
from app.schemas.ai import AISettingsSchema

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=AISettingsSchema)
def get_settings():
    return AISettingsSchema(
        ai_provider=settings.AI_PROVIDER,
        huggingface_api_token=settings.HUGGINGFACE_API_TOKEN,
        huggingface_model=settings.HUGGINGFACE_MODEL,
        ocr_engine=settings.OCR_ENGINE
    )

@router.put("", response_model=AISettingsSchema)
def update_settings(payload: AISettingsSchema):
    settings.AI_PROVIDER = payload.ai_provider
    if payload.huggingface_api_token is not None:
        settings.HUGGINGFACE_API_TOKEN = payload.huggingface_api_token
    if payload.huggingface_model:
        settings.HUGGINGFACE_MODEL = payload.huggingface_model
    if payload.ocr_engine:
        settings.OCR_ENGINE = payload.ocr_engine

    return AISettingsSchema(
        ai_provider=settings.AI_PROVIDER,
        huggingface_api_token=settings.HUGGINGFACE_API_TOKEN,
        huggingface_model=settings.HUGGINGFACE_MODEL,
        ocr_engine=settings.OCR_ENGINE
    )
