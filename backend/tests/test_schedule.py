from datetime import date, datetime, time

from app.schedule.service import FixedEvent, FlexibleTask, pack_day


def test_packer_places_tasks_around_events_with_buffer_and_deadlines():
    day = date(2026, 10, 20)
    fixed = [FixedEvent(
        title="Meeting",
        starts_at=datetime(2026, 10, 20, 11),
        ends_at=datetime(2026, 10, 20, 12),
    )]
    tasks = [
        FlexibleTask(title="Backend", duration_minutes=90, priority="high", deadline=datetime(2026, 10, 20, 11)),
        FlexibleTask(title="Frontend review", duration_minutes=60, priority="medium"),
    ]
    blocks, conflicts = pack_day(
        day, fixed, tasks, timezone_name="Asia/Calcutta",
        workday_start=time(9), workday_end=time(17), buffer_minutes=15,
    )
    assert not conflicts
    by_title = {block.title: block for block in blocks}
    assert by_title["Backend"].ends_at <= fixed[0].starts_at.replace(tzinfo=by_title["Backend"].starts_at.tzinfo)
    assert by_title["Frontend review"].starts_at >= fixed[0].ends_at.replace(tzinfo=by_title["Frontend review"].starts_at.tzinfo)
    assert by_title["Frontend review"].starts_at.hour >= 12
    for left, right in zip(blocks, blocks[1:], strict=False):
        assert left.ends_at <= right.starts_at


def test_packer_flags_deadline_and_overlapping_fixed_events():
    day = date(2026, 10, 20)
    fixed = [
        FixedEvent(title="A", starts_at=datetime(2026, 10, 20, 11), ends_at=datetime(2026, 10, 20, 12)),
        FixedEvent(title="B", starts_at=datetime(2026, 10, 20, 11, 30), ends_at=datetime(2026, 10, 20, 12, 30)),
    ]
    task = FlexibleTask(title="Too large", duration_minutes=120, deadline=datetime(2026, 10, 20, 10))
    blocks, conflicts = pack_day(
        day, fixed, [task], timezone_name="UTC",
        workday_start=time(9), workday_end=time(17), buffer_minutes=15,
    )
    assert [block.title for block in blocks] == ["A", "B"]
    assert {row["reason"] for row in conflicts} == {"overlaps_fixed_event", "deadline_or_workday_overflow"}


def test_schedule_proposal_requires_approval_before_creating_tasks(demo):
    result = demo.post("/api/schedule/generate", json={
        "request": "Tomorrow I have a meeting at 11. Before that I need to finish the backend, review the frontend PR and prepare the presentation. Class at 4.",
        "date": "2026-10-20",
    })
    assert result.status_code == 200
    proposal = result.json()
    assert proposal["pending_action_id"] > 0
    assert proposal["blocks"] and proposal["conflicts"] == []
    assert any(block["starts_at"].startswith("2026-10-20T16:") for block in proposal["blocks"])
    assert demo.get("/api/tasks").json() == []
    rejected = demo.post(f"/api/actions/{proposal['pending_action_id']}/reject")
    assert rejected.json()["status"] == "rejected"
    assert demo.get("/api/schedule", params={"day": "2026-10-20"}).json() == []


def test_approved_schedule_saves_task_rows_and_blocks(demo):
    proposal = demo.post("/api/schedule/generate", json={
        "request": "Finish the API",
        "date": "2026-10-20",
        "tasks": [{"title": "Finish the API", "duration_minutes": 90, "priority": "high"}],
    }).json()
    approved = demo.post(f"/api/actions/{proposal['pending_action_id']}/approve")
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    saved = demo.get("/api/schedule", params={"day": "2026-10-20"}).json()
    tasks = demo.get("/api/tasks").json()
    assert len(saved) == 1 and saved[0]["title"] == "Finish the API"
    assert len(tasks) == 1 and tasks[0]["source"] == "plan"
