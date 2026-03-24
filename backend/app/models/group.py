from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    parent_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    sort_order = Column(Integer, default=0)

    children = relationship("Group", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("Group", back_populates="children", remote_side=[id])
    memberships = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    role = Column(String(50))
    member = relationship("Member", back_populates="group_memberships")
    group = relationship("Group", back_populates="memberships")
