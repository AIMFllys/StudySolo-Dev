import type { ThinkingDepth } from '@/components/layout/sidebar/SidebarAIPanel';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { executeCanvasActions, type CanvasAction } from './use-action-executor';
import { authedFetch } from '@/services/api-client';
import { eventBus } from '@/lib/events/event-bus';

interface GenerateResponse {
  nodes: unknown[];
  edges: unknown[];
  implicit_context: Record<string, unknown>;
}

function hydrateTriggerInputNodes(nodes: unknown[], userInput: string) {
  return nodes.map((node) => {
    if (!node || typeof node !== 'object') return node;
    const typedNode = node as { type?: string; data?: Record<string, unknown> };
    if (typedNode.type !== 'trigger_input') return node;

    const nextData = {
      ...(typedNode.data ?? {}),
      user_content: (typedNode.data?.user_content as string | undefined) || userInput,
      label: (typedNode.data?.label as string | undefined) || userInput.trim().slice(0, 80) || '用户输入',
      config: (typedNode.data?.config as Record<string, unknown> | undefined) ?? {},
    };
    return { ...typedNode, data: nextData };
  });
}

export async function handleBuildIntent(userInput: string, thinkingDepth: ThinkingDepth): Promise<string> {
  const wfStore = useWorkflowStore.getState();
  wfStore.replaceWorkflowGraph(
    [{ id: 'generating-node', position: { x: 300, y: 200 }, type: 'generating', data: {} }],
    [],
  );

  const res = await authedFetch('/api/ai/generate-workflow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_input: userInput, thinking_level: thinkingDepth }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as GenerateResponse;
  // #region agent log
  fetch('/api/debug/log',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f04052'},body:JSON.stringify({sessionId:'f04052',runId:'pre-fix',hypothesisId:'H3',location:'stream-chat-intents.ts',message:'frontend received generated workflow',data:{nodeCount:Array.isArray(data.nodes)?data.nodes.length:0,edgeCount:Array.isArray(data.edges)?data.edges.length:0},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const hydratedNodes = hydrateTriggerInputNodes(data.nodes, userInput);
  // #region agent log
  fetch('/api/debug/log',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f04052'},body:JSON.stringify({sessionId:'f04052',runId:'pre-fix',hypothesisId:'H4',location:'stream-chat-intents.ts',message:'frontend hydrated nodes',data:{nodeCount:hydratedNodes.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  wfStore.replaceWorkflowGraph(
    hydratedNodes as Parameters<typeof wfStore.replaceWorkflowGraph>[0],
    data.edges as Parameters<typeof wfStore.replaceWorkflowGraph>[1],
  );
  // #region agent log
  fetch('/api/debug/log',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f04052'},body:JSON.stringify({sessionId:'f04052',runId:'pre-fix',hypothesisId:'H5',location:'stream-chat-intents.ts',message:'store nodes after replaceWorkflowGraph',data:{nodeCount:wfStore.nodes.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  wfStore.setGenerationContext(userInput, data.implicit_context);
  eventBus.emit('workflow:fit-view-request', { reason: 'ai-build' });

  return `✅ 已生成 ${hydratedNodes.length} 个节点。`;
}

export async function handleModifyIntent(rawJson: string, msgId: string): Promise<string> {
  try {
    const p = JSON.parse(rawJson) as {
      actions?: CanvasAction[];
      response?: string;
      error?: string;
      error_detail?: string;
    };
    if (p.error) {
      console.warn('Modify intent failed to produce executable actions', {
        msgId, error: p.error, detail: p.error_detail, rawJson,
      });
      return `⚠️ ${p.response ?? 'AI 没有返回可执行的画布操作。请重试，或改用手动编辑节点。'}`;
    }
    const actions = p.actions ?? [];
    if (!actions.length) return p.response ?? '（完成）';

    const result = await executeCanvasActions(actions);
    return result.success
      ? `✅ ${p.response || '完成'} (${result.appliedCount}步)`
      : `⚠️ ${result.error}`;
  } catch (error) {
    console.warn('Failed to parse MODIFY payload', { msgId, error, rawJson });
    return '⚠️ AI 返回了不可执行的画布操作。请重试，或改用手动编辑节点。';
  }
}
