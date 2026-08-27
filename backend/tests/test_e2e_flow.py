import pytest

def test_complete_e2e_document_automation_workflow(client, sample_docx_template, sample_source_docx):
    # Step 1: Upload Template
    with open(sample_docx_template, "rb") as f:
        tpl_res = client.post(
            "/api/templates/upload",
            data={"name": "E2E Legal Template", "description": "E2E Test"},
            files={"file": ("template.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        )
    assert tpl_res.status_code == 200
    tpl_data = tpl_res.json()
    template_id = tpl_data["id"]

    # Step 2: Upload Source Document & Start Job
    with open(sample_source_docx, "rb") as f:
        start_res = client.post(
            "/api/process/start",
            data={"template_id": template_id},
            files={"source_files": ("source_record.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        )
    assert start_res.status_code == 200
    job_id = start_res.json()["id"]

    # Step 3: Run AI & OCR Analysis Pipeline
    analyze_res = client.post(f"/api/process/{job_id}/analyze")
    assert analyze_res.status_code == 200
    job_data = analyze_res.json()
    assert job_data["status"] == "VALIDATION"
    assert len(job_data["extracted_fields"]) >= 3

    # Step 4: Human-in-the-Loop Review Field Edit
    field_to_edit = job_data["extracted_fields"][0]
    edit_res = client.put(
        f"/api/process/fields/{field_to_edit['id']}",
        json={"value": "K.MUTHULAKSHMI (Verified)"}
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["value"] == "K.MUTHULAKSHMI (Verified)"
    assert edit_res.json()["is_manually_edited"] is True

    # Step 5: Approve & Generate Final DOCX + PDF
    gen_res = client.post(
        f"/api/process/{job_id}/generate",
        json={"output_formats": ["docx", "pdf"]}
    )
    assert gen_res.status_code == 200
    doc_data = gen_res.json()
    assert doc_data["docx_file_path"] is not None
    assert doc_data["pdf_file_path"] is not None

    # Step 6: Verify Download Endpoint
    dl_res = client.get(f"/api/documents/{doc_data['id']}/download/docx")
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 0
