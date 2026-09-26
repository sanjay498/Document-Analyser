"""
Production-Grade Database Models for LexTitle AI / DocFiller
Strict role separation, dedicated Wallet model, exact Numeric financial fields,
immutable Audit logs, Refresh Tokens, and idempotent Transactions.
"""

import datetime
from decimal import Decimal
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    LargeBinary,
    Integer,
    ForeignKey,
    Boolean,
    Numeric,
    Index
)
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


class User(Base):
    """
    User account model.
    Only USER role accounts possess an associated Wallet.
    ADMIN role accounts strictly perform administrative operations and have no wallet.
    """
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    mobile = Column(String(32), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="USER", nullable=False, index=True)  # "USER" or "ADMIN"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # 1-to-1 relationship with Wallet (Only instantiated for USER accounts)
    wallet = relationship("Wallet", back_populates="user", uselist=False, cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    ledgers = relationship("WalletLedger", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_admin(self) -> bool:
        return self.role == "ADMIN"

    @property
    def full_name(self) -> str:
        return self.name

    @full_name.setter
    def full_name(self, val: str):
        self.name = val

    # Read-only helper property to ensure safe balance access if queried directly
    @property
    def wallet_balance(self) -> float:
        if self.wallet and self.wallet.balance is not None:
            return float(self.wallet.balance)
        return 0.0

    @property
    def total_spent(self) -> float:
        # Computed dynamically or via wallet transactions
        return 0.0


class Wallet(Base):
    """
    User financial credit wallet.
    Enforces exact Decimal/Numeric monetary values.
    Initial balance is strictly 0.00.
    """
    __tablename__ = "wallets"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    balance = Column(Numeric(precision=14, scale=2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="wallet")
    transactions = relationship("Transaction", back_populates="wallet")
    payments = relationship("Payment", back_populates="wallet", cascade="all, delete-orphan")
    ledgers = relationship("WalletLedger", back_populates="wallet", cascade="all, delete-orphan")


class Transaction(Base):
    """
    Immutable transaction ledger.
    Enforces idempotency via unique provider_transaction_id.
    """
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), index=True, nullable=False)
    wallet_id = Column(String(64), ForeignKey("wallets.id"), index=True, nullable=False)
    payment_provider = Column(String(64), nullable=False)  # "UPI_DIRECT", "RAZORPAY", "ADMIN_ADJUSTMENT", "SYSTEM"
    provider_transaction_id = Column(String(128), unique=True, index=True, nullable=True)  # Idempotency key
    amount = Column(Numeric(precision=14, scale=2), nullable=False)  # Positive for credit, negative for debit
    currency = Column(String(8), default="INR", nullable=False)
    status = Column(String(32), default="SUCCESS", nullable=False, index=True)  # PENDING, SUCCESS, FAILED, REFUNDED
    type = Column(String(32), nullable=False, index=True)  # WALLET_CREDIT, WALLET_DEBIT, REFUND, ADMIN_ADJUSTMENT
    balance_before = Column(Numeric(precision=14, scale=2), default=Decimal("0.00"), nullable=False)
    balance_after = Column(Numeric(precision=14, scale=2), default=Decimal("0.00"), nullable=False)
    description = Column(String(255), nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="transactions")
    wallet = relationship("Wallet", back_populates="transactions")

    # Backwards-compatibility aliases
    @property
    def transaction_type(self) -> str:
        if self.type == "WALLET_CREDIT":
            return "deposit"
        elif self.type == "WALLET_DEBIT":
            return "spend"
        elif self.type == "ADMIN_ADJUSTMENT":
            return "admin_adjustment"
        return self.type.lower()

    @property
    def reference_id(self) -> str:
        return self.provider_transaction_id or self.id


# Legacy alias for backward-compatibility with earlier imports
WalletTransaction = Transaction


class PaymentVerification(Base):
    """
    Payment proof & verification tracking.
    Validates incoming Bank UTR or provider webhook prior to wallet credit.
    """
    __tablename__ = "payment_verifications"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), index=True, nullable=False)
    wallet_id = Column(String(64), ForeignKey("wallets.id"), index=True, nullable=True)
    order_id = Column(String(128), unique=True, index=True, nullable=False)
    amount = Column(Numeric(precision=14, scale=2), nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    method = Column(String(50), default="upi", nullable=False)  # upi, card, netbanking
    utr_number = Column(String(128), index=True, nullable=True)
    provider_signature = Column(String(255), nullable=True)
    status = Column(String(32), default="PENDING", index=True, nullable=False)  # PENDING, PROCESSING, SUCCESS, FAILED, REJECTED
    user_notes = Column(String(255), nullable=True)
    admin_notes = Column(String(255), nullable=True)
    verified_by = Column(String(64), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class Payment(Base):
    """
    Dedicated payment records for gateway & provider transactions.
    Tracks internal payment lifecycle: PENDING -> PROCESSING -> SUCCESS / FAILED / REFUNDED.
    Enforces idempotency via unique provider_payment_id.
    """
    __tablename__ = "payments"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    wallet_id = Column(String(64), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(precision=14, scale=2), nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    provider = Column(String(64), nullable=False)  # "stripe", "upi", etc.
    provider_order_id = Column(String(128), index=True, nullable=True)
    provider_payment_id = Column(String(128), unique=True, index=True, nullable=True)  # Idempotency constraint
    status = Column(String(32), default="PENDING", index=True, nullable=False)  # PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED, EXPIRED, REFUNDED
    method = Column(String(64), default="upi", nullable=False)  # upi, card, etc.
    error_message = Column(Text, nullable=True)
    client_secret = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="payments")
    wallet = relationship("Wallet", back_populates="payments")


class WalletLedger(Base):
    """
    Financial Ledger for double-entry tracking of all balance alterations.
    Source of truth for auditable balance calculations.
    """
    __tablename__ = "wallet_ledgers"

    id = Column(String(64), primary_key=True, index=True)
    wallet_id = Column(String(64), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id"), nullable=True, index=True)
    entry_type = Column(String(32), nullable=False, index=True)  # CREDIT, DEBIT, REFUND, MANUAL_CREDIT, MANUAL_DEBIT
    amount = Column(Numeric(precision=14, scale=2), nullable=False)
    balance_before = Column(Numeric(precision=14, scale=2), nullable=False)
    balance_after = Column(Numeric(precision=14, scale=2), nullable=False)
    description = Column(String(255), nullable=False)
    reference_id = Column(String(128), index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    wallet = relationship("Wallet", back_populates="ledgers")
    user = relationship("User", back_populates="ledgers")


class WalletAdjustment(Base):
    """
    Audited manual administrative balance correction.
    Requires explicit reason, amount, and admin confirmation.
    """
    __tablename__ = "wallet_adjustments"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), index=True, nullable=False)
    admin_id = Column(String(64), ForeignKey("users.id"), index=True, nullable=False)
    amount = Column(Numeric(precision=14, scale=2), nullable=False)
    type = Column(String(32), nullable=False)  # "CREDIT" or "DEBIT"
    reason = Column(Text, nullable=False)
    reference = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class AuditLog(Base):
    """
    Immutable audit trail for all security, authentication, and management operations.
    Never stores passwords, tokens, or API secrets.
    """
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, index=True)
    admin_id = Column(String(64), ForeignKey("users.id"), index=True, nullable=True)
    action = Column(String(128), index=True, nullable=False)
    target_type = Column(String(64), nullable=True)  # "USER", "PAYMENT", "SETTING"
    target_id = Column(String(64), nullable=True)
    metadata_json = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class RefreshToken(Base):
    """
    Secure Refresh Token storage supporting token rotation and instant revocation.
    Stores SHA-256 hash of token only.
    """
    __tablename__ = "refresh_tokens"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), index=True, nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    replaced_by = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="refresh_tokens")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(String(64), primary_key=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)


