import pytest
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.db.database import init_db
from backend.app.core.loan_models import LOAN_NATURE_OPTIONS, DEFAULT_LOAN_NATURE


@pytest.mark.asyncio
async def test_loan_models_endpoint():
    """Validates the GET /api/clients/loan-models endpoint."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/clients/loan-models")
        assert res.status_code == 200
        data = res.json()
        assert data["default"] == "House Model"
        assert len(data["options"]) == 6
        values = [opt["value"] for opt in data["options"]]
        for expected in [
            "House Model",
            "Agri Model",
            "Non Agri Model",
            "Agreement Base Model",
            "Take Over Model",
            "Already Deposited Model"
        ]:
            assert expected in values


@pytest.mark.asyncio
async def test_client_creation_with_loan_nature():
    """Validates creating clients with specific loan nature classifications."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for opt in LOAN_NATURE_OPTIONS:
            res = await client.post("/api/clients", json={
                "name": f"Client for {opt}",
                "phone": f"98000{abs(hash(opt)) % 100000:05d}",
                "email": f"client_{opt.replace(' ', '_').lower()}@example.com",
                "title": f"Scrutiny for {opt} facility",
                "nature_of_loan": opt
            })
            assert res.status_code == 200, res.text
            c_data = res.json()
            assert c_data["nature_of_loan"] == opt

        # Default fallback test
        res_default = await client.post("/api/clients", json={
            "name": "Default Loan Client",
            "phone": "9811223344",
            "email": "default_loan@example.com",
            "title": "Title with default loan"
        })
        assert res_default.status_code == 200
        assert res_default.json()["nature_of_loan"] == DEFAULT_LOAN_NATURE
