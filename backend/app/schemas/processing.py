from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.document import SourceDocumentResponse, GeneratedDocumentResponse

class ExtractedFieldBase(BaseModel):
    field_name: str
    value: Optional[str] = None
    source_text: Optional[str] = None
    confidence: float = 0.0
    status: str = "MATCHED" # MATCHED, MISSING, LOW_CONFIDENCE
    is_manually_edited: bool = False
    bbox: Optional[List[float]] = None

class ExtractedFieldUpdate(BaseModel):
    value: Optional[str] = None

class ExtractedFieldResponse(ExtractedFieldBase):
    id: str
    processing_job_id: str
    template_field_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ProcessingJobCreate(BaseModel):
    template_id: str

class ProcessingJobResponse(BaseModel):
    id: str
    template_id: str
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    source_documents: List[SourceDocumentResponse] = []
    extracted_fields: List[ExtractedFieldResponse] = []
    generated_documents: List[GeneratedDocumentResponse] = []

    model_config = ConfigDict(from_attributes=True)

class GenerateDocumentRequest(BaseModel):
    output_formats: List[str] = ["docx", "pdf"] # docx, pdf
