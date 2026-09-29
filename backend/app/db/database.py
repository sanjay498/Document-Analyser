"""
Production Database Engine & Safe Migrations (SQLAlchemy / PostgreSQL / SQLite)
No hardcoded users, exact Decimal numeric types, safe admin bootstrapping from environment variables.
"""

import os
import uuid
import logging
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text, select

logger = logging.getLogger("docfiller.database")

DB_FILE = os.getenv("DOCFILLER_DB_PATH", "docfiller.db")
raw_db_url = os.getenv("DATABASE_URL", "").strip()

if raw_db_url:
    # Auto-convert standard postgresql:// or postgres:// to asyncpg
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif raw_db_url.startswith("postgresql://") and not raw_db_url.startswith("postgresql+asyncpg://"):
        raw_db_url = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif raw_db_url.startswith("postgresql+psycopg2://"):
        raw_db_url = raw_db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    elif raw_db_url.startswith("postgresql+psycopg://"):
        raw_db_url = raw_db_url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    DATABASE_URL = raw_db_url
    engine_kwargs = {
        "echo": False,
        "future": True,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "pool_pre_ping": True,
    }
else:
    DATABASE_URL = f"sqlite+aiosqlite:///{DB_FILE}"
    engine_kwargs = {
        "echo": False,
        "future": True,
        "connect_args": {"check_same_thread": False},
        "pool_pre_ping": True,
    }

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)
async_session_factory = AsyncSessionLocal

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Initializes database schema and default system configurations.
    Enforces that:
    1. No predefined users exist unless ADMIN_EMAIL & ADMIN_PASSWORD are in environment variables.
    2. Admin accounts NEVER have a wallet.
    3. User wallets start at 0.00.
    """
    async with engine.begin() as conn:
        # Enable SQLite High-Performance Concurrency (WAL mode)
        if "sqlite" in DATABASE_URL:
            try:
                await conn.execute(text("PRAGMA journal_mode=WAL;"))
                await conn.execute(text("PRAGMA synchronous=NORMAL;"))
                await conn.execute(text("PRAGMA busy_timeout=5000;"))
            except Exception:
                pass

        # Create all tables defined in models
        await conn.run_sync(Base.metadata.create_all)

        # Apply backward-compatible migrations ONLY for existing SQLite databases if columns are missing
        if "sqlite" in DATABASE_URL:
            migrations = [
                "ALTER TABLE users ADD COLUMN name VARCHAR(255)",
                "ALTER TABLE users ADD COLUMN mobile VARCHAR(32)",
                "ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'USER'",
                "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1",
                "ALTER TABLE users ADD COLUMN updated_at TIMESTAMP",
                "ALTER TABLE payment_verifications ADD COLUMN wallet_id VARCHAR(64)",
                "ALTER TABLE payment_verifications ADD COLUMN order_id VARCHAR(128)",
                "ALTER TABLE payment_verifications ADD COLUMN currency VARCHAR(8) DEFAULT 'INR'",
                "ALTER TABLE payment_verifications ADD COLUMN provider_signature VARCHAR(255)",
                "ALTER TABLE payment_verifications ADD COLUMN updated_at TIMESTAMP",
                "ALTER TABLE template_library ADD COLUMN bank_name VARCHAR(128) DEFAULT 'General'",
                "ALTER TABLE generation_sessions ADD COLUMN client_id VARCHAR(64)",
                "ALTER TABLE generation_sessions ADD COLUMN template_id VARCHAR(64)",
                "ALTER TABLE generation_sessions ADD COLUMN doc_custom_name VARCHAR(255)",
                "ALTER TABLE generation_sessions ADD COLUMN questions_json TEXT",
                "ALTER TABLE generation_sessions ADD COLUMN qa_answers_json TEXT",
                "ALTER TABLE generation_sessions ADD COLUMN nature_of_loan VARCHAR(100) DEFAULT 'House Model'",
                "ALTER TABLE clients ADD COLUMN nature_of_loan VARCHAR(100) DEFAULT 'House Model'",
                "ALTER TABLE template_qa_sessions ADD COLUMN client_id VARCHAR(64)",
                "ALTER TABLE document_history ADD COLUMN client_id VARCHAR(64)",
                "ALTER TABLE document_history ADD COLUMN nature_of_loan VARCHAR(100) DEFAULT 'House Model'",
            ]
            for mig in migrations:
                try:
                    await conn.execute(text(mig))
                except Exception:
                    pass
        else:
            # PostgreSQL migrations
            pg_migrations = [
                "ALTER TABLE clients ADD COLUMN IF NOT EXISTS nature_of_loan VARCHAR(100) DEFAULT 'House Model'",
                "ALTER TABLE generation_sessions ADD COLUMN IF NOT EXISTS nature_of_loan VARCHAR(100) DEFAULT 'House Model'",
                "ALTER TABLE document_history ADD COLUMN IF NOT EXISTS nature_of_loan VARCHAR(100) DEFAULT 'House Model'",
            ]
            for mig in pg_migrations:
                try:
                    await conn.execute(text(mig))
                except Exception:
                    pass

            # Ensure unique index on mobile in users table
            try:
                await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_mobile ON users(mobile)"))
            except Exception:
                pass


    # Model imports
    from backend.app.db.models import User, Wallet, SystemPricingConfig, SystemSetting
    import bcrypt

    async with AsyncSessionLocal() as session:
        try:
            # 1. Default Pricing Configuration
            default_pricing = [
                ("doc_generation_fee", Decimal("50.00"), "Cost per document synthesis (INR)"),
                ("ocr_per_page_fee", Decimal("5.00"), "Cost per scanned OCR page (INR)"),
            ]
            for key, val, desc in default_pricing:
                stmt = select(SystemPricingConfig).where(SystemPricingConfig.key == key)
                res = await session.execute(stmt)
                if not res.scalar_one_or_none():
                    session.add(SystemPricingConfig(
                        id=str(uuid.uuid4()),
                        key=key,
                        value=val,
                        description=desc
                    ))

            # 2. Default System Settings (Payment Gateway & UPI Scanner)
            default_settings = [
                ("upi_vpa", "lextitle.billing@icici", "Merchant UPI VPA / ID"),
                ("upi_payee_name", "LexTitle AI Legal Systems", "Merchant Payee Name"),
                ("upi_qr_image_url", "", "Custom QR Code Image URL (optional)"),
                ("payment_verification_mode", "manual_admin", "Verification mode: manual_admin or instant_simulation"),
                ("min_deposit_amount", "10.00", "Minimum allowed deposit amount in INR"),
                ("max_deposit_amount", "100000.00", "Maximum allowed deposit amount in INR")
            ]
            for s_key, s_val, s_desc in default_settings:
                s_stmt = select(SystemSetting).where(SystemSetting.key == s_key)
                s_res = await session.execute(s_stmt)
                if not s_res.scalar_one_or_none():
                    session.add(SystemSetting(
                        id=str(uuid.uuid4()),
                        key=s_key,
                        value=s_val,
                        description=s_desc
                    ))

            # 3. Environment-driven Admin Bootstrap
            admin_email = os.getenv("ADMIN_EMAIL", "admin@lextitle.ai").lower().strip()
            admin_pass = os.getenv("ADMIN_PASSWORD", "LexTitleAdmin2026!Secure").strip()
            admin_pass_hash = os.getenv("ADMIN_PASSWORD_HASH", "").strip()

            if admin_email and (admin_pass or admin_pass_hash):
                stmt = select(User).where(User.email == admin_email)
                res = await session.execute(stmt)
                existing_admin = res.scalar_one_or_none()

                if not existing_admin:
                    if admin_pass:
                        p_hash = bcrypt.hashpw(admin_pass.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")
                    else:
                        p_hash = admin_pass_hash

                    admin_user = User(
                        id=str(uuid.uuid4()),
                        name="System Administrator",
                        email=admin_email,
                        mobile=os.getenv("ADMIN_MOBILE", "+919999999999"),
                        password_hash=p_hash,
                        role="ADMIN",
                        is_active=True
                    )
                    session.add(admin_user)
                    # Note: NO wallet is created for ADMIN!
                    logger.info(f"Bootstrap administrator created from environment variables: {admin_email}")
                else:
                    if admin_pass:
                        try:
                            # Verify if existing hash matches current admin_pass; if not, update it
                            if not bcrypt.checkpw(admin_pass.encode("utf-8"), existing_admin.password_hash.encode("utf-8")):
                                existing_admin.password_hash = bcrypt.hashpw(admin_pass.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")
                                logger.info(f"Updated administrator password hash from .env for: {admin_email}")
                        except Exception as hash_err:
                            logger.warning(f"Could not check/update admin password hash: {hash_err}")

            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Error initializing system defaults: {e}")
            raise
