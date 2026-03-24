from app.db.session import engine, Base
from app.models import user, member, group, field, saved_view  # noqa
from app.core.security import get_password_hash
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.user import User, Role
from app.models.field import CustomField, FieldType
import json

SYSTEM_FIELDS = [
    # name, label, field_type, category, options, is_required, sort_order
    ("member_number", "Mitgliedsnummer",  "text",     "Mitgliedschaft", None, False, 0),
    ("first_name",    "Vorname",          "text",     "Stammdaten",     None, True,  1),
    ("last_name",     "Nachname",         "text",     "Stammdaten",     None, True,  2),
    ("gender",        "Geschlecht",       "select",   "Stammdaten",
     json.dumps(["männlich", "weiblich", "divers"]), False, 3),
    ("birthdate",     "Geburtsdatum",     "date",     "Stammdaten",     None, False, 4),
    ("email",         "E-Mail",           "text",     "Kontakt",        None, False, 5),
    ("phone",         "Telefon",          "text",     "Kontakt",        None, False, 6),
    ("mobile",        "Mobil",            "text",     "Kontakt",        None, False, 7),
    ("street",        "Straße",           "text",     "Kontakt",        None, False, 8),
    ("zip_code",      "PLZ",              "text",     "Kontakt",        None, False, 9),
    ("city",          "Ort",              "text",     "Kontakt",        None, False, 10),
    ("entry_date",    "Eintrittsdatum",   "date",     "Mitgliedschaft", None, False, 1),
    ("exit_date",     "Austrittsdatum",   "date",     "Mitgliedschaft", None, False, 2),
    ("status",        "Mitgliedstatus",   "select",   "Mitgliedschaft",
     json.dumps(["aktiv", "inaktiv", "Ehrenmitglied", "Gastmitglied"]), False, 3),
    ("fee_status",    "Beitragsstatus",   "select",   "Mitgliedschaft",
     json.dumps(["bezahlt", "ausstehend", "befreit"]), False, 4),
    ("is_active",     "Aktiv",            "checkbox", "Mitgliedschaft", None, False, 5),
    ("photo_url",     "Foto",             "image",    "Stammdaten",     None, False, 99),
    ("notes_field",   "Notizen",          "textarea", "Sonstiges",      None, False, 0),
]


def init_db():
    Base.metadata.create_all(bind=engine)

    # Add is_system column if it does not exist yet
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()

    with Session(engine) as db:
        # Default admin user
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

        # Seed system fields (insert only if not present)
        for (name, label, ftype, category, options, is_required, sort_order) in SYSTEM_FIELDS:
            if not db.query(CustomField).filter(CustomField.name == name).first():
                db.add(CustomField(
                    name=name,
                    label=label,
                    field_type=ftype,
                    category=category,
                    options=options,
                    is_required=is_required,
                    sort_order=sort_order,
                    is_system=True,
                ))
        db.commit()
        print("System fields seeded.")


if __name__ == "__main__":
    init_db()
