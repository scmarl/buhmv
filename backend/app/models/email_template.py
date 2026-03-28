from sqlalchemy import Column, Integer, String, Text, Boolean
from sqlalchemy.orm import relationship
from app.db.session import Base

class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id                   = Column(Integer, primary_key=True)
    name                 = Column(String(200), nullable=False)
    subject              = Column(String(500), default="")
    title                = Column(String(500), default="E-Mail Titel")
    body                 = Column(Text, default="Guten Tag,\n\n\n\nFreundliche Grüße")
    footer_text          = Column(Text, default="Diese Nachricht wurde von Vereins-CRM versandt.")
    design               = Column(String(50), default="standard")
    show_header          = Column(Boolean, default=True)
    show_footer          = Column(Boolean, default=True)
    show_button          = Column(Boolean, default=False)
    button_text          = Column(String(200), default="Mehr erfahren")
    button_url           = Column(String(500), default="")
    show_button_text_after = Column(Boolean, default=False)
    button_text_after    = Column(Text, default="")
    primary_color        = Column(String(20), default="#2a5298")
    visibility           = Column(String(20), default="private")
    created_by           = Column(String(100), default="")
    created_at           = Column(String(50), default="")
    color_scheme         = Column(Text, default="{}")
    header_line1         = Column(String(500), default="")
    header_line2         = Column(String(500), default="")
    header_subtitle      = Column(String(500), default="")
    logo_url             = Column(Text, default="")
    attachments          = relationship("EmailAttachment", backref="template",
                                        cascade="all, delete-orphan",
                                        primaryjoin="EmailTemplate.id == foreign(EmailAttachment.template_id)")
