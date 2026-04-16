import type { Node } from '@xyflow/react';
import type { AIStepNodeData, NodeStatus } from '@/types';
import { getNodeTheme } from './node-theme';
import { getNodeTypeMeta, NODE_TYPE_META } from './node-type-meta';
export { getNodeTheme, getNodeTypeMeta, NODE_TYPE_META };
export type { NodePortSpec } from './node-type-meta';

type StatusMeta = {
  badgeClassName: string;
  dotClassName: string;
  label: string;
};

type WorkflowNodeLike = Pick<Node, 'id' | 'type'> & {
  data?: Partial<AIStepNodeData>;
};

export const STATUS_META: Record<NodeStatus, StatusMeta> = {
  pending: {
    label: '待执行',
    badgeClassName: 'border border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-400 border-dashed bg-transparent',
    dotClassName: 'bg-slate-400',
  },
  running: {
    label: '执行中',
    badgeClassName: 'border border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-400 bg-transparent shadow-[1px_1px_0px_rgba(14,165,233,0.2)]',
    dotClassName: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]',
  },
  waiting: {
    label: '等待中',
    badgeClassName: 'border border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 shadow-[1px_1px_0px_rgba(245,158,11,0.2)]',
    dotClassName: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  },
  done: {
    label: '已完成',
    badgeClassName: 'border border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-[1px_1px_0px_rgba(5,150,105,0.2)]',
    dotClassName: 'bg-emerald-500',
  },
  error: {
    label: '错误',
    badgeClassName: 'border border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 shadow-[1px_1px_0px_rgba(225,29,72,0.2)]',
    dotClassName: 'bg-rose-500',
  },
  paused: {
    label: '已暂停',
    badgeClassName: 'border border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400 border-dotted bg-transparent',
    dotClassName: 'bg-amber-500',
  },
  skipped: {
    label: '已跳过',
    badgeClassName: 'border border-stone-400 text-stone-600 dark:border-stone-500 dark:text-stone-300 border-dashed bg-transparent',
    dotClassName: 'bg-stone-400',
  },
};

export function getStatusMeta(status?: string) {
  return STATUS_META[(status as NodeStatus) ?? 'pending'] ?? STATUS_META.pending;
}

export function getNodePreview(output?: string, fallback = '等待该步骤生成内容') {
  const normalized = (output ?? '')
    .replace(/```[\s\S]*?```/g, '代码块')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 96);
}

export function getNodeTitle(node: WorkflowNodeLike) {
  return node.data?.label?.trim() || getNodeTypeMeta(node.data?.type ?? node.type).label;
}

