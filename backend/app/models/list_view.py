from sqlalchemy import Column, Integer, String, Text, Boolean
from app.db.session import Base


class ListView(Base):
    __tablename__ = "list_views"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    columns = Column(Text, nullable=False)   # JSON ["member_number","last_name",...]
    is_default = Column(Boolean, default=False)
