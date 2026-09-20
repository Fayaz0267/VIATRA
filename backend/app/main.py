from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api import violations, video, stats, challan, auth, admin
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.config import settings

app = FastAPI(
    title="VIATRA API",
    description="Violation Intelligence And Traffic Real-time Analysis with YOLO11 + ByteTrack + EasyOCR",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.SNAPSHOT_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR,   exist_ok=True)

app.mount("/snapshots", StaticFiles(directory=settings.SNAPSHOT_DIR), name="snapshots")

# ── Routers ───────────────────────────────────────
app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(admin.router,      prefix="/api/admin",      tags=["Admin"])
app.include_router(violations.router, prefix="/api/violations", tags=["Violations"])
app.include_router(video.router,      prefix="/api/video",      tags=["Video"])
app.include_router(stats.router,      prefix="/api/stats",      tags=["Stats"])
app.include_router(challan.router,    prefix="/api/challan",    tags=["Challan"])

# ── Startup: create tables + seed admin ───────────
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created")
    await _seed_admin()
    print(f"✅ LLM: {settings.LLM_PROVIDER}")
    print(f"✅ YOLO Model: {settings.YOLO_MODEL}")

async def _seed_admin():
    """Create default admin account if not exists."""
    from app.models.officer import Officer
    from app.core.auth import hash_password
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result  = await db.execute(select(Officer).where(Officer.email == settings.ADMIN_EMAIL))
        existing = result.scalar_one_or_none()
        if not existing:
            admin = Officer(
                name     = settings.ADMIN_NAME,
                email    = settings.ADMIN_EMAIL,
                password = hash_password(settings.ADMIN_PASSWORD),
                role     = "admin",
                status   = "approved",
            )
            db.add(admin)
            await db.commit()
            print(f"✅ Admin seeded: {settings.ADMIN_EMAIL} / {settings.ADMIN_PASSWORD}")
        else:
            print("✅ Admin already exists")

@app.get("/")
async def root():
    return {"status": "running", "version": "3.0.0", "model": settings.YOLO_MODEL}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/api/public/health")
async def health_public():
    return {"status": "healthy"}