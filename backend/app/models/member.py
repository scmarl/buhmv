from sqlalchemy import Column, Integer, String, Date, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False, index=True)
    email = Column(String(200), index=True)
    phone = Column(String(50))
    mobile = Column(String(50))
    street = Column(String(200))
    zip_code = Column(String(10))
    city = Column(String(100))
    birthdate = Column(Date)
    gender = Column(String(20))
    entry_date = Column(Date)
    exit_date = Column(Date)
    member_number = Column(String(50), unique=True, index=True)
    status = Column(String(50), default="active")
    fee_status = Column(String(50), default="paid")
    is_active = Column(Boolean, default=True)
    photo_url = Column(String(500))
    notes = relationship("MemberNote", back_populates="member", cascade="all, delete-orphan")
    custom_values = relationship("CustomFieldValue", back_populates="member", cascade="all, delete-orphan")
    group_memberships = relationship("GroupMembership", back_populates="member", cascade="all, delete-orphan")


class MemberNote(Base):
    __tablename__ = "member_notes"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    author = Column(String(100))
    content = Column(Text, nullable=False)
    created_at = Column(String(50))
    member = relationship("Member", back_populates="notes")
