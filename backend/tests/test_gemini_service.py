"""
Test suite for Server-Side Gemini Service abstraction.
Verifies:
1. GEMINI_API_KEY is read purely from environment variables.
2. Graceful error handling without raw traceback/secret leaks.
3. Clean user-facing error messages when API is unreachable or unconfigured.
"""

import pytest
import os
from unittest.mock import patch, AsyncMock
from backend.app.core.gemini_service import GeminiService


@pytest.mark.asyncio
async def test_gemini_service_reads_env_only():
    service = GeminiService()
    # Ensure it doesn't leak or default to hardcoded strings
    with patch.dict(os.environ, {"GEMINI_API_KEY": "test_secure_env_key_123"}, clear=False):
        service._api_key = None
        assert service.api_key == "test_secure_env_key_123"
        assert service.is_configured() is True

    with patch.dict(os.environ, {"GEMINI_API_KEY": "", "GOOGLE_API_KEY": ""}, clear=False):
        service._api_key = None
        assert service.api_key is None
        assert service.is_configured() is False


@pytest.mark.asyncio
async def test_gemini_service_error_sanitization():
    service = GeminiService()
    service._api_key = "dummy_key"

    # Mock httpx failure
    with patch("httpx.AsyncClient.post", side_effect=Exception("Raw internal API socket crash: secret_connection_string")):
        with pytest.raises(RuntimeError) as exc_info:
            await service._call_gemini_generate("gemini-2.5-flash", [{"parts": [{"text": "hello"}]}])
        
        # Verify that internal socket crash details or raw secrets are NOT in exception detail
        err_msg = str(exc_info.value)
        assert "secret_connection_string" not in err_msg
        assert "Unable to communicate with AI generation engine" in err_msg or "AI processing service" in err_msg
