"use client";

/**
 * JsonRenderer — renders formatted JSON output for analyzer/planner nodes.
 * Uses Shiki for syntax-highlighted JSON display.
 */

import React from "react";
import type { NodeRendererProps } from "../index";

export const JsonRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
    compact = false,
}) => {
    const formattedJson = (() => {
        if (!output) return "";
        try {
            const parsed = JSON.parse(output);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return output; // Return raw if not valid JSON yet (streaming)
        }
    })();

    const summaryText = (() => {
        if (!output) return "";
        try {
            const parsed = JSON.parse(output) as Record<string, unknown> | unknown[];
            if (Array.isArray(parsed)) {
                return `数组 ${parsed.length} 项`;
            }
            return Object.entries(parsed)
                .slice(0, 3)
                .map(([key, value]) => {
                    if (typeof value === 'string') return `${key}: ${value.slice(0, 20)}${value.length > 20 ? '…' : ''}`;
                    if (Array.isArray(value)) return `${key}: ${value.length}项`;
                    if (value && typeof value === 'object') return `${key}: 对象`;
                    return `${key}: ${String(value)}`;
                })
                .join(' · ');
        } catch {
            const compactText = output.replace(/\s+/g, ' ').trim();
            return compactText.slice(0, 120);
        }
    })();

    if (!output) {
        return (
            <div className="text-gray-400 text-sm italic">
                {isStreaming ? "分析中..." : "等待执行"}
            </div>
        );
    }

    if (compact) {
        return <div className="text-xs leading-5 text-gray-700">{summaryText}</div>;
    }

    return (
        <pre className="bg-gray-900 text-green-300 p-4 rounded-lg text-xs overflow-x-auto max-h-64 scrollbar-thin">
            <code>{formattedJson}</code>
        </pre>
    );
};
