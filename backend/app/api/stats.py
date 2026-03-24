from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, timedelta
from app.db.session import get_db
from app.api.deps import require_office_or_above
from app.models.member import Member
from app.models.group import Group, GroupMembership

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
def stats_overview(db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    total = db.query(Member).filter(Member.is_active == True).count()
    today = date.today()
    upcoming = today + timedelta(days=30)

    birthdays = db.query(Member).filter(
        Member.is_active == True,
        Member.birthdate != None,
        func.to_char(Member.birthdate, 'MM-DD').between(
            today.strftime('%m-%d'), upcoming.strftime('%m-%d')
        )
    ).order_by(func.to_char(Member.birthdate, 'MM-DD')).limit(50).all()

    age_rows = db.query(
        (func.extract('year', func.age(Member.birthdate))).label("age"),
        func.count().label("count")
    ).filter(Member.is_active == True, Member.birthdate != None).group_by("age").all()

    age_distribution = [{"age": int(r.age), "count": r.count} for r in age_rows if r.age is not None]

    group_counts = db.query(Group.name, func.count(GroupMembership.id).label("count"))\
        .join(GroupMembership, Group.id == GroupMembership.group_id)\
        .group_by(Group.name).all()

    return {
        "total_active": total,
        "birthdays_next_30_days": [{"id": m.id, "first_name": m.first_name, "last_name": m.last_name, "birthdate": str(m.birthdate)} for m in birthdays],
        "age_distribution": age_distribution,
        "count_by_group": [{"group": r.name, "count": r.count} for r in group_counts],
    }
