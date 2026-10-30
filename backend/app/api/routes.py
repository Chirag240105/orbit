"""Compatibility export and composition of the domain API routers."""
from fastapi import APIRouter

from app.api.actions import router as actions_router
from app.api.chat import chat_limit
from app.api.chat import router as chat_router
from app.api.code import router as code_router
from app.api.health import VERSION
from app.api.health import router as health_router
from app.api.memory import router as memory_router
from app.api.projects import router as projects_router
from app.api.repo_design import router as repo_design_router
from app.api.schedule import router as schedule_router
from app.api.skills import router as skills_router
from app.api.tasks import router as tasks_router
from app.api.vision import router as vision_router

router = APIRouter()
__all__ = ["VERSION", "chat_limit", "router"]
for domain_router in (
    health_router, chat_router, actions_router, projects_router, memory_router,
    vision_router, skills_router, code_router, schedule_router, tasks_router,
    repo_design_router,
):
    router.include_router(domain_router)
