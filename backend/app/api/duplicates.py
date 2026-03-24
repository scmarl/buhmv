from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import require_office_or_above
from app.models.member import Member
from pydantic import BaseModel

router = APIRouter(prefix="/duplicates", tags=["duplicates"])


@router.get("")
def find_duplicates(db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    members = db.query(Member).filter(Member.is_active == True).all()
    candidates = []
    seen = set()
    for i, a in enumerate(members):
        for b in members[i+1:]:
            if (a.id, b.id) in seen:
                continue
            score = 0
            reasons = []
            if a.last_name and b.last_name and a.last_name.lower() == b.last_name.lower():
                score += 50
                reasons.append("same last_name")
            if a.first_name and b.first_name and a.first_name.lower() == b.first_name.lower():
                score += 30
                reasons.append("same first_name")
            if a.email and b.email and a.email.lower() == b.email.lower():
                score += 80
                reasons.append("same email")
            if a.birthdate and b.birthdate and a.birthdate == b.birthdate:
                score += 40
                reasons.append("same birthdate")
            if score >= 80:
                seen.add((a.id, b.id))
                candidates.append({"member_a": {"id": a.id, "name": f"{a.first_name} {a.last_name}"},
                                   "member_b": {"id": b.id, "name": f"{b.first_name} {b.last_name}"},
                                   "score": score, "reasons": reasons})
    return sorted(candidates, key=lambda x: -x["score"])


class MergeRequest(BaseModel):
    primary_id: int
    secondary_id: int
    field_choices: dict  # field_name -> "primary" | "secondary"


@router.post("/merge")
def merge_members(req: MergeRequest, db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    primary = db.query(Member).filter(Member.id == req.primary_id).first()
    secondary = db.query(Member).filter(Member.id == req.secondary_id).first()
    if not primary or not secondary:
        raise HTTPException(status_code=404, detail="Member not found")
    for field, choice in req.field_choices.items():
        if choice == "secondary":
            setattr(primary, field, getattr(secondary, field))
    secondary.is_active = False
    db.commit()
    return {"merged_into": req.primary_id}
