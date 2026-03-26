'use client';

/**
 * ActionExecutor — 将 AI 返回的 CanvasAction 序列翻译为画布操作.
 *
 * 每次执行前自动对 WorkflowStore 做快照 (undo 支持)。
 * 严格按顺序执行, 任一步骤失败则返回错误。
 */

import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useWorkflowStore } from '@/stores/use-workflow-store';

export interface CanvasAction {
  operation: 'ADD_NODE' | 'DELETE_NODE' | 'UPDATE_NODE' | 'ADD_EDGE' | 'DELETE_EDGE' | 'COPY_NODE';
  target_node_id?: string;
  payload: {
    type?: string;
    label?: string;
    position?: { x: number; y: number };
    anchor_node_id?: string;
    source_node_id?: string;
    new_label?: string;
    source_id?: string;
    target_id?: string;
    updates?: Record<string, string>;
  };
}

export interface ExecutionResult {
  success: boolean;
  appliedCount: number;
  error?: string;
}

/** 安全获取 position, fallback 到 {x:120, y:120} */
function safePos(pos?: { x?: number; y?: number }) {
  return { x: pos?.x ?? 120, y: pos?.y ?? 120 };
}

/** 计算不与现有节点重叠的 x 位置 */
function calcSafeX(existingNodes: Node[], anchorX: number): number {
  const maxX = existingNodes.reduce((m, n) => Math.max(m, n.position?.x ?? 0), 0);
  return Math.max(anchorX + 340, maxX + 340);
}

export async function executeCanvasActions(actions: CanvasAction[]): Promise<ExecutionResult> {
  const store = useWorkflowStore.getState();

  if (!actions.length) return { success: true, appliedCount: 0 };

  // 执行前快照 (保证一次 MODIFY 可以整体 undo)
  store.takeSnapshot();

  const state = store;
  let nodes: Node[] = [...state.nodes];
  let edges: Edge[] = [...state.edges];
  let appliedCount = 0;

      for (const action of actions) {
        try {
          switch (action.operation) {
            // ── ADD_NODE ──────────────────────────────────────
            case 'ADD_NODE': {
              const { type, label, position, anchor_node_id } = action.payload;
              if (!type || !label) {
                throw new Error('ADD_NODE 缺少 type 或 label');
              }

              const anchor = anchor_node_id
                ? nodes.find((n) => n.id === anchor_node_id)
                : nodes[nodes.length - 1];

              const anchorX = anchor?.position?.x ?? 120;
              const anchorY = anchor?.position?.y ?? 120;

              const finalPos = position
                ? { x: position.x, y: position.y }
                : { x: calcSafeX(nodes, anchorX), y: anchorY };

              const newNode: Node = {
                id: `ai-node-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                type: 'ai_step',
                position: finalPos,
                data: {
                  label,
                  type,
                  system_prompt: '',
                  model_route: '',   // User selects model via NodeModelSelector
                  status: 'pending',
                  output: '',
                },
              };
              nodes = [...nodes, newNode];

              // 自动连线: anchor → newNode
              if (anchor) {
                const edgeId = `edge-ai-${anchor.id}-${newNode.id}`;
                edges = [
                  ...edges,
                  {
                    id: edgeId,
                    source: anchor.id,
                    target: newNode.id,
                    type: 'sequential',
                    animated: false,
                    data: {},
                  } as Edge,
                ];
              }
              appliedCount++;
              break;
            }

            // ── DELETE_NODE ───────────────────────────────────
            case 'DELETE_NODE': {
              const targetId = action.target_node_id;
              if (!targetId) throw new Error('DELETE_NODE 缺少 target_node_id');
              if (nodes.length <= 1) throw new Error('至少保留 1 个节点');

              nodes = nodes.filter((n) => n.id !== targetId);
              // 删除关联连线
              edges = edges.filter(
                (e) => e.source !== targetId && e.target !== targetId,
              );
              appliedCount++;
              break;
            }

            // ── UPDATE_NODE ───────────────────────────────────
            case 'UPDATE_NODE': {
              const targetId = action.target_node_id;
              const updates = action.payload.updates ?? {};
              if (!targetId) throw new Error('UPDATE_NODE 缺少 target_node_id');

              nodes = nodes.map((n) => {
                if (n.id !== targetId) return n;
                const prevData = n.data as Record<string, unknown>;
                return {
                  ...n,
                  data: { ...prevData, ...(updates.label ? { label: updates.label } : {}) },
                };
              });
              appliedCount++;
              break;
            }

            // ── COPY_NODE ─────────────────────────────────────
            case 'COPY_NODE': {
              const { source_node_id, new_label, position } = action.payload;
              if (!source_node_id) throw new Error('COPY_NODE 缺少 source_node_id');
              
              const sourceNode = nodes.find(n => n.id === source_node_id);
              if (!sourceNode) throw new Error(`源节点 ${source_node_id} 不存在`);

              const sourceData = sourceNode.data as Record<string, unknown>;
              const newId = `copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

              const copiedNode: Node = {
                id: newId,
                type: sourceNode.type,  // 保持与源节点一致的类型
                position: position ?? {
                  x: (sourceNode.position?.x ?? 120) + 60,
                  y: (sourceNode.position?.y ?? 120) + 60,
                },
                data: {
                  ...sourceData,
                  label: new_label ?? `${sourceData.label} (副本)`,
                  status: 'pending',   // 重置运行状态
                  output: '',           // 清空输出
                },
              };

              nodes = [...nodes, copiedNode];
              appliedCount++;
              break;
            }

            // ── ADD_EDGE ──────────────────────────────────────
            case 'ADD_EDGE': {
              const { source_id, target_id } = action.payload;
              if (!source_id || !target_id) throw new Error('ADD_EDGE 缺少 source_id 或 target_id');
              const exists = edges.some(
                (e) => e.source === source_id && e.target === target_id,
              );
              if (!exists) {
                edges = [
                  ...edges,
                  {
                    id: `edge-ai-${source_id}-${target_id}-${Date.now().toString(36)}`,
                    source: source_id,
                    target: target_id,
                    type: 'sequential',
                    animated: false,
                    data: {},
                  } as Edge,
                ];
              }
              appliedCount++;
              break;
            }

            // ── DELETE_EDGE ───────────────────────────────────
            case 'DELETE_EDGE': {
              const { source_id, target_id } = action.payload;
              if (!source_id || !target_id) throw new Error('DELETE_EDGE 缺少 source_id 或 target_id');
              edges = edges.filter(
                (e) => !(e.source === source_id && e.target === target_id),
              );
              appliedCount++;
              break;
            }

            default:
              throw new Error(`未知操作: ${action.operation}`);
          }
        } catch (err) {
          // 任一 action 失败 → 整体回滚 (undo 快照自动保留了前置状态)
          store.undo();
          return {
            success: false,
            appliedCount,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      // 一次性提交到 Store
      store.setNodes(nodes);
      store.setEdges(edges);

      return { success: true, appliedCount };
}

export function useActionExecutor() {
  return { execute: executeCanvasActions };
}
