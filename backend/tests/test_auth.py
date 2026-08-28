import pytest

def test_auth_register_and_login(client):
    # 1. Register User
    reg_payload = {
        "email": "testuser@docauto.ai",
        "password": "securepassword123",
        "full_name": "Test User"
    }
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == "testuser@docauto.ai"

    # Duplicate registration should fail
    dup_res = client.post("/api/auth/register", json=reg_payload)
    assert dup_res.status_code == 400

    # 2. Login User
    login_payload = {
        "email": "testuser@docauto.ai",
        "password": "securepassword123"
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]
    assert token is not None

    # Invalid password login should fail
    bad_login_res = client.post("/api/auth/login", json={"email": "testuser@docauto.ai", "password": "wrongpassword"})
    assert bad_login_res.status_code == 401

    # 3. Get /me user profile
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "testuser@docauto.ai"
