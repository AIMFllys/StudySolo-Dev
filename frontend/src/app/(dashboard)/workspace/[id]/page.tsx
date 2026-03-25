import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Legacy route — 301 redirect handled by next.config.ts,
 * but as a safety net, this page also redirects to /c/[id].
 */
export default async function LegacyWorkflowPage({ params }: Props) {
  const { id } = await params;
  redirect(`/c/${id}`);
}
