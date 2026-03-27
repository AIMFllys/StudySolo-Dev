'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NodeConfigFieldSchema, NodeConfigFieldSchemaOption } from '@/types';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { getNodeTypeMeta } from '@/features/workflow/constants/workflow-meta';
import { useNodeManifest } from '@/features/workflow/hooks/use-node-manifest';
import { authedFetch } from '@/services/api-client';
import { buildLoopGroupConfigPatch, buildMergedConfigPatch } from './config-patch';
import { NodeConfigField } from './NodeConfigField';
import { KnowledgeNodeLibrary } from './KnowledgeNodeLibrary';

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
  const manifestItem = useMemo(
    () => manifest.find((item) => item.type === nodeType) ?? null,
    [manifest, nodeType],
  );
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
  const schema = dynamicSchemaOverlay ?? baseSchema;

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

  const meta = getNodeTypeMeta(nodeType);
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
              <h3 className="text-sm font-semibold text-foreground">
                {(node.data as { label?: string }).label ?? meta.label}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
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
