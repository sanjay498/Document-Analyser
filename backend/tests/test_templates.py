import pytest
from pathlib import Path

def test_upload_template(client, sample_docx_template):
    with open(sample_docx_template, "rb") as f:
        response = client.post(
            "/api/templates/upload",
            data={"name": "Legal Opinion Template", "description": "Test Legal Template"},
            files={"file": ("legal_template.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Legal Opinion Template"
    assert len(data["fields"]) >= 4

    # Check extracted fields
    field_names = [field["field_name"] for field in data["fields"]]
    assert "BORROWER_NAME" in field_names
    assert "DOCUMENT_NUMBER" in field_names

def test_get_templates(client):
    response = client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
