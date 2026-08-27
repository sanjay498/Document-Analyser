import pytest
import docx
from app.document_generation.docx_engine import docx_engine

def test_docx_template_substitution(sample_docx_template, tmp_path):
    output_docx = tmp_path / "generated_output.docx"
    
    field_values = {
        "BORROWER_NAME": "K.MUTHULAKSHMI, W/o G.Kumar",
        "DOCUMENT_NUMBER": "1277/1987",
        "PROPERTY_DESCRIPTION": "S.F.No.245/1B Main Road",
        "DATE": "05.05.1987"
    }

    out_file = docx_engine.generate_document(
        sample_docx_template,
        str(output_docx),
        field_values
    )

    assert output_docx.exists()

    # Read output docx and verify substituted values
    doc = docx.Document(str(output_docx))
    full_text = "\n".join([p.text for p in doc.paragraphs])
    
    assert "K.MUTHULAKSHMI" in full_text
    assert "1277/1987" in full_text
    assert "05.05.1987" in full_text
    assert "{{BORROWER_NAME}}" not in full_text
