"""List models exposed by the provider selected with LLM_PROVIDER.

Run from the repository root: python scripts/list_models.py
"""

import asyncio
import pathlib
import sys

import httpx

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "backend"))

from app.config import Settings  # noqa: E402 -- backend path is added above


async def main() -> int:
    settings = Settings()
    provider = settings.llm_provider
    if provider == "demo":
        print("LLM_PROVIDER=demo has no remote model catalogue.")
        return 0
    key = settings.nebius_api_key if provider == "nebius" else settings.nvidia_api_key
    base = settings.nebius_base_url if provider == "nebius" else settings.nvidia_base_url
    if not key:
        key_name = "NEBIUS_API_KEY" if provider == "nebius" else "NVIDIA_API_KEY"
        raise SystemExit(f"{key_name} is not configured.")
    print(f"Provider: {provider} | endpoint: {base}")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{base}/models", headers={"Authorization": f"Bearer {key}"})
        response.raise_for_status()
        models = sorted(item["id"] for item in response.json().get("data", []) if item.get("id"))
    except (httpx.HTTPError, ValueError) as exc:
        raise SystemExit(f"Could not list models ({type(exc).__name__}). Check the provider, endpoint, and key.") from None
    print("\n".join(models) if models else "The provider returned no model IDs.")
    print("\nSet MODEL_PLANNER and MODEL_FAST to IDs above; set MODEL_EMBED to an embedding model ID if available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
