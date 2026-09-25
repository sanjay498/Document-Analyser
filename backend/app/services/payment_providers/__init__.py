"""
Payment Provider Abstraction Layer for LexTitle AI / DocFiller.
Supports Stripe, UPI, and modular regional payment gateways.
"""

from .base import PaymentProvider, PaymentIntentResult, WebhookEventResult
from .factory import get_payment_provider, is_provider_configured, list_supported_providers
from .stripe_provider import StripePaymentProvider
from .upi_provider import UpiPaymentProvider

__all__ = [
    "PaymentProvider",
    "PaymentIntentResult",
    "WebhookEventResult",
    "get_payment_provider",
    "is_provider_configured",
    "list_supported_providers",
    "StripePaymentProvider",
    "UpiPaymentProvider",
]
