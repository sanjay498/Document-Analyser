from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, Template, ProcessingJob, GeneratedDocument
from app.schemas.admin import UserDetailResponse, SystemAdminStatsResponse

router = APIRouter(prefix="/admin", tags=["Admin & User Management"])

@router.get("/users", response_model=List[UserDetailResponse])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    
    template_count = db.query(Template).count()
    job_count = db.query(ProcessingJob).count()

    results = []
    for u in users:
        u_dict = UserDetailResponse.model_validate(u).model_dump()
        u_dict["template_count"] = template_count
        u_dict["processing_job_count"] = job_count
        results.append(UserDetailResponse(**u_dict))

    return results

@router.get("/stats", response_model=SystemAdminStatsResponse)
def get_system_stats(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_templates = db.query(Template).count()
    total_jobs = db.query(ProcessingJob).count()
    total_docs = db.query(GeneratedDocument).count()
    
    users_list = list_users(db)

    return SystemAdminStatsResponse(
        total_users=total_users,
        total_templates=total_templates,
        total_processed_jobs=total_jobs,
        total_generated_documents=total_docs,
        users=users_list
    )
