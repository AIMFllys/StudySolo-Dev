import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import type { NodeExecutionTrace, WorkflowExecutionSession, WorkflowNodeData } from '@/types';
import { isLegacyLoopRegionNode, normalizeEdge } from '@/types';
import { getNodeTheme } from '@/features/workflow/constants/workflow-meta';
import { computeWorkflowChains } from '@/features/workflow/utils/compute-chains';
import { isTraceFinished } from '@/features/workflow/utils/trace-helpers';

type NodeData = WorkflowNodeData & Record<string, unknown>;

/** Click-to-connect 状态 */
export interface ClickConnectState {
  /** idle: 未激活 | waiting-target: 已选源，等待点击目标 */
  phase: 'idle' | 'waiting-target';
  sourceNodeId?: string;
  sourceHandleId?: string;
}

interface WorkflowStore {
  nodes: Node[];
  edges: Edge[];
  currentWorkflowId: string | null;
  currentWorkflowName: string | null;
  selectedNodeId: string | null;
  lastPrompt: string;
  lastImplicitContext: Record<string, unknown> | null;
  isDirty: boolean;
  clickConnectState: ClickConnectState;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (
    nodeId: string,
    data: Partial<NodeData> | ((prev: NodeData) => Partial<NodeData>)
  ) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  replaceWorkflowGraph: (nodes: Node[], edges: Edge[]) => void;
  startClickConnect: (sourceNodeId: string, sourceHandleId: string) => void;
  completeClickConnect: (targetNodeId: string, targetHandleId: string) => void;
  cancelClickConnect: () => void;
  setGenerationContext: (prompt: string, implicitContext: Record<string, unknown> | null) => void;
  setCurrentWorkflow: (id: string, name: string, nodes: Node[], edges: Edge[], dirty?: boolean) => void;
  markClean: () => void;
  
  showAllNodeSlips: boolean;
  toggleGlobalNodeSlips: () => void;

  executionSession: WorkflowExecutionSession | null;
  startExecutionSession: (workflowId: string, workflowName: string) => void;
  registerNodeTrace: (nodeId: string, order: number, isParallel: boolean, parallelGroupId?: string) => void;
  updateNodeTrace: (nodeId: string, updates: Partial<NodeExecutionTrace>) => void;
  appendNodeTraceToken: (nodeId: string, token: string) => void;
  finalizeExecutionSession: (status: 'completed' | 'error') => void;
  clearExecutionSession: () => void;
  
  // History Actions
  past: { nodes: Node[], edges: Edge[] }[];
  future: { nodes: Node[], edges: Edge[] }[];
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
}

function resolveSelectedNodeId(nodes: Node[], selectedNodeId: string | null) {
  if (!nodes.length) {
    return null;
  }

  if (selectedNodeId && nodes.some((node) => node.id === selectedNodeId)) {
    return selectedNodeId;
  }

  return nodes[0]?.id ?? null;
}

/** Deduplicate nodes by id — React Flow MiniMap uses node.id as key internally */
function deduplicateNodes(nodes: Node[]): Node[] {
  const seen = new Map<string, Node>();
  for (const node of nodes) seen.set(node.id, node);
  return seen.size === nodes.length ? nodes : [...seen.values()];
}

