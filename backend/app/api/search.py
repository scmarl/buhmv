from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.member import Member
from pydantic import BaseModel
from typing import Optional, Any

router = APIRouter(prefix="/members/search", tags=["search"])


class FilterCondition(BaseModel):
    field: str
    operator: str  # eq, contains, lt, gt, between, in, isEmpty
    value: Optional[Any] = None
    value2: Optional[Any] = None  # for between


class SearchQuery(BaseModel):
    conditions: list[FilterCondition]
    logic: str = "AND"  # AND / OR
    page: int = 1
    size: int = 25
    sort_by: str = "last_name"
    sort_dir: str = "asc"


FIELD_MAP = {
    "first_name": Member.first_name,
    "last_name": Member.last_name,
    "email": Member.email,
    "city": Member.city,
    "zip_code": Member.zip_code,
    "status": Member.status,
    "fee_status": Member.fee_status,
    "member_number": Member.member_number,
    "is_active": Member.is_active,
}


def build_filter(cond: FilterCondition):
    col = FIELD_MAP.get(cond.field)
    if col is None:
        return None
    if cond.operator == "eq":
        return col == cond.value
    if cond.operator == "contains":
        return col.ilike(f"%{cond.value}%")
    if cond.operator == "startsWith":
        return col.ilike(f"{cond.value}%")
    if cond.operator == "isEmpty":
        return (col == None) | (col == "")
    if cond.operator == "lt":
        return col < cond.value
    if cond.operator == "gt":
        return col > cond.value
    if cond.operator == "between" and cond.value2 is not None:
        return col.between(cond.value, cond.value2)
    if cond.operator == "in" and isinstance(cond.value, list):
        return col.in_(cond.value)
    return None


@router.post("")
def search_members(query: SearchQuery, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    filters = [f for c in query.conditions if (f := build_filter(c)) is not None]
    q = db.query(Member)
    if filters:
        combined = and_(*filters) if query.logic == "AND" else or_(*filters)
        q = q.filter(combined)
    total = q.count()
    sort_col = FIELD_MAP.get(query.sort_by, Member.last_name)
    if query.sort_dir == "desc":
        sort_col = sort_col.desc()
    items = q.order_by(sort_col).offset((query.page - 1) * query.size).limit(query.size).all()
    return {"items": items, "total": total, "page": query.page, "size": query.size}
