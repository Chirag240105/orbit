import logging
import secrets
import time
from collections import deque
from types import SimpleNamespace

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.agent.orchestrator import run_chat
from app.api.routes import VERSION, chat_limit, router
from app.auth import auth_router, verify_token
from app.config import Settings
from app.core.errors import AppError, install_error_handlers
from app.core.ratelimit import RateLimiter
from app.db.session import get_db, init_db
from app.providers import build_provider
from app.providers.base import ChatProvider, ProviderResult
from app.schemas import ChatRequest
from app.services.model_gateway import JSON_TASKS, ModelGateway
from app.services.scene_generator import SceneGenerator
from app.skills.registry import default_registry

# Tasks that produce structured JSON — these must NEVER stream token-by-token to the client.
# The model output is buffered server-side and the frontend only receives the final "done" event.
# Conversational tasks (chat, planner, code_explain) keep streaming normally.
_STRUCTURED_TASKS = JSON_TASKS | {"planner", "scene_generation", "plan", "code_explain"}


class _StreamingProvider(ChatProvider):
    def __init__(self, base: ChatProvider, gateway: ModelGateway, emit):
        self.base, self.gateway, self.emit = base, gateway, emit
        self.name, self.model = base.name, base.model
        self.is_demo, self.configured = base.is_demo, base.configured

    async def complete(self, messages: list[dict], task: str = "chat") -> ProviderResult:
        started = time.perf_counter()
        chunks = []
        reasoning_chunks = []
        model = self.gateway.model_for(task)
        is_structured = task in _STRUCTURED_TASKS
        async for kind, chunk in self.gateway.stream_deltas(messages, task=task):
            if kind == "model":
                model = chunk
            elif kind == "reasoning":
                reasoning_chunks.append(chunk)
                # Reasoning deltas go to the debug panel only, never main chat
                await self.emit("reasoning_delta", {"text": chunk})
            else:
                chunks.append(chunk)
                if not is_structured:
                    # Conversational tasks only: stream tokens to the client
                    await self.emit("token", {"text": chunk})
        # For structured tasks, signal completion without leaking raw JSON fragments
        if is_structured:
            await self.emit("processing_complete", {"task": task})
        return ProviderResult(
            "".join(chunks),
            model,
            False,
            self.name,
            round((time.perf_counter() - started) * 1000),
            reasoning_trace="".join(reasoning_chunks) or None,
        )


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("orbit")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    init_db(settings.database_url)
    app = FastAPI(title="ORBIT API", version=VERSION, docs_url="/api/docs", openapi_url="/api/openapi.json")

    @app.get("/health", include_in_schema=False)
    def liveness():
        return {"status": "ok"}

    app.state.settings = settings
    app.state.jwt_secret = settings.jwt_secret or secrets.token_urlsafe(48)
    app.state.auth_rate_limit = RateLimiter(limit=10, window_s=60)
    app.state.last_turns = deque(maxlen=50)
    gateway = ModelGateway(settings)
    app.state.model_gateway = gateway
    app.state.provider = build_provider(settings, gateway)
    app.state.registry = default_registry()
    app.state.scene_generator = SceneGenerator(gateway)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
        allow_credentials=False,
    )
    install_error_handlers(app)
    app.include_router(router)
    app.include_router(auth_router)

    @app.websocket("/ws/chat")
    async def websocket_chat(websocket: WebSocket):
        origin = websocket.headers.get("origin")
        if origin and origin not in settings.origins:
            await websocket.close(code=4403)
            return
        await websocket.accept()
        db_iter = get_db()
        db = next(db_iter)

        async def emit(event: str, data: dict):
            await websocket.send_json({"event": event, "data": data})

        try:
            frame = await websocket.receive_json()
            user_id = verify_token(frame.get("token", ""), app.state.jwt_secret)
            chat_limit(SimpleNamespace(client=websocket.client, state=SimpleNamespace(user_id=user_id)))
            db.info["user_id"] = user_id
            user_request = ChatRequest(**frame.get("request", {}))
            provider = app.state.provider
            if not provider.is_demo:
                provider = _StreamingProvider(provider, app.state.model_gateway, emit)
            response = await run_chat(
                user_request,
                db,
                settings,
                provider,
                app.state.registry,
                app.state.model_gateway,
                app.state.last_turns,
                emit,
            )
            await emit("done", response.model_dump(mode="json"))
        except WebSocketDisconnect:
            return
        except AppError as exc:
            if exc.status == 401:
                await websocket.send_json({"event": "auth_expired", "data": {}})
            await emit("error", {"code": exc.code, "message": exc.message, "details": exc.details})
        except Exception:
            log.exception("websocket chat failed")
            await emit("error", {"code": "chat_failed", "message": "ORBIT could not complete this request."})
        finally:
            db.close()
            db_iter.close()
            try:
                await websocket.close()
            except RuntimeError:
                pass

    p = app.state.provider
    log.info("Provider: %s (%s) configured=%s demo=%s", p.name, p.model or "-", p.configured, p.is_demo)
    return app


def app_factory() -> FastAPI:  # uvicorn app.main:app_factory --factory
    return create_app()
