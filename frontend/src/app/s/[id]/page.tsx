import { notFound } from 'next/navigation';
import { fetchPublicWorkflowForServer } from '@/services/workflow.server.service';
import PublicWorkflowView from './PublicWorkflowView';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SharedWorkflowPage({ params }: Props) {
  const { id } = await params;
  const workflow = await fetchPublicWorkflowForServer(id);

  if (!workflow) {
    notFound();
  }

  return <PublicWorkflowView workflow={workflow} />;
}
