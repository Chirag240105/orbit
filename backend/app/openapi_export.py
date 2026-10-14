"""Export the API contract (OpenAPI) that the frontend's generated types are built from.

    python -m app.openapi_export ../frontend/src/types/openapi.json
    cd ../frontend && npm run gen:types

tests/test_contract.py fails when the committed snapshot is out of date."""
import json
import sys
from pathlib import Path

SNAPSHOT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "types" / "openapi.json"


def contract() -> dict:
    from app.config import Settings
    from app.main import create_app

    settings = Settings(database_url="sqlite://", _env_file=None, api_token="x" * 32, token_file="", demo_mode=True)
    return create_app(settings).openapi()


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else SNAPSHOT
    target.write_text(json.dumps(contract(), indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
