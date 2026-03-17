'use client';

import type { Node } from '@xyflow/react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { usePanelStore } from '@/stores/use-panel-store';
import { CollapsibleSection } from '../CollapsibleSection';
import type { AIStepNodeData } from '@/types';
import {
  getNodePreview,
  getNodeTitle,
  getNodeTypeMeta,
  getStatusMeta,
  STATUS_META,
} from '@/features/workflow/constants/workflow-meta';

function getNodeData(node: Node | null | undefined) {
  return (node?.data as unknown as AIStepNodeData | undefined) ?? undefined;
}

function StatusItem({ count, status }: { count: number; status: keyof typeof STATUS_META }) {
  const meta = STATUS_META[status];
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dotClassName}`} />
        {meta.label}
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{count}</p>
    </div>
  );
}

function getEdgeSummary(node: Node, edges: { source: string; target: string }[]) {
  return {
    incoming: edges.filter((edge) => edge.target === node.id).length,
    outgoing: edges.filter((edge) => edge.source === node.id).length,
  };
}

/**
 * RightPanelContent — the actual content of the execution/right panel.
 * This is extracted so it can be rendered in either the right panel or the left sidebar.
 */
export default function RightPanelContent() {
  const {
    edges,
    lastImplicitContext,
    lastPrompt,
    nodes,
    selectedNodeId,
    setSelectedNodeId,
  } = useWorkflowStore();

  const statusCounts = nodes.reduce<Record<string, number>>((acc, node) => {
    const status = getNodeData(node)?.status ?? 'pending';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null;
  const selectedMeta = selectedNode
    ? getNodeTypeMeta((getNodeData(selectedNode)?.type ?? selectedNode.type) as string)
    : null;
  const selectedStatus = selectedNode
    ? getStatusMeta(getNodeData(selectedNode)?.status)
    : null;
  const selectedEdges = selectedNode ? getEdgeSummary(selectedNode, edges) : null;

  const isSectionCollapsed = usePanelStore((s) => s.isSectionCollapsed);
  void isSectionCollapsed; // consumed indirectly by CollapsibleSection

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Section 1: Status overview */}
        <CollapsibleSection id="right-status" title="工作流步骤总览">
          <p className="mb-3 text-sm text-muted-foreground">
            每个生成步骤都会在这里同步展示，便于看清当前逻辑链路和产出。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatusItem status="pending" count={statusCounts.pending ?? 0} />
            <StatusItem status="running" count={statusCounts.running ?? 0} />
            <StatusItem status="done" count={statusCounts.done ?? 0} />
            <StatusItem status="error" count={statusCounts.error ?? 0} />
          </div>
        </CollapsibleSection>

        {/* Section 2: Selected node detail */}
        {selectedNode && selectedMeta && selectedStatus && selectedEdges ? (
          <CollapsibleSection
            id="right-focus"
            title="当前焦点"
            badge={
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${selectedStatus.badgeClassName}`}>
                {selectedStatus.label}
              </span>
            }
          >
            <div>
              <h4 className="text-sm font-semibold text-foreground">{getNodeTitle(selectedNode)}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{selectedMeta.description}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="rounded-2xl border border-white/8 bg-background/40 px-3 py-2">
                <p>进入连接</p>
                <p className="mt-1 text-base font-semibold text-foreground">{selectedEdges.incoming}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-background/40 px-3 py-2">
                <p>输出连接</p>
                <p className="mt-1 text-base font-semibold text-foreground">{selectedEdges.outgoing}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/8 bg-background/40 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">输出预览</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {getNodePreview(getNodeData(selectedNode)?.output, '该步骤还没有生成可展示内容')}
              </p>
            </div>
          </CollapsibleSection>
        ) : (
          <CollapsibleSection id="right-focus" title="当前焦点">
            <p className="text-sm text-muted-foreground">
              还没有生成任何工作流步骤。输入学习目标后，右侧会按步骤展示整个生成链路。
            </p>
          </CollapsibleSection>
        )}

        {/* Section 3: Last prompt */}
        {lastPrompt ? (
          <CollapsibleSection id="right-prompt" title="最近一次生成目标">
            <p className="text-sm leading-6 text-foreground">{lastPrompt}</p>
            {typeof lastImplicitContext?.global_theme === 'string' ? (
              <p className="mt-2 text-xs text-muted-foreground">主题线索：{lastImplicitContext.global_theme}</p>
            ) : null}
          </CollapsibleSection>
        ) : null}

        {/* Section 4: Node list */}
        <CollapsibleSection
          id="right-nodes"
          title="生成步骤"
          badge={<span className="text-xs text-muted-foreground">{nodes.length} 个节点</span>}
        >
          <div className="space-y-3">
            {nodes.map((node, index) => {
              const nodeData = getNodeData(node);
              const meta = getNodeTypeMeta(nodeData?.type ?? node.type);
              const status = getStatusMeta(nodeData?.status);
              const isSelected = node.id === selectedNode?.id;
              const edgeSummary = getEdgeSummary(node, edges);

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full rounded-3xl border px-4 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-primary/40 bg-primary/10 shadow-[0_0_24px_rgba(99,102,241,0.12)]'
                      : 'border-white/8 bg-black/10 hover:border-primary/25 hover:bg-black/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${meta.accentClassName}`}>
                        <meta.icon className="h-4.5 w-4.5 text-stone-900" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Step {index + 1}</p>
                        <p className="truncate text-sm font-medium text-foreground">{getNodeTitle(node)}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${status.badgeClassName}`}>
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{meta.description}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground/90">
                    {getNodePreview(nodeData?.output)}
                  </p>

                  <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span>输入 {edgeSummary.incoming}</span>
                    <span>输出 {edgeSummary.outgoing}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
