"""Research pipeline: wraps run_research() + post-processing into a single callable.

Extracts the normalize → score → sort → dedupe → cross_source_link → Report
assembly logic from last30days.py main() into a reusable function.
"""

import sys
from pathlib import Path
from typing import Optional

# Ensure project root is on path
_PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from lib import (
    dates,
    dedupe,
    env,
    models,
    normalize,
    schema,
    score,
    render,
    websearch,
    quality_nudge,
    query_type as qt,
)

# Import run_research from the engine
from last30days import run_research, TIMEOUT_PROFILES


def merge_config(file_config: dict, request_keys: dict) -> dict:
    """Merge file-based config with request-provided API keys.

    Request keys take priority over file config.
    """
    merged = dict(file_config)
    if request_keys:
        for k, v in request_keys.items():
            if v is not None:
                merged[k] = v
    return merged


def detect_sources(config: dict):
    """Detect available sources from config. Returns a dict of booleans."""
    return {
        "has_ytdlp": env.is_ytdlp_available(),
        "has_tiktok": env.is_tiktok_available(config),
        "has_instagram": env.is_instagram_available(config),
        "has_xiaohongshu": env.is_xiaohongshu_available(config),
        "has_bluesky": env.is_bluesky_available(config),
        "has_truthsocial": env.is_truthsocial_available(config),
        "x_source_status": env.get_x_source_status(config),
    }


def execute_research(
    topic: str,
    config: dict,
    depth: str = "default",
    days: int = 30,
    sources_filter: str = "all",
    include_web: bool = False,
    no_native_web: bool = True,
    x_handle: Optional[str] = None,
    progress=None,
) -> schema.Report:
    """Execute the full research pipeline and return a Report.

    This is the main entry point for the API server. It handles:
    1. Source availability detection
    2. Model selection
    3. Calling run_research()
    4. Post-processing: normalize → score → sort → dedupe → cross_source_link
    5. Report assembly

    Args:
        topic: Research topic string
        config: Merged config dict (file defaults + request overrides)
        depth: "quick", "default", or "deep"
        days: Number of days to look back (1-30)
        sources_filter: Source selection - "all", "both", "reddit", "x", "web"
        include_web: Whether to include web search
        no_native_web: Skip native web backends (default True for API mode)
        x_handle: Pre-resolved X handle for the topic entity
        progress: Optional progress callback (ProgressDisplay or compatible)

    Returns:
        schema.Report with all results populated
    """
    from lib import bird_x

    # Date range
    from_date, to_date = dates.get_date_range(days)

    # Detect available sources
    source_info = detect_sources(config)
    x_source_status = source_info["x_source_status"]
    x_source = x_source_status["source"]

    # Inject Bird credentials if available
    bird_x.set_credentials(config.get("AUTH_TOKEN"), config.get("CT0"))

    # Select models
    selected_models = models.get_models(config)

    # Determine source mode string
    available = env.get_available_sources(config)
    resolved_sources, error = env.validate_sources(
        sources_filter if sources_filter != "all" else "auto",
        available,
        include_web,
    )
    if error and "WebSearch fallback" not in (error or ""):
        resolved_sources = "both"  # safe default

    # Determine mode string for report
    mode_map = {
        "all": "all", "both": "both", "reddit": "reddit-only",
        "reddit-web": "reddit-web", "x": "x-only", "x-web": "x-web",
        "web": "web-only",
    }
    mode = mode_map.get(resolved_sources, resolved_sources)

    # Query type detection
    query_type = qt.detect_query_type(topic)

    # Source enablement (query-type aware)
    has = source_info
    do_hn = qt.is_source_enabled("hn", query_type)
    do_bsky = has["has_bluesky"] and qt.is_source_enabled("bluesky", query_type)
    do_ts = False  # Truth Social always opt-in
    do_pm = qt.is_source_enabled("polymarket", query_type)
    do_yt = has["has_ytdlp"] and qt.is_source_enabled("youtube", query_type)
    do_tk = has["has_tiktok"] and qt.is_source_enabled("tiktok", query_type)
    do_ig = has["has_instagram"] and qt.is_source_enabled("instagram", query_type)
    do_xhs = has["has_xiaohongshu"]

    # INCLUDE_SOURCES override
    include_src = {s.strip().lower() for s in (config.get("INCLUDE_SOURCES") or "").split(",") if s.strip()}
    if "tiktok" in include_src and has["has_tiktok"]:
        do_tk = True
    if "instagram" in include_src and has["has_instagram"]:
        do_ig = True

    timeouts = TIMEOUT_PROFILES[depth]

    # --- Run research ---
    (
        reddit_items, x_items, youtube_items, tiktok_items, instagram_items,
        hackernews_items, bluesky_items, truthsocial_items, polymarket_items,
        web_items, web_needed,
        raw_openai, raw_xai, raw_reddit_enriched,
        reddit_error, x_error, youtube_error, tiktok_error, instagram_error,
        hackernews_error, bluesky_error, truthsocial_error, polymarket_error, web_error,
    ) = run_research(
        topic, resolved_sources, config, selected_models,
        from_date, to_date, depth,
        mock=False,
        progress=progress,
        x_source=x_source or "xai",
        run_youtube=do_yt,
        run_tiktok=do_tk,
        run_instagram=do_ig,
        run_xiaohongshu=do_xhs,
        timeouts=timeouts,
        resolved_handle=x_handle,
        do_hackernews=do_hn,
        do_bluesky=do_bsky,
        do_truthsocial=do_ts,
        do_polymarket=do_pm,
        no_native_web=no_native_web,
    )

    # --- Post-processing pipeline ---
    report = _post_process(
        topic=topic,
        from_date=from_date,
        to_date=to_date,
        mode=mode,
        query_type=query_type,
        selected_models=selected_models,
        x_handle=x_handle,
        reddit_items=reddit_items,
        x_items=x_items,
        youtube_items=youtube_items,
        tiktok_items=tiktok_items,
        instagram_items=instagram_items,
        hackernews_items=hackernews_items,
        bluesky_items=bluesky_items,
        truthsocial_items=truthsocial_items,
        polymarket_items=polymarket_items,
        web_items=web_items,
        reddit_error=reddit_error,
        x_error=x_error,
        youtube_error=youtube_error,
        tiktok_error=tiktok_error,
        instagram_error=instagram_error,
        hackernews_error=hackernews_error,
        bluesky_error=bluesky_error,
        truthsocial_error=truthsocial_error,
        polymarket_error=polymarket_error,
        web_error=web_error,
    )

    return report


