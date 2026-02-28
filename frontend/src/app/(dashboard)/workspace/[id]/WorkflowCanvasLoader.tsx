'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { Node, Edge } from '@xyflow/react';

// Lazy-load the heavy canvas component
const WorkflowCanvas = dynamic(
  () => import('@/components/business/workflow/WorkflowCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center animate-pulse">
        <span className="text-muted-foreground text-sm">初始化画布…</span>
      </div>
    ),
  }
);

interface Props {
  workflowId: string;
  initialNodes: Node[];
  initialEdges: Edge[];
}

export default function WorkflowCanvasLoader({ workflowId, initialNodes, initialEdges }: Props) {
  const setCurrentWorkflow = useWorkflowStore((s) => s.setCurrentWorkflow);

  // Inject SSR-fetched data into Zustand Store on mount
  useEffect(() => {
    setCurrentWorkflow(workflowId, initialNodes, initialEdges);
  }, [workflowId, initialNodes, initialEdges, setCurrentWorkflow]);

  return <WorkflowCanvas />;
}
