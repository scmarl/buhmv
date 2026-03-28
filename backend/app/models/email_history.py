from sqlalchemy import Column, Integer, String, Text
from app.db.session import Base

class EmailHistory(Base):
    __tablename__ = "email_history"
    id              = Column(Integer, primary_key=True)
    sent_at         = Column(String(50), default="")
    username        = Column(String(100), default="")
    subject         = Column(String(500), default="")
    recipient_count = Column(Integer, default=0)
    template_name   = Column(String(200), default="")
    body_preview    = Column(Text, default="")   # first 300 chars
    color_scheme    = Column(Text, default="{}")
    design          = Column(String(50), default="standard")
    primary_color   = Column(String(20), default="#2a5298")
