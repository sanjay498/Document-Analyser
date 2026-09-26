"""
Doc Filler AI - Document History & Audit Trail API (Phase 3)
Persists and retrieves past document generations with full field breakdowns and re-download links.
"""

import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.app.db.database import get_db
from backend.app.db.models import DocumentHistoryItem, User
from backend.app.core.auth import get_current_user_optional

router = APIRouter(prefix="/api/history", tags=["history"])


class HistorySummaryResponse(BaseModel):
    id: str
    template_filename: str
    generated_at: str
    sources_summary: List[str]
    resolved_fields_count: int
    download_url: str
    client_id: Optional[str] = None


class HistoryDetailResponse(BaseModel):
    id: str
    template_filename: str
    generated_at: str
    sources: List[Dict[str, Any]]
    field_values: Dict[str, Any]
    table_records: Dict[str, Any]
    download_url: str
    client_id: Optional[str] = None


@router.get("", response_model=List[HistorySummaryResponse])
async def list_history(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DocumentHistoryItem)
    if current_user:
        stmt = stmt.where(
            (DocumentHistoryItem.user_id == current_user.id) | (DocumentHistoryItem.user_id.is_(None))
        )
    stmt = stmt.order_by(DocumentHistoryItem.generated_at.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()

    summaries = []
    for item in items:
        sources_list = json.loads(item.sources_summary_json or "[]")
        field_vals = json.loads(item.field_values_json or "{}")
        summaries.append(HistorySummaryResponse(
            id=item.id,
            template_filename=item.template_filename,
            generated_at=item.generated_at.isoformat() if item.generated_at else "",
            sources_summary=[s.get("filename", str(s)) if isinstance(s, dict) else str(s) for s in sources_list],
            resolved_fields_count=len(field_vals),
            download_url=f"/api/history/{item.id}/download",
            client_id=item.client_id
        ))

    return summaries


@router.get("/{history_id}", response_model=HistoryDetailResponse)
async def get_history_detail(
    history_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DocumentHistoryItem).where(DocumentHistoryItem.id == history_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="History record not found")

    sources = json.loads(item.sources_summary_json or "[]")
    field_vals = json.loads(item.field_values_json or "{}")
    table_recs = json.loads(item.table_records_json or "{}")

    return HistoryDetailResponse(
        id=item.id,
        template_filename=item.template_filename,
        generated_at=item.generated_at.isoformat() if item.generated_at else "",
        sources=sources if isinstance(sources, list) else [],
        field_values=field_vals,
        table_records=table_recs,
        download_url=f"/api/history/{item.id}/download",
        client_id=item.client_id
    )


@router.get("/{history_id}/download")
async def download_history_document(
    history_id: str,
    format: Optional[str] = "docx",
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DocumentHistoryItem).where(DocumentHistoryItem.id == history_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item or not item.docx_bytes:
        raise HTTPException(status_code=404, detail="Document file not found")

    fmt = (format or "docx").lower().strip()
    base_name = item.template_filename.rsplit(".", 1)[0] + "_generated"

    if fmt == "pdf":
        from backend.app.core.doc_processor import convert_docx_to_pdf_bytes
        try:
            pdf_bytes = convert_docx_to_pdf_bytes(item.docx_bytes)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{base_name}.pdf"'}
            )
        except Exception:
            return Response(
                content=item.docx_bytes,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{base_name}.docx"'}
            )
    elif fmt == "txt":
        import docx
        from io import BytesIO
        doc = docx.Document(BytesIO(item.docx_bytes))
        full_text = "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        return Response(
            content=full_text.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.txt"'}
        )
    else:
        clean_name = f"{base_name}.docx"
        return Response(
            content=item.docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{clean_name}"'}
        )


@router.delete("/{history_id}")
async def delete_history_item(
    history_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DocumentHistoryItem).where(DocumentHistoryItem.id == history_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="History record not found")

    await db.delete(item)
    await db.commit()
    return {"status": "success", "message": "History record deleted"}


@router.delete("")
async def clear_all_history(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import delete
    stmt = delete(DocumentHistoryItem)
    if current_user:
        stmt = stmt.where(DocumentHistoryItem.user_id == current_user.id)
    await db.execute(stmt)
    await db.commit()
    return {"status": "success", "message": "All history records cleared"}

