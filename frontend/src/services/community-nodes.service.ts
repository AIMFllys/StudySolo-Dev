import { authedFetch, parseApiError } from '@/services/api-client';
import type {
  CommunityNodeCategory,
  CommunityNodeListResponse,
  CommunityNodeMine,
  CommunityNodePublic,
  CommunityNodeSort,
  GenerateSchemaRequest,
  GenerateSchemaResponse,
  PublishCommunityNodeInput,
  UpdateCommunityNodeInput,
} from '@/types';

interface CommunityNodeListParams {
  page?: number;
  perPage?: number;
  sort?: CommunityNodeSort;
  category?: CommunityNodeCategory | '';
  search?: string;
}

function toQueryString(params: CommunityNodeListParams) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('per_page', String(params.perPage));
  if (params.sort) qs.set('sort', params.sort);
  if (params.category) qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  return qs.toString();
}

export async function listCommunityNodes(
  params: CommunityNodeListParams = {},
): Promise<CommunityNodeListResponse> {
  const qs = toQueryString(params);
  const response = await authedFetch(`/api/community-nodes/${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error(await parseApiError(response, '加载共享节点失败'));
  }
  return response.json() as Promise<CommunityNodeListResponse>;
}

export async function listMyCommunityNodes(): Promise<CommunityNodeMine[]> {
  const response = await authedFetch('/api/community-nodes/mine');
  if (!response.ok) {
    throw new Error(await parseApiError(response, '加载我的共享节点失败'));
  }
  return response.json() as Promise<CommunityNodeMine[]>;
}

export async function getMyCommunityNode(nodeId: string): Promise<CommunityNodeMine> {
  const response = await authedFetch(`/api/community-nodes/mine/${nodeId}`);
  if (!response.ok) {
    throw new Error(await parseApiError(response, '加载我的共享节点失败'));
  }
  return response.json() as Promise<CommunityNodeMine>;
}

export async function getCommunityNode(nodeId: string): Promise<CommunityNodePublic> {
  const response = await authedFetch(`/api/community-nodes/${nodeId}`);
  if (!response.ok) {
    throw new Error(await parseApiError(response, '加载共享节点详情失败'));
  }
  return response.json() as Promise<CommunityNodePublic>;
}

export async function publishCommunityNode(
  input: PublishCommunityNodeInput,
): Promise<CommunityNodeMine> {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('description', input.description);
  formData.append('icon', input.icon);
  formData.append('category', input.category);
  formData.append('prompt', input.prompt);
  formData.append('input_hint', input.input_hint);
  formData.append('output_format', input.output_format);
  formData.append('model_preference', input.model_preference);
  if (input.output_schema) {
    formData.append('output_schema', JSON.stringify(input.output_schema));
  }
  if (input.knowledge_file) {
    formData.append('knowledge_file', input.knowledge_file);
  }

  const response = await authedFetch('/api/community-nodes', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '发布共享节点失败'));
  }
  return response.json() as Promise<CommunityNodeMine>;
}

export async function updateCommunityNode(
  nodeId: string,
  input: UpdateCommunityNodeInput,
): Promise<CommunityNodeMine> {
  const response = await authedFetch(`/api/community-nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '更新共享节点失败'));
  }
  return response.json() as Promise<CommunityNodeMine>;
}

export async function deleteCommunityNode(nodeId: string): Promise<void> {
  const response = await authedFetch(`/api/community-nodes/${nodeId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '删除共享节点失败'));
  }
}

export async function likeCommunityNode(nodeId: string): Promise<number> {
  const response = await authedFetch(`/api/community-nodes/${nodeId}/like`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '点赞失败'));
  }
  const data = await response.json() as { count: number };
  return data.count;
}

export async function unlikeCommunityNode(nodeId: string): Promise<number> {
  const response = await authedFetch(`/api/community-nodes/${nodeId}/like`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '取消点赞失败'));
  }
  const data = await response.json() as { count: number };
  return data.count;
}

export async function generateCommunityNodeSchema(
  input: GenerateSchemaRequest,
): Promise<GenerateSchemaResponse> {
  const response = await authedFetch('/api/community-nodes/generate-schema', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '生成 Schema 失败'));
  }
  return response.json() as Promise<GenerateSchemaResponse>;
}
