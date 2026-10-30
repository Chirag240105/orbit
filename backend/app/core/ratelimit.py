import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.errors import AppError


class RateLimiter:
    """In-memory sliding window per authenticated account, or per client IP before authentication."""

    def __init__(self, limit: int, window_s: int = 60):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        user_id = getattr(getattr(request, "state", None), "user_id", None)
        key = f"user:{user_id}" if user_id is not None else f"ip:{request.client.host if request.client else 'local'}"
        now, q = time.monotonic(), self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise AppError("rate_limited", "Too many requests. Wait a moment and try again.", 429)
        q.append(now)
