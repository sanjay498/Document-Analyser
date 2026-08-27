from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class SourceDocumentResponse(BaseModel):
    id: str
    processing_job_id: str
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    page_count: Optional[int] = 1
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GeneratedDocumentResponse(BaseModel):
    id: str
    processing_job_id: str
    file_name: str
    docx_file_path: Optional[str] = None
    pdf_file_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
