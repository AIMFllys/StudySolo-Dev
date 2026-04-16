import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { WorkflowRunDetail } from '@/types/memory';
import type { NodeType } from '@/types/workflow';
import { NODE_TYPE_META } from '@/features/workflow/constants/workflow-meta';

export function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDuration(ms: number | null) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function computeTotalDuration(run: WorkflowRunDetail): number | null {
  if (!run.started_at || !run.completed_at) return null;
  return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
}

export const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  completed: { icon: CheckCircle2, label: '已完成', className: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  failed: { icon: XCircle, label: '执行失败', className: 'text-rose-600 dark:text-rose-400 border-rose-500/30' },
  running: { icon: Loader2, label: '执行中', className: 'text-sky-600 dark:text-sky-400 border-sky-500/30' },
};

export function getNodeMeta(nodeType: string) {
  return NODE_TYPE_META[nodeType as NodeType] ?? NODE_TYPE_META.chat_response;
}
