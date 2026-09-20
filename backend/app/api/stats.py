from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, extract
from app.core.database import get_db
from app.core.auth import get_current_officer
from app.models.violation import Violation

router = APIRouter()

@router.get("/summary")
async def get_summary(
    db:      AsyncSession = Depends(get_db),
    officer  = Depends(get_current_officer)
):
    total      = await db.scalar(select(func.count(Violation.id)))
    no_helmet  = await db.scalar(select(func.count(Violation.id)).where(Violation.violation_type == "no_helmet"))
    triple     = await db.scalar(select(func.count(Violation.id)).where(Violation.violation_type == "triple_riding"))
    both       = await db.scalar(select(func.count(Violation.id)).where(Violation.violation_type == "both"))
    fines      = await db.scalar(select(func.sum(Violation.fine_amount)))
    paid       = await db.scalar(select(func.count(Violation.id)).where(Violation.status == "paid"))
    open_count = await db.scalar(select(func.count(Violation.id)).where(Violation.status == "open"))

    return {
        "total_violations": total or 0,
        "no_helmet":        no_helmet or 0,
        "triple_riding":    triple or 0,
        "both":             both or 0,
        "total_fines":      fines or 0,
        "challans_sent":    total or 0,
        "paid":             paid or 0,
        "open":             open_count or 0,
    }

@router.get("/by-day")
async def get_by_day(
    db:     AsyncSession = Depends(get_db),
    officer = Depends(get_current_officer)
):
    result = await db.execute(
        select(
            cast(Violation.created_at, Date).label("date"),
            func.count(Violation.id).label("count"),
            func.sum(Violation.fine_amount).label("fines")
        )
        .group_by(cast(Violation.created_at, Date))
        .order_by(cast(Violation.created_at, Date))
        .limit(30)
    )
    return [{"date": str(r.date), "count": r.count, "fines": r.fines or 0} for r in result.all()]

@router.get("/by-type")
async def get_by_type(
    db:     AsyncSession = Depends(get_db),
    officer = Depends(get_current_officer)
):
    result = await db.execute(
        select(Violation.violation_type, func.count(Violation.id).label("count"))
        .group_by(Violation.violation_type)
    )
    return [{"type": r.violation_type, "count": r.count} for r in result.all()]

@router.get("/by-hour")
async def get_by_hour(
    db:     AsyncSession = Depends(get_db),
    officer = Depends(get_current_officer)
):
    result = await db.execute(
        select(
            extract("hour", Violation.created_at).label("hour"),
            func.count(Violation.id).label("count")
        )
        .group_by(extract("hour", Violation.created_at))
        .order_by(extract("hour", Violation.created_at))
    )
    return [{"hour": int(r.hour), "count": r.count} for r in result.all()]

@router.get("/by-location")
async def get_by_location(
    db:     AsyncSession = Depends(get_db),
    officer = Depends(get_current_officer)
):
    result = await db.execute(
        select(Violation.location, func.count(Violation.id).label("count"))
        .group_by(Violation.location)
        .order_by(func.count(Violation.id).desc())
        .limit(10)
    )
    return [{"location": r.location, "count": r.count} for r in result.all()]
