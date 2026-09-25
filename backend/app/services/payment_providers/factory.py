"""
Payment Provider Factory & Registry
"""

from typing import Dict, List
from .base import PaymentProvider
from .stripe_provider import StripePaymentProvider
from .upi_provider import UpiPaymentProvider

_PROVIDERS: Dict[str, PaymentProvider] = {
    "stripe": StripePaymentProvider(),
    "upi": UpiPaymentProvider(),
}


def get_payment_provider(provider_name: str) -> PaymentProvider:
    name = (provider_name or "").lower().strip()
    if name not in _PROVIDERS:
        # Default fallback to UPI for Indian deployment
        if "card" in name or "stripe" in name:
            return _PROVIDERS["stripe"]
        return _PROVIDERS["upi"]
    return _PROVIDERS[name]


def is_provider_configured(provider_name: str) -> bool:
    provider = get_payment_provider(provider_name)
    if hasattr(provider, "is_configured"):
        return provider.is_configured()
    return True


def list_supported_providers() -> List[str]:
    return list(_PROVIDERS.keys())
