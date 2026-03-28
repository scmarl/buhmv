from sqlalchemy import Column, Integer, String, Date, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base
from datetime import date as date_cls


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
    death_date = Column(Date)
    member_number = Column(String(50), unique=True, index=True)
    is_active = Column(Boolean, default=True)
    photo_url = Column(String(500))
    bank_name = Column(String(200))
    bic = Column(String(20))
    iban = Column(String(50))
    sepa_ls_vfs = Column(Boolean, default=False)
    sepa_ls_ahv = Column(Boolean, default=False)
    notes = relationship("MemberNote", back_populates="member", cascade="all, delete-orphan")
    custom_values = relationship("CustomFieldValue", back_populates="member", cascade="all, delete-orphan")
    group_memberships = relationship("GroupMembership", back_populates="member", cascade="all, delete-orphan")

    @property
    def age(self):
        if not self.birthdate:
            return None
        end = self.death_date if self.death_date else date_cls.today()
        return end.year - self.birthdate.year - (
            (end.month, end.day) < (self.birthdate.month, self.birthdate.day)
        )


class MemberNote(Base):
    __tablename__ = "member_notes"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    author = Column(String(100))
    content = Column(Text, nullable=False)
    created_at = Column(String(50))
    member = relationship("Member", back_populates="notes")
