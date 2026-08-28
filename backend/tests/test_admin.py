import pytest

def test_admin_users_and_stats(client):
    # Register a user
    client.post("/api/auth/register", json={"email": "admin_test@docauto.ai", "password": "password123", "full_name": "Admin User"})
    
    # 1. Test Admin Users Endpoint
    res = client.get("/api/admin/users")
    assert res.status_code == 200
    users_data = res.json()
    assert isinstance(users_data, list)
    assert len(users_data) >= 1
    
    user_emails = [u["email"] for u in users_data]
    assert "admin_test@docauto.ai" in user_emails

    # 2. Test Admin Stats Endpoint
    stats_res = client.get("/api/admin/stats")
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert stats_data["total_users"] >= 1
    assert "users" in stats_data
