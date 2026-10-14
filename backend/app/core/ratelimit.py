import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.errors import AppError


class RateLimiter:
    """In-memory sliding window per client IP. Local single-user MVP; swap for a shared store if deployed."""

    def __init__(self, limit: int, window_s: int = 60):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "local"
        now, q = time.monotonic(), self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise AppError("rate_limited", "Too many requests. Wait a moment and try again.", 429)
        q.append(now)
