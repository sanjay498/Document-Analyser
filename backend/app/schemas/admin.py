from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.auth import UserResponse

class UserDetailResponse(UserResponse):
    template_count: int = 0
    processing_job_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class SystemAdminStatsResponse(BaseModel):
    total_users: int
    total_templates: int
    total_processed_jobs: int
    total_generated_documents: int
    users: List[UserDetailResponse]
