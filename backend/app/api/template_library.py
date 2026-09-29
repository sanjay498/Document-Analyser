"""
Doc Filler AI - Template Library API (Phase 3)
Allows saving, managing, and caching parsed templates to eliminate redundant highlight detection.
"""

import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from backend.app.db.database import get_db
from backend.app.db.models import TemplateLibraryItem, TemplateGroup, GenerationSession, User
from backend.app.core.auth import get_current_user_optional
from backend.app.core.doc_processor import detect_yellow_highlights, detect_template_universal
from backend.app.core.naming import (
    detect_bank_and_doc_type,
    generate_smart_template_name,
    clean_filename
)

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateSummaryResponse(BaseModel):
    id: str
    name: str
    bank_name: str = "Default"
    created_at: str
    fields_count: int
    table_groups_count: int


class RenameTemplateRequest(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None


class CreateTemplateGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None


class TemplateGroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str
    template_count: int = 0


class UseTemplateResponse(BaseModel):
    session_id: str
    template_filename: str
    bank_name: str = "Default"
    fields_count: int
    table_groups_count: int
    fields: list
    table_groups: list


@router.get("/banks", response_model=List[str])
@router.get("/groups", response_model=List[str])
async def list_bank_folders(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns unique template groups registered across all templates and custom groups.
    Excludes base default/general unassigned group.
    """
    groups_set = set()

    # 1. Fetch user-defined TemplateGroups
    stmt_groups = select(TemplateGroup.name)
    if current_user:
        stmt_groups = stmt_groups.where(
            (TemplateGroup.user_id == current_user.id) | (TemplateGroup.user_id.is_(None))
        )
    res_groups = await db.execute(stmt_groups)
    for r in res_groups.fetchall():
        if r[0] and r[0].strip() and r[0].strip() not in ("General", "Default"):
            groups_set.add(r[0].strip())

    # 2. Also union with distinct bank_name from TemplateLibraryItem
    stmt = select(TemplateLibraryItem.bank_name).distinct()
    if current_user:
        stmt = stmt.where(
            (TemplateLibraryItem.user_id == current_user.id) | (TemplateLibraryItem.user_id.is_(None))
        )
    res = await db.execute(stmt)
    for r in res.fetchall():
        if r[0] and r[0].strip() and r[0].strip() not in ("General", "Default"):
            groups_set.add(r[0].strip())

    return sorted(list(groups_set))


@router.post("/groups", response_model=TemplateGroupResponse)
async def create_template_group(
    payload: CreateTemplateGroupRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    group_name = payload.name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="Group name is required")

    stmt = select(TemplateGroup).where(TemplateGroup.name.ilike(group_name))
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        return TemplateGroupResponse(
            id=existing.id,
            name=existing.name,
            description=existing.description,
            created_at=existing.created_at.isoformat() if existing.created_at else "",
            template_count=0
        )

    new_group = TemplateGroup(
        id=str(uuid.uuid4()),
        user_id=current_user.id if current_user else None,
        name=group_name,
        description=payload.description.strip() if payload.description else None
    )
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)

    return TemplateGroupResponse(
        id=new_group.id,
        name=new_group.name,
        description=new_group.description,
        created_at=new_group.created_at.isoformat() if new_group.created_at else "",
        template_count=0
    )


@router.delete("/groups/{group_name}")
async def delete_template_group(
    group_name: str,
    delete_templates: bool = True,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    clean_name = group_name.strip()
    stmt = delete(TemplateGroup).where(TemplateGroup.name.ilike(clean_name))
    if current_user:
        stmt = stmt.where((TemplateGroup.user_id == current_user.id) | (TemplateGroup.user_id.is_(None)))
    await db.execute(stmt)

    if delete_templates:
        stmt_t = delete(TemplateLibraryItem).where(TemplateLibraryItem.bank_name.ilike(clean_name))
        if current_user:
            stmt_t = stmt_t.where((TemplateLibraryItem.user_id == current_user.id) | (TemplateLibraryItem.user_id.is_(None)))
        await db.execute(stmt_t)

    await db.commit()
    return {"status": "success", "message": f"Template group '{clean_name}' deleted"}


def normalize_bank_name(b: Optional[str]) -> str:
    if not b or b.strip() in ("General", "Default", "", "None", "null"):
        return "Default"
    return b.strip()


@router.get("", response_model=List[TemplateSummaryResponse])
async def list_templates(
    bank_name: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(TemplateLibraryItem)
    if current_user:
        stmt = stmt.where(
            (TemplateLibraryItem.user_id == current_user.id) | (TemplateLibraryItem.user_id.is_(None))
        )
    if bank_name and bank_name.strip():
        req_b = bank_name.strip()
        if req_b in ("Default", "General"):
            stmt = stmt.where(
                (TemplateLibraryItem.bank_name.in_(["Default", "General", "", None]))
                | (TemplateLibraryItem.bank_name.is_(None))
            )
        else:
            stmt = stmt.where(TemplateLibraryItem.bank_name == req_b)

    stmt = stmt.order_by(TemplateLibraryItem.bank_name.asc(), TemplateLibraryItem.created_at.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()

    return [
        TemplateSummaryResponse(
            id=item.id,
            name=item.name,
            bank_name=normalize_bank_name(item.bank_name),
            created_at=item.created_at.isoformat() if item.created_at else "",
            fields_count=item.fields_count,
            table_groups_count=item.table_groups_count
        )
        for item in items
    ]


@router.post("", response_model=TemplateSummaryResponse)
async def save_template_to_library(
    file: Optional[UploadFile] = File(None),
    session_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    bank_name: Optional[str] = Form("Default"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    template_name = name
    raw_bank = (bank_name or "Default").strip()
    resolved_bank = "Default" if raw_bank in ("General", "Default", "", "none", "null") else raw_bank
    template_bytes = None
    fields_json = None
    table_groups_json = None
    fields_count = 0
    table_groups_count = 0

    if session_id:
        # Save from existing session
        stmt = select(GenerationSession).where(GenerationSession.id == session_id)
        res = await db.execute(stmt)
        sess = res.scalar_one_or_none()
        if not sess or not sess.template_bytes:
            raise HTTPException(status_code=404, detail="Session template not found")
        
        fields_json = sess.fields_json or "[]"
        table_groups_json = sess.table_groups_json or "[]"
        fields_list = json.loads(fields_json)
        table_groups_list = json.loads(table_groups_json)
        sample_text = " ".join([f.get("paragraph_context", "") for f in fields_list[:12]])
        _, d_type = detect_bank_and_doc_type(sample_text, sess.template_filename or "")
        if not template_name or "_completed" in template_name.lower() or "muthulakshmi" in template_name.lower():
            template_name = generate_smart_template_name(
                bank=resolved_bank if resolved_bank != "Default" else "",
                doc_type=d_type,
                original_filename=sess.template_filename or ""
            )
        else:
            template_name = template_name.strip()

        template_bytes = sess.template_bytes
        fields_count = len(fields_list)
        table_groups_count = len(table_groups_list)

    elif file:
        allowed = (".docx", ".pptx", ".pdf")
        if not any(file.filename.lower().endswith(ext) for ext in allowed):
            raise HTTPException(status_code=400, detail="Only .docx, .pptx, and .pdf template files are supported.")
        template_bytes = await file.read()
        doc, fields, table_groups = detect_template_universal(template_bytes, file.filename)
        fields_json = json.dumps([f.model_dump() for f in fields])
        table_groups_json = json.dumps([tg.model_dump() for tg in table_groups])
        fields_count = len(fields)
        table_groups_count = len(table_groups)

        sample_text = " ".join([f.paragraph_context for f in fields[:12]])
        _, d_type = detect_bank_and_doc_type(sample_text, file.filename)
        if not template_name or template_name == file.filename or template_name.lower().startswith("template"):
            template_name = generate_smart_template_name(
                bank=resolved_bank if resolved_bank != "Default" else "",
                doc_type=d_type,
                original_filename=file.filename
            )
        else:
            template_name = template_name.strip()

    else:
        raise HTTPException(status_code=400, detail="Either file upload or session_id must be provided.")

    item_id = str(uuid.uuid4())
    item = TemplateLibraryItem(
        id=item_id,
        user_id=current_user.id if current_user else None,
        name=template_name,
        bank_name=resolved_bank,
        fields_count=fields_count,
        table_groups_count=table_groups_count,
        template_bytes=template_bytes,
        fields_json=fields_json,
        table_groups_json=table_groups_json
    )
    db.add(item)
    await db.commit()

    return TemplateSummaryResponse(
        id=item.id,
        name=item.name,
        bank_name=normalize_bank_name(item.bank_name),
        created_at=item.created_at.isoformat() if item.created_at else "",
        fields_count=item.fields_count,
        table_groups_count=item.table_groups_count
    )


@router.patch("/{template_id}", response_model=TemplateSummaryResponse)
async def rename_template(
    template_id: str,
    payload: RenameTemplateRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(TemplateLibraryItem).where(TemplateLibraryItem.id == template_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Template not found")

    if payload.name is not None and payload.name.strip():
        item.name = payload.name.strip()
    if payload.bank_name is not None:
        val = payload.bank_name.strip()
        if not val or val.lower() in ("default", "general", "none", "null", "remove", "ungroup"):
            item.bank_name = "Default"
        else:
            item.bank_name = val

    await db.commit()

    return TemplateSummaryResponse(
        id=item.id,
        name=item.name,
        bank_name=normalize_bank_name(item.bank_name),
        created_at=item.created_at.isoformat() if item.created_at else "",
        fields_count=item.fields_count,
        table_groups_count=item.table_groups_count
    )


@router.delete("/all")
@router.delete("")
async def delete_all_templates(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes all saved templates and custom template groups from the library.
    """
    stmt = delete(TemplateLibraryItem)
    if current_user:
        stmt = stmt.where((TemplateLibraryItem.user_id == current_user.id) | (TemplateLibraryItem.user_id.is_(None)))
    await db.execute(stmt)

    stmt_g = delete(TemplateGroup)
    if current_user:
        stmt_g = stmt_g.where((TemplateGroup.user_id == current_user.id) | (TemplateGroup.user_id.is_(None)))
    await db.execute(stmt_g)

    await db.commit()
    return {"status": "success", "message": "All templates and groups deleted"}


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(TemplateLibraryItem).where(TemplateLibraryItem.id == template_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(item)
    await db.commit()
    return {"status": "success", "message": "Template deleted"}


class TemplateDetailResponse(BaseModel):
    id: str
    name: str
    bank_name: str = "Default"
    created_at: str
    fields_count: int
    table_groups_count: int
    fields: list
    table_groups: list


@router.get("/{template_id}", response_model=TemplateDetailResponse)
async def get_template_detail(
    template_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(TemplateLibraryItem).where(TemplateLibraryItem.id == template_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Template not found")

    return TemplateDetailResponse(
        id=item.id,
        name=item.name,
        bank_name=normalize_bank_name(item.bank_name),
        created_at=item.created_at.isoformat() if item.created_at else "",
        fields_count=item.fields_count,
        table_groups_count=item.table_groups_count,
        fields=json.loads(item.fields_json or "[]"),
        table_groups=json.loads(item.table_groups_json or "[]")
    )


@router.get("/{template_id}/download")
async def download_template_file(
    template_id: str,
    db: AsyncSession = Depends(get_db)
):
    from fastapi.responses import Response
    stmt = select(TemplateLibraryItem).where(TemplateLibraryItem.id == template_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item or not item.template_bytes:
        raise HTTPException(status_code=404, detail="Template file not found")

    filename = item.name
    if not filename.endswith((".docx", ".pptx", ".pdf")):
        filename += ".docx"

    return Response(
        content=item.template_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/seed-defaults", response_model=List[TemplateSummaryResponse])
async def seed_default_templates(
    db: AsyncSession = Depends(get_db)
):
    """
    Template library is exclusively custom; returns user's custom templates.
    """
    stmt_all = select(TemplateLibraryItem).order_by(TemplateLibraryItem.created_at.desc())
    res_all = await db.execute(stmt_all)
    items = res_all.scalars().all()
    return [
        TemplateSummaryResponse(
            id=item.id,
            name=item.name,
            bank_name=normalize_bank_name(item.bank_name),
            created_at=item.created_at.isoformat() if item.created_at else "",
            fields_count=item.fields_count,
            table_groups_count=item.table_groups_count
        )
        for item in items
    ]


@router.post("/{template_id}/use", response_model=UseTemplateResponse)
async def use_template_in_new_session(
    template_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new generation session preloaded with cached template highlights and tables,
    completely skipping re-parsing of yellow highlights.
    """
    stmt = select(TemplateLibraryItem).where(TemplateLibraryItem.id == template_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Template not found")

    session_id = str(uuid.uuid4())
    session = GenerationSession(
        id=session_id,
        user_id=current_user.id if current_user else None,
        template_filename=item.name,
        template_bytes=item.template_bytes,
        status="template_loaded",
        fields_json=item.fields_json,
        table_groups_json=item.table_groups_json,
        sources_json="[]",
        results_json="[]",
        table_results_json="[]"
    )
    db.add(session)
    await db.commit()

    fields_parsed = json.loads(item.fields_json or "[]")
    tables_parsed = json.loads(item.table_groups_json or "[]")

    return UseTemplateResponse(
        session_id=session_id,
        template_filename=item.name,
        bank_name=normalize_bank_name(item.bank_name),
        fields_count=item.fields_count,
        table_groups_count=item.table_groups_count,
        fields=fields_parsed,
        table_groups=tables_parsed
    )

