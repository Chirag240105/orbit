"""AI-04: streamed chat. Tokens arrive incrementally; the final event has the same shape as POST /api/chat."""
import json

import httpx

from app.schemas import ChatResponse
from tests.conftest import FakeModel, hosted, sse_reply


def events(text: str) -> list[tuple[str, dict]]:
    out = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def test_tokens_stream_then_validated_result():
    model = FakeModel(sse_reply({"reasoning_content": "hmm"}, {"content": "<think>x</think>"}, {"content": '{"answer": "Hel'}, {"content": 'lo"}'}))
    with hosted(model) as c:
        r = c.post("/api/chat/stream", json={"message": "greet me"})
        assert r.headers["content-type"].startswith("text/event-stream")
        ev = events(r.text)
        msgs = c.get(f"/api/conversations/{ev[-1][1]['conversation_id']}/messages").json()
    kinds = [k for k, _ in ev]
    assert kinds[0] == "status" and ev[0][1] == {"status": "thinking"}
    tokens = [d["text"] for k, d in ev if k == "token"]
    assert len(tokens) == 2 and "".join(tokens) == '{"answer": "Hello"}'  # the <think> block is never streamed
    assert kinds[-2:] == ["status", "done"]
    done = ChatResponse.model_validate(ev[-1][1])
    assert done.output == {"answer": "Hello", "key_points": [], "follow_ups": []} and done.skill == "general_qa"
    assert msgs[-1]["content"]["answer"] == "Hello"
    assert model.requests[0]["stream"] is True


def test_stream_and_plain_chat_return_the_same_shape():
    with hosted(FakeModel(sse_reply({"content": '{"answer": "A"}'}))) as c:
        streamed = events(c.post("/api/chat/stream", json={"message": "q"}).text)[-1][1]
    with hosted(FakeModel('{"answer": "A"}')) as c:
        plain = c.post("/api/chat", json={"message": "q"}).json()
    assert streamed.keys() == plain.keys() and streamed["output"] == plain["output"]


def test_consent_is_still_a_json_error_before_streaming(project):
    model = FakeModel(sse_reply({"content": "{}"}))
    with hosted(model) as c:
        ws = c.post("/api/workspaces", json={"path": str(project)}).json()["id"]
        r = c.post("/api/chat/stream", json={"message": "explain", "skill": "explain_code", "workspace_id": ws, "file_paths": ["src/app.py"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "consent_required" and model.requests == []


def test_provider_failure_mid_stream_is_an_error_event():
    with hosted(FakeModel(httpx.Response(401))) as c:
        ev = events(c.post("/api/chat/stream", json={"message": "q"}).text)
    assert ev == [("error", {"code": "provider_auth_failed", "message": "The model provider rejected the API key. Check NEBIUS_API_KEY."})]


def test_reasoning_only_stream_is_an_empty_response_error():
    with hosted(FakeModel(sse_reply({"reasoning_content": "thinking..."}))) as c:
        ev = events(c.post("/api/chat/stream", json={"message": "q"}).text)
    assert ev[-1] == ("error", {"code": "provider_empty_response", "message": ev[-1][1]["message"]})


def test_invalid_streamed_reply_is_repaired_without_streaming():
    model = FakeModel(sse_reply({"content": "not json"}), '{"answer": "fixed"}')
    with hosted(model) as c:
        done = events(c.post("/api/chat/stream", json={"message": "q"}).text)[-1]
    assert done[0] == "done" and done[1]["output"]["answer"] == "fixed" and "stream" not in model.requests[1]


def test_demo_mode_streams_a_labeled_placeholder(demo):
    ev = events(demo.post("/api/chat/stream", json={"message": "hello"}).text)
    assert [k for k, _ in ev] == ["token", "done"] and ev[1][1]["provider"]["is_demo"] is True


def test_clarifying_question_arrives_as_done(demo, project):
    ws = demo.post("/api/workspaces", json={"path": str(project)}).json()["id"]
    ev = events(demo.post("/api/chat/stream", json={"message": "explain", "skill": "explain_code", "workspace_id": ws}).text)
    assert ev[0][0] == "done" and "clarifying_question" in ev[0][1]["output"]
