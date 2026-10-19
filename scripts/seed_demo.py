"""Create a demo account and a small set of synthetic records through the API."""

import json
import os
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def request(base_url: str, path: str, payload: dict, token: str | None = None) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(payload).encode()
    req = Request(f"{base_url}{path}", data=body, headers=headers, method="POST")
    try:
        with urlopen(req, timeout=20) as response:
            return response.status, json.loads(response.read())
    except HTTPError as exc:
        return exc.code, json.loads(exc.read())


def get(base_url: str, path: str, token: str) -> list[dict]:
    req = Request(f"{base_url}{path}", headers={"Authorization": f"Bearer {token}"})
    with urlopen(req, timeout=20) as response:
        return json.loads(response.read())


def main() -> int:
    base_url = os.environ.get("ORBIT_API_BASE_URL", "http://localhost:8080").rstrip("/")
    email = os.environ.get("ORBIT_DEMO_EMAIL")
    password = os.environ.get("ORBIT_DEMO_PASSWORD")
    if not email or not password or len(password) < 12:
        print("Set ORBIT_DEMO_EMAIL and ORBIT_DEMO_PASSWORD (at least 12 characters).", file=sys.stderr)
        return 2

    status, response = request(base_url, "/api/auth/register", {"email": email, "password": password})
    if status == 409:
        status, response = request(base_url, "/api/auth/login", {"email": email, "password": password})
    if status >= 400:
        print(f"Account setup failed with HTTP {status}.", file=sys.stderr)
        return 1
    token = response["access_token"]

    known_memories = {row["content"] for row in get(base_url, "/api/memories", token)}
    for content, kind in [
        ("ORBIT demo project: build a thoughtful personal AI workspace for planning and learning.", "PROJECT"),
        ("Demo preference: show a short plan before proposing actions that change data.", "PREFERENCE"),
        ("Demo decision: keep camera hand tracking in the browser; never upload camera frames.", "DECISION"),
    ]:
        if content not in known_memories:
            status, _ = request(base_url, "/api/memories", {"content": content, "type": kind}, token)
            if status >= 400:
                print(f"Could not create demo memory (HTTP {status}).", file=sys.stderr)
                return 1

    known_tasks = {row["title"] for row in get(base_url, "/api/tasks", token)}
    samples = [
        ("Review the weekly learning plan", "Compare planned study blocks with completed work.", "medium"),
        ("Draft the next project milestone", "Write a short implementation plan for the demo workspace.", "high"),
    ]
    for title, notes, priority in samples:
        if title not in known_tasks:
            status, _ = request(base_url, "/api/tasks", {"title": title, "notes": notes, "priority": priority}, token)
            if status >= 400:
                print(f"Could not create demo task (HTTP {status}).", file=sys.stderr)
                return 1

    print(f"Demo account and sample records are ready for {email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
