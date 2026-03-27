"use client";

/**
 * PassthroughRenderer — for non-LLM nodes (trigger_input, write_db).
 * Shows only a compact status indicator, no content area.
 */

import React from "react";
import type { NodeRendererProps } from "../index";

export const PassthroughRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
    compact = false,
}) => {
    if (isStreaming) {
        return (
            <div className="flex items-center gap-2 text-blue-500 text-sm">
                <span className="animate-spin">⏳</span>
                <span>处理中...</span>
            </div>
        );
    }

    if (output) {
        return (
            <div className="flex items-center gap-2 text-green-600 text-sm">
                <span>✅</span>
                <span>{compact ? '已处理' : '已完成'}</span>
            </div>
        );
    }

    return (
        <div className="text-gray-400 text-sm italic">等待触发</div>
    );
};
