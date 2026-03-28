from sqlalchemy import Column, Integer, String, Boolean
from app.db.session import Base

class EmailSettings(Base):
    __tablename__ = "email_settings"
    id              = Column(Integer, primary_key=True, default=1)   # singleton
    send_mode       = Column(String(20), default="mailto")           # mailto | smtp
    smtp_host       = Column(String(500), default="")
    smtp_port       = Column(Integer, default=587)
    smtp_security   = Column(String(20), default="starttls")         # starttls | ssl | none
    smtp_username   = Column(String(500), default="")
    smtp_password   = Column(String(1000), default="")               # Fernet-encrypted
    smtp_from       = Column(String(500), default="")
    updated_by      = Column(String(100), default="")
    updated_at      = Column(String(50), default="")
