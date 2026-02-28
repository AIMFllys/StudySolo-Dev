import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/utils/supabase/server';
import WorkflowCanvasLoader from './WorkflowCanvasLoader';
import RunButton from '@/components/business/workflow/RunButton';
import WorkflowPromptInput from '@/components/business/workflow/WorkflowPromptInput';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkflowPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: workflow } = await supabase
    .from('workflows')
    .select('id,name,nodes_json,edges_json')
    .eq('id', id)
    .single();

  if (!workflow) notFound();

  return (
    <div className="flex flex-col h-full">
      {/* Header + Run button */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
        <h1 className="text-sm font-medium truncate">{workflow.name}</h1>
        <RunButton />
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <Suspense fallback={<CanvasSkeleton />}>
          <WorkflowCanvasLoader
            workflowId={workflow.id}
            initialNodes={workflow.nodes_json ?? []}
            initialEdges={workflow.edges_json ?? []}
          />
        </Suspense>
      </div>

      {/* Prompt input at bottom */}
      <WorkflowPromptInput />
    </div>
  );
}

function CanvasSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/20 animate-pulse">
      <span className="text-muted-foreground text-sm">加载画布中…</span>
    </div>
  );
}
