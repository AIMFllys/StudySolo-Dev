"""Workflow collaboration routes: invite, list, accept, reject, shared."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import check_workflow_access, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "editor"


class CollaboratorOut(BaseModel):
    id: str
    user_id: str
    nickname: str | None = None
    email: str | None = None
    role: str
    status: str
    created_at: str


class InvitationOut(BaseModel):
    id: str
    workflow_id: str
    workflow_name: str | None = None
    inviter_name: str | None = None
    role: str
    status: str
    created_at: str


class SharedWorkflowItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    owner_name: str | None = None
    my_role: str
    tags: list[str] = []
    updated_at: str


# ── Collaborator management (owner only) ─────────────────────

@router.post("/{workflow_id}/collaborators", status_code=status.HTTP_201_CREATED)
async def invite_collaborator(
    workflow_id: str,
    body: InviteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Invite a user by email. Owner only."""
    if body.role not in ("editor", "viewer"):
        raise HTTPException(status_code=400, detail="角色只能是 editor 或 viewer")

    await check_workflow_access(workflow_id, current_user["id"], "owner", db)

    # Find invitee by email
    profile_res = (
        await db.from_("user_profiles")
        .select("id,email")
        .eq("email", body.email)
        .limit(1)
        .execute()
    )
    profile_rows = profile_res.data or []
    if not profile_rows:
        raise HTTPException(status_code=404, detail="未找到该用户")

    invitee_id = profile_rows[0]["id"]

    # Cannot invite self
    if invitee_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="不能邀请自己")

    # Check for existing invitation (might be rejected — allow re-invite)
    existing_res = (
        await db.from_("ss_workflow_collaborators")
        .select("id,status")
        .eq("workflow_id", workflow_id)
        .eq("user_id", invitee_id)
        .limit(1)
        .execute()
    )
    existing_rows = existing_res.data or []

    if existing_rows:
        if existing_rows[0]["status"] in ("pending", "accepted"):
            raise HTTPException(status_code=409, detail="该用户已被邀请")
        # Rejected → delete old record to allow re-invite
        await db.from_("ss_workflow_collaborators") \
            .delete().eq("id", existing_rows[0]["id"]).execute()

    await db.from_("ss_workflow_collaborators").insert({
        "workflow_id": workflow_id,
        "user_id": invitee_id,
        "role": body.role,
        "status": "pending",
        "invited_by": current_user["id"],
    }).execute()

    return {"success": True, "invited_email": body.email}


