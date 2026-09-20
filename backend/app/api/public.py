"""
VIATRA Public API — No auth required
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from app.core.database import get_db
from app.models.violation import Violation
from app.services.vahan_service import lookup_vehicle

router = APIRouter()


# ── Health check ──────────────────────────────────
@router.get("/health")
async def health():
    return {"status":"ok","service":"VIATRA","version":"5.0"}


# ── Vehicle lookup (Vahan/Parivahan) ─────────────
@router.get("/vehicle/lookup")
async def vehicle_lookup(
    plate: str = Query(..., min_length=4, max_length=15,
                       description="Vehicle registration number")
):
    """
    Lookup vehicle owner details from Vahan database.
    Returns owner name, address, RC status, insurance validity.
    """
    clean  = "".join(c for c in plate.upper() if c.isalnum())
    result = await lookup_vehicle(clean)
    return result


# ── Challan lookup by plate ───────────────────────
@router.get("/challan/lookup")
async def lookup_by_plate(
    plate: str = Query(..., min_length=4, max_length=15),
    db:    AsyncSession = Depends(get_db)
):
    clean = "".join(c for c in plate.upper() if c.isalnum())
    if len(clean) < 4:
        raise HTTPException(400, "Enter at least 4 characters")

    result = await db.execute(
        select(Violation)
        .where(or_(
            Violation.plate_number == clean,
            Violation.plate_number.ilike(f"%{clean}%"),
        ))
        .order_by(Violation.created_at.desc())
        .limit(20)
    )
    violations = result.scalars().all()

    # Also fetch Vahan data for the plate
    vahan_data = await lookup_vehicle(clean)

    total_fine = sum(v.fine_amount or 0 for v in violations if v.status=="open")

    return {
        "found":      len(violations) > 0,
        "plate":      clean,
        "count":      len(violations),
        "total_fine": total_fine,
        "message":    f"Found {len(violations)} challan(s) for {clean}" if violations
                      else f"No challans found for {clean}",
        "vehicle_info": vahan_data,
        "challans":   [_public_view(v) for v in violations]
    }


# ── Single challan ────────────────────────────────
@router.get("/challan/{challan_id}")
async def get_challan(challan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Violation).where(Violation.id == challan_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Challan not found")
    return _public_view(v)


# ── Payment status check ──────────────────────────
@router.get("/challan/{challan_id}/payment-status")
async def check_payment(challan_id: int, db: AsyncSession = Depends(get_db)):
    """
    Check payment status. In production, this would call
    Parivahan payment API to sync status automatically.
    """
    result = await db.execute(
        select(Violation).where(Violation.id == challan_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Challan not found")

    return {
        "challan_id":    challan_id,
        "status":        v.status,
        "fine_amount":   v.fine_amount,
        "payment_link":  f"https://echallan.tspolice.gov.in/pay?challan={challan_id}",
        "upi_id":        "tspolice@upi",
        "parivahan_url": "https://echallan.tspolice.gov.in",
        "verify_url":    f"https://echallan.tspolice.gov.in/verify/{v.plate_number}",
    }


# ── Grievance ─────────────────────────────────────
class GrievanceIn(BaseModel):
    challan_id:  str
    name:        str = "Anonymous"
    phone:       str = ""
    reason:      str = ""
    description: str = ""

@router.post("/grievance")
async def submit_grievance(data: GrievanceIn):
    print(f"📩 Grievance: {data.challan_id} — {data.reason}")
    import time
    return {
        "success":   True,
        "reference": f"GRV{int(time.time())}",
        "message":   "Grievance submitted. Review within 7 working days.",
    }


# ── Report ────────────────────────────────────────
class ReportIn(BaseModel):
    type:        str
    location:    str
    description: str
    vehicle_no:  str = ""
    anonymous:   bool = True

@router.post("/report")
async def submit_report(data: ReportIn):
    print(f"📢 Report: {data.type} at {data.location}")
    import time
    return {
        "success":   True,
        "reference": f"RPT{int(time.time())}",
        "message":   "Report received. Thank you.",
    }


# ── Parivahan verify link ─────────────────────────
@router.get("/parivahan/verify")
async def parivahan_verify(plate: str = Query(...)):
    clean = "".join(c for c in plate.upper() if c.isalnum())
    return {
        "plate":          clean,
        "verify_url":     f"https://vahan.parivahan.gov.in/vahanservice/",
        "echallan_url":   "https://echallan.tspolice.gov.in",
        "parivahan_url":  "https://parivahan.gov.in",
        "digilocker_url": "https://digilocker.gov.in",
        "note": "Verify your vehicle RC and check challans on official Parivahan portal"
    }


def _public_view(v: Violation) -> dict:
    return {
        "id":             v.id,
        "challan_no":     f"TSTP{v.id:06d}",
        "vehicle_number": v.plate_number or "Not recorded",
        "violation_type": v.violation_type,
        "fine_amount":    v.fine_amount,
        "legal_section":  v.legal_section,
        "location":       v.location,
        "status":         v.status,
        "snapshot":       v.snapshot_path,
        "challan_text":   v.challan_text,
        "timestamp":      v.created_at.isoformat() if v.created_at else None,
        "payment_link":   "https://echallan.tspolice.gov.in",
        "parivahan_link": "https://parivahan.gov.in",
    }
