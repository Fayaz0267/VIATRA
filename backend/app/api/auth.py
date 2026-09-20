from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.auth import (
    hash_password, verify_password,
    create_access_token, get_current_officer
)
from app.models.officer import Officer

router = APIRouter()

# ── Schemas ───────────────────────────────────────
class RegisterRequest(BaseModel):
    name:         str
    email:        EmailStr
    password:     str
    badge_number: Optional[str] = None
    rank:         Optional[str] = None
    station:      Optional[str] = None
    phone:        Optional[str] = None

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

# ── Register ──────────────────────────────────────
@router.post("/register", status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email exists
    existing = await db.execute(select(Officer).where(Officer.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check badge exists
    if req.badge_number:
        existing_badge = await db.execute(
            select(Officer).where(Officer.badge_number == req.badge_number)
        )
        if existing_badge.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Badge number already registered")

    officer = Officer(
        name         = req.name,
        email        = req.email,
        password     = hash_password(req.password),
        badge_number = req.badge_number,
        rank         = req.rank,
        station      = req.station,
        phone        = req.phone,
        role         = "officer",
        status       = "pending"
    )
    db.add(officer)
    await db.commit()
    await db.refresh(officer)
    return {
        "message": "Registration successful. Awaiting admin approval.",
        "id": officer.id
    }

# ── Login ─────────────────────────────────────────
@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result  = await db.execute(select(Officer).where(Officer.email == req.email))
    officer = result.scalar_one_or_none()

    if not officer or not verify_password(req.password, officer.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if officer.status == "pending":
        raise HTTPException(
            status_code=403,
            detail="PENDING: Your account is awaiting admin approval"
        )

    if officer.status == "rejected":
        raise HTTPException(
            status_code=403,
            detail="REJECTED: Your account has been rejected. Contact admin."
        )

    token = create_access_token({
        "sub":  str(officer.id),
        "role": officer.role
    })

    return {
        "access_token": token,
        "token_type":   "bearer",
        "officer":      officer.to_dict()
    }

# ── Get current officer (me) ──────────────────────
@router.get("/me")
async def get_me(officer = Depends(get_current_officer)):
    return officer.to_dict()
