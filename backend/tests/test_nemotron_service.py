import pytest
from backend.app.core.nemotron_service import nemotron_service, NemotronService

def test_nemotron_service_configuration(monkeypatch):
    service = NemotronService()
    # When no key or local endpoint
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    monkeypatch.delenv("NEMOTRON_API_KEY", raising=False)
    monkeypatch.setenv("NEMOTRON_BASE_URL", "https://integrate.api.nvidia.com/v1")
    assert service.is_configured() is False

    # When NVIDIA key is set
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-test-key-12345")
    assert service.is_configured() is True
    assert "integrate.api.nvidia.com" in service.endpoint_url

    # When local Ollama endpoint is set
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    monkeypatch.setenv("NEMOTRON_BASE_URL", "http://localhost:11434/v1")
    assert service.is_configured() is True
    assert service.endpoint_url == "http://localhost:11434/v1/chat/completions"

@pytest.mark.asyncio
async def test_nemotron_ai_status_endpoint(monkeypatch):
    from httpx import AsyncClient, ASGITransport
    from backend.app.main import app

    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-test-key-12345")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/ai/status")
        assert res.status_code == 200
        data = res.json()
        assert data["nemotron_configured"] is True
        assert any("Nemotron" in engine for engine in data["active_engines"])
