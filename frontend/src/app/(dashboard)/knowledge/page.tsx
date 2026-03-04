"use client";

/**
 * Knowledge Base Management Page
 *
 * Features:
 * - Document list with status indicators
 * - Drag & drop file upload
 * - Document details panel
 * - Delete confirmation
 */

import React, { useState, useEffect, useCallback } from "react";

interface KBDocument {
    id: string;
    filename: string;
    file_type: string;
    file_size_bytes: number;
    status: string;
    total_chunks: number;
    total_tokens: number;
    created_at: string;
    error_message?: string;
}

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "等待处理", color: "#d97706", bg: "#fef3c7" },
    processing: { label: "处理中...", color: "#2563eb", bg: "#dbeafe" },
    ready: { label: "已就绪", color: "#059669", bg: "#d1fae5" },
    error: { label: "处理失败", color: "#dc2626", bg: "#fee2e2" },
};

const FILE_TYPE_ICONS: Record<string, string> = {
    pdf: "📄",
    docx: "📝",
    md: "📋",
    txt: "📃",
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function KnowledgePage() {
    const [documents, setDocuments] = useState<KBDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Fetch documents
    const fetchDocuments = useCallback(async () => {
        try {
            const res = await fetch("/api/knowledge", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setDocuments(data);
            }
        } catch (err) {
            console.error("Failed to fetch documents:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Upload file
    const uploadFile = useCallback(async (file: File) => {
        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/knowledge/upload", {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "上传失败");
            }

            await fetchDocuments();
        } catch (err: any) {
            setError(err.message || "上传失败");
        } finally {
            setUploading(false);
        }
    }, [fetchDocuments]);

    // Handle drag and drop
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadFile(files[0]);
            }
        },
        [uploadFile]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                uploadFile(files[0]);
            }
        },
        [uploadFile]
    );

    // Delete document
    const handleDelete = useCallback(async (docId: string) => {
        try {
            const res = await fetch(`/api/knowledge/${docId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                setDocuments((prev) => prev.filter((d) => d.id !== docId));
            }
        } catch (err) {
            console.error("Delete failed:", err);
        }
        setDeleteConfirm(null);
    }, []);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">📚 知识库</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        上传学习材料，在工作流中使用知识库节点检索相关内容
                    </p>
                </div>
                <div className="text-sm text-gray-400">
                    {documents.length} 个文档
                </div>
            </div>

            {/* Upload area */}
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${dragOver
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
                    }`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                {uploading ? (
                    <div className="space-y-2">
                        <div className="text-2xl animate-pulse">⏳</div>
                        <p className="text-sm text-gray-600">正在上传和处理文档...</p>
                        <p className="text-xs text-gray-400">这可能需要几分钟</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-3xl">📂</div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">
                                拖拽文件到这里，或{" "}
                                <label className="text-indigo-600 hover:text-indigo-700 cursor-pointer underline">
                                    点击上传
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.docx,.md,.txt"
                                        onChange={handleFileInput}
                                    />
                                </label>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                支持 PDF、DOCX、Markdown、TXT 格式，最大 10MB
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 flex items-center gap-2">
                    <span>❌</span>
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto text-red-400 hover:text-red-600"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Document list */}
            {loading ? (
                <div className="text-center py-12 text-gray-400">加载中...</div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-gray-500">知识库还是空的</p>
                    <p className="text-sm text-gray-400 mt-1">
                        上传你的学习资料，在工作流中通过知识库节点使用
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {documents.map((doc) => {
                        const statusBadge = STATUS_BADGES[doc.status] || STATUS_BADGES.pending;
                        const icon = FILE_TYPE_ICONS[doc.file_type] || "📄";

                        return (
                            <div
                                key={doc.id}
                                className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-all duration-200"
                            >
                                {/* File icon */}
                                <div className="text-2xl flex-shrink-0">{icon}</div>

                                {/* File info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-800 truncate">
                                            {doc.filename}
                                        </span>
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                                            style={{
                                                backgroundColor: statusBadge.bg,
                                                color: statusBadge.color,
                                            }}
                                        >
                                            {statusBadge.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                        <span>{formatFileSize(doc.file_size_bytes)}</span>
                                        {doc.total_chunks > 0 && (
                                            <span>{doc.total_chunks} 个分块</span>
                                        )}
                                        {doc.total_tokens > 0 && (
                                            <span>{doc.total_tokens.toLocaleString()} tokens</span>
                                        )}
                                        <span>{formatDate(doc.created_at)}</span>
                                    </div>
                                    {doc.error_message && (
                                        <p className="text-xs text-red-500 mt-1 truncate">
                                            ⚠️ {doc.error_message}
                                        </p>
                                    )}
                                </div>

                                {/* Delete button */}
                                {deleteConfirm === doc.id ? (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                        >
                                            确认删除
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(null)}
                                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                            取消
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeleteConfirm(doc.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all duration-200 flex-shrink-0"
                                        title="删除文档"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
