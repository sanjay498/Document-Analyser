import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    APP_NAME: str = "DocAuto AI"
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/docauto.db"

    STORAGE_TYPE: str = "local"
    STORAGE_DIR: str = str(BASE_DIR.parent / "storage")

    AI_PROVIDER: str = "huggingface" # huggingface, fallback
    HUGGINGFACE_API_TOKEN: str = ""
    HUGGINGFACE_MODEL: str = "Qwen/Qwen2.5-72B-Instruct"

    OCR_ENGINE: str = "auto" # easyocr, pdfplumber, auto

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure storage directories exist
for subfolder in ["templates", "sources", "generated"]:
    folder_path = Path(settings.STORAGE_DIR) / subfolder
    folder_path.mkdir(parents=True, exist_ok=True)
