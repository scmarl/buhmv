from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv, io
from app.db.session import get_db
from app.api.deps import require_office_or_above
from app.models.member import Member

router = APIRouter(prefix="/export", tags=["export"])

EXPORT_FIELDS = ["id", "member_number", "first_name", "last_name", "email",
                 "phone", "mobile", "street", "zip_code", "city",
                 "birthdate", "gender", "entry_date", "status", "fee_status"]


@router.get("/members")
def export_members(db: Session = Depends(get_db), current_user=Depends(require_office_or_above)):
    members = db.query(Member).filter(Member.is_active == True).order_by(Member.last_name).all()

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf, delimiter=";")
        writer.writerow(EXPORT_FIELDS)
        yield buf.getvalue()
        for m in members:
            buf = io.StringIO()
            writer = csv.writer(buf, delimiter=";")
            writer.writerow([getattr(m, f, "") or "" for f in EXPORT_FIELDS])
            yield buf.getvalue()

    return StreamingResponse(generate(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=members.csv"})
