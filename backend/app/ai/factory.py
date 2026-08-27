from app.ai.base import BaseAIProvider
from app.ai.huggingface_provider import HuggingFaceProvider
from app.ai.fallback_provider import FallbackAIProvider
from app.config import settings

class AIProviderFactory:
    @staticmethod
    def get_provider(provider_type: str = None) -> BaseAIProvider:
        p_type = (provider_type or settings.AI_PROVIDER).lower()

        if p_type == "huggingface":
            return HuggingFaceProvider()
        elif p_type == "fallback":
            return FallbackAIProvider()
        else:
            return HuggingFaceProvider()

ai_factory = AIProviderFactory()
