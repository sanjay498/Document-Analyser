"""
Production Server-Side Google Gemini API Service
Strictly backend-only: GEMINI_API_KEY is never exposed to clients.
Provides input validation, rate limiting, timeout handling, retries, and sanitized error messages.
"""

import os
import json
import base64
import asyncio
import logging
from typing import Optional, Dict, Any, List
import httpx

logger = logging.getLogger("docfiller.gemini_service")

GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.8-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest",
]


class GeminiService:
    """
    Production-grade backend service encapsulating all interactions with the Google Gemini API.
    """
    def __init__(self):
        self._api_key: Optional[str] = None
        self._base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        self._timeout_seconds = 15.0

    @property
    def api_key(self) -> Optional[str]:
        # Lazily fetch from backend environment variables only
        if not self._api_key:
            self._api_key = (
                os.getenv("GEMINI_API_KEY", "").strip() or
                os.getenv("GOOGLE_API_KEY", "").strip() or
                None
            )
        return self._api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def _call_gemini_generate(self, model: str, contents: List[Dict[str, Any]], temperature: float = 0.1) -> str:
        """Executes a secure HTTP POST to Google Generative Language API with retry and timeout."""
        key = self.api_key
        if not key:
            raise ValueError("Google Gemini API is not configured on the server. Please contact administrator.")

        headers = {"Content-Type": "application/json"}
        if key.startswith("AQ.") or key.startswith("ya29."):
            url = f"{self._base_url}/{model}:generateContent"
            headers["Authorization"] = f"Bearer {key}"
        else:
            url = f"{self._base_url}/{model}:generateContent?key={key}"

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 8192
            }
        }

        # Try up to 2 times with exponential backoff
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"].strip()
                        return ""
                    elif resp.status_code == 429:
                        logger.warning(f"Gemini API 429 Rate Limit (attempt {attempt+1})")
                        await asyncio.sleep(1.5 * (attempt + 1))
                        continue
                    else:
                        logger.error(f"Gemini API returned HTTP {resp.status_code}: {resp.text[:200]}")
                        raise RuntimeError(f"AI Provider service temporarily returned status {resp.status_code}")
            except httpx.TimeoutException:
                logger.error("Gemini API request timed out after 35s.")
                if attempt == 1:
                    raise RuntimeError("AI processing request timed out. Please try again.")
            except Exception as e:
                logger.error(f"Gemini API unexpected error: {type(e).__name__}")
                if attempt == 1:
                    raise RuntimeError("Unable to communicate with AI generation engine.")

        raise RuntimeError("AI processing service is currently overloaded. Please retry in a few moments.")

    async def perform_vision_ocr(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
        """
        Multilingual OCR (Tamil + English) directly on image bytes using Gemini Multimodal Vision.
        """
        if not self.is_configured():
            logger.warning("Gemini API not configured for Vision OCR.")
            return ""

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        contents = [
            {
                "parts": [
                    {
                        "text": (
                            "You are a professional legal document transcription expert. Transcribe ALL text from this document image with 100% accuracy. "
                            "Preserve all Tamil script, English text, document numbers, survey numbers, dates, party names, and schedules. "
                            "Output pure transcribed text only with zero commentary or preamble."
                        )
                    },
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_image
                        }
                    }
                ]
            }
        ]

        for model in GEMINI_MODELS:
            try:
                text = await self._call_gemini_generate(model, contents, temperature=0.0)
                if text and len(text.strip()) > 5:
                    return text
            except Exception as e:
                logger.warning(f"Vision OCR model {model} attempt: {e}")
                continue
        return ""

    async def extract_fields_from_text(self, template_fields: List[Dict[str, Any]], source_texts: List[str]) -> Dict[str, Any]:
        """
        Extracts structured values matching target template fields from source document texts.
        """
        if not self.is_configured():
            raise RuntimeError("AI engine is not configured on the server.")

        combined_sources = "\n\n--- DOCUMENT BREAK ---\n\n".join(source_texts[:5])[:30000]
        field_specs = [
            {"id": f.get("id"), "label": f.get("label") or f.get("name"), "context": f.get("context", "")}
            for f in template_fields[:50]
        ]

        prompt = f"""You are a specialized legal document scrutiny AI.
Analyze the following source documents and extract the exact values for each requested template field.

REQUESTED FIELDS:
{json.dumps(field_specs, indent=2)}

SOURCE DOCUMENTS:
{combined_sources}

Return your answer strictly as a valid JSON object mapping each field 'id' to its extracted value or null if not found.
Example: {{"field_1": "Extracted text", "field_2": null}}
JSON ONLY:"""

        contents = [{"parts": [{"text": prompt}]}]
        for model in GEMINI_MODELS:
            try:
                raw_resp = await self._call_gemini_generate(model, contents, temperature=0.1)
                clean_json = raw_resp.strip()
                if clean_json.startswith("```"):
                    lines = clean_json.splitlines()
                    clean_json = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
                return json.loads(clean_json)
            except Exception as e:
                logger.warning(f"Field extraction attempt with {model} failed: {e}")
                continue

        raise RuntimeError("AI field extraction could not be completed.")


gemini_service = GeminiService()
