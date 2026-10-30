"""Generates a 3D learning scene for any system by asking the configured model for a structured design."""

import hashlib
import json
import logging
import re
from collections import OrderedDict
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from app.core.errors import AppError
from app.services.cached_scenes import CACHED_SCENES
from app.services.model_gateway import ModelGateway

log = logging.getLogger("orbit.scene_generator")

KINDS = (
    "user", "mobile", "client", "edge", "gateway", "service", "agent", "ai", "database", "cache", "queue",
    "payment", "cart", "warehouse", "security", "ledger", "memory", "network", "output", "gpu", "vector", "monitor",
)
Kind = Literal[
    "user", "mobile", "client", "edge", "gateway", "service", "agent", "ai", "database", "cache", "queue",
    "payment", "cart", "warehouse", "security", "ledger", "memory", "network", "output", "gpu", "vector", "monitor",
]
# Common words models use for a kind, mapped to the closest 3D model.
_KIND_SYNONYMS = {
    "person": "user", "customer": "user", "actor": "user", "phone": "mobile", "app": "mobile", "mobile_app": "mobile",
    "web": "client", "browser": "client", "frontend": "client", "cdn": "edge", "dns": "edge", "load_balancer": "gateway",
    "loadbalancer": "gateway", "api": "gateway", "api_gateway": "gateway", "proxy": "gateway", "microservice": "service",
    "worker": "service", "server": "service", "orchestrator": "agent", "scheduler": "agent", "ml": "ai", "model": "ai",
    "llm": "ai", "db": "database", "storage": "database", "sql": "database", "nosql": "database", "datastore": "database",
    "redis": "cache", "kafka": "queue", "stream": "queue", "pubsub": "queue", "billing": "payment", "auth": "security",
    "firewall": "security", "external": "network", "third_party": "network", "blob": "warehouse", "object_storage": "warehouse",
    "observability": "monitor", "monitoring": "monitor", "logging": "monitor", "index": "vector", "search": "vector",
}
_SLUG = re.compile(r"[^a-z0-9]+")


def _slug(text: str) -> str:
    return _SLUG.sub("-", text.lower()).strip("-")[:40] or "part"


class GeneratedPart(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=40)
    kind: Kind
    zone: Literal["internet", "vpc", "gpu"] = "vpc"
    connectsTo: list[str] = Field(default_factory=list, max_length=8)
    summary: str = Field(min_length=1, max_length=300)
    details: str = Field(min_length=1, max_length=1200)
    apis: str | None = Field(None, max_length=600)
    dataModel: str | None = Field(None, max_length=600)
    failureMode: str | None = Field(None, max_length=600)
    tradeOffs: str | None = Field(None, max_length=600)
    scaling: str | None = Field(None, max_length=600)

    @field_validator("kind", mode="before")
    @classmethod
    def _normalize_kind(cls, v: object) -> object:
        if not isinstance(v, str):
            return v
        key = _SLUG.sub("_", v.lower()).strip("_")
        return key if key in KINDS else _KIND_SYNONYMS.get(key, "service")

    @field_validator("zone", mode="before")
    @classmethod
    def _normalize_zone(cls, v: object) -> object:
        if not isinstance(v, str):
            return "vpc"
        v = v.lower()
        return "internet" if v in ("internet", "public", "external") else "gpu" if v == "gpu" else "vpc"

    @field_validator("id", mode="before")
    @classmethod
    def _normalize_id(cls, v: object) -> object:
        return _slug(v) if isinstance(v, str) else v

    @field_validator("label", mode="before")
    @classmethod
    def _trim_label(cls, v: object) -> object:
        return v.strip()[:40] if isinstance(v, str) else v


class GeneratedOverview(BaseModel):
    model_config = ConfigDict(extra="ignore")

    requirements: list[str] = Field(min_length=1, max_length=8)
    assumptions: list[str] = Field(default_factory=list, max_length=8)
    architecture: str = Field(min_length=1, max_length=1500)
    requestFlow: list[str] = Field(min_length=1, max_length=12)


class GeneratedScene(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=1, max_length=90)
    description: str = Field(min_length=1, max_length=700)
    parts: list[GeneratedPart] = Field(min_length=6, max_length=28)
    overview: GeneratedOverview

    @model_validator(mode="after")
    def _repair_graph(self) -> "GeneratedScene":
        # Make ids unique, then drop self-links and links to parts that do not exist.
        seen: set[str] = set()
        for part in self.parts:
            base, n = part.id, 2
            while part.id in seen:
                part.id = f"{base}-{n}"[:40]
                n += 1
            seen.add(part.id)
        for part in self.parts:
            part.connectsTo = list(dict.fromkeys(t for t in (_slug(x) for x in part.connectsTo) if t in seen and t != part.id))
        if not any(p.connectsTo for p in self.parts):
            raise ValueError("parts must be connected")
        return self


