import { authedFetch, parseApiError } from '@/services/api-client';

export interface AgentDirectoryItem {
  name: string;
  description: string;
  models: string[];
  owner: string;
  healthy: boolean;
  capabilities: string[];
  skills_ready: boolean;
  mcp_ready: boolean;
}

export interface AgentModelsResponse {
  agent: string;
  healthy: boolean;
  source: 'runtime' | 'registry-fallback';
  models: string[];
}

let _agentsCache: AgentDirectoryItem[] | null = null;
let _agentsInflight: Promise<AgentDirectoryItem[]> | null = null;
const _agentModelsCache = new Map<string, AgentModelsResponse>();
const _agentModelsInflight = new Map<string, Promise<AgentModelsResponse>>();

export async function getAgents(force = false): Promise<AgentDirectoryItem[]> {
  if (!force && _agentsCache) {
    return _agentsCache;
  }

  if (!force && _agentsInflight) {
    return _agentsInflight;
  }

  _agentsInflight = (async () => {
    const response = await authedFetch('/api/agents');
    if (!response.ok) {
      throw new Error(await parseApiError(response, '加载 Agent 列表失败'));
    }
    const data = (await response.json()) as AgentDirectoryItem[];
    _agentsCache = data;
    return data;
  })().finally(() => {
    _agentsInflight = null;
  });

  return _agentsInflight;
}

export async function getAgentModels(agentName: string, force = false): Promise<AgentModelsResponse> {
  if (!force && _agentModelsCache.has(agentName)) {
    return _agentModelsCache.get(agentName)!;
  }

  const inflight = _agentModelsInflight.get(agentName);
  if (!force && inflight) {
    return inflight;
  }

  const request = (async () => {
    const response = await authedFetch(`/api/agents/${agentName}/models`);
    if (!response.ok) {
      throw new Error(await parseApiError(response, '加载 Agent 模型列表失败'));
    }
    const data = (await response.json()) as AgentModelsResponse;
    _agentModelsCache.set(agentName, data);
    return data;
  })().finally(() => {
    _agentModelsInflight.delete(agentName);
  });

  _agentModelsInflight.set(agentName, request);
  return request;
}

export function invalidateAgentCache(agentName?: string) {
  _agentsCache = null;
  _agentsInflight = null;
  if (!agentName) {
    _agentModelsCache.clear();
    _agentModelsInflight.clear();
    return;
  }
  _agentModelsCache.delete(agentName);
  _agentModelsInflight.delete(agentName);
}
