import re, smtplib, ssl, hashlib, base64, mimetypes
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import List, Optional
from cryptography.fernet import Fernet
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.email_settings import EmailSettings
from app.models.audit_log import AuditLog
from app.models.email_history import EmailHistory
from app.models.member import Member
from app.models.field import CustomFieldValue, CustomField
from app.core.config import settings as app_settings

router = APIRouter(prefix="/email", tags=["email"])

# ── Crypto ─────────────────────────────────────────────────────────────────────

def _fernet() -> Fernet:
    key = hashlib.sha256(app_settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def decrypt_pw(enc: str) -> str:
    if not enc:
        return ""
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except Exception:
        return ""

# ── Placeholder substitution ───────────────────────────────────────────────────

def substitute(text: str, member: Member, custom_map: dict) -> str:
    """Replace {{field}} placeholders with member data."""
    gender = (member.gender or "").lower()
    data: dict = {
        "first_name":    member.first_name    or "",
        "last_name":     member.last_name     or "",
        "email":         member.email         or "",
        "phone":         member.phone         or "",
        "mobile":        member.mobile        or "",
        "street":        member.street        or "",
        "zip_code":      member.zip_code      or "",
        "city":          member.city          or "",
        "member_number": member.member_number or "",
        "gender":        member.gender        or "",
        "birthdate":     str(member.birthdate)  if member.birthdate  else "",
        "entry_date":    str(member.entry_date) if member.entry_date else "",
        "exit_date":     str(member.exit_date)  if member.exit_date  else "",
        "bank_name":     member.bank_name     or "",
        "iban":          member.iban          or "",
        "bic":           member.bic           or "",
        "age":           str(member.age)       if member.age is not None else "",
        "anrede":        "Sehr geehrter Herr" if gender == "m"
                         else "Sehr geehrte Frau" if gender == "w"
                         else "Guten Tag",
        "anrede_name":   ("Sehr geehrter Herr " if gender == "m"
                          else "Sehr geehrte Frau " if gender == "w"
                          else "Guten Tag ") + (member.last_name or ""),
    }
    data.update(custom_map)

    # Add club_name from branding settings
    try:
        from app.models.app_branding import AppBranding
        from sqlalchemy import create_engine
        from app.db.session import SessionLocal
        with SessionLocal() as _db:
            _b = _db.query(AppBranding).filter(AppBranding.id == 1).first()
            if _b:
                data["club_name"] = _b.club_name or ""
    except Exception:
        pass

    def replacer(m: re.Match) -> str:
        key = m.group(1).strip()
        return data.get(key, m.group(0))   # unknown placeholders left unchanged

    return re.sub(r'\{\{([^}]+)\}\}', replacer, text)


def _load_member_with_custom(db: Session, member_id: int):
    return (
        db.query(Member)
        .options(joinedload(Member.custom_values).joinedload(CustomFieldValue.field))
        .filter(Member.id == member_id)
        .first()
    )


def _build_custom_map(member: Member) -> dict:
    return {
        cv.field.name: (cv.value or "")
        for cv in member.custom_values
        if cv.field
    }

# ── Schemas ────────────────────────────────────────────────────────────────────

class RecipientEntry(BaseModel):
    member_id: Optional[int] = None
    email: str

class AttachmentData(BaseModel):
    filename: str
    content_b64: str   # base64-encoded file content
    mime_type: str = "application/octet-stream"

class SendRequest(BaseModel):
    recipients: List[RecipientEntry]
    cc: List[str] = []
    bcc_extra: List[str] = []
    subject: str
    body: str
    body_type: str = "html"
    serial: bool = False
    template_name: str = ""
    color_scheme: str = "{}"
    design: str = "standard"
    primary_color: str = "#2a5298"
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    attachments: List[AttachmentData] = []

class SendResult(BaseModel):
    success: bool
    sent: int
    failed: int
    message: str

class PreviewRequest(BaseModel):
    member_id: int
    subject: str
    body: str

class PreviewResult(BaseModel):
    subject: str
    body: str
    member_name: str

# ── Helpers ────────────────────────────────────────────────────────────────────

def _audit(db: Session, username: str, action: str, detail: str = ""):
    db.add(AuditLog(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        username=username,
        category="email",
        action=action,
        target="E-Mail Versand",
        detail=detail,
    ))
    db.commit()


def _smtp_send(cfg: EmailSettings, ctx: ssl.SSLContext, from_addr: str,
               to_addrs: list, msg_bytes: bytes):
    password = decrypt_pw(cfg.smtp_password)
    if cfg.smtp_security == "ssl":
        with smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, context=ctx, timeout=15) as s:
            if cfg.smtp_username and password:
                s.login(cfg.smtp_username, password)
            s.sendmail(from_addr, to_addrs, msg_bytes)
    else:
        with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=15) as s:
            s.ehlo()
            if cfg.smtp_security == "starttls":
                s.starttls(context=ctx)
                s.ehlo()
            if cfg.smtp_username and password:
                s.login(cfg.smtp_username, password)
            s.sendmail(from_addr, to_addrs, msg_bytes)

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/send", response_model=SendResult)
def send_email(
    data: SendRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not data.recipients:
        raise HTTPException(400, "Keine Empfänger angegeben")
    if not data.subject.strip():
        raise HTTPException(400, "Betreff fehlt")

    cfg = db.query(EmailSettings).filter(EmailSettings.id == 1).first()
    if not cfg or cfg.send_mode != "smtp" or not cfg.smtp_host:
        raise HTTPException(400, "SMTP nicht konfiguriert. Bitte zuerst E-Mail Einstellungen speichern.")

    ctx = ssl.create_default_context()
    from_addr   = data.from_email or cfg.smtp_from or cfg.smtp_username
    from_header = f"{data.from_name} <{from_addr}>" if data.from_name else from_addr

    sent = 0
    failed = 0
    errors: list = []

    for entry in data.recipients:
        addr = entry.email
        if not addr:
            continue

        body_out    = data.body
        subject_out = data.subject
        if data.serial and entry.member_id:
            member = _load_member_with_custom(db, entry.member_id)
            if member:
                custom_map  = _build_custom_map(member)
                body_out    = substitute(data.body,    member, custom_map)
                subject_out = substitute(data.subject, member, custom_map)

        try:
            if data.attachments:
                msg = MIMEMultipart("mixed")
            else:
                msg = MIMEMultipart("alternative")
            msg["Subject"] = subject_out
            msg["From"]    = from_header
            msg["To"]      = addr
            if data.cc:
                msg["Cc"] = ", ".join(data.cc)
            msg.attach(MIMEText(body_out, data.body_type, "utf-8"))
            for att in data.attachments:
                try:
                    mime_str  = att.mime_type if "/" in att.mime_type else "application/octet-stream"
                    main_type, sub_type = mime_str.split("/", 1)
                    part = MIMEBase(main_type, sub_type)
                    part.set_payload(base64.b64decode(att.content_b64))
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", "attachment", filename=att.filename)
                    msg.attach(part)
                except Exception:
                    pass
            _smtp_send(cfg, ctx, from_addr, [addr] + data.cc + data.bcc_extra, msg.as_bytes())
            sent += 1
        except Exception as e:
            failed += 1
            errors.append(f"{addr}: {e}")

    label  = "Serien" if data.serial else "Massen"
    detail = f"{label}-E-Mail | Betreff: {data.subject} | {sent} gesendet, {failed} fehlgeschlagen"
    if errors:
        detail += " | Fehler: " + "; ".join(errors[:3])
    _audit(db, user.username, "E-Mail gesendet", detail)

    if sent > 0:
        db.add(EmailHistory(
            sent_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            username=user.username,
            subject=data.subject,
            recipient_count=sent,
            template_name=data.template_name,
            body_preview=data.body[:300] if data.body else '',
            color_scheme=data.color_scheme,
            design=data.design,
            primary_color=data.primary_color,
        ))
        db.commit()

    if sent == 0:
        return SendResult(success=False, sent=0, failed=failed,
                          message=f"Versand fehlgeschlagen: {errors[0] if errors else 'Unbekannter Fehler'}")
    if failed > 0:
        return SendResult(success=True, sent=sent, failed=failed,
                          message=f"{sent} gesendet, {failed} fehlgeschlagen.")
    noun = "Serien-E-Mail" if data.serial else "E-Mail"
    return SendResult(success=True, sent=sent, failed=0,
                      message=f"{sent} {noun}{'s' if sent > 1 else ''} erfolgreich gesendet.")


@router.post("/preview", response_model=PreviewResult)
def preview_email(
    data: PreviewRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    member = _load_member_with_custom(db, data.member_id)
    if not member:
        raise HTTPException(404, "Mitglied nicht gefunden")
    custom_map = _build_custom_map(member)
    return PreviewResult(
        subject=substitute(data.subject, member, custom_map),
        body=substitute(data.body, member, custom_map),
        member_name=f"{member.first_name or ''} {member.last_name or ''}".strip(),
    )


class HistoryOut(BaseModel):
    id: int; sent_at: str; username: str; subject: str
    recipient_count: int; template_name: str; body_preview: str
    color_scheme: str; design: str; primary_color: str
    class Config: from_attributes = True

@router.get("/history", response_model=list[HistoryOut])
def list_history(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(EmailHistory).order_by(EmailHistory.id.desc()).limit(50).all()