def _post_process(
    topic, from_date, to_date, mode, query_type, selected_models, x_handle,
    reddit_items, x_items, youtube_items, tiktok_items, instagram_items,
    hackernews_items, bluesky_items, truthsocial_items, polymarket_items, web_items,
    reddit_error, x_error, youtube_error, tiktok_error, instagram_error,
    hackernews_error, bluesky_error, truthsocial_error, polymarket_error, web_error,
) -> schema.Report:
    """Normalize → score → sort → dedupe → cross_source_link → assemble Report."""

    # Normalize
    n_reddit = normalize.normalize_reddit_items(reddit_items, from_date, to_date)
    n_x = normalize.normalize_x_items(x_items, from_date, to_date)
    n_yt = normalize.normalize_youtube_items(youtube_items, from_date, to_date) if youtube_items else []
    n_tk = normalize.normalize_tiktok_items(tiktok_items, from_date, to_date) if tiktok_items else []
    n_ig = normalize.normalize_instagram_items(instagram_items, from_date, to_date) if instagram_items else []
    n_hn = normalize.normalize_hackernews_items(hackernews_items, from_date, to_date) if hackernews_items else []
    n_bsky = normalize.normalize_bluesky_items(bluesky_items, from_date, to_date) if bluesky_items else []
    n_ts = normalize.normalize_truthsocial_items(truthsocial_items, from_date, to_date) if truthsocial_items else []
    n_pm = normalize.normalize_polymarket_items(polymarket_items, from_date, to_date) if polymarket_items else []
    n_web = websearch.normalize_websearch_items(web_items, from_date, to_date) if web_items else []

    # Date filter
    f_reddit = normalize.filter_by_date_range(n_reddit, from_date, to_date)
    f_x = normalize.filter_by_date_range(n_x, from_date, to_date)
    f_yt = n_yt  # YouTube: skip hard date filter (evergreen content)
    f_tk = normalize.filter_by_date_range(n_tk, from_date, to_date) if n_tk else []
    f_ig = normalize.filter_by_date_range(n_ig, from_date, to_date) if n_ig else []
    f_hn = normalize.filter_by_date_range(n_hn, from_date, to_date) if n_hn else []
    f_bsky = normalize.filter_by_date_range(n_bsky, from_date, to_date) if n_bsky else []
    f_ts = normalize.filter_by_date_range(n_ts, from_date, to_date) if n_ts else []
    f_pm = n_pm  # Polymarket: skip hard date filter
    f_web = normalize.filter_by_date_range(n_web, from_date, to_date) if n_web else []

    # Score
    s_reddit = score.score_reddit_items(f_reddit)
    s_x = score.score_x_items(f_x)
    s_yt = score.score_youtube_items(f_yt) if f_yt else []
    s_tk = score.score_tiktok_items(f_tk) if f_tk else []
    s_ig = score.score_instagram_items(f_ig) if f_ig else []
    s_hn = score.score_hackernews_items(f_hn) if f_hn else []
    s_bsky = score.score_bluesky_items(f_bsky) if f_bsky else []
    s_ts = score.score_truthsocial_items(f_ts) if f_ts else []
    s_pm = score.score_polymarket_items(f_pm) if f_pm else []
    s_web = score.score_websearch_items(f_web, query_type=query_type) if f_web else []

    # Sort
    so_reddit = score.sort_items(s_reddit, query_type=query_type)
    so_x = score.sort_items(s_x, query_type=query_type)
    so_yt = score.sort_items(s_yt, query_type=query_type) if s_yt else []
    so_tk = score.sort_items(s_tk, query_type=query_type) if s_tk else []
    so_ig = score.sort_items(s_ig, query_type=query_type) if s_ig else []
    so_hn = score.sort_items(s_hn, query_type=query_type) if s_hn else []
    so_bsky = score.sort_items(s_bsky, query_type=query_type) if s_bsky else []
    so_ts = score.sort_items(s_ts, query_type=query_type) if s_ts else []
    so_pm = score.sort_items(s_pm, query_type=query_type) if s_pm else []
    so_web = score.sort_items(s_web, query_type=query_type) if s_web else []

    # Dedupe
    d_reddit = dedupe.dedupe_reddit(so_reddit)
    d_x = dedupe.dedupe_x(so_x)
    d_yt = dedupe.dedupe_youtube(so_yt) if so_yt else []
    d_tk = dedupe.dedupe_tiktok(so_tk) if so_tk else []
    d_ig = dedupe.dedupe_instagram(so_ig) if so_ig else []
    d_hn = dedupe.dedupe_hackernews(so_hn) if so_hn else []
    d_bsky = dedupe.dedupe_bluesky(so_bsky) if so_bsky else []
    d_ts = dedupe.dedupe_truthsocial(so_ts) if so_ts else []
    d_pm = dedupe.dedupe_polymarket(so_pm) if so_pm else []
    d_web = websearch.dedupe_websearch(so_web) if so_web else []

    # Relevance filter
    d_reddit = score.relevance_filter(d_reddit, "REDDIT")
    d_x = score.relevance_filter(d_x, "X")
    d_yt = score.relevance_filter(d_yt, "YOUTUBE")
    d_tk = score.relevance_filter(d_tk, "TIKTOK")
    d_ig = score.relevance_filter(d_ig, "INSTAGRAM")
    d_hn = score.relevance_filter(d_hn, "HN")
    d_bsky = score.relevance_filter(d_bsky, "BLUESKY")
    d_ts = score.relevance_filter(d_ts, "TRUTHSOCIAL")
    d_pm = score.relevance_filter(d_pm, "POLYMARKET") if d_pm else []

    # Cross-source linking
    dedupe.cross_source_link(d_reddit, d_x, d_yt, d_tk, d_ig, d_hn, d_bsky, d_ts, d_pm, d_web)

    # Assemble report
    report = schema.create_report(
        topic, from_date, to_date, mode,
        selected_models.get("openai"),
        selected_models.get("xai"),
    )
    report.reddit = d_reddit
    report.x = d_x
    report.youtube = d_yt
    report.tiktok = d_tk
    report.instagram = d_ig
    report.hackernews = d_hn
    report.bluesky = d_bsky
    report.truthsocial = d_ts
    report.polymarket = d_pm
    report.web = d_web
    report.reddit_error = reddit_error
    report.x_error = x_error
    report.youtube_error = youtube_error
    report.tiktok_error = tiktok_error
    report.instagram_error = instagram_error
    report.hackernews_error = hackernews_error
    report.bluesky_error = bluesky_error
    report.truthsocial_error = truthsocial_error
    report.polymarket_error = polymarket_error
    report.web_error = web_error
    report.resolved_x_handle = x_handle
    report.context_snippet_md = render.render_context_snippet(report)

    return report
