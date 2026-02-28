'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import type { AIStepNodeData } from '@/types';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import NodeMarkdownOutput from './nodes/NodeMarkdownOutput';

/* ── Status badge config ──────────────────────────────── */

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: '待执行', className: 'bg-gray-500/20 text-gray-300' },
  running: { label: '执行中', className: 'bg-blue-500/20 text-blue-300' },
  done:    { label: '已完成', className: 'bg-green-500/20 text-green-300' },
  error:   { label: '错误',   className: 'bg-red-500/20 text-red-300' },
  paused:  { label: '已暂停', className: 'bg-yellow-500/20 text-yellow-300' },
};

/* ── Props ────────────────────────────────────────────── */

interface BottomDrawerProps {
  open: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeData: AIStepNodeData | null;
}

/* ── Swipe-down threshold (px) ────────────────────────── */
const SWIPE_THRESHOLD = 80;

/* ── Component ────────────────────────────────────────── */

export default function BottomDrawer({ open, onClose, nodeId, nodeData }: BottomDrawerProps) {
  const touchStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Read live node data from store for streaming updates
  const liveNode = useWorkflowStore((s) =>
    nodeId ? s.nodes.find((n) => n.id === nodeId) : null,
  );
  const liveData = (liveNode?.data as AIStepNodeData | undefined) ?? nodeData;

  const isStreaming = liveData?.status === 'running';
  const output = liveData?.output ?? '';
  const label = liveData?.label ?? '';
  const status = liveData?.status ?? 'pending';
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;

  /* ── Touch gesture handlers ─────────────────────────── */

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    // Only track downward swipes
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > SWIPE_THRESHOLD) {
      onClose();
    }
    setDragOffset(0);
    touchStartY.current = null;
  }, [dragOffset, onClose]);

  // Reset drag offset when drawer closes
  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      touchStartY.current = null;
    }
  }, [open]);

  /* ── Backdrop click ─────────────────────────────────── */

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  /* ── Render ─────────────────────────────────────────── */

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label || '节点详情'}
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          transform: open
            ? `translateY(${dragOffset}px)`
            : 'translateY(100%)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="glass-panel rounded-t-2xl max-h-[70vh] flex flex-col overflow-hidden border-t border-white/[0.08]">
          {/* Drag handle */}
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header: title + status badge */}
          <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
            <h3 className="text-sm font-semibold text-foreground truncate flex-1">
              {label || '未命名节点'}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {/* Content: NodeMarkdownOutput */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
            {output ? (
              <NodeMarkdownOutput content={output} streaming={isStreaming} />
            ) : (
              <p className="text-sm text-muted-foreground">暂无输出内容</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
