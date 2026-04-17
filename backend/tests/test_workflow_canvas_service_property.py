import pytest

from app.services.workflow_canvas_service import (
    CanvasPatchError,
    apply_canvas_patch,
    create_workflow_edge_instance,
    create_workflow_node_instance,
    validate_canvas,
)

ZH_SUMMARY = "\u4e2d\u6587\u603b\u7ed3"
ZH_INPUT = "\u4e2d\u6587\u8f93\u5165"
ZH_GOAL = "\u8bf7\u5e2e\u6211\u5b66\u4e60\u673a\u5668\u5b66\u4e60\u57fa\u7840"
ZH_LOOP = "\u5faa\u73af\u5757"
ZH_BRANCH = "\u6761\u4ef6\u5206\u652f"
ZH_MATERIAL = "\u4e2d\u6587\u6750\u6599"
ZH_SUMMARY_LABEL = "\u603b\u7ed3\u5f52\u7eb3"


def test_create_workflow_node_instance_returns_real_chinese_node():
    node = create_workflow_node_instance(
        "summary",
        label=ZH_SUMMARY,
        position={"x": 460, "y": 120},
    )

    assert node["type"] == "summary"
    assert node["position"] == {"x": 460.0, "y": 120.0}
    assert node["data"] == {
        "label": ZH_SUMMARY,
        "type": "summary",
        "system_prompt": "",
        "model_route": "",
        "status": "pending",
        "output": "",
        "output_format": "markdown",
        "config": {},
    }


def test_trigger_input_preserves_chinese_user_content():
    node = create_workflow_node_instance(
        "trigger_input",
        label=ZH_INPUT,
        data_patch={"user_content": ZH_GOAL},
    )

    assert node["data"]["label"] == ZH_INPUT
    assert node["data"]["user_content"] == ZH_GOAL


def test_loop_group_uses_canvas_container_shape():
    node = create_workflow_node_instance("loop_group", label=ZH_LOOP)

    assert node["data"] == {"label": ZH_LOOP, "maxIterations": 3, "intervalSeconds": 0}
    assert node["style"] == {"width": 500, "height": 350}


def test_create_edge_fills_react_flow_defaults():
    edge = create_workflow_edge_instance("n1", "n2", edge_id="e1")

    assert edge == {
        "id": "e1",
        "source": "n1",
        "target": "n2",
        "type": "sequential",
        "animated": False,
        "sourceHandle": "source-right",
        "targetHandle": "target-left",
        "data": {},
    }


def test_logic_switch_edges_get_branch_labels():
    switch = create_workflow_node_instance("logic_switch", node_id="switch", label=ZH_BRANCH)
    a = create_workflow_node_instance("summary", node_id="a", label="A")
    b = create_workflow_node_instance("summary", node_id="b", label="B")
    first = create_workflow_edge_instance("switch", "a", existing_edges=[], nodes=[switch, a, b])
    second = create_workflow_edge_instance("switch", "b", existing_edges=[first], nodes=[switch, a, b])

    assert first["data"]["branch"] == "A"
    assert second["data"]["branch"] == "B"


def test_apply_canvas_patch_creates_real_nodes_and_edges_with_client_refs():
    nodes, edges, id_map, warnings = apply_canvas_patch(
        [],
        [],
        [
            {
                "op": "create_node",
                "client_id": "input_1",
                "node_type": "trigger_input",
                "label": ZH_INPUT,
                "position": {"x": 120, "y": 120},
                "data": {"user_content": ZH_MATERIAL},
            },
            {
                "op": "create_node",
                "client_id": "summary_1",
                "node_type": "summary",
                "label": ZH_SUMMARY_LABEL,
                "position": {"x": 460, "y": 120},
            },
            {"op": "create_edge", "client_id": "edge_1", "source": "$input_1", "target": "$summary_1"},
        ],
    )

    assert len(nodes) == 2
    assert len(edges) == 1
    assert id_map["input_1"] == nodes[0]["id"]
    assert id_map["summary_1"] == nodes[1]["id"]
    assert id_map["edge_1"] == edges[0]["id"]
    assert nodes[0]["data"]["user_content"] == ZH_MATERIAL
    assert edges[0]["sourceHandle"] == "source-right"
    assert warnings == []



def test_apply_canvas_patch_preserves_existing_annotation_nodes():
    nodes, _edges, _id_map, warnings = apply_canvas_patch(
        [{"id": "note-1", "type": "annotation", "position": {"x": 1, "y": 2}, "data": {"label": "note"}}],
        [],
        [],
    )

    assert nodes[0]["type"] == "annotation"
    assert nodes[0]["data"]["label"] == "note"
    assert warnings == []


def test_apply_canvas_patch_accepts_legacy_input_alias_nodes():
    nodes, edges, _id_map, warnings = apply_canvas_patch(
        [
            {"id": "legacy-input", "type": "input", "position": {"x": 0, "y": 0}, "data": {"label": ZH_INPUT}},
            {"id": "summary-1", "type": "summary", "position": {"x": 320, "y": 0}, "data": {"label": ZH_SUMMARY_LABEL}},
        ],
        [{"id": "edge-1", "source": "legacy-input", "target": "summary-1"}],
        [
            {"op": "create_node", "client_id": "summary_2", "node_type": "summary", "label": ZH_SUMMARY},
            {"op": "create_edge", "source": "summary-1", "target": "$summary_2"},
        ],
    )

    assert nodes[0]["type"] == "trigger_input"
    assert nodes[0]["data"]["type"] == "trigger_input"
    assert len(nodes) == 3
    assert len(edges) == 2
    assert warnings == []

def test_delete_node_requires_confirmation():
    node = create_workflow_node_instance("summary", node_id="n1", label=ZH_SUMMARY_LABEL)

    with pytest.raises(CanvasPatchError) as exc:
        apply_canvas_patch([node], [], [{"op": "delete_node", "node_id": "n1"}])

    assert exc.value.code == "delete_confirmation_required"


def test_validate_canvas_reports_unknown_missing_self_and_cycle():
    issues = validate_canvas(
        [
            {"id": "a", "type": "unknown", "position": {"x": 0, "y": 0}, "data": {"config": []}},
            {"id": "b", "type": "summary", "position": {"x": 1, "y": 1}, "data": {"type": "summary", "config": {}}},
        ],
        [
            {"id": "self", "source": "b", "target": "b"},
            {"id": "missing", "source": "b", "target": "missing"},
        ],
    )
    codes = {issue["code"] for issue in issues}

    assert "unknown_node_type" in codes
    assert "invalid_config" in codes
    assert "self_edge" in codes
    assert "edge_endpoint_missing" in codes
    assert "cycle_detected" in codes


def test_validate_canvas_treats_legacy_input_as_trigger_input():
    issues = validate_canvas(
        [
            {"id": "legacy-input", "type": "input", "position": {"x": 0, "y": 0}, "data": {"label": ZH_INPUT}},
            {"id": "summary-1", "type": "summary", "position": {"x": 1, "y": 1}, "data": {"type": "summary", "label": ZH_SUMMARY}},
        ],
        [{"id": "edge-1", "source": "legacy-input", "target": "summary-1"}],
    )

    codes = {issue["code"] for issue in issues}
    assert "unknown_node_type" not in codes
    assert "missing_trigger_input" not in codes
