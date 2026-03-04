"use client";

/**
 * CompareRenderer — renders multi-concept comparison as a beautiful table.
 * Parses JSON output from the compare node into an interactive comparison view.
 *
 * Expected JSON structure:
 * {
 *   "concepts": ["概念A", "概念B"],
 *   "dimensions": [{ "dimension": "维度", "values": ["...", "..."] }],
 *   "summary": "总结"
 * }
 */

import React, { useMemo } from "react";
import type { NodeRendererProps } from "../index";

interface CompareData {
    concepts: string[];
    dimensions: { dimension: string; values: string[] }[];
    summary?: string;
}

export const CompareRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
}) => {
    const data: CompareData | null = useMemo(() => {
        if (!output) return null;
        try {
            const parsed = JSON.parse(output);
            if (parsed.concepts && parsed.dimensions) return parsed;
            return null;
        } catch {
            return null;
        }
    }, [output]);

    if (isStreaming && !data) {
        return <div className="text-gray-400 text-sm italic">对比分析生成中...</div>;
    }

    if (!data) {
        return <div className="text-gray-400 text-sm italic">等待执行</div>;
    }

    // Color palette for concept columns
    const conceptColors = [
        { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.3)", text: "#2563eb" },
        { bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.3)", text: "#059669" },
        { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.3)", text: "#d97706" },
        { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.3)", text: "#dc2626" },
    ];

    return (
        <div className="space-y-3">
            {/* Header: concept count */}
            <div className="text-xs text-gray-500">
                ⚖️ {data.concepts.length} 个概念 · {data.dimensions.length} 个维度对比
            </div>

            {/* Comparison Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 bg-gray-50 border-b border-r border-gray-200 min-w-[100px]">
                                维度
                            </th>
                            {data.concepts.map((concept, i) => {
                                const color = conceptColors[i % conceptColors.length];
                                return (
                                    <th
                                        key={i}
                                        className="px-3 py-2 text-center text-xs font-bold border-b border-gray-200"
                                        style={{
                                            backgroundColor: color.bg,
                                            color: color.text,
                                            minWidth: "140px",
                                        }}
                                    >
                                        {concept}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {data.dimensions.map((dim, rowIdx) => (
                            <tr
                                key={rowIdx}
                                className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                            >
                                <td className="px-3 py-2 text-xs font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">
                                    {dim.dimension}
                                </td>
                                {dim.values.map((val, colIdx) => (
                                    <td
                                        key={colIdx}
                                        className="px-3 py-2 text-xs text-gray-600 border-gray-100"
                                        style={{ borderLeft: colIdx > 0 ? "1px solid #e5e7eb" : undefined }}
                                    >
                                        {val}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            {data.summary && (
                <div
                    className="rounded-lg p-3 text-xs text-gray-700"
                    style={{
                        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                        borderLeft: "3px solid #6366f1",
                    }}
                >
                    <span className="font-semibold text-gray-800">💡 核心差异：</span>
                    {data.summary}
                </div>
            )}
        </div>
    );
};
