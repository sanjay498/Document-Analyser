from abc import ABC, abstractmethod
from typing import List
from app.schemas.ai import AIMappingResult
from app.schemas.template import TemplateFieldResponse
from app.ocr.layout import DocumentContext

class BaseAIProvider(ABC):
    @abstractmethod
    def map_fields(
        self,
        template_fields: List[TemplateFieldResponse],
        source_contexts: List[DocumentContext]
    ) -> AIMappingResult:
        """
        Takes dynamic template fields and extracted source document contexts (text + spatial),
        and returns semantic field mappings in structured AIMappingResult format.
        """
        pass
