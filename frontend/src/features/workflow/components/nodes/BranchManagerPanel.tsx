'use client';

import { memo, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';

interface BranchInfo {
  edgeId: string;
  branch: string;
  targetId: string;
  targetLabel: string;
}

interface Props {
  nodeId: string;
}

/**
 * BranchManagerPanel — inline branch management for logic_switch nodes.
 * Shows list of outgoing branches with rename/delete. Appears when selected.
 *
 * Design: emerald → amber (branch style), inline in AIStepNode footer area.
 */
function BranchManagerPanel({ nodeId }: Props) {
  const edges = useWorkflowStore((s) => s.edges);
  const nodes = useWorkflowStore((s) => s.nodes);

  const branches: BranchInfo[] = edges
    .filter((e) => e.source === nodeId)
    .map((e) => {
      const data = e.data as Record<string, unknown> | undefined;
      const target = nodes.find((n) => n.id === e.target);
      const targetLabel =
        (target?.data as Record<string, unknown>)?.label as string || e.target.slice(0, 6);
      return {
        edgeId: e.id,
        branch: (data?.branch as string) || '默认',
        targetId: e.target,
        targetLabel,
      };
    });

  const handleRenameBranch = useCallback(
    (edgeId: string, newLabel: string) => {
      const store = useWorkflowStore.getState();
      store.takeSnapshot();
      store.setEdges(
        store.edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data as Record<string, unknown>), branch: newLabel } }
            : e,
        ),
      );
    },
    [],
  );

  const handleDeleteBranch = useCallback(
    (edgeId: string) => {
      const store = useWorkflowStore.getState();
      store.takeSnapshot();
      store.setEdges(store.edges.filter((e) => e.id !== edgeId));
    },
    [],
  );

  if (branches.length === 0) {
    return (
      <div className="text-[10px] font-serif text-amber-700/50 dark:text-amber-300/50 italic mt-1">
        暂无分支 — 从 Handle 拖出连线创建
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-amber-700/60 dark:text-amber-300/60 font-bold mb-1">
        ⑂ 分支列表 ({branches.length})
      </div>
      {branches.map((b) => (
        <div
          key={b.edgeId}
          className="flex items-center gap-1.5 rounded-sm border border-dashed border-amber-500/20 bg-amber-500/5 px-2 py-1"
        >
          <input
            className="w-10 bg-transparent text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 outline-none border-b border-transparent focus:border-amber-500/50 transition-colors"
            defaultValue={b.branch}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== b.branch) handleRenameBranch(b.edgeId, v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-[9px] text-foreground/40 font-serif truncate flex-1">
            → {b.targetLabel}
          </span>
          <button
            className="p-0.5 text-foreground/30 hover:text-rose-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteBranch(b.edgeId);
            }}
            title="删除此分支"
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default memo(BranchManagerPanel);
