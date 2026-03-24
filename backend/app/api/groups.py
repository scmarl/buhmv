from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user, require_office_or_above
from app.models.group import Group, GroupMembership
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = 0


class GroupOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int
    member_count: int = 0
    children: list['GroupOut'] = []

    class Config:
        from_attributes = True

GroupOut.model_rebuild()


def build_tree(groups: list[Group], parent_id: Optional[int] = None) -> list[dict]:
    result = []
    for g in sorted([g for g in groups if g.parent_id == parent_id], key=lambda x: x.sort_order):
        node = {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "parent_id": g.parent_id,
            "sort_order": g.sort_order,
            "member_count": len(g.memberships),
            "children": build_tree(groups, g.id),
        }
        result.append(node)
    return result


@router.get("")
def list_groups(tree: bool = False, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    groups = db.query(Group).all()
    if tree:
        return build_tree(groups)
    return [{"id": g.id, "name": g.name, "parent_id": g.parent_id,
             "sort_order": g.sort_order, "member_count": len(g.memberships)} for g in groups]


@router.post("", status_code=201)
def create_group(data: GroupBase, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    group = Group(**data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name, "parent_id": group.parent_id,
            "sort_order": group.sort_order, "member_count": 0, "children": []}


@router.put("/{group_id}")
def update_group(group_id: int, data: GroupBase, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    for k, v in data.model_dump().items():
        setattr(group, k, v)
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name, "parent_id": group.parent_id, "sort_order": group.sort_order}


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()
