from sqlalchemy import Column, Integer, String, Text
from app.db.session import Base

class AppBranding(Base):
    __tablename__ = "app_branding"
    id                  = Column(Integer, primary_key=True, default=1)
    club_name           = Column(String(200), default="Mein Verein")
    logo_url            = Column(Text, default="")
    primary_color       = Column(String(20), default="#2a5298")   # header bg + active accents
    header_text_color   = Column(String(20), default="#ffffff")
    sidebar_bg          = Column(String(20), default="#ffffff")
    sidebar_text_color  = Column(String(20), default="#374151")
    workspace_bg        = Column(String(20), default="#f3f4f6")
    updated_by          = Column(String(100), default="")
    updated_at          = Column(String(50), default="")
