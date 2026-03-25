import { cookies } from 'next/headers';
import {
  fetchPublicWorkflow,
  fetchWorkflowContent,
  fetchWorkflowList,
} from '@/services/workflow.service';
import type { WorkflowContent, WorkflowMeta, WorkflowPublicView } from '@/types/workflow';

async function getAccessTokenFromCookieStore() {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

export async function fetchWorkflowListForServer(): Promise<WorkflowMeta[]> {
  const token = await getAccessTokenFromCookieStore();
  return fetchWorkflowList(token, 30);
}

export async function fetchWorkflowContentForServer(
  workflowId: string
): Promise<WorkflowContent | null> {
  const token = await getAccessTokenFromCookieStore();
  return fetchWorkflowContent(workflowId, token);
}

export async function fetchPublicWorkflowForServer(
  workflowId: string
): Promise<WorkflowPublicView | null> {
  const token = await getAccessTokenFromCookieStore();
  return fetchPublicWorkflow(workflowId, token);
}
