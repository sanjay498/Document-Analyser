"""
Base abstract classes & dataclasses for Payment Providers.
Ensures zero coupling between the wallet system and any specific gateway.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, Any, Optional


@dataclass
class PaymentIntentResult:
    provider_order_id: str
    client_secret: Optional[str] = None
    checkout_url: Optional[str] = None
    qr_data: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


@dataclass
class WebhookEventResult:
    event_type: str
    internal_payment_id: Optional[str]
    provider_payment_id: Optional[str]
    provider_order_id: Optional[str]
    amount: Decimal
    currency: str
    status: str  # "SUCCESS", "FAILED", "PENDING", "REFUNDED"
    raw_event: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class PaymentProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Unique identifier of the payment provider (e.g. 'stripe', 'upi')."""
        pass

    @abstractmethod
    async def create_payment_intent(
        self,
        payment_id: str,
        amount: Decimal,
        currency: str,
        user_id: str,
        user_email: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentIntentResult:
        """
        Creates a payment order / intent with the provider.
        Returns parameters for client checkout (client_secret, checkout_url, or qr_data).
        """
        pass

    @abstractmethod
    async def verify_webhook_signature(
        self,
        raw_payload: bytes,
        headers: Dict[str, str]
    ) -> bool:
        """
        Cryptographically verifies provider webhook signature using HMAC-SHA256 or official SDK.
        Returns True if valid, False otherwise.
        """
        pass

    @abstractmethod
    async def parse_webhook_event(
        self,
        raw_payload: bytes,
        headers: Dict[str, str]
    ) -> WebhookEventResult:
        """
        Parses provider webhook payload into normalized WebhookEventResult.
        """
        pass

    @abstractmethod
    async def query_payment_status(
        self,
        provider_payment_id: str
    ) -> Dict[str, Any]:
        """
        Direct server-to-server query verifying payment status with provider.
        """
        pass
