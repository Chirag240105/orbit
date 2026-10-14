"""AI-07: suggested memories must be durable facts the user stated, never invented or sensitive.
Fixtures pair a user message with a suggestion a model might return."""
import pytest

from app.memory.service import vet_suggestion
from tests.conftest import FakeModel, hosted

KEEP = [
    ("I deploy everything with Docker on Hetzner", "User deploys with Docker on Hetzner"),
    ("Remember that I prefer pnpm over npm", "Prefers pnpm over npm"),
    ("I'm learning Rust this year, what should I read?", "Learning Rust this year"),
    ("My team uses GitHub Actions for CI", "Team uses GitHub Actions for CI"),
    ("I always write TypeScript in strict mode", "Writes TypeScript in strict mode"),
    ("I work on a Windows laptop with WSL", "Works on a Windows laptop with WSL"),
    ("Our backend is FastAPI with SQLite. How do I add migrations?", "Backend is FastAPI with SQLite"),
    ("I like short answers with code examples", "Likes short answers with code examples"),
    ("I use VS Code with Vim keybindings", "Uses VS Code with Vim keybindings"),
    ("I'm preparing for backend interviews in December", "Preparing for backend interviews in December"),
]
DROP = [
    ("What is the capital of France?", "User is interested in French geography"),  # invented
    ("How do I sort a list in Python?", "User is a beginner Python programmer"),  # a guess
    ("I was diagnosed with ADHD, how do I focus?", "User was diagnosed with ADHD"),  # health
    ("My password is hunter2pass, is it strong?", "User's password is hunter2pass"),  # credential
    ("I go to church every Sunday, plan my week", "Goes to church every Sunday"),  # religion
    ("My API key is sk-abcdefghijklmnopqrstuvwx", "API key is sk-abcdefghijklmnopqrstuvwx"),  # secret
    ("I have a lot of credit card debt", "Has credit card debt"),  # finances
    ("Explain Kubernetes", "User works as a DevOps engineer at a large company"),  # invented
    ("Plan my trip", "User is travelling to Japan in April with their partner"),  # invented details
    ("Who should I vote for?", "User voted for a political party"),  # politics
]


@pytest.mark.parametrize("message,suggestion", KEEP)
def test_grounded_durable_facts_are_kept(message, suggestion):
    assert vet_suggestion(suggestion, message) == suggestion


@pytest.mark.parametrize("message,suggestion", DROP)
def test_invented_or_sensitive_suggestions_are_dropped(message, suggestion):
    assert vet_suggestion(suggestion, message) is None


def test_non_string_and_overlong_are_dropped():
    assert vet_suggestion(None, "x") is None and vet_suggestion(42, "x") is None
    assert vet_suggestion("word " * 80, "word " * 80) is None


def test_api_drops_an_invented_suggestion():
    model = FakeModel('{"answer": "Paris", "suggested_memory": "User is planning a trip to Paris"}')
    with hosted(model) as c:
        out = c.post("/api/chat", json={"message": "What is the capital of France?"}).json()["output"]
    assert out == {"answer": "Paris", "key_points": [], "follow_ups": []}


def test_api_keeps_a_stated_fact_unconfirmed_until_saved():
    model = FakeModel('{"answer": "Nice.", "suggested_memory": "Deploys with Docker on Hetzner"}')
    with hosted(model) as c:
        out = c.post("/api/chat", json={"message": "I deploy with Docker on Hetzner"}).json()["output"]
        assert out["suggested_memory"] == "Deploys with Docker on Hetzner"
        assert c.get("/api/memories").json() == []  # nothing is stored until the user clicks Save
