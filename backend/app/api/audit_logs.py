from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.db.session import get_db
from app.api.deps import get_current_user, require_office_or_above, require_admin
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

class LogOut(BaseModel):
    id: int
    timestamp: str
    username: str
    category: str
    action: str
    target: str
    detail: str
    class Config: from_attributes = True

@router.get("", response_model=list[LogOut])
def list_logs(
    days: int = Query(10, ge=1, le=365),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_office_or_above),
):
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    q = db.query(AuditLog).filter(AuditLog.timestamp >= cutoff)
    if category:
        q = q.filter(AuditLog.category == category)
    return q.order_by(AuditLog.timestamp.desc()).limit(1000).all()

@router.delete("", status_code=204)
def clear_logs(
    db: Session = Depends(get_db),
    user = Depends(require_admin),
):
    db.query(AuditLog).delete()
    db.commit()
