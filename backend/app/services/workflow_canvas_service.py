"""Workflow canvas helpers for real React Flow node/edge instances.

This module is the backend source of truth for creating and validating
StudySolo workflow canvas objects. It intentionally produces the same shape
that the browser canvas stores in ``nodes_json`` and ``edges_json``.
"""

from __future__ import annotations

import copy
import uuid
from collections import defaultdict, deque
from typing import Any

from app.nodes import BaseNode

DEFAULT_NODE_WIDTH_OFFSET = 340
DEFAULT_NODE_Y = 120
DEFAULT_NODE_X = 120

_HANDLE_SOURCE_RIGHT = "source-right"
_HANDLE_TARGET_LEFT = "target-left"
_COMPAT_NON_MANIFEST_TYPES = {"annotation", "generating", "community_node"}
_VISUAL_ONLY_TYPES = {"annotation", "generating"}
_LEGACY_NODE_TYPE_ALIASES = {
    "input": "trigger_input",
}


class CanvasPatchError(ValueError):
    """Raised when a canvas patch is invalid and must not be saved."""

    def __init__(self, message: str, *, code: str = "invalid_canvas_patch", detail: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.detail = detail


def _manifest_by_type() -> dict[str, dict[str, Any]]:
    return {str(item.get("type")): item for item in BaseNode.get_manifest()}


def _known_node_types() -> set[str]:
    return set(_manifest_by_type().keys())


def _canonical_node_type(node_type: str) -> str:
    return _LEGACY_NODE_TYPE_ALIASES.get(node_type, node_type)


def _make_id(prefix: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in prefix).strip("-")
    return f"{safe or 'node'}-{uuid.uuid4().hex[:12]}"


def _position_or_default(position: dict[str, Any] | None) -> dict[str, float]:
    if not isinstance(position, dict):
        return {"x": float(DEFAULT_NODE_X), "y": float(DEFAULT_NODE_Y)}
    try:
        x = float(position.get("x", DEFAULT_NODE_X))
        y = float(position.get("y", DEFAULT_NODE_Y))
    except (TypeError, ValueError) as exc:
        raise CanvasPatchError("position.x and position.y must be numbers", code="invalid_position") from exc
    return {"x": x, "y": y}


def _merge_dict(base: dict[str, Any], patch: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(patch, dict):
        return base
    merged = copy.deepcopy(base)
    for key, value in patch.items():
        if key == "config" and isinstance(value, dict) and isinstance(merged.get("config"), dict):
            merged["config"] = {**merged["config"], **value}
        else:
            merged[key] = value
    return merged



def _normalize_compat_node(node: dict[str, Any], node_type: str) -> dict[str, Any]:
    copied = copy.deepcopy(node)
    copied["id"] = str(copied.get("id") or _make_id(node_type))
    copied["type"] = node_type
    copied["position"] = _position_or_default(copied.get("position") if isinstance(copied.get("position"), dict) else None)
    data = copied.get("data") if isinstance(copied.get("data"), dict) else {}
    if node_type == "community_node":
        defaults = {
            "label": data.get("label") or "Community Node",
            "type": "community_node",
            "system_prompt": "",
            "model_route": "",
            "status": "pending",
            "output": "",
            "output_format": "markdown",
            "input_hint": "",
            "config": {},
        }
        copied["data"] = _merge_dict(defaults, data)
        copied["data"]["type"] = "community_node"
    else:
        copied["data"] = data or {"label": node_type}
    return copied

def create_workflow_node_instance(
    node_type: str,
    *,
    label: str | None = None,
    position: dict[str, Any] | None = None,
    data_patch: dict[str, Any] | None = None,
    node_id: str | None = None,
) -> dict[str, Any]:
    """Create a complete, executable workflow node instance."""
    node_type = _canonical_node_type(node_type)
    manifest = _manifest_by_type()
    if node_type not in manifest:
        raise CanvasPatchError(f"Unknown node type: {node_type}", code="unknown_node_type", detail={"node_type": node_type})

    item = manifest[node_type]
    resolved_label = label or str(item.get("display_name") or node_type)
    output_format = str(item.get("output_format") or "markdown")

    if node_type == "loop_group":
        data: dict[str, Any] = {
            "label": resolved_label or "Loop Group",
            "maxIterations": 3,
            "intervalSeconds": 0,
        }
    else:
        data = {
            "label": resolved_label,
            "type": node_type,
            "system_prompt": "",
            "model_route": "",
            "status": "pending",
            "output": "",
            "output_format": output_format,
            "config": {},
        }
        if node_type == "trigger_input":
            data["user_content"] = ""

    data = _merge_dict(data, data_patch)
    data["label"] = str(data.get("label") or resolved_label)
    if node_type != "loop_group":
        data["type"] = node_type
        data.setdefault("config", {})
        data.setdefault("status", "pending")
        data.setdefault("output", "")
        data.setdefault("output_format", output_format)

    node: dict[str, Any] = {
        "id": node_id or _make_id(node_type),
        "type": node_type,
        "position": _position_or_default(position),
        "data": data,
    }
    if node_type == "loop_group":
        node["style"] = {"width": 500, "height": 350}
    return node


def normalize_workflow_node(node: dict[str, Any]) -> dict[str, Any]:
    """Normalize a stored node so it has fields needed by canvas and engine."""
    if not isinstance(node, dict):
        raise CanvasPatchError("Node must be an object", code="invalid_node")
    node_type = _canonical_node_type(str(node.get("type") or (node.get("data") or {}).get("type") or ""))
    if not node_type:
        raise CanvasPatchError("Node is missing type", code="missing_node_type")
    if node_type not in _manifest_by_type() and node_type in _COMPAT_NON_MANIFEST_TYPES:
        return _normalize_compat_node(node, node_type)
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    normalized = create_workflow_node_instance(
        node_type,
        label=str(data.get("label") or "") or None,
        position=node.get("position") if isinstance(node.get("position"), dict) else None,
        data_patch=data,
        node_id=str(node.get("id") or "") or None,
    )
    for key in ("parentId", "extent", "draggable", "selectable", "style"):
        if key in node:
            if key == "style" and isinstance(node.get("style"), dict) and isinstance(normalized.get("style"), dict):
                normalized["style"] = {**normalized["style"], **node["style"]}
            else:
                normalized[key] = copy.deepcopy(node[key])
    return normalized


def _next_branch_for_source(source: str, edges: list[dict[str, Any]]) -> str:
    existing = [
        ((edge.get("data") or {}).get("branch"))
        for edge in edges
        if edge.get("source") == source and isinstance(edge.get("data"), dict)
    ]
    used = {str(branch) for branch in existing if branch}
    index = 0
    while True:
        candidate = chr(ord("A") + index)
        if candidate not in used:
            return candidate
        index += 1


def create_workflow_edge_instance(
    source: str,
    target: str,
    *,
    edge_id: str | None = None,
    data_patch: dict[str, Any] | None = None,
    existing_edges: list[dict[str, Any]] | None = None,
    nodes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Create a complete workflow edge instance."""
    data: dict[str, Any] = {}
    source_node = next((node for node in (nodes or []) if node.get("id") == source), None)
    source_type = None
    if source_node:
        source_data = source_node.get("data") if isinstance(source_node.get("data"), dict) else {}
        source_type = source_data.get("type") or source_node.get("type")
    if source_type == "logic_switch":
        data["branch"] = _next_branch_for_source(source, existing_edges or [])
    data = _merge_dict(data, data_patch)

    return {
        "id": edge_id or f"edge-seq-{source}-{target}-{uuid.uuid4().hex[:8]}",
        "source": source,
        "target": target,
        "type": "sequential",
        "animated": False,
        "sourceHandle": _HANDLE_SOURCE_RIGHT,
        "targetHandle": _HANDLE_TARGET_LEFT,
        "data": data,
    }


def normalize_workflow_edge(edge: dict[str, Any], *, nodes: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Normalize a stored edge to the current sequential edge shape."""
    if not isinstance(edge, dict):
        raise CanvasPatchError("Edge must be an object", code="invalid_edge")
    source = str(edge.get("source") or "")
    target = str(edge.get("target") or "")
    if not source or not target:
        raise CanvasPatchError("Edge is missing source or target", code="missing_edge_endpoint")
    normalized = create_workflow_edge_instance(
        source,
        target,
        edge_id=str(edge.get("id") or "") or None,
        data_patch=edge.get("data") if isinstance(edge.get("data"), dict) else {},
        nodes=nodes,
    )
    for key in ("sourceHandle", "targetHandle", "animated", "type"):
        if key in edge and edge[key] not in (None, ""):
            normalized[key] = edge[key]
    return normalized


def _resolve_ref(value: Any, id_map: dict[str, str]) -> str:
    if isinstance(value, str) and value.startswith("$"):
        key = value[1:]
        if key not in id_map:
            raise CanvasPatchError(f"Unknown client_id reference: {value}", code="unknown_client_ref", detail={"ref": value})
        return id_map[key]
    if not isinstance(value, str) or not value:
        raise CanvasPatchError("Reference must be a non-empty string", code="invalid_ref")
    return value


def _next_position(nodes: list[dict[str, Any]]) -> dict[str, float]:
    if not nodes:
        return {"x": float(DEFAULT_NODE_X), "y": float(DEFAULT_NODE_Y)}
    max_x = max(float((node.get("position") or {}).get("x", DEFAULT_NODE_X)) for node in nodes)
    return {"x": max_x + DEFAULT_NODE_WIDTH_OFFSET, "y": float(DEFAULT_NODE_Y)}


def apply_canvas_patch(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    ops: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str], list[dict[str, Any]]]:
    """Apply a list of canvas patch operations to node/edge arrays."""
    next_nodes = [normalize_workflow_node(copy.deepcopy(node)) for node in (nodes or [])]
    next_edges = [normalize_workflow_edge(copy.deepcopy(edge), nodes=next_nodes) for edge in (edges or [])]
    id_map: dict[str, str] = {}
    warnings: list[dict[str, Any]] = []

    for index, op in enumerate(ops or []):
        if not isinstance(op, dict):
            raise CanvasPatchError(f"Operation {index + 1} must be an object", code="invalid_operation")
        op_name = str(op.get("op") or "")
        client_id = op.get("client_id")

        if op_name == "create_node":
            node_type = str(op.get("node_type") or op.get("type") or "")
            if not node_type:
                raise CanvasPatchError("create_node is missing node_type", code="missing_node_type")
            node = create_workflow_node_instance(
                node_type,
                label=op.get("label") if isinstance(op.get("label"), str) else None,
                position=op.get("position") if isinstance(op.get("position"), dict) else _next_position(next_nodes),
                data_patch=op.get("data") if isinstance(op.get("data"), dict) else {},
                node_id=op.get("node_id") if isinstance(op.get("node_id"), str) and op.get("node_id") else None,
            )
            if any(existing.get("id") == node["id"] for existing in next_nodes):
                raise CanvasPatchError(f"Node ID already exists: {node['id']}", code="duplicate_node_id")
            next_nodes.append(node)
            if isinstance(client_id, str) and client_id:
                id_map[client_id] = node["id"]

        elif op_name == "update_node_data":
            node_id = _resolve_ref(op.get("node_id") or op.get("target_node_id"), id_map)
            patch = op.get("data") if isinstance(op.get("data"), dict) else {}
            updated = False
            for node in next_nodes:
                if node.get("id") != node_id:
                    continue
                data = node.get("data") if isinstance(node.get("data"), dict) else {}
                node["data"] = _merge_dict(data, patch)
                if node.get("type") != "loop_group":
                    node["data"]["type"] = node.get("type")
                updated = True
                break
            if not updated:
                raise CanvasPatchError(f"Node not found: {node_id}", code="node_not_found")

        elif op_name == "move_node":
            node_id = _resolve_ref(op.get("node_id") or op.get("target_node_id"), id_map)
            position = _position_or_default(op.get("position") if isinstance(op.get("position"), dict) else None)
            updated = False
            for node in next_nodes:
                if node.get("id") == node_id:
                    node["position"] = position
                    updated = True
                    break
            if not updated:
                raise CanvasPatchError(f"Node not found: {node_id}", code="node_not_found")

        elif op_name == "delete_node":
            if op.get("confirm_delete") is not True:
                raise CanvasPatchError("delete_node requires confirm_delete=true", code="delete_confirmation_required")
            node_id = _resolve_ref(op.get("node_id") or op.get("target_node_id"), id_map)
            if not any(node.get("id") == node_id for node in next_nodes):
                raise CanvasPatchError(f"Node not found: {node_id}", code="node_not_found")
            next_nodes = [node for node in next_nodes if node.get("id") != node_id]
            next_edges = [edge for edge in next_edges if edge.get("source") != node_id and edge.get("target") != node_id]

        elif op_name == "create_edge":
            source = _resolve_ref(op.get("source") or op.get("source_id"), id_map)
            target = _resolve_ref(op.get("target") or op.get("target_id"), id_map)
            node_ids = {node.get("id") for node in next_nodes}
            if source not in node_ids or target not in node_ids:
                raise CanvasPatchError("create_edge source and target must exist", code="edge_endpoint_not_found")
            if source == target:
                raise CanvasPatchError("Self edges are not allowed", code="self_edge")
            if any(edge.get("source") == source and edge.get("target") == target for edge in next_edges):
                warnings.append({"code": "duplicate_edge_skipped", "source": source, "target": target})
                continue
            edge = create_workflow_edge_instance(
                source,
                target,
                edge_id=op.get("edge_id") if isinstance(op.get("edge_id"), str) and op.get("edge_id") else None,
                data_patch=op.get("data") if isinstance(op.get("data"), dict) else {},
                existing_edges=next_edges,
                nodes=next_nodes,
            )
            next_edges.append(edge)
            if isinstance(client_id, str) and client_id:
                id_map[client_id] = edge["id"]

        elif op_name == "update_edge_data":
            edge_id = _resolve_ref(op.get("edge_id"), id_map)
            patch = op.get("data") if isinstance(op.get("data"), dict) else {}
            updated = False
            for edge in next_edges:
                if edge.get("id") == edge_id:
                    edge["data"] = _merge_dict(edge.get("data") if isinstance(edge.get("data"), dict) else {}, patch)
                    updated = True
                    break
            if not updated:
                raise CanvasPatchError(f"Edge not found: {edge_id}", code="edge_not_found")

        elif op_name == "delete_edge":
            if op.get("confirm_delete") is not True:
                raise CanvasPatchError("delete_edge requires confirm_delete=true", code="delete_confirmation_required")
            edge_id = op.get("edge_id")
            source = op.get("source") or op.get("source_id")
            target = op.get("target") or op.get("target_id")
            before = len(next_edges)
            if isinstance(edge_id, str) and edge_id:
                resolved_edge_id = _resolve_ref(edge_id, id_map)
                next_edges = [edge for edge in next_edges if edge.get("id") != resolved_edge_id]
            elif isinstance(source, str) and isinstance(target, str):
                resolved_source = _resolve_ref(source, id_map)
                resolved_target = _resolve_ref(target, id_map)
                next_edges = [
                    edge for edge in next_edges
                    if not (edge.get("source") == resolved_source and edge.get("target") == resolved_target)
                ]
            else:
                raise CanvasPatchError("delete_edge needs edge_id or source/target", code="missing_edge_ref")
            if len(next_edges) == before:
                raise CanvasPatchError("Edge not found", code="edge_not_found")

        else:
            raise CanvasPatchError(f"Unknown canvas operation: {op_name}", code="unknown_operation")

    validation = validate_canvas(next_nodes, next_edges)
    errors = [issue for issue in validation if issue.get("severity") == "error"]
    if errors:
        raise CanvasPatchError("Canvas validation failed", code="canvas_validation_failed", detail={"issues": validation})
    warnings.extend(issue for issue in validation if issue.get("severity") == "warning")
    return next_nodes, next_edges, id_map, warnings


def validate_canvas(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return validation issues for a workflow canvas."""
    issues: list[dict[str, Any]] = []
    known_types = _known_node_types()
    node_ids: list[str] = []
    seen_nodes: set[str] = set()
    runnable_ids: set[str] = set()

    for node in nodes or []:
        node_id = str(node.get("id") or "")
        node_data = node.get("data") if isinstance(node.get("data"), dict) else {}
        node_type = _canonical_node_type(str(node.get("type") or node_data.get("type") or ""))
        if not node_id:
            issues.append({"severity": "error", "code": "missing_node_id", "message": "Node is missing id"})
            continue
        if node_id in seen_nodes:
            issues.append({"severity": "error", "code": "duplicate_node_id", "node_id": node_id, "message": "Duplicate node ID"})
        seen_nodes.add(node_id)
        node_ids.append(node_id)
        if node_type not in known_types and node_type not in _COMPAT_NON_MANIFEST_TYPES:
            issues.append({"severity": "error", "code": "unknown_node_type", "node_id": node_id, "node_type": node_type})
        if node_type not in {"loop_group"} | _VISUAL_ONLY_TYPES:
            runnable_ids.add(node_id)
        config = node_data.get("config")
        if node_type != "loop_group" and config is not None and not isinstance(config, dict):
            issues.append({"severity": "error", "code": "invalid_config", "node_id": node_id, "message": "data.config must be an object"})

    node_id_set = set(node_ids)
    seen_edges: set[tuple[str, str]] = set()
    outgoing: dict[str, list[str]] = defaultdict(list)
    incoming_count: dict[str, int] = defaultdict(int)

    for edge in edges or []:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        if not source or not target:
            issues.append({"severity": "error", "code": "missing_edge_endpoint", "edge_id": edge.get("id")})
            continue
        if source not in node_id_set or target not in node_id_set:
            issues.append({"severity": "error", "code": "edge_endpoint_missing", "edge_id": edge.get("id"), "source": source, "target": target})
        if source == target:
            issues.append({"severity": "error", "code": "self_edge", "edge_id": edge.get("id"), "node_id": source})
        pair = (source, target)
        if pair in seen_edges:
            issues.append({"severity": "warning", "code": "duplicate_edge", "source": source, "target": target})
        seen_edges.add(pair)
        outgoing[source].append(target)
        incoming_count[target] += 1

    cycle_nodes = _detect_cycle_nodes(node_id_set, outgoing)
    if cycle_nodes:
        issues.append({"severity": "error", "code": "cycle_detected", "node_ids": sorted(cycle_nodes), "message": "Workflow contains a cycle"})

    has_trigger = any(
        _canonical_node_type(str((node.get("type") or (node.get("data") or {}).get("type"))))
        == "trigger_input"
        for node in nodes or []
    )
    if runnable_ids and not has_trigger:
        issues.append({"severity": "warning", "code": "missing_trigger_input", "message": "Workflow has no trigger_input node"})

    for node_id in sorted(runnable_ids):
        if incoming_count.get(node_id, 0) == 0:
            node = next((item for item in nodes if item.get("id") == node_id), {})
            node_type = _canonical_node_type(str(node.get("type") or ""))
            if node_type != "trigger_input":
                issues.append({"severity": "warning", "code": "orphan_executable_node", "node_id": node_id, "message": "Executable node has no upstream input"})

    return issues


def _detect_cycle_nodes(node_ids: set[str], outgoing: dict[str, list[str]]) -> set[str]:
    indegree = {node_id: 0 for node_id in node_ids}
    for source, targets in outgoing.items():
        if source not in node_ids:
            continue
        for target in targets:
            if target in indegree:
                indegree[target] += 1
    queue = deque([node_id for node_id, degree in indegree.items() if degree == 0])
    visited: set[str] = set()
    while queue:
        node_id = queue.popleft()
        visited.add(node_id)
        for target in outgoing.get(node_id, []):
            if target not in indegree:
                continue
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
    return node_ids - visited
