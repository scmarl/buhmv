import os, uuid, shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.email_template import EmailTemplate
from app.models.email_attachment import EmailAttachment

router = APIRouter(prefix="/email-templates", tags=["email-templates"])

UPLOAD_DIR = "/app/uploads/email_attachments"

class AttachmentOut(BaseModel):
    id: int
    original_name: str
    stored_name: str
    file_size: int
    mime_type: str
    uploaded_at: str
    class Config: from_attributes = True

class TemplateIn(BaseModel):
    name: str
    subject: str = ""
    title: str = "E-Mail Titel"
    body: str = ""
    footer_text: str = "Diese Nachricht wurde von Vereins-CRM versandt."
    design: str = "standard"
    show_header: bool = True
    show_footer: bool = True
    show_button: bool = False
    button_text: str = "Mehr erfahren"
    button_url: str = ""
    show_button_text_after: bool = False
    button_text_after: str = ""
    primary_color: str = "#2a5298"
    visibility: str = "private"
    color_scheme: str = "{}"
    header_line1: str = ""
    header_line2: str = ""
    header_subtitle: str = ""
    logo_url: str = ""

class TemplateOut(TemplateIn):
    id: int
    created_by: str = ""
    created_at: str = ""
    attachments: List[AttachmentOut] = []
    class Config: from_attributes = True

def _load(db: Session, tid: int) -> EmailTemplate:
    t = db.query(EmailTemplate).options(
        joinedload(EmailTemplate.attachments)
    ).filter(EmailTemplate.id == tid).first()
    if not t:
        raise HTTPException(404)
    return t

@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(EmailTemplate).options(
        joinedload(EmailTemplate.attachments)
    ).filter(
        (EmailTemplate.visibility == "public") | (EmailTemplate.created_by == user.username)
    ).order_by(EmailTemplate.name).all()

@router.post("", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = EmailTemplate(**data.model_dump(), created_by=user.username,
                      created_at=datetime.now().strftime("%Y-%m-%d %H:%M"))
    db.add(t); db.commit(); db.refresh(t)
    return _load(db, t.id)

@router.put("/{tid}", response_model=TemplateOut)
def update_template(tid: int, data: TemplateIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = db.query(EmailTemplate).filter(EmailTemplate.id == tid).first()
    if not t: raise HTTPException(404)
    for k, v in data.model_dump().items(): setattr(t, k, v)
    db.commit()
    return _load(db, t.id)

@router.delete("/{tid}", status_code=204)
def delete_template(tid: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = db.query(EmailTemplate).options(
        joinedload(EmailTemplate.attachments)
    ).filter(EmailTemplate.id == tid).first()
    if not t: raise HTTPException(404)
    # Delete stored files
    for att in t.attachments:
        fp = os.path.join(UPLOAD_DIR, att.stored_name)
        if os.path.exists(fp):
            os.remove(fp)
    db.delete(t); db.commit()

# ── Attachment upload ──────────────────────────────────────────────────────────

@router.post("/{tid}/attachments", response_model=AttachmentOut, status_code=201)
def upload_attachment(
    tid: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    t = db.query(EmailTemplate).filter(EmailTemplate.id == tid).first()
    if not t: raise HTTPException(404, "Vorlage nicht gefunden")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    stored = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, stored)

    size = 0
    with open(dest, "wb") as out:
        while chunk := file.file.read(1024 * 256):
            out.write(chunk)
            size += len(chunk)

    att = EmailAttachment(
        template_id=tid,
        original_name=file.filename or stored,
        stored_name=stored,
        file_size=size,
        mime_type=file.content_type or "application/octet-stream",
        uploaded_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    db.add(att); db.commit(); db.refresh(att)
    return att

@router.delete("/attachments/{att_id}", status_code=204)
def delete_attachment(att_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    att = db.query(EmailAttachment).filter(EmailAttachment.id == att_id).first()
    if not att: raise HTTPException(404)
    fp = os.path.join(UPLOAD_DIR, att.stored_name)
    if os.path.exists(fp):
        os.remove(fp)
    db.delete(att); db.commit()

@router.get("/attachments/{att_id}/download")
def download_attachment(att_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    att = db.query(EmailAttachment).filter(EmailAttachment.id == att_id).first()
    if not att: raise HTTPException(404)
    fp = os.path.join(UPLOAD_DIR, att.stored_name)
    if not os.path.exists(fp): raise HTTPException(404, "Datei nicht gefunden")
    return FileResponse(fp, filename=att.original_name, media_type=att.mime_type)
