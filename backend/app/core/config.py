from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:admin123@localhost:5432/traffic_db"
    REDIS_URL:    str = "redis://localhost:6379"

    SECRET_KEY:                  str = "viatra-super-secret-jwt-key-2026"
    ALGORITHM:                   str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    LLM_PROVIDER:   str           = "gemini"
    GEMINI_API_KEY: Optional[str] = None
    CLAUDE_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # ── Plate Recognizer API ──────────────────────
    PLATE_RECOGNIZER_KEY: Optional[str] = None
    SUREPASS_API_KEY:     Optional[str] = None   # https://surepass.io/
    VAHAN_API_KEY:        Optional[str] = None   # https://vahan.parivahan.gov.in

    # ── Detection thresholds ──────────────────────
    YOLO_CONFIDENCE:   float = 0.12
    HELMET_CONFIDENCE: float = 0.45
    MAX_RIDERS:        int   = 2
    SPEED_LIMIT_KMH:   float = 40.0

    # ── Models ────────────────────────────────────
    # Primary: VisDrone fine-tuned (top-down CCTV)
    # Fallback: yolov8n.pt (general)
    YOLO_MODEL:        str = "yolov8x-visdrone.pt"  # change to yolo11n.pt if no visdrone model
    YOLO_FALLBACK:     str = "yolov8n.pt"
    HELMET_MODEL:      str = "helmet_model.pt"

    # Storage
    SNAPSHOT_DIR: str = "snapshots"
    UPLOAD_DIR:   str = "uploads"

    # Admin
    ADMIN_EMAIL:    str = "admin@viatra.gov.in"
    ADMIN_PASSWORD: str = "Admin@1234"
    ADMIN_NAME:     str = "Super Admin"

    APP_NAME: str = "VIATRA"
    APP_FULL: str = "Violation Intelligence And Traffic Real-time Analysis"

    class Config:
        env_file = ".env"

settings = Settings()
