"""Topological sorting, branch filtering, and edge helpers for workflow execution."""

from collections import defaultdict, deque

from app.engine.context import build_downstream_map, get_all_downstream  # noqa: F401 — build_downstream_map re-exported for tests

# Maximum allowed wait between nodes (safety cap)
MAX_WAIT_SECONDS = 300


def topological_sort_levels(
    nodes: list[dict], edges: list[dict]
) -> list[list[str]]:
    """Return node IDs grouped by topological levels (Kahn's algorithm).

    Each inner list contains node IDs that can be executed in parallel.
    Nodes with parentId (loop group children) are excluded.

    Raises ValueError if a cycle is detected.
    """
    top_nodes = [n for n in nodes if not n.get("parentId")]
    child_ids = {n["id"] for n in nodes if n.get("parentId")}

    in_degree: dict[str, int] = {n["id"]: 0 for n in top_nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        if src in child_ids or tgt in child_ids:
            continue
        adjacency[src].append(tgt)
        in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue: deque[str] = deque(nid for nid, deg in in_degree.items() if deg == 0)
    levels: list[list[str]] = []
    processed = 0

    while queue:
        level = list(queue)
        levels.append(level)
        queue.clear()
        for nid in level:
            processed += 1
            for neighbor in adjacency[nid]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

    if processed != len(top_nodes):
        raise ValueError("Workflow contains a cycle — cannot execute")

    return levels


def topological_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Flatten level-based sort into a single list (backward compatible)."""
    levels = topological_sort_levels(nodes, edges)
    return [nid for level in levels for nid in level]


def get_max_wait_seconds(node_id: str, edges: list[dict]) -> float:
    """Get the max waitSeconds from all incoming edges of a node."""
    max_wait = 0.0
    for edge in edges:
        if edge["target"] == node_id:
            wait = edge.get("data", {}).get("waitSeconds", 0)
            if isinstance(wait, (int, float)) and wait > 0:
                max_wait = max(max_wait, float(wait))
    return min(max_wait, MAX_WAIT_SECONDS)


def get_branch_filtered_downstream(
    switch_node_id: str,
    chosen_branch: str,
    edges: list[dict],
    downstream_map: dict[str, set[str]],
) -> set[str]:
    """Return node IDs that should be SKIPPED because they're on non-chosen branches."""
    active_targets: set[str] = set()
    inactive_targets: set[str] = set()

    for edge in edges:
        if edge["source"] != switch_node_id:
            continue
        target = edge["target"]
        edge_branch = edge.get("data", {}).get("branch", "")
        if not edge_branch:
            active_targets.add(target)
        elif edge_branch.lower() == chosen_branch.lower():
            active_targets.add(target)
        else:
            inactive_targets.add(target)

    skip_nodes: set[str] = set()
    for inactive in inactive_targets:
        if inactive not in active_targets:
            skip_nodes.add(inactive)
            skip_nodes.update(get_all_downstream(inactive, downstream_map))

    for active in active_targets:
        skip_nodes.discard(active)
        for downstream in get_all_downstream(active, downstream_map):
            skip_nodes.discard(downstream)

    return skip_nodes
