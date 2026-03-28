from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import csv, io
from app.db.session import get_db
from app.api.deps import require_office_or_above
from app.models.member import Member

router = APIRouter(prefix="/import", tags=["import"])

STANDARD_FIELDS = ["first_name", "last_name", "email", "phone", "mobile",
                   "street", "zip_code", "city", "birthdate", "gender",
                   "entry_date", "member_number"]


@router.post("/validate")
async def validate_import(file: UploadFile = File(...), current_user=Depends(require_office_or_above), db: Session = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    dialect = csv.Sniffer().sniff(text[:2048], delimiters=";,")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows = list(reader)
    headers = reader.fieldnames or []
    errors, warnings, duplicates = [], [], []
    for i, row in enumerate(rows, 1):
        if not row.get("last_name"):
            errors.append({"row": i, "message": "last_name is required"})
        existing = db.query(Member).filter(Member.email == row.get("email")).first() if row.get("email") else None
        if existing:
            duplicates.append({"row": i, "member_id": existing.id, "email": row.get("email")})
    return {"headers": headers, "row_count": len(rows), "errors": errors, "warnings": warnings, "duplicates": duplicates, "rows": rows[:5]}


@router.post("/commit")
async def commit_import(file: UploadFile = File(...), strategy: str = "skip", current_user=Depends(require_office_or_above), db: Session = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    dialect = csv.Sniffer().sniff(text[:2048], delimiters=";,")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    created, updated, skipped = 0, 0, 0
    for row in reader:
        existing = db.query(Member).filter(Member.email == row.get("email")).first() if row.get("email") else None
        data = {k: v or None for k, v in row.items() if k in STANDARD_FIELDS}
        if existing:
            if strategy == "update":
                for k, v in data.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                skipped += 1
        else:
            if data.get("last_name"):
                db.add(Member(**data))
                created += 1
    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}
