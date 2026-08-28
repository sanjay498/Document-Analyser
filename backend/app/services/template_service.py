import os
from pathlib import Path
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException

from app.models.models import Template, TemplateField, TemplateVersion
from app.document_generation.docx_engine import docx_engine
from app.document_generation.pdf_template_engine import pdf_template_engine
from app.utils.storage import storage_service
from app.schemas.template import TemplateFieldCreate, TemplateFieldUpdate
from app.utils.logger import logger

class TemplateService:
    @staticmethod
    def create_template_from_file(db: Session, name: str, description: Optional[str], file: UploadFile) -> Template:
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ['.docx', '.pdf']:
            raise HTTPException(status_code=400, detail="Only .docx and .pdf templates are supported.")

        content = file.file.read()
        file_path = storage_service.save_file(content, "templates", file.filename)
        clean_file_type = file_ext.lstrip(".")

        template = Template(
            name=name,
            description=description,
            file_name=file.filename,
            file_path=file_path,
            file_type=clean_file_type
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        # Initial Template Version
        version = TemplateVersion(
            template_id=template.id,
            version_number=1,
            file_path=file_path
        )
        db.add(version)

        # Auto-extract placeholders
        try:
            if clean_file_type == "docx":
                placeholders = docx_engine.extract_placeholders(file_path)
                for field_name, ph in placeholders:
                    field = TemplateField(
                        template_id=template.id,
                        field_name=field_name,
                        placeholder=ph,
                        required=True,
                        field_type="text"
                    )
                    db.add(field)
            elif clean_file_type == "pdf":
                pdf_placeholders = pdf_template_engine.extract_placeholders(file_path)
                for ph_info in pdf_placeholders:
                    field = TemplateField(
                        template_id=template.id,
                        field_name=ph_info["field_name"],
                        placeholder=ph_info["placeholder"],
                        required=True,
                        field_type="text",
                        page_number=ph_info.get("page_number"),
                        position_x=ph_info.get("position_x"),
                        position_y=ph_info.get("position_y"),
                        width=ph_info.get("width"),
                        height=ph_info.get("height")
                    )
                    db.add(field)
            db.commit()
        except Exception as e:
            logger.error(f"Error extracting placeholders from template: {e}")

        db.refresh(template)
        return template

    @staticmethod
    def get_templates(db: Session) -> List[Template]:
        return db.query(Template).order_by(Template.created_at.desc()).all()

    @staticmethod
    def get_template_by_id(db: Session, template_id: str) -> Template:
        template = db.query(Template).filter(Template.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template

    @staticmethod
    def delete_template(db: Session, template_id: str) -> bool:
        template = TemplateService.get_template_by_id(db, template_id)
        
        # Cleanup associated source files and generated document files from disk
        for job in template.processing_jobs:
            for source_doc in job.source_documents:
                storage_service.delete_file(source_doc.file_path)
            for gen_doc in job.generated_documents:
                if gen_doc.docx_file_path:
                    storage_service.delete_file(gen_doc.docx_file_path)
                if gen_doc.pdf_file_path:
                    storage_service.delete_file(gen_doc.pdf_file_path)

        storage_service.delete_file(template.file_path)
        db.delete(template)
        db.commit()
        return True

    @staticmethod
    def add_template_field(db: Session, template_id: str, field_data: TemplateFieldCreate) -> TemplateField:
        TemplateService.get_template_by_id(db, template_id)
        field = TemplateField(
            template_id=template_id,
            field_name=field_data.field_name,
            placeholder=field_data.placeholder,
            required=field_data.required,
            field_type=field_data.field_type,
            description=field_data.description
        )
        db.add(field)
        db.commit()
        db.refresh(field)
        return field

    @staticmethod
    def update_template_field(db: Session, field_id: str, update_data: TemplateFieldUpdate) -> TemplateField:
        field = db.query(TemplateField).filter(TemplateField.id == field_id).first()
        if not field:
            raise HTTPException(status_code=404, detail="Template field not found")

        for key, val in update_data.model_dump(exclude_unset=True).items():
            setattr(field, key, val)

        db.commit()
        db.refresh(field)
        return field

    @staticmethod
    def delete_template_field(db: Session, field_id: str) -> bool:
        field = db.query(TemplateField).filter(TemplateField.id == field_id).first()
        if not field:
            raise HTTPException(status_code=404, detail="Template field not found")
        db.delete(field)
        db.commit()
        return True

template_service = TemplateService()
