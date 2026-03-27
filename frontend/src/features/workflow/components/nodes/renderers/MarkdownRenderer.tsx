"use client";

/**
 * MarkdownRenderer — default renderer for most LLM nodes.
 * Uses NodeMarkdownOutput for rich markdown display.
 */

import React from "react";
import type { NodeRendererProps } from "../index";
import NodeMarkdownOutput from "../NodeMarkdownOutput";

export const MarkdownRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
    compact = false,
}) => {
    if (!output) {
        return (
            <div className="text-gray-400 text-sm italic">
                {isStreaming ? "生成中..." : "等待执行"}
            </div>
        );
    }

    if (compact) {
        const trimmed = output.replace(/\s+/g, ' ').trim();
        return <div className="text-xs leading-5 text-gray-700">{trimmed.slice(0, 200)}{trimmed.length > 200 ? '…' : ''}</div>;
    }

    return <NodeMarkdownOutput content={output} />;
};
