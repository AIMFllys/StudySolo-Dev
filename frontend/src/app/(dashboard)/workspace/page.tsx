import { Suspense } from 'react';
import { fetchWorkflowListForServer, fetchUserQuotaForServer } from '@/services/workflow.server.service';
import WorkspacePageClient from './WorkspacePageClient';

const FREE_QUOTA_FALLBACK = {
  tier: 'free',
  workflows_used: 0,
  workflows_base_limit: 10,
  workflows_addon_qty: 0,
  workflows_total: 10,
  workflows_remaining: 10,
  daily_chat_used: 0,
  daily_chat_limit: 10,
  daily_execution_used: 0,
  daily_execution_limit: 5,
};

export default async function WorkspacePage() {
  const [workflows, quota] = await Promise.all([
    fetchWorkflowListForServer(),
    fetchUserQuotaForServer(),
  ]);

  // Graceful fallback: quota API failure degrades to free-tier assumptions
  const quotaData = quota ?? {
    ...FREE_QUOTA_FALLBACK,
    workflows_used: workflows.length,
    workflows_remaining: Math.max(0, FREE_QUOTA_FALLBACK.workflows_total - workflows.length),
  };

  return (
    <Suspense fallback={<div className="p-8">加载中...</div>}>
      <WorkspacePageClient initialWorkflows={workflows} quota={quotaData} />
    </Suspense>
  );
}
