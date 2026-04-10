"""Usage tracking decorator for API endpoints.

Implements the @track_usage contract from Phase 1 Task 1.4.

Usage:
    @router.post("/chat")
    @track_usage(source_type="assistant", source_subtype="chat")
    async def ai_chat(body, current_user=Depends(get_current_user)):
        # ... pure business logic, no usage boilerplate ...
"""

import functools
import inspect
import logging
from typing import Any, Callable

from app.services.usage_ledger import (
    bind_usage_request,
    create_usage_request,
    finalize_usage_request,
)

logger = logging.getLogger(__name__)


def track_usage(
    source_type: str,
    source_subtype: str | None = None,
    *,
    workflow_id_param: str | None = None,
    subtype_resolver: Callable[..., str] | None = None,
):
    """Decorator that wraps an endpoint with usage lifecycle management.

    Behavior:
        1. Extract ``current_user`` from kwargs (FastAPI Depends).
        2. Call ``create_usage_request()`` to create a DB record.
        3. ``bind_usage_request()`` → ContextVar scope.
        4. Execute the wrapped function.
        5. On success → ``finalize(status="completed")``.
        6. On exception → ``finalize(status="failed")`` → re-raise.

    Args:
        source_type: "assistant" | "workflow".
        source_subtype: Static subtype. If None, ``subtype_resolver`` is used.
        workflow_id_param: Dot-path to extract workflow_id from the request body.
        subtype_resolver: ``(body) -> str`` callback for dynamic subtype.

    Notes:
        - Must be placed AFTER ``@router.post()`` (closer to the function).
        - Not suitable for streaming endpoints — those manage their own
          lifecycle inside the generator's ``finally`` block.
    """

    def decorator(fn: Callable) -> Callable:
        sig = inspect.signature(fn)

        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # ── Resolve current_user ──
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()
            current_user = bound.arguments.get("current_user")
            if current_user is None:
                logger.warning(
                    "track_usage: current_user not found in %s, skipping usage tracking",
                    fn.__name__,
                )
                return await fn(*args, **kwargs)

            user_id = current_user["id"]

            # ── Resolve source_subtype ──
            resolved_subtype = source_subtype
            if resolved_subtype is None and subtype_resolver is not None:
                body = bound.arguments.get("body")
                if body is not None:
                    try:
                        resolved_subtype = subtype_resolver(body)
                    except Exception:
                        resolved_subtype = "unknown"
                else:
                    resolved_subtype = "unknown"

            if resolved_subtype is None:
                resolved_subtype = "unknown"

            # ── Resolve workflow_id ──
            workflow_id = None
            if workflow_id_param:
                body = bound.arguments.get("body")
                if body is not None:
                    parts = workflow_id_param.split(".")
                    obj: Any = body
                    for part in parts:
                        obj = getattr(obj, part, None)
                        if obj is None:
                            break
                    workflow_id = obj

            # ── Create + Bind + Execute + Finalize ──
            usage_request = await create_usage_request(
                user_id=user_id,
                source_type=source_type,
                source_subtype=resolved_subtype,
                workflow_id=workflow_id,
            )
            request_status = "completed"

            with bind_usage_request(usage_request):
                try:
                    return await fn(*args, **kwargs)
                except Exception:
                    request_status = "failed"
                    raise
                finally:
                    await finalize_usage_request(
                        usage_request.request_id, request_status,
                    )

        return wrapper

    return decorator
