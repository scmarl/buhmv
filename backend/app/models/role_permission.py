from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.db.session import Base


class RoleGroupPermission(Base):
    """Which groups a role can access (read / read+write)."""
    __tablename__ = "role_group_permissions"

    id = Column(Integer, primary_key=True)
    role = Column(String(50), nullable=False)      # 'admin','office','teamlead','member'
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    can_write = Column(Boolean, default=False)      # True = Lesen & Schreiben; False = Lesen


class RoleFieldCategoryPermission(Base):
    """Field-category-level access per role (Mitgliederdaten / Kontodaten / …)."""
    __tablename__ = "role_field_category_permissions"

    id = Column(Integer, primary_key=True)
    role = Column(String(50), nullable=False)
    category = Column(String(100), nullable=False)  # e.g. 'Mitgliederdaten', 'Kontodaten'
    can_view = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)


class RoleDefinition(Base):
    __tablename__ = 'role_definitions'
    name        = Column(String(50), primary_key=True)
    label       = Column(String(200), nullable=False)
    description = Column(String(500), default='')
    is_system   = Column(Boolean, default=False)
