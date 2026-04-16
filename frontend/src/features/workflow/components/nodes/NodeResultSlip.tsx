import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2, Clock3 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NodeStatus } from '@/types';
import { resolveRenderer } from './index';
import { NodeResultSlipBody } from './NodeResultSlipBody';
import NodeContextMenu, { buildSlipMenuGroups } from '../canvas/NodeContextMenu';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { eventBus } from '@/lib/events/event-bus';
import { findNodeManifestItem, useNodeManifest } from '@/features/workflow/hooks/use-node-manifest';
import { buildExecutionNodeNameMap } from '@/features/workflow/utils/execution-node-copy';

interface NodeResultSlipProps {
  nodeId: string;
  status: NodeStatus;
  output: string;
  error?: string;
  inputSnapshot?: string;
  nodeType: string;
  outputFormat?: string;
  executionTimeMs?: number;
  isSelected?: boolean;
  onFocusSlip?: () => void;
}

// Parse and format the raw JSON input snapshot into readable sections
function parseInputSnapshot(raw: string | undefined): {
  userContent?: string;
  upstreamOutputs?: Record<string, string>;
  nodeConfig?: unknown;
  rawText?: string;
} | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      userContent: parsed.user_content,
      upstreamOutputs: parsed.upstream_outputs,
      nodeConfig: parsed.node_config,
    };
  } catch {
    return { rawText: raw };
  }
}

