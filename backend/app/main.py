from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import auth, members, groups, fields, search, views, import_, export, stats, duplicates, list_views

app = FastAPI(title=settings.APP_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(groups.router)
app.include_router(fields.router)
app.include_router(search.router)
app.include_router(views.router)
app.include_router(import_.router)
app.include_router(export.router)
app.include_router(stats.router)
app.include_router(duplicates.router)
app.include_router(list_views.router)


@app.get("/health")
def health():
    return {"status": "ok"}
