from typing import List, Optional
from pydantic import BaseModel, Field

class AIFieldMappingItem(BaseModel):
    field_name: str
    value: Optional[str] = Field(None, description="Extracted semantic value for the template field")
    source_text: Optional[str] = Field(None, description="Exact snippet from source document where value was located")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0 and 1")

class AIMappingResult(BaseModel):
    document_type: Optional[str] = "generic_document"
    fields: List[AIFieldMappingItem]
    warnings: List[str] = []

class AISettingsSchema(BaseModel):
    ai_provider: str
    huggingface_api_token: Optional[str] = ""
    huggingface_model: str
    ocr_engine: str
