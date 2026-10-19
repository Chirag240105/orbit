import logging
import secrets

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import VERSION, router
from app.auth import auth_router
from app.config import Settings
from app.core.errors import install_error_handlers
from app.core.ratelimit import RateLimiter
from app.db.session import init_db
from app.providers import build_provider
from app.services.model_gateway import ModelGateway
from app.skills.registry import default_registry

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("orbit")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    init_db(settings.database_url, create_tables=settings.database_url in ("sqlite://", "sqlite:///:memory:"))
    app = FastAPI(title="ORBIT API", version=VERSION, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.settings = settings
    app.state.jwt_secret = settings.jwt_secret or secrets.token_urlsafe(48)
    app.state.auth_rate_limit = RateLimiter(limit=10, window_s=60)
    gateway = ModelGateway(settings)
    app.state.model_gateway = gateway
    app.state.provider = build_provider(settings, gateway)
    app.state.registry = default_registry()
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.origins, allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization"], allow_credentials=False,
    )
    install_error_handlers(app)
    app.include_router(router)
    app.include_router(auth_router)
    p = app.state.provider
    log.info("Provider: %s (%s) configured=%s demo=%s", p.name, p.model or "-", p.configured, p.is_demo)
    return app


def app_factory() -> FastAPI:  # uvicorn app.main:app_factory --factory
    return create_app()