/** Auto-assign branch label when source is logic_switch */
function buildEdgeData(
  sourceId: string,
  nodes: import('@xyflow/react').Node[],
  edges: import('@xyflow/react').Edge[],
): Record<string, unknown> {
  const sourceNode = nodes.find((n) => n.id === sourceId);
  const sourceType = (sourceNode?.data as Record<string, unknown>)?.type ?? sourceNode?.type;
  if (sourceType !== 'logic_switch') return {};

  // Count existing branches from this logic_switch
  const existingBranches = edges
    .filter((e) => e.source === sourceId)
    .map((e) => (e.data as Record<string, unknown>)?.branch as string)
    .filter(Boolean);

  // Next letter: A, B, C...
  const nextChar = String.fromCharCode(65 + existingBranches.length);
  return { branch: nextChar };
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],
  currentWorkflowId: null,
  currentWorkflowName: null,
  selectedNodeId: null,
  lastPrompt: '',
  lastImplicitContext: null,
  isDirty: false,
  clickConnectState: { phase: 'idle' } as ClickConnectState,
  showAllNodeSlips: true,
  executionSession: null,

  toggleGlobalNodeSlips: () => set((state) => ({ showAllNodeSlips: !state.showAllNodeSlips })),

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
          traces,
          completedCount: 0,
          totalCount: traces.filter((trace) => trace.nodeType !== 'trigger_input').length,
          chains,
        },
      };
    }),

  registerNodeTrace: (nodeId, order, isParallel, parallelGroupId) =>
    set((state) => {
      if (!state.executionSession) {
        return state;
      }

      return {
        executionSession: {
          ...state.executionSession,
          traces: state.executionSession.traces.map((trace) =>
            trace.nodeId === nodeId
              ? {
                  ...trace,
                  executionOrder: order,
                  isParallel,
                  parallelGroupId,
                  status: 'running',
                }
              : trace
          ),
        },
      };
    }),

  updateNodeTrace: (nodeId, updates) =>
    set((state) => {
      if (!state.executionSession) {
        return state;
      }

      let completedCount = state.executionSession.completedCount;
      const traces = state.executionSession.traces.map((trace) => {
        if (trace.nodeId !== nodeId) {
          return trace;
        }

        const nextTrace = { ...trace, ...updates };
        const becameFinished = !isTraceFinished(trace) && isTraceFinished(nextTrace);

        if (becameFinished && trace.nodeType !== 'trigger_input') {
          completedCount += 1;
        }

        return nextTrace;
      });

      return {
        executionSession: {
          ...state.executionSession,
          traces,
          completedCount,
        },
      };
    }),

  appendNodeTraceToken: (nodeId, token) =>
    set((state) => {
      if (!state.executionSession) {
        return state;
      }

      return {
        executionSession: {
          ...state.executionSession,
          traces: state.executionSession.traces.map((trace) =>
            trace.nodeId === nodeId
              ? { ...trace, streamingOutput: trace.streamingOutput + token }
              : trace
          ),
        },
      };
    }),

  finalizeExecutionSession: (status) =>
    set((state) => {
      if (!state.executionSession) {
        return state;
      }

      const now = performance.now();
      return {
        executionSession: {
          ...state.executionSession,
          overallStatus: status,
          finishedAt: now,
          totalDurationMs: Math.round(now - state.executionSession.startedAt),
        },
      };
    }),

  clearExecutionSession: () => set({ executionSession: null }),

  takeSnapshot: () =>
    set((state) => {
      const newPast = [...state.past, { nodes: state.nodes, edges: state.edges }];
      if (newPast.length > 50) newPast.shift();
      return { past: newPast, future: [] };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        past: newPast,
        future: [{ nodes: state.nodes, edges: state.edges }, ...state.future],
        nodes: prev.nodes,
        edges: prev.edges,
        selectedNodeId: resolveSelectedNodeId(prev.nodes, state.selectedNodeId),
        isDirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, { nodes: state.nodes, edges: state.edges }],
        future: newFuture,
        nodes: next.nodes,
        edges: next.edges,
        selectedNodeId: resolveSelectedNodeId(next.nodes, state.selectedNodeId),
        isDirty: true,
      };
    }),

  setNodes: (nodes) =>
    set((state) => {
      const deduped = deduplicateNodes(nodes);
      return {
        nodes: deduped,
        selectedNodeId: resolveSelectedNodeId(deduped, state.selectedNodeId),
        isDirty: true,
      };
    }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) =>
    set((state) => {
      const isSignificant = changes.some((c) => c.type === 'remove');
      let newPast = state.past;
      if (isSignificant) {
        newPast = [...state.past, { nodes: state.nodes, edges: state.edges }];
        if (newPast.length > 50) newPast.shift();
      }
      
      const nextNodes = applyNodeChanges(changes, state.nodes);
      return {
        past: newPast,
        future: isSignificant ? [] : state.future,
        nodes: nextNodes,
        selectedNodeId: resolveSelectedNodeId(nextNodes, state.selectedNodeId),
        isDirty: true,
      };
    }),

  onEdgesChange: (changes) =>
    set((state) => {
      const isSignificant = changes.some((c) => c.type === 'remove');
      let newPast = state.past;
      if (isSignificant) {
        newPast = [...state.past, { nodes: state.nodes, edges: state.edges }];
        if (newPast.length > 50) newPast.shift();
      }

      return {
        past: newPast,
        future: isSignificant ? [] : state.future,
        edges: applyEdgeChanges(changes, state.edges),
        isDirty: true,
      };
    }),

  onConnect: (connection) =>
    set((state) => {
      const newPast = [...state.past, { nodes: state.nodes, edges: state.edges }];
      if (newPast.length > 50) newPast.shift();

      const edgeId = `edge-seq-${connection.source ?? 'u'}-${connection.target ?? 'u'}-${Date.now().toString(36)}`;
      const data = buildEdgeData(connection.source ?? '', state.nodes, state.edges);

      return {
        past: newPast,
        future: [],
        edges: addEdge(
          {
            ...connection,
            id: edgeId,
            type: 'sequential',
            animated: false,
            data,
          },
          state.edges,
        ),
        isDirty: true,
      };
    }),

  startClickConnect: (sourceNodeId, sourceHandleId) =>
    set({ clickConnectState: { phase: 'waiting-target', sourceNodeId, sourceHandleId } }),

  completeClickConnect: (targetNodeId, targetHandleId) =>
    set((state) => {
      const { clickConnectState } = state;
      if (clickConnectState.phase !== 'waiting-target' || !clickConnectState.sourceNodeId) {
        return { clickConnectState: { phase: 'idle' } };
      }
      if (clickConnectState.sourceNodeId === targetNodeId) {
        return { clickConnectState: { phase: 'idle' } };
      }

      const newPast = [...state.past, { nodes: state.nodes, edges: state.edges }];
      if (newPast.length > 50) newPast.shift();

      const edgeId = `edge-seq-${clickConnectState.sourceNodeId}-${targetNodeId}-${Date.now().toString(36)}`;
      const data = buildEdgeData(clickConnectState.sourceNodeId, state.nodes, state.edges);

      return {
        past: newPast,
        future: [],
        edges: addEdge(
          {
            id: edgeId,
            source: clickConnectState.sourceNodeId,
            target: targetNodeId,
            sourceHandle: clickConnectState.sourceHandleId,
            targetHandle: targetHandleId,
            type: 'sequential',
            animated: false,
            data,
          },
          state.edges,
        ),
        isDirty: true,
        clickConnectState: { phase: 'idle' },
      };
    }),

  cancelClickConnect: () => set({ clickConnectState: { phase: 'idle' } }),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const prevData = node.data as unknown as NodeData;
        const patch = typeof data === 'function' ? data(prevData) : data;
        return { ...node, data: { ...prevData, ...patch } };
      }),
      isDirty: true,
    })),

  setSelectedNodeId: (selectedNodeId) =>
    set((state) => (state.selectedNodeId === selectedNodeId ? state : { selectedNodeId })),

  replaceWorkflowGraph: (nodes, edges) =>
    set((state) => {
      const deduped = deduplicateNodes(nodes);
      return {
        nodes: deduped,
        edges,
        selectedNodeId: resolveSelectedNodeId(deduped, state.selectedNodeId),
        isDirty: true,
      };
    }),

  setGenerationContext: (lastPrompt, lastImplicitContext) =>
    set({
      lastPrompt,
      lastImplicitContext,
    }),

  setCurrentWorkflow: (id, name, nodes, edges, dirty = false) => {
    const deduped = deduplicateNodes(nodes.filter((node) => !isLegacyLoopRegionNode(node as never)));
    set({
      currentWorkflowId: id,
      currentWorkflowName: name,
      nodes: deduped,
      edges: edges.map((edge) => normalizeEdge(edge as never) as unknown as Edge),
      selectedNodeId: resolveSelectedNodeId(deduped, null),
      isDirty: dirty,
    });
  },

  markClean: () => set({ isDirty: false }),
}));
