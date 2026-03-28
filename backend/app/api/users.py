from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.api.deps import require_admin, get_current_user
from app.models.user import User
from app.models.role_permission import RoleDefinition
from app.core.security import get_password_hash
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "member"
    is_active: bool = True
    member_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: str
    email: str
    role: str
    is_active: bool
    member_id: Optional[int] = None
    password: Optional[str] = None   # only set to change password


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    member_id: Optional[int]
    failed_logins: int = 0
    is_locked: bool = False
    class Config: from_attributes = True


def _guard_last_admin(db: Session, user: User):
    """Block actions that would leave no active admin."""
    if user.role == "admin" and user.is_active:
        count = db.query(User).filter(User.role == "admin", User.is_active == True, User.id != user.id).count()
        if count == 0:
            raise HTTPException(400, "Der letzte aktive Administrator kann nicht entfernt werden.")


def _to_out(u: User) -> dict:
    now = datetime.utcnow()
    return {
        "id": u.id, "username": u.username, "email": u.email,
        "role": u.role, "is_active": u.is_active, "member_id": u.member_id,
        "failed_logins": u.failed_logins or 0,
        "is_locked": bool(u.locked_until and now < u.locked_until),
    }

@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    return [_to_out(u) for u in db.query(User).order_by(User.username).all()]


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(400, "Benutzername bereits vergeben")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "E-Mail-Adresse bereits vergeben")
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        is_active=data.is_active,
        member_id=data.member_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db),
                current_user=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Benutzer nicht gefunden")

    # guard: cannot demote/deactivate last admin
    will_lose_admin = (user.role == "admin" and (data.role != "admin" or not data.is_active))
    if will_lose_admin:
        _guard_last_admin(db, user)

    user.username  = data.username
    user.email     = data.email
    user.role      = data.role
    user.is_active = data.is_active
    user.member_id = data.member_id
    if data.password:
        user.hashed_password = get_password_hash(data.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db),
                current_user=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Benutzer nicht gefunden")
    _guard_last_admin(db, user)
    if user.id == current_user.id:
        raise HTTPException(400, "Sie können Ihren eigenen Account nicht löschen.")
    db.delete(user)
    db.commit()


@router.post("/{user_id}/unlock", response_model=UserOut)
def unlock_user(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.failed_logins = 0
    user.locked_until  = None
    db.commit()
    db.refresh(user)
    return _to_out(user)


@router.get("/me-full", response_model=UserOut)
def me_full(current_user=Depends(get_current_user)):
    return current_user
