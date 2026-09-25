"""
Doc Filler AI - Batch Document Generation API (Phase 3)
Allows 1 template to be executed against MULTIPLE independent source document packages
in background jobs, with progress polling and ZIP export.
"""

import io
import zipfile
import json
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.app.db.database import get_db, async_session_factory
from backend.app.db.models import BatchJob, BatchJobItem, User
from backend.app.core.auth import get_current_user_optional
from backend.app.core.doc_processor import (
    detect_yellow_highlights,
    apply_field_values_to_template,
    detect_template_universal,
    apply_field_values_universal,
    HighlightedField,
    DynamicTableGroup
)
from backend.app.core.source_extractor import extract_text_from_source, ExtractedSourceDocument
from backend.app.core.ai_extractor import extract_fields_with_ai

router = APIRouter(prefix="/api/batch", tags=["batch"])


class BatchItemStatusResponse(BaseModel):
    id: str
    item_index: int
    item_name: str
    status: str
    error_message: Optional[str] = None


class BatchJobStatusResponse(BaseModel):
    id: str
    template_filename: str
    status: str
    total_items: int
    completed_items: int
    progress_percentage: int
    created_at: str
    items: List[BatchItemStatusResponse]
    download_zip_url: Optional[str] = None


async def process_batch_job_background(batch_id: str, api_key: Optional[str] = None):
    """
    Background worker that iterates through batch items, extracts values, and generates DOCX outputs.
    """
    async with async_session_factory() as db:
        stmt = select(BatchJob).where(BatchJob.id == batch_id)
        res = await db.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            return

        job.status = "processing"
        await db.commit()

        template_bytes = job.template_bytes
        raw_fields = json.loads(job.fields_json or "[]")
        raw_tables = json.loads(job.table_groups_json or "[]")
        fields = [HighlightedField(**f) for f in raw_fields]
        table_groups = [DynamicTableGroup(**tg) for tg in raw_tables]

        stmt_items = select(BatchJobItem).where(BatchJobItem.batch_id == batch_id).order_by(BatchJobItem.item_index)
        res_items = await db.execute(stmt_items)
        items = res_items.scalars().all()

        for item in items:
            item.status = "processing"
            await db.commit()

            try:
                raw_sources = json.loads(item.sources_json or "[]")
                source_docs = [ExtractedSourceDocument(**s) for s in raw_sources]

                # Run AI extraction
                extraction_out = await extract_fields_with_ai(
                    fields=fields,
                    table_groups=table_groups,
                    source_docs=source_docs,
                    api_key=api_key
                )

                # Prepare field values (default to extracted or original)
                field_values: Dict[str, Optional[str]] = {}
                for f_res in extraction_out.fields:
                    if f_res.status == "extracted" and f_res.value:
                        field_values[f_res.field_id] = f_res.value
                    elif f_res.status == "conflict" and f_res.conflicts:
                        # For batch auto-run: take highest confidence / first option if non-interactive
                        field_values[f_res.field_id] = f_res.conflicts[0].value
                    else:
                        field_values[f_res.field_id] = None

                # Table records
                table_records: Dict[str, List[Dict[str, Any]]] = {}
                for tr in extraction_out.table_groups:
                    table_records[tr.group_id] = tr.records

                # Generate output document
                output_bio, content_type = apply_field_values_universal(
                    template_source=template_bytes,
                    filename=job.template_filename,
                    fields=fields,
                    field_values=field_values,
                    table_group_records=table_records,
                    clear_highlight=True
                )

                item.output_docx_bytes = output_bio.getvalue()
                item.results_json = json.dumps([r.model_dump() for r in extraction_out.fields])
                item.status = "completed"
                job.completed_items += 1

            except Exception as e:
                item.status = "failed"
                item.error_message = str(e)
                job.completed_items += 1

            await db.commit()

        job.status = "completed"
        await db.commit()


