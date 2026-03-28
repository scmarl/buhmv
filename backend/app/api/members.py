from app.models.audit_log import AuditLog
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import datetime
from app.db.session import get_db
from app.api.deps import get_current_user, require_office_or_above
from app.models.member import Member, MemberNote
from app.api.group_access import apply_group_filter, get_allowed_group_ids
from app.models.group import Group, GroupMembership
from app.models.user import User
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/members", tags=["members"])

FIELD_LABELS = {
    "first_name": "Vorname", "last_name": "Nachname", "email": "E-Mail",
    "phone": "Telefon", "mobile": "Mobil", "street": "Strasse",
    "zip_code": "PLZ", "city": "Ort", "birthdate": "Geburtsdatum",
    "gender": "Geschlecht", "entry_date": "Eintrittsdatum",
    "exit_date": "Austrittsdatum", "death_date": "Verstorben am",
    "member_number": "Mitgliedsnummer", "is_active": "Aktiv",
    "bank_name": "Bankname", "iban": "IBAN", "bic": "BIC",
    "sepa_ls_vfs": "SEPA LS VfS", "sepa_ls_ahv": "SEPA LS AHV",
}

def _fv(v) -> str:
    if v is None or v == "": return ""
    if v is True:  return "Ja"
    if v is False: return "Nein"
    return str(v)

def _audit_m(db, username, action, name, mid, detail=""):
    db.add(AuditLog(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        username=username, category="members", action=action,
        target=f"{name}||{mid}", detail=detail,
    ))


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
    death_date: Optional[date] = None
    member_number: Optional[str] = None
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
    age: Optional[int] = None
    notes: list[NoteOut] = []
    groups: list[GroupShort] = []
    class Config: from_attributes = True


class MemberListOut(MemberBase):
    id: int
    age: Optional[int] = None
    groups: list[GroupShort] = []
    class Config: from_attributes = True


class MemberPage(BaseModel):
    items: list[MemberListOut]
    total: int
    page: int
    size: int


def _enrich(member: Member, db: Session) -> dict:
    data = {c.name: getattr(member, c.name) for c in member.__table__.columns}
    data['age'] = member.age
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
    sort_by: Optional[str] = "last_name",
    sort_dir: str = "asc",
    group_id: Optional[int] = None,
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
    if group_id is not None:
        q = q.join(Member.group_memberships).filter(GroupMembership.group_id == group_id)
    else:
        q, _ = apply_group_filter(q, current_user.role, db)
    total = q.count()
    SORTABLE = {c.name for c in Member.__table__.columns} - {"photo_url"}
    sort_col = getattr(Member, sort_by, Member.last_name) if sort_by in SORTABLE else Member.last_name
    order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()
    from sqlalchemy.orm import joinedload
    rows = q.options(joinedload(Member.group_memberships).joinedload(GroupMembership.group)).order_by(order).offset((page - 1) * size).limit(size).all()
    items = [
        {
            **{c.name: getattr(m, c.name) for c in m.__table__.columns},
            'age': m.age,
            'groups': [{'id': gm.group_id, 'name': gm.group.name} for gm in m.group_memberships if gm.group],
        }
        for m in rows
    ]
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/{member_id}")
def get_member(member_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(Member).options(
        joinedload(Member.notes),
        joinedload(Member.group_memberships).joinedload(GroupMembership.group)
    ).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    allowed = get_allowed_group_ids(current_user.role, db)
    if allowed is not None:
        member_group_ids = {gm.group_id for gm in member.group_memberships}
        if not member_group_ids & allowed:
            raise HTTPException(status_code=403, detail="Kein Zugriff auf dieses Mitglied")
    return _enrich(member, db)


@router.post("", status_code=201)
def create_member(data: MemberBase, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = Member(**data.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    name = f"{member.first_name or ''} {member.last_name or ''}".strip()
    _audit_m(db, current_user.username, "Mitglied erstellt", name, member.id)
    db.commit()
    return _enrich(member, db)


@router.put("/{member_id}")
def update_member(member_id: int, data: MemberBase, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    name = f"{member.first_name or ''} {member.last_name or ''}".strip()
    changes = []
    for k, v in data.model_dump(exclude_unset=True).items():
        old = getattr(member, k, None)
        if _fv(old) != _fv(v):
            label = FIELD_LABELS.get(k, k)
            changes.append(json.dumps({"field": label, "old": _fv(old), "new": _fv(v), "mid": member_id}, ensure_ascii=False))
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for detail in changes:
        db.add(AuditLog(timestamp=ts, username=current_user.username, category="members",
                        action="Feld geaendert", target=f"{name}||{member_id}", detail=detail))
    if changes:
        db.commit()
    return _enrich(member, db)


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    name = f"{member.first_name or ''} {member.last_name or ''}".strip()
    _audit_m(db, current_user.username, "Mitglied geloescht", name, member_id)
    db.commit()
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
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    existing = db.query(GroupMembership).filter_by(member_id=member_id, group_id=group_id).first()
    if not existing:
        db.add(GroupMembership(member_id=member_id, group_id=group_id))
        name = f"{member.first_name or ''} {member.last_name or ''}".strip()
        _audit_m(db, current_user.username, "Gruppe hinzugefuegt", name, member_id,
                 json.dumps({"group": group.name, "mid": member_id}, ensure_ascii=False))
        db.commit()
    return {"ok": True}


@router.delete("/{member_id}/groups/{group_id}", status_code=204)
def remove_from_group(member_id: int, group_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_office_or_above)):
    member = db.query(Member).filter(Member.id == member_id).first()
    group  = db.query(Group).filter(Group.id == group_id).first()
    gm = db.query(GroupMembership).filter_by(member_id=member_id, group_id=group_id).first()
    if gm:
        db.delete(gm)
        if member and group:
            name = f"{member.first_name or ''} {member.last_name or ''}".strip()
            _audit_m(db, current_user.username, "Gruppe entfernt", name, member_id,
                     json.dumps({"group": group.name, "mid": member_id}, ensure_ascii=False))
        db.commit()
