from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.api.deps import get_current_user, require_office_or_above
from app.models.member import Member
from app.models.user import User
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/members", tags=["members"])


class MemberBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    street: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    birthdate: Optional[date] = None
    gender: Optional[str] = None
    entry_date: Optional[date] = None
    member_number: Optional[str] = None
    status: str = "active"
    fee_status: str = "paid"


class MemberCreate(MemberBase):
    pass


class MemberOut(MemberBase):
    id: int
    is_active: bool
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


class MemberPage(BaseModel):
    items: list[MemberOut]
    total: int
    page: int
    size: int


@router.get("", response_model=MemberPage)
def list_members(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Member)
    if active_only:
        q = q.filter(Member.is_active == True)
    if search:
        q = q.filter(
            (Member.first_name.ilike(f"%{search}%")) |
            (Member.last_name.ilike(f"%{search}%")) |
            (Member.email.ilike(f"%{search}%"))
        )
    total = q.count()
    items = q.order_by(Member.last_name).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/{member_id}", response_model=MemberOut)
def get_member(member_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.post("", response_model=MemberOut, status_code=201)
def create_member(data: MemberCreate, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = Member(**data.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/{member_id}", response_model=MemberOut)
def update_member(member_id: int, data: MemberCreate, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
