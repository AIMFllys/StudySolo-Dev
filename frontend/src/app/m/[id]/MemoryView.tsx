'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Clock, Zap, Hash, Share2, Check, Copy, Pencil,
  AlertTriangle, CheckCircle2, Loader2, XCircle,
  ChevronDown, ChevronUp, Timer, ChevronsUpDown,
} from 'lucide-react';
import type { WorkflowRunDetail, RunTrace } from '@/types/memory';
import type { NodeType } from '@/types/workflow';
import { toggleRunShare } from '@/services/memory.service';
import { NODE_TYPE_META } from '@/features/workflow/constants/workflow-meta';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { injectTracesIntoNodes, findOrphanTraces } from './inject-traces';

const ReadOnlyCanvas = dynamic(
  () => import('@/components/workflow/ReadOnlyCanvas'),
  { ssr: false, loading: () => <CanvasPlaceholder /> },
);

function CanvasPlaceholder() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <div className="text-center text-muted-foreground">
        <div className="h-8 w-8 mx-auto mb-2 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        <p className="text-xs">加载画布...</p>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms: number | null) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function computeTotalDuration(run: WorkflowRunDetail): number | null {
  if (!run.started_at || !run.completed_at) return null;
  return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  completed: { icon: CheckCircle2, label: '已完成', className: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  failed: { icon: XCircle, label: '执行失败', className: 'text-rose-600 dark:text-rose-400 border-rose-500/30' },
  running: { icon: Loader2, label: '执行中', className: 'text-sky-600 dark:text-sky-400 border-sky-500/30' },
};

function getNodeMeta(nodeType: string) {
  return NODE_TYPE_META[nodeType as NodeType] ?? NODE_TYPE_META.chat_response;
}

// ─── ShareToggle (with confirmation dialog) ────────────────────────────────

function ShareConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div className="relative bg-background border border-border rounded-xl shadow-xl px-6 py-5 max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Share2 className="h-5 w-5 text-foreground" />
          </div>
          <h3 className="text-sm font-serif font-semibold text-foreground">
            公开分享此运行记录
          </h3>
          <div className="text-xs text-muted-foreground leading-relaxed text-left space-y-2">
            <p>分享后，任何拥有链接的人都可以查看：</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>工作流的完整画布结构和节点布局</li>
              <li>每个节点的执行输入和输出内容</li>
              <li>执行耗时、模型路由等运行详情</li>
              <li>你的用户输入文本</li>
            </ul>
            <p className="text-[11px] text-muted-foreground/80">
              你可以随时取消分享来撤回公开访问。
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1 w-full">
            <button
              onClick={onCancel}
              className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-md bg-foreground text-background px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
            >
              确认分享
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareToggle({ runId, initialShared }: { runId: string; initialShared: boolean }) {
  const [isShared, setIsShared] = useState(initialShared);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const doToggle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await toggleRunShare(runId);
      if (result) setIsShared(result.is_shared);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  const handleShareClick = useCallback(() => {
    if (isShared) {
      // Already shared → directly unshare (no confirmation needed)
      doToggle();
    } else {
      // Not shared → show confirmation dialog first
      setShowConfirm(true);
    }
  }, [isShared, doToggle]);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    doToggle();
  }, [doToggle]);

  const handleCopy = useCallback(() => {
    const url = `${window.location.origin}/m/${runId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [runId]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleShareClick}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-serif font-medium transition-all border shadow-sm ${
            isShared
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-background border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
          {isShared ? '已公开' : '分享'}
        </button>

        {isShared && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-serif font-medium text-muted-foreground hover:bg-muted transition-colors shadow-sm"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制链接'}
          </button>
        )}
      </div>

      {showConfirm && (
        <ShareConfirmDialog
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Orphan TraceCard (fallback for traces without matching nodes) ──────────

function OrphanTraceCard({ trace, index }: { trace: RunTrace; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getNodeMeta(trace.node_type);
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-border/60 bg-background/95 backdrop-blur-md shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold font-mono text-muted-foreground">
          {index + 1}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
        <span className="text-[11px] font-semibold font-serif text-foreground truncate flex-1">
          {trace.node_name}
        </span>
        {trace.duration_ms !== null && (
          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
            <Timer className="h-2.5 w-2.5" />
            {formatDuration(trace.duration_ms)}
          </span>
        )}
        {trace.status === 'error' && <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />}
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {expanded && trace.final_output && (
        <div className="border-t border-border/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto scrollbar-hide">
            {trace.final_output.slice(0, 1000)}{trace.final_output.length > 1000 ? '…' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Fallback: card list view (when nodes_json is unavailable) ──────────────

function FallbackCardView({ run }: { run: WorkflowRunDetail }) {
  const totalDuration = computeTotalDuration(run);
  const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = statusCfg.icon;
  const doneTraces = run.traces.filter((t) => t.status === 'done');
  const errorTraces = run.traces.filter((t) => t.status === 'error');

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-20 space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        {/* Run Summary */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h1 className="text-lg font-bold font-serif text-foreground truncate">{run.workflow_name}</h1>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono flex-wrap">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(run.started_at)}</span>
                {totalDuration !== null && (
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" />总耗时 {formatDuration(totalDuration)}</span>
                )}
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" />Token {run.tokens_used?.toLocaleString() ?? '0'}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${statusCfg.className}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${run.status === 'running' ? 'animate-spin' : ''}`} />
              {statusCfg.label}
            </div>
          </div>
          <div className="flex items-center gap-4 pt-2 border-t border-dashed border-border/40">
            <span className="text-[10px] text-muted-foreground">{doneTraces.length} 个节点完成</span>
            {errorTraces.length > 0 && <span className="text-[10px] text-rose-600 dark:text-rose-400">{errorTraces.length} 个节点出错</span>}
            <span className="text-[10px] text-muted-foreground">共 {run.traces.length} 个节点</span>
            <div className="flex-1" />
            <ShareToggle runId={run.id} initialShared={run.is_shared} />
          </div>
        </div>

        {/* Trace cards */}
        {run.traces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">该运行记录暂无详细节点数据</p>
          </div>
        ) : (
          <div className="space-y-3">
            {run.traces.map((trace, i) => (
              <OrphanTraceCard key={trace.id} trace={trace} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main MemoryView ────────────────────────────────────────────────────────

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

  // Inject trace data into nodes for canvas rendering
  const injectedNodes = useMemo(() => {
    if (!hasCanvas) return [];
    return injectTracesIntoNodes(run.nodes_json!, run.traces);
  }, [hasCanvas, run.nodes_json, run.traces]);

  const edges = useMemo(() => run.edges_json ?? [], [run.edges_json]);

  // Orphan traces (traces without matching nodes in current canvas)
  const orphanTraces = useMemo(() => {
    if (!hasCanvas) return [];
    return findOrphanTraces(run.nodes_json!, run.traces);
  }, [hasCanvas, run.nodes_json, run.traces]);

  const [showOrphans, setShowOrphans] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  // Initialize workflow store so AIStepNode → NodeResultSlip renders correctly
  useEffect(() => {
    if (!hasCanvas) return;
    const store = useWorkflowStore.getState();
    store.setCurrentWorkflow(run.workflow_id, run.workflow_name, injectedNodes, []);
    // Defer edges by one frame (same pattern as WorkflowCanvasLoader)
    requestAnimationFrame(() => {
      useWorkflowStore.getState().setEdges(edges);
    });
    // Force show all NodeResultSlips
    if (!useWorkflowStore.getState().showAllNodeSlips) {
      useWorkflowStore.getState().toggleGlobalNodeSlips();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: no canvas data → card list view
  if (!hasCanvas) {
    return <FallbackCardView run={run} />;
  }

  return (
    <div className="relative w-full h-full flex flex-col pointer-events-none">
      {/* Background Fullscreen Canvas */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <ReadOnlyCanvas
          nodes={injectedNodes}
          edges={edges}
          className="h-full w-full"
        />
      </div>

      {/* Floating UI Container */}
      <div className="absolute inset-x-0 top-16 z-10 px-6 pt-4 pointer-events-none flex justify-between items-start">

        {/* Left: Run Summary Panel */}
        <div className="pointer-events-auto max-w-sm bg-background/95 backdrop-blur-md border border-border shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-xl font-serif font-bold text-foreground truncate flex-1">
              {run.workflow_name}
            </h1>
            <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium shrink-0 ${statusCfg.className}`}>
              <StatusIcon className={`h-3 w-3 ${run.status === 'running' ? 'animate-spin' : ''}`} />
              {statusCfg.label}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-1.5 text-[11px] text-muted-foreground font-mono">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{formatDateTime(run.started_at)}</span>
            </div>
            {totalDuration !== null && (
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 shrink-0" />
                <span>总耗时 {formatDuration(totalDuration)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Hash className="h-3 w-3 shrink-0" />
              <span>Token {run.tokens_used?.toLocaleString() ?? '0'}</span>
            </div>
          </div>

          {/* Node stats */}
          <div className="mt-3 pt-3 border-t border-dashed border-border flex items-center gap-3 text-[10px] font-serif text-muted-foreground flex-wrap">
            <span>{doneTraces.length} 完成</span>
            {errorTraces.length > 0 && (
              <span className="text-rose-600 dark:text-rose-400">{errorTraces.length} 出错</span>
            )}
            <span>共 {run.traces.length} 节点</span>
          </div>

          {/* User input preview */}
          {run.input && (
            <div className="mt-3 pt-3 border-t border-dashed border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">用户输入</p>
              <p className="text-[12px] text-foreground font-serif leading-relaxed line-clamp-3">{run.input}</p>
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="pointer-events-auto flex flex-col gap-2.5">
          {/* Edit button — navigate to workflow editor */}
          <button
            onClick={() => router.push(`/c/${run.workflow_id}`)}
            className="flex items-center gap-2 bg-background border border-border px-3.5 py-2 text-xs font-serif font-medium rounded-lg hover:bg-muted transition-colors shadow-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            进入编辑
          </button>

          <ShareToggle runId={run.id} initialShared={run.is_shared} />

          {/* Expand/collapse all NodeResultSlips */}
          <button
            onClick={() => {
              const next = !allExpanded;
              setAllExpanded(next);
              window.dispatchEvent(new CustomEvent('workflow:toggle-all-slips', { detail: next }));
            }}
            className="flex items-center gap-2 bg-background border border-border px-3.5 py-2 text-xs font-serif font-medium rounded-lg hover:bg-muted transition-colors shadow-sm"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {allExpanded ? '收起详情' : '展开详情'}
          </button>
        </div>
      </div>

      {/* Bottom: Orphan traces panel (traces without matching canvas nodes) */}
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