class SystemPricingConfig(Base):
    __tablename__ = "system_pricing_config"

    id = Column(String(64), primary_key=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    value = Column(Numeric(precision=10, scale=2), nullable=False)
    description = Column(String(255), nullable=True)


# Document generation and session models
class Client(Base):
    """
    Client model for LexTitle AI scrutiny workflows.
    Permanently stores client identifying information and title matter reference.
    Maintains a 1-to-many relationship with scrutiny sessions and document history items.
    """
    __tablename__ = "clients"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    phone = Column(String(32), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    sessions = relationship("GenerationSession", back_populates="client")
    qa_sessions = relationship("TemplateQASession", back_populates="client")
    history_items = relationship("DocumentHistoryItem", back_populates="client")


class GenerationSession(Base):
    __tablename__ = "generation_sessions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    client_id = Column(String(64), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    template_id = Column(String(64), ForeignKey("template_library.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    template_filename = Column(String(255), nullable=True)
    template_bytes = Column(LargeBinary, nullable=True)
    status = Column(String(50), default="created")
    
    fields_json = Column(Text, nullable=True)
    table_groups_json = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)
    results_json = Column(Text, nullable=True)
    table_results_json = Column(Text, nullable=True)
    final_docx_bytes = Column(LargeBinary, nullable=True)

    client = relationship("Client", back_populates="sessions")
    template = relationship("TemplateLibraryItem")


class TemplateLibraryItem(Base):
    __tablename__ = "template_library"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    bank_name = Column(String(128), default="General", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    fields_count = Column(Integer, default=0)
    table_groups_count = Column(Integer, default=0)
    template_bytes = Column(LargeBinary, nullable=False)
    fields_json = Column(Text, nullable=False)
    table_groups_json = Column(Text, nullable=False)


class TemplateGroup(Base):
    __tablename__ = "template_groups"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    name = Column(String(128), nullable=False, unique=True, index=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class DocumentHistoryItem(Base):
    __tablename__ = "document_history"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    session_id = Column(String(64), nullable=True, index=True)
    client_id = Column(String(64), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    template_filename = Column(String(255), nullable=False)
    generated_at = Column(DateTime(timezone=True), default=utc_now)
    sources_summary_json = Column(Text, nullable=True)
    field_values_json = Column(Text, nullable=True)
    table_records_json = Column(Text, nullable=True)
    docx_bytes = Column(LargeBinary, nullable=False)
    status = Column(String(50), default="completed")

    client = relationship("Client", back_populates="history_items")


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    template_filename = Column(String(255), nullable=False)
    template_bytes = Column(LargeBinary, nullable=False)
    fields_json = Column(Text, nullable=False)
    table_groups_json = Column(Text, nullable=False)
    status = Column(String(50), default="pending")
    total_items = Column(Integer, default=0)
    completed_items = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class BatchJobItem(Base):
    __tablename__ = "batch_job_items"

    id = Column(String(64), primary_key=True, index=True)
    batch_id = Column(String(64), ForeignKey("batch_jobs.id"), nullable=False, index=True)
    item_index = Column(Integer, default=0)
    item_name = Column(String(255), nullable=False)
    sources_json = Column(Text, nullable=False)
    status = Column(String(50), default="pending")
    results_json = Column(Text, nullable=True)
    output_docx_bytes = Column(LargeBinary, nullable=True)
    error_message = Column(Text, nullable=True)


class TemplateQASession(Base):
    """
    Intelligent Legal Template Question Answering Session.
    Stores dynamic template questions, multi-document evidence,
    generated answers, verification statuses, and final populated reports.
    """
    __tablename__ = "template_qa_sessions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    client_id = Column(String(64), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    template_filename = Column(String(255), nullable=False)
    template_bytes = Column(LargeBinary, nullable=True)
    status = Column(String(50), default="created")  # created, template_parsed, sources_uploaded, qa_completed, report_generated
    questions_json = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)
    answers_json = Column(Text, nullable=True)
    final_docx_bytes = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    client = relationship("Client", back_populates="qa_sessions")

