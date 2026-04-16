"""ProgressDisplay implementations for API server modes.

ProgressSSE: yields SSE text delta events as sources complete (Mode 1/3).
ProgressBackground: updates task_manager state for polling (Mode 2).
"""

import asyncio
import queue
from typing import Optional


class ProgressSSE:
    """Progress tracker that pushes status text into a thread-safe queue.

    The API streaming handler reads from this queue and converts to SSE events.
    """

    def __init__(self):
        self._queue: queue.Queue = queue.Queue()
        self._done = False

    def get_queue(self) -> queue.Queue:
        return self._queue

    def is_done(self) -> bool:
        return self._done

    def mark_done(self):
        self._done = True
        self._queue.put(None)  # Sentinel

    def _push(self, text: str):
        self._queue.put(text)

    # --- ProgressDisplay compatible interface ---

    def start_reddit(self):
        self._push("🔍 Reddit: 搜索中...\n")

    def end_reddit(self, count: int):
        self._push(f"✅ Reddit: 找到 {count} 个帖子\n")

    def start_reddit_enrich(self, current: int, total: int):
        self._push(f"📊 Reddit: 补充数据 [{current}/{total}]...\n")

    def update_reddit_enrich(self, current: int, total: int):
        pass  # Skip noisy updates in API mode

    def end_reddit_enrich(self):
        self._push("✅ Reddit: 数据补充完成\n")

    def start_x(self):
        self._push("🔍 X/Twitter: 搜索中...\n")

    def end_x(self, count: int):
        self._push(f"✅ X: 找到 {count} 条推文\n")

    def start_youtube(self):
        self._push("🔍 YouTube: 搜索中...\n")

    def end_youtube(self, count: int):
        self._push(f"✅ YouTube: 找到 {count} 个视频\n")

    def start_tiktok(self):
        self._push("🔍 TikTok: 搜索中...\n")

    def end_tiktok(self, count: int):
        self._push(f"✅ TikTok: 找到 {count} 个视频\n")

    def start_instagram(self):
        self._push("🔍 Instagram: 搜索中...\n")

    def end_instagram(self, count: int):
        self._push(f"✅ Instagram: 找到 {count} 个 Reels\n")

    def start_hackernews(self):
        self._push("🔍 Hacker News: 搜索中...\n")

    def end_hackernews(self, count: int):
        self._push(f"✅ HN: 找到 {count} 个故事\n")

    def start_polymarket(self):
        self._push("🔍 Polymarket: 搜索中...\n")

    def end_polymarket(self, count: int):
        self._push(f"✅ Polymarket: 找到 {count} 个市场\n")

    def start_processing(self):
        self._push("⚙️ 处理中: 评分、去重、跨源关联...\n")

    def end_processing(self):
        self._push("✅ 处理完成\n")

    def show_complete(self, reddit_count=0, x_count=0, youtube_count=0, hn_count=0, pm_count=0, tiktok_count=0, ig_count=0):
        pass  # Handled by the streaming handler

    def show_cached(self, age_hours=None):
        self._push("⚡ 使用缓存结果\n")

    def show_error(self, message: str):
        self._push(f"⚠️ {message}\n")

    def start_web_only(self):
        self._push("🔍 Web: 搜索中...\n")

    def end_web_only(self):
        self._push("✅ Web: 搜索完成\n")

    def show_web_only_complete(self):
        pass

    def show_promo(self, missing="both", diag=None):
        pass  # No promos in API mode

    def show_bird_auth_help(self):
        pass


class ProgressBackground:
    """Progress tracker that updates task_manager state for polling (Mode 2)."""

    def __init__(self, response_id: str):
        from . import task_manager
        self._response_id = response_id
        self._tm = task_manager

    def start_reddit(self):
        self._tm.update_progress(self._response_id, "reddit", "started")

    def end_reddit(self, count: int):
        self._tm.update_progress(self._response_id, "reddit", "completed", count)

    def start_reddit_enrich(self, current, total):
        pass

    def update_reddit_enrich(self, current, total):
        pass

    def end_reddit_enrich(self):
        pass

    def start_x(self):
        self._tm.update_progress(self._response_id, "x", "started")

    def end_x(self, count: int):
        self._tm.update_progress(self._response_id, "x", "completed", count)

    def start_youtube(self):
        self._tm.update_progress(self._response_id, "youtube", "started")

    def end_youtube(self, count: int):
        self._tm.update_progress(self._response_id, "youtube", "completed", count)

    def start_tiktok(self):
        self._tm.update_progress(self._response_id, "tiktok", "started")

    def end_tiktok(self, count: int):
        self._tm.update_progress(self._response_id, "tiktok", "completed", count)

    def start_instagram(self):
        self._tm.update_progress(self._response_id, "instagram", "started")

    def end_instagram(self, count: int):
        self._tm.update_progress(self._response_id, "instagram", "completed", count)

    def start_hackernews(self):
        self._tm.update_progress(self._response_id, "hackernews", "started")

    def end_hackernews(self, count: int):
        self._tm.update_progress(self._response_id, "hackernews", "completed", count)

    def start_polymarket(self):
        self._tm.update_progress(self._response_id, "polymarket", "started")

    def end_polymarket(self, count: int):
        self._tm.update_progress(self._response_id, "polymarket", "completed", count)

    def start_processing(self):
        self._tm.update_progress(self._response_id, "processing", "started")

    def end_processing(self):
        self._tm.update_progress(self._response_id, "processing", "completed")

    def show_complete(self, *args, **kwargs):
        pass

    def show_cached(self, age_hours=None):
        pass

    def show_error(self, message):
        pass

    def start_web_only(self):
        pass

    def end_web_only(self):
        pass

    def show_web_only_complete(self):
        pass

    def show_promo(self, missing="both", diag=None):
        pass

    def show_bird_auth_help(self):
        pass
