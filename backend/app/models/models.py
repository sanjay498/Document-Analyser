from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Template(Base):
    __tablename__ = "templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False, default="docx") # docx, pdf
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    fields = relationship("TemplateField", back_populates="template", cascade="all, delete-orphan")
    versions = relationship("TemplateVersion", back_populates="template", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="template", cascade="all, delete-orphan")

class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    file_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("Template", back_populates="versions")

class TemplateField(Base):
    __tablename__ = "template_fields"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=False)
    field_name = Column(String(255), nullable=False) # e.g. BORROWER_NAME
    placeholder = Column(String(255), nullable=False) # e.g. {{BORROWER_NAME}}
    required = Column(Boolean, default=True)
    field_type = Column(String(50), default="text") # text, date, number, address
    description = Column(Text, nullable=True)
    page_number = Column(Integer, nullable=True)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    font_name = Column(String(100), nullable=True)
    font_size = Column(Float, nullable=True)
    alignment = Column(String(50), nullable=True)
    formatting_rules = Column(Text, nullable=True)

    template = relationship("Template", back_populates="fields")
    extracted_fields = relationship("ExtractedField", back_populates="template_field")

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=False)
    status = Column(String(50), nullable=False, default="UPLOADED") 
    # UPLOADED, OCR_PROCESSING, DOCUMENT_ANALYSIS, FIELD_MATCHING, VALIDATION, DOCUMENT_GENERATION, COMPLETED, FAILED
    error_message = Column(Text, nullable=True)
    raw_ocr_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    template = relationship("Template", back_populates="processing_jobs")
    source_documents = relationship("SourceDocument", back_populates="processing_job", cascade="all, delete-orphan")
    extracted_fields = relationship("ExtractedField", back_populates="processing_job", cascade="all, delete-orphan")
    generated_documents = relationship("GeneratedDocument", back_populates="processing_job", cascade="all, delete-orphan")

class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    processing_job_id = Column(String(36), ForeignKey("processing_jobs.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False) # pdf, docx, jpg, png
    file_size = Column(Integer, nullable=False, default=0)
    page_count = Column(Integer, nullable=True, default=1)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    processing_job = relationship("ProcessingJob", back_populates="source_documents")

class ExtractedField(Base):
    __tablename__ = "extracted_fields"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    processing_job_id = Column(String(36), ForeignKey("processing_jobs.id"), nullable=False)
    template_field_id = Column(String(36), ForeignKey("template_fields.id"), nullable=True)
    field_name = Column(String(255), nullable=False)
    value = Column(Text, nullable=True)
    source_text = Column(Text, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="MATCHED") # MATCHED, MISSING, LOW_CONFIDENCE
    is_manually_edited = Column(Boolean, default=False)
    bbox = Column(JSON, nullable=True)

    processing_job = relationship("ProcessingJob", back_populates="extracted_fields")
    template_field = relationship("TemplateField", back_populates="extracted_fields")

class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    processing_job_id = Column(String(36), ForeignKey("processing_jobs.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    docx_file_path = Column(String(500), nullable=True)
    pdf_file_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    processing_job = relationship("ProcessingJob", back_populates="generated_documents")