SYSTEM_PROMPT = f"""You are a senior system-design teacher. Design the architecture of the system the user names and \
return it as JSON for an interactive 3D learning diagram.

Return ONLY one JSON object, no markdown fences, with this shape:
{{
  "title": "short name of the system",
  "description": "2 sentences: what this proposed design covers. Clearly state it is a proposed model-generated design for learning, not a private internal design.",
  "parts": [
    {{
      "id": "kebab-case-id",
      "label": "Short label (max 28 characters)",
      "kind": one of {list(KINDS)},
      "zone": "internet" for users, phones, browsers and third-party services; "gpu" for GPU model servers; otherwise "vpc",
      "connectsTo": ["ids this part sends requests or data to"],
      "summary": "one sentence",
      "details": "2-3 sentences explaining what it does and why it exists",
      "apis": "optional: key endpoints or messages",
      "dataModel": "optional: key tables or fields",
      "failureMode": "optional: what can go wrong and the mitigation",
      "tradeOffs": "optional: the main design trade-off",
      "scaling": "optional: how it scales"
    }}
  ],
  "overview": {{
    "requirements": ["3-5 functional and non-functional requirements"],
    "assumptions": ["2-4 scale assumptions with numbers"],
    "architecture": "3-4 sentence summary of the architecture",
    "requestFlow": ["5-8 steps following one main request through the parts"]
  }}
}}

Rules:
- Use 8 to 16 parts. Include the real, important components of this system.
- List parts in the order a main request flows through them; the first part is where it starts (usually a user or app).
- connectsTo points in the direction requests or data flow. Every part must connect to or from at least one other part.
- Pick the kind whose 3D icon fits best: mobile for phone apps, client for web apps, edge for CDNs and DNS, gateway for \
API gateways and load balancers, service for application services, agent for orchestrators and schedulers, ai for ML \
models, gpu for GPU servers, database for durable stores, cache for in-memory caches, queue for queues and event streams, \
vector for search and vector indexes, warehouse for object or blob storage, security for auth and fraud checks, payment \
for billing, network for external providers, monitor for observability, output for results or reports.
- Give apis, failureMode, or scaling for at least half of the parts. Be accurate and concrete; keep each field short.
"""

_FALLBACK_CODES = {"provider_error", "provider_rate_limited", "provider_unreachable", "provider_model_not_found"}
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _extract_json(text: str) -> dict:
    cleaned = _FENCE.sub("", text.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object found")
    return json.loads(cleaned[start:end + 1])


def _first_error(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        err = exc.errors()[0]
        return f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
    return str(exc)[:200]


class SceneGenerator:
    """Asks the model for a scene, validates it with Pydantic, and caches verified scenes."""

    def __init__(self, gateway: ModelGateway, cache_size: int = 32):
        self._gateway = gateway
        self._cache: OrderedDict[str, GeneratedScene] = OrderedDict()
        self._models: dict[str, tuple[str, str]] = {}
        self._cache_size = cache_size
        self._preload_cached_scenes()

    def _preload_cached_scenes(self) -> None:
        """Pre-populate the cache with 5 demo systems so live demos never stall."""
        for key, raw_scene in CACHED_SCENES.items():
            try:
                scene = GeneratedScene.model_validate(raw_scene)
                cache_key = self.cache_key(key)
                self._cache[cache_key] = scene
                self._models[cache_key] = (
                    "nvidia/nemotron-3.5-super-vl-120b-a12b",
                    "nvidia",
                )
            except Exception as exc:
                log.warning("failed to preload cached scene key=%s: %s", key, exc)

    @staticmethod
    def cache_key(topic: str) -> str:
        normalized = " ".join(topic.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()

    def get_cached(self, topic: str) -> tuple[GeneratedScene, str, str] | None:
        key = self.cache_key(topic)
        scene = self._cache.get(key)
        if scene is None:
            return None
        self._cache.move_to_end(key)
        model, provider = self._models[key]
        return scene, model, provider

    async def generate(self, topic: str) -> tuple[GeneratedScene, bool, str, str]:
        key = self.cache_key(topic)
        cached = self.get_cached(topic)
        if cached is not None:
            scene, model, provider = cached
            return scene, True, model, provider

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"System to design: {topic}"},
        ]
        scene: GeneratedScene | None = None
        model = getattr(
            getattr(self._gateway, "settings", None),
            "model_planner",
            "nvidia/nemotron-3.5-super-vl-120b-a12b",
        )
        for attempt in range(2):
            result = await self._gateway.complete(messages, task="scene_generation", max_tokens=8192)
            model = result.model
            try:
                scene = GeneratedScene.model_validate(_extract_json(result.text))
                break
            except (ValueError, ValidationError) as exc:
                problem = _first_error(exc)
                log.warning("scene.invalid attempt=%d problem=%s", attempt + 1, problem)
                # Ask once for a corrected reply, quoting only the validation problem.
                messages += [
                    {"role": "assistant", "content": result.text[:20000]},
                    {"role": "user", "content": f"That reply was not valid ({problem}). Reply with only the corrected JSON object."},
                ]

        if scene is None:
            raise AppError("scene_generation_failed", "The model could not produce a valid system design. Try rephrasing the topic.", 502)

        self._cache[key] = scene
        self._models[key] = (model, self._gateway.provider)
        if len(self._cache) > self._cache_size:
            evicted, _ = self._cache.popitem(last=False)
            self._models.pop(evicted, None)
        return scene, False, model, self._gateway.provider
