from pathlib import Path
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException

from app.models.models import ProcessingJob, SourceDocument, ExtractedField, GeneratedDocument, Template
from app.services.template_service import template_service
from app.ocr.extractor import document_extractor
from app.ocr.layout import DocumentContext
from app.ai.factory import ai_factory
from app.document_generation.docx_engine import docx_engine
from app.document_generation.pdf_engine import pdf_engine
from app.document_generation.pdf_template_engine import pdf_template_engine
from app.utils.storage import storage_service
from app.utils.logger import logger

class ProcessingService:
    @staticmethod
    def create_processing_job(db: Session, template_id: str, source_files: List[UploadFile]) -> ProcessingJob:
        template = template_service.get_template_by_id(db, template_id)

        job = ProcessingJob(
            template_id=template.id,
            status="UPLOADED"
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        for file in source_files:
            content = file.file.read()
            ext = Path(file.filename).suffix.lower().lstrip(".")
            saved_path = storage_service.save_file(content, "sources", file.filename)

            source_doc = SourceDocument(
                processing_job_id=job.id,
                file_name=file.filename,
                file_path=saved_path,
                file_type=ext,
                file_size=len(content)
            )
            db.add(source_doc)

        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def run_analysis_pipeline(db: Session, job_id: str) -> ProcessingJob:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Processing job not found")

        try:
            # Step 1: OCR / Text Extraction
            job.status = "OCR_PROCESSING"
            db.commit()

            contexts: List[DocumentContext] = []
            for src in job.source_documents:
                ctx = document_extractor.extract(src.file_path)
                contexts.append(ctx)

            # Step 2: Document Analysis & Field Matching
            job.status = "DOCUMENT_ANALYSIS"
            db.commit()

            template_fields = job.template.fields
            ai_provider = ai_factory.get_provider()

            job.status = "FIELD_MATCHING"
            db.commit()

            mapping_result = ai_provider.map_fields(template_fields, contexts)

            # Step 3: Store Extracted Fields
            db.query(ExtractedField).filter(ExtractedField.processing_job_id == job.id).delete()

            tf_map = {tf.field_name: tf for tf in template_fields}

            for item in mapping_result.fields:
                tf = tf_map.get(item.field_name)
                
                status_str = "MATCHED"
                if not item.value:
                    status_str = "MISSING"
                elif item.confidence < 0.70:
                    status_str = "LOW_CONFIDENCE"

                extracted = ExtractedField(
                    processing_job_id=job.id,
                    template_field_id=tf.id if tf else None,
                    field_name=item.field_name,
                    value=item.value,
                    source_text=item.source_text,
                    confidence=item.confidence,
                    status=status_str
                )
                db.add(extracted)

            job.status = "VALIDATION"
            db.commit()
            db.refresh(job)
            return job

        except Exception as e:
            logger.error(f"Error in processing pipeline for job {job_id}: {e}")
            job.status = "FAILED"
            job.error_message = str(e)
            db.commit()
            raise HTTPException(status_code=500, detail=f"Processing job failed: {str(e)}")

    @staticmethod
    def update_extracted_field(db: Session, extracted_field_id: str, new_value: str) -> ExtractedField:
        field = db.query(ExtractedField).filter(ExtractedField.id == extracted_field_id).first()
        if not field:
            raise HTTPException(status_code=404, detail="Extracted field not found")

        field.value = new_value
        field.is_manually_edited = True
        field.status = "MATCHED" if new_value and new_value.strip() else "MISSING"
        db.commit()
        db.refresh(field)
        return field

    @staticmethod
    def generate_final_documents(db: Session, job_id: str, output_formats: List[str] = None) -> GeneratedDocument:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Processing job not found")

        formats = output_formats or ["docx", "pdf"]
        job.status = "DOCUMENT_GENERATION"
        db.commit()

        # Gather dynamic field values
        field_values: Dict[str, str] = {}
        for ef in job.extracted_fields:
            field_values[ef.field_name] = ef.value or ""

        template = job.template
        clean_template_name = Path(template.file_name).stem
        base_filename = f"{clean_template_name}_generated_{job.id[:8]}"

        docx_path = None
        pdf_path = None

        try:
            if template.file_type == "pdf":
                target_pdf_name = f"{base_filename}.pdf"
                output_pdf_path = storage_service.get_file_path("generated", target_pdf_name)
                pdf_path = pdf_template_engine.generate_document_from_pdf(
                    template.file_path,
                    str(output_pdf_path),
                    field_values
                )
            else:
                # 1. Generate DOCX
                target_docx_name = f"{base_filename}.docx"
                output_docx_path = storage_service.get_file_path("generated", target_docx_name)
                docx_path = docx_engine.generate_document(
                    template.file_path,
                    str(output_docx_path),
                    field_values
                )

                # 2. Generate PDF if requested
                if "pdf" in formats:
                    target_pdf_name = f"{base_filename}.pdf"
                    output_pdf_path = storage_service.get_file_path("generated", target_pdf_name)
                    pdf_path = pdf_engine.convert_docx_to_pdf(docx_path, str(output_pdf_path))

            gen_doc = GeneratedDocument(
                processing_job_id=job.id,
                file_name=base_filename,
                docx_file_path=docx_path,
                pdf_file_path=pdf_path
            )
            db.add(gen_doc)

            job.status = "COMPLETED"
            db.commit()
            db.refresh(gen_doc)
            return gen_doc

        except Exception as e:
            logger.error(f"Failed to generate documents for job {job_id}: {e}")
            job.status = "FAILED"
            job.error_message = str(e)
            db.commit()
            raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")

processing_service = ProcessingService()
