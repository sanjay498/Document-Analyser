from typing import List, Optional
from pydantic import BaseModel, Field

class TextElement(BaseModel):
    text: str
    page_number: int = 1
    bbox: Optional[List[float]] = Field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0]) # [x0, y0, x1, y1]
    confidence: float = 1.0

class DocumentContext(BaseModel):
    file_name: str
    file_type: str
    total_pages: int = 1
    full_text: str = ""
    elements: List[TextElement] = []
