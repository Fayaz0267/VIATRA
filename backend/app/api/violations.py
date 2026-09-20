from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_officer
from app.models.violation import Violation

router = APIRouter()

class ViolationUpdate(BaseModel):
    plate_number:   Optional[str]   = None
    location:       Optional[str]   = None
    fine_amount:    Optional[int]   = None
    status:         Optional[str]   = None
    notes:          Optional[str]   = None
    challan_text:   Optional[str]   = None
    violation_type: Optional[str]   = None

@router.get("/")
async def get_violations(
    limit:          int = Query(50, le=200),
    offset:         int = 0,
    violation_type: Optional[str] = None,
    status:         Optional[str] = None,
    db:             AsyncSession = Depends(get_db),
    officer         = Depends(get_current_officer)
):
    query = select(Violation).order_by(desc(Violation.created_at))
    if violation_type:
        query = query.where(Violation.violation_type == violation_type)
    if status:
        query = query.where(Violation.status == status)
    query  = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return [v.to_dict() for v in result.scalars().all()]

@router.get("/{violation_id}")
async def get_violation(
    violation_id: int,
    db:           AsyncSession = Depends(get_db),
    officer       = Depends(get_current_officer)
):
    result = await db.execute(
        select(Violation).where(Violation.id == violation_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")
    return v.to_dict()

@router.patch("/{violation_id}")
async def update_violation(
    violation_id: int,
    body:         ViolationUpdate,
    db:           AsyncSession = Depends(get_db),
    officer       = Depends(get_current_officer)
):
    result = await db.execute(
        select(Violation).where(Violation.id == violation_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")

    if body.plate_number   is not None: v.plate_number   = body.plate_number
    if body.location       is not None: v.location       = body.location
    if body.fine_amount    is not None: v.fine_amount     = body.fine_amount
    if body.status         is not None: v.status          = body.status
    if body.notes          is not None: v.notes           = body.notes
    if body.challan_text   is not None: v.challan_text    = body.challan_text
    if body.violation_type is not None: v.violation_type  = body.violation_type

    await db.commit()
    await db.refresh(v)
    return {"message": "Updated successfully", "violation": v.to_dict()}

@router.delete("/{violation_id}")
async def delete_violation(
    violation_id: int,
    db:           AsyncSession = Depends(get_db),
    officer       = Depends(get_current_officer)
):
    result = await db.execute(
        select(Violation).where(Violation.id == violation_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")
    await db.delete(v)
    await db.commit()
    return {"message": "Deleted successfully", "id": violation_id}
