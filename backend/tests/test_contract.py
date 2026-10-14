"""SH-04 / FE-03: the committed OpenAPI snapshot (source of the frontend's generated types) matches the backend."""
import json

from app.openapi_export import SNAPSHOT, contract


def test_openapi_snapshot_is_current():
    assert SNAPSHOT.exists(), "run: python -m app.openapi_export"
    assert json.loads(SNAPSHOT.read_text(encoding="utf-8")) == json.loads(json.dumps(contract())), (
        "API contract changed: run `python -m app.openapi_export` in backend/, then `npm run gen:types` in frontend/"
    )


def test_every_json_endpoint_declares_a_response_model():
    untyped = []
    for path, ops in contract()["paths"].items():
        for method, op in ops.items():
            ok = op["responses"].get("200") or op["responses"].get("201")
            if ok and "application/json" in ok.get("content", {}) and ok["content"]["application/json"]["schema"] == {}:
                untyped.append(f"{method.upper()} {path}")
    assert untyped == []
