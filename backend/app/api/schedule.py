from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.schedule.service import ScheduleGenerateIn, create_schedule_draft, get_schedule

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


@router.post("/schedule/generate")
async def generate_schedule(body: ScheduleGenerateIn, request: Request, db: Session = Depends(get_db)):
    draft, action_id = await create_schedule_draft(body, db, request.app.state.settings, request.app.state.model_gateway)
    return {
        "date": draft.date.isoformat(), "timezone": draft.timezone,
        "blocks": [block.model_dump(mode="json") for block in draft.blocks],
        "conflicts": draft.conflicts, "pending_action_id": action_id,
    }

@router.get("/schedule")
def schedule_for_date(
    date_query: str = Query("today", alias="date"),
    timezone_name: str = "Asia/Calcutta",
    day: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        timezone = ZoneInfo(timezone_name)
        requested_day = day or date_query
        target_day = datetime.now(timezone).date() if requested_day == "today" else date.fromisoformat(requested_day)
    except (ValueError, ZoneInfoNotFoundError):
        raise AppError("invalid_date", "Provide date=today or a valid ISO date and timezone.", 422) from None
    return [
        {"id": block.id, "title": block.title, "starts_at": block.starts_at.isoformat(),
         "ends_at": block.ends_at.isoformat(), "rationale": block.rationale, "task_id": block.task_id,
         "timezone": timezone_name}
        for block in get_schedule(db, target_day)
    ]
