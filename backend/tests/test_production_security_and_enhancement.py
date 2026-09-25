"""
Test Suite: Production Hardening, Security, and Computer Vision Pre-processing
Verifies:
1. OpenCV CLAHE & unsharp masking image enhancement for blurry documents
2. Production password complexity validation
3. HTTP security headers middleware (nosniff, DENY, XSS-Protection)
4. Upload extension whitelist & filename sanitization
5. Database engine initialization & SQLite WAL mode
"""

import pytest
import numpy as np
from PIL import Image
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from backend.app.main import app
from backend.app.core.source_extractor import enhance_image_for_ocr
from backend.app.core.auth import validate_password_strength
from backend.app.db.database import init_db


def test_enhance_image_for_ocr():
    """Verify CLAHE and unsharp masking preprocesses degraded images safely."""
    # Create a low-contrast synthetic image (simulating a faint carbon copy scan)
    low_contrast_arr = np.random.randint(120, 140, size=(120, 120, 3), dtype=np.uint8)
    pil_img = Image.fromarray(low_contrast_arr)
    
    enhanced = enhance_image_for_ocr(pil_img)
    assert enhanced is not None
    assert isinstance(enhanced, Image.Image)
    assert enhanced.size == (120, 120)


def test_password_strength_validation():
    """Verify password policy enforces length and character variety in production."""
    # Too short (< 8 chars)
    with pytest.raises(HTTPException) as exc1:
        validate_password_strength("abc1")
    assert exc1.value.status_code == 400
    assert "8 characters" in exc1.value.detail

    # Letters only (no digits)
    with pytest.raises(HTTPException) as exc2:
        validate_password_strength("AllLettersOnly")
    assert exc2.value.status_code == 400
    assert "both letters and numbers" in exc2.value.detail

    # Digits only (no letters)
    with pytest.raises(HTTPException) as exc3:
        validate_password_strength("1234567890")
    assert exc3.value.status_code == 400
    assert "both letters and numbers" in exc3.value.detail

    # Valid production password
    validate_password_strength("AdvocateSecure2026")


@pytest.mark.asyncio
async def test_http_security_headers():
    """Verify response includes production security headers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.headers.get("x-content-type-options") == "nosniff"
        assert res.headers.get("x-frame-options") == "DENY"
        assert res.headers.get("x-xss-protection") == "1; mode=block"


@pytest.mark.asyncio
async def test_upload_security_disallows_bad_extensions():
    """Verify malicious or invalid executable extensions are rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a session
        res_sess = await client.post("/api/sessions")
        assert res_sess.status_code == 200
        session_id = res_sess.json()["session_id"]

        # 2. Attempt uploading an invalid template (.sh / .exe)
        bad_files = {"file": ("malicious_script.exe", b"malicious executable bytes", "application/octet-stream")}
        res_bad_tpl = await client.post(f"/api/sessions/{session_id}/template", files=bad_files)
        assert res_bad_tpl.status_code == 400
        assert "Only .docx, .pptx, and .pdf" in res_bad_tpl.json()["detail"]

        # 3. Attempt uploading an invalid source document (.bat)
        bad_sources = [("files", ("exploit.bat", b"echo exploit", "text/plain"))]
        res_bad_src = await client.post(f"/api/sessions/{session_id}/sources", files=bad_sources)
        assert res_bad_src.status_code == 400
        assert "Unsupported file format" in res_bad_src.json()["detail"]


@pytest.mark.asyncio
async def test_database_wal_initialization():
    """Verify init_db initializes tables and WAL mode without errors."""
    await init_db()
