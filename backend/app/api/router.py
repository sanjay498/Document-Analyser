from fastapi import APIRouter
from app.api.templates import router as templates_router
from app.api.processing import router as processing_router
from app.api.documents import router as documents_router
from app.api.settings import router as settings_router

api_router = APIRouter(prefix="/api")
api_router.include_router(templates_router)
api_router.include_router(processing_router)
api_router.include_router(documents_router)
api_router.include_router(settings_router)
