from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.template_service import template_service
from app.schemas.template import (
    TemplateResponse, TemplateFieldResponse, TemplateFieldCreate, TemplateFieldUpdate
)

router = APIRouter(prefix="/templates", tags=["Templates"])

@router.post("/upload", response_model=TemplateResponse)
def upload_template(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    return template_service.create_template_from_file(db, name, description, file)

@router.get("", response_model=List[TemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    return template_service.get_templates(db)

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: str, db: Session = Depends(get_db)):
    return template_service.get_template_by_id(db, template_id)

@router.delete("/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db)):
    template_service.delete_template(db, template_id)
    return {"message": "Template deleted successfully"}

@router.get("/{template_id}/fields", response_model=List[TemplateFieldResponse])
def get_template_fields(template_id: str, db: Session = Depends(get_db)):
    template = template_service.get_template_by_id(db, template_id)
    return template.fields

@router.post("/{template_id}/fields", response_model=TemplateFieldResponse)
def add_template_field(
    template_id: str,
    field_data: TemplateFieldCreate,
    db: Session = Depends(get_db)
):
    return template_service.add_template_field(db, template_id, field_data)

@router.put("/fields/{field_id}", response_model=TemplateFieldResponse)
def update_template_field(
    field_id: str,
    update_data: TemplateFieldUpdate,
    db: Session = Depends(get_db)
):
    return template_service.update_template_field(db, field_id, update_data)

@router.delete("/fields/{field_id}")
def delete_template_field(field_id: str, db: Session = Depends(get_db)):
    template_service.delete_template_field(db, field_id)
    return {"message": "Field deleted successfully"}
