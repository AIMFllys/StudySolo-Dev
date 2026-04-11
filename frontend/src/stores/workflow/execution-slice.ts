import type { StateCreator } from 'zustand';
import type { Node } from '@xyflow/react';
import type { NodeExecutionTrace, WorkflowExecutionSession, WorkflowNodeData } from '@/types';
import { getNodeTheme } from '@/features/workflow/constants/workflow-meta';
import { computeWorkflowChains } from '@/features/workflow/utils/compute-chains';
import { isTraceFinished } from '@/features/workflow/utils/trace-helpers';

type NodeData = WorkflowNodeData & Record<string, unknown>;

export interface ExecutionSlice {
  executionSession: WorkflowExecutionSession | null;
  startExecutionSession: (workflowId: string, workflowName: string) => void;
  registerNodeTrace: (nodeId: string, order: number, isParallel: boolean, parallelGroupId?: string) => void;
  updateNodeTrace: (nodeId: string, updates: Partial<NodeExecutionTrace>) => void;
  appendNodeTraceToken: (nodeId: string, token: string) => void;
  updateExecutionSessionMeta: (updates: Partial<WorkflowExecutionSession>) => void;
  finalizeExecutionSession: (status: 'completed' | 'error') => void;
  clearExecutionSession: () => void;
}

// The slice needs access to nodes/edges from the parent store
interface StoreWithGraph {
  nodes: Node[];
  edges: import('@xyflow/react').Edge[];
}

export const createExecutionSlice: StateCreator<ExecutionSlice & StoreWithGraph, [], [], ExecutionSlice> = (set) => ({
  executionSession: null,

  startExecutionSession: (workflowId, workflowName) =>
    set((state) => {
      const chains = computeWorkflowChains(state.nodes, state.edges);
      const traces: NodeExecutionTrace[] = state.nodes
        .filter((node) => node.type !== 'annotation' && node.type !== 'generating')
        .map((node, index) => {
          const nodeData = (node.data as NodeData) ?? {};
          return {
            nodeId: node.id,
            nodeType: node.type ?? String(nodeData.type ?? 'unknown'),
            nodeName: String(nodeData.label ?? node.id),
            category: getNodeTheme(node.type ?? String(nodeData.type ?? 'chat_response')).category,
            status: (nodeData.status as NodeExecutionTrace['status']) ?? 'pending',
            executionOrder: index + 1,
            isParallel: false,
            streamingOutput: '',
            outputFormat: typeof nodeData.output_format === 'string' ? nodeData.output_format : undefined,
            modelRoute: typeof nodeData.model_route === 'string' ? nodeData.model_route : undefined,
            chainIds: chains
              .filter((chain) => chain.nodeIds.includes(node.id))
              .map((chain) => chain.chainId),
          };
        });

      return {
        executionSession: {
          sessionId: crypto.randomUUID(),
          workflowId,
          workflowName,
          startedAt: performance.now(),
          overallStatus: 'running',
          phase: 'connected',
          phaseMessage: '已建立执行会话',
          lastActivityAt: performance.now(),
          traces,
          completedCount: 0,
          totalCount: traces.filter((t) => t.nodeType !== 'trigger_input').length,
          chains,
        },
      };
    }),

  registerNodeTrace: (nodeId, order, isParallel, parallelGroupId) =>
    set((state) => {
      if (!state.executionSession) return state;
      return {
        executionSession: {
          ...state.executionSession,
          lastActivityAt: performance.now(),
          traces: state.executionSession.traces.map((t) =>
            t.nodeId === nodeId
              ? { ...t, executionOrder: order, isParallel, parallelGroupId, status: 'running', lastActivityAt: performance.now() }
              : t,
          ),
        },
      };
    }),

  updateNodeTrace: (nodeId, updates) =>
    set((state) => {
      if (!state.executionSession) return state;
      let completedCount = state.executionSession.completedCount;
      const traces = state.executionSession.traces.map((t) => {
        if (t.nodeId !== nodeId) return t;
        const next = { ...t, ...updates };
        if (!isTraceFinished(t) && isTraceFinished(next) && t.nodeType !== 'trigger_input') {
          completedCount += 1;
        }
        return next;
      });
      return { executionSession: { ...state.executionSession, traces, completedCount } };
    }),

  appendNodeTraceToken: (nodeId, token) =>
    set((state) => {
      if (!state.executionSession) return state;
      return {
        executionSession: {
          ...state.executionSession,
          lastActivityAt: performance.now(),
          traces: state.executionSession.traces.map((t) =>
            t.nodeId === nodeId
              ? { ...t, streamingOutput: t.streamingOutput + token, lastActivityAt: performance.now() }
              : t,
          ),
        },
      };
    }),

  updateExecutionSessionMeta: (updates) =>
    set((state) => {
      if (!state.executionSession) return state;
      return {
        executionSession: {
          ...state.executionSession,
          ...updates,
        },
      };
    }),

  finalizeExecutionSession: (status) =>
    set((state) => {
      if (!state.executionSession) return state;
      const now = performance.now();
      return {
        executionSession: {
          ...state.executionSession,
          overallStatus: status,
          finishedAt: now,
          lastActivityAt: now,
          totalDurationMs: Math.round(now - state.executionSession.startedAt),
        },
      };
    }),

  clearExecutionSession: () => set({ executionSession: null }),
});
