from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class InMemoryRateLimiter:
    """Small single-process limiter; use a shared Redis/proxy limiter for multi-worker production."""

    def __init__(self):
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            return True

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


rate_limiter = InMemoryRateLimiter()


class SensitiveEndpointRateLimitMiddleware(BaseHTTPMiddleware):
    RULES = {
        ("POST", "/auth/login"): (5, 60),
        ("POST", "/patients/register"): (5, 3600),
        ("DELETE", "/patients/me"): (5, 3600),
    }

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        rule = self.RULES.get((request.method, request.url.path))
        if rule:
            client_ip = request.client.host if request.client else "unknown"
            limit, window = rule
            key = f"{request.method}:{request.url.path}:{client_ip}"
            if not rate_limiter.allow(key, limit, window):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={"Retry-After": str(window)},
                )
        return await call_next(request)
