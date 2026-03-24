from app.db.session import SessionLocal
from app.models.member import Member
from datetime import date

members = [
    ("Max", "Müller", "max.mueller@example.de", "0711-111111", "1985-03-12", "M", "2010-01-15", "M-001"),
    ("Anna", "Schmidt", "anna.schmidt@example.de", "0711-222222", "1990-07-24", "W", "2012-06-01", "M-002"),
    ("Hans", "Meier", "hans.meier@example.de", "0711-333333", "1978-11-05", "M", "2008-09-10", "M-003"),
    ("Laura", "Fischer", "laura.fischer@example.de", "0711-444444", "1995-02-18", "W", "2018-03-20", "M-004"),
    ("Klaus", "Weber", "klaus.weber@example.de", "0711-555555", "1965-08-30", "M", "2005-05-15", "M-005"),
    ("Sandra", "Wagner", "sandra.wagner@example.de", "0711-666666", "1988-04-14", "W", "2015-11-01", "M-006"),
    ("Peter", "Becker", "peter.becker@example.de", "0711-777777", "1972-12-22", "M", "2007-02-28", "M-007"),
    ("Julia", "Hoffmann", "julia.hoffmann@example.de", "0711-888888", "1993-06-09", "W", "2019-07-15", "M-008"),
    ("Thomas", "Schulz", "thomas.schulz@example.de", "0711-999999", "1981-09-17", "M", "2011-04-05", "M-009"),
    ("Monika", "Koch", "monika.koch@example.de", "0711-101010", "1969-01-28", "W", "2003-08-12", "M-010"),
    ("Stefan", "Richter", "stefan.richter@example.de", "0711-112233", "1987-05-03", "M", "2016-01-20", "M-011"),
    ("Sabine", "Klein", "sabine.klein@example.de", "0711-445566", "1975-10-11", "W", "2009-06-30", "M-012"),
    ("Michael", "Wolf", "michael.wolf@example.de", "0711-778899", "1983-07-19", "M", "2013-10-08", "M-013"),
    ("Nicole", "Schröder", "nicole.schroeder@example.de", "0711-001122", "1991-03-25", "W", "2017-05-12", "M-014"),
    ("Andreas", "Neumann", "andreas.neumann@example.de", "0711-334455", "1968-11-08", "M", "2004-03-17", "M-015"),
    ("Petra", "Zimmermann", "petra.zimmermann@example.de", "0711-667788", "1979-06-15", "W", "2010-09-22", "M-016"),
    ("Markus", "Braun", "markus.braun@example.de", "0711-990011", "1994-08-27", "M", "2020-02-10", "M-017"),
    ("Christine", "Krause", "christine.krause@example.de", "0711-223344", "1986-01-04", "W", "2014-07-28", "M-018"),
    ("Jürgen", "Hartmann", "juergen.hartmann@example.de", "0711-556677", "1962-04-20", "M", "2001-11-05", "M-019"),
    ("Katharina", "Lange", "katharina.lange@example.de", "0711-889900", "1997-09-13", "W", "2021-04-01", "M-020"),
]

db = SessionLocal()
try:
    for first, last, email, phone, bdate, gender, edate, mnr in members:
        if not db.query(Member).filter(Member.member_number == mnr).first():
            db.add(Member(
                first_name=first, last_name=last, email=email, phone=phone,
                birthdate=date.fromisoformat(bdate), gender=gender,
                entry_date=date.fromisoformat(edate), member_number=mnr,
                city="Stuttgart", status="active", fee_status="paid", is_active=True,
            ))
    db.commit()
    print("20 Testmitglieder angelegt.")
finally:
    db.close()
