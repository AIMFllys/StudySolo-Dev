import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from threading import Lock


@dataclass(slots=True)
class InMemoryRateLimiter:
    max_requests: int
    window_seconds: int
    buckets: dict[str, deque[float]] = field(default_factory=lambda: defaultdict(deque))

    def allow(self, key: str, now: float | None = None) -> bool:
        current = now if now is not None else time.monotonic()
        bucket = self.buckets[key]
        threshold = current - self.window_seconds

        while bucket and bucket[0] <= threshold:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            return False

        bucket.append(current)
        return True


@dataclass(slots=True)
class InMemoryConcurrencyLimiter:
    max_in_flight: int
    in_flight: int = 0
    _lock: Lock = field(default_factory=Lock)

    def try_acquire(self) -> bool:
        with self._lock:
            if self.in_flight >= self.max_in_flight:
                return False
            self.in_flight += 1
            return True

    def release(self) -> None:
        with self._lock:
            if self.in_flight > 0:
                self.in_flight -= 1
