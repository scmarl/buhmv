from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.list_view import ListView
from app.models.user import User
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter(prefix="/list-views", tags=["list-views"])


class ListViewIn(BaseModel):
    name: str
    columns: list[str]
    is_default: bool = False
    is_shared: bool = False


class ListViewOut(BaseModel):
    id: int
    name: str
    columns: list[str]
    is_default: bool
    is_shared: bool
    owner_id: Optional[int] = None
    class Config: from_attributes = True


def _to_out(v: ListView) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "columns": json.loads(v.columns) if v.columns else [],
        "is_default": v.is_default,
        "is_shared": v.is_shared or False,
        "owner_id": v.owner_id,
    }


@router.get("", response_model=list[ListViewOut])
def list_views(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    views = db.query(ListView).filter(
        (ListView.owner_id == current_user.id) | (ListView.is_shared == True) | (ListView.owner_id == None)
    ).order_by(ListView.name).all()
    return [_to_out(v) for v in views]


@router.post("", status_code=201)
def create_view(data: ListViewIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.is_default:
        db.query(ListView).update({"is_default": False})
    v = ListView(
        name=data.name,
        columns=json.dumps(data.columns),
        is_default=data.is_default,
        is_shared=data.is_shared,
        owner_id=current_user.id,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _to_out(v)


@router.put("/{view_id}")
def update_view(view_id: int, data: ListViewIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    v = db.query(ListView).filter(ListView.id == view_id).first()
    if not v:
        raise HTTPException(404, "Not found")
    # Only owner can edit
    if v.owner_id and v.owner_id != current_user.id:
        raise HTTPException(403, "Not allowed")
    if data.is_default:
        db.query(ListView).update({"is_default": False})
    v.name = data.name
    v.columns = json.dumps(data.columns)
    v.is_default = data.is_default
    v.is_shared = data.is_shared
    db.commit()
    db.refresh(v)
    return _to_out(v)


@router.delete("/{view_id}", status_code=204)
def delete_view(view_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    v = db.query(ListView).filter(ListView.id == view_id).first()
    if not v:
        raise HTTPException(404, "Not found")
    if v.owner_id and v.owner_id != current_user.id:
        raise HTTPException(403, "Not allowed")
    db.delete(v)
    db.commit()
