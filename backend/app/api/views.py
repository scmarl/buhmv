from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.saved_view import SavedView
from app.models.user import User
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter(prefix="/views", tags=["views"])


class ViewCreate(BaseModel):
    name: str
    query_json: str
    is_shared: bool = False
    shared_roles: Optional[list[str]] = None


class ViewOut(BaseModel):
    id: int
    name: str
    query_json: str
    owner_id: int
    is_shared: bool
    shared_roles: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=list[ViewOut])
def list_views(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(SavedView).filter(
        (SavedView.owner_id == current_user.id) | (SavedView.is_shared == True)
    ).all()


@router.post("", response_model=ViewOut, status_code=201)
def create_view(data: ViewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    view = SavedView(
        name=data.name,
        query_json=data.query_json,
        owner_id=current_user.id,
        is_shared=data.is_shared,
        shared_roles=json.dumps(data.shared_roles) if data.shared_roles else None,
    )
    db.add(view)
    db.commit()
    db.refresh(view)
    return view


@router.delete("/{view_id}", status_code=204)
def delete_view(view_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    view = db.query(SavedView).filter(SavedView.id == view_id, SavedView.owner_id == current_user.id).first()
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    db.delete(view)
    db.commit()
