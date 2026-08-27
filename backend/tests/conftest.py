import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add app and tests to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from app.database import Base, get_db
from app.main import app
from create_fixtures import create_sample_docx_template, create_sample_source_docx

TEST_DB_URL = "sqlite:///./test_docauto.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if Path("./test_docauto.db").exists():
        os.remove("./test_docauto.db")

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture(scope="session")
def sample_docx_template(tmp_path_factory):
    fn = tmp_path_factory.mktemp("data") / "sample_template.docx"
    create_sample_docx_template(str(fn))
    return str(fn)

@pytest.fixture(scope="session")
def sample_source_docx(tmp_path_factory):
    fn = tmp_path_factory.mktemp("data") / "sample_source.docx"
    create_sample_source_docx(str(fn))
    return str(fn)
