from sqlalchemy import Column, Integer, String, Text
from app.db.session import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id         = Column(Integer, primary_key=True)
    timestamp  = Column(String(50), nullable=False)
    username   = Column(String(100), default="")
    category   = Column(String(50), default="")   # auth|members|export|import|fields|users|email
    action     = Column(String(100), default="")
    target     = Column(String(500), default="")
    detail     = Column(Text, default="")
