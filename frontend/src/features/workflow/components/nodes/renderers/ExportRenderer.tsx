"use client";

/**
 * ExportRenderer — displays file export results with download link + copy support.
 *
 * Parses the export node's markdown output to extract file info
 * and displays it as a card with download / copy buttons.
 */

import React, { useMemo, useState } from "react";
import type { NodeRendererProps } from "../index";

interface ExportInfo {
    filename: string;
    format: string;
    size: string;
    path: string;
    downloadUrl?: string;
    copyContent?: string;
    error?: string;
}

function parseExportOutput(output: string): ExportInfo | null {
    if (!output) return null;

    const info: ExportInfo = {
        filename: "",
        format: "",
        size: "",
        path: "",
    };

    // Extract fields from markdown
    const filenameMatch = output.match(/\*\*文件名\*\*:\s*(.+)/);
    const formatMatch = output.match(/\*\*格式\*\*:\s*(.+)/);
    const sizeMatch = output.match(/\*\*大小\*\*:\s*(.+)/);
    const pathMatch = output.match(/\*\*路径\*\*:\s*`(.+)`/);
    const errorMatch = output.match(/⚠️\s*(.+)/);
    const urlMatch = output.match(/\[📥 点击下载\]\((.+)\)/);

    // Extract copy content (between special markers)
    const copyMatch = output.match(/<!-- COPY_CONTENT_START -->\n([\s\S]*?)\n<!-- COPY_CONTENT_END -->/);
    if (copyMatch) {
        info.copyContent = copyMatch[1];
        info.format = "COPY";
    }

    if (filenameMatch) info.filename = filenameMatch[1].trim();
    if (formatMatch) info.format = formatMatch[1].trim();
    if (sizeMatch) info.size = sizeMatch[1].trim();
    if (pathMatch) info.path = pathMatch[1].trim();
    if (errorMatch) info.error = errorMatch[1].trim();
    if (urlMatch) info.downloadUrl = urlMatch[1].trim();

    // If we couldn't parse anything meaningful, return null
    if (!info.filename && !info.error && !info.copyContent) return null;

    return info;
}

const FORMAT_ICONS: Record<string, string> = {
    PDF: "📄",
    DOCX: "📝",
    MD: "📋",
    TXT: "📃",
    COPY: "📋",
};

const FORMAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    PDF: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
    DOCX: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
    MD: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
    TXT: { bg: "#fefce8", text: "#ca8a04", border: "#fef08a" },
    COPY: { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" },
};

export default function ExportRenderer({ output, isStreaming, compact = false }: NodeRendererProps) {
    const exportInfo = useMemo(() => parseExportOutput(output), [output]);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!exportInfo?.copyContent) return;
        try {
            await navigator.clipboard.writeText(exportInfo.copyContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for non-HTTPS contexts
            const textarea = document.createElement("textarea");
            textarea.value = exportInfo.copyContent;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // While streaming, show raw output
    if (isStreaming) {
        return (
            <div className="px-4 py-3 text-sm text-gray-500 animate-pulse">
                {output || "📥 准备导出..."}
            </div>
        );
    }

    // If we couldn't parse, show raw markdown
    if (!exportInfo) {
        return (
            <div className="px-4 py-3 text-sm whitespace-pre-wrap text-gray-700">
                {output}
            </div>
        );
    }

    if (compact) {
        return (
            <div className="text-xs text-gray-600">
                {exportInfo.error
                    ? `导出失败: ${exportInfo.error}`
                    : exportInfo.copyContent
                        ? '内容已就绪'
                        : exportInfo.filename
                            ? `文件已生成: ${exportInfo.filename}`
                            : '文件已生成'}
            </div>
        );
    }

    const formatKey = exportInfo.format.toUpperCase();
    const colors = FORMAT_COLORS[formatKey] || FORMAT_COLORS.MD;
    const icon = FORMAT_ICONS[formatKey] || "📄";

    // ── Copy mode card ──
    if (exportInfo.copyContent) {
        return (
            <div className="px-4 py-3">
                <div
                    className="rounded-xl border p-4 transition-all duration-200 hover:shadow-md"
                    style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">📋</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800">内容已就绪</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                共 {exportInfo.copyContent.length} 字
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCopy}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200"
                        style={{
                            backgroundColor: copied ? "#16a34a" : colors.text,
                        }}
                    >
                        {copied ? "✅ 已复制" : "📋 复制到剪贴板"}
                    </button>
                </div>
            </div>
        );
    }

    // ── File download card ──
    return (
        <div className="px-4 py-3">
            <div
                className="rounded-xl border p-4 transition-all duration-200 hover:shadow-md"
                style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                }}
            >
                {/* Header */}
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                            {exportInfo.filename || "导出文件"}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span
                                className="px-1.5 py-0.5 rounded font-medium"
                                style={{
                                    backgroundColor: colors.border,
                                    color: colors.text,
                                }}
                            >
                                {formatKey}
                            </span>
                            {exportInfo.size && <span>{exportInfo.size}</span>}
                        </div>
                    </div>
                </div>

                {/* Error */}
                {exportInfo.error && (
                    <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                        ⚠️ {exportInfo.error}
                    </p>
                )}

                {/* Download button */}
                {exportInfo.downloadUrl ? (
                    <a
                        href={exportInfo.downloadUrl}
                        download
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: colors.text }}
                    >
                        📥 下载文件
                    </a>
                ) : exportInfo.filename ? (
                    <p className="mt-3 text-xs text-gray-400">
                        ✅ 文件已生成到服务器
                    </p>
                ) : null}
            </div>
        </div>
    );
}
