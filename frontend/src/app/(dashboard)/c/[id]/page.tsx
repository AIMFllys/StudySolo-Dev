import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import WorkflowCanvasLoader from '@/app/(dashboard)/workspace/[id]/WorkflowCanvasLoader';
import WorkflowPageShell from '@/app/(dashboard)/workspace/[id]/WorkflowPageShell';
import {
  checkWorkflowOwnership,
  fetchWorkflowContentForServer,
} from '@/services/workflow.server.service';
import CanvasTraceLoader from '@/features/workflow/components/canvas/CanvasTraceLoader';

interface Props {
  params: Promise<{ id: string }>;
}

// Reserved route segments that should not be treated as workflow IDs
const RESERVED_SEGMENTS = ['new', 'create', 'edit', 'settings'];

export default async function PrivateCanvasPage({ params }: Props) {
  const { id } = await params;

  // Guard: prevent reserved segments from being treated as workflow IDs
  // This protects against routing errors when users navigate to /c/new, /c/create, etc.
  if (RESERVED_SEGMENTS.includes(id.toLowerCase())) {
    redirect('/workspace');
  }

  const workflow = await fetchWorkflowContentForServer(id);

  if (!workflow) {
    notFound();
  }

  // Determine ownership for toolbar features
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const isOwner = workflow.is_public
    ? await checkWorkflowOwnership(id, token)
    : true; // If not public, only owner can reach here (via check_workflow_access)

  return (
    <WorkflowPageShell
      workflowId={workflow.id}
      workflowName={workflow.name}
      isPublic={workflow.is_public}
      isOwner={isOwner}
    >
      <Suspense fallback={<CanvasTraceLoader />}>
        <WorkflowCanvasLoader
          key={workflow.id}
          workflowId={workflow.id}
          workflowName={workflow.name}
          initialNodes={workflow.nodes_json ?? []}
          initialEdges={workflow.edges_json ?? []}
        />
      </Suspense>
    </WorkflowPageShell>
  );
}
