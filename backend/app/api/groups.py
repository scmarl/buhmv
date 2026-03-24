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
    from app.models.member import Member

    def collect_ids(gid):
        ids = {gid}
        for child in db.query(Group).filter(Group.parent_id == gid).all():
            ids |= collect_ids(child.id)
        return ids

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group_ids = collect_ids(group_id)
    affected = set(
        m.member_id for m in db.query(GroupMembership).filter(GroupMembership.group_id.in_(group_ids)).all()
    )
    for mid in affected:
        other = db.query(GroupMembership).filter(
            GroupMembership.member_id == mid, GroupMembership.group_id.notin_(group_ids)
        ).count()
        if other == 0:
            db.query(Member).filter(Member.id == mid).delete(synchronize_session=False)
    db.query(GroupMembership).filter(GroupMembership.group_id.in_(group_ids)).delete(synchronize_session=False)
    for gid in sorted(group_ids, reverse=True):
        db.query(Group).filter(Group.id == gid).delete(synchronize_session=False)
    db.commit()


@router.get("/{group_id}/delete-preview")
def delete_preview(group_id: int, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    def collect_ids(gid):
        ids = {gid}
        for child in db.query(Group).filter(Group.parent_id == gid).all():
            ids |= collect_ids(child.id)
        return ids

    group_ids = collect_ids(group_id)
    affected = set(
        m.member_id for m in db.query(GroupMembership).filter(GroupMembership.group_id.in_(group_ids)).all()
    )
    will_delete = sum(
        1 for mid in affected
        if db.query(GroupMembership).filter(
            GroupMembership.member_id == mid, GroupMembership.group_id.notin_(group_ids)
        ).count() == 0
    )
    return {
        "members_to_delete": will_delete,
        "members_to_remove": len(affected) - will_delete,
        "subgroup_count": len(group_ids) - 1,
    }
