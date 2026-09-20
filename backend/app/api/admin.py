from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_admin_officer
from app.models.officer import Officer

router = APIRouter()

# ── All officers (pending, approved, rejected) ────
@router.get("/officers")
async def get_all_officers(
    status: str = None,
    db:     AsyncSession = Depends(get_db),
    admin   = Depends(get_admin_officer)
):
    query = select(Officer).where(Officer.role != "admin").order_by(desc(Officer.created_at))
    if status:
        query = query.where(Officer.status == status)
    result = await db.execute(query)
    officers = result.scalars().all()
    return [o.to_dict() for o in officers]

# ── Approve officer ───────────────────────────────
@router.patch("/officers/{officer_id}/approve")
async def approve_officer(
    officer_id: int,
    db:         AsyncSession = Depends(get_db),
    admin       = Depends(get_admin_officer)
):
    result  = await db.execute(select(Officer).where(Officer.id == officer_id))
    officer = result.scalar_one_or_none()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    officer.status      = "approved"
    officer.approved_at = datetime.utcnow()
    await db.commit()
    return {"message": f"{officer.name} approved successfully", "officer": officer.to_dict()}

# ── Reject officer ────────────────────────────────
@router.patch("/officers/{officer_id}/reject")
async def reject_officer(
    officer_id: int,
    db:         AsyncSession = Depends(get_db),
    admin       = Depends(get_admin_officer)
):
    result  = await db.execute(select(Officer).where(Officer.id == officer_id))
    officer = result.scalar_one_or_none()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    officer.status = "rejected"
    await db.commit()
    return {"message": f"{officer.name} rejected", "officer": officer.to_dict()}

# ── Delete officer ────────────────────────────────
@router.delete("/officers/{officer_id}")
async def delete_officer(
    officer_id: int,
    db:         AsyncSession = Depends(get_db),
    admin       = Depends(get_admin_officer)
):
    result  = await db.execute(select(Officer).where(Officer.id == officer_id))
    officer = result.scalar_one_or_none()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    await db.delete(officer)
    await db.commit()
    return {"message": "Officer deleted"}

# ── Summary counts ────────────────────────────────
@router.get("/summary")
async def admin_summary(
    db:    AsyncSession = Depends(get_db),
    admin  = Depends(get_admin_officer)
):
    from sqlalchemy import func
    total    = await db.scalar(select(func.count(Officer.id)).where(Officer.role != "admin"))
    pending  = await db.scalar(select(func.count(Officer.id)).where(Officer.status == "pending"))
    approved = await db.scalar(select(func.count(Officer.id)).where(Officer.status == "approved"))
    rejected = await db.scalar(select(func.count(Officer.id)).where(Officer.status == "rejected"))
    return {
        "total": total or 0,
        "pending": pending or 0,
        "approved": approved or 0,
        "rejected": rejected or 0
    }
