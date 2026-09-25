"""
Production Sliding-Window Rate Limiter for FastAPI
Provides per-IP and per-User rate limiting with standard 429 responses and Retry-After headers.
"""

import time
import asyncio
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status
import logging

logger = logging.getLogger("docfiller.rate_limiter")


class SlidingWindowRateLimiter:
    """
    Thread-safe, non-blocking in-memory sliding window rate limiter.
    """
    def __init__(self):
        self._records: Dict[str, List[float]] = {}
        self._lock = asyncio.Lock()

    async def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        cutoff = now - window_seconds

        async with self._lock:
            timestamps = self._records.get(key, [])
            # Purge expired timestamps
            valid_timestamps = [t for t in timestamps if t > cutoff]

            if len(valid_timestamps) >= max_requests:
                earliest = valid_timestamps[0]
                retry_after = max(1, int(earliest + window_seconds - now))
                self._records[key] = valid_timestamps
                return False, retry_after

            valid_timestamps.append(now)
            self._records[key] = valid_timestamps
            return True, 0

    async def cleanup(self):
        """Periodic cleanup of stale keys."""
        now = time.time()
        async with self._lock:
            keys_to_delete = []
            for key, timestamps in self._records.items():
                active = [t for t in timestamps if t > now - 300]
                if not active:
                    keys_to_delete.append(key)
                else:
                    self._records[key] = active
            for k in keys_to_delete:
                del self._records[k]


limiter = SlidingWindowRateLimiter()


def rate_limit(max_requests: int = 60, window_seconds: int = 60, scope: str = "general"):
    """
    FastAPI dependency generating a rate limit check for the client's IP or user identifier.
    """
    async def dependency(request: Request):
        # Extract client IP safely (supports proxies via X-Forwarded-For if trusted)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        key = f"{scope}:{client_ip}"
        allowed, retry_after = await limiter.is_allowed(key, max_requests, window_seconds)

        if not allowed:
            logger.warning(f"Rate limit exceeded for key {key} (Scope: {scope}, Retry-After: {retry_after}s)")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Rate limit exceeded. Please retry after {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )

    return dependency
