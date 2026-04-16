import type { WorkflowNode } from './node-types';

/**
 * 连线类型 — 唯一：顺序线
 *
 * 条件分支和循环不是"线的类型"，而是"节点结构"：
 * - 条件分支 = logic_switch 节点 + 多条出边 + data.branch
 * - 循环 = LoopGroupNode 容器块
 */
export type EdgeType = 'sequential';

/** Handle 方位 ID (LEFT/TOP=target, RIGHT/BOTTOM=source) */
export type HandlePosition =
  | 'source-right'
  | 'source-bottom'
  | 'target-left'
  | 'target-top';

/** 连线附加数据 */
export interface WorkflowEdgeData extends Record<string, unknown> {
  /** 备注文字（不参与执行） */
  note?: string;
  /** 等待时间-秒（0-300，执行目标节点前等待） */
  waitSeconds?: number;
  /** 条件分支名（仅 logic_switch 出边使用，后端 executor 读取） */
  branch?: string;
}

/** 工作流连线（存储在 edges_json JSONB 中） */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: HandlePosition;
  targetHandle?: HandlePosition;
  type?: EdgeType;
  data?: WorkflowEdgeData;
}

/** 兼容旧数据 — 为缺失字段补充默认值，旧类型统一迁移为 sequential */
export function normalizeEdge(edge: Partial<WorkflowEdge> & { id: string; source: string; target: string }): WorkflowEdge {
  return {
    ...edge,
    type: 'sequential',
    sourceHandle: edge.sourceHandle || 'source-right',
    targetHandle: edge.targetHandle || 'target-left',
    data: edge.data || {},
  };
}

export function isLegacyLoopRegionNode(node: Partial<WorkflowNode> & { type?: string }) {
  return (node.type as string | undefined) === 'loop_region';
}
