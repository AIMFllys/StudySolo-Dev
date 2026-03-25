'use client';

import type { WorkflowMeta } from '@/types/workflow';

interface WorkflowContextMenuState {
  x: number;
  y: number;
  workflowId: string;
}

interface SidebarContextMenuProps {
  contextMenu: WorkflowContextMenuState;
  processingWorkflowId: string | null;
  workflow?: WorkflowMeta;
  onClose: () => void;
  onRename: (workflowId: string) => void;
  onDelete: (workflowId: string) => void;
  onToggleFavorite?: (workflowId: string) => void;
  onTogglePublish?: (workflowId: string) => void;
  onEditDescription?: (workflowId: string) => void;
  onEditTags?: (workflowId: string) => void;
}

export function SidebarContextMenu({
  contextMenu,
  processingWorkflowId,
  workflow,
  onClose,
  onRename,
  onDelete,
  onToggleFavorite,
  onTogglePublish,
  onEditDescription,
  onEditTags,
}: SidebarContextMenuProps) {
  const isProcessing = processingWorkflowId === contextMenu.workflowId;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-36 overflow-hidden shadow-lg border border-border bg-card rounded-xl py-1.5 text-sm transition-all"
        style={{ top: contextMenu.y, left: contextMenu.x }}
      >
        <button
          className="w-full flex items-center justify-start px-4 py-1.5 text-left font-medium transition-colors hover:bg-muted/60 text-foreground disabled:opacity-40"
          onClick={() => { if (onToggleFavorite) onToggleFavorite(contextMenu.workflowId); onClose(); }}
        >
          <span className="w-5">{workflow?.is_favorited ? '★' : '☆'}</span> 
          {workflow?.is_favorited ? '取消收藏' : '收藏'}
        </button>
        <button
          className="w-full flex items-center justify-start px-4 py-1.5 text-left font-medium transition-colors hover:bg-muted/60 text-foreground disabled:opacity-40"
          onClick={() => { if (onTogglePublish) onTogglePublish(contextMenu.workflowId); onClose(); }}
        >
          <span className="w-5">✓</span> 
          {workflow?.is_public ? '取消公开' : '发布'}
        </button>
        <div className="my-1 h-px bg-border mx-2" />
        <button
          className="w-full flex items-center justify-start px-4 py-1.5 text-left font-medium transition-colors hover:bg-muted/60 text-foreground disabled:opacity-40"
          onClick={() => onRename(contextMenu.workflowId)}
          disabled={isProcessing}
        >
          <span className="w-5">✎</span> 重命名
        </button>
        {onEditDescription && (
          <button
            className="w-full flex items-center justify-start px-4 py-1.5 text-left font-medium transition-colors hover:bg-muted/60 text-foreground disabled:opacity-40"
            onClick={() => { onEditDescription(contextMenu.workflowId); onClose(); }}
            disabled={isProcessing}
          >
            <span className="w-5">☰</span> 编辑描述
          </button>
        )}
        {onEditTags && (
          <button
            className="w-full flex items-center justify-start px-4 py-1.5 text-left font-medium transition-colors hover:bg-muted/60 text-foreground disabled:opacity-40"
            onClick={() => { onEditTags(contextMenu.workflowId); onClose(); }}
            disabled={isProcessing}
          >
            <span className="w-5">#</span> 编辑标签
          </button>
        )}
        <button
          className="w-full flex items-center justify-start px-4 py-1.5 text-left font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 disabled:opacity-40"
          onClick={() => onDelete(contextMenu.workflowId)}
          disabled={isProcessing}
        >
          <span className="w-5">✕</span> {isProcessing ? '处理中...' : '删除'}
        </button>
      </div>
    </>
  );
}
