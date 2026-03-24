import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum
from app.db.session import Base


class Role(str, enum.Enum):
    admin = "admin"
    office = "office"
    teamlead = "teamlead"
    member = "member"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(Role), default=Role.member, nullable=False)
    is_active = Column(Boolean, default=True)
    member_id = Column(Integer, nullable=True)