@router.get("/{workflow_id}/collaborators", response_model=list[CollaboratorOut])
async def list_collaborators(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """List collaborators. Access: owner + editor."""
    await check_workflow_access(workflow_id, current_user["id"], "editor", db)

    result = (
        await db.from_("ss_workflow_collaborators")
        .select("id,user_id,role,status,created_at")
        .eq("workflow_id", workflow_id)
        .order("created_at", desc=False)
        .execute()
    )
    collabs = result.data or []

    # Batch resolve nicknames
    user_ids = [c["user_id"] for c in collabs]
    if user_ids:
        profiles = (
            await db.from_("user_profiles")
            .select("id,nickname,email")
            .in_("id", user_ids)
            .execute()
        )
        name_map = {
            p["id"]: {"nickname": p.get("nickname"), "email": p.get("email")}
            for p in (profiles.data or [])
        }
        for c in collabs:
            info = name_map.get(c["user_id"], {})
            c["nickname"] = info.get("nickname")
            c["email"] = info.get("email")

    return collabs


@router.delete("/{workflow_id}/collaborators/{user_id}")
async def remove_collaborator(
    workflow_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Remove a collaborator. Owner only."""
    await check_workflow_access(workflow_id, current_user["id"], "owner", db)

    result = (
        await db.from_("ss_workflow_collaborators")
        .delete()
        .eq("workflow_id", workflow_id)
        .eq("user_id", user_id)
        .execute()
    )
    if result.data is not None and len(result.data) == 0:
        raise HTTPException(status_code=404, detail="协作者不存在")
    return {"success": True}


# ── Invitation responses (invitee) ───────────────────────────

@router.get("/invitations", response_model=list[InvitationOut])
async def list_my_invitations(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """List pending invitations for the current user."""
    result = (
        await db.from_("ss_workflow_collaborators")
        .select("id,workflow_id,role,status,created_at,invited_by")
        .eq("user_id", current_user["id"])
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    invitations = result.data or []

    # Resolve workflow names + inviter names
    wf_ids = list({i["workflow_id"] for i in invitations})
    inv_ids = list({i["invited_by"] for i in invitations})

    wf_map: dict[str, str] = {}
    if wf_ids:
        wfs = await db.from_("ss_workflows").select("id,name").in_("id", wf_ids).execute()
        wf_map = {w["id"]: w["name"] for w in (wfs.data or [])}

    inv_map: dict[str, str] = {}
    if inv_ids:
        profs = await db.from_("user_profiles").select("id,nickname").in_("id", inv_ids).execute()
        inv_map = {p["id"]: p.get("nickname", "未知用户") for p in (profs.data or [])}

    for inv in invitations:
        inv["workflow_name"] = wf_map.get(inv["workflow_id"])
        inv["inviter_name"] = inv_map.get(inv.pop("invited_by", ""), "未知用户")

    return invitations


@router.post("/invitations/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Accept a pending invitation."""
    return await _respond_invitation(invitation_id, current_user["id"], "accepted", db)


@router.post("/invitations/{invitation_id}/reject")
async def reject_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Reject a pending invitation."""
    return await _respond_invitation(invitation_id, current_user["id"], "rejected", db)


async def _respond_invitation(
    invitation_id: str, user_id: str, new_status: str, db: AsyncClient
) -> dict:
    inv_res = (
        await db.from_("ss_workflow_collaborators")
        .select("id,user_id,status")
        .eq("id", invitation_id)
        .limit(1)
        .execute()
    )
    inv_rows = inv_res.data or []
    if not inv_rows:
        raise HTTPException(status_code=404, detail="邀请不存在")
    inv_data = inv_rows[0]
    if inv_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="只能操作自己的邀请")
    if inv_data["status"] != "pending":
        raise HTTPException(status_code=400, detail="邀请已处理")

    await db.from_("ss_workflow_collaborators") \
        .update({"status": new_status}).eq("id", invitation_id).execute()
    return {"success": True, "status": new_status}


# ── Shared workspace list ────────────────────────────────────

@router.get("/shared", response_model=list[SharedWorkflowItem])
async def list_shared_workflows(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """List workflows shared with the current user (accepted collaborations)."""
    collabs = (
        await db.from_("ss_workflow_collaborators")
        .select("workflow_id,role")
        .eq("user_id", current_user["id"])
        .eq("status", "accepted")
        .execute()
    )
    collab_data = collabs.data or []
    if not collab_data:
        return []

    wf_ids = [c["workflow_id"] for c in collab_data]
    role_map = {c["workflow_id"]: c["role"] for c in collab_data}

    wfs = (
        await db.from_("ss_workflows")
        .select("id,name,description,user_id,tags,updated_at")
        .in_("id", wf_ids)
        .order("updated_at", desc=True)
        .execute()
    )
    workflows = wfs.data or []

    # Resolve owner names
    owner_ids = list({w["user_id"] for w in workflows})
    owner_map: dict[str, str] = {}
    if owner_ids:
        profs = await db.from_("user_profiles").select("id,nickname").in_("id", owner_ids).execute()
        owner_map = {p["id"]: p.get("nickname", "未知用户") for p in (profs.data or [])}

    result = []
    for w in workflows:
        result.append(SharedWorkflowItem(
            id=w["id"],
            name=w["name"],
            description=w.get("description"),
            owner_name=owner_map.get(w["user_id"], "未知用户"),
            my_role=role_map.get(w["id"], "viewer"),
            tags=w.get("tags", []),
            updated_at=w["updated_at"],
        ))
    return result
