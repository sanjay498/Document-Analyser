#!/usr/bin/env python3
"""
LexTitle AI - Admin Password Reset Tool
Usage:
    python reset_admin_password.py [new_password]

If [new_password] is omitted, you will be prompted to enter it securely.
This script updates:
1. The ADMIN user's BCrypt password hash in docfiller.db
2. The ADMIN_PASSWORD key in the .env configuration file
"""

import sys
import os
import re
import getpass
import sqlite3
import bcrypt

ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docfiller.db")

def update_env_file(new_password: str):
    """Updates or appends ADMIN_PASSWORD in the .env file."""
    if not os.path.exists(ENV_FILE):
        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.write(f"ADMIN_PASSWORD={new_password}\n")
        return

    with open(ENV_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    if re.search(r"^ADMIN_PASSWORD=.*$", content, flags=re.MULTILINE):
        new_content = re.sub(
            r"^ADMIN_PASSWORD=.*$",
            f"ADMIN_PASSWORD={new_password}",
            content,
            flags=re.MULTILINE
        )
    else:
        new_content = content + f"\nADMIN_PASSWORD={new_password}\n"

    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)

def update_database(new_password: str):
    """Updates password_hash for all active ADMIN users in docfiller.db."""
    if not os.path.exists(DB_FILE):
        print(f"[!] Database file not found at {DB_FILE}. Only .env updated.")
        return 0

    password_bytes = new_password.encode("utf-8")
    salt = bcrypt.gensalt(12)
    hashed_str = bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("SELECT id, email FROM users WHERE role = 'ADMIN'")
    admins = cursor.fetchall()

    if not admins:
        print("[!] No user with role='ADMIN' found in the database. Updating .env only.")
        conn.close()
        return 0

    cursor.execute(
        "UPDATE users SET password_hash = ? WHERE role = 'ADMIN'",
        (hashed_str,)
    )
    conn.commit()
    conn.close()
    return len(admins)

def main():
    if len(sys.argv) > 1:
        new_password = sys.argv[1].strip()
    else:
        print("=" * 50)
        print("  LexTitle AI - Admin Password Reset")
        print("=" * 50)
        new_password = getpass.getpass("Enter new admin password: ").strip()
        confirm_password = getpass.getpass("Confirm new admin password: ").strip()
        if new_password != confirm_password:
            print("[x] Error: Passwords do not match.")
            sys.exit(1)

    if not new_password or len(new_password) < 6:
        print("[x] Error: Password must be at least 6 characters long.")
        sys.exit(1)

    print("\nUpdating admin password...")
    updated_admins = update_database(new_password)
    update_env_file(new_password)

    print("\n[✓] SUCCESS: Administrator password has been reset successfully!")
    print(f"    - Updated Database: {updated_admins} admin record(s) updated in docfiller.db")
    print(f"    - Updated Config:   ADMIN_PASSWORD updated in .env")
    print(f"    - New Password:     {new_password}\n")

if __name__ == "__main__":
    main()
