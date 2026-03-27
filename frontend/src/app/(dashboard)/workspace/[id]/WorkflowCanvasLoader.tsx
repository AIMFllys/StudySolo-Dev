'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import localforage from 'localforage';
import { useWorkflowSync, type LocalWorkflowCache } from '@/features/workflow/hooks/use-workflow-sync';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import CanvasTraceLoader from '@/features/workflow/components/canvas/CanvasTraceLoader';
import type { Node, Edge } from '@xyflow/react';

// Lazy-load the heavy canvas component with hand-drawn trace loader
const WorkflowCanvas = dynamic(
  () => import('@/features/workflow/components/canvas/WorkflowCanvas'),
  {
    ssr: false,
    loading: () => <CanvasTraceLoader />,
  }
);

interface Props {
  workflowId: string;
  workflowName: string;
  initialNodes: Node[];
  initialEdges: Edge[];
}

function cacheKey(id: string) {
  return `workflow_cache_${id}`;
}

export default function WorkflowCanvasLoader({ workflowId, workflowName, initialNodes, initialEdges }: Props) {
  const setCurrentWorkflow = useWorkflowStore((s) => s.setCurrentWorkflow);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const hasInitializedRef = useRef(false);
  useWorkflowSync();

  // Inject data into Zustand Store on mount, preferring local dirty cache over SSR data.
  // Nodes are loaded first; edges are deferred by one animation frame so ReactFlow's
  // Handle components finish DOM registration before edge connections are resolved.
  // This eliminates the ReactFlow error#008 "Couldn't create edge for target handle" warning loop.
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    (async () => {
      const cached = await localforage.getItem<LocalWorkflowCache>(cacheKey(workflowId));

      let nodes: Node[];
      let edges: Edge[];

      if (cached?.dirty && cached.nodes.length > 0) {
        nodes = cached.nodes;
        edges = cached.edges;
      } else {
        nodes = initialNodes;
        edges = initialEdges;
      }

      // Load nodes immediately (no edges yet)
      setCurrentWorkflow(workflowId, workflowName, nodes, []);

      // Defer edges by one frame so Handle components mount first
      requestAnimationFrame(() => {
        setEdges(edges);
      });
    })();
  }, [workflowId, workflowName]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WorkflowCanvas />;
}
