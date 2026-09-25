"""
Production Database Sanitization & Initialization Utility.

Purges legacy test data and initializes a pristine production database.
- Guarantees ZERO regular/demo users.
- Guarantees ZERO fake wallets, payments, transactions, or document sessions.
- Seeds real system pricing and gateway configurations.
- Provisions a single verified Production Administrator (Admin has NO wallet).

Usage:
    python -m backend.app.db.init_production_db --email admin@lextitle.ai --password "YourStrongPassword123!" --clean
"""

import os
import sys
import uuid
import asyncio
import argparse
import logging
from decimal import Decimal
from pathlib import Path
import bcrypt
from sqlalchemy import select, text

from backend.app.db.database import (
    Base,
    engine,
    AsyncSessionLocal,
    DATABASE_URL,
    DB_FILE,
)
from backend.app.db.models import (
    User,
    Wallet,
    SystemPricingConfig,
    SystemSetting,
    AuditLog,
    TemplateLibraryItem,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("init_production_db")


async def init_clean_production_database(
    admin_email: str,
    admin_password: str,
    admin_name: str = "Chief Systems Administrator",
    admin_mobile: str = "+919876543210",
    clean: bool = True,
):
    admin_email_clean = admin_email.lower().strip()
    if not admin_email_clean or "@" not in admin_email_clean:
        logger.error("A valid administrator email address is required.")
        sys.exit(1)

    if len(admin_password) < 8:
        logger.error("Administrator password must be at least 8 characters.")
        sys.exit(1)

    logger.info(f"Target Database URL: {DATABASE_URL}")

    # Step 1: Drop and recreate or purge tables if clean mode requested
    async with engine.begin() as conn:
        if "sqlite" in DATABASE_URL:
            await conn.execute(text("PRAGMA journal_mode=WAL;"))
            await conn.execute(text("PRAGMA synchronous=NORMAL;"))
            await conn.execute(text("PRAGMA busy_timeout=5000;"))

        if clean:
            logger.info("Purging all existing database tables for a clean production setup...")
            if "sqlite" in DATABASE_URL:
                cursor_res = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
                existing_tables = [row[0] for row in cursor_res.fetchall()]
                for tbl in existing_tables:
                    await conn.execute(text(f"DROP TABLE IF EXISTS {tbl}"))
            else:
                await conn.run_sync(Base.metadata.drop_all)

        logger.info("Creating clean production schema tables...")
        await conn.run_sync(Base.metadata.create_all)

        # Ensure unique index on mobile in users table
        try:
            await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_mobile ON users(mobile)"))
        except Exception:
            pass

    # Step 2: Seed default pricing, settings, and authentic admin
    async with AsyncSessionLocal() as session:
        # 1. System Pricing Configuration
        logger.info("Configuring production pricing rates...")
        default_pricing = [
            ("doc_generation_fee", Decimal("50.00"), "Fee per legal title scrutiny / opinion synthesis (INR)"),
            ("ocr_per_page_fee", Decimal("5.00"), "Fee per scanned OCR document page analysis (INR)"),
        ]
        for key, val, desc in default_pricing:
            stmt = select(SystemPricingConfig).where(SystemPricingConfig.key == key)
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                session.add(
                    SystemPricingConfig(
                        id=str(uuid.uuid4()),
                        key=key,
                        value=val,
                        description=desc,
                    )
                )

        # 2. System Settings (Payment Gateway & UPI)
        logger.info("Configuring production payment settings...")
        upi_vpa = os.getenv("UPI_VPA", "lextitle.billing@icici")
        upi_payee = os.getenv("UPI_PAYEE_NAME", "LexTitle AI Legal Systems")
        default_settings = [
            ("upi_vpa", upi_vpa, "Production Merchant UPI VPA / ID"),
            ("upi_payee_name", upi_payee, "Production Merchant Payee Name"),
            ("upi_qr_image_url", "", "Custom QR Code Image URL (optional)"),
            ("payment_verification_mode", "manual_admin", "Verification mode: manual_admin"),
            ("min_deposit_amount", "10.00", "Minimum allowed deposit amount in INR"),
            ("max_deposit_amount", "100000.00", "Maximum allowed deposit amount in INR"),
        ]
        for s_key, s_val, s_desc in default_settings:
            s_stmt = select(SystemSetting).where(SystemSetting.key == s_key)
            s_res = await session.execute(s_stmt)
            if not s_res.scalar_one_or_none():
                session.add(
                    SystemSetting(
                        id=str(uuid.uuid4()),
                        key=s_key,
                        value=s_val,
                        description=s_desc,
                    )
                )

        # 3. Provision Production Administrator
        logger.info(f"Provisioning verified Production Administrator: {admin_email_clean}...")
        password_hash = bcrypt.hashpw(admin_password.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")

        stmt_admin = select(User).where(User.email == admin_email_clean)
        res_admin = await session.execute(stmt_admin)
        existing_admin = res_admin.scalar_one_or_none()

        admin_id = str(uuid.uuid4())
        if existing_admin:
            existing_admin.name = admin_name
            existing_admin.mobile = admin_mobile
            existing_admin.password_hash = password_hash
            existing_admin.role = "ADMIN"
            existing_admin.is_active = True
            admin_id = existing_admin.id
            logger.info("Existing account updated to Administrator role.")
        else:
            admin_user = User(
                id=admin_id,
                name=admin_name,
                email=admin_email_clean,
                mobile=admin_mobile,
                password_hash=password_hash,
                role="ADMIN",
                is_active=True,
            )
            session.add(admin_user)
            logger.info("Administrator account created successfully.")

        # Note: In accordance with core requirements, ADMIN HAS NO WALLET!

        # 4. Record Initial System Bootstrap Audit Log
        session.add(
            AuditLog(
                id=str(uuid.uuid4()),
                admin_id=admin_id,
                action="SYSTEM_INIT",
                target_type="SYSTEM",
                target_id="PRODUCTION",
                metadata_json='{"message": "Production database initialized cleanly with zero demo accounts."}',
                ip_address="127.0.0.1",
            )
        )

        # 5. Seed Default Legal Opinion Template if not present
        stmt_tpl = select(TemplateLibraryItem).where(
            (TemplateLibraryItem.name.like("%Legal%")) | (TemplateLibraryItem.name.like("%Muthulakshmi%"))
        )
        res_tpl = await session.execute(stmt_tpl)
        if not res_tpl.scalar_one_or_none():
            from backend.app.core.samples import generate_legal_opinion_title_report_template
            from backend.app.core.doc_processor import detect_yellow_highlights
            import json

            tpl_bio = generate_legal_opinion_title_report_template()
            tpl_bytes = tpl_bio.getvalue()
            _, fields, table_groups = detect_yellow_highlights(tpl_bytes)

            session.add(
                TemplateLibraryItem(
                    id=str(uuid.uuid4()),
                    user_id=admin_id,
                    name="Muthulakshmi Gopal Agri 03.07.2026.docx",
                    fields_count=len(fields),
                    table_groups_count=len(table_groups),
                    template_bytes=tpl_bytes,
                    fields_json=json.dumps([f.model_dump() for f in fields]),
                    table_groups_json=json.dumps([tg.model_dump() for tg in table_groups]),
                    bank_name="General",
                )
            )
            logger.info("Default Legal Opinion template seeded into template library.")

        await session.commit()

        # Step 3: Verification Audit Query
        res_users = await session.execute(select(User).where(User.role != "ADMIN"))
        regular_users_count = len(res_users.scalars().all())

        res_admins = await session.execute(select(User).where(User.role == "ADMIN"))
        admins_count = len(res_admins.scalars().all())

        res_wallets = await session.execute(select(Wallet))
        wallets_count = len(res_wallets.scalars().all())

        print("\n" + "=" * 60)
        print("  PRODUCTION DATABASE INITIALIZED SUCCESSFULLY")
        print("=" * 60)
        print(f"  Target File / URL    : {DATABASE_URL}")
        print(f"  Regular Users (Demo) : {regular_users_count} (Pristine clean)")
        print(f"  Production Admins    : {admins_count} ({admin_email_clean})")
        print(f"  User Wallets         : {wallets_count} (Admins have NO wallet)")
        print(f"  Initial State        : READY FOR PRODUCTION LAUNCH")
        print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Initialize Pristine Production Database")
    parser.add_argument(
        "--email",
        default=os.getenv("ADMIN_EMAIL", "admin@lextitle.ai"),
        help="Production Administrator Email",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("ADMIN_PASSWORD", "LexTitleAdmin2026!Secure"),
        help="Production Administrator Password",
    )
    parser.add_argument(
        "--name",
        default=os.getenv("ADMIN_NAME", "Chief Systems Administrator"),
        help="Administrator Full Name",
    )
    parser.add_argument(
        "--mobile",
        default=os.getenv("ADMIN_MOBILE", "+919876543210"),
        help="Administrator Contact Number",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        default=True,
        help="Purge existing tables before creating schema",
    )

    args = parser.parse_args()
    asyncio.run(
        init_clean_production_database(
            admin_email=args.email,
            admin_password=args.password,
            admin_name=args.name,
            admin_mobile=args.mobile,
            clean=args.clean,
        )
    )


if __name__ == "__main__":
    main()
