"""Unified route aggregation for StudySolo API."""

from fastapi import APIRouter

from app.api.admin_audit import router as admin_audit_router
from app.api.admin_auth import router as admin_auth_router
from app.api.admin_config import router as admin_config_router
from app.api.admin_dashboard import router as admin_dashboard_router
from app.api.admin_members import router as admin_members_router
from app.api.admin_models import router as admin_models_router
from app.api.admin_notices import router as admin_notices_router
from app.api.admin_ratings import router as admin_ratings_router
from app.api.admin_users import router as admin_users_router
from app.api.admin_workflows import router as admin_workflows_router
from app.api.auth import router as auth_router
from app.api.workflow import router as workflow_router
from app.api.workflow_execute import router as workflow_execute_router
from app.api.workflow_social import router as workflow_social_router
from app.api.ai import router as ai_router
from app.api.ai_chat import router as ai_chat_router
from app.api.ai_chat_stream import stream_router as ai_chat_stream_router
from app.api.nodes import router as nodes_router
from app.api.knowledge import router as knowledge_router
from app.api.exports import router as exports_router
from app.api.feedback import router as feedback_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(workflow_router, prefix="/workflow", tags=["workflow"])
router.include_router(workflow_social_router, prefix="/workflow", tags=["workflow-social"])
router.include_router(workflow_execute_router, prefix="/workflow", tags=["workflow-execute"])
router.include_router(ai_router, prefix="/ai", tags=["ai"])
router.include_router(ai_chat_router, prefix="/ai", tags=["ai-chat"])
router.include_router(ai_chat_stream_router, prefix="/ai", tags=["ai-chat-stream"])
router.include_router(nodes_router, prefix="/nodes", tags=["nodes"])
router.include_router(knowledge_router, prefix="/knowledge", tags=["knowledge"])
router.include_router(exports_router, prefix="/exports", tags=["exports"])
router.include_router(feedback_router, prefix="/feedback", tags=["feedback"])
router.include_router(admin_auth_router, prefix="/admin", tags=["admin-auth"])
router.include_router(admin_dashboard_router, prefix="/admin", tags=["admin-dashboard"])
router.include_router(admin_users_router, prefix="/admin", tags=["admin-users"])
router.include_router(admin_notices_router, prefix="/admin", tags=["admin-notices"])
router.include_router(admin_workflows_router, prefix="/admin", tags=["admin-workflows"])
router.include_router(admin_models_router, prefix="/admin", tags=["admin-models"])
router.include_router(admin_members_router, prefix="/admin", tags=["admin-members"])
router.include_router(admin_ratings_router, prefix="/admin", tags=["admin-ratings"])
router.include_router(admin_config_router, prefix="/admin", tags=["admin-config"])
router.include_router(admin_audit_router, prefix="/admin", tags=["admin-audit"])
