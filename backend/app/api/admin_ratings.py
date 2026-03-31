"""Admin Ratings API.

Endpoints:
  GET /ratings/overview  — Aggregated feedback stats from ss_feedback
  GET /ratings/details   — Paginated feedback details with user info
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase._async.client import AsyncClient

from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-ratings"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class RatingOverview(BaseModel):
    total_count: int
    avg_rating: float | None
    rating_distribution: dict[int, int]  # score -> count
    reward_applied_count: int


class RatingItem(BaseModel):
    id: str
    user_id: str
    email: str | None
    nickname: str | None
    rating: int
    issue_type: str
    content: str
    reward_days: int
    reward_applied: bool
    created_at: str


class PaginatedRatingList(BaseModel):
    ratings: list[RatingItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/ratings/overview", response_model=RatingOverview)
async def get_ratings_overview(
    db: AsyncClient = Depends(get_db),
) -> RatingOverview:
    """Return aggregated feedback statistics from ss_feedback."""
    try:
        result = (
            await db.table("ss_feedback")
            .select("rating, reward_applied")
            .execute()
        )
        rows = result.data or []

        total_count = len(rows)
        scores = [int(r["rating"]) for r in rows]
        avg_rating = (sum(scores) / total_count) if total_count > 0 else None

        distribution: dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for s in scores:
            distribution[s] = distribution.get(s, 0) + 1

        reward_applied_count = sum(1 for r in rows if r.get("reward_applied"))

    except Exception as exc:
        logger.exception("Ratings overview query failed: %s", exc)
        raise HTTPException(status_code=500, detail="获取评分概览失败")

    return RatingOverview(
        total_count=total_count,
        avg_rating=round(avg_rating, 2) if avg_rating is not None else None,
        rating_distribution=distribution,
        reward_applied_count=reward_applied_count,
    )


@router.get("/ratings/details", response_model=PaginatedRatingList)
async def get_ratings_details(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    rating: int | None = Query(default=None, ge=1, le=5),
    db: AsyncClient = Depends(get_db),
) -> PaginatedRatingList:
    """Return paginated feedback details from ss_feedback."""
    try:
        query = db.table("ss_feedback").select(
            "id, user_id, user_email, user_nickname, rating, issue_type, content, reward_days, reward_applied, created_at",
            count="exact",
        )
        if rating is not None:
            query = query.eq("rating", rating)

        offset = (page - 1) * page_size
        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)

        result = await query.execute()
        rows = result.data or []
        total = result.count or 0
        total_pages = max(1, (total + page_size - 1) // page_size)

        ratings = [
            RatingItem(
                id=row["id"],
                user_id=row["user_id"],
                email=row.get("user_email") or None,
                nickname=row.get("user_nickname") or None,
                rating=int(row["rating"]),
                issue_type=row.get("issue_type", ""),
                content=row.get("content", ""),
                reward_days=int(row.get("reward_days", 0)),
                reward_applied=bool(row.get("reward_applied", False)),
                created_at=str(row["created_at"]),
            )
            for row in rows
        ]

    except Exception as exc:
        logger.exception("Ratings details query failed: %s", exc)
        raise HTTPException(status_code=500, detail="获取评分详情失败")

    return PaginatedRatingList(
        ratings=ratings,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
