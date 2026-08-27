import os
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.document_service import document_service
from app.schemas.document import GeneratedDocumentResponse

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.get("", response_model=List[GeneratedDocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    return document_service.get_generated_documents(db)

@router.get("/{document_id}", response_model=GeneratedDocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    return document_service.get_generated_document_by_id(db, document_id)

@router.get("/{document_id}/download/{format}")
def download_document(document_id: str, format: str, db: Session = Depends(get_db)):
    doc = document_service.get_generated_document_by_id(db, document_id)
    fmt = format.lower()

    if fmt == "docx" and doc.docx_file_path and Path(doc.docx_file_path).exists():
        return FileResponse(
            path=doc.docx_file_path,
            filename=f"{doc.file_name}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    elif fmt == "pdf" and doc.pdf_file_path and Path(doc.pdf_file_path).exists():
        return FileResponse(
            path=doc.pdf_file_path,
            filename=f"{doc.file_name}.pdf",
            media_type="application/pdf"
        )

    raise HTTPException(status_code=404, detail=f"File format '{format}' not available for document.")
