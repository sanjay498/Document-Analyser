from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class TemplateFieldBase(BaseModel):
    field_name: str = Field(..., description="Unique field identifier e.g. BORROWER_NAME")
    placeholder: str = Field(..., description="Dynamic placeholder e.g. {{BORROWER_NAME}}")
    required: bool = True
    field_type: Optional[str] = "text"
    description: Optional[str] = None
    page_number: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    font_name: Optional[str] = None
    font_size: Optional[float] = None
    alignment: Optional[str] = None
    formatting_rules: Optional[str] = None

class TemplateFieldCreate(TemplateFieldBase):
    pass

class TemplateFieldUpdate(BaseModel):
    field_name: Optional[str] = None
    placeholder: Optional[str] = None
    required: Optional[bool] = None
    field_type: Optional[str] = None
    description: Optional[str] = None

class TemplateFieldResponse(TemplateFieldBase):
    id: str
    template_id: str

    model_config = ConfigDict(from_attributes=True)

class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None

class TemplateCreate(TemplateBase):
    pass

class TemplateResponse(TemplateBase):
    id: str
    file_name: str
    file_path: str
    file_type: str
    created_at: datetime
    updated_at: datetime
    fields: List[TemplateFieldResponse] = []

    model_config = ConfigDict(from_attributes=True)
