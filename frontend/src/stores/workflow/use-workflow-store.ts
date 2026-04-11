import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import type { WorkflowNodeData } from '@/types';
import { isLegacyLoopRegionNode, normalizeEdge } from '@/types';
import { createExecutionSlice, type ExecutionSlice } from './execution-slice';
import { createHistorySlice, type HistorySlice } from './history-slice';
import { resolveSelectedNodeId, deduplicateNodes, buildEdgeData } from '@/stores/workflow-store-helpers';

type NodeData = WorkflowNodeData & Record<string, unknown>;

/** Click-to-connect 状态 */
export interface ClickConnectState {
  phase: 'idle' | 'waiting-target';
  sourceNodeId?: string;
  sourceHandleId?: string;
}

interface WorkflowStore extends ExecutionSlice, HistorySlice {
  nodes: Node[];
  edges: Edge[];
  currentWorkflowId: string | null;
  currentWorkflowName: string | null;
  selectedNodeId: string | null;
  lastPrompt: string;
  lastImplicitContext: Record<string, unknown> | null;
  isDirty: boolean;
  clickConnectState: ClickConnectState;
  showAllNodeSlips: boolean;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData> | ((prev: NodeData) => Partial<NodeData>)) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  replaceWorkflowGraph: (nodes: Node[], edges: Edge[]) => void;
  startClickConnect: (sourceNodeId: string, sourceHandleId: string) => void;
  completeClickConnect: (targetNodeId: string, targetHandleId: string) => void;
  cancelClickConnect: () => void;
  setGenerationContext: (prompt: string, implicitContext: Record<string, unknown> | null) => void;
  setCurrentWorkflow: (id: string, name: string, nodes: Node[], edges: Edge[], dirty?: boolean) => void;
  markClean: () => void;
  toggleGlobalNodeSlips: () => void;
}

export const useWorkflowStore = create<WorkflowStore>()((...a) => ({
  // ── Slices ──
  ...createExecutionSlice(...a),
  ...createHistorySlice(...a),

  // ── Core state ──
  nodes: [],
  edges: [],
  currentWorkflowId: null,
  currentWorkflowName: null,
  selectedNodeId: null,
  lastPrompt: '',
  lastImplicitContext: null,
  isDirty: false,
  clickConnectState: { phase: 'idle' } as ClickConnectState,
  showAllNodeSlips: true,

  toggleGlobalNodeSlips: () => a[0]((s) => ({ showAllNodeSlips: !s.showAllNodeSlips })),

  setNodes: (nodes) =>
    a[0]((state) => {
      const deduped = deduplicateNodes(nodes);
      return { nodes: deduped, selectedNodeId: resolveSelectedNodeId(deduped, state.selectedNodeId), isDirty: true };
    }),

  setEdges: (edges) => a[0]({ edges, isDirty: true }),

  onNodesChange: (changes) =>
    a[0]((state) => {
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
    a[0]((state) => {
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
    a[0]((state) => {
      const newPast = [...state.past, { nodes: state.nodes, edges: state.edges }];
      if (newPast.length > 50) newPast.shift();
      const edgeId = `edge-seq-${connection.source ?? 'u'}-${connection.target ?? 'u'}-${Date.now().toString(36)}`;
      const data = buildEdgeData(connection.source ?? '', state.nodes, state.edges);
      return {
        past: newPast, future: [],
        edges: addEdge({ ...connection, id: edgeId, type: 'sequential', animated: false, data }, state.edges),
        isDirty: true,
      };
    }),

  startClickConnect: (sourceNodeId, sourceHandleId) =>
    a[0]({ clickConnectState: { phase: 'waiting-target', sourceNodeId, sourceHandleId } }),

  completeClickConnect: (targetNodeId, targetHandleId) =>
    a[0]((state) => {
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
        past: newPast, future: [],
        edges: addEdge({
          id: edgeId, source: clickConnectState.sourceNodeId, target: targetNodeId,
          sourceHandle: clickConnectState.sourceHandleId, targetHandle: targetHandleId,
          type: 'sequential', animated: false, data,
        }, state.edges),
        isDirty: true, clickConnectState: { phase: 'idle' },
      };
    }),

  cancelClickConnect: () => a[0]({ clickConnectState: { phase: 'idle' } }),

  updateNodeData: (nodeId, data) =>
    a[0]((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const prevData = node.data as unknown as NodeData;
        const patch = typeof data === 'function' ? data(prevData) : data;
        return { ...node, data: { ...prevData, ...patch } };
      }),
      isDirty: true,
    })),

  setSelectedNodeId: (selectedNodeId) =>
    a[0]((state) => (state.selectedNodeId === selectedNodeId ? state : { selectedNodeId })),

  replaceWorkflowGraph: (nodes, edges) =>
    a[0]((state) => {
      const deduped = deduplicateNodes(nodes);
      return { nodes: deduped, edges, selectedNodeId: resolveSelectedNodeId(deduped, state.selectedNodeId), isDirty: true };
    }),

  setGenerationContext: (lastPrompt, lastImplicitContext) => a[0]({ lastPrompt, lastImplicitContext }),

  setCurrentWorkflow: (id, name, nodes, edges, dirty = false) => {
    const deduped = deduplicateNodes(nodes.filter((node) => !isLegacyLoopRegionNode(node as never)));
    a[0]({
      currentWorkflowId: id, currentWorkflowName: name,
      nodes: deduped,
      edges: edges.map((edge) => normalizeEdge(edge as never) as unknown as Edge),
      selectedNodeId: resolveSelectedNodeId(deduped, null),
      isDirty: dirty,
    });
  },

  markClean: () => a[0]({ isDirty: false }),
}));
