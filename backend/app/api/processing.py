from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.processing_service import processing_service
from app.schemas.processing import (
    ProcessingJobResponse, ExtractedFieldResponse, ExtractedFieldUpdate, GenerateDocumentRequest
)
from app.schemas.document import GeneratedDocumentResponse

router = APIRouter(prefix="/process", tags=["Processing"])

@router.post("/start", response_model=ProcessingJobResponse)
def start_processing_job(
    template_id: str = Form(...),
    source_files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    return processing_service.create_processing_job(db, template_id, source_files)

@router.post("/{job_id}/analyze", response_model=ProcessingJobResponse)
def analyze_job(job_id: str, db: Session = Depends(get_db)):
    return processing_service.run_analysis_pipeline(db, job_id)

@router.get("/{job_id}", response_model=ProcessingJobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(processing_service.ProcessingJob).filter(processing_service.ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Processing job not found")
    return job

@router.get("/{job_id}/fields", response_model=List[ExtractedFieldResponse])
def get_extracted_fields(job_id: str, db: Session = Depends(get_db)):
    job = db.query(processing_service.ProcessingJob).filter(processing_service.ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Processing job not found")
    return job.extracted_fields

@router.put("/fields/{field_id}", response_model=ExtractedFieldResponse)
def update_extracted_field(
    field_id: str,
    payload: ExtractedFieldUpdate,
    db: Session = Depends(get_db)
):
    return processing_service.update_extracted_field(db, field_id, payload.value or "")

@router.post("/{job_id}/generate", response_model=GeneratedDocumentResponse)
def generate_document(
    job_id: str,
    payload: GenerateDocumentRequest,
    db: Session = Depends(get_db)
):
    return processing_service.generate_final_documents(db, job_id, payload.output_formats)
