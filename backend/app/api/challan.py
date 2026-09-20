from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_officer
from app.models.violation import Violation
from app.services.llm_service import generate_challan

router = APIRouter()

class ChallanRequest(BaseModel):
    violation_type: str
    rider_count:    int    = 1
    location:       str    = "Unknown"
    fine_amount:    int    = 1000
    plate_number:   str    = None

@router.post("/generate")
async def generate(
    req:     ChallanRequest,
    officer  = Depends(get_current_officer)
):
    text = await generate_challan(
        violation_type = req.violation_type,
        rider_count    = req.rider_count,
        location       = req.location,
        fine_amount    = req.fine_amount,
        plate_number   = req.plate_number,
    )
    return {"challan": text}

@router.get("/{violation_id}")
async def get_challan(
    violation_id: int,
    db:           AsyncSession = Depends(get_db),
    officer       = Depends(get_current_officer)
):
    result = await db.execute(select(Violation).where(Violation.id == violation_id))
    v      = result.scalar_one_or_none()
    if not v:
        return {"error": "Not found"}
    return {"violation_id": violation_id, "challan": v.challan_text}
