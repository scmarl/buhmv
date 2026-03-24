import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base


class FieldType(str, enum.Enum):
    text = "text"
    textarea = "textarea"
    number = "number"
    money = "money"
    date = "date"
    select = "select"
    checkbox = "checkbox"
    file = "file"
    image = "image"


class CustomField(Base):
    __tablename__ = "custom_fields"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    label = Column(String(200), nullable=False)
    field_type = Column(Enum(FieldType), nullable=False)
    options = Column(Text)  # JSON for select options
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    permissions = relationship("FieldPermission", back_populates="field", cascade="all, delete-orphan")
    values = relationship("CustomFieldValue", back_populates="field", cascade="all, delete-orphan")


class FieldPermission(Base):
    __tablename__ = "field_permissions"

    id = Column(Integer, primary_key=True)
    field_id = Column(Integer, ForeignKey("custom_fields.id"), nullable=False)
    role = Column(String(50), nullable=False)
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)
    field = relationship("CustomField", back_populates="permissions")


class CustomFieldValue(Base):
    __tablename__ = "custom_field_values"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    field_id = Column(Integer, ForeignKey("custom_fields.id"), nullable=False)
    value = Column(Text)
    member = relationship("Member", back_populates="custom_values")
    field = relationship("CustomField", back_populates="values")
