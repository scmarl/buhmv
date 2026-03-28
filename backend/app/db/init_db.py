from app.db.session import engine, Base
from app.models import user, member, group, field, saved_view, list_view, email_template, email_attachment, email_settings, audit_log, email_history, role_permission, app_branding  # noqa
from app.core.security import get_password_hash
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.user import User, Role
from app.models.field import CustomField, FieldPermission
from app.models.role_permission import RoleGroupPermission, RoleFieldCategoryPermission, RoleDefinition
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
    ("email",         "E-Mail",         "email",    "Kontakt",        None, False, 5, False),
    ("phone",         "Telefon",        "text",     "Kontakt",        None, False, 6, False),
    ("mobile",        "Mobil",          "text",     "Kontakt",        None, False, 7, False),
    ("street",        "Straße",         "text",     "Kontakt",        None, False, 8, False),
    ("zip_code",      "PLZ",            "text",     "Kontakt",        None, False, 9, False),
    ("city",          "Ort",            "text",     "Kontakt",        None, False, 10, False),
    ("member_number", "Mitgliedsnummer","text",     "Mitgliedschaft", None, False, 0, False),
    ("entry_date",    "Eintrittsdatum", "date",     "Mitgliedschaft", None, False, 1, False),
    ("exit_date",     "Austrittsdatum", "date",     "Mitgliedschaft", None, False, 2, False),
    ("death_date",    "Verstorben am",   "date",     "Mitgliedschaft", None, False, 3, False),
    ("notes_field",   "Notizen",        "textarea", "Sonstiges",      None, False, 0, False),
    # Kontodaten – role-restricted (Admin/Office only by default)
    ("bank_name",     "Bankname",       "text",     "Kontodaten",     None, False, 1, True),
    ("bic",           "BIC",            "text",     "Kontodaten",     None, False, 2, True),
    ("iban",          "IBAN",           "text",     "Kontodaten",     None, False, 3, True),
    ("sepa_ls_vfs",   "SEPA LS VfS",   "checkbox", "Kontodaten",     None, False, 4, True),
    ("sepa_ls_ahv",   "SEPA LS AHV",   "checkbox", "Kontodaten",     None, False, 5, True),
]


