from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import require_admin
from app.models.role_permission import RoleGroupPermission, RoleFieldCategoryPermission, RoleDefinition
from app.models.user import User
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["role-permissions"])

SYSTEM_ROLES = {"admin", "office", "teamlead", "member"}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RoleDefIn(BaseModel):
    name: str
    label: str
    description: str = ""


class RoleDefUpdate(BaseModel):
    label: str
    description: str = ""


class GroupPermIn(BaseModel):
    group_id: int
    can_read: bool = True
    can_write: bool = False


class FieldCategoryPermIn(BaseModel):
    category: str
    can_view: bool = False
    can_edit: bool = False


class RolePermsIn(BaseModel):
    group_permissions: list[GroupPermIn] = []
    field_category_permissions: list[FieldCategoryPermIn] = []


# ── helpers ───────────────────────────────────────────────────────────────────

def _role_data(role: str, db: Session) -> dict:
    group_rows = db.query(RoleGroupPermission).filter(RoleGroupPermission.role == role).all()
    cat_rows   = db.query(RoleFieldCategoryPermission).filter(RoleFieldCategoryPermission.role == role).all()
    return {
        "role": role,
        "group_permissions": [
            {"group_id": r.group_id, "can_read": True, "can_write": r.can_write}
            for r in group_rows
        ],
        "field_category_permissions": [
            {"category": r.category, "can_view": r.can_view, "can_edit": r.can_edit}
            for r in cat_rows
        ],
    }


def _all_role_names(db: Session) -> list[str]:
    return [r.name for r in db.query(RoleDefinition).order_by(RoleDefinition.is_system.desc(), RoleDefinition.name).all()]


# ── role definitions CRUD ─────────────────────────────────────────────────────

@router.get("/roles")
def list_roles(db: Session = Depends(get_db), _=Depends(require_admin)):
    roles = db.query(RoleDefinition).order_by(RoleDefinition.is_system.desc(), RoleDefinition.label).all()
    return [{"name": r.name, "label": r.label, "description": r.description, "is_system": r.is_system}
            for r in roles]


@router.post("/roles", status_code=201)
def create_role(body: RoleDefIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    name = body.name.strip().lower().replace(" ", "_")
    if not name:
        raise HTTPException(400, "Name darf nicht leer sein")
    if db.query(RoleDefinition).filter(RoleDefinition.name == name).first():
        raise HTTPException(400, f"Rolle '{name}' existiert bereits")
    role = RoleDefinition(name=name, label=body.label, description=body.description, is_system=False)
    db.add(role)
    db.commit()
    return {"name": role.name, "label": role.label, "description": role.description, "is_system": False}


@router.put("/roles/{name}")
def update_role_def(name: str, body: RoleDefUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    role = db.query(RoleDefinition).filter(RoleDefinition.name == name).first()
    if not role:
        raise HTTPException(404, "Rolle nicht gefunden")
    role.label = body.label
    role.description = body.description
    db.commit()
    return {"name": role.name, "label": role.label, "description": role.description, "is_system": role.is_system}


@router.delete("/roles/{name}", status_code=204)
def delete_role(name: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    if name in SYSTEM_ROLES:
        raise HTTPException(403, "Systemrollen können nicht gelöscht werden")
    role = db.query(RoleDefinition).filter(RoleDefinition.name == name).first()
    if not role:
        raise HTTPException(404, "Rolle nicht gefunden")
    user_count = db.query(User).filter(User.role == name).count()
    if user_count > 0:
        raise HTTPException(400, f"Rolle wird noch von {user_count} Benutzer(n) verwendet. "
                                  "Bitte zuerst neu zuweisen.")
    # clean up permissions
    db.query(RoleGroupPermission).filter(RoleGroupPermission.role == name).delete()
    db.query(RoleFieldCategoryPermission).filter(RoleFieldCategoryPermission.role == name).delete()
    db.delete(role)
    db.commit()


# ── permission read / write ───────────────────────────────────────────────────

@router.get("/role-permissions")
def list_all(db: Session = Depends(get_db), _=Depends(require_admin)):
    names = _all_role_names(db)
    return {name: _role_data(name, db) for name in names}


@router.get("/role-permissions/{role}")
def get_role(role: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    if not db.query(RoleDefinition).filter(RoleDefinition.name == role).first():
        raise HTTPException(404, "Unknown role")
    return _role_data(role, db)


@router.put("/role-permissions/{role}")
def update_perms(
    role: str,
    body: RolePermsIn,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    if role == "admin":
        raise HTTPException(403, "Admin-Berechtigungen können nicht geändert werden")
    if not db.query(RoleDefinition).filter(RoleDefinition.name == role).first():
        raise HTTPException(404, "Unknown role")

    db.query(RoleGroupPermission).filter(RoleGroupPermission.role == role).delete()
    for gp in body.group_permissions:
        if gp.can_read:
            db.add(RoleGroupPermission(role=role, group_id=gp.group_id, can_write=gp.can_write))

    db.query(RoleFieldCategoryPermission).filter(RoleFieldCategoryPermission.role == role).delete()
    for cp in body.field_category_permissions:
        db.add(RoleFieldCategoryPermission(
            role=role, category=cp.category, can_view=cp.can_view, can_edit=cp.can_edit))

    db.commit()
    return _role_data(role, db)
