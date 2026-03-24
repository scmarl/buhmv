from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user, require_admin
from app.models.field import CustomField, FieldType
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter(prefix="/fields", tags=["fields"])


class FieldCreate(BaseModel):
    name: str
    label: str
    field_type: FieldType
    category: str = "Allgemein"
    options: Optional[list[str]] = None
    default_value: Optional[str] = None
    is_required: bool = False
    sort_order: int = 0


class FieldUpdate(BaseModel):
    label: str
    field_type: Optional[FieldType] = None
    category: str = "Allgemein"
    options: Optional[list[str]] = None
    default_value: Optional[str] = None
    is_required: bool = False
    sort_order: int = 0


class FieldOut(BaseModel):
    id: int
    name: str
    label: str
    field_type: str
    category: Optional[str]
    options: Optional[str]
    default_value: Optional[str]
    is_required: bool
    sort_order: int
    is_system: bool = False
    class Config: from_attributes = True


@router.get("", response_model=list[FieldOut])
def list_fields(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(CustomField).order_by(CustomField.category, CustomField.sort_order, CustomField.label).all()


@router.post("", response_model=FieldOut, status_code=201)
def create_field(data: FieldCreate, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    if db.query(CustomField).filter(CustomField.name == data.name).first():
        raise HTTPException(status_code=400, detail="Field name already exists")
    f = CustomField(
        name=data.name, label=data.label, field_type=data.field_type,
        category=data.category,
        options=json.dumps(data.options) if data.options else None,
        default_value=data.default_value,
        is_required=data.is_required, sort_order=data.sort_order,
        is_system=False,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.put("/{field_id}", response_model=FieldOut)
def update_field(field_id: int, data: FieldUpdate, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    f = db.query(CustomField).filter(CustomField.id == field_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Field not found")
    f.label = data.label
    f.category = data.category
    f.options = json.dumps(data.options) if data.options else None
    f.default_value = data.default_value
    f.is_required = data.is_required
    f.sort_order = data.sort_order
    if not f.is_system and data.field_type is not None:
        f.field_type = data.field_type
    db.commit()
    db.refresh(f)
    return f


@router.delete("/{field_id}", status_code=204)
def delete_field(field_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    f = db.query(CustomField).filter(CustomField.id == field_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Field not found")
    if f.is_system:
        raise HTTPException(status_code=403, detail="System fields cannot be deleted")
    db.delete(f)
    db.commit()


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = db.query(CustomField.category).distinct().all()
    return sorted(set(r[0] or "Allgemein" for r in rows))
