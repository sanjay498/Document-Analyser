"""
Production Server-Side NVIDIA Nemotron Nano AI Service
Provides high-throughput, agentic legal reasoning, document analysis,
and structured field extraction using NVIDIA Nemotron Nano models.
Supports NVIDIA NIM Cloud (build.nvidia.com), OpenRouter, and local Ollama.
"""

import os
import json
import asyncio
import logging
from typing import Optional, Dict, Any, List
import httpx
from dotenv import load_dotenv, find_dotenv

# Ensure environment variables are loaded
load_dotenv(find_dotenv())

logger = logging.getLogger("docfiller.nemotron_service")

# High-efficiency Nemotron Nano models
NEMOTRON_MODELS = [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", # Primary verified active model on NVIDIA NIM
    "mistralai/mistral-nemotron",                   # Active fallback model
    "nvidia/nemotron-3-nano",                       # Base alias
    "nemotron-nano",                                # Local Ollama alias
    "nemotron-mini",                                # Local Ollama alias
]

DEFAULT_NVIDIA_NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions"


class NemotronService:
    """
    Service wrapper for NVIDIA Nemotron Nano models.
    Operates server-side; API keys are never exposed to the frontend.
    """
    def __init__(self):
        self._timeout_seconds = 60.0

    @property
    def api_key(self) -> Optional[str]:
        """Fetches NVIDIA or Nemotron API key from environment variables."""
        return (
            os.getenv("NVIDIA_API_KEY", "").strip() or
            os.getenv("NEMOTRON_API_KEY", "").strip() or
            None
        )

    @property
    def endpoint_url(self) -> str:
        """
        Returns the chat completions endpoint:
        Custom NEMOTRON_BASE_URL if set, else official NVIDIA NIM API.
        """
        base_url = os.getenv("NEMOTRON_BASE_URL", "").strip()
        if base_url:
            if not base_url.endswith("/chat/completions"):
                return f"{base_url.rstrip('/')}/chat/completions"
            return base_url
        return DEFAULT_NVIDIA_NIM_URL

    def is_configured(self) -> bool:
        """
        Checks whether Nemotron Nano is available:
        Configured if NVIDIA_API_KEY/NEMOTRON_API_KEY is present,
        or if a custom local Ollama/vLLM endpoint (localhost) is defined.
        """
        if self.api_key:
            return True
        base_url = os.getenv("NEMOTRON_BASE_URL", "").lower()
        if "localhost" in base_url or "127.0.0.1" in base_url:
            return True
        return False

    async def call_nemotron(
        self,
        system_prompt: str,
        user_prompt: str,
        model_name: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        api_key_override: Optional[str] = None
    ) -> str:
        """
        Executes a prompt against the Nemotron Nano model.
        Returns the raw string output (usually JSON-formatted).
        """
        key = api_key_override or self.api_key
        url = self.endpoint_url
        target_model = model_name or os.getenv("NEMOTRON_DEFAULT_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")

        # Map common aliases to verified active model on NVIDIA NIM
        if target_model in ["nemotron", "nemotron-nano", "nano", "nvidia/nemotron-3-nano"]:
            target_model = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"

        headers = {
            "Content-Type": "application/json"
        }
        if key:
            headers["Authorization"] = f"Bearer {key}"

        candidate_models = [target_model]
        if target_model != "mistralai/mistral-nemotron":
            candidate_models.append("mistralai/mistral-nemotron")

        last_err = None
        for cand_model in candidate_models:
            payload = {
                "model": cand_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }

            for attempt in range(2):
                try:
                    async with httpx.AsyncClient(timeout=httpx.Timeout(75.0, connect=10.0), verify=False) as client:
                        resp = await client.post(url, json=payload, headers=headers)
                        if resp.status_code == 200:
                            data = resp.json()
                            choices = data.get("choices", [])
                            if choices:
                                return choices[0].get("message", {}).get("content", "").strip()
                            return ""
                        elif resp.status_code in [429, 503]:
                            logger.warning(f"Nemotron API {cand_model} HTTP {resp.status_code} (attempt {attempt+1}), checking fallback...")
                            await asyncio.sleep(1.0)
                            continue
                        else:
                            logger.error(f"Nemotron API error HTTP {resp.status_code} on {cand_model}: {resp.text[:200]}")
                            last_err = f"HTTP {resp.status_code} on {cand_model}"
                            break
                except Exception as e:
                    logger.error(f"Nemotron unexpected error on {cand_model}: {e}")
                    last_err = str(e)
                    break

        raise RuntimeError(f"Nemotron Nano service currently unavailable: {last_err}")


nemotron_service = NemotronService()
