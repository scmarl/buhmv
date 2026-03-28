from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.app_branding import AppBranding

router = APIRouter(prefix="/branding", tags=["branding"])


class BrandingIn(BaseModel):
    club_name: str = "Mein Verein"
    logo_url: str = ""
    primary_color: str = "#2a5298"
    header_text_color: str = "#ffffff"
    sidebar_bg: str = "#ffffff"
    sidebar_text_color: str = "#374151"
    workspace_bg: str = "#f3f4f6"


class BrandingOut(BrandingIn):
    updated_by: str = ""
    updated_at: str = ""


def _get_or_create(db: Session) -> AppBranding:
    row = db.query(AppBranding).filter(AppBranding.id == 1).first()
    if not row:
        row = AppBranding(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _to_out(row: AppBranding) -> BrandingOut:
    return BrandingOut(
        club_name=row.club_name or "Mein Verein",
        logo_url=row.logo_url or "",
        primary_color=row.primary_color or "#2a5298",
        header_text_color=row.header_text_color or "#ffffff",
        sidebar_bg=row.sidebar_bg or "#ffffff",
        sidebar_text_color=row.sidebar_text_color or "#374151",
        workspace_bg=row.workspace_bg or "#f3f4f6",
        updated_by=row.updated_by or "",
        updated_at=row.updated_at or "",
    )


@router.get("", response_model=BrandingOut)
def get_branding(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _to_out(_get_or_create(db))


@router.put("", response_model=BrandingOut)
def save_branding(data: BrandingIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = _get_or_create(db)
    row.club_name         = data.club_name
    row.logo_url          = data.logo_url
    row.primary_color     = data.primary_color
    row.header_text_color = data.header_text_color
    row.sidebar_bg        = data.sidebar_bg
    row.sidebar_text_color = data.sidebar_text_color
    row.workspace_bg      = data.workspace_bg
    row.updated_by        = user.username
    row.updated_at        = datetime.now().strftime("%Y-%m-%d %H:%M")
    db.commit()
    db.refresh(row)
    return _to_out(row)
