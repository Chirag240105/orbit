import asyncio
import json

import pytest

from app.core.errors import AppError
from app.services.model_gateway import ModelResult
from app.services.scene_generator import GeneratedScene, SceneGenerator


def part(pid: str, kind: str = "service", to: list[str] | None = None, zone: str = "vpc") -> dict:
    return {"id": pid, "label": pid.title(), "kind": kind, "zone": zone, "connectsTo": to or [],
            "summary": f"{pid} summary.", "details": f"{pid} does its job."}


def scene_json(parts: list[dict]) -> str:
    return json.dumps({
        "title": "Ride hailing", "description": "A proposed design.", "parts": parts,
        "overview": {"requirements": ["Match riders"], "assumptions": ["1M rides/day"], "architecture": "Services.", "requestFlow": ["Rider requests"]},
    })


VALID_PARTS = [part("rider", "mobile", ["gateway"], "internet"), part("gateway", "gateway", ["trips"]), part("trips", "service", ["db"]),
               part("db", "database"), part("pay", "payment", ["psp"]), part("psp", "network", zone="internet")]


class FakeGateway:
    provider = "gemini"

    def __init__(self, replies: list):
        self.replies, self.calls = list(replies), []

    async def complete(self, messages, task="planner", max_tokens=4096, extra=None):
        self.calls.append({"task": task, "extra": extra, "messages": messages})
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return ModelResult(reply, "gemini", "test-model", 1)


def test_generates_a_valid_scene_from_fenced_json():
    gateway = FakeGateway(["```json\n" + scene_json(VALID_PARTS) + "\n```"])
    scene, cached = asyncio.run(SceneGenerator(gateway).generate("Uber"))
    assert not cached and len(scene.parts) == 6
    assert gateway.calls[0]["extra"] == {"reasoning_effort": "low"}
    assert "Uber" in gateway.calls[0]["messages"][-1]["content"]


def test_normalizes_kinds_ids_and_links():
    parts = [part("Rider App", "phone", ["API Gateway", "missing", "Rider App"], "public"), part("API Gateway", "load balancer", ["trips"]),
             part("trips", "microservice", ["db"]), part("db", "redis"), part("x", "something-new"), part("x", "db")]
    scene = GeneratedScene.model_validate(json.loads(scene_json(parts)))
    by_id = {p.id: p for p in scene.parts}
    assert by_id["rider-app"].kind == "mobile" and by_id["rider-app"].zone == "internet"
    assert by_id["rider-app"].connectsTo == ["api-gateway"]  # unknown and self links dropped
    assert by_id["api-gateway"].kind == "gateway" and by_id["db"].kind == "cache"
    assert by_id["x"].kind == "service" and "x-2" in by_id  # unknown kind falls back; duplicate id made unique


def test_rejects_disconnected_designs():
    with pytest.raises(ValueError):
        GeneratedScene.model_validate(json.loads(scene_json([part(f"p{i}") for i in range(6)])))


def test_asks_the_model_to_fix_an_invalid_reply():
    gateway = FakeGateway(["Sure! Here is the design:", scene_json(VALID_PARTS)])
    scene, _ = asyncio.run(SceneGenerator(gateway).generate("Uber"))
    assert len(scene.parts) == 6 and len(gateway.calls) == 2
    assert "not valid" in gateway.calls[1]["messages"][-1]["content"]


def test_gives_up_after_two_invalid_replies():
    gateway = FakeGateway(["nope", "still nope"])
    with pytest.raises(AppError) as err:
        asyncio.run(SceneGenerator(gateway).generate("Uber"))
    assert err.value.code == "scene_generation_failed"


def test_falls_back_to_the_fast_model_when_overloaded():
    gateway = FakeGateway([AppError("provider_error", "503", 502), scene_json(VALID_PARTS)])
    scene, _ = asyncio.run(SceneGenerator(gateway).generate("Uber"))
    assert [c["task"] for c in gateway.calls] == ["planner", "fast"] and len(scene.parts) == 6


def test_caches_recent_topics_case_insensitively():
    gateway = FakeGateway([scene_json(VALID_PARTS)])
    generator = SceneGenerator(gateway)
    asyncio.run(generator.generate("Uber"))
    _, cached = asyncio.run(generator.generate("  uber "))
    assert cached and len(gateway.calls) == 1


def test_endpoint_explains_that_demo_mode_cannot_generate(demo):
    response = demo.post("/api/vision/scene", json={"topic": "Uber"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "scene_generation_unavailable"


def test_endpoint_validates_topic(demo):
    assert demo.post("/api/vision/scene", json={"topic": "x"}).status_code == 422
