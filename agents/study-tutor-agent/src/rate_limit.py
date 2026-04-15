import time
from collections import defaultdict, deque
from dataclasses import dataclass, field


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
