import logging
import os
import secrets
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import VERSION, public, router
from app.config import Settings
from app.core.errors import install_error_handlers
from app.core.ratelimit import RateLimiter
from app.db.session import init_db
from app.providers import build_provider
from app.skills.registry import default_registry

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("orbit")
logging.getLogger("alembic.runtime.plugins").setLevel(logging.WARNING)


def _api_token(settings: Settings) -> str:
    """SEC-01: use ORBIT_API_TOKEN, or generate one per start. Written to token_file (owner-only where the OS
    supports it) for the dev proxy to read. The token value is never logged."""
    token = settings.api_token or secrets.token_urlsafe(32)
    if settings.token_file:
        path = Path(settings.token_file)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(token)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        log.info("Local API token written to %s", path)
    return token


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    init_db(settings.database_url)
    app = FastAPI(title="ORBIT API", version=VERSION, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.settings = settings
    app.state.provider = build_provider(settings)
    app.state.registry = default_registry()
    app.state.api_token = _api_token(settings)
    app.state.chat_limiter = RateLimiter(limit=settings.chat_rate_limit, window_s=60)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.origins, allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-Orbit-Token"], allow_credentials=False,
    )
    install_error_handlers(app)
    app.include_router(public)
    app.include_router(router)
    p = app.state.provider
    log.info("Provider: %s (%s) configured=%s demo=%s", p.name, p.model or "-", p.configured, p.is_demo)
    return app


def app_factory() -> FastAPI:  # uvicorn app.main:app_factory --factory
    return create_app()
