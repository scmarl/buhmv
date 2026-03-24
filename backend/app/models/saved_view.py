from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from app.db.session import Base


class SavedView(Base):
    __tablename__ = "saved_views"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    query_json = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_shared = Column(Boolean, default=False)
    shared_roles = Column(Text)  # JSON array of roles
