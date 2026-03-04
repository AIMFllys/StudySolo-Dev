"use client";

/**
 * MindMapRenderer — renders hierarchical mind map data as a collapsible tree.
 *
 * Phase 1: Interactive indent-based tree with expand/collapse.
 * Phase 2 (future): Full d3/react-flow visual mind map.
 *
 * Expected JSON structure:
 * {
 *   "root": "中心主题",
 *   "children": [{ "label": "分支1", "children": [...] }]
 * }
 */

import React, { useState, useMemo, useCallback } from "react";
import type { NodeRendererProps } from "../index";

interface MindMapNode {
    root?: string;
    label?: string;
    children: MindMapNode[];
}

// Color palette for depth levels
const DEPTH_COLORS = [
    { bg: "#6366f1", text: "#ffffff" },      // Level 0: Indigo (root)
    { bg: "#3b82f6", text: "#ffffff" },      // Level 1: Blue
    { bg: "#06b6d4", text: "#ffffff" },      // Level 2: Cyan
    { bg: "#10b981", text: "#ffffff" },      // Level 3: Emerald
    { bg: "#f59e0b", text: "#ffffff" },      // Level 4: Amber
];

const DEPTH_BORDER_COLORS = [
    "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b",
];

const TreeNode: React.FC<{
    node: MindMapNode;
    depth: number;
    isRoot?: boolean;
}> = ({ node, depth, isRoot = false }) => {
    const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels
    const hasChildren = node.children && node.children.length > 0;
    const label = isRoot ? node.root : node.label;
    const colorIdx = Math.min(depth, DEPTH_COLORS.length - 1);

    const toggleExpand = useCallback(() => {
        if (hasChildren) setExpanded((prev) => !prev);
    }, [hasChildren]);

    return (
        <div className="select-none">
            {/* Node row */}
            <div
                className="flex items-center gap-2 py-1 cursor-pointer rounded-md transition-all duration-200 hover:bg-gray-50"
                style={{ paddingLeft: `${depth * 20 + 4}px` }}
                onClick={toggleExpand}
            >
                {/* Expand/Collapse icon */}
                {hasChildren ? (
                    <span
                        className="text-xs flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-transform duration-200"
                        style={{
                            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                            color: DEPTH_BORDER_COLORS[colorIdx],
                        }}
                    >
                        ▶
                    </span>
                ) : (
                    <span
                        className="text-xs flex-shrink-0 w-4 h-4 flex items-center justify-center"
                        style={{ color: DEPTH_BORDER_COLORS[colorIdx] }}
                    >
                        •
                    </span>
                )}

                {/* Node badge */}
                {isRoot ? (
                    <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{
                            background: DEPTH_COLORS[0].bg,
                            color: DEPTH_COLORS[0].text,
                        }}
                    >
                        🧠 {label}
                    </span>
                ) : (
                    <span
                        className="text-sm"
                        style={{
                            color: depth <= 1 ? "#1e293b" : "#475569",
                            fontWeight: depth <= 1 ? 600 : 400,
                        }}
                    >
                        {label}
                    </span>
                )}

                {/* Children count badge */}
                {hasChildren && !expanded && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {node.children.length}
                    </span>
                )}
            </div>

            {/* Children */}
            {hasChildren && expanded && (
                <div
                    className="ml-2"
                    style={{
                        borderLeft: `2px solid ${DEPTH_BORDER_COLORS[colorIdx]}20`,
                    }}
                >
                    {node.children.map((child, i) => (
                        <TreeNode key={i} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const MindMapRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
}) => {
    const data: MindMapNode | null = useMemo(() => {
        if (!output) return null;
        try {
            const parsed = JSON.parse(output);
            if (parsed.root !== undefined) return parsed;
            return null;
        } catch {
            return null;
        }
    }, [output]);

    // Count total nodes
    const totalNodes = useMemo(() => {
        if (!data) return 0;
        function count(node: MindMapNode): number {
            let c = 1;
            if (node.children) {
                for (const child of node.children) c += count(child);
            }
            return c;
        }
        return count(data);
    }, [data]);

    if (isStreaming && !data) {
        return <div className="text-gray-400 text-sm italic">思维导图生成中...</div>;
    }

    if (!data) {
        return <div className="text-gray-400 text-sm italic">等待执行</div>;
    }

    return (
        <div className="space-y-2">
            <div className="text-xs text-gray-500">
                🧠 共 {totalNodes} 个节点 · 点击展开/收起
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <TreeNode node={data} depth={0} isRoot />
            </div>
        </div>
    );
};
