from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
import csv, io
from typing import Optional
from datetime import date
from app.db.session import get_db
from app.api.deps import require_office_or_above
from app.models.member import Member

router = APIRouter(prefix="/export", tags=["export"])

ALL_FIELDS = [c.name for c in Member.__table__.columns if c.name not in ('photo_url',)] + ['age']

FIELD_LABELS = {
    'id': 'ID', 'member_number': 'Mitgliedsnummer', 'first_name': 'Vorname',
    'last_name': 'Nachname', 'email': 'E-Mail', 'phone': 'Telefon',
    'mobile': 'Mobil', 'street': 'Straße', 'zip_code': 'PLZ',
    'city': 'Ort', 'birthdate': 'Geburtsdatum', 'death_date': 'Verstorben am',
    'gender': 'Geschlecht', 'entry_date': 'Eintrittsdatum', 'exit_date': 'Austrittsdatum',
    'is_active': 'Aktiv',
    'notes_text': 'Notizen', 'age': 'Alter',
}


def _build_query(db, search, group_id, active_only, sort_by, sort_dir):
    q = db.query(Member)
    if active_only:
        q = q.filter(Member.is_active == True)
    if search:
        like = f'%{search}%'
        q = q.filter(
            Member.last_name.ilike(like) |
            Member.first_name.ilike(like) |
            Member.email.ilike(like) |
            Member.member_number.ilike(like)
        )
    if group_id:
        from app.models.group import GroupMembership
        q = q.join(GroupMembership, GroupMembership.member_id == Member.id).filter(
            GroupMembership.group_id == group_id
        )
    sortable = {c.name for c in Member.__table__.columns} - {'photo_url'}
    if sort_by in sortable:
        col = getattr(Member, sort_by)
        q = q.order_by(col.desc() if sort_dir == 'desc' else col.asc())
    else:
        q = q.order_by(Member.last_name.asc())
    return q


def _get_value(m, field):
    if field == 'age':
        return m.age if m.age is not None else ''
    val = getattr(m, field, None)
    if val is None:
        return ''
    if isinstance(val, date):
        return val.strftime('%d.%m.%Y')
    if isinstance(val, bool):
        return 'Ja' if val else 'Nein'
    return str(val)


@router.get("/members")
def export_members(
    format: str = Query('csv'),
    columns: Optional[str] = Query(None),
    member_ids: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    group_id: Optional[int] = Query(None),
    active_only: bool = Query(False),
    sort_by: str = Query('last_name'),
    sort_dir: str = Query('asc'),
    db: Session = Depends(get_db),
    current_user=Depends(require_office_or_above),
):
    if member_ids:
        ids = [int(i) for i in member_ids.split(',') if i.strip().isdigit()]
        members = db.query(Member).filter(Member.id.in_(ids)).all()
    else:
        members = _build_query(db, search, group_id, active_only, sort_by, sort_dir).all()

    fields = [f.strip() for f in columns.split(',')] if columns else ALL_FIELDS
    fields = [f for f in fields if f in set(ALL_FIELDS)]
    if not fields:
        fields = ALL_FIELDS

    headers = [FIELD_LABELS.get(f, f) for f in fields]

    if format == 'xlsx':
        from openpyxl import Workbook
        from openpyxl.styles import Font
        wb = Workbook()
        ws = wb.active
        ws.title = 'Mitglieder'
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)
        for m in members:
            ws.append([_get_value(m, f) for f in fields])
        for col in ws.columns:
            max_len = max((len(str(cell.value or '')) for cell in col), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)
        ws.freeze_panes = 'A2'
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(
            buf.read(),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment; filename=mitglieder.xlsx'},
        )
    else:
        def generate():
            buf = io.StringIO()
            buf.write('\ufeff')  # UTF-8 BOM
            writer = csv.writer(buf, delimiter=';')
            writer.writerow(headers)
            yield buf.getvalue()
            for m in members:
                buf = io.StringIO()
                writer = csv.writer(buf, delimiter=';')
                writer.writerow([_get_value(m, f) for f in fields])
                yield buf.getvalue()

        return StreamingResponse(
            generate(), media_type='text/csv; charset=utf-8-sig',
            headers={'Content-Disposition': 'attachment; filename=mitglieder.csv'},
        )
