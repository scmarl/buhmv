from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, cast, Date
from app.db.session import get_db
from app.api.deps import get_current_user
from app.api.group_access import apply_group_filter, _child_ids
from app.models.member import Member
from app.models.group import Group, GroupMembership
from app.models.field import CustomField, CustomFieldValue
from pydantic import BaseModel
from typing import Optional, Any

router = APIRouter(prefix="/members/search", tags=["search"])


class FilterCondition(BaseModel):
    field: str
    operator: str
    value: Optional[Any] = None
    value2: Optional[Any] = None   # for between


class SearchQuery(BaseModel):
    conditions: list[FilterCondition]
    logic: str = "AND"
    page: int = 1
    size: int = 25
    sort_by: str = "last_name"
    sort_dir: str = "asc"


# All directly searchable Member columns
DIRECT_FIELD_MAP: dict[str, tuple] = {
    "first_name":   (Member.first_name,   "text"),
    "last_name":    (Member.last_name,    "text"),
    "email":        (Member.email,        "text"),
    "phone":        (Member.phone,        "text"),
    "mobile":       (Member.mobile,       "text"),
    "street":       (Member.street,       "text"),
    "zip_code":     (Member.zip_code,     "text"),
    "city":         (Member.city,         "text"),
    "gender":       (Member.gender,       "text"),
    "member_number":(Member.member_number,"text"),
    "bank_name":    (Member.bank_name,    "text"),
    "bic":          (Member.bic,          "text"),
    "iban":         (Member.iban,         "text"),
    "birthdate":    (Member.birthdate,    "date"),
    "entry_date":   (Member.entry_date,   "date"),
    "exit_date":    (Member.exit_date,    "date"),
    "death_date":   (Member.death_date,   "date"),
    "is_active":    (Member.is_active,    "checkbox"),
    "sepa_ls_vfs":  (Member.sepa_ls_vfs,  "checkbox"),
    "sepa_ls_ahv":  (Member.sepa_ls_ahv,  "checkbox"),
}


def _age_expr():
    return func.date_part("year", func.age(func.current_date(), Member.birthdate))


def build_filter(cond: FilterCondition, db: Session):
    op = cond.operator

    # ── virtual: group ─────────────────────────────────────────────────────
    if cond.field == "group":
        if not cond.value:
            return None
        try:
            gid = int(cond.value)
        except (TypeError, ValueError):
            return None
        all_groups = db.query(Group).all()
        ids = _child_ids(gid, all_groups)
        subq = db.query(GroupMembership.member_id).filter(
            GroupMembership.group_id.in_(ids)
        ).subquery()
        if op == "not_in_group":
            return Member.id.notin_(subq)
        return Member.id.in_(subq)  # in_group / default

    # ── virtual: age ───────────────────────────────────────────────────────
    if cond.field == "age":
        age = _age_expr()
        if op == "isEmpty":
            return Member.birthdate == None
        if op == "isNotEmpty":
            return Member.birthdate != None
        try:
            v = float(cond.value)
        except (TypeError, ValueError):
            return None
        if op == "eq":      return age == v
        if op == "lt":      return age < v
        if op == "gt":      return age > v
        if op == "between":
            try:
                v2 = float(cond.value2)
            except (TypeError, ValueError):
                return None
            return age.between(v, v2)
        return None

    # ── direct Member column ───────────────────────────────────────────────
    if cond.field in DIRECT_FIELD_MAP:
        col, ftype = DIRECT_FIELD_MAP[cond.field]

        if op == "isEmpty":
            return (col == None) | (col == "")
        if op == "isNotEmpty":
            return (col != None) & (col != "")

        if ftype == "checkbox":
            val = str(cond.value).lower() in ("true", "1", "ja", "yes")
            return col == val

        if ftype == "date":
            from datetime import date
            def _d(s):
                try:
                    return date.fromisoformat(str(s))
                except Exception:
                    return None
            v = _d(cond.value)
            if v is None:
                return None
            if op == "eq":      return col == v
            if op == "lt":      return col < v
            if op == "gt":      return col > v
            if op == "between":
                v2 = _d(cond.value2)
                if v2 is None:
                    return None
                return col.between(v, v2)
            return None

        if ftype in ("number", "money"):
            try:
                v = float(cond.value)
            except (TypeError, ValueError):
                return None
            if op == "eq":      return col == v
            if op == "lt":      return col < v
            if op == "gt":      return col > v
            if op == "between":
                try:
                    v2 = float(cond.value2)
                except (TypeError, ValueError):
                    return None
                return col.between(v, v2)
            return None

        # text-like
        val = str(cond.value) if cond.value is not None else ""
        if op == "contains":   return col.ilike(f"%{val}%")
        if op == "eq":         return col == val
        if op == "startsWith": return col.ilike(f"{val}%")
        if op == "in":
            parts = [p.strip() for p in val.split(",") if p.strip()]
            return col.in_(parts)
        return None

    # ── custom field value (stored in custom_field_values) ─────────────────
    cf = db.query(CustomField).filter(CustomField.name == cond.field).first()
    if cf:
        subq = db.query(CustomFieldValue.member_id).filter(
            CustomFieldValue.field_id == cf.id
        )
        val_col = CustomFieldValue.value
        if op == "isEmpty":
            # member has no value for this field
            all_subq = db.query(CustomFieldValue.member_id).filter(
                CustomFieldValue.field_id == cf.id,
                val_col != None, val_col != ""
            ).subquery()
            return Member.id.notin_(all_subq)
        if op == "isNotEmpty":
            has_subq = db.query(CustomFieldValue.member_id).filter(
                CustomFieldValue.field_id == cf.id,
                val_col != None, val_col != ""
            ).subquery()
            return Member.id.in_(has_subq)
        val = str(cond.value) if cond.value is not None else ""
        if op == "contains":
            subq = subq.filter(val_col.ilike(f"%{val}%"))
        elif op == "eq":
            subq = subq.filter(val_col == val)
        elif op == "startsWith":
            subq = subq.filter(val_col.ilike(f"{val}%"))
        else:
            return None
        return Member.id.in_(subq.subquery())

    return None


@router.post("")
def search_members(
    query: SearchQuery,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    filters = [f for c in query.conditions if (f := build_filter(c, db)) is not None]
    q = db.query(Member)
    if filters:
        combined = and_(*filters) if query.logic == "AND" else or_(*filters)
        q = q.filter(combined)

    # apply role-based group restriction
    q, _ = apply_group_filter(q, current_user.role, db)

    total = q.count()

    # sort
    if query.sort_by == "age":
        sort_expr = _age_expr()
        sort_expr = sort_expr.desc() if query.sort_dir == "desc" else sort_expr.asc()
    else:
        sort_col = DIRECT_FIELD_MAP.get(query.sort_by, (Member.last_name, "text"))[0]
        sort_expr = sort_col.desc() if query.sort_dir == "desc" else sort_col.asc()

    from sqlalchemy.orm import joinedload
    rows = (
        q.options(joinedload(Member.group_memberships).joinedload(GroupMembership.group))
         .order_by(sort_expr)
         .offset((query.page - 1) * query.size)
         .limit(query.size)
         .all()
    )
    items = [
        {
            **{c.name: getattr(m, c.name) for c in m.__table__.columns},
            "age": m.age,
            "groups": [
                {"id": gm.group_id, "name": gm.group.name}
                for gm in m.group_memberships if gm.group
            ],
        }
        for m in rows
    ]
    return {"items": items, "total": total, "page": query.page, "size": query.size}
