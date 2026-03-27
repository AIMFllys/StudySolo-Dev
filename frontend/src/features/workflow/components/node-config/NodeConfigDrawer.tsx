'use client';

import { useEffect, useMemo, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import type { NodeConfigFieldSchema, NodeConfigFieldSchemaOption } from '@/types';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { getNodeTypeMeta } from '@/features/workflow/constants/workflow-meta';
import { useNodeManifest } from '@/features/workflow/hooks/use-node-manifest';
import { authedFetch } from '@/services/api-client';
import { NodeConfigField } from './NodeConfigField';
import { KnowledgeNodeLibrary } from './KnowledgeNodeLibrary';

interface NodeConfigDrawerProps {
  nodeId: string | null;
  onClose: () => void;
}

function buildDefaultConfig(schema: NodeConfigFieldSchema[]) {
  return Object.fromEntries(
    schema
      .filter((field) => field.default !== undefined)
      .map((field) => [field.key, field.default]),
  );
}

/** Fetch dynamic options for a schema field from the API */
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

export default function NodeConfigDrawer({ nodeId, onClose }: NodeConfigDrawerProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
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

  // For loop_group, read config from top-level data fields (legacy storage location)
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

  // Base schema from manifest (sync, no setState needed)
  const baseSchema = useMemo(() => manifestItem?.config_schema ?? [], [manifestItem]);

  // Dynamic options overlay — resolved asynchronously
  const [dynamicSchemaOverlay, setDynamicSchemaOverlay] = useState<NodeConfigFieldSchema[] | null>(null);

  const schema = dynamicSchemaOverlay ?? baseSchema;

  // Fetch dynamic options when nodeType or baseSchema changes.
  // All setState calls are inside the async IIFE callback, not the effect body.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasDynamic = baseSchema.some((f) => f.dynamic_options);
      if (!hasDynamic) {
        if (!cancelled) setDynamicSchemaOverlay(null);
        return;
      }
      const resolved = await Promise.all(
        baseSchema.map(async (field) => {
          if (!field.dynamic_options) return field;
          const options = await fetchDynamicOptions(nodeType, field.key);
          return { ...field, options };
        }),
      );
      if (!cancelled) setDynamicSchemaOverlay(resolved);
    })();

    return () => { cancelled = true; };
  }, [nodeType, baseSchema]);

  const mergedDefaults = useMemo(
    () => ({ ...buildDefaultConfig(schema), ...baseConfig }),
    [baseConfig, schema],
  );

  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>(mergedDefaults);
  // Note: this component is keyed on nodeId in WorkflowCanvas (key={configNodeId}),
  // so it naturally re-mounts when the selected node changes.
  // No manual reset effect needed.

  if (!nodeId || !node) {
    return null;
  }

  const meta = getNodeTypeMeta(nodeType);
  const isOpen = Boolean(nodeId);

  return (
    <div className={`fixed inset-y-0 right-0 z-[70] w-full max-w-xl border-l border-border bg-background shadow-2xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              节点配置
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
              {(node.data as { label?: string }).label ?? meta.label}
            </h2>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">正在加载节点能力清单...</div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              <section className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
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
                <div>
                  <h3 className="text-sm font-semibold text-foreground">执行参数</h3>
                  <p className="text-xs text-muted-foreground">
                    所有参数都会写入 `node.data.config`，执行时随节点一起发送给后端。
                  </p>
                </div>

                {schema.length === 0 ? (
                  <p className="text-sm text-muted-foreground">这个节点当前没有额外参数。</p>
                ) : (
                  <div className="space-y-4">
                    {schema.map((field) => (
                      <NodeConfigField
                        key={field.key}
                        field={field}
                        value={draftConfig[field.key]}
                        onChange={(value) => {
                          setDraftConfig((previous) => ({
                            ...previous,
                            [field.key]: value,
                          }));
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (nodeType === 'loop_group') {
                        updateNodeData(nodeId, {
                          maxIterations: draftConfig.maxIterations,
                          intervalSeconds: draftConfig.intervalSeconds,
                          description: draftConfig.description,
                        });
                        return;
                      }
                      updateNodeData(nodeId, { config: draftConfig });
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    保存配置
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftConfig(buildDefaultConfig(schema))}
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
      </div>
    </div>
  );
}
