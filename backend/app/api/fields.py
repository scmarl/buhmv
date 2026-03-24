from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user, require_admin
from app.models.field import CustomField, FieldPermission, FieldType
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter(prefix="/fields", tags=["fields"])


class FieldCreate(BaseModel):
    name: str
    label: str
    field_type: FieldType
    options: Optional[list[str]] = None
    is_required: bool = False
    sort_order: int = 0


class PermissionUpdate(BaseModel):
    role: str
    can_view: bool
    can_edit: bool


class FieldOut(BaseModel):
    id: int
    name: str
    label: str
    field_type: str
    options: Optional[str]
    is_required: bool
    sort_order: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[FieldOut])
def list_fields(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(CustomField).order_by(CustomField.sort_order).all()


@router.post("", response_model=FieldOut, status_code=201)
def create_field(data: FieldCreate, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    field = CustomField(
        name=data.name,
        label=data.label,
        field_type=data.field_type,
        options=json.dumps(data.options) if data.options else None,
        is_required=data.is_required,
        sort_order=data.sort_order,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.delete("/{field_id}", status_code=204)
def delete_field(field_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    field = db.query(CustomField).filter(CustomField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()


@router.put("/{field_id}/permissions")
def update_permissions(field_id: int, perms: list[PermissionUpdate], db: Session = Depends(get_db), current_user=Depends(require_admin)):
    db.query(FieldPermission).filter(FieldPermission.field_id == field_id).delete()
    for p in perms:
        db.add(FieldPermission(field_id=field_id, role=p.role, can_view=p.can_view, can_edit=p.can_edit))
    db.commit()
    return {"updated": len(perms)}
