'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { getNodeTypeMeta } from '@/features/workflow/constants/workflow-meta';
import {
  type NodeConfigAnchorRect,
  resolveNodeConfigPopoverPosition,
} from './popover-position';
import { NodeConfigFormContent } from './NodeConfigFormContent';

interface NodeConfigDrawerProps {
  nodeId: string | null;
  anchorRect: NodeConfigAnchorRect | null;
  onClose: () => void;
}

export default function NodeConfigDrawer({ nodeId, anchorRect, onClose }: NodeConfigDrawerProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const node = useMemo(() => nodes.find((item) => item.id === nodeId) ?? null, [nodeId, nodes]);
  const nodeType = String((node?.data as { type?: string } | undefined)?.type ?? node?.type ?? '');
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!nodeId || !anchorRect) {
      return;
    }

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      setPopoverPosition(resolveNodeConfigPopoverPosition(
        anchorRect,
        { width: window.innerWidth, height: window.innerHeight },
        { width: rect?.width ?? 380, height: rect?.height ?? 560 },
      ));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [anchorRect, nodeId]);

  useEffect(() => {
    if (!nodeId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [nodeId, onClose]);

  if (!nodeId || !node) {
    return null;
  }

  const meta = getNodeTypeMeta(nodeType);

  return (
    <div
      ref={containerRef}
      className="fixed z-[70] w-[380px] max-w-[calc(100vw-24px)] max-h-[min(70vh,calc(100vh-24px))] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl"
      style={{
        top: popoverPosition?.top ?? 24,
        left: popoverPosition?.left ?? 24,
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              节点配置
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
              {(node.data as { label?: string }).label ?? meta.label}
            </h2>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <NodeConfigFormContent nodeId={nodeId} />
        </div>
      </div>
    </div>
  );
}
