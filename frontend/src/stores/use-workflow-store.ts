import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import type { AIStepNodeData } from '@/types';

type NodeData = AIStepNodeData;

interface WorkflowStore {
  // 核心状态
  nodes: Node[];
  edges: Edge[];
  currentWorkflowId: string | null;
  isDirty: boolean;

  // 操作
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  updateNodeData: (
    nodeId: string,
    data: Partial<NodeData> | ((prev: NodeData) => Partial<NodeData>)
  ) => void;
  setCurrentWorkflow: (id: string, nodes: Node[], edges: Edge[]) => void;
  markClean: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  edges: [],
  currentWorkflowId: null,
  isDirty: false,

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const prevData = node.data as NodeData;
        const patch = typeof data === 'function' ? data(prevData) : data;
        return { ...node, data: { ...prevData, ...patch } };
      }),
      isDirty: true,
    })),

  setCurrentWorkflow: (id, nodes, edges) =>
    set({ currentWorkflowId: id, nodes, edges, isDirty: false }),

  markClean: () => set({ isDirty: false }),
}));
