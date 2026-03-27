'use client';

import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { CollapsibleSection } from '../CollapsibleSection';
import type { AIStepNodeData } from '@/types';
import {
  getNodePreview,
  getNodeTitle,
  getNodeTypeMeta,
  getStatusMeta,
  STATUS_META,
} from '@/features/workflow/constants/workflow-meta';
import { ExecutionTraceList } from '@/features/workflow/components/execution/ExecutionTraceList';
import { NodeConfigFormContent } from '@/features/workflow/components/node-config/NodeConfigFormContent';
import {
  countExecutionSessionStatuses,
  getExecutionSessionStepCount,
  resolveExecutionFocusTrace,
} from './right-panel-execution-utils';

function getNodeData(node: Node | null | undefined) {
  return (node?.data as unknown as AIStepNodeData | undefined) ?? undefined;
}

function StatusItem({ count, status }: { count: number; status: keyof typeof STATUS_META }) {
  const meta = STATUS_META[status];
  return (
    <div className="node-paper-bg rounded-xl border-[1.5px] border-border/50 px-3 py-2 shadow-sm font-mono">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <span className={`inline-block h-2 w-2 rounded-sm ${meta.dotClassName}`} />
        {meta.label}
      </div>
      <p className="mt-1.5 text-lg font-bold text-foreground">{count}</p>
    </div>
  );
}

function getEdgeSummary(node: Node, edges: { source: string; target: string }[]) {
  return {
    incoming: edges.filter((edge) => edge.target === node.id).length,
    outgoing: edges.filter((edge) => edge.source === node.id).length,
  };
}

