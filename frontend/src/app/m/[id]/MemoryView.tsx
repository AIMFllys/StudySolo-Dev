'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Clock, Zap, Hash,
  AlertTriangle,
  ChevronDown, ChevronUp, ChevronsUpDown, Pencil,
} from 'lucide-react';
import type { WorkflowRunDetail } from '@/types/memory';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { eventBus } from '@/lib/events/event-bus';
import { injectTracesIntoNodes, findOrphanTraces } from './inject-traces';
import {
  formatDateTime, formatDuration, computeTotalDuration, STATUS_CONFIG,
} from './memory-view-utils';
import { MemoryShareToggle } from './MemoryShareToggle';
import { OrphanTraceCard } from './OrphanTraceCard';
import { MemoryFallbackCardView } from './MemoryFallbackCardView';

const ReadOnlyCanvas = dynamic(
  () => import('@/features/workflow/components/canvas/ReadOnlyCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <div className="h-8 w-8 mx-auto mb-2 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
          <p className="text-xs">加载画布...</p>
        </div>
      </div>
    ),
  },
);

interface Props {
  run: WorkflowRunDetail;
}

export default function MemoryView({ run }: Props) {
  const router = useRouter();
  const totalDuration = computeTotalDuration(run);
  const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = statusCfg.icon;
  const doneTraces = run.traces.filter((t) => t.status === 'done');
  const errorTraces = run.traces.filter((t) => t.status === 'error');

  const hasCanvas = !!(run.nodes_json && run.nodes_json.length > 0);

  const injectedNodes = useMemo(() => {
    if (!hasCanvas) return [];
    return injectTracesIntoNodes(run.nodes_json!, run.traces);
  }, [hasCanvas, run.nodes_json, run.traces]);

  const edges = useMemo(() => run.edges_json ?? [], [run.edges_json]);

  const orphanTraces = useMemo(() => {
    if (!hasCanvas) return [];
    return findOrphanTraces(run.nodes_json!, run.traces);
  }, [hasCanvas, run.nodes_json, run.traces]);

  const [showOrphans, setShowOrphans] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  useEffect(() => {
    if (!hasCanvas) return;
    const store = useWorkflowStore.getState();
    store.setCurrentWorkflow(run.workflow_id, run.workflow_name, injectedNodes, []);
    requestAnimationFrame(() => {
      useWorkflowStore.getState().setEdges(edges);
    });
    if (!useWorkflowStore.getState().showAllNodeSlips) {
      useWorkflowStore.getState().toggleGlobalNodeSlips();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasCanvas) {
    return <MemoryFallbackCardView run={run} />;
  }

  return (
    <div className="relative w-full h-full flex flex-col pointer-events-none">
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <ReadOnlyCanvas nodes={injectedNodes} edges={edges} className="h-full w-full" />
      </div>

      <div className="absolute inset-x-0 top-16 z-10 px-6 pt-4 pointer-events-none flex justify-between items-start">
        {/* Left: Run Summary Panel */}
        <div className="pointer-events-auto max-w-sm bg-background/95 backdrop-blur-md border border-border shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-xl font-serif font-bold text-foreground truncate flex-1">{run.workflow_name}</h1>
            <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium shrink-0 ${statusCfg.className}`}>
              <StatusIcon className={`h-3 w-3 ${run.status === 'running' ? 'animate-spin' : ''}`} />
              {statusCfg.label}
            </div>
          </div>

          <div className="space-y-1.5 text-[11px] text-muted-foreground font-mono">
            <div className="flex items-center gap-2"><Clock className="h-3 w-3 shrink-0" /><span>{formatDateTime(run.started_at)}</span></div>
            {totalDuration !== null && (
              <div className="flex items-center gap-2"><Zap className="h-3 w-3 shrink-0" /><span>总耗时 {formatDuration(totalDuration)}</span></div>
            )}
            <div className="flex items-center gap-2"><Hash className="h-3 w-3 shrink-0" /><span>Token {run.tokens_used?.toLocaleString() ?? '0'}</span></div>
          </div>

          <div className="mt-3 pt-3 border-t border-dashed border-border flex items-center gap-3 text-[10px] font-serif text-muted-foreground flex-wrap">
            <span>{doneTraces.length} 完成</span>
            {errorTraces.length > 0 && <span className="text-rose-600 dark:text-rose-400">{errorTraces.length} 出错</span>}
            <span>共 {run.traces.length} 节点</span>
          </div>

          {run.input && (
            <div className="mt-3 pt-3 border-t border-dashed border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">用户输入</p>
              <p className="text-[12px] text-foreground font-serif leading-relaxed line-clamp-3">{run.input}</p>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="pointer-events-auto flex flex-col gap-2.5">
          <button
            onClick={() => router.push(`/c/${run.workflow_id}`)}
            className="flex items-center gap-2 bg-background border border-border px-3.5 py-2 text-xs font-serif font-medium rounded-lg hover:bg-muted transition-colors shadow-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            进入编辑
          </button>

          <MemoryShareToggle runId={run.id} initialShared={run.is_shared} />

          <button
            onClick={() => {
              const next = !allExpanded;
              setAllExpanded(next);
              eventBus.emit('workflow:toggle-all-slips', { expanded: next });
            }}
            className="flex items-center gap-2 bg-background border border-border px-3.5 py-2 text-xs font-serif font-medium rounded-lg hover:bg-muted transition-colors shadow-sm"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {allExpanded ? '收起详情' : '展开详情'}
          </button>
        </div>
      </div>

      {orphanTraces.length > 0 && (
        <div className="absolute bottom-6 left-1/2 z-[100] -translate-x-1/2 pointer-events-auto w-[calc(100%-2rem)] max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="relative bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl px-4 py-3">
            <button
              onClick={() => setShowOrphans((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-serif font-semibold text-foreground">
                  {orphanTraces.length} 个节点已从画布移除
                </span>
              </div>
              {showOrphans
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </button>
            {showOrphans && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
                {orphanTraces.map((trace, i) => (
                  <OrphanTraceCard key={trace.id} trace={trace} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
