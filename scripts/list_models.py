"""List models your Nebius Token Factory key can use.
Run from the repo root:  python scripts\\list_models.py"""
import json
import os
import pathlib
import urllib.error
import urllib.request

env = pathlib.Path(__file__).resolve().parent.parent / ".env"
if not env.exists():
    env = pathlib.Path(__file__).resolve().parent.parent / "backend" / ".env"
vals = {}
if env.exists():
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
# .env wins over any stale shell variable
key = vals.get("NEBIUS_API_KEY") or os.environ.get("NEBIUS_API_KEY", "")
base = (vals.get("NEBIUS_BASE_URL") or os.environ.get("NEBIUS_BASE_URL")
        or "https://api.tokenfactory.nebius.com/v1/").rstrip("/")
print(f".env used: {env if env.exists() else 'none'} | key set: {bool(key)} | length: {len(key)} | base: {base}")
if os.environ.get("NEBIUS_API_KEY") and os.environ["NEBIUS_API_KEY"] != key:
    print("WARNING: your shell has a different NEBIUS_API_KEY than .env (using .env).")
if not key:
    raise SystemExit("NEBIUS_API_KEY missing in .env")
req = urllib.request.Request(f"{base}/models", headers={"Authorization": f"Bearer {key}", "User-Agent": "orbit-list-models/0.1"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
except urllib.error.HTTPError as e:
    raise SystemExit(f"HTTP {e.code}. 401/403 means the provider rejected this key.")
ids = sorted(m["id"] for m in data.get("data", []))
print("\n".join(i for i in ids if "nemotron" in i.lower()) or "No Nemotron models listed. All models:\n" + "\n".join(ids))