export const NodeResultSlip: React.FC<NodeResultSlipProps> = ({
  nodeId,
  status,
  output,
  error,
  inputSnapshot,
  nodeType,
  outputFormat = 'markdown',
  executionTimeMs,
  isSelected,
  onFocusSlip,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [slipMenuPos, setSlipMenuPos] = useState<{ x: number; y: number } | null>(null);
  const slipRef = useRef<HTMLDivElement>(null);
  const wasRunningRef = useRef(false);
  const { manifest } = useNodeManifest();
  const parsedInput = useMemo(() => parseInputSnapshot(inputSnapshot), [inputSnapshot]);
  const nodes = useWorkflowStore((state) => state.nodes);
  const manifestByType = useMemo(
    () => Object.fromEntries(manifest.map((item) => [item.type, item])),
    [manifest],
  );
  const manifestItem = useMemo(
    () => findNodeManifestItem(manifest, nodeType),
    [manifest, nodeType],
  );
  const nodeNameMap = useMemo(
    () => buildExecutionNodeNameMap(nodes, manifestByType),
    [nodes, manifestByType],
  );

  useEffect(() => {
    if (status === 'running') {
      wasRunningRef.current = true;
      queueMicrotask(() => setIsExpanded(true));
      return;
    }
    if (status === 'done' && wasRunningRef.current) {
      queueMicrotask(() => setIsExpanded(true));
    }
  }, [status]);

  // Listen for global expand/collapse-all events (used by Memory View)
  const [allSlipsExpanded, setAllSlipsExpanded] = useState(false);
  const applyExpandedState = useCallback((expanded: boolean) => {
    setAllSlipsExpanded(expanded);
    setIsExpanded(expanded);
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.on('workflow:toggle-all-slips', ({ expanded }) => {
      applyExpandedState(expanded);
    });
    return () => {
      unsubscribe();
    };
  }, [applyExpandedState]);

  const handleToggleAllSlipsExpand = useCallback(() => {
    setAllSlipsExpanded((previous) => {
      const next = !previous;
      eventBus.emit('workflow:toggle-all-slips', { expanded: next });
      return next;
    });
  }, []);

  // Native capture-phase right-click: beats ReactFlow's node wrapper handler
  const captureContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    onFocusSlip?.();
    setSlipMenuPos({ x: e.clientX, y: e.clientY });
  }, [onFocusSlip]);

  useEffect(() => {
    const el = slipRef.current;
    if (!el) return;
    el.addEventListener('contextmenu', captureContextMenu, true); // capture phase
    return () => el.removeEventListener('contextmenu', captureContextMenu, true);
  }, [captureContextMenu]);

  const shadowClass = isSelected ? 'ring-2 ring-primary/40 shadow-xl shadow-primary/10' : '';
  const renderSlipContextMenu = () => (
    slipMenuPos && typeof document !== 'undefined' && createPortal(
      <NodeContextMenu
        x={slipMenuPos.x}
        y={slipMenuPos.y}
        onClose={() => setSlipMenuPos(null)}
        groups={buildSlipMenuGroups({
          isExpanded,
          onExpandToggle: () => setIsExpanded(!isExpanded),
          onHideSlip: () => {
            const nodes = useWorkflowStore.getState().nodes;
            const node = nodes.find((n) => n.id === nodeId);
            const hideSlip = (node?.data as Record<string, unknown>)?.hideSlip || false;
            useWorkflowStore.getState().updateNodeData(nodeId, { hideSlip: !hideSlip });
          },
          onHideGlobalSlips: () => useWorkflowStore.getState().toggleGlobalNodeSlips(),
          isGlobalSlipsHidden: !useWorkflowStore.getState().showAllNodeSlips,
          allSlipsExpanded,
          onToggleAllSlipsExpand: handleToggleAllSlipsExpand,
        })}
      />,
      document.body,
    )
  );

  // ── Pending: show a silent "idle" tab — never return null ──────────────────
  if (!status || status === 'pending') {
    return (
      <>
        <div 
          ref={slipRef}
          className={`node-result-slip mt-4 w-full bg-stone-50/40 dark:bg-stone-900/40 border border-dashed border-stone-200/60 dark:border-stone-800/60 rounded-md shadow-sm backdrop-blur-sm ${shadowClass}`}
          onPointerDownCapture={(e) => {
            e.stopPropagation();
            onFocusSlip?.();
          }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 pointer-events-none select-none">
            <Clock3 className="w-3 h-3 text-black/30 dark:text-white/30" />
            <span className="font-mono text-[10px] text-black/40 dark:text-white/40 tracking-wider">
              等待执行
            </span>
          </div>
        </div>
        {renderSlipContextMenu()}
      </>
    );
  }

  const Renderer = resolveRenderer({
    nodeType,
    rendererName: manifestItem?.renderer,
  });
  const timeStr = executionTimeMs ? `${(executionTimeMs / 1000).toFixed(1)}s` : '';

  let StatusIcon = Loader2;
  let statusText = '执行中...';
  let iconClass = 'animate-spin text-sky-500';

  if (status === 'done') {
    StatusIcon = CheckCircle2;
    statusText = `运行成功  ${timeStr}`;
    iconClass = 'text-emerald-500';
  } else if (status === 'error') {
    StatusIcon = AlertCircle;
    statusText = '执行失败';
    iconClass = 'text-rose-500';
  } else if (status === 'waiting') {
    StatusIcon = Loader2;
    statusText = '等待中...';
    iconClass = 'text-amber-500 opacity-70';
  } else if (status === 'skipped') {
    StatusIcon = CheckCircle2;
    statusText = '已跳过';
    iconClass = 'text-stone-400';
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  return (
    <div 
      ref={slipRef}
      className={`node-result-slip mt-4 w-full rounded-md overflow-hidden bg-white/80 dark:bg-black/50 backdrop-blur-md shadow-sm border border-black/10 dark:border-white/10 relative z-50 transition-colors ${shadowClass}`}
      onPointerDownCapture={(e) => {
        e.stopPropagation();
        onFocusSlip?.();
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-3.5 h-3.5 ${iconClass}`} />
          <span className="font-mono text-[11px] text-black/60 dark:text-white/60">
            {statusText}
          </span>
        </div>
        <div className="text-black/40 dark:text-white/40">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden bg-white/50 dark:bg-black/20"
          >
            <NodeResultSlipBody
              parsedInput={parsedInput}
              nodeNameMap={nodeNameMap}
              output={output}
              error={error}
              status={status}
              outputFormat={outputFormat}
              nodeType={nodeType}
              Renderer={Renderer}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {renderSlipContextMenu()}
    </div>
  );
};
