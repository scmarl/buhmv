import hashlib, base64, smtplib, ssl
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from cryptography.fernet import Fernet
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.email_settings import EmailSettings
from app.models.audit_log import AuditLog
from app.core.config import settings as app_settings

router = APIRouter(prefix="/email-settings", tags=["email-settings"])

# ── Encryption helpers ─────────────────────────────────────────────────────────
def _fernet() -> Fernet:
    key = hashlib.sha256(app_settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def encrypt_pw(plain: str) -> str:
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode()).decode()

def decrypt_pw(enc: str) -> str:
    if not enc:
        return ""
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except Exception:
        return ""

# ── Schemas ────────────────────────────────────────────────────────────────────
class SettingsIn(BaseModel):
    send_mode: str = "mailto"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_security: str = "starttls"
    smtp_username: str = ""
    smtp_password: str = ""        # plain text in, encrypted at rest
    smtp_from: str = ""

class SettingsOut(BaseModel):
    send_mode: str
    smtp_host: str
    smtp_port: int
    smtp_security: str
    smtp_username: str
    smtp_password: str             # always "" in responses (never send decrypted)
    smtp_from: str
    password_set: bool
    updated_by: str
    updated_at: str

class TestRequest(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_security: str
    smtp_username: str
    smtp_password: str             # plain; "" means use stored password
    smtp_from: str

class TestResult(BaseModel):
    success: bool
    message: str

# ── Helper ─────────────────────────────────────────────────────────────────────
def _get_or_create(db: Session) -> EmailSettings:
    row = db.query(EmailSettings).filter(EmailSettings.id == 1).first()
    if not row:
        row = EmailSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row

def _audit(db: Session, username: str, action: str, detail: str = ""):
    db.add(AuditLog(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        username=username,
        category="email",
        action=action,
        target="E-Mail Einstellungen",
        detail=detail,
    ))
    db.commit()

# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = _get_or_create(db)
    return SettingsOut(
        send_mode=row.send_mode or "mailto",
        smtp_host=row.smtp_host or "",
        smtp_port=row.smtp_port or 587,
        smtp_security=row.smtp_security or "starttls",
        smtp_username=row.smtp_username or "",
        smtp_password="",           # never expose decrypted password
        smtp_from=row.smtp_from or "",
        password_set=bool(row.smtp_password),
        updated_by=row.updated_by or "",
        updated_at=row.updated_at or "",
    )

@router.put("", response_model=SettingsOut)
def save_settings(data: SettingsIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = _get_or_create(db)
    row.send_mode     = data.send_mode
    row.smtp_host     = data.smtp_host
    row.smtp_port     = data.smtp_port
    row.smtp_security = data.smtp_security
    row.smtp_username = data.smtp_username
    row.smtp_from     = data.smtp_from
    row.updated_by    = user.username
    row.updated_at    = datetime.now().strftime("%Y-%m-%d %H:%M")
    # Only update password if a new one was submitted
    if data.smtp_password:
        row.smtp_password = encrypt_pw(data.smtp_password)
    db.commit()
    _audit(db, user.username, "Einstellungen gespeichert",
           f"Modus: {data.send_mode}" + (f", Host: {data.smtp_host}:{data.smtp_port}" if data.send_mode == "smtp" else ""))
    return SettingsOut(
        send_mode=row.send_mode, smtp_host=row.smtp_host, smtp_port=row.smtp_port,
        smtp_security=row.smtp_security, smtp_username=row.smtp_username,
        smtp_password="", smtp_from=row.smtp_from,
        password_set=bool(row.smtp_password),
        updated_by=row.updated_by, updated_at=row.updated_at,
    )

@router.post("/test", response_model=TestResult)
def test_connection(data: TestRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    password = data.smtp_password
    if not password:
        # Use stored encrypted password
        row = _get_or_create(db)
        password = decrypt_pw(row.smtp_password)

    try:
        ctx = ssl.create_default_context()
        if data.smtp_security == "ssl":
            with smtplib.SMTP_SSL(data.smtp_host, data.smtp_port, context=ctx, timeout=10) as s:
                if data.smtp_username and password:
                    s.login(data.smtp_username, password)
        else:
            with smtplib.SMTP(data.smtp_host, data.smtp_port, timeout=10) as s:
                s.ehlo()
                if data.smtp_security == "starttls":
                    s.starttls(context=ctx)
                    s.ehlo()
                if data.smtp_username and password:
                    s.login(data.smtp_username, password)
        _audit(db, user.username, "Verbindungstest erfolgreich",
               f"{data.smtp_host}:{data.smtp_port} ({data.smtp_security})")
        return TestResult(success=True, message=f"Verbindung zu {data.smtp_host}:{data.smtp_port} erfolgreich.")
    except smtplib.SMTPAuthenticationError:
        return TestResult(success=False, message="Authentifizierung fehlgeschlagen – Benutzername oder Passwort falsch.")
    except smtplib.SMTPConnectError as e:
        return TestResult(success=False, message=f"Verbindung fehlgeschlagen: {e}")
    except TimeoutError:
        return TestResult(success=False, message=f"Zeitüberschreitung – Server {data.smtp_host}:{data.smtp_port} nicht erreichbar.")
    except ssl.SSLError as e:
        return TestResult(success=False, message=f"SSL-Fehler: {e}")
    except Exception as e:
        return TestResult(success=False, message=f"Fehler: {e}")
