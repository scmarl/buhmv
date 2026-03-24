from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500))
    memberships = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    role = Column(String(50))
    member = relationship("Member", back_populates="group_memberships")
    group = relationship("Group", back_populates="memberships")
