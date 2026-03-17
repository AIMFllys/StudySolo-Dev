import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import WorkflowCanvasLoader from './WorkflowCanvasLoader';
import WorkflowPageShell from './WorkflowPageShell';
import { fetchWorkflowContentForServer } from '@/services/workflow.server.service';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkflowPage({ params }: Props) {
  const { id } = await params;
  const workflow = await fetchWorkflowContentForServer(id);

  if (!workflow) {
    notFound();
  }

  return (
    <WorkflowPageShell workflowName={workflow.name}>
      <Suspense fallback={<CanvasSkeleton />}>
        <WorkflowCanvasLoader
          workflowId={workflow.id}
          initialNodes={workflow.nodes_json ?? []}
          initialEdges={workflow.edges_json ?? []}
        />
      </Suspense>
    </WorkflowPageShell>
  );
}

function CanvasSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/20 animate-pulse">
      <span className="text-sm text-muted-foreground">加载画布中...</span>
    </div>
  );
}

