"""
LexTitle AI - Client Management & Scrutiny Association API
Enforces permanent client storage, duplicate checking (by phone/email),
client search, and full scrutiny history association.
"""

import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from pydantic import BaseModel, Field

from backend.app.db.database import get_db
from backend.app.db.models import (
    Client,
    GenerationSession,
    TemplateLibraryItem,
    DocumentHistoryItem,
    User
)
from backend.app.core.auth import get_current_user_optional

router = APIRouter(prefix="/api/clients", tags=["clients"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class CreateClientRequest(BaseModel):
    name: str = Field(..., description="Client Name")
    phone: str = Field(..., description="Phone Number")
    email: str = Field(..., description="Email Address")
    title: str = Field(..., description="Scrutiny Matter Reference / Property Title")


class CheckExistingClientRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None


class ClientResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: str
    title: str
    created_at: str
    updated_at: str
    scrutiny_count: int = 0


class CheckExistingClientResponse(BaseModel):
    exists: bool
    client: Optional[ClientResponse] = None


class ClientScrutinyHistory(BaseModel):
    session_id: str
    template_filename: str
    status: str
    created_at: str
    sources_count: int = 0
    sources_names: List[str] = Field(default_factory=list)
    final_document_ready: bool = False
    history_id: Optional[str] = None


class ClientDetailResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: str
    title: str
    created_at: str
    updated_at: str
    scrutiny_count: int = 0
    scrutinies: List[ClientScrutinyHistory] = Field(default_factory=list)


class StartScrutinyRequest(BaseModel):
    template_id: str


class StartScrutinyResponse(BaseModel):
    session_id: str
    client_id: str
    template_id: str
    template_filename: str
    bank_name: str = "General"
    fields_count: int
    table_groups_count: int
    fields: list
    table_groups: list
    client: ClientResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _validate_client_input(name: str, phone: str, email: str, title: str):
    clean_name = name.strip() if name else ""
    clean_phone = phone.strip() if phone else ""
    clean_email = email.strip().lower() if email else ""
    clean_title = title.strip() if title else ""

    if not clean_name:
        raise HTTPException(status_code=400, detail="Client Name is required")
    if not clean_phone or len(clean_phone) < 5:
        raise HTTPException(status_code=400, detail="A valid Phone Number is required")
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(status_code=400, detail="A valid Email Address is required")
    if not clean_title:
        raise HTTPException(status_code=400, detail="Title / Property Matter reference is required")

    return clean_name, clean_phone, clean_email, clean_title


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/check-existing", response_model=CheckExistingClientResponse)
async def check_existing_client(
    payload: CheckExistingClientRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Checks if an existing client in the database matches the given phone or email.
    Used before creating a new client to offer 'Use Existing' vs 'Create New'.
    """
    conditions = []
    clean_phone = payload.phone.strip() if payload.phone else ""
    clean_email = payload.email.strip().lower() if payload.email else ""

    if clean_phone:
        conditions.append(Client.phone == clean_phone)
    if clean_email:
        conditions.append(func.lower(Client.email) == clean_email)

    if not conditions:
        return CheckExistingClientResponse(exists=False, client=None)

    stmt = select(Client).where(or_(*conditions)).order_by(Client.created_at.desc()).limit(1)
    res = await db.execute(stmt)
    matched = res.scalar_one_or_none()

    if not matched:
        return CheckExistingClientResponse(exists=False, client=None)

    count_stmt = select(func.count(GenerationSession.id)).where(GenerationSession.client_id == matched.id)
    count_res = await db.execute(count_stmt)
    scrutiny_c = count_res.scalar() or 0

    return CheckExistingClientResponse(
        exists=True,
        client=ClientResponse(
            id=matched.id,
            name=matched.name,
            phone=matched.phone,
            email=matched.email,
            title=matched.title,
            created_at=matched.created_at.isoformat() if matched.created_at else "",
            updated_at=matched.updated_at.isoformat() if matched.updated_at else "",
            scrutiny_count=scrutiny_c
        )
    )


@router.post("", response_model=ClientResponse)
async def create_client(
    payload: CreateClientRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new client in the backend database.
    Permanently stores Client ID, Name, Phone, Email, Title, and Timestamps.
    """
    clean_name, clean_phone, clean_email, clean_title = _validate_client_input(
        payload.name, payload.phone, payload.email, payload.title
    )

    client_id = str(uuid.uuid4())
    client = Client(
        id=client_id,
        user_id=current_user.id if current_user else None,
        name=clean_name,
        phone=clean_phone,
        email=clean_email,
        title=clean_title
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)

    return ClientResponse(
        id=client.id,
        name=client.name,
        phone=client.phone,
        email=client.email,
        title=client.title,
        created_at=client.created_at.isoformat() if client.created_at else "",
        updated_at=client.updated_at.isoformat() if client.updated_at else "",
        scrutiny_count=0
    )


@router.get("", response_model=List[ClientResponse])
async def list_clients(
    search: Optional[str] = Query(None, description="Search term for name, phone, email, or title"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists real clients from the database.
    Supports filtering by search query across name, phone, email, and title.
    """
    stmt = select(Client)
    if current_user:
        stmt = stmt.where(or_(Client.user_id == current_user.id, Client.user_id.is_(None)))

    if search and search.strip():
        raw_search = search.replace("+", " ").strip().lower()
        tokens = [t.strip() for t in raw_search.split() if t.strip()]
        for token in tokens:
            term = f"%{token}%"
            stmt = stmt.where(
                or_(
                    func.lower(Client.name).like(term),
                    Client.phone.like(term),
                    func.lower(Client.email).like(term),
                    func.lower(Client.title).like(term)
                )
            )

    stmt = stmt.order_by(Client.created_at.desc())
    res = await db.execute(stmt)
    clients = res.scalars().all()

    client_ids = [c.id for c in clients]
    counts_map = {}
    if client_ids:
        count_stmt = select(
            GenerationSession.client_id,
            func.count(GenerationSession.id)
        ).where(GenerationSession.client_id.in_(client_ids)).group_by(GenerationSession.client_id)
        count_res = await db.execute(count_stmt)
        for cid, count in count_res.fetchall():
            counts_map[cid] = count

    return [
        ClientResponse(
            id=c.id,
            name=c.name,
            phone=c.phone,
            email=c.email,
            title=c.title,
            created_at=c.created_at.isoformat() if c.created_at else "",
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
            scrutiny_count=counts_map.get(c.id, 0)
        )
        for c in clients
    ]


@router.get("/{client_id}", response_model=ClientDetailResponse)
async def get_client_detail(
    client_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves full client details along with complete scrutiny history:
    Client -> Template -> Scrutiny Session -> Uploaded Documents -> Generated Document.
    """
    stmt = select(Client).where(Client.id == client_id)
    res = await db.execute(stmt)
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    sess_stmt = select(GenerationSession).where(
        GenerationSession.client_id == client_id
    ).order_by(GenerationSession.created_at.desc())
    sess_res = await db.execute(sess_stmt)
    sessions = sess_res.scalars().all()

    hist_stmt = select(DocumentHistoryItem).where(DocumentHistoryItem.client_id == client_id)
    hist_res = await db.execute(hist_stmt)
    hist_map = {h.session_id: h.id for h in hist_res.scalars().all() if h.session_id}

    scrutinies: List[ClientScrutinyHistory] = []
    for s in sessions:
        src_names = []
        src_count = 0
        if s.sources_json:
            try:
                sources_data = json.loads(s.sources_json)
                src_count = len(sources_data)
                src_names = [src.get("filename", "") for src in sources_data if isinstance(src, dict)]
            except Exception:
                pass

        scrutinies.append(ClientScrutinyHistory(
            session_id=s.id,
            template_filename=s.template_filename or "Legal Scrutiny",
            status=s.status or "created",
            created_at=s.created_at.isoformat() if s.created_at else "",
            sources_count=src_count,
            sources_names=src_names,
            final_document_ready=bool(s.final_docx_bytes is not None),
            history_id=hist_map.get(s.id)
        ))

    return ClientDetailResponse(
        id=client.id,
        name=client.name,
        phone=client.phone,
        email=client.email,
        title=client.title,
        created_at=client.created_at.isoformat() if client.created_at else "",
        updated_at=client.updated_at.isoformat() if client.updated_at else "",
        scrutiny_count=len(scrutinies),
        scrutinies=scrutinies
    )


@router.post("/{client_id}/start-scrutiny", response_model=StartScrutinyResponse)
async def start_scrutiny_for_client(
    client_id: str,
    payload: StartScrutinyRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Initializes a new Scrutiny Session associating Client -> Template -> Scrutiny Session.
    Pre-populates template variables from TemplateLibraryItem so the user can immediately
    upload source documents and execute AI analysis.
    """
    stmt_c = select(Client).where(Client.id == client_id)
    res_c = await db.execute(stmt_c)
    client = res_c.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    stmt_t = select(TemplateLibraryItem).where(TemplateLibraryItem.id == payload.template_id)
    res_t = await db.execute(stmt_t)
    template_item = res_t.scalar_one_or_none()
    if not template_item:
        raise HTTPException(status_code=404, detail="Template not found in library")

    session_id = str(uuid.uuid4())
    session = GenerationSession(
        id=session_id,
        user_id=current_user.id if current_user else client.user_id,
        client_id=client.id,
        template_id=template_item.id,
        template_filename=template_item.name,
        template_bytes=template_item.template_bytes,
        status="template_loaded",
        fields_json=template_item.fields_json,
        table_groups_json=template_item.table_groups_json,
        sources_json="[]",
        results_json="[]",
        table_results_json="[]"
    )
    db.add(session)
    await db.commit()

    fields_parsed = json.loads(template_item.fields_json or "[]")
    tables_parsed = json.loads(template_item.table_groups_json or "[]")

    return StartScrutinyResponse(
        session_id=session_id,
        client_id=client.id,
        template_id=template_item.id,
        template_filename=template_item.name,
        bank_name=template_item.bank_name or "General",
        fields_count=template_item.fields_count,
        table_groups_count=template_item.table_groups_count,
        fields=fields_parsed,
        table_groups=tables_parsed,
        client=ClientResponse(
            id=client.id,
            name=client.name,
            phone=client.phone,
            email=client.email,
            title=client.title,
            created_at=client.created_at.isoformat() if client.created_at else "",
            updated_at=client.updated_at.isoformat() if client.updated_at else "",
            scrutiny_count=1
        )
    )
