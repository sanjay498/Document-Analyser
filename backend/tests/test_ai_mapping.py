import pytest
from app.ai.fallback_provider import FallbackAIProvider
from app.schemas.template import TemplateFieldResponse
from app.ocr.layout import DocumentContext, TextElement

def test_fallback_ai_mapping():
    provider = FallbackAIProvider()
    
    template_fields = [
        TemplateFieldResponse(id="1", template_id="t1", field_name="BORROWER_NAME", placeholder="{{BORROWER_NAME}}", required=True),
        TemplateFieldResponse(id="2", template_id="t1", field_name="DOCUMENT_NUMBER", placeholder="{{DOCUMENT_NUMBER}}", required=True),
        TemplateFieldResponse(id="3", template_id="t1", field_name="DATE", placeholder="{{DATE}}", required=True),
    ]

    source_text = """
    Name of the Borrower : K.MUTHULAKSHMI, W/o G.Kumar
    registered as Document No: 1277/1987
    Date of execution : 05.05.1987
    """

    source_ctx = DocumentContext(
        file_name="source.docx",
        file_type="docx",
        full_text=source_text,
        elements=[TextElement(text=source_text)]
    )

    result = provider.map_fields(template_fields, [source_ctx])
    assert len(result.fields) == 3

    matched_dict = {item.field_name: item.value for item in result.fields}
    assert "K.MUTHULAKSHMI" in matched_dict["BORROWER_NAME"]
    assert "1277/1987" in matched_dict["DOCUMENT_NUMBER"]
    assert "05.05.1987" in matched_dict["DATE"]
