import pytest
from starlette.requests import Request

from app.core.errors import AppError
from app.core.ratelimit import RateLimiter


def _request(user_id: int, host: str = "127.0.0.1") -> Request:
    request = Request({
        "type": "http",
        "method": "POST",
        "path": "/api/chat",
        "headers": [],
        "client": (host, 8000),
    })
    request.state.user_id = user_id
    return request


def test_rate_limit_is_per_authenticated_account():
    limiter = RateLimiter(limit=1)
    limiter(_request(1))

    with pytest.raises(AppError) as err:
        limiter(_request(1, host="192.0.2.10"))
    assert err.value.code == "rate_limited"

    limiter(_request(2))