def init_db():
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS default_value TEXT"
        ))
        conn.execute(text("ALTER TABLE members ADD COLUMN IF NOT EXISTS death_date DATE"))
        # Migrate users.role from PG enum to varchar (idempotent)
        conn.execute(text("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50) USING role::text"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP DEFAULT NULL"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS role_definitions (
                name VARCHAR(50) PRIMARY KEY,
                label VARCHAR(200) NOT NULL,
                description VARCHAR(500) DEFAULT '',
                is_system BOOLEAN DEFAULT FALSE
            )
        """))
        conn.execute(text("ALTER TABLE members DROP COLUMN IF EXISTS status"))
        conn.execute(text("ALTER TABLE members DROP COLUMN IF EXISTS fee_status"))
        conn.execute(text("ALTER TABLE members ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200)"))
        conn.execute(text("ALTER TABLE members ADD COLUMN IF NOT EXISTS bic VARCHAR(20)"))
        conn.execute(text("ALTER TABLE members ADD COLUMN IF NOT EXISTS iban VARCHAR(50)"))
        conn.execute(text("ALTER TABLE members ADD COLUMN IF NOT EXISTS sepa_ls_vfs BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE members ADD COLUMN IF NOT EXISTS sepa_ls_ahv BOOLEAN DEFAULT FALSE"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS list_views (id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, columns TEXT NOT NULL, is_default BOOLEAN DEFAULT FALSE)"))
        conn.execute(text("ALTER TABLE list_views ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE list_views ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL"))
        # Add new enum values (must be outside a transaction in PG)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS email_templates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                subject VARCHAR(500) DEFAULT '',
                title VARCHAR(500) DEFAULT 'E-Mail Titel',
                body TEXT DEFAULT '',
                footer_text TEXT DEFAULT '',
                design VARCHAR(50) DEFAULT 'standard',
                show_header BOOLEAN DEFAULT TRUE,
                show_footer BOOLEAN DEFAULT TRUE,
                show_button BOOLEAN DEFAULT FALSE,
                button_text VARCHAR(200) DEFAULT 'Mehr erfahren',
                button_url VARCHAR(500) DEFAULT '',
                show_button_text_after BOOLEAN DEFAULT FALSE,
                button_text_after TEXT DEFAULT '',
                primary_color VARCHAR(20) DEFAULT '#2a5298',
                visibility VARCHAR(20) DEFAULT 'private',
                created_by VARCHAR(100) DEFAULT '',
                created_at VARCHAR(50) DEFAULT ''
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_branding (
                id INTEGER PRIMARY KEY DEFAULT 1,
                club_name VARCHAR(200) DEFAULT 'Mein Verein',
                logo_url TEXT DEFAULT '',
                primary_color VARCHAR(20) DEFAULT '#2a5298',
                header_text_color VARCHAR(20) DEFAULT '#ffffff',
                sidebar_bg VARCHAR(20) DEFAULT '#ffffff',
                sidebar_text_color VARCHAR(20) DEFAULT '#374151',
                workspace_bg VARCHAR(20) DEFAULT '#f3f4f6',
                updated_by VARCHAR(100) DEFAULT '',
                updated_at VARCHAR(50) DEFAULT ''
            )
        """))
        conn.execute(text("COMMIT"))
        conn.execute(text("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'email'"))
        # email_templates new columns (idempotent)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS email_history (
                id SERIAL PRIMARY KEY,
                sent_at VARCHAR(50) DEFAULT '',
                username VARCHAR(100) DEFAULT '',
                subject VARCHAR(500) DEFAULT '',
                recipient_count INTEGER DEFAULT 0,
                template_name VARCHAR(200) DEFAULT '',
                body_preview TEXT DEFAULT '',
                color_scheme TEXT DEFAULT '{}',
                design VARCHAR(50) DEFAULT 'standard',
                primary_color VARCHAR(20) DEFAULT '#2a5298'
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS email_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                send_mode VARCHAR(20) DEFAULT 'mailto',
                smtp_host VARCHAR(500) DEFAULT '',
                smtp_port INTEGER DEFAULT 587,
                smtp_security VARCHAR(20) DEFAULT 'starttls',
                smtp_username VARCHAR(500) DEFAULT '',
                smtp_password VARCHAR(1000) DEFAULT '',
                smtp_from VARCHAR(500) DEFAULT '',
                updated_by VARCHAR(100) DEFAULT '',
                updated_at VARCHAR(50) DEFAULT ''
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                timestamp VARCHAR(50) NOT NULL,
                username VARCHAR(100) DEFAULT '',
                category VARCHAR(50) DEFAULT '',
                action VARCHAR(100) DEFAULT '',
                target VARCHAR(500) DEFAULT '',
                detail TEXT DEFAULT ''
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS role_group_permissions (
                id SERIAL PRIMARY KEY,
                role VARCHAR(50) NOT NULL,
                group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                can_write BOOLEAN DEFAULT FALSE
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS role_field_category_permissions (
                id SERIAL PRIMARY KEY,
                role VARCHAR(50) NOT NULL,
                category VARCHAR(100) NOT NULL,
                can_view BOOLEAN DEFAULT FALSE,
                can_edit BOOLEAN DEFAULT FALSE
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS email_attachments (
                id SERIAL PRIMARY KEY,
                template_id INTEGER REFERENCES email_templates(id) ON DELETE CASCADE,
                original_name VARCHAR(500) NOT NULL,
                stored_name VARCHAR(500) NOT NULL,
                file_size INTEGER DEFAULT 0,
                mime_type VARCHAR(200) DEFAULT '',
                uploaded_at VARCHAR(50) DEFAULT ''
            )
        """))

        for col_sql in [
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS title VARCHAR(500) DEFAULT 'E-Mail Titel'",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS footer_text TEXT DEFAULT ''",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS show_button BOOLEAN DEFAULT FALSE",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_text VARCHAR(200) DEFAULT 'Mehr erfahren'",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_url VARCHAR(500) DEFAULT ''",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS show_button_text_after BOOLEAN DEFAULT FALSE",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_text_after TEXT DEFAULT ''",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS color_scheme TEXT DEFAULT '{}'",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS header_line1 VARCHAR(500) DEFAULT ''",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS header_line2 VARCHAR(500) DEFAULT ''",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS header_subtitle VARCHAR(500) DEFAULT ''",
            "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT ''",
        ]:
            conn.execute(text(col_sql))

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

        # Seed FieldPermissions for Kontodaten fields (Admin/Office only)
        kontodaten_fields = ["bank_name", "bic", "iban", "sepa_ls_vfs", "sepa_ls_ahv"]
        role_perms = [
            ("admin",             True,  True),
            ("office",            True,  True),
            ("teamlead",          False, False),
            ("member_self_service", False, False),
        ]
        for fname in kontodaten_fields:
            field_obj = db.query(CustomField).filter(CustomField.name == fname).first()
            if field_obj:
                for role, can_view, can_edit in role_perms:
                    exists = db.query(FieldPermission).filter(
                        FieldPermission.field_id == field_obj.id,
                        FieldPermission.role == role
                    ).first()
                    if not exists:
                        db.add(FieldPermission(
                            field_id=field_obj.id,
                            role=role,
                            can_view=can_view,
                            can_edit=can_edit,
                        ))
        db.commit()
        print("Kontodaten field permissions seeded.")

        # Seed default RoleFieldCategoryPermissions
        DEFAULT_CATEGORY_PERMS = [
            # role,           category,           can_view, can_edit
            ('office',        'Mitgliederdaten',  True,  True),
            ('office',        'Kontodaten',       True,  True),
            ('teamlead',      'Mitgliederdaten',  True,  False),
            ('teamlead',      'Kontodaten',       False, False),
            ('member',        'Mitgliederdaten',  True,  False),
            ('member',        'Kontodaten',       False, False),
        ]
        for role, cat, cv, ce in DEFAULT_CATEGORY_PERMS:
            exists = db.query(RoleFieldCategoryPermission).filter(
                RoleFieldCategoryPermission.role == role,
                RoleFieldCategoryPermission.category == cat,
            ).first()
            if not exists:
                db.add(RoleFieldCategoryPermission(role=role, category=cat, can_view=cv, can_edit=ce))
        db.commit()
        print('Default role field category permissions seeded.')

        # Seed system role definitions
        SYSTEM_ROLES = [
            ('admin',    'Administrator',           'Vollzugriff auf alle Daten und Funktionen.'),
            ('office',   'Geschäftsstelle (Office)','Mitgliederpflege ohne Benutzerverwaltung.'),
            ('teamlead', 'Teamleiter',              'Lesezugriff auf Mitgliederlisten und Statistiken.'),
            ('member',   'Mitglied',                'Nur das eigene Profil (MemberSelfService).'),
        ]
        for name, label, desc in SYSTEM_ROLES:
            if not db.query(RoleDefinition).filter(RoleDefinition.name == name).first():
                db.add(RoleDefinition(name=name, label=label, description=desc, is_system=True))
        db.commit()
        print('System role definitions seeded.')


if __name__ == "__main__":
    init_db()
