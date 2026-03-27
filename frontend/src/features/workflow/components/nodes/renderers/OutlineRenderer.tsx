"use client";

/**
 * OutlineRenderer — renders learning outlines with collapsible sections.
 * Falls back to MarkdownRenderer for streamed content.
 */

import React from "react";
import type { NodeRendererProps } from "../index";
import NodeMarkdownOutput from "../NodeMarkdownOutput";

export const OutlineRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
    compact = false,
}) => {
    if (!output) {
        return (
            <div className="text-gray-400 text-sm italic">
                {isStreaming ? "大纲生成中..." : "等待执行"}
            </div>
        );
    }

    if (compact) {
        const topLines = output
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 3);
        return <div className="text-xs leading-5 text-gray-700">{topLines.join(' / ')}{output.split('\n').filter(Boolean).length > 3 ? '…' : ''}</div>;
    }

    // The outline is Markdown with headers, so we can use the same
    // NodeMarkdownOutput. In the future, this can be enhanced with
    // collapsible tree UI once the format is finalized.
    return (
        <div className="outline-renderer">
            <NodeMarkdownOutput content={output} />
        </div>
    );
};