export default function RightPanelContent() {
  const {
    edges,
    executionSession,
    lastImplicitContext,
    lastPrompt,
    nodes,
    selectedNodeId,
  } = useWorkflowStore();

  const nodeNameMap = useMemo(
    () => Object.fromEntries(
      nodes.map((node) => [node.id, String((node.data as { label?: string })?.label ?? node.id)]),
    ),
    [nodes],
  );

  const statusCounts = executionSession
    ? countExecutionSessionStatuses(executionSession)
    : nodes.reduce<Record<string, number>>((acc, node) => {
        const status = getNodeData(node)?.status ?? 'pending';
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {});

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null;
  const focusTrace = executionSession ? resolveExecutionFocusTrace(executionSession) : null;
  const focusNode = focusTrace
    ? (nodes.find((node) => node.id === focusTrace.nodeId) ?? selectedNode)
    : null;
  const focusMeta = focusTrace
    ? getNodeTypeMeta(focusTrace.nodeType)
    : focusNode
      ? getNodeTypeMeta((getNodeData(focusNode)?.type ?? focusNode.type) as string)
      : null;
  const focusStatus = focusTrace
    ? getStatusMeta(focusTrace.status)
    : focusNode
      ? getStatusMeta(getNodeData(focusNode)?.status)
      : null;
  const focusEdges = focusNode ? getEdgeSummary(focusNode, edges) : null;
  const focusTitle = focusTrace?.nodeName ?? (focusNode ? getNodeTitle(focusNode) : '');
  const focusDescription = focusMeta?.description ?? '';
  const focusPreview = focusTrace
    ? getNodePreview(
        focusTrace.status === 'running'
          ? focusTrace.streamingOutput
          : (focusTrace.finalOutput ?? focusTrace.streamingOutput),
        '该步骤还没有生成可展示内容',
      )
    : '该步骤还没有生成可展示内容';
  const generatedStepsBadge = executionSession
    ? `${getExecutionSessionStepCount(executionSession)} 个步骤`
    : '等待执行';
  const pendingCount = statusCounts.pending ?? 0;
  const runningCount = statusCounts.running ?? 0;
  const doneCount = statusCounts.done ?? 0;
  const errorCount = statusCounts.error ?? 0;
  const focusStatusToneClassName = executionSession && focusTrace
    ? 'mt-2 text-[10px] uppercase tracking-[0.18em] text-primary'
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <CollapsibleSection id="right-status" title="工作流步骤总览">
          <p className="mb-3 text-sm text-muted-foreground">
            每个生成步骤都会在这里同步展示，便于看清当前逻辑链路和产出。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatusItem status="pending" count={pendingCount} />
            <StatusItem status="running" count={runningCount} />
            <StatusItem status="done" count={doneCount} />
            <StatusItem status="error" count={errorCount} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="right-focus"
          title="当前焦点"
          badge={
            focusStatus ? (
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide shadow-sm ${focusStatus.badgeClassName}`}>
                {focusStatus.label}
              </span>
            ) : null
          }
        >
          <div className="space-y-4">
            <div className="node-paper-bg rounded-xl border-[1.5px] border-border/50 px-4 py-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">执行焦点</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    当前运行中的步骤会优先显示在这里，便于快速查看执行状态与输出摘要。
                  </p>
                </div>
                {focusStatus ? (
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide shadow-sm ${focusStatus.badgeClassName}`}>
                    {focusStatus.label}
                  </span>
                ) : null}
              </div>

              {focusNode && focusMeta && focusStatus && focusEdges ? (
                <>
                  <div>
                    <h5 className="text-sm font-semibold text-foreground">{focusTitle}</h5>
                    <p className="mt-1 text-xs text-muted-foreground">{focusDescription}</p>
                    {focusStatusToneClassName ? (
                      <p className={focusStatusToneClassName}>随执行状态自动切换</p>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono">
                    <div className="rounded-xl border-[1.5px] border-border/50 bg-background px-3 py-2 text-center shadow-sm">
                      <p className="text-[10px] uppercase font-medium">进入连接</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{focusEdges.incoming}</p>
                    </div>
                    <div className="rounded-xl border-[1.5px] border-border/50 bg-background px-3 py-2 text-center shadow-sm">
                      <p className="text-[10px] uppercase font-medium">输出连接</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{focusEdges.outgoing}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border-[1.5px] border-border/50 bg-background px-3 py-3 shadow-sm">
                    <p className="font-mono text-[10px] uppercase tracking-wider font-medium text-muted-foreground">输出预览</p>
                    <p className="mt-2 text-sm leading-6 text-foreground font-serif">
                      {focusPreview}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                  还没有活跃的执行焦点。运行工作流后，这里会自动显示当前步骤的状态和输出摘要。
                </div>
              )}
            </div>

            <div className="node-paper-bg rounded-xl border-[1.5px] border-border/50 px-4 py-4 shadow-sm">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-foreground">选中节点配置</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  这里展示当前选中节点的真实配置，修改后会立即写回节点数据。
                </p>
              </div>

              {selectedNode ? (
                <NodeConfigFormContent nodeId={selectedNode.id} showExecutionNotice />
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                  当前没有可编辑的节点。先在画布中创建或选中一个节点后，这里会显示对应配置。
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {lastPrompt ? (
          <CollapsibleSection id="right-prompt" title="最近一次生成目标">
            <p className="text-sm leading-6 text-foreground">{lastPrompt}</p>
            {typeof lastImplicitContext?.global_theme === 'string' ? (
              <p className="mt-2 text-xs text-muted-foreground">主题线索：{lastImplicitContext.global_theme}</p>
            ) : null}
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection
          id="right-nodes"
          title="生成步骤"
          badge={<span className="text-xs text-muted-foreground">{generatedStepsBadge}</span>}
        >
          {executionSession ? (
            <ExecutionTraceList session={executionSession} nodeNameMap={nodeNameMap} embedded />
          ) : (
            <div className="node-paper-bg rounded-xl border-[1.5px] border-border/50 px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-foreground">等待执行后展示推理链</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                点击运行后，这里会按实际执行顺序展开生成步骤，并在每一步下方同步显示对应的输入传输内容与输出结果。
              </p>
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
