from app.db.session import engine, Base
from app.models import user, member, group, field, saved_view  # noqa: import all models
from app.core.security import get_password_hash
from sqlalchemy.orm import Session
from app.models.user import User, Role


def init_db():
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(
                username="admin",
                email="admin@buhmv.local",
                hashed_password=get_password_hash("admin"),
                role=Role.admin,
                is_active=True,
            ))
            db.commit()
            print("Created default admin user (password: admin)")


if __name__ == "__main__":
    init_db()
