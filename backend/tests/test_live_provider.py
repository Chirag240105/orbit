"""AI-01 / AI-02: checks against the real Nebius model. Skipped unless ORBIT_LIVE_TESTS=1 and NEBIUS_API_KEY is set.

    cd backend && ORBIT_LIVE_TESTS=1 pytest tests/test_live_provider.py -s

The prompt set doubles as the AI-02 reliability measurement: the summary line printed at the end is the number
to record in docs/AI_AGENT_DESIGN.md (target: 90% valid without fallback)."""
import os

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import TOKEN

pytestmark = pytest.mark.skipif(os.environ.get("ORBIT_LIVE_TESTS") != "1", reason="set ORBIT_LIVE_TESTS=1 and NEBIUS_API_KEY to run against the real model")

PROMPTS = {
    "general_qa": ["What is the difference between a process and a thread?", "Why is HTTPS safer than HTTP?", "I deploy with Docker on Hetzner. Is that a good choice for a hobby app?",
                   "What does idempotent mean in REST APIs?", "How do database indexes speed up queries?"],
    "summarize_text": ["Summarize: The meeting covered the Q3 roadmap. We agreed to ship search first, delay billing, and hire one designer.",
                       "TL;DR: Kubernetes schedules containers onto nodes, restarts failed ones, and scales them based on load.",
                       "Summarize: Rust prevents data races at compile time through ownership and borrowing rules.",
                       "Summarize: Our outage was caused by an expired TLS certificate on the load balancer.",
                       "Summarize: SQLite is a serverless database stored in a single file."],
    "task_plan": ["Plan how to launch my side project in 4 weeks", "Plan my week: study for an exam, finish a report, go to the gym",
                  "Break this down: migrate our app from SQLite to PostgreSQL", "Plan a product demo for Friday",
                  "Steps to learn Kubernetes in a month"],
    "learn_topic": ["Explain Kubernetes like I'm a beginner, then give me a diagram, real-world example, and interview questions.",
                    "Teach me how DNS works", "Explain load balancers for beginners with a diagram", "Teach me what OAuth is",
                    "Interview questions about Python generators"],
}


@pytest.fixture(scope="module")
def live_client():
    settings = Settings(database_url="sqlite://", api_token=TOKEN, token_file="")
    assert settings.nebius_api_key, "NEBIUS_API_KEY is not set in .env"
    return TestClient(create_app(settings), headers={"X-Orbit-Token": TOKEN})


RESULTS: dict[str, list[bool]] = {}


@pytest.mark.parametrize("skill,prompt", [(s, p) for s, ps in PROMPTS.items() for p in ps])
def test_live_structured_output(live_client, skill, prompt):
    r = live_client.post("/api/chat", json={"message": prompt, "skill": skill})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["provider"]["is_demo"] is False
    RESULTS.setdefault(skill, []).append(not any("plain text" in w for w in j["warnings"]))


def test_live_reliability_summary():
    total = [ok for oks in RESULTS.values() for ok in oks]
    if not total:
        pytest.skip("no live results collected")
    for skill, oks in RESULTS.items():
        print(f"{skill:15s} {sum(oks)}/{len(oks)} validated")
    rate = sum(total) / len(total)
    print(f"overall: {rate:.0%} validated without fallback ({sum(total)}/{len(total)})")
    assert rate >= 0.9


def test_live_bad_key_is_reported(monkeypatch):
    settings = Settings(database_url="sqlite://", api_token=TOKEN, token_file="", nebius_api_key="definitely-not-a-valid-key")
    c = TestClient(create_app(settings), headers={"X-Orbit-Token": TOKEN})
    assert c.post("/api/chat", json={"message": "hi"}).json()["error"]["code"] == "provider_auth_failed"


def test_live_bad_model_is_reported():
    settings = Settings(database_url="sqlite://", api_token=TOKEN, token_file="", nebius_model="nvidia/does-not-exist")
    c = TestClient(create_app(settings), headers={"X-Orbit-Token": TOKEN})
    assert c.post("/api/chat", json={"message": "hi"}).json()["error"]["code"] in ("provider_model_not_found", "provider_error")