@router.post("", response_model=BatchJobStatusResponse)
async def create_batch_job(
    background_tasks: BackgroundTasks,
    template_file: UploadFile = File(...),
    # Batch items payload: JSON string array of { item_name: str, source_filenames: [str] } or uploaded files
    items_json: str = Form(...),
    files: List[UploadFile] = File(...),
    api_key: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new batch document generation job (.docx, .pptx, or .pdf).
    """
    allowed_exts = (".docx", ".pptx", ".pdf")
    if not any(template_file.filename.lower().endswith(ext) for ext in allowed_exts):
        raise HTTPException(status_code=400, detail="Only .docx, .pptx, and .pdf template files are supported.")

    template_bytes = await template_file.read()
    doc, fields, table_groups = detect_template_universal(template_bytes, template_file.filename)

    # Read uploaded files map
    files_map = {}
    for f in files:
        f_bytes = await f.read()
        extracted = extract_text_from_source(f_bytes, f.filename)
        files_map[f.filename] = extracted

    # Parse items configuration
    try:
        parsed_items_spec = json.loads(items_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid items_json format.")

    batch_id = str(uuid.uuid4())
    batch_job = BatchJob(
        id=batch_id,
        user_id=current_user.id if current_user else None,
        template_filename=template_file.filename,
        template_bytes=template_bytes,
        fields_json=json.dumps([f.model_dump() for f in fields]),
        table_groups_json=json.dumps([tg.model_dump() for tg in table_groups]),
        status="pending",
        total_items=len(parsed_items_spec),
        completed_items=0
    )
    db.add(batch_job)

    created_item_models = []
    for idx, spec in enumerate(parsed_items_spec):
        item_name = spec.get("item_name", f"Item {idx + 1}")
        assigned_filenames = spec.get("source_filenames", [])
        
        # Collect source documents assigned to this item
        item_sources = []
        for fn in assigned_filenames:
            if fn in files_map:
                item_sources.append(files_map[fn].model_dump())

        # If none explicitly assigned, assign all uploaded files as fallback
        if not item_sources:
            item_sources = [s.model_dump() for s in files_map.values()]

        item_id = str(uuid.uuid4())
        job_item = BatchJobItem(
            id=item_id,
            batch_id=batch_id,
            item_index=idx,
            item_name=item_name,
            sources_json=json.dumps(item_sources),
            status="pending"
        )
        db.add(job_item)
        created_item_models.append(job_item)

    await db.commit()

    # Enqueue background execution
    background_tasks.add_task(process_batch_job_background, batch_id, api_key)

    return BatchJobStatusResponse(
        id=batch_id,
        template_filename=template_file.filename,
        status="pending",
        total_items=len(parsed_items_spec),
        completed_items=0,
        progress_percentage=0,
        created_at=batch_job.created_at.isoformat() if batch_job.created_at else "",
        items=[
            BatchItemStatusResponse(
                id=item.id,
                item_index=item.item_index,
                item_name=item.item_name,
                status=item.status
            )
            for item in created_item_models
        ],
        download_zip_url=None
    )


@router.get("/{batch_id}/status", response_model=BatchJobStatusResponse)
async def get_batch_status(
    batch_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(BatchJob).where(BatchJob.id == batch_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    stmt_items = select(BatchJobItem).where(BatchJobItem.batch_id == batch_id).order_by(BatchJobItem.item_index)
    res_items = await db.execute(stmt_items)
    items = res_items.scalars().all()

    progress = int((job.completed_items / max(1, job.total_items)) * 100)
    zip_url = f"/api/batch/{batch_id}/download-zip" if job.status == "completed" else None

    return BatchJobStatusResponse(
        id=job.id,
        template_filename=job.template_filename,
        status=job.status,
        total_items=job.total_items,
        completed_items=job.completed_items,
        progress_percentage=progress,
        created_at=job.created_at.isoformat() if job.created_at else "",
        items=[
            BatchItemStatusResponse(
                id=item.id,
                item_index=item.item_index,
                item_name=item.item_name,
                status=item.status,
                error_message=item.error_message
            )
            for item in items
        ],
        download_zip_url=zip_url
    )


@router.get("/{batch_id}/download-zip")
async def download_batch_zip(
    batch_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(BatchJob).where(BatchJob.id == batch_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    stmt_items = select(BatchJobItem).where(BatchJobItem.batch_id == batch_id).order_by(BatchJobItem.item_index)
    res_items = await db.execute(stmt_items)
    items = res_items.scalars().all()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, item in enumerate(items):
            if item.output_docx_bytes:
                clean_name = f"{item.item_name.replace(' ', '_')}_{job.template_filename}"
                if not clean_name.endswith(".docx"):
                    clean_name += ".docx"
                zf.writestr(clean_name, item.output_docx_bytes)

    zip_buffer.seek(0)
    zip_filename = f"Batch_{batch_id[:8]}_Generated_Documents.zip"

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'}
    )
