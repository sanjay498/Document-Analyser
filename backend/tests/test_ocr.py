import pytest
from app.ocr.extractor import document_extractor

def test_extract_docx_source(sample_source_docx):
    ctx = document_extractor.extract(sample_source_docx)
    assert ctx.file_type == "docx"
    assert "K.MUTHULAKSHMI" in ctx.full_text
    assert "1277/1987" in ctx.full_text
    assert len(ctx.elements) > 0
