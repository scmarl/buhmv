from app.db.session import engine, Base
from app.models import user, member, group, field, saved_view  # noqa
from app.core.security import get_password_hash
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.user import User, Role
from app.models.field import CustomField
import json

# is_system=True  → Stammdaten (Typ gesperrt, nicht löschbar)
# is_system=False → Kontakt / Mitgliedschaft / Sonstiges (voll bearbeitbar)
SYSTEM_FIELDS = [
    # name, label, field_type, category, options, is_required, sort_order, is_system
    ("first_name",    "Vorname",        "text",     "Stammdaten",     None, True,  1, True),
    ("last_name",     "Nachname",       "text",     "Stammdaten",     None, True,  2, True),
    ("gender",        "Geschlecht",     "select",   "Stammdaten",
     json.dumps(["männlich", "weiblich", "divers"]),         False, 3, True),
    ("birthdate",     "Geburtsdatum",   "date",     "Stammdaten",     None, False, 4, True),
    ("photo_url",     "Foto",           "image",    "Stammdaten",     None, False, 99, True),
    ("email",         "E-Mail",         "text",     "Kontakt",        None, False, 5, False),
    ("phone",         "Telefon",        "text",     "Kontakt",        None, False, 6, False),
    ("mobile",        "Mobil",          "text",     "Kontakt",        None, False, 7, False),
    ("street",        "Straße",         "text",     "Kontakt",        None, False, 8, False),
    ("zip_code",      "PLZ",            "text",     "Kontakt",        None, False, 9, False),
    ("city",          "Ort",            "text",     "Kontakt",        None, False, 10, False),
    ("member_number", "Mitgliedsnummer","text",     "Mitgliedschaft", None, False, 0, False),
    ("entry_date",    "Eintrittsdatum", "date",     "Mitgliedschaft", None, False, 1, False),
    ("exit_date",     "Austrittsdatum", "date",     "Mitgliedschaft", None, False, 2, False),
    ("notes_field",   "Notizen",        "textarea", "Sonstiges",      None, False, 0, False),
]


def init_db():
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()

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

        for row in SYSTEM_FIELDS:
            name, label, ftype, category, options, is_required, sort_order, is_system = row
            if not db.query(CustomField).filter(CustomField.name == name).first():
                db.add(CustomField(
                    name=name, label=label, field_type=ftype,
                    category=category, options=options,
                    is_required=is_required, sort_order=sort_order,
                    is_system=is_system,
                ))
        db.commit()
        print("System fields seeded.")


if __name__ == "__main__":
    init_db()
