from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import datetime
from app.db.session import get_db
from app.api.deps import get_current_user, require_office_or_above
from app.models.member import Member, MemberNote
from app.models.group import Group, GroupMembership
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
    exit_date: Optional[date] = None
    member_number: Optional[str] = None
    status: str = "active"
    fee_status: str = "paid"
    is_active: bool = True
    photo_url: Optional[str] = None


class NoteOut(BaseModel):
    id: int
    author: Optional[str]
    content: str
    created_at: Optional[str]
    class Config: from_attributes = True


class GroupShort(BaseModel):
    id: int
    name: str
    class Config: from_attributes = True


class MemberOut(MemberBase):
    id: int
    notes: list[NoteOut] = []
    groups: list[GroupShort] = []
    class Config: from_attributes = True


class MemberListOut(MemberBase):
    id: int
    class Config: from_attributes = True


class MemberPage(BaseModel):
    items: list[MemberListOut]
    total: int
    page: int
    size: int


def _enrich(member: Member, db: Session) -> dict:
    data = {c.name: getattr(member, c.name) for c in member.__table__.columns}
    data['notes'] = [{'id': n.id, 'author': n.author, 'content': n.content, 'created_at': n.created_at}
                     for n in member.notes]
    data['groups'] = [{'id': gm.group_id, 'name': gm.group.name}
                      for gm in member.group_memberships if gm.group]
    return data


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


@router.get("/{member_id}")
def get_member(member_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(Member).options(
        joinedload(Member.notes),
        joinedload(Member.group_memberships).joinedload(GroupMembership.group)
    ).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return _enrich(member, db)


@router.post("", status_code=201)
def create_member(data: MemberBase, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = Member(**data.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return _enrich(member, db)


@router.put("/{member_id}")
def update_member(member_id: int, data: MemberBase, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return _enrich(member, db)


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()


# --- Notes ---

class NoteCreate(BaseModel):
    content: str

@router.post("/{member_id}/notes", status_code=201)
def add_note(member_id: int, data: NoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    note = MemberNote(
        member_id=member_id,
        content=data.content,
        author=current_user.username,
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {'id': note.id, 'author': note.author, 'content': note.content, 'created_at': note.created_at}


@router.delete("/{member_id}/notes/{note_id}", status_code=204)
def delete_note(member_id: int, note_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    note = db.query(MemberNote).filter(MemberNote.id == note_id, MemberNote.member_id == member_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()


# --- Group memberships ---

@router.post("/{member_id}/groups/{group_id}", status_code=201)
def add_to_group(member_id: int, group_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(status_code=404, detail="Member not found")
    if not db.query(Group).filter(Group.id == group_id).first():
        raise HTTPException(status_code=404, detail="Group not found")
    existing = db.query(GroupMembership).filter_by(member_id=member_id, group_id=group_id).first()
    if not existing:
        db.add(GroupMembership(member_id=member_id, group_id=group_id))
        db.commit()
    return {"ok": True}


@router.delete("/{member_id}/groups/{group_id}", status_code=204)
def remove_from_group(member_id: int, group_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    gm = db.query(GroupMembership).filter_by(member_id=member_id, group_id=group_id).first()
    if gm:
        db.delete(gm)
        db.commit()
