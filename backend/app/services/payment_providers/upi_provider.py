"""
UPI Payment Provider
Handles Indian UPI Rails (VPA, deep linking, dynamic QR intent codes)
and HMAC-SHA256 webhook signature verification.
"""

import os
import json
import hmac
import hashlib
import uuid
import urllib.parse
import logging
from decimal import Decimal
from typing import Dict, Any, Optional

from .base import PaymentProvider, PaymentIntentResult, WebhookEventResult

logger = logging.getLogger("docfiller.payment_provider.upi")


class UpiPaymentProvider(PaymentProvider):
    @property
    def provider_name(self) -> str:
        return "upi"

    def _get_vpa(self) -> str:
        return os.getenv("UPI_VPA", "lextitle.billing@icici").strip()

    def _get_payee_name(self) -> str:
        return os.getenv("UPI_PAYEE_NAME", "LexTitle AI Legal Systems").strip()

    def _get_webhook_secret(self) -> str:
        return os.getenv("UPI_WEBHOOK_SECRET", "upi_super_secret_webhook_key_2026").strip()

    def is_configured(self) -> bool:
        return bool(self._get_vpa())

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
        Generates standard NPCI UPI URI string:
        upi://pay?pa={vpa}&pn={payee}&am={amount}&tr={payment_id}&cu=INR&tn=DocFillerWalletTopUp
        """
        vpa = self._get_vpa()
        payee = self._get_payee_name()
        amt_str = f"{amount:.2f}"

        params = {
            "pa": vpa,
            "pn": payee,
            "am": amt_str,
            "tr": payment_id,
            "cu": "INR",
            "tn": f"TopUp {payment_id}"
        }
        upi_uri = f"upi://pay?{urllib.parse.urlencode(params)}"
        provider_order_id = f"UPI-{payment_id}"

        return PaymentIntentResult(
            provider_order_id=provider_order_id,
            client_secret=None,
            checkout_url=upi_uri,
            qr_data=upi_uri,
            raw_response={
                "vpa": vpa,
                "payee_name": payee,
                "amount": amt_str,
                "upi_uri": upi_uri
            }
        )

    async def verify_webhook_signature(
        self,
        raw_payload: bytes,
        headers: Dict[str, str]
    ) -> bool:
        """
        Verifies HMAC-SHA256 signature from UPI provider / aggregator webhook.
        Checks x-upi-signature or x-webhook-signature header.
        """
        secret = self._get_webhook_secret()
        if not secret:
            logger.error("UPI_WEBHOOK_SECRET is not configured on server.")
            return False

        sig = None
        for k, v in headers.items():
            if k.lower() in ["x-upi-signature", "x-webhook-signature", "signature"]:
                sig = v.strip()
                break

        if not sig:
            logger.warning("Missing UPI webhook signature header.")
            return False

        try:
            expected = hmac.new(secret.encode("utf-8"), raw_payload, hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, sig)
        except Exception as e:
            logger.error(f"Error checking UPI webhook signature: {e}")
            return False

    async def parse_webhook_event(
        self,
        raw_payload: bytes,
        headers: Dict[str, str]
    ) -> WebhookEventResult:
        """
        Parses UPI gateway webhook payload into WebhookEventResult.
        """
        data = json.loads(raw_payload.decode("utf-8"))
        event_type = data.get("event", "upi.payment_status")
        
        internal_payment_id = data.get("payment_id") or data.get("order_id") or data.get("transaction_ref")
        provider_payment_id = data.get("provider_payment_id") or data.get("utr_number") or data.get("bank_ref")
        provider_order_id = data.get("provider_order_id") or f"UPI-{internal_payment_id}"

        raw_amount = data.get("amount", 0)
        amount_decimal = Decimal(str(raw_amount)).quantize(Decimal("0.01"))
        currency = (data.get("currency") or "INR").upper()

        raw_status = str(data.get("status", "")).upper()
        if raw_status in ["SUCCESS", "PAID", "COMPLETED"]:
            status = "SUCCESS"
        elif raw_status in ["FAILED", "REJECTED", "FAILURE"]:
            status = "FAILED"
        elif raw_status in ["REFUNDED"]:
            status = "REFUNDED"
        else:
            status = "PENDING"

        return WebhookEventResult(
            event_type=event_type,
            internal_payment_id=internal_payment_id,
            provider_payment_id=provider_payment_id,
            provider_order_id=provider_order_id,
            amount=amount_decimal,
            currency=currency,
            status=status,
            raw_event=data
        )

    async def query_payment_status(
        self,
        provider_payment_id: str
    ) -> Dict[str, Any]:
        return {
            "provider": "upi",
            "provider_payment_id": provider_payment_id,
            "status": "SUCCESS"
        }
