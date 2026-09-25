"""
Immutable Audit Logging Service
Tracks all sensitive administrative actions (login, balance adjustments, configuration updates, user state changes).
"""

import uuid
import json
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.db.models import AuditLog


class AuditService:
    @staticmethod
    async def log_action(
        db: AsyncSession,
        admin_id: Optional[str],
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        # Sanitize metadata: never store passwords, secrets, or raw keys
        safe_meta = {}
        if metadata:
            for k, v in metadata.items():
                if any(sec in k.lower() for sec in ["password", "token", "secret", "key", "authorization"]):
                    continue
                safe_meta[k] = v

        entry = AuditLog(
            id=str(uuid.uuid4()),
            admin_id=admin_id,
            action=action.upper().strip(),
            target_type=target_type.upper().strip() if target_type else None,
            target_id=str(target_id) if target_id else None,
            metadata_json=json.dumps(safe_meta) if safe_meta else None,
            ip_address=ip_address
        )
        db.add(entry)
        await db.flush()
        return entry


audit_service = AuditService()
