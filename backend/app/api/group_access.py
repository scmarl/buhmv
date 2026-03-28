"""
Shared helper: resolve which member IDs a user may see,
based on role_group_permissions + group hierarchy.

Admin and Office always have unrestricted access.
All other roles are limited to members that belong to at
least one group (or descendant group) that the role is
permitted to read.
"""
from sqlalchemy.orm import Session
from app.models.group import Group, GroupMembership
from app.models.role_permission import RoleGroupPermission

UNRESTRICTED_ROLES = {"admin", "office"}


def _child_ids(group_id: int, all_groups: list) -> set[int]:
    """Recursively collect a group and all its descendants."""
    ids = {group_id}
    for g in all_groups:
        if g.parent_id == group_id:
            ids |= _child_ids(g.id, all_groups)
    return ids


def get_allowed_group_ids(role: str, db: Session) -> set[int] | None:
    """
    Returns a set of group IDs the role may access,
    or None if access is unrestricted.
    """
    if role in UNRESTRICTED_ROLES:
        return None  # no restriction

    rows = db.query(RoleGroupPermission).filter(RoleGroupPermission.role == role).all()
    if not rows:
        return set()  # no groups configured → sees nothing

    all_groups = db.query(Group).all()
    allowed: set[int] = set()
    for row in rows:
        allowed |= _child_ids(row.group_id, all_groups)
    return allowed


def apply_group_filter(query, role: str, db: Session):
    """
    Applies group-based filtering to a SQLAlchemy query on Member.
    Returns (query, restricted: bool).
    """
    allowed = get_allowed_group_ids(role, db)
    if allowed is None:
        return query, False   # unrestricted
    if not allowed:
        # role has no group access at all → return empty set via impossible filter
        from app.models.member import Member
        return query.filter(Member.id == -1), True
    from app.models.member import Member
    return (
        query.join(Member.group_memberships)
             .filter(GroupMembership.group_id.in_(allowed))
             .distinct(),
        True,
    )
