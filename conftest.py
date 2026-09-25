import os
import sys
from pathlib import Path

# Add project root to sys.path for test discovery
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# STRICT TEST ISOLATION: Tests must NEVER touch the main docfiller.db database
test_db_path = str(root_dir / "test_docfiller.db")
os.environ["DOCFILLER_DB_PATH"] = test_db_path
os.environ["ENVIRONMENT"] = "testing"
if "DATABASE_URL" in os.environ and "sqlite" in os.environ.get("DATABASE_URL", ""):
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{test_db_path}"

import pytest

@pytest.fixture(scope="session", autouse=True)
def isolate_test_database():
    """Ensure clean test database is used for tests and clean up artifacts afterwards."""
    yield
    # Cleanup test db artifacts after session completes
    for suffix in ["", "-shm", "-wal"]:
        p = Path(test_db_path + suffix)
        if p.exists():
            try:
                p.unlink()
            except Exception:
                pass
