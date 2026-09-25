"""
Secure CLI Utility to Bootstrap or Reset the System Administrator Account.
Usage:
    python -m backend.app.db.bootstrap_admin --email admin@example.com --password YourStrongPassword123! --name "Admin Name" --mobile "+919876543210"
Or read from environment variables:
    ADMIN_EMAIL=... ADMIN_PASSWORD=... python -m backend.app.db.bootstrap_admin
"""

import sys
import os
import uuid
import asyncio
import argparse
import bcrypt
from sqlalchemy import select

from backend.app.db.database import AsyncSessionLocal, init_db
from backend.app.db.models import User


async def bootstrap_admin(email: str, password: str, name: str = "System Administrator", mobile: str = "+919999999999"):
    email_clean = email.lower().strip()
    if not email_clean or "@" not in email_clean:
        print("[-] Error: A valid email address is required.", file=sys.stderr)
        sys.exit(1)

    if len(password) < 8:
        print("[-] Error: Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    await init_db()

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")

    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email_clean)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user:
            user.name = name
            user.mobile = mobile
            user.password_hash = password_hash
            user.role = "ADMIN"
            user.is_active = True
            print(f"[+] Existing user {email_clean} promoted/updated to Administrator successfully.")
        else:
            admin_user = User(
                id=str(uuid.uuid4()),
                name=name,
                email=email_clean,
                mobile=mobile,
                password_hash=password_hash,
                role="ADMIN",
                is_active=True
            )
            session.add(admin_user)
            print(f"[+] Administrator account {email_clean} created successfully.")

        await session.commit()


def main():
    parser = argparse.ArgumentParser(description="Bootstrap Administrator Account")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL"))
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"))
    parser.add_argument("--name", default=os.getenv("ADMIN_NAME", "System Administrator"))
    parser.add_argument("--mobile", default=os.getenv("ADMIN_MOBILE", "+919999999999"))

    args = parser.parse_args()

    if not args.email or not args.password:
        print("[-] Error: Both --email and --password (or ADMIN_EMAIL and ADMIN_PASSWORD env vars) must be specified.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(bootstrap_admin(args.email, args.password, args.name, args.mobile))


if __name__ == "__main__":
    main()
