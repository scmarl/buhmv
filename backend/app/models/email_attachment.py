from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class EmailAttachment(Base):
    __tablename__ = "email_attachments"
    id            = Column(Integer, primary_key=True)
    template_id   = Column(Integer, ForeignKey("email_templates.id", ondelete="CASCADE"), nullable=True)
    original_name = Column(String(500), nullable=False)
    stored_name   = Column(String(500), nullable=False)
    file_size     = Column(Integer, default=0)
    mime_type     = Column(String(200), default="")
    uploaded_at   = Column(String(50), default="")
