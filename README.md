# BuHMV – Vereins-Mitgliederverwaltung

Webbasierte Mitgliederverwaltung für Vereine. Läuft vollständig im lokalen Netzwerk (LAN-only).

## Stack

- **Backend**: Python 3.12 · FastAPI · SQLAlchemy 2 · PostgreSQL
- **Frontend**: React 18 · TypeScript · Vite · TanStack Query · React Hook Form

## Schnellstart (Docker)

```bash
cp backend/.env.example backend/.env
# SECRET_KEY in backend/.env anpassen!

docker compose up --build -d
```

- Frontend: http://192.168.11.131:3000
- Backend API: http://192.168.11.131:8000/docs
- Standard-Login: admin / admin (nach erstem Start ändern!)

## Entwicklung (lokal)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.db.init_db
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Konfiguration

| Variable | Beschreibung | Standard |
|---|---|---|
| `DATABASE_URL` | PostgreSQL Connection String | `postgresql://buhmv:buhmv@db:5432/buhmv` |
| `SECRET_KEY` | JWT Signing Key | **Pflicht ändern!** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token-Gültigkeit | `480` (8h) |
| `VITE_API_BASE_URL` | Backend-URL für Frontend | `/api` |

## Rollen

| Rolle | Zugriff |
|---|---|
| `admin` | Vollzugriff inkl. Import, Felder, Dubletten |
| `office` | Mitglieder lesen/schreiben, Suche, Export, Stats |
| `teamlead` | Mitglieder lesen, Suche |
| `member` | Nur eigenes Profil |
