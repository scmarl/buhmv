from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user, require_office_or_above
from app.models.group import Group
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None


class GroupOut(GroupBase):
    id: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Group).order_by(Group.name).all()


@router.post("", response_model=GroupOut, status_code=201)
def create_group(data: GroupBase, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    group = Group(**data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.put("/{group_id}", response_model=GroupOut)
def update_group(group_id: int, data: GroupBase, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    for k, v in data.model_dump().items():
        setattr(group, k, v)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()
