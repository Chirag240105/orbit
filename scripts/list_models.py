"""List models exposed by the active provider and verify configured model IDs.

Run from the repository root: python scripts/list_models.py
"""

import asyncio
import pathlib
import sys

import httpx

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "backend"))

from app.config import Settings  # noqa: E402


async def main() -> int:
    settings = Settings()
    provider = settings.llm_provider
    if provider == "demo":
        print("LLM_PROVIDER=demo has no remote model catalogue.")
        return 0
    key = settings.active_api_key
    base = settings.active_base_url
    if not key:
        key_name = {"nebius": "NEBIUS_API_KEY", "nvidia": "NVIDIA_API_KEY"}.get(provider, "API_KEY")
        raise SystemExit(f"{key_name} is not configured.")
    print(f"Provider: {provider} | endpoint: {base}")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{base.rstrip('/')}/models", headers={"Authorization": f"Bearer {key}"})
        response.raise_for_status()
        available_models = {item["id"] for item in response.json().get("data", []) if item.get("id")}
    except (httpx.HTTPError, ValueError) as exc:
        raise SystemExit(f"Could not list models ({type(exc).__name__}). Check the provider, endpoint, and key.") from None

    print(f"\n--- Available Models ({len(available_models)} total) ---")
    nemotrons = sorted([m for m in available_models if "nemotron" in m.lower()])
    print("Nemotron family models:")
    for m in nemotrons:
        print(f"  - {m}")

    print("\n--- Configured Models Verification ---")
    configured = [
        ("MODEL_PLANNER", settings.model_planner),
        ("MODEL_FAST", settings.model_fast),
        ("MODEL_TINY", settings.model_tiny),
        ("MODEL_EMBED", settings.model_embed),
        ("MODEL_FALLBACK", settings.model_fallback),
    ]

    all_found = True
    for env_var, model_id in configured:
        exists = model_id in available_models
        status = "EXISTS (Ready)" if exists else "NOT FOUND on endpoint"
        print(f"  {env_var}: {model_id} -> {status}")
        if not exists and env_var != "MODEL_FALLBACK":
            all_found = False

    return 0 if all_found else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
