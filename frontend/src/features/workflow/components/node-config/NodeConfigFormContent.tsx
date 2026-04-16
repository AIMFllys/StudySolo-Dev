'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NodeConfigFieldSchema, NodeConfigFieldSchemaOption } from '@/types';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { useNodeManifest } from '@/features/workflow/hooks/use-node-manifest';
import { authedFetch } from '@/services/api-client';
import { getAgentModels, getAgents, type AgentDirectoryItem, type AgentModelsResponse } from '@/services/agent.service';
import { buildLoopGroupConfigPatch, buildMergedConfigPatch } from './config-patch';
import { NodeConfigField } from './NodeConfigField';
import { KnowledgeNodeLibrary } from './KnowledgeNodeLibrary';
import { resolveNodeConfigCopy } from './resolve-node-config-copy';

interface NodeConfigFormContentProps {
  nodeId: string;
  showExecutionNotice?: boolean;
}

function buildDefaultConfig(schema: NodeConfigFieldSchema[]) {
  return Object.fromEntries(
    schema
      .filter((field) => field.default !== undefined)
      .map((field) => [field.key, field.default]),
  );
}

async function fetchDynamicOptions(
  nodeType: string,
  fieldKey: string,
): Promise<NodeConfigFieldSchemaOption[]> {
  try {
    const res = await authedFetch(`/api/nodes/config-options/${nodeType}/${fieldKey}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { options: NodeConfigFieldSchemaOption[] };
    return data.options ?? [];
  } catch {
    return [];
  }
}

export function NodeConfigFormContent({ nodeId, showExecutionNotice = false }: NodeConfigFormContentProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const executionSession = useWorkflowStore((state) => state.executionSession);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const { manifest, isLoading, error } = useNodeManifest();

  const node = useMemo(() => nodes.find((item) => item.id === nodeId) ?? null, [nodeId, nodes]);
  const nodeType = String((node?.data as { type?: string } | undefined)?.type ?? node?.type ?? '');
  const nodeLabel = (node?.data as { label?: string } | undefined)?.label;
  const manifestItem = useMemo(
    () => manifest.find((item) => item.type === nodeType) ?? null,
    [manifest, nodeType],
  );
  const agentName = manifestItem?.agent_name ?? null;
  const existingConfig = useMemo(
    () => ((node?.data as { config?: Record<string, unknown> } | undefined)?.config ?? {}),
    [node?.data],
  );

  const baseConfig = useMemo(() => {
    if (nodeType === 'loop_group') {
      return {
        maxIterations: (node?.data as Record<string, unknown>)?.maxIterations,
        intervalSeconds: (node?.data as Record<string, unknown>)?.intervalSeconds,
        description: (node?.data as Record<string, unknown>)?.description,
      };
    }
    return existingConfig;
  }, [existingConfig, node?.data, nodeType]);

  const baseSchema = useMemo(() => manifestItem?.config_schema ?? [], [manifestItem]);
  const [dynamicSchemaOverlay, setDynamicSchemaOverlay] = useState<NodeConfigFieldSchema[] | null>(null);
  const [agentDirectoryItem, setAgentDirectoryItem] = useState<AgentDirectoryItem | null>(null);
  const [agentModelsInfo, setAgentModelsInfo] = useState<AgentModelsResponse | null>(null);
  const [agentInfoError, setAgentInfoError] = useState<string | null>(null);
  const schema = dynamicSchemaOverlay ?? baseSchema;
  const isAgentNode = manifestItem?.model_source === 'agent' && Boolean(agentName);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasDynamic = baseSchema.some((field) => field.dynamic_options);
      if (!hasDynamic) {
        if (!cancelled) {
          setDynamicSchemaOverlay(null);
        }
        return;
      }

      const resolved = await Promise.all(
        baseSchema.map(async (field) => {
          if (!field.dynamic_options) {
            return field;
          }
          const options = await fetchDynamicOptions(nodeType, field.key);
          return { ...field, options };
        }),
      );

      if (!cancelled) {
        setDynamicSchemaOverlay(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseSchema, nodeType]);

  useEffect(() => {
    if (!isAgentNode || !agentName) {
      queueMicrotask(() => {
        setAgentDirectoryItem(null);
        setAgentModelsInfo(null);
        setAgentInfoError(null);
      });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [agents, models] = await Promise.all([
          getAgents(),
          getAgentModels(agentName),
        ]);
        if (cancelled) {
          return;
        }
        setAgentDirectoryItem(agents.find((item) => item.name === agentName) ?? null);
        setAgentModelsInfo(models);
        setAgentInfoError(null);
      } catch (error) {
        if (!cancelled) {
          setAgentInfoError(error instanceof Error ? error.message : '加载 Agent 信息失败');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentName, isAgentNode]);

  const mergedDefaults = useMemo(
    () => ({ ...buildDefaultConfig(schema), ...baseConfig }),
    [baseConfig, schema],
  );

  const applyConfigPatch = (patch: Record<string, unknown>, replace = false) => {
    if (nodeType === 'loop_group') {
      updateNodeData(nodeId, buildLoopGroupConfigPatch(patch));
      return;
    }

    updateNodeData(nodeId, {
      config: buildMergedConfigPatch(baseConfig ?? {}, patch, replace),
    });
  };

  if (!node) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
        当前没有可编辑的节点。
      </div>
    );
  }

  const copy = resolveNodeConfigCopy({
    nodeLabel,
    nodeType,
    manifestItem,
  });
  const isExecutionRunning = executionSession?.overallStatus === 'running';

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="text-sm text-muted-foreground">正在加载节点能力清单...</div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{copy.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                能力摘要
              </span>
              {(manifestItem?.output_capabilities ?? []).map((capability) => (
                <span
                  key={capability}
                  className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] text-primary"
                >
                  {capability}
                </span>
              ))}
            </div>
            {manifestItem?.deprecated_surface ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                已废弃旧入口：{manifestItem.deprecated_surface}，请以当前节点面板为主。
              </p>
            ) : null}
          </section>

          <section className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
            {isAgentNode ? (
              <div className="space-y-3 rounded-xl border border-rose-200/70 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/10">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Agent 绑定信息</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    这个节点固定绑定到子后端 Agent，不支持切换到其他 Agent，只能选择该 Agent 提供的模型。
                  </p>
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div>绑定 Agent：<span className="font-mono text-foreground">{manifestItem?.agent_name}</span></div>
                  <div>
                    健康状态：
                    <span className={`ml-1 font-medium ${agentModelsInfo?.healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                      {agentModelsInfo?.healthy ? 'healthy' : 'fallback / unavailable'}
                    </span>
                  </div>
                  <div>
                    模型来源：
                    <span className="ml-1 text-foreground">
                      {agentModelsInfo?.source === 'runtime' ? '子 Agent /v1/models' : 'agents.yaml 注册表回退'}
                    </span>
                  </div>
                  <div>
                    Skills：
                    <span className={`ml-1 font-medium ${agentDirectoryItem?.skills_ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {agentDirectoryItem?.skills_ready ? 'ready' : 'not-ready'}
                    </span>
                    <span className="ml-3">MCP：</span>
                    <span className={`ml-1 font-medium ${agentDirectoryItem?.mcp_ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {agentDirectoryItem?.mcp_ready ? 'ready' : 'not-ready'}
                    </span>
                  </div>
                  {agentModelsInfo?.models.length ? (
                    <div>可选模型：<span className="text-foreground">{agentModelsInfo.models.join(' / ')}</span></div>
                  ) : null}
                </div>

                {(agentDirectoryItem?.capabilities ?? manifestItem?.output_capabilities ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(agentDirectoryItem?.capabilities ?? manifestItem?.output_capabilities ?? []).map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-rose-300/70 bg-white/80 px-2 py-0.5 text-[11px] text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                ) : null}

                {agentInfoError ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">{agentInfoError}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">执行参数</h3>
                <p className="text-xs text-muted-foreground">
                  所有参数都会写入 `node.data.config`，执行时随节点一起发送给后端。
                </p>
              </div>

              {showExecutionNotice && isExecutionRunning ? (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-300">
                  当前工作流正在运行。这里的修改会即时写入当前节点真实数据，但不会回溯改变已经开始执行的步骤，主要影响后续保存状态与下一次执行。
                </div>
              ) : null}
            </div>

            {schema.length === 0 ? (
              <p className="text-sm text-muted-foreground">这个节点当前没有额外参数。</p>
            ) : (
              <div className="space-y-4">
                {schema.map((field) => (
                  <NodeConfigField
                    key={field.key}
                    field={field}
                    value={mergedDefaults[field.key]}
                    onChange={(value) => {
                      applyConfigPatch({
                        [field.key]: value,
                      });
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => applyConfigPatch(buildDefaultConfig(schema), true)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                恢复默认
              </button>
            </div>
          </section>

          {nodeType === 'knowledge_base' ? <KnowledgeNodeLibrary /> : null}
        </>
      )}
    </div>
  );
}
