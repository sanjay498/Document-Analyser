import json
import re
from typing import List
import requests

from app.ai.base import BaseAIProvider
from app.ai.fallback_provider import FallbackAIProvider
from app.schemas.ai import AIMappingResult, AIFieldMappingItem
from app.schemas.template import TemplateFieldResponse
from app.ocr.layout import DocumentContext
from app.config import settings
from app.utils.logger import logger

class HuggingFaceProvider(BaseAIProvider):
    def __init__(self, api_token: str = None, model_name: str = None):
        self.api_token = api_token or settings.HUGGINGFACE_API_TOKEN
        self.model_name = model_name or settings.HUGGINGFACE_MODEL or "Qwen/Qwen2.5-72B-Instruct"
        self.fallback = FallbackAIProvider()

    def map_fields(
        self,
        template_fields: List[TemplateFieldResponse],
        source_contexts: List[DocumentContext]
    ) -> AIMappingResult:
        if not self.api_token:
            logger.info("Hugging Face API token not configured. Using FallbackAIProvider.")
            return self.fallback.map_fields(template_fields, source_contexts)

        # Prepare prompt
        fields_desc = [
            f"- {f.field_name} (Placeholder: {f.placeholder}, Description: {f.description or 'N/A'})"
            for f in template_fields
        ]
        
        combined_source_text = ""
        for idx, ctx in enumerate(source_contexts, start=1):
            combined_source_text += f"\n--- SOURCE DOCUMENT #{idx}: {ctx.file_name} ---\n"
            combined_source_text += ctx.full_text

        prompt = f"""You are an expert document automation assistant.
Your task is to extract dynamic values from the provided source document text and map them to the specified template fields.

TEMPLATE FIELDS TO EXTRACT:
{chr(10).join(fields_desc)}

SOURCE DOCUMENT TEXT:
{combined_source_text[:12000]}

RULES:
1. Extract exact or normalized semantic values corresponding to each field name.
2. Do not invent or hallucinate information. If a field is not present in the source document, return null value and 0.0 confidence.
3. Return valid JSON adhering EXACTLY to this schema:
{{
  "document_type": "legal_document",
  "fields": [
    {{
      "field_name": "BORROWER_NAME",
      "value": "Extracted string value",
      "source_text": "Exact quote from document",
      "confidence": 0.98
    }}
  ],
  "warnings": []
}}
"""

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        # Inference API endpoint
        url = f"https://api-inference.huggingface.co/models/{self.model_name}"
        
        try:
            response = requests.post(
                url,
                headers=headers,
                json={
                    "inputs": prompt,
                    "parameters": {
                        "max_new_tokens": 1024,
                        "temperature": 0.1,
                        "return_full_text": False
                    }
                },
                timeout=30
            )

            if response.status_code == 200:
                result_data = response.json()
                generated_text = ""
                if isinstance(result_data, list) and len(result_data) > 0:
                    generated_text = result_data[0].get("generated_text", "")
                elif isinstance(result_data, dict):
                    generated_text = result_data.get("generated_text", str(result_data))

                # Extract JSON block
                json_match = re.search(r'\{.*\}', generated_text, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    return AIMappingResult(**parsed)
            else:
                logger.warning(f"Hugging Face API returned status {response.status_code}: {response.text}")

        except Exception as e:
            logger.error(f"Hugging Face AI mapping execution failed: {e}")

        logger.info("Falling back to local rule-based AI provider.")
        return self.fallback.map_fields(template_fields, source_contexts)
