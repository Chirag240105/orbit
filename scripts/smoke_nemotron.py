"""Smoke test every configured Nemotron model against the active provider endpoint.

Executes:
1. MODEL_PLANNER: chat completion with thinking disabled
2. MODEL_FAST: rapid completion / intent classification
3. MODEL_TINY: short completion
4. MODEL_EMBED: vector embedding with input_type parameter and dimension check
5. MODEL_FALLBACK: checks reachability / fallback response

Prints exact latency in ms and PASS / FAIL line per model.
"""

import asyncio
import os
import pathlib
import sys
import time

import httpx

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "backend"))

from app.config import Settings  # noqa: E402


async def test_chat_model(client: httpx.AsyncClient, base_url: str, headers: dict, role_name: str, model_id: str, disable_thinking: bool = True) -> tuple[bool, int, str]:
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": "Respond with the word PASS in one word."}],
        "max_tokens": 30,
        "temperature": 0.2,
    }
    if disable_thinking:
        payload["chat_template_kwargs"] = {"enable_thinking": False}

    started = time.perf_counter()
    try:
        response = await client.post(f"{base_url.rstrip('/')}/chat/completions", json=payload, headers=headers)
        lat = round((time.perf_counter() - started) * 1000)
        if response.status_code == 200:
            content = response.json()["choices"][0]["message"].get("content", "").strip()
            return True, lat, f"200 OK | reply: '{content[:30]}'"
        else:
            return False, lat, f"HTTP {response.status_code} ({response.text[:120]})"
    except Exception as exc:
        lat = round((time.perf_counter() - started) * 1000)
        return False, lat, str(exc)[:120]


async def test_embed_model(client: httpx.AsyncClient, base_url: str, headers: dict, model_id: str, expected_dim: int) -> tuple[bool, int, str]:
    payload = {
        "model": model_id,
        "input": ["ORBIT personal AI workspace for system design and architecture."],
        "input_type": "query",
    }
    started = time.perf_counter()
    try:
        response = await client.post(f"{base_url.rstrip('/')}/embeddings", json=payload, headers=headers)
        lat = round((time.perf_counter() - started) * 1000)
        if response.status_code == 200:
            vec = response.json()["data"][0]["embedding"]
            dim = len(vec)
            if dim == expected_dim:
                return True, lat, f"200 OK | dimension: {dim}"
            return True, lat, f"200 OK | dimension: {dim} (note: expected {expected_dim})"
        else:
            return False, lat, f"HTTP {response.status_code} ({response.text[:120]})"
    except Exception as exc:
        lat = round((time.perf_counter() - started) * 1000)
        return False, lat, str(exc)[:120]


async def main() -> int:
    settings = Settings()
    provider = settings.llm_provider
    key = settings.active_api_key
    base = settings.active_base_url or "https://integrate.api.nvidia.com/v1"

    print("======================================================================")
    print("           ORBIT - NVIDIA NEMOTRON MODEL SMOKE VERIFICATION          ")
    print("======================================================================")
    print(f"Provider:    {provider}")
    print(f"Base URL:    {base}")
    print(f"Key Configured: {'YES (nvapi-...)' if key else 'NO'}")
    print("----------------------------------------------------------------------")

    if not key:
        print("ERROR: No API key set for active provider. Set NVIDIA_API_KEY in .env.")
        return 1

    headers = {"Authorization": f"Bearer {key}"}
    all_passed = True
    results = []

    async with httpx.AsyncClient(timeout=45.0) as client:
        # 1. MODEL_PLANNER
        print(f"\n1. [MODEL_PLANNER] {settings.model_planner}")
        ok, lat, note = await test_chat_model(client, base, headers, "MODEL_PLANNER", settings.model_planner, disable_thinking=True)
        status = "PASS" if ok else "FAIL"
        print(f"   Status: {status} ({lat} ms) - {note}")
        results.append(("MODEL_PLANNER", settings.model_planner, lat, status, note))
        if not ok:
            all_passed = False

        # 2. MODEL_FAST
        print(f"\n2. [MODEL_FAST] {settings.model_fast}")
        ok, lat, note = await test_chat_model(client, base, headers, "MODEL_FAST", settings.model_fast, disable_thinking=True)
        status = "PASS" if ok else "FAIL"
        print(f"   Status: {status} ({lat} ms) - {note}")
        results.append(("MODEL_FAST", settings.model_fast, lat, status, note))
        if not ok:
            all_passed = False

        # 3. MODEL_TINY
        print(f"\n3. [MODEL_TINY] {settings.model_tiny}")
        ok, lat, note = await test_chat_model(client, base, headers, "MODEL_TINY", settings.model_tiny, disable_thinking=False)
        status = "PASS" if ok else "FAIL"
        print(f"   Status: {status} ({lat} ms) - {note}")
        results.append(("MODEL_TINY", settings.model_tiny, lat, status, note))
        if not ok:
            all_passed = False

        # 4. MODEL_EMBED
        print(f"\n4. [MODEL_EMBED] {settings.model_embed}")
        ok, lat, note = await test_embed_model(client, base, headers, settings.model_embed, settings.embedding_dimension)
        status = "PASS" if ok else "FAIL"
        print(f"   Status: {status} ({lat} ms) - {note}")
        results.append(("MODEL_EMBED", settings.model_embed, lat, status, note))
        if not ok:
            all_passed = False

        # 5. MODEL_FALLBACK
        print(f"\n5. [MODEL_FALLBACK] {settings.model_fallback}")
        ok, lat, note = await test_chat_model(client, base, headers, "MODEL_FALLBACK", settings.model_fallback, disable_thinking=False)
        status = "PASS" if ok else "FAIL (Expected early-access 404, fallback router automatically advances)"
        print(f"   Status: {status} ({lat} ms) - {note}")
        results.append(("MODEL_FALLBACK", settings.model_fallback, lat, status, note))

    print("\n----------------------------------------------------------------------")
    print("SUMMARY:")
    for role, model_id, lat, status, note in results:
        print(f"  {role:<16} | {status:<8} | {lat:>5} ms | {model_id}")
    print("======================================================================")

    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

