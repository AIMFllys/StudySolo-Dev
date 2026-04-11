import type { StateCreator } from 'zustand';
import type { Edge, Node } from '@xyflow/react';
import { resolveSelectedNodeId } from '@/stores/workflow-store-helpers';

export interface HistorySlice {
  past: { nodes: Node[]; edges: Edge[] }[];
  future: { nodes: Node[]; edges: Edge[] }[];
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
}

interface StoreWithGraph {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
}

export const createHistorySlice: StateCreator<HistorySlice & StoreWithGraph, [], [], HistorySlice> = (set) => ({
  past: [],
  future: [],

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
      return {
        past: state.past.slice(0, -1),
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
      return {
        past: [...state.past, { nodes: state.nodes, edges: state.edges }],
        future: state.future.slice(1),
        nodes: next.nodes,
        edges: next.edges,
        selectedNodeId: resolveSelectedNodeId(next.nodes, state.selectedNodeId),
        isDirty: true,
      };
    }),
});
