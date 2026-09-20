from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db

pwd_context    = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme  = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── Password utils ────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ── JWT utils ─────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# ── Get current officer from token ────────────────
async def get_current_officer(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    from app.models.officer import Officer
    payload = decode_token(token)
    officer_id = payload.get("sub")
    if not officer_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(Officer).where(Officer.id == int(officer_id)))
    officer = result.scalar_one_or_none()
    if not officer:
        raise HTTPException(status_code=401, detail="Officer not found")
    if officer.status != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    return officer

# ── Admin only guard ──────────────────────────────
async def get_admin_officer(officer=Depends(get_current_officer)):
    if officer.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return officer
