from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.models import GeneratedDocument, ProcessingJob

class DocumentService:
    @staticmethod
    def get_generated_documents(db: Session) -> List[GeneratedDocument]:
        return db.query(GeneratedDocument).order_by(GeneratedDocument.created_at.desc()).all()

    @staticmethod
    def get_generated_document_by_id(db: Session, doc_id: str) -> GeneratedDocument:
        doc = db.query(GeneratedDocument).filter(GeneratedDocument.id == doc_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Generated document not found")
        return doc

document_service = DocumentService()